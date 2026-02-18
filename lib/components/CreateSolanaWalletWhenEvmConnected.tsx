'use client'

import { useEffect, useRef } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { useCreateWallet } from '@privy-io/react-auth/solana'

export function CreateSolanaWalletWhenEvmConnected() {
  const { ready, authenticated, user } = usePrivy()
  const { createWallet } = useCreateWallet()
  const created = useRef(false)

  useEffect(() => {
    if (!ready || !authenticated || !user?.linkedAccounts?.length || created.current) return

    const accounts = user.linkedAccounts as Array<{
      type?: string
      chainType?: string
      address?: string
      walletClientType?: string
    }>
    const hasExternalEvm = accounts.some(
      (a) =>
        a.type === 'wallet' &&
        a.address &&
        a.chainType === 'ethereum' &&
        a.walletClientType !== 'privy' &&
        a.walletClientType !== 'privy-v2'
    )
    const hasAnySolana = accounts.some(
      (a) => a.type === 'wallet' && a.address && a.chainType === 'solana'
    )

    if (hasExternalEvm && !hasAnySolana) {
      created.current = true
      createWallet().catch(() => {
        created.current = false
      })
    }
  }, [ready, authenticated, user?.linkedAccounts, createWallet])

  return null
}
