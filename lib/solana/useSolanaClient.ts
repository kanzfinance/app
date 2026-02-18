'use client'

import { useMemo } from 'react'
import { Connection, Transaction, VersionedTransaction } from '@solana/web3.js'
import { useSignAndSendTransaction, useWallets } from '@privy-io/react-auth/solana'
import bs58 from 'bs58'
import { ProtocolClient } from './client-wrapper'

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com'

export function useSolanaClient() {
  const { signAndSendTransaction } = useSignAndSendTransaction()
  const { wallets } = useWallets()

  const solanaWallet = useMemo(
    () => (wallets && wallets.length > 0 ? wallets[0] : null),
    [wallets]
  )

  const connection = useMemo(() => new Connection(RPC_URL, 'confirmed'), [])
  const client = useMemo(() => new ProtocolClient(connection), [connection])

  const getWallet = () => (solanaWallet ? { address: solanaWallet.address } : null)

  const sendTransaction = async (
    transaction: Transaction | VersionedTransaction
  ): Promise<string> => {
    if (!solanaWallet) throw new Error('No Solana wallet connected')
    const raw =
      transaction instanceof VersionedTransaction
        ? transaction.serialize()
        : (transaction as Transaction).serialize({
            requireAllSignatures: false,
            verifySignatures: false,
          })
    const txBytes = new Uint8Array(raw)
    const result = await signAndSendTransaction({
      transaction: txBytes,
      wallet: solanaWallet,
    })
    const sig = result?.signature
    if (!sig) throw new Error('No signature returned')
    const sigBytes = sig instanceof Uint8Array ? sig : new Uint8Array(sig)
    return bs58.encode(sigBytes)
  }

  return {
    client,
    connection,
    getWallet,
    sendTransaction,
    isConnected: !!solanaWallet,
  }
}
