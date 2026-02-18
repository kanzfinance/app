'use client'

import { useState, useCallback, useEffect } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { useWallets } from '@privy-io/react-auth'
import { useWallets as useSolanaWallets, useSignAndSendTransaction } from '@privy-io/react-auth/solana'
import {
  createExecution,
  getExecution,
  getBridgePayload,
  submitEvmTx,
  getSwapPayload,
  submitSwapTx,
  type ExecutionResponse,
} from '@/lib/api/client'
import { ExecutionStatus } from '@/components/ExecutionStatus'

const POLL_MS = 3000

export function BuyFlow() {
  const { getAccessToken } = usePrivy()
  const { wallets } = useWallets()
  const solanaWallets = useSolanaWallets()
  const { signAndSendTransaction } = useSignAndSendTransaction()
  const [amount, setAmount] = useState('')
  const [sourceChain, setSourceChain] = useState<'base' | 'monad'>('base')
  const [bridgeProvider, setBridgeProvider] = useState<'lifi' | 'wormhole'>('lifi')
  const [execution, setExecution] = useState<ExecutionResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const pollExecution = useCallback(
    async (executionId: string) => {
      const token = await getAccessToken()
      if (!token) return
      const e = await getExecution(token, executionId)
      setExecution(e)
      return e
    },
    [getAccessToken]
  )

  const handleBuy = async () => {
    const token = await getAccessToken()
    if (!token) {
      setError('Not authenticated')
      return
    }
    const evmWallet = wallets.find(
      (w): w is typeof w & { getEthereumProvider: () => Promise<unknown> } =>
        typeof (w as { getEthereumProvider?: () => Promise<unknown> }).getEthereumProvider === 'function'
    )
    const solanaWallet = solanaWallets.wallets?.[0]
    if (!evmWallet?.address) {
      setError('Connect an EVM wallet (MetaMask / WalletConnect) to bridge USDC.')
      return
    }
    if (!solanaWallet?.address) {
      setError('Solana wallet is required to receive bridged USDC. It’s created automatically when you log in—try refreshing or reconnecting.')
      return
    }
    const amt = amount.trim()
    if (!amt || Number.isNaN(Number(amt)) || Number(amt) <= 0) {
      setError('Enter a valid USDC amount')
      return
    }
    setError(null)
    setLoading(true)
    try {
      const created = await createExecution(token, {
        amount_usdc: amt,
        source_chain: sourceChain,
      })
      const executionId = created.execution_id
      const initial = await pollExecution(executionId)
      setExecution(initial ?? null)
      if (!initial) {
        setError('Failed to load execution')
        setLoading(false)
        return
      }
      const bridgePayload = await getBridgePayload(
        token,
        executionId,
        sourceChain === 'base' ? { bridge_provider: bridgeProvider } : undefined
      )
      const provider = (await evmWallet.getEthereumProvider()) as {
        request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
      }
      if (bridgePayload.approval_to && bridgePayload.approval_data) {
        const approvalTxHash = (await provider.request({
          method: 'eth_sendTransaction',
          params: [
            {
              to: bridgePayload.approval_to,
              data: bridgePayload.approval_data,
              value: bridgePayload.approval_value ?? '0',
            },
          ],
        })) as string
        for (let i = 0; i < 30; i++) {
          await new Promise((r) => setTimeout(r, 1000))
          const receipt = await provider.request({
            method: 'eth_getTransactionReceipt',
            params: [approvalTxHash],
          })
          if (receipt && typeof receipt === 'object' && (receipt as { blockNumber?: unknown }).blockNumber) break
        }
      }
      const txHash = (await provider.request({
        method: 'eth_sendTransaction',
        params: [
          {
            to: bridgePayload.to,
            data: bridgePayload.data,
            value: bridgePayload.value ?? '0',
            gasLimit: bridgePayload.gasLimit,
          },
        ],
      })) as string
      await submitEvmTx(token, executionId, txHash)
      let e: ExecutionResponse | undefined = await pollExecution(executionId)
      while (e && e.status !== 'BRIDGED' && e.status !== 'FAILED') {
        await new Promise((r) => setTimeout(r, POLL_MS))
        e = await pollExecution(executionId)
      }
      if (e) setExecution(e)
      if (e?.status === 'FAILED') {
        setLoading(false)
        return
      }
      const swapPayload = await getSwapPayload(token, executionId)
      const decoded = Uint8Array.from(Buffer.from(swapPayload.serialized_tx, 'base64'))
      const { signature } = await signAndSendTransaction({
        transaction: decoded,
        wallet: solanaWallet,
      })
      const bs58 = (await import('bs58')).default
      const swapTxHashB58 = bs58.encode(signature)
      await submitSwapTx(token, executionId, { swap_tx_hash: swapTxHashB58 })
      while (e && e.status !== 'COMPLETED' && e.status !== 'FAILED') {
        await new Promise((r) => setTimeout(r, POLL_MS))
        e = await pollExecution(executionId)
        if (e) setExecution(e)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong'
      if (msg === 'missing_solana_wallet') {
        setError('Solana wallet is required to receive bridged USDC. Refresh the page so your wallets can sync, then try again.')
      } else if (msg === 'missing_evm_wallet') {
        setError('EVM wallet is required to send USDC. Connect an EVM wallet (e.g. MetaMask) and try again.')
      } else if (msg === 'bridge_not_configured') {
        setError('Monad bridge is not configured. Add CCTP_MONAD_TOKEN_MESSENGER and CCTP_MONAD_USDC to the API .env (see .env.example).')
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm text-gray-400 mb-1">From chain</label>
          <select
            value={sourceChain}
            onChange={(e) => setSourceChain(e.target.value as 'base' | 'monad')}
            className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white"
            disabled={loading}
          >
            <option value="base">Base (LI.FI / Wormhole)</option>
            <option value="monad">Monad (CCTP)</option>
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Bridge</label>
          <select
            value={bridgeProvider}
            onChange={(e) => setBridgeProvider(e.target.value as 'lifi' | 'wormhole')}
            className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white"
            disabled={loading || sourceChain !== 'base'}
          >
            <option value="lifi">LI.FI (best route)</option>
            <option value="wormhole">Wormhole (via LI.FI)</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-sm text-gray-400 mb-1">USDC amount</label>
        <input
          type="text"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="100"
          className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white placeholder-gray-500"
          disabled={loading}
        />
      </div>
      <p className="text-sm text-white/60">
        USDC is bridged from your EVM wallet to <strong>your Solana wallet</strong>, then swapped to GOLD.
      </p>
      <button
        onClick={handleBuy}
        disabled={loading}
        className="w-full py-3 bg-white text-black font-semibold rounded-lg hover:bg-gray-200 disabled:opacity-50"
      >
        {loading ? 'Processing…' : 'Buy (Bridge USDC → Swap to GOLD)'}
      </button>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {execution && <ExecutionStatus execution={execution} />}
    </div>
  )
}
