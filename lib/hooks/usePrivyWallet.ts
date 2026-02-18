'use client'

import { useMemo } from 'react'
import { usePrivy } from '@privy-io/react-auth'

type LinkedAccount = {
  type?: string
  chainType?: string
  address?: string
  walletClientType?: string
}

export function usePrivyWallet() {
  const { ready, authenticated, login, logout, user } = usePrivy()

  const { evmAddress, solanaAddress } = useMemo(() => {
    let evm: string | null = null
    let solana: string | null = null
    let solanaEmbedded: string | null = null
    const accounts = (user?.linkedAccounts ?? []) as LinkedAccount[]

    for (const acc of accounts) {
      if (acc.type !== 'wallet' || !acc.address) continue
      const isEmbedded = acc.walletClientType === 'privy' || acc.walletClientType === 'privy-v2'

      if (acc.chainType === 'ethereum') {
        if (!isEmbedded) evm = acc.address
      }
      if (acc.chainType === 'solana') {
        if (isEmbedded) solanaEmbedded = acc.address
        else solana = acc.address
      }
    }
    if (solana === null && solanaEmbedded !== null) solana = solanaEmbedded

    return { evmAddress: evm, solanaAddress: solana }
  }, [user?.linkedAccounts])

  return {
    login,
    logout,
    ready,
    authenticated: !!authenticated,
    evmAddress,
    solanaAddress,
    user,
  }
}
