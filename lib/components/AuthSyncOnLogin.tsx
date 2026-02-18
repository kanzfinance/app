'use client'

import { useEffect, useCallback } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { authSync } from '@/lib/api/client'

/**
 * Upserts the current user and wallets in the API when the user logs in or when
 * the page is refreshed and Privy restores the session. Mounted in the root layout.
 */
export function AuthSyncOnLogin() {
  const { ready, getAccessToken, user } = usePrivy()

  const sync = useCallback(async () => {
    const token = await getAccessToken()
    if (!token || !user?.linkedAccounts?.length) return
    const linkedAccounts = user.linkedAccounts as {
      type?: string
      chainType?: string
      address?: string
      walletClientType?: string
    }[]
    try {
      await authSync(token, linkedAccounts)
    } catch {
      // Ignore sync errors (e.g. network); user can retry by navigating or reconnecting
    }
  }, [getAccessToken, user?.linkedAccounts])

  useEffect(() => {
    if (ready && user?.id) sync()
  }, [ready, user?.id, sync])

  return null
}
