'use client'

import { useState, useCallback } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { useWallets } from '@privy-io/react-auth'
import { useWallets as useSolanaWallets, useSignAndSendTransaction } from '@privy-io/react-auth/solana'
import bs58 from 'bs58'
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
const DEBUG = true
function log(scope: string, message: string, data?: unknown) {
  if (DEBUG) {
    console.log(`[Kanz:BuyFlow:${scope}]`, data !== undefined ? { message, data } : { message })
  }
}

export function BuyFlow() {
  const { getAccessToken } = usePrivy()
  const { wallets } = useWallets()
  const solanaWallets = useSolanaWallets()
  const { signAndSendTransaction } = useSignAndSendTransaction()
  const [amount, setAmount] = useState('')
  const [sourceChain, setSourceChain] = useState<'base' | 'monad'>('base')
  const [execution, setExecution] = useState<ExecutionResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const pollExecution = useCallback(
    async (executionId: string) => {
      const token = await getAccessToken()
      if (!token) {
        log('poll', 'no token')
        return
      }
      log('poll', 'getExecution', { executionId })
      const e = await getExecution(token, executionId)
      log('poll', 'execution', { executionId, status: e?.status })
      setExecution(e)
      return e
    },
    [getAccessToken]
  )

  const handleBuy = async () => {
    log('buy', 'start', { amount: amount.trim(), sourceChain })
    const token = await getAccessToken()
    if (!token) {
      log('buy', 'auth failed', { reason: 'no token' })
      setError('Not authenticated')
      return
    }
    const evmWallet = wallets.find(
      (w): w is typeof w & { getEthereumProvider: () => Promise<unknown> } =>
        typeof (w as { getEthereumProvider?: () => Promise<unknown> }).getEthereumProvider === 'function'
    )
    const solanaWallet = solanaWallets.wallets?.[0]
    log('buy', 'wallets', { evm: !!evmWallet?.address, solana: !!solanaWallet?.address })
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
      log('buy', 'createExecution', { amount_usdc: amt, source_chain: sourceChain })
      let created
      try {
        created = await createExecution(token, {
          amount_usdc: amt,
          source_chain: sourceChain,
        })
        log('buy', 'createExecution resolved', { full: created })
      } catch (createErr) {
        log('buy', 'createExecution failed', {
          err: createErr,
          message: createErr instanceof Error ? createErr.message : String(createErr),
          cause: createErr instanceof Error ? createErr.cause : undefined,
          stack: createErr instanceof Error ? createErr.stack : undefined,
        })
        throw createErr
      }
      const executionId = created.execution_id
      log('buy', 'created', { executionId, status: created.status, is_duplicate: created.is_duplicate })
      const initial = await pollExecution(executionId)
      setExecution(initial ?? null)
      if (!initial) {
        setError('Failed to load execution')
        setLoading(false)
        return
      }
      const bridgeOpts = sourceChain === 'base' ? { bridge_provider: 'lifi' as const } : undefined
      log('buy', 'getBridgePayload', { executionId, bridge_provider: bridgeOpts?.bridge_provider })
      const bridgePayload = await getBridgePayload(token, executionId, bridgeOpts)
      log('buy', 'bridgePayload', { to: bridgePayload.to, hasApproval: !!bridgePayload.approval_to })
      const provider = (await evmWallet.getEthereumProvider()) as {
        request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
      }
      if (bridgePayload.approval_to && bridgePayload.approval_data) {
        log('buy', 'approval tx start')
        const approvalParams: Record<string, string> = {
          to: String(bridgePayload.approval_to),
          data: String(bridgePayload.approval_data),
          value: String(bridgePayload.approval_value ?? '0'),
        }
        if (!approvalParams.value.startsWith('0x')) {
          approvalParams.value = '0x' + BigInt(approvalParams.value).toString(16)
        }
        const approvalTxHash = (await provider.request({
          method: 'eth_sendTransaction',
          params: [approvalParams],
        })) as string
        log('buy', 'approval tx sent', { approvalTxHash })
        for (let i = 0; i < 30; i++) {
          await new Promise((r) => setTimeout(r, 1000))
          const receipt = await provider.request({
            method: 'eth_getTransactionReceipt',
            params: [approvalTxHash],
          })
          if (receipt && typeof receipt === 'object' && (receipt as { blockNumber?: unknown }).blockNumber) {
            log('buy', 'approval tx confirmed', { block: (receipt as { blockNumber?: unknown }).blockNumber })
            break
          }
        }
      }
      log('buy', 'bridge tx send')
      let valueHex = String(bridgePayload.value ?? '0')
      if (!valueHex.startsWith('0x')) {
        valueHex = '0x' + BigInt(valueHex).toString(16)
      }
      const txParams: Record<string, string> = {
        to: String(bridgePayload.to),
        data: String(bridgePayload.data),
        value: valueHex,
      }
      if (bridgePayload.gasLimit != null && bridgePayload.gasLimit !== '') {
        txParams.gasLimit = String(bridgePayload.gasLimit)
      }
      const txHash = (await provider.request({
        method: 'eth_sendTransaction',
        params: [txParams],
      })) as string
      log('buy', 'bridge tx sent', { txHash })
      await submitEvmTx(token, executionId, txHash)
      let e: ExecutionResponse | undefined = await pollExecution(executionId)
      while (e && e.status !== 'BRIDGED' && e.status !== 'FAILED') {
        await new Promise((r) => setTimeout(r, POLL_MS))
        e = await pollExecution(executionId)
      }
      if (e) setExecution(e)
      if (e?.status === 'FAILED') {
        log('buy', 'bridge failed', { status: e.status, error: e.error_message })
        setLoading(false)
        return
      }
      log('buy', 'swap: user signs and sends (Privy modal)')
      const swapToken = await getAccessToken()
      if (!swapToken) {
        setError('Session expired. Please refresh and try again.')
        setLoading(false)
        return
      }
      const { serialized_tx } = await getSwapPayload(swapToken, executionId)
      const txBytes = Uint8Array.from(atob(serialized_tx), (c) => c.charCodeAt(0))
      const solanaWallet = solanaWallets.wallets?.[0]
      if (!solanaWallet) {
        setError('Solana wallet not found. Refresh and try again.')
        setLoading(false)
        return
      }
      const { signature: sigBytes } = await signAndSendTransaction({
        transaction: txBytes,
        wallet: solanaWallet,
        chain: 'solana:mainnet',
      })
      const swapTxHash = bs58.encode(sigBytes)
      await submitSwapTx(swapToken, executionId, { swap_tx_hash: swapTxHash })
      log('buy', 'swap sign-and-send completed')
      e = await pollExecution(executionId)
      if (e) setExecution(e)
      while (e && e.status !== 'COMPLETED' && e.status !== 'FAILED') {
        await new Promise((r) => setTimeout(r, POLL_MS))
        e = await pollExecution(executionId)
        if (e) setExecution(e)
      }
      log('buy', 'flow done', { executionId, status: e?.status })
    } catch (err) {
      log('buy', 'error', {
        err,
        message: err instanceof Error ? err.message : String(err),
        cause: err instanceof Error ? err.cause : undefined,
        stack: err instanceof Error ? err.stack : undefined,
      })
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
      <div>
        <label className="block text-sm text-gray-400 mb-1">From chain</label>
        <select
          value={sourceChain}
          onChange={(e) => setSourceChain(e.target.value as 'base' | 'monad')}
          className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white"
          disabled={loading}
        >
          <option value="base">Base (LiFi)</option>
          <option value="monad">Monad (CCTP)</option>
        </select>
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
        Bridge USDC from Base, then auto-swap to GOLD on Solana (no extra confirmation for swap).
      </p>
      <button
        onClick={handleBuy}
        disabled={loading}
        className="w-full py-3 bg-white text-black font-semibold rounded-lg hover:bg-gray-200 disabled:opacity-50"
      >
        {loading ? 'Processing…' : 'Bridge & swap to GOLD'}
      </button>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {execution && <ExecutionStatus execution={execution} />}
    </div>
  )
}
