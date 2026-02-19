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

function log(step: string, data?: Record<string, unknown>) {
  console.error('[swap-sign-and-send]', step, data ?? '')
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const executionId = (await params).id
  try {
    const authHeader = req.headers.get('Authorization')
    const rawToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
    const token = rawToken?.trim() || null
    log('auth', { executionId, hasToken: !!token, tokenLength: token?.length ?? 0 })
    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    const client = getPrivyClient()
    log('verifyAccessToken', { executionId })
    const claims = await client.utils().auth().verifyAccessToken(token)
    const userId = claims.user_id ?? null
    log('verified', { executionId, userId })
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const id = executionId
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

    log('getSwapSerializedTx', { executionId })
    const serializedTx = await getSwapSerializedTx(execution)

    log('wallets.list', { executionId })
    const walletList = client.wallets().list({ user_id: userId })
    let solanaWallet: { id: string; address: string } | null = null
    for await (const wallet of walletList) {
      if (wallet.chain_type === 'solana') {
        if (wallet.address?.toLowerCase() === execution.solana_address?.toLowerCase()) {
          solanaWallet = { id: wallet.id, address: wallet.address }
          break
        }
      }
    }
    if (!solanaWallet) {
      log('solana wallet not found', { executionId, userId })
      return NextResponse.json(
        { error: 'Solana wallet not found for user' },
        { status: 400 }
      )
    }

    log('signAndSendTransaction', { executionId, walletId: solanaWallet.id })
    const result = await client.wallets().solana().signAndSendTransaction(
      solanaWallet.id,
      {
        transaction: serializedTx,
        caip2: SOLANA_MAINNET_CAIP2,
        authorization_context: { user_jwts: [token] },
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
  } catch (err: unknown) {
    const privyStatus = typeof (err as { status?: number })?.status === 'number' ? (err as { status: number }).status : null
    const privyError = (err as { error?: { error?: string; code?: string } })?.error
    const isWalletJwtRejected =
      privyStatus === 400 &&
      typeof privyError === 'object' &&
      privyError?.code === 'invalid_data' &&
      String(privyError?.error ?? '').toLowerCase().includes('jwt')
    log('error', {
      executionId,
      name: err instanceof Error ? err.name : undefined,
      message: err instanceof Error ? err.message : String(err),
      status: privyStatus,
      errorBody: privyError,
      isWalletJwtRejected,
      stack: err instanceof Error ? err.stack : undefined,
    })
    const status = privyStatus ?? 500
    let body: { error: string; code?: string; hint?: string }
    if (isWalletJwtRejected) {
      body = {
        error: 'Privy rejected the token when signing the transaction (wallet JWT exchange failed). Token verification passed; the failure is in the wallet/signing API.',
        code: 'wallet_jwt_exchange_failed',
        hint: 'Confirm in Privy Dashboard that server-side user signing is enabled for this app, and that App ID + App Secret match. If it persists, contact Privy support with: verifyAccessToken succeeds, POST /v1/wallets/authenticate returns 400 Invalid JWT.',
      }
    } else if (privyError && typeof privyError === 'object' && (privyError.error || privyError.code)) {
      body = {
        error: privyError.error ?? (err instanceof Error ? err.message : 'swap-sign-and-send failed'),
        code: privyError.code,
      }
    } else {
      body = { error: err instanceof Error ? err.message : 'swap-sign-and-send failed' }
    }
    return NextResponse.json(body, { status: status >= 400 && status < 600 ? status : 500 })
  }
}
