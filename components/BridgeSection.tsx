'use client'

export function BridgeSection() {
  return (
    <p className="text-sm text-white/70">
      <a
        href="https://docs.monad.xyz/tooling-and-infra/cross-chain"
        target="_blank"
        rel="noopener noreferrer"
        className="underline hover:text-white"
      >
        Monad cross-chain docs
      </a>
      {' — '}
      <a
        href="https://portalbridge.com"
        target="_blank"
        rel="noopener noreferrer"
        className="underline hover:text-white"
      >
        Wormhole Portal
      </a>
      {' for manual USDC & SOL bridge to Solana.'}
    </p>
  )
}
