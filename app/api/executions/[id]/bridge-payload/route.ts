import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api/auth'
import { getExecution } from '@/lib/api/store'

const LIFI_QUOTE_URL = 'https://li.quest/v1/quote'
const LIFI_STEP_TX_URL = 'https://li.quest/v1/advanced/stepTransaction'

// Base USDC (Circle native)
const BASE_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
// Solana USDC
const SOLANA_USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'

// ERC20 approve(spender, amount) selector
const APPROVE_SELECTOR = '0x095ea7b3'

function encodeApprove(spender: string, amountRaw: string): string {
  const s = spender.replace(/^0x/, '').toLowerCase().padStart(64, '0')
  const a = BigInt(amountRaw).toString(16).padStart(64, '0')
  return APPROVE_SELECTOR + s + a
}

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

    const bridgeProvider = new URL(req.url).searchParams.get('bridge_provider')
    if (bridgeProvider && bridgeProvider !== 'lifi') {
      return NextResponse.json(
        { error: 'Only bridge_provider=lifi is supported' },
        { status: 400 }
      )
    }

    if (execution.source_chain !== 'base') {
      return NextResponse.json(
        { error: 'Bridge payload only supported for source_chain=base (LiFi)' },
        { status: 400 }
      )
    }

    // fromAmount in smallest units (USDC 6 decimals)
    const fromAmountRaw = Math.floor(
      Number(execution.amount_usdc) * 1_000_000
    ).toString()

    const quoteParams = new URLSearchParams({
      fromChain: '8453', // Base
      toChain: '1151111081099710', // Solana mainnet in LiFi
      fromToken: BASE_USDC,
      toToken: SOLANA_USDC,
      fromAddress: execution.evm_address,
      toAddress: execution.solana_address,
      fromAmount: fromAmountRaw,
      slippage: '0.005',
      integrator: 'kanz.finance',
    })

    const quoteRes = await fetch(`${LIFI_QUOTE_URL}?${quoteParams}`)
    if (!quoteRes.ok) {
      const text = await quoteRes.text()
      return NextResponse.json(
        { error: 'LiFi quote failed', detail: text.slice(0, 500) },
        { status: 502 }
      )
    }

    let step = (await quoteRes.json()) as {
      transactionRequest?: {
        to?: string
        data?: string
        value?: string | number | bigint
        gasLimit?: string | number
        chainId?: number
      }
      action?: { fromToken?: { address?: string }; fromAmount?: string }
      estimate?: { approvalAddress?: string }
    }

    if (!step.transactionRequest?.data) {
      const stepTxRes = await fetch(LIFI_STEP_TX_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(step),
      })
      if (!stepTxRes.ok) {
        const text = await stepTxRes.text()
        return NextResponse.json(
          { error: 'LiFi stepTransaction failed', detail: text.slice(0, 500) },
          { status: 502 }
        )
      }
      step = (await stepTxRes.json()) as typeof step
    }

    const tx = step.transactionRequest
    if (!tx?.to || !tx?.data) {
      return NextResponse.json(
        { error: 'LiFi did not return transaction data' },
        { status: 502 }
      )
    }

    const to = typeof tx.to === 'string' ? tx.to : String(tx.to)
    const data = typeof tx.data === 'string' ? tx.data : String(tx.data)
    let valueStr = '0x0'
    if (tx.value != null && tx.value !== '') {
      if (typeof tx.value === 'string') {
        valueStr = tx.value.startsWith('0x') ? tx.value : `0x${BigInt(tx.value).toString(16)}`
      } else if (typeof tx.value === 'bigint') {
        valueStr = '0x' + tx.value.toString(16)
      } else {
        valueStr = '0x' + BigInt(String(tx.value)).toString(16)
      }
    }

    const payload: {
      to: string
      data: string
      value: string
      gasLimit?: string
      approval_to?: string
      approval_data?: string
      approval_value?: string
    } = {
      to,
      data,
      value: valueStr,
    }
    if (tx.gasLimit != null && tx.gasLimit !== '') {
      payload.gasLimit =
        typeof tx.gasLimit === 'string' ? tx.gasLimit : String(tx.gasLimit)
    }

    // Approval must be a separate tx from the user so the token records allowance(owner=user, spender).
    // (Batching via Multicall3 would set owner=Multicall3 and cause transferFrom to fail.)
    const approvalAddress = step.estimate?.approvalAddress
    const fromTokenAddress = step.action?.fromToken?.address
    const fromAmount = step.action?.fromAmount ?? fromAmountRaw
    const zero = '0x0000000000000000000000000000000000000000'
    if (
      approvalAddress &&
      fromTokenAddress &&
      fromTokenAddress.toLowerCase() !== zero.toLowerCase()
    ) {
      payload.approval_to = fromTokenAddress
      payload.approval_data = encodeApprove(approvalAddress, fromAmount)
      payload.approval_value = '0x0'
    }

    return NextResponse.json(payload)
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'bridge-payload failed'
    return NextResponse.json({ error: message }, { status: 401 })
  }
}
