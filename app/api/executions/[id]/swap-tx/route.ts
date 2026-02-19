import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api/auth'
import { getExecution, updateExecution } from '@/lib/api/store'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireAuth(req)
    const { id } = await params
    const execution = getExecution(id)
    if (!execution || execution.user_id !== userId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const body = await req.json()
    const swap_tx_hash = body?.swap_tx_hash
    if (typeof swap_tx_hash !== 'string' || !swap_tx_hash) {
      return NextResponse.json(
        { error: 'Missing or invalid swap_tx_hash' },
        { status: 400 }
      )
    }

    updateExecution(id, { status: 'COMPLETED', swap_tx_hash })
    const updated = getExecution(id)!
    return NextResponse.json({ swap_tx_hash: updated.swap_tx_hash! })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'swap-tx update failed'
    return NextResponse.json({ error: message }, { status: 401 })
  }
}
