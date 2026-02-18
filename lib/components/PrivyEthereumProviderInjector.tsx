'use client'

import { useEffect, useRef } from 'react'
import { useWallets } from '@privy-io/react-auth'

export function PrivyEthereumProviderInjector() {
  const { wallets, ready } = useWallets()
  const injected = useRef(false)

  useEffect(() => {
    if (!ready || typeof window === 'undefined') return

    const evmWallet = wallets.find(
      (w): w is typeof w & { getEthereumProvider: () => Promise<unknown> } =>
        typeof (w as { getEthereumProvider?: () => Promise<unknown> }).getEthereumProvider === 'function'
    )

    if (!evmWallet) {
      if (injected.current) {
        delete (window as Window & { ethereum?: unknown }).ethereum
        injected.current = false
      }
      return
    }

    let cancelled = false
    evmWallet
      .getEthereumProvider()
      .then((provider) => {
        if (cancelled || !provider) return
        ;(window as Window & { ethereum?: unknown }).ethereum = provider
        injected.current = true
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [wallets, ready])

  return null
}
