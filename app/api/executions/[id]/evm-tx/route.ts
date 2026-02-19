import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api/auth'
import { getExecution, updateExecution } from '@/lib/api/store'

export async function PATCH(
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
    const evm_tx_hash = body?.evm_tx_hash
    if (typeof evm_tx_hash !== 'string' || !evm_tx_hash) {
      return NextResponse.json(
        { error: 'Missing or invalid evm_tx_hash' },
        { status: 400 }
      )
    }

    updateExecution(id, { status: 'BRIDGED', evm_tx_hash })
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'evm-tx update failed'
    return NextResponse.json({ error: message }, { status: 401 })
  }
}
