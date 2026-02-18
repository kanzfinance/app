export interface TokenHolding {
  symbol: string
  name?: string
  icon?: string
  mintOrAddress: string
  balance: string
  balanceRaw: string
  decimals: number
  usdPrice?: number
  change24h?: number
}

const NATIVE_SOL_MINT = 'So11111111111111111111111111111111111111111'

type HeliusBalance = {
  mint: string
  symbol?: string
  name?: string
  balance: number
  decimals: number
  usdValue?: number
  pricePerToken?: number
  logoUri?: string
  tokenProgram?: string
}

export async function fetchSolanaPortfolio(address: string): Promise<TokenHolding[]> {
  const holdings: TokenHolding[] = []

  try {
    const res = await fetch(
      `/api/helius/wallet/balances?address=${encodeURIComponent(address)}`
    )
    if (!res.ok) {
      console.error('Helius balances error', res.status)
      return holdings
    }
    const data = (await res.json()) as { balances?: HeliusBalance[] }
    const balances = (data.balances ?? []) as HeliusBalance[]

    for (const b of balances) {
      const mint = b.mint ?? ''
      if (!mint) continue
      const balanceNum = typeof b.balance === 'number' ? b.balance : 0
      const isNative = mint === NATIVE_SOL_MINT
      if (!isNative && balanceNum === 0) continue
      const usdVal = typeof b.usdValue === 'number' ? b.usdValue : undefined
      if (!isNative && usdVal === 0) continue
      const decimals = typeof b.decimals === 'number' ? b.decimals : 0
      const balanceRaw = Math.round(balanceNum * 10 ** decimals).toString()
      holdings.push({
        symbol: b.symbol ?? 'Unknown',
        name: b.name,
        icon: mint === NATIVE_SOL_MINT ? '/solana.png' : b.logoUri,
        mintOrAddress: mint,
        balance: balanceNum.toFixed(6),
        balanceRaw,
        decimals,
        usdPrice: b.pricePerToken ?? (balanceNum > 0 && typeof b.usdValue === 'number' ? b.usdValue / balanceNum : undefined),
      })
    }
  } catch (e) {
    console.error('Helius Solana portfolio fetch error', e)
  }

  return holdings
}

type AlchemyPortfolioToken = {
  network: string
  address: string
  tokenAddress: string | null
  tokenBalance: string
  tokenMetadata?: { decimals?: number; logo?: string; name?: string; symbol?: string }
  tokenPrices?: Array<{ currency: string; value: string; lastUpdatedAt: string }>
  error?: string | null
}

const MORALIS_BASE_CHAIN = '0x2105'
const MORALIS_MONAD_CHAIN = '0x8f'

type MoralisToken = {
  token_address: string
  name?: string
  symbol?: string
  logo?: string
  thumbnail?: string
  decimals?: string
  balance: string
  balance_formatted?: string
  native_token?: boolean
  usd_price?: string
  usd_value?: string
}

async function fetchAlchemyTokensByAddress(
  address: string,
  chain: 'base' | 'monad'
): Promise<AlchemyPortfolioToken[]> {
  const res = await fetch(
    `/api/alchemy/token-balances?address=${encodeURIComponent(address)}&chain=${chain}`
  )
  if (!res.ok) return []
  const data = (await res.json()) as { tokens?: AlchemyPortfolioToken[] }
  return data.tokens ?? []
}

function getMoralisChainId(chain: 'base' | 'monad'): string {
  return chain === 'base' ? MORALIS_BASE_CHAIN : MORALIS_MONAD_CHAIN
}

async function fetchMoralisTokens(address: string, chain: 'base' | 'monad'): Promise<MoralisToken[]> {
  const chainId = getMoralisChainId(chain)
  const res = await fetch(
    `/api/moralis/wallets/tokens?address=${encodeURIComponent(address)}&chain=${chainId}`
  )
  if (!res.ok) return []
  const data = (await res.json()) as { result?: MoralisToken[] }
  return data.result ?? []
}

function mapMoralisToHoldings(tokens: MoralisToken[], chain: 'base' | 'monad'): TokenHolding[] {
  const holdings: TokenHolding[] = []
  const nativeSymbol = chain === 'base' ? 'ETH' : 'MON'
  for (const t of tokens) {
    const balanceRaw = t.balance ?? '0'
    const balanceBig = BigInt(balanceRaw)
    if (!t.native_token && balanceBig === BigInt(0)) continue

    const decimals = t.decimals != null ? parseInt(t.decimals, 10) : 18
    const div = 10 ** decimals
    const balanceNum = Number(balanceBig) / div
    const symbol = t.symbol ?? (t.native_token ? nativeSymbol : t.token_address.slice(0, 10))
    const name = t.name
    const icon = t.native_token && chain === 'base' ? '/eth.png' : (t.logo ?? t.thumbnail)
    const usdPriceNum =
      t.usd_price != null && t.usd_price !== '' ? parseFloat(t.usd_price) : undefined
    const usdValue =
      t.usd_value != null && t.usd_value !== '' ? parseFloat(t.usd_value) : (usdPriceNum != null ? balanceNum * usdPriceNum : undefined)
    if (!t.native_token && usdValue === 0) continue

    holdings.push({
      symbol,
      name,
      icon,
      mintOrAddress: t.native_token ? 'native' : t.token_address,
      balance: balanceNum.toFixed(6),
      balanceRaw,
      decimals,
      usdPrice: usdPriceNum,
    })
  }
  return holdings
}

export async function fetchEvmPortfolio(
  address: string,
  chain: 'base' | 'monad'
): Promise<TokenHolding[]> {
  const holdings: TokenHolding[] = []
  try {
    const moralisTokens = await fetchMoralisTokens(address, chain)
    if (moralisTokens.length > 0) {
      return mapMoralisToHoldings(moralisTokens, chain)
    }

    // Fallback / debug: Alchemy (kept for debugging)
    const tokens = await fetchAlchemyTokensByAddress(address, chain)
    for (const t of tokens) {
      if (t.error) continue
      const isNative = t.tokenAddress == null
      const raw = t.tokenBalance?.trim() ?? ''
      if (!isNative && (!raw || raw === '0x' || raw === '0x0')) continue
      const balanceRaw = !raw || raw === '0x' || raw === '0x0' ? '0' : (raw.startsWith('0x') ? BigInt(raw).toString() : raw)
      const balanceBig = BigInt(balanceRaw)
      if (!isNative && balanceBig === BigInt(0)) continue

      const meta = t.tokenMetadata
      const decimals = typeof meta?.decimals === 'number' ? meta.decimals : 18
      const div = 10 ** decimals
      const balanceNum = Number(balanceBig) / div
      const symbol = meta?.symbol ?? (t.tokenAddress ? t.tokenAddress.slice(0, 10) : 'ETH')
      const name = meta?.name
      const icon = t.tokenAddress == null && chain === 'base' ? '/eth.png' : meta?.logo

      const usdPrice = t.tokenPrices?.find((p) => p.currency?.toLowerCase() === 'usd')
      const usdPriceNum = usdPrice?.value != null ? parseFloat(usdPrice.value) : undefined
      const usdValue = usdPriceNum != null ? balanceNum * usdPriceNum : undefined
      if (!isNative && usdValue === 0) continue

      holdings.push({
        symbol,
        name,
        icon,
        mintOrAddress: t.tokenAddress ?? 'native',
        balance: balanceNum.toFixed(6),
        balanceRaw,
        decimals,
        usdPrice: usdPriceNum,
      })
    }
  } catch (e) {
    console.error(`${chain} portfolio fetch error`, e)
  }
  return holdings
}
