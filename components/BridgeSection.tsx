'use client'

export function BridgeSection() {
  return (
    <div className="space-y-1 pt-2 border-t border-white/10">
      <p className="text-xs text-white/50 font-medium">Manual bridge</p>
      <p className="text-sm text-white/70">
        <a
          href="https://docs.monad.xyz/tooling-and-infra/cross-chain"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-white"
        >
          Monad cross-chain docs
        </a>
        {' for manual USDC & SOL bridge to Solana.'}
      </p>
    </div>
  )
}
