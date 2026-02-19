import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api/auth'
import { upsertUser } from '@/lib/api/store'

export async function POST(req: Request) {
  try {
    const userId = await requireAuth(req)
    const body = await req.json()
    const linkedAccounts = Array.isArray(body?.linkedAccounts) ? body.linkedAccounts : []
    const user = upsertUser(
      userId,
      linkedAccounts.map((a: { chainType?: string; address?: string; walletClientType?: string }) => ({
        chainType: a.chainType ?? '',
        address: a.address ?? '',
        isEmbedded:
          a.walletClientType === 'privy' || a.walletClientType === 'privy-v2',
      }))
    )
    return NextResponse.json({
      user_id: user.user_id,
      wallets: user.wallets,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'auth/sync failed'
    return NextResponse.json({ error: message }, { status: 401 })
  }
}
