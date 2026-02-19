import { NextResponse } from 'next/server'
import { getPrivyClient } from '@/lib/api/auth'
import { getExecution } from '@/lib/api/store'
import type { WalletApiRequestSignatureInput } from '@privy-io/node'

const JUPITER_QUOTE_URL = 'https://api.jup.ag/swap/v1/quote'
const JUPITER_SWAP_URL = 'https://api.jup.ag/swap/v1/swap'
const SOLANA_MAINNET_CAIP2 = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp'
const SOLANA_USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
const GOLD_MINT = 'GoLDppdjB1vDTPSGxyMJFqdnj134yH6Prg9eqsGDiw6A'
const PRIVY_API_BASE = process.env.PRIVY_API_BASE_URL ?? 'https://api.privy.io'

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
 * GET returns the request payload the client must sign to authorize the swap.
 * Client uses useAuthorizationSignature().generateAuthorizationSignature(payload),
 * then POSTs the signature to swap-sign-and-send-with-signature.
 * This avoids the server-side JWT exchange (wallets/authenticate) which can fail.
 */
export async function GET(
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

    const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID
    if (!appId) {
      return NextResponse.json({ error: 'Privy app ID not configured' }, { status: 500 })
    }

    const baseUrl = PRIVY_API_BASE.replace(/\/$/, '')
    const url = `${baseUrl}/v1/wallets/${solanaWallet.id}/rpc`
    const body = {
      method: 'signAndSendTransaction',
      chain_type: 'solana',
      params: { transaction: serializedTx, encoding: 'base64' },
      caip2: SOLANA_MAINNET_CAIP2,
    }

    const payload: WalletApiRequestSignatureInput = {
      version: 1,
      method: 'POST',
      url,
      body,
      headers: { 'privy-app-id': appId },
    }

    return NextResponse.json({ payload })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'swap-signature-payload failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
