import { NextResponse } from 'next/server'
import { getPrivyClient } from '@/lib/api/auth'
import { getExecution, updateExecution } from '@/lib/api/store'

const JUPITER_QUOTE_URL = 'https://api.jup.ag/swap/v1/quote'
const JUPITER_SWAP_URL = 'https://api.jup.ag/swap/v1/swap'
const SOLANA_MAINNET_CAIP2 = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp'
const SOLANA_USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
const GOLD_MINT = 'GoLDppdjB1vDTPSGxyMJFqdnj134yH6Prg9eqsGDiw6A'

async function getSwapSerializedTx(
  execution: { amount_usdc: string; solana_address: string }
): Promise<string> {
  const apiKey = process.env.JUPITER_API_KEY
  if (!apiKey) throw new Error('Jupiter API key not configured')
  const amountRaw = Math.floor(Number(execution.amount_usdc) * 1_000_000).toString()
  const quoteRes = await fetch(
    `${JUPITER_QUOTE_URL}?${new URLSearchParams({
      inputMint: SOLANA_USDC,
      outputMint: GOLD_MINT,
      amount: amountRaw,
      slippageBps: '50',
      restrictIntermediateTokens: 'true',
      asLegacyTransaction: 'true',
    })}`,
    { headers: { 'x-api-key': apiKey } }
  )
  if (!quoteRes.ok) throw new Error('Jupiter quote failed')
  const quoteResponse = await quoteRes.json()
  const swapRes = await fetch(JUPITER_SWAP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
    body: JSON.stringify({
      quoteResponse,
      userPublicKey: execution.solana_address,
      dynamicComputeUnitLimit: true,
      dynamicSlippage: true,
      asLegacyTransaction: true,
    }),
  })
  if (!swapRes.ok) throw new Error('Jupiter swap build failed')
  const swapData = (await swapRes.json()) as { swapTransaction?: string }
  const serialized = swapData.swapTransaction
  if (!serialized) throw new Error('Jupiter did not return swap transaction')
  return serialized
}

/**
 * POST executes the swap by sending the transaction to Privy with the
 * client-provided authorization signature (no JWT exchange on server).
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null
    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    const client = getPrivyClient()
    const claims = await client.utils().auth().verifyAccessToken(token)
    const userId = claims.user_id ?? null
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const signature = typeof body?.signature === 'string' ? body.signature.trim() : null
    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
    }

    const { id } = await params
    const execution = getExecution(id)
    if (!execution || execution.user_id !== userId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (execution.status !== 'BRIDGED' && execution.status !== 'BRIDGING') {
      return NextResponse.json(
        { error: 'Execution must be bridged before swap' },
        { status: 400 }
      )
    }

    const serializedTx = await getSwapSerializedTx(execution)
    const walletList = client.wallets().list({ user_id: userId })
    let solanaWallet: { id: string } | null = null
    for await (const wallet of walletList) {
      if (wallet.chain_type === 'solana' && wallet.address?.toLowerCase() === execution.solana_address?.toLowerCase()) {
        solanaWallet = { id: wallet.id }
        break
      }
    }
    if (!solanaWallet) {
      return NextResponse.json(
        { error: 'Solana wallet not found for user' },
        { status: 400 }
      )
    }

    const result = await client.wallets().solana().signAndSendTransaction(
      solanaWallet.id,
      {
        transaction: serializedTx,
        caip2: SOLANA_MAINNET_CAIP2,
        authorization_context: { signatures: [signature] },
      }
    )

    const swapTxHash = result.hash ?? result.transaction_id ?? ''
    if (!swapTxHash) {
      return NextResponse.json(
        { error: 'Privy did not return transaction hash' },
        { status: 502 }
      )
    }

    updateExecution(id, { status: 'COMPLETED', swap_tx_hash: swapTxHash })
    const updated = getExecution(id)!
    return NextResponse.json({ swap_tx_hash: updated.swap_tx_hash! })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'swap-sign-and-send-with-signature failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
