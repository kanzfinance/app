/**
 * Wrapper for Codama-generated client
 * This file provides a unified interface whether using Codama or manual client
 */

import { Connection, PublicKey, Transaction } from '@solana/web3.js'
import { getAssociatedTokenAddress } from '@solana/spl-token'

// Try to import Codama-generated client
let CodamaGeneratedClient: any = null
try {
  // @ts-ignore - Generated code
  CodamaGeneratedClient = require('./generated').default
} catch (e) {
  // Codama client not generated yet, will use manual client
}

// Fallback to manual client if Codama not available
import { KleosProtocolClient } from './client'

const PROGRAM_ID = new PublicKey('kLeosk5KrdC8uXDRh66QhvwXqnjfkeadb7mU4ekGqcK')

export class ProtocolClient {
  private client: any
  private connection: Connection
  private useCodama: boolean

  constructor(connection: Connection) {
    this.connection = connection
    this.useCodama = !!CodamaGeneratedClient

    if (this.useCodama) {
      // Initialize Codama client
      this.client = new CodamaGeneratedClient({
        connection,
        programId: PROGRAM_ID,
      })
    } else {
      // Use manual client
      this.client = new KleosProtocolClient(connection, PROGRAM_ID)
    }
  }

  // Protocol methods
  async initializeProtocol(admin: PublicKey, protocolFeeBps: number): Promise<Transaction> {
    if (this.useCodama) {
      return this.client.initializeProtocol({ protocolFeeBps }, { feePayer: admin })
    }
    return this.client.initializeProtocol(admin, protocolFeeBps)
  }

  async updateProtocol(
    admin: PublicKey,
    protocolFeeBps: number,
    treasury: PublicKey,
    paused: boolean
  ): Promise<Transaction> {
    if (this.useCodama) {
      return this.client.updateProtocol(
        { protocolFeeBps, treasury, paused },
        { feePayer: admin }
      )
    }
    return this.client.updateProtocol(admin, protocolFeeBps, treasury, paused)
  }

  // Market methods
  async createMarket(
    admin: PublicKey,
    tokenMint: PublicKey,
    startTs: bigint | number,
    endTs: bigint | number,
    itemsHash: number[] | Uint8Array,
    itemCount: number,
    marketCount: bigint
  ): Promise<Transaction> {
    if (this.useCodama) {
      return this.client.createMarket(
        {
          startTs: BigInt(startTs),
          endTs: BigInt(endTs),
          itemsHash: Array.from(itemsHash),
          itemCount,
        },
        { feePayer: admin }
      )
    }
    return this.client.createMarket(admin, tokenMint, startTs, endTs, itemsHash, itemCount, marketCount)
  }

  async editMarket(
    admin: PublicKey,
    market: PublicKey,
    startTs: bigint | number,
    endTs: bigint | number,
    itemsHash: number[] | Uint8Array,
    itemCount: number
  ): Promise<Transaction> {
    if (this.useCodama) {
      return this.client.editMarket(
        {
          startTs: BigInt(startTs),
          endTs: BigInt(endTs),
          itemsHash: Array.from(itemsHash),
          itemCount,
        },
        { feePayer: admin }
      )
    }
    return this.client.editMarket(admin, market, startTs, endTs, itemsHash, itemCount)
  }

  async openMarket(admin: PublicKey, market: PublicKey): Promise<Transaction> {
    if (this.useCodama) {
      return this.client.openMarket({}, { feePayer: admin })
    }
    return this.client.openMarket(admin, market)
  }

  async closeMarket(market: PublicKey): Promise<Transaction> {
    if (this.useCodama) {
      return this.client.closeMarket({})
    }
    return this.client.closeMarket(market)
  }

  async settleMarket(
    market: PublicKey,
    tokenMint: PublicKey,
    treasury: PublicKey
  ): Promise<Transaction> {
    if (this.useCodama) {
      return this.client.settleMarket({})
    }
    return this.client.settleMarket(market, tokenMint, treasury)
  }

  // Position methods
  async placePosition(
    user: PublicKey,
    market: PublicKey,
    tokenMint: PublicKey,
    selectedItemIndex: number,
    rawStake: bigint | number,
    effectiveStake: bigint | string
  ): Promise<Transaction> {
    if (this.useCodama) {
      return this.client.placePosition(
        {
          selectedItemIndex,
          rawStake: BigInt(rawStake),
          effectiveStake: typeof effectiveStake === 'string' ? BigInt(effectiveStake) : BigInt(effectiveStake),
        },
        { feePayer: user }
      )
    }
    return this.client.placePosition(user, market, tokenMint, selectedItemIndex, rawStake, effectiveStake)
  }

  async claimPayout(
    user: PublicKey,
    market: PublicKey,
    tokenMint: PublicKey
  ): Promise<Transaction> {
    if (this.useCodama) {
      return this.client.claimPayout({}, { feePayer: user })
    }
    return this.client.claimPayout(user, market, tokenMint)
  }

  // Helper to check if Codama is being used
  isUsingCodama(): boolean {
    return this.useCodama
  }
}

// Export PDA helpers
export * from './client'
