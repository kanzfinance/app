// Use Next.js API routes (same-origin). No separate backend needed.
const API_BASE = '/api'

const DEBUG = true
function log(scope: string, message: string, data?: unknown) {
  if (DEBUG) {
    const payload = data !== undefined ? { message, data } : { message }
    console.log(`[Kanz:${scope}]`, payload)
  }
}

export async function apiRequest<T>(
  path: string,
  options: {
    method?: string
    body?: unknown
    token?: string | null
  } = {}
): Promise<T> {
  const { method = 'GET', body, token } = options
  const url = `${API_BASE}${path}`
  log('api', 'request', { url, path, method, hasBody: body != null, hasToken: !!token })
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (token) headers['Authorization'] = `Bearer ${token}`
  let res: Response
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body != null ? JSON.stringify(body) : undefined,
    })
  } catch (fetchErr) {
    const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr)
    log('api', 'fetch failed (no response)', {
      url,
      error: msg,
      hint:
        msg === 'Failed to fetch'
          ? 'Check: 1) API server running at API_BASE? 2) CORS allows this origin. 3) NEXT_PUBLIC_API_URL in .env correct?'
          : undefined,
    })
    throw fetchErr
  }
  const bodyText = await res.text()
  log('api', 'response', { path, status: res.status, ok: res.ok, bodyLength: bodyText.length })
  if (!res.ok) {
    const err = (() => {
      try {
        return JSON.parse(bodyText) as { error?: string }
      } catch {
        return { error: bodyText.slice(0, 200) }
      }
    })()
    log('api', 'error', { path, status: res.status, err, bodyPreview: bodyText.slice(0, 500) })
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }
  const json = (bodyText ? JSON.parse(bodyText) : {}) as T
  log('api', 'parsed', { path, fullResponse: json })
  return json
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
  opts?: { bridge_provider?: 'lifi' }
): Promise<BridgePayloadResponse> {
  const bridgeProvider = opts?.bridge_provider ?? undefined
  const qs = bridgeProvider ? `?bridge_provider=${encodeURIComponent(bridgeProvider)}` : ''
  log('api', 'getBridgePayload', { executionId, bridge_provider: bridgeProvider ?? '(none)' })
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

/** Server-side sign and send Jupiter swap (Privy authorization context). No client popup. */
export async function swapSignAndSend(
  token: string,
  executionId: string
): Promise<{ swap_tx_hash: string }> {
  return apiRequest<{ swap_tx_hash: string }>(
    `/executions/${executionId}/swap-sign-and-send`,
    { method: 'POST', token }
  )
}

/** Payload for the client to sign (authorization signature). Same shape as Privy WalletApiRequestSignatureInput. */
export interface SwapSignaturePayload {
  version: 1
  method: 'POST'
  url: string
  body: Record<string, unknown>
  headers: { 'privy-app-id': string; 'privy-idempotency-key'?: string }
}

export async function getSwapSignaturePayload(
  token: string,
  executionId: string
): Promise<{ payload: SwapSignaturePayload }> {
  return apiRequest<{ payload: SwapSignaturePayload }>(
    `/executions/${executionId}/swap-signature-payload`,
    { token }
  )
}

/** Execute swap using a client-provided authorization signature (no server JWT exchange). */
export async function swapSignAndSendWithSignature(
  token: string,
  executionId: string,
  signature: string
): Promise<{ swap_tx_hash: string }> {
  return apiRequest<{ swap_tx_hash: string }>(
    `/executions/${executionId}/swap-sign-and-send-with-signature`,
    { method: 'POST', token, body: { signature } }
  )
}
