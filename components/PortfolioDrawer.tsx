'use client'

import { useState, useEffect } from 'react'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import Image from 'next/image'
import {
  fetchSolanaPortfolio,
  fetchEvmPortfolio,
  type TokenHolding,
} from '@/lib/portfolio'

type ChainId = 'solana' | 'base' | 'monad'

interface PortfolioDrawerProps {
  solanaAddress: string | null
  evmAddress: string | null
}

function TokenRow({ t }: { t: TokenHolding }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-white/10 last:border-0">
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-8 w-8 rounded-full bg-white/10 overflow-hidden shrink-0">
          {t.icon ? (
            <Image
              src={t.icon}
              alt=""
              width={32}
              height={32}
              className="h-8 w-8 object-cover"
            />
          ) : null}
        </div>
        <div className="min-w-0">
          <p className="font-medium leading-5 truncate">{t.symbol}</p>
          {t.name ? (
            <p className="text-xs text-muted-foreground truncate">{t.name}</p>
          ) : (
            <p className="text-xs text-muted-foreground truncate">
              {t.mintOrAddress === 'native'
                ? 'Native'
                : `${t.mintOrAddress.slice(0, 6)}…${t.mintOrAddress.slice(-4)}`}
            </p>
          )}
        </div>
      </div>
      <div className="text-right">
        <p className="text-muted-foreground tabular-nums">
          {Number(t.balance).toLocaleString(undefined, { maximumFractionDigits: 6 })}
        </p>
        {typeof t.usdPrice === 'number' ? (
          <p className="text-xs text-muted-foreground tabular-nums">
            ${(Number(t.balance) * t.usdPrice).toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </p>
        ) : null}
      </div>
    </div>
  )
}

function ChainPanel({
  chain,
  address,
  chainLabel,
  open,
  cachedHoldings,
  onCache,
}: {
  chain: ChainId
  address: string | null
  chainLabel: string
  open: boolean
  cachedHoldings: TokenHolding[] | null
  onCache: (tokens: TokenHolding[]) => void
}) {
  const [holdings, setHoldings] = useState<TokenHolding[]>(cachedHoldings ?? [])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (cachedHoldings) {
      setHoldings(cachedHoldings)
    }
  }, [cachedHoldings])

  useEffect(() => {
    if (!open) return

    if (!address) {
      setHoldings([])
      setError('No wallet connected for this chain')
      setLoading(false)
      return
    }

    const hasCache = cachedHoldings && cachedHoldings.length > 0
    setLoading(!hasCache)
    setError(null)

    const fetcher =
      chain === 'solana'
        ? fetchSolanaPortfolio(address)
        : fetchEvmPortfolio(address, chain)

    fetcher
      .then((tokens) => {
        setHoldings(tokens)
        onCache(tokens)
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : 'Failed to load')
      )
      .finally(() => setLoading(false))
  }, [open, chain, address])

  if (!address) {
    return (
      <div className="py-6 text-center text-muted-foreground text-sm">
        Connect a wallet that supports {chainLabel} to see holdings.
      </div>
    )
  }

  if (error) {
    return (
      <div className="py-6 text-center text-destructive text-sm">{error}</div>
    )
  }

  if (loading && holdings.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground text-sm">
        Loading {chainLabel} portfolio…
      </div>
    )
  }

  if (!loading && holdings.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground text-sm">
        No tokens found on {chainLabel}.
      </div>
    )
  }

  return (
    <Card className="bg-white/5 border-white/10">
      <CardContent className="p-4">
        <div className="space-y-0">
          {holdings.map((t) => (
            <TokenRow key={t.mintOrAddress} t={t} />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function PortfolioDrawer({ solanaAddress, evmAddress }: PortfolioDrawerProps) {
  const [open, setOpen] = useState(false)
  const [solanaCache, setSolanaCache] = useState<TokenHolding[] | null>(null)
  const [baseCache, setBaseCache] = useState<TokenHolding[] | null>(null)
  const [monadCache, setMonadCache] = useState<TokenHolding[] | null>(null)

  return (
    <Drawer open={open} onOpenChange={setOpen} direction="right">
      <DrawerTrigger asChild>
        <Button variant="outline">Portfolio</Button>
      </DrawerTrigger>
      <DrawerContent side="right" showHandle={false}>
        <DrawerHeader>
          <DrawerTitle>Portfolio by chain</DrawerTitle>
        </DrawerHeader>
        <div className="px-4 pb-6 overflow-auto">
          <Tabs defaultValue="solana" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="solana">Solana</TabsTrigger>
              <TabsTrigger value="base">Base</TabsTrigger>
              <TabsTrigger value="monad">Monad</TabsTrigger>
            </TabsList>
            <TabsContent value="solana" className="mt-4">
              <ChainPanel
                chain="solana"
                address={solanaAddress}
                chainLabel="Solana"
                open={open}
                cachedHoldings={solanaCache}
                onCache={setSolanaCache}
              />
            </TabsContent>
            <TabsContent value="base" className="mt-4">
              <ChainPanel
                chain="base"
                address={evmAddress}
                chainLabel="Base"
                open={open}
                cachedHoldings={baseCache}
                onCache={setBaseCache}
              />
            </TabsContent>
            <TabsContent value="monad" className="mt-4">
              <ChainPanel
                chain="monad"
                address={evmAddress}
                chainLabel="Monad"
                open={open}
                cachedHoldings={monadCache}
                onCache={setMonadCache}
              />
            </TabsContent>
          </Tabs>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
