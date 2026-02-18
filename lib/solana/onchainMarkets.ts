import { Connection, PublicKey } from '@solana/web3.js'
import bs58 from 'bs58'
import { PROGRAM_ID, getMarketPda, getProtocolPda } from '@/lib/solana/client'
import { MARKET_DISCRIMINATOR, getMarketDecoder } from '@/lib/solana/generated/accounts/market'
import { getProtocolDecoder } from '@/lib/solana/generated/accounts/protocol'
import { MarketStatus } from '@/lib/solana/generated/types/marketStatus'

export type OnchainMarketStatus = 'Draft' | 'Open' | 'Closed' | 'Settled'

export type OnchainMarket = {
  pda: string
  marketId: string
  itemsHash: string
  itemCount: number
  startTs: string
  endTs: string
  status: OnchainMarketStatus
  totalRawStake: string
  totalEffectiveStake: string
  winningItemIndex: number | null
  tokenMint: string
  vault: string
}

export type OnchainProtocol = {
  adminAuthority: string
  treasury: string
  protocolFeeBps: number
  marketCount: string
  paused: boolean
}

function u8aToHex(u8a: Uint8Array): string {
  return `0x${Buffer.from(u8a).toString('hex')}`
}

function statusToString(status: MarketStatus): OnchainMarketStatus {
  return MarketStatus[status] as OnchainMarketStatus
}

function winningIndexOrNull(status: OnchainMarketStatus, raw: number): number | null {
  // On-chain uses u8. If not settled, treat as unset.
  if (status !== 'Settled') return null
  // Common sentinel values are 255; keep it null if so.
  if (raw === 255) return null
  return raw
}

export async function fetchOnchainProtocol(connection: Connection): Promise<OnchainProtocol | null> {
  const [protocolPda] = await getProtocolPda()
  const acc = await connection.getAccountInfo(protocolPda)
  if (!acc?.data) return null
  const decoded = getProtocolDecoder().decode(new Uint8Array(acc.data))
  return {
    adminAuthority: decoded.adminAuthority as unknown as string,
    treasury: decoded.treasury as unknown as string,
    protocolFeeBps: decoded.protocolFeeBps,
    marketCount: decoded.marketCount.toString(),
    paused: decoded.paused,
  }
}

/**
 * Fetches all Market accounts directly from chain using the Market discriminator.
 * This will show markets that exist on devnet even if your DB is empty.
 */
export async function fetchAllOnchainMarkets(connection: Connection): Promise<OnchainMarket[]> {
  const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
    filters: [
      {
        memcmp: {
          offset: 0,
          bytes: bs58.encode(MARKET_DISCRIMINATOR),
        },
      },
    ],
  })

  const decoder = getMarketDecoder()

  const markets = accounts.map((a) => {
    const decoded = decoder.decode(new Uint8Array(a.account.data))
    const status = statusToString(decoded.status)
    return {
      pda: a.pubkey.toBase58(),
      marketId: decoded.marketId.toString(),
      itemsHash: u8aToHex(decoded.itemsHash as Uint8Array),
      itemCount: decoded.itemCount,
      startTs: decoded.startTs.toString(),
      endTs: decoded.endTs.toString(),
      status,
      totalRawStake: decoded.totalRawStake.toString(),
      totalEffectiveStake: decoded.totalEffectiveStake.toString(),
      winningItemIndex: winningIndexOrNull(status, decoded.winningItemIndex),
      tokenMint: decoded.tokenMint as unknown as string,
      vault: decoded.vault as unknown as string,
    } satisfies OnchainMarket
  })

  // Sort by marketId desc for UX parity with DB ordering.
  markets.sort((a, b) => BigInt(b.marketId) > BigInt(a.marketId) ? 1 : -1)
  return markets
}

export async function fetchOnchainMarketById(
  connection: Connection,
  marketId: bigint | number | string,
): Promise<OnchainMarket | null> {
  const id = BigInt(marketId)
  const [marketPda] = await getMarketPda(id)
  const acc = await connection.getAccountInfo(marketPda)
  if (!acc?.data) return null

  const decoded = getMarketDecoder().decode(new Uint8Array(acc.data))
  const status = statusToString(decoded.status)

  return {
    pda: marketPda.toBase58(),
    marketId: decoded.marketId.toString(),
    itemsHash: u8aToHex(decoded.itemsHash as Uint8Array),
    itemCount: decoded.itemCount,
    startTs: decoded.startTs.toString(),
    endTs: decoded.endTs.toString(),
    status,
    totalRawStake: decoded.totalRawStake.toString(),
    totalEffectiveStake: decoded.totalEffectiveStake.toString(),
    winningItemIndex: winningIndexOrNull(status, decoded.winningItemIndex),
    tokenMint: decoded.tokenMint as unknown as string,
    vault: decoded.vault as unknown as string,
  }
}

