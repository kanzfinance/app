import { NextResponse } from 'next/server'

const ALCHEMY_DATA_BASE = 'https://api.g.alchemy.com/data/v1'
const CHAIN_TO_NETWORK: Record<string, string> = {
  base: 'base-mainnet',
  monad: 'monad-mainnet',
}

export async function GET(req: Request) {
  const apiKey = process.env.ALCHEMY_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Alchemy API key not configured' }, { status: 503 })
  }

  const url = new URL(req.url)
  const address = url.searchParams.get('address')?.trim()
  const chain = url.searchParams.get('chain')?.toLowerCase()
  const network = chain ? CHAIN_TO_NETWORK[chain] : null
  if (!address || !network) {
    return NextResponse.json(
      { error: 'Missing or invalid address or chain (use base | monad)' },
      { status: 400 }
    )
  }

  const res = await fetch(`${ALCHEMY_DATA_BASE}/${encodeURIComponent(apiKey)}/assets/tokens/by-address`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      addresses: [{ address, networks: [network] }],
      withMetadata: true,
      withPrices: true,
      includeNativeTokens: true,
      includeErc20Tokens: true,
    }),
    next: { revalidate: 60 },
  })

  if (!res.ok) {
    const text = await res.text()
    return NextResponse.json(
      { error: 'Alchemy tokens-by-address fetch failed', status: res.status, detail: text },
      { status: 502 }
    )
  }

  const json = await res.json()
  
  if (json.error) {
    return NextResponse.json(
      { error: json.error?.message ?? json.error },
      { status: 502 }
    )
  }
  return NextResponse.json(json.data ?? json)
}
