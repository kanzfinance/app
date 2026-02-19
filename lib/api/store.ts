export interface SyncedWallet {
  chainType: string
  address: string
  isEmbedded: boolean
}

export interface SyncedUser {
  user_id: string
  wallets: SyncedWallet[]
}

export type ExecutionStatus =
  | 'PENDING'
  | 'BRIDGING'
  | 'BRIDGED'
  | 'FAILED'
  | 'COMPLETED'

export interface Execution {
  id: string
  user_id: string
  status: ExecutionStatus
  amount_usdc: string
  source_chain: string
  evm_address: string
  solana_address: string
  evm_tx_hash?: string | null
  bridge_message_id?: string | null
  swap_tx_hash?: string | null
  error_code?: string | null
  error_message?: string | null
  created_at: string
  updated_at: string
}

const STORE_KEY = '__kanz_api_store'
interface Store {
  users: Map<string, SyncedUser>
  executions: Map<string, Execution>
}
function getStore(): Store {
  const g = globalThis as unknown as { [STORE_KEY]?: Store }
  if (!g[STORE_KEY]) {
    g[STORE_KEY] = {
      users: new Map(),
      executions: new Map(),
    }
  }
  return g[STORE_KEY]
}
const users = () => getStore().users
const executions = () => getStore().executions

export function upsertUser(userId: string, wallets: SyncedWallet[]): SyncedUser {
  const store = users()
  const existing = store.get(userId)
  const merged = mergeWallets(existing?.wallets ?? [], wallets)
  const user: SyncedUser = { user_id: userId, wallets: merged }
  store.set(userId, user)
  return user
}

function mergeWallets(
  existing: SyncedWallet[],
  incoming: { chainType?: string; address?: string; walletClientType?: string }[]
): SyncedWallet[] {
  const byKey = new Map<string, SyncedWallet>()
  for (const w of existing) {
    byKey.set(`${w.chainType}:${w.address}`, w)
  }
  for (const w of incoming) {
    if (!w.chainType || !w.address) continue
    const isEmbedded =
      w.walletClientType === 'privy' || w.walletClientType === 'privy-v2'
    byKey.set(`${w.chainType}:${w.address}`, {
      chainType: w.chainType,
      address: w.address,
      isEmbedded,
    })
  }
  return Array.from(byKey.values())
}

export function getUser(userId: string): SyncedUser | undefined {
  return users().get(userId)
}

export function createExecution(params: {
  user_id: string
  amount_usdc: string
  source_chain: string
  evm_address: string
  solana_address: string
}): Execution {
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const execution: Execution = {
    id,
    user_id: params.user_id,
    status: 'PENDING',
    amount_usdc: params.amount_usdc,
    source_chain: params.source_chain,
    evm_address: params.evm_address,
    solana_address: params.solana_address,
    created_at: now,
    updated_at: now,
  }
  executions().set(id, execution)
  return execution
}

export function getExecution(id: string): Execution | undefined {
  return executions().get(id)
}

export function updateExecution(
  id: string,
  updates: Partial<Pick<Execution, 'status' | 'evm_tx_hash' | 'swap_tx_hash' | 'error_code' | 'error_message'>>
): Execution | undefined {
  const store = executions()
  const ex = store.get(id)
  if (!ex) return undefined
  const updated: Execution = {
    ...ex,
    ...updates,
    updated_at: new Date().toISOString(),
  }
  store.set(id, updated)
  return updated
}
