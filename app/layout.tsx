'use client'

import { PrivyProvider } from '@privy-io/react-auth'
import { toSolanaWalletConnectors } from '@privy-io/react-auth/solana'
import { createSolanaRpc, createSolanaRpcSubscriptions } from '@solana/kit'
import { monadTestnet } from 'viem/chains'
import { PrivyEthereumProviderInjector } from '@/lib/components/PrivyEthereumProviderInjector'
import { AuthSyncOnLogin } from '@/lib/components/AuthSyncOnLogin'
import { CreateSolanaWalletWhenEvmConnected } from '@/lib/components/CreateSolanaWalletWhenEvmConnected'
import './globals.css'

const solanaConnectors = toSolanaWalletConnectors({
  shouldAutoConnect: false,
})

const solanaRpcUrl =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com'
const solanaWsUrl =
  process.env.NEXT_PUBLIC_SOLANA_WS_URL ??
  solanaRpcUrl.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:')

const solanaRpcs = {
  'solana:mainnet': {
    rpc: createSolanaRpc(solanaRpcUrl),
    rpcSubscriptions: createSolanaRpcSubscriptions(solanaWsUrl),
    blockExplorerUrl: 'https://explorer.solana.com',
  },
}

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
            solana: { rpcs: solanaRpcs },
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
