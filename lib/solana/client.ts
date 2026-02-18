import { Connection, PublicKey, Transaction, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js'
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token'
import idl from '@/idl/kleos_protocol.json'

export const PROGRAM_ID = new PublicKey(idl.address)
export const TOKEN_PROGRAM = TOKEN_PROGRAM_ID
export const ASSOCIATED_TOKEN_PROGRAM = ASSOCIATED_TOKEN_PROGRAM_ID
export const SYSTEM_PROGRAM = SystemProgram.programId

// PDA Seeds
export const PROTOCOL_SEED = Buffer.from('protocol')
export const MARKET_SEED = Buffer.from('market')
export const POSITION_SEED = Buffer.from('position')
export const VAULT_SEED = Buffer.from('vault')

// Helper functions to derive PDAs
export async function getProtocolPda(): Promise<[PublicKey, number]> {
  return PublicKey.findProgramAddressSync([PROTOCOL_SEED], PROGRAM_ID)
}

export async function getMarketPda(marketCount: bigint): Promise<[PublicKey, number]> {
  // Market PDA uses protocol.market_count as seed
  const marketCountBuffer = Buffer.allocUnsafe(8)
  marketCountBuffer.writeBigUInt64LE(marketCount, 0)
  return PublicKey.findProgramAddressSync([MARKET_SEED, marketCountBuffer], PROGRAM_ID)
}

export async function getPositionPda(market: PublicKey, user: PublicKey): Promise<[PublicKey, number]> {
  return PublicKey.findProgramAddressSync(
    [POSITION_SEED, market.toBuffer(), user.toBuffer()],
    PROGRAM_ID
  )
}

export async function getVaultAuthorityPda(market: PublicKey): Promise<[PublicKey, number]> {
  return PublicKey.findProgramAddressSync([VAULT_SEED, market.toBuffer()], PROGRAM_ID)
}

export async function getVaultPda(vaultAuthority: PublicKey, tokenMint: PublicKey): Promise<PublicKey> {
  // Vault is an ATA, use getAssociatedTokenAddress
  return getAssociatedTokenAddress(tokenMint, vaultAuthority, true)
}

// Instruction discriminators (first 8 bytes of sha256("global:instruction_name"))
const INSTRUCTION_DISCRIMINATORS = {
  initializeProtocol: Buffer.from([188, 233, 252, 106, 134, 146, 202, 91]),
  createMarket: Buffer.from([103, 226, 97, 235, 200, 188, 251, 254]),
  editMarket: Buffer.from([77, 92, 29, 5, 217, 159, 214, 32]),
  openMarket: Buffer.from([116, 19, 123, 75, 217, 244, 69, 44]),
  placePosition: Buffer.from([218, 31, 90, 75, 101, 209, 5, 253]),
  closeMarket: Buffer.from([88, 154, 248, 186, 48, 14, 123, 244]),
  settleMarket: Buffer.from([193, 153, 95, 216, 166, 6, 144, 217]),
  claimPayout: Buffer.from([127, 240, 132, 62, 227, 198, 146, 133]),
  updateProtocol: Buffer.from([206, 25, 218, 114, 109, 41, 74, 173]),
}

// Helper to serialize arguments
function serializeI64(value: bigint | number): Buffer {
  const buffer = Buffer.allocUnsafe(8)
  const bigIntValue = BigInt(value)
  buffer.writeBigInt64LE(bigIntValue, 0)
  return buffer
}

function serializeU8(value: number): Buffer {
  return Buffer.from([value])
}

function serializeU16(value: number): Buffer {
  const buffer = Buffer.allocUnsafe(2)
  buffer.writeUInt16LE(value, 0)
  return buffer
}

function serializeU64(value: bigint | number): Buffer {
  const buffer = Buffer.allocUnsafe(8)
  const bigIntValue = BigInt(value)
  buffer.writeBigUInt64LE(bigIntValue, 0)
  return buffer
}

function serializeU128(value: bigint | string): Buffer {
  const buffer = Buffer.allocUnsafe(16)
  const bigIntValue = typeof value === 'string' ? BigInt(value) : BigInt(value)
  buffer.writeBigUInt64LE(bigIntValue & BigInt('0xFFFFFFFFFFFFFFFF'), 0)
  buffer.writeBigUInt64LE(bigIntValue >> BigInt(64), 8)
  return buffer
}

function serializePubkey(pubkey: PublicKey | string): Buffer {
  if (typeof pubkey === 'string') {
    return new PublicKey(pubkey).toBuffer()
  }
  return pubkey.toBuffer()
}

function serializeArrayU8(value: number[] | Uint8Array): Buffer {
  if (value instanceof Uint8Array) {
    return Buffer.from(value)
  }
  return Buffer.from(value)
}

// Client class for interacting with the program
export class KleosProtocolClient {
  constructor(
    private connection: Connection,
    private programId: PublicKey = PROGRAM_ID
  ) {}

  // Initialize Protocol
  async initializeProtocol(
    admin: PublicKey,
    protocolFeeBps: number
  ): Promise<Transaction> {
    const [protocolPda] = await getProtocolPda()
    
    const transaction = new Transaction()
    
    // Build instruction data
    const instructionData = Buffer.concat([
      INSTRUCTION_DISCRIMINATORS.initializeProtocol,
      serializeU16(protocolFeeBps),
    ])

    // Add instruction (simplified - actual implementation needs proper account building)
    transaction.add({
      keys: [
        { pubkey: admin, isSigner: true, isWritable: true },
        { pubkey: protocolPda, isSigner: false, isWritable: true },
        { pubkey: SYSTEM_PROGRAM, isSigner: false, isWritable: false },
      ],
      programId: this.programId,
      data: instructionData,
    })

    return transaction
  }

  // Create Market
  async createMarket(
    admin: PublicKey,
    tokenMint: PublicKey,
    startTs: bigint | number,
    endTs: bigint | number,
    itemsHash: number[] | Uint8Array,
    itemCount: number,
    marketCount: bigint
  ): Promise<Transaction> {
    const [protocolPda] = await getProtocolPda()
    const [marketPda] = await getMarketPda(marketCount)
    const [vaultAuthorityPda] = await getVaultAuthorityPda(marketPda)
    const vaultPda = await getVaultPda(vaultAuthorityPda, tokenMint)

    const transaction = new Transaction()

    const instructionData = Buffer.concat([
      INSTRUCTION_DISCRIMINATORS.createMarket,
      serializeI64(startTs),
      serializeI64(endTs),
      serializeArrayU8(itemsHash),
      serializeU8(itemCount),
    ])

    transaction.add({
      keys: [
        { pubkey: admin, isSigner: true, isWritable: true },
        { pubkey: protocolPda, isSigner: false, isWritable: true },
        { pubkey: marketPda, isSigner: false, isWritable: true },
        { pubkey: vaultAuthorityPda, isSigner: false, isWritable: false },
        { pubkey: vaultPda, isSigner: false, isWritable: true },
        { pubkey: tokenMint, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM, isSigner: false, isWritable: false },
        { pubkey: ASSOCIATED_TOKEN_PROGRAM, isSigner: false, isWritable: false },
        { pubkey: SYSTEM_PROGRAM, isSigner: false, isWritable: false },
      ],
      programId: this.programId,
      data: instructionData,
    })

    return transaction
  }

  // Edit Market
  async editMarket(
    admin: PublicKey,
    market: PublicKey,
    startTs: bigint | number,
    endTs: bigint | number,
    itemsHash: number[] | Uint8Array,
    itemCount: number
  ): Promise<Transaction> {
    const [protocolPda] = await getProtocolPda()

    const transaction = new Transaction()

    const instructionData = Buffer.concat([
      INSTRUCTION_DISCRIMINATORS.editMarket,
      serializeI64(startTs),
      serializeI64(endTs),
      serializeArrayU8(itemsHash),
      serializeU8(itemCount),
    ])

    transaction.add({
      keys: [
        { pubkey: admin, isSigner: true, isWritable: true },
        { pubkey: protocolPda, isSigner: false, isWritable: false },
        { pubkey: market, isSigner: false, isWritable: true },
      ],
      programId: this.programId,
      data: instructionData,
    })

    return transaction
  }

  // Open Market
  async openMarket(admin: PublicKey, market: PublicKey): Promise<Transaction> {
    const [protocolPda] = await getProtocolPda()

    const transaction = new Transaction()

    const instructionData = INSTRUCTION_DISCRIMINATORS.openMarket

    transaction.add({
      keys: [
        { pubkey: admin, isSigner: true, isWritable: true },
        { pubkey: protocolPda, isSigner: false, isWritable: false },
        { pubkey: market, isSigner: false, isWritable: true },
      ],
      programId: this.programId,
      data: instructionData,
    })

    return transaction
  }

  // Place Position
  async placePosition(
    user: PublicKey,
    market: PublicKey,
    tokenMint: PublicKey,
    selectedItemIndex: number,
    rawStake: bigint | number,
    effectiveStake: bigint | string
  ): Promise<Transaction> {
    const [protocolPda] = await getProtocolPda()
    const [positionPda] = await getPositionPda(market, user)
    const [vaultAuthorityPda] = await getVaultAuthorityPda(market)
    const vaultPda = await getVaultPda(vaultAuthorityPda, tokenMint)
    const userTokenAccount = await getAssociatedTokenAddress(tokenMint, user)

    const transaction = new Transaction()

    const instructionData = Buffer.concat([
      INSTRUCTION_DISCRIMINATORS.placePosition,
      serializeU8(selectedItemIndex),
      serializeU64(rawStake),
      serializeU128(effectiveStake),
    ])

    transaction.add({
      keys: [
        { pubkey: user, isSigner: true, isWritable: true },
        { pubkey: protocolPda, isSigner: false, isWritable: false },
        { pubkey: market, isSigner: false, isWritable: true },
        { pubkey: positionPda, isSigner: false, isWritable: true },
        { pubkey: userTokenAccount, isSigner: false, isWritable: true },
        { pubkey: vaultPda, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM, isSigner: false, isWritable: false },
        { pubkey: SYSTEM_PROGRAM, isSigner: false, isWritable: false },
      ],
      programId: this.programId,
      data: instructionData,
    })

    return transaction
  }

  // Close Market
  async closeMarket(market: PublicKey): Promise<Transaction> {
    const transaction = new Transaction()

    const instructionData = INSTRUCTION_DISCRIMINATORS.closeMarket

    transaction.add({
      keys: [{ pubkey: market, isSigner: false, isWritable: true }],
      programId: this.programId,
      data: instructionData,
    })

    return transaction
  }

  // Settle Market
  async settleMarket(
    market: PublicKey,
    tokenMint: PublicKey,
    treasury: PublicKey
  ): Promise<Transaction> {
    const [protocolPda] = await getProtocolPda()
    const [vaultAuthorityPda] = await getVaultAuthorityPda(market)
    const vaultPda = await getVaultPda(vaultAuthorityPda, tokenMint)
    const treasuryTokenAccount = await getAssociatedTokenAddress(tokenMint, treasury)

    const transaction = new Transaction()

    const instructionData = INSTRUCTION_DISCRIMINATORS.settleMarket

    transaction.add({
      keys: [
        { pubkey: protocolPda, isSigner: false, isWritable: false },
        { pubkey: market, isSigner: false, isWritable: true },
        { pubkey: vaultAuthorityPda, isSigner: false, isWritable: false },
        { pubkey: vaultPda, isSigner: false, isWritable: true },
        { pubkey: treasuryTokenAccount, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM, isSigner: false, isWritable: false },
      ],
      programId: this.programId,
      data: instructionData,
    })

    return transaction
  }

  // Claim Payout
  async claimPayout(
    user: PublicKey,
    market: PublicKey,
    tokenMint: PublicKey
  ): Promise<Transaction> {
    const [positionPda] = await getPositionPda(market, user)
    const [vaultAuthorityPda] = await getVaultAuthorityPda(market)
    const vaultPda = await getVaultPda(vaultAuthorityPda, tokenMint)
    const userTokenAccount = await getAssociatedTokenAddress(tokenMint, user)

    const transaction = new Transaction()

    const instructionData = INSTRUCTION_DISCRIMINATORS.claimPayout

    transaction.add({
      keys: [
        { pubkey: user, isSigner: true, isWritable: true },
        { pubkey: market, isSigner: false, isWritable: true },
        { pubkey: positionPda, isSigner: false, isWritable: true },
        { pubkey: vaultAuthorityPda, isSigner: false, isWritable: false },
        { pubkey: vaultPda, isSigner: false, isWritable: true },
        { pubkey: userTokenAccount, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM, isSigner: false, isWritable: false },
      ],
      programId: this.programId,
      data: instructionData,
    })

    return transaction
  }

  // Update Protocol
  async updateProtocol(
    admin: PublicKey,
    protocolFeeBps: number,
    treasury: PublicKey,
    paused: boolean
  ): Promise<Transaction> {
    const [protocolPda] = await getProtocolPda()

    const transaction = new Transaction()

    const instructionData = Buffer.concat([
      INSTRUCTION_DISCRIMINATORS.updateProtocol,
      serializeU16(protocolFeeBps),
      serializePubkey(treasury),
      Buffer.from([paused ? 1 : 0]),
    ])

    transaction.add({
      keys: [
        { pubkey: admin, isSigner: true, isWritable: true },
        { pubkey: protocolPda, isSigner: false, isWritable: true },
      ],
      programId: this.programId,
      data: instructionData,
    })

    return transaction
  }
}
