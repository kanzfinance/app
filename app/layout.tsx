'use client'

import { PrivyProvider } from '@privy-io/react-auth'
import { toSolanaWalletConnectors } from '@privy-io/react-auth/solana'
import { monadTestnet } from 'viem/chains'
import { PrivyEthereumProviderInjector } from '@/lib/components/PrivyEthereumProviderInjector'
import { AuthSyncOnLogin } from '@/lib/components/AuthSyncOnLogin'
import { CreateSolanaWalletWhenEvmConnected } from '@/lib/components/CreateSolanaWalletWhenEvmConnected'
import './globals.css'

const solanaConnectors = toSolanaWalletConnectors({
  shouldAutoConnect: false,
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-black text-white">
        <PrivyProvider
          appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
          config={{
            loginMethods: ['wallet'],
            embeddedWallets: {
              solana: { createOnLogin: 'off' },
              ethereum: { createOnLogin: 'off' },
            },
            appearance: {
              theme: 'dark',
              walletChainType: 'ethereum-and-solana',
            },
            externalWallets: {
              solana: { connectors: solanaConnectors },
            },
            defaultChain: monadTestnet,
            supportedChains: [monadTestnet],
          }}
        >
          <PrivyEthereumProviderInjector />
          <CreateSolanaWalletWhenEvmConnected />
          <AuthSyncOnLogin />
          {children}
        </PrivyProvider>
      </body>
    </html>
  )
}
