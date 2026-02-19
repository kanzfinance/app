'use client'

import { usePrivyWallet } from '@/lib/hooks/usePrivyWallet'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TokenPrice } from '@/components/TokenPrice'
import { PortfolioDrawer } from '@/components/PortfolioDrawer'
import { BuyFlow } from '@/components/BuyFlow'
import { BridgeSection } from '@/components/BridgeSection'

export default function Home() {
  const { login, logout, ready, authenticated, evmAddress, solanaAddress } =
    usePrivyWallet()

  if (!ready) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-black text-white p-8">
      <div className="max-w-xl mx-auto space-y-8">
        <header className="flex justify-between items-center pb-6 border-b border-white/20">
          <h1 className="text-2xl font-bold">kanz.finance</h1>
          <div className="flex items-center gap-2">
            {authenticated && (
              <PortfolioDrawer
                solanaAddress={solanaAddress}
                evmAddress={evmAddress}
              />
            )}
            {authenticated ? (
              <Button variant="outline" onClick={logout}>
                Disconnect
              </Button>
            ) : (
              <Button onClick={login}>Connect Wallet</Button>
            )}
          </div>
        </header>

        <TokenPrice />

        {!authenticated ? (
          <p className="text-muted-foreground">
            Connect a wallet to see your EVM and Solana addresses and to bridge USDC (bridge-only testing).
          </p>
        ) : (
          <div className="space-y-6">
            <div className="space-y-4">
              {evmAddress && (
                <Card>
                  <CardHeader className="p-4 pb-0">
                    <CardTitle>EVM Wallet</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-1">
                    <p className="font-mono text-lg break-all" title={evmAddress}>
                      {evmAddress}
                    </p>
                  </CardContent>
                </Card>
              )}

              {solanaAddress && (
                <Card>
                  <CardHeader className="p-4 pb-0">
                    <CardTitle>Solana Wallet</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-1">
                    <p className="font-mono text-lg break-all" title={solanaAddress}>
                      {solanaAddress}
                    </p>
                  </CardContent>
                </Card>
              )}

              {!evmAddress && !solanaAddress && (
                <p className="text-muted-foreground">No wallet addresses found.</p>
              )}
            </div>

            <Card>
              <CardHeader className="p-4 pb-0">
                <CardTitle>Bridge USDC (testing)</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-1 space-y-4">
                <p className="text-sm text-amber-400/90 border border-amber-500/30 rounded-lg px-3 py-2">
                  Buy GOLD is disabled to prevent fund loss. Only bridge Base USDC → Solana is available until the bridge is verified.
                </p>
                <BuyFlow />
                <BridgeSection />
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </main>
  )
}
