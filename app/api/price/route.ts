import { NextResponse } from 'next/server'

const JUPITER_PRICE_URL = 'https://api.jup.ag/price/v3'
const GOLD_MINT = 'GoLDppdjB1vDTPSGxyMJFqdnj134yH6Prg9eqsGDiw6A'

export async function GET() {
  const apiKey = process.env.JUPITER_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Jupiter API key not configured' }, { status: 503 })
  }
  try {
    const res = await fetch(`${JUPITER_PRICE_URL}?ids=${GOLD_MINT}`, {
      headers: { 'x-api-key': apiKey },
      next: { revalidate: 60 },
    })
    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json(
        { error: 'Jupiter price fetch failed', status: res.status, detail: text },
        { status: 502 }
      )
    }
    const data = await res.json()
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json(
      { error: 'Price fetch error', detail: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    )
  }
}
