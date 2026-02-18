'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const GOLD_MINT = 'GoLDppdjB1vDTPSGxyMJFqdnj134yH6Prg9eqsGDiw6A'

interface PriceData {
  price?: string
  usdPrice?: number
  decimals?: number
  priceChange24h?: number | null
}

export function TokenPrice() {
  const [price, setPrice] = useState<PriceData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const fetchPrice = () => {
      fetch('/api/price')
        .then((res) => {
        if (!res.ok) throw new Error(res.statusText)
        return res.json()
        })
        .then((data) => {
        if (cancelled) return
        const raw = data.data?.[GOLD_MINT] ?? data[GOLD_MINT] ?? data
        const usd = raw?.usdPrice ?? (raw?.price != null ? parseFloat(String(raw.price)) : null)
        setPrice({
          price: raw?.price != null ? String(raw.price) : undefined,
          usdPrice: typeof usd === 'number' ? usd : undefined,
          decimals: raw?.decimals,
          priceChange24h: raw?.priceChange24h ?? undefined,
        })
        })
        .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load price')
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }
    fetchPrice()
    const interval = setInterval(fetchPrice, 4000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  if (loading) {
    return (
      <Card>
        <CardHeader className="p-4 pb-0">
          <CardTitle>GOLD Price</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-1">
          <p className="text-muted-foreground">Loading…</p>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader className="p-4 pb-0">
          <CardTitle>GOLD Price</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-1">
          <p className="text-destructive">{error}</p>
        </CardContent>
      </Card>
    )
  }

  const usd = price?.usdPrice ?? (price?.price != null ? parseFloat(price.price) : null)
  const change = price?.priceChange24h

  return (
    <Card>
      <CardHeader className="p-4 pb-0">
        <CardTitle>GOLD Price</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-1">
        {usd != null ? (
          <div className="space-y-1">
            <p className="text-2xl font-semibold">${usd.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 6 })}</p>
            {change != null && (
              <p className={change >= 0 ? 'text-green-500' : 'text-red-500'}>
                24h {change >= 0 ? '+' : ''}{change.toFixed(2)}%
              </p>
            )}
          </div>
        ) : (
          <p className="text-muted-foreground">No price data</p>
        )}
      </CardContent>
    </Card>
  )
}
