const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

export async function apiRequest<T>(
  path: string,
  options: {
    method?: string
    body?: unknown
    token?: string | null
  } = {}
): Promise<T> {
  const { method = 'GET', body, token } = options
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

export interface SyncResult {
  user_id: string
  wallets: { chainType: string; address: string; isEmbedded: boolean }[]
}

export async function authSync(token: string, linkedAccounts: unknown[]): Promise<SyncResult> {
  return apiRequest<SyncResult>('/auth/sync', {
    method: 'POST',
    token,
    body: { linkedAccounts },
  })
}

export interface ExecutionResponse {
  id: string
  status: string
  evm_tx_hash?: string | null
  bridge_message_id?: string | null
  swap_tx_hash?: string | null
  error_code?: string | null
  error_message?: string | null
  amount_usdc: string
  source_chain: string
  created_at: string
  updated_at: string
}

export interface CreateExecutionResponse {
  execution_id: string
  status: string
  is_duplicate: boolean
}

export async function createExecution(
  token: string,
  body: { amount_usdc: string; slippage_bps?: number; source_chain: string; idempotency_key?: string }
): Promise<CreateExecutionResponse> {
  return apiRequest<CreateExecutionResponse>('/executions', {
    method: 'POST',
    token,
    body,
  })
}

export async function getExecution(token: string, executionId: string): Promise<ExecutionResponse> {
  return apiRequest<ExecutionResponse>(`/executions/${executionId}`, { token })
}

export interface BridgePayloadResponse {
  to: string
  data: string
  value: string
  gasLimit?: string
  approval_to?: string
  approval_data?: string
  approval_value?: string
}

export async function getBridgePayload(
  token: string,
  executionId: string,
  opts?: { bridge_provider?: 'lifi' | 'wormhole' }
): Promise<BridgePayloadResponse> {
  const qs = opts?.bridge_provider ? `?bridge_provider=${encodeURIComponent(opts.bridge_provider)}` : ''
  return apiRequest<BridgePayloadResponse>(`/executions/${executionId}/bridge-payload${qs}`, { token })
}

export async function submitEvmTx(
  token: string,
  executionId: string,
  evm_tx_hash: string
): Promise<{ ok: boolean }> {
  return apiRequest<{ ok: boolean }>(`/executions/${executionId}/evm-tx`, {
    method: 'PATCH',
    token,
    body: { evm_tx_hash },
  })
}

export interface SwapPayloadResponse {
  serialized_tx: string
}

export async function getSwapPayload(
  token: string,
  executionId: string
): Promise<SwapPayloadResponse> {
  return apiRequest<SwapPayloadResponse>(`/executions/${executionId}/swap-payload`, { token })
}

export async function submitSwapTx(
  token: string,
  executionId: string,
  body: { signed_tx?: string; swap_tx_hash?: string }
): Promise<{ swap_tx_hash: string }> {
  return apiRequest<{ swap_tx_hash: string }>(`/executions/${executionId}/swap-tx`, {
    method: 'POST',
    token,
    body,
  })
}
