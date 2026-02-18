import { NextRequest, NextResponse } from 'next/server'

const MORALIS_API_BASE = 'https://deep-index.moralis.io/api/v2.2'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const address = searchParams.get('address')
    const chain = searchParams.get('chain')

    if (!address) {
      return NextResponse.json({ error: 'Address is required' }, { status: 400 })
    }

    if (!chain) {
      return NextResponse.json({ error: 'Chain parameter is required' }, { status: 400 })
    }

    const data = await moralisRequest({
      endpoint: `/wallets/${address}/tokens`,
      params: { chain },
    })

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching token balances:', error)
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to fetch token balances'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

async function moralisRequest({
  endpoint,
  params,
}: {
  endpoint: string
  params?: Record<string, string>
}) {
  const apiKey = process.env.MORALIS_API_KEY
  if (!apiKey) {
    throw new Error('MORALIS_API_KEY is not set')
  }

  const url = new URL(`${MORALIS_API_BASE}${endpoint}`)
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, String(value))
    })
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json',
    },
    next: { revalidate: 30 },
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    const errorMessage =
      (errorData as { message?: string }).message ?? `Moralis API error: ${response.status}`
    console.error('Moralis API Error:', {
      status: response.status,
      url: url.toString(),
      error: errorData,
    })
    throw new Error(errorMessage)
  }

  return response.json()
}
