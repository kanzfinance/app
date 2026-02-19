import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api/auth'
import { getUser, createExecution } from '@/lib/api/store'

export async function POST(req: Request) {
  try {
    const userId = await requireAuth(req)
    const user = getUser(userId)
    if (!user) {
      return NextResponse.json(
        { error: 'Sync wallets first (login and let auth/sync run)' },
        { status: 400 }
      )
    }

    const evmWallet = user.wallets.find((w) => w.chainType === 'ethereum')
    const solanaWallet = user.wallets.find((w) => w.chainType === 'solana')
    if (!evmWallet?.address) {
      return NextResponse.json(
        { error: 'missing_evm_wallet' },
        { status: 400 }
      )
    }
    if (!solanaWallet?.address) {
      return NextResponse.json(
        { error: 'missing_solana_wallet' },
        { status: 400 }
      )
    }

    const body = await req.json()
    const amount_usdc = String(body?.amount_usdc ?? '').trim()
    const source_chain = String(body?.source_chain ?? 'base').toLowerCase()
    if (!amount_usdc || Number.isNaN(Number(amount_usdc)) || Number(amount_usdc) <= 0) {
      return NextResponse.json({ error: 'Invalid amount_usdc' }, { status: 400 })
    }
    if (source_chain !== 'base' && source_chain !== 'monad') {
      return NextResponse.json({ error: 'Invalid source_chain' }, { status: 400 })
    }

    const execution = createExecution({
      user_id: userId,
      amount_usdc,
      source_chain,
      evm_address: evmWallet.address,
      solana_address: solanaWallet.address,
    })

    return NextResponse.json({
      execution_id: execution.id,
      status: execution.status,
      is_duplicate: false,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'create execution failed'
    return NextResponse.json({ error: message }, { status: 401 })
  }
}
