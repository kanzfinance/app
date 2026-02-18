import { NextResponse } from 'next/server'

const JUPITER_TOKENS_SEARCH_URL = 'https://api.jup.ag/tokens/v2/search'

export async function GET(req: Request) {
  const apiKey = process.env.JUPITER_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Jupiter API key not configured' }, { status: 503 })
  }

  const url = new URL(req.url)
  const ids = url.searchParams.get('ids')?.trim()
  if (!ids) {
    return NextResponse.json({ error: 'Missing ids' }, { status: 400 })
  }

  const upstream = `${JUPITER_TOKENS_SEARCH_URL}?query=${encodeURIComponent(ids)}`
  const res = await fetch(upstream, {
    headers: { 'x-api-key': apiKey },
    next: { revalidate: 300 },
  })

  if (!res.ok) {
    const text = await res.text()
    return NextResponse.json(
      { error: 'Jupiter tokens fetch failed', status: res.status, detail: text },
      { status: 502 }
    )
  }

  const data = await res.json()
  return NextResponse.json(data)
}

