import { PrivyClient } from '@privy-io/node'

let privyClient: PrivyClient | null = null

export function getPrivyClient(): PrivyClient {
  if (!privyClient) {
    const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID
    const appSecret = process.env.PRIVY_APP_SECRET
    if (!appId || !appSecret) {
      throw new Error(
        'Missing NEXT_PUBLIC_PRIVY_APP_ID or PRIVY_APP_SECRET (server-side only; do not use NEXT_PUBLIC_ for the secret)'
      )
    }
    privyClient = new PrivyClient({ appId, appSecret })
  }
  return privyClient
}

export async function getUserIdFromRequest(req: Request): Promise<string | null> {
  const auth = req.headers.get('Authorization')
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return null
  try {
    const client = getPrivyClient()
    const claims = await client.utils().auth().verifyAccessToken(token)
    return claims.user_id ?? null
  } catch {
    return null
  }
}

export function requireAuth(req: Request): Promise<string> {
  return getUserIdFromRequest(req).then((userId) => {
    if (!userId) throw new Error('Not authenticated')
    return userId
  })
}
