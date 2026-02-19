import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api/auth'
import { getExecution } from '@/lib/api/store'

const JUPITER_QUOTE_URL = 'https://api.jup.ag/swap/v1/quote'
const JUPITER_SWAP_URL = 'https://api.jup.ag/swap/v1/swap'

const SOLANA_USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
const GOLD_MINT = 'GoLDppdjB1vDTPSGxyMJFqdnj134yH6Prg9eqsGDiw6A'

export async function GET(
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

    if (execution.status !== 'BRIDGED' && execution.status !== 'BRIDGING') {
      return NextResponse.json(
        { error: 'Execution must be bridged before swap payload' },
        { status: 400 }
      )
    }

    const apiKey = process.env.JUPITER_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Jupiter API key not configured' },
        { status: 503 }
      )
    }

    // USDC amount in smallest units (6 decimals)
    const amountRaw = Math.floor(
      Number(execution.amount_usdc) * 1_000_000
    ).toString()

    const quoteParams = new URLSearchParams({
      inputMint: SOLANA_USDC,
      outputMint: GOLD_MINT,
      amount: amountRaw,
      slippageBps: '50',
      restrictIntermediateTokens: 'true',
      asLegacyTransaction: 'true',
    })

    const quoteRes = await fetch(`${JUPITER_QUOTE_URL}?${quoteParams}`, {
      headers: { 'x-api-key': apiKey },
    })
    if (!quoteRes.ok) {
      const text = await quoteRes.text()
      return NextResponse.json(
        { error: 'Jupiter quote failed', detail: text.slice(0, 500) },
        { status: 502 }
      )
    }

    const quoteResponse = await quoteRes.json()

    const swapRes = await fetch(JUPITER_SWAP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        quoteResponse,
        userPublicKey: execution.solana_address,
        dynamicComputeUnitLimit: true,
        dynamicSlippage: true,
        asLegacyTransaction: true,
      }),
    })

    if (!swapRes.ok) {
      const text = await swapRes.text()
      return NextResponse.json(
        { error: 'Jupiter swap build failed', detail: text.slice(0, 500) },
        { status: 502 }
      )
    }

    const swapData = (await swapRes.json()) as { swapTransaction?: string }
    const serialized_tx = swapData.swapTransaction
    if (!serialized_tx) {
      return NextResponse.json(
        { error: 'Jupiter did not return swap transaction' },
        { status: 502 }
      )
    }

    return NextResponse.json({ serialized_tx })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'swap-payload failed'
    return NextResponse.json({ error: message }, { status: 401 })
  }
}
