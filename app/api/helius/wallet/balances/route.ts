import { NextResponse } from 'next/server'

const HELIUS_BASE_URL = 'https://api.helius.xyz/v1/wallet'

export async function GET(req: Request) {
  const apiKey = process.env.HELIUS_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Helius API key not configured' }, { status: 503 })
  }

  const url = new URL(req.url)
  const address = url.searchParams.get('address')?.trim()
  if (!address) {
    return NextResponse.json({ error: 'Missing address' }, { status: 400 })
  }

  const heliusUrl = `${HELIUS_BASE_URL}/${address}/balances?api-key=${encodeURIComponent(
    apiKey
  )}`

  const res = await fetch(heliusUrl, {
    next: { revalidate: 60 },
  })
  
  if (!res.ok) {
    const text = await res.text()
    return NextResponse.json(
      { error: 'Helius balances fetch failed', status: res.status, detail: text },
      { status: 502 }
    )
  }

  const data = await res.json()
  
  return NextResponse.json(data)
}

