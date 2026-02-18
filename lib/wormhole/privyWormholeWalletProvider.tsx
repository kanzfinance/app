'use client'

import { useMemo, useRef, useCallback } from 'react'
import { useWallets } from '@privy-io/react-auth'

const EVM_CHAINS = ['Base', 'Monad'] as const

interface PrivyWalletAdapter {
  getAddress(): string
  getName(): string
  getIcon(): string | undefined
  getUrl(): string | undefined
  connect(options?: { chainId?: number | string }): Promise<string[]>
  disconnect(): void
  on(_event: string, _handler: () => void): void
  off(_event: string, _handler: () => void): void
  _privyProvider?: unknown
}

function createPrivyEvmWallet(address: string, provider: unknown): PrivyWalletAdapter {
  return {
    getAddress: () => address,
    getName: () => 'Privy',
    getIcon: () => undefined,
    getUrl: () => undefined,
    connect: async () => [address],
    disconnect: () => {},
    on: () => {},
    off: () => {},
    _privyProvider: provider,
  }
}

export function usePrivyWormholeWalletProvider() {
  const { wallets, ready } = useWallets()
  const evmWalletRef = useRef<{ address: string; getEthereumProvider: () => Promise<unknown> } | null>(null)
  const handlersRef = useRef<Set<(w: PrivyWalletAdapter, c: string, t: string) => void>>(new Set())

  const evmWallet = useMemo(() => {
    if (!ready || !wallets.length) return null
    const w = wallets.find(
      (x): x is typeof x & { getEthereumProvider: () => Promise<unknown> } =>
        typeof (x as { getEthereumProvider?: () => Promise<unknown> }).getEthereumProvider === 'function'
    )
    if (!w?.address) return null
    return { address: w.address, getEthereumProvider: w.getEthereumProvider.bind(w) }
  }, [wallets, ready])

  evmWalletRef.current = evmWallet

  const getWallet = useCallback((chain: string, _type: string): PrivyWalletAdapter | null => {
    if (!EVM_CHAINS.includes(chain as (typeof EVM_CHAINS)[number]) || !evmWalletRef.current) return null
    return createPrivyEvmWallet(evmWalletRef.current.address, null)
  }, [])

  const connectWallet = useCallback(
    async (chain: string, type: string, autoConnect?: boolean): Promise<PrivyWalletAdapter | null> => {
      if (!EVM_CHAINS.includes(chain as (typeof EVM_CHAINS)[number])) return null
      const evm = evmWalletRef.current
      if (!evm) return null
      try {
        const provider = await evm.getEthereumProvider()
        const wallet = createPrivyEvmWallet(evm.address, provider)
        handlersRef.current.forEach((h) => h(wallet, chain, type))
        return wallet
      } catch {
        return getWallet(chain, type)
      }
    },
    [getWallet]
  )

  const signAndSendTransaction = useCallback(
    async (chain: string, wallet: PrivyWalletAdapter | null, transaction: unknown): Promise<string> => {
      const adapter = wallet ?? (evmWalletRef.current ? createPrivyEvmWallet(evmWalletRef.current.address, null) : null)
      let provider = adapter?._privyProvider as { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } | undefined
      if (!provider?.request && evmWalletRef.current) {
        provider = (await evmWalletRef.current.getEthereumProvider()) as { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> }
      }
      if (!provider?.request) throw new Error('Privy EVM provider not available')
      const tx = (transaction as { transaction?: Record<string, unknown> })?.transaction ?? (transaction as Record<string, unknown>)
      const hash = await provider.request({ method: 'eth_sendTransaction', params: [tx] })
      return hash as string
    },
    []
  )

  return useMemo(() => {
    if (!ready) return null
    return {
      connectWallet,
      getWallet,
      signAndSendTransaction,
      swapWallets: () => {},
      on: (_event: string, handler: (w: PrivyWalletAdapter, c: string, t: string) => void) => {
        handlersRef.current.add(handler)
      },
      off: () => {},
    }
  }, [ready, connectWallet, getWallet, signAndSendTransaction])
}
