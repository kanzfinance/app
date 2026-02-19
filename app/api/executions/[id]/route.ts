import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api/auth'
import { getExecution } from '@/lib/api/store'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireAuth(_req)
    const { id } = await params
    const execution = getExecution(id)
    if (!execution || execution.user_id !== userId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({
      id: execution.id,
      status: execution.status,
      evm_tx_hash: execution.evm_tx_hash ?? null,
      bridge_message_id: execution.bridge_message_id ?? null,
      swap_tx_hash: execution.swap_tx_hash ?? null,
      error_code: execution.error_code ?? null,
      error_message: execution.error_message ?? null,
      amount_usdc: execution.amount_usdc,
      source_chain: execution.source_chain,
      created_at: execution.created_at,
      updated_at: execution.updated_at,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'get execution failed'
    return NextResponse.json({ error: message }, { status: 401 })
  }
}
