'use client'

import type { ExecutionResponse } from '@/lib/api/client'

const MONAD_EXPLORER = 'https://testnet.monadscan.com'
const BASE_EXPLORER = 'https://basescan.org'
const SOLANA_EXPLORER = 'https://explorer.solana.com'

function link(hash: string, base: string) {
  return `${base}/tx/${hash}`
}

export function ExecutionStatus({ execution }: { execution: ExecutionResponse }) {
  const { status, evm_tx_hash, bridge_message_id, swap_tx_hash, error_code, error_message, source_chain } =
    execution
  const evmExplorer = (source_chain ?? '').toLowerCase() === 'base' ? BASE_EXPLORER : MONAD_EXPLORER
  return (
    <div className="p-4 border border-white/30 rounded-lg space-y-2">
      <p className="font-medium">
        Status: <span className="text-white">{status}</span>
      </p>
      {evm_tx_hash && (
        <p className="text-sm">
          EVM tx:{' '}
          <a
            href={link(evm_tx_hash, evmExplorer)}
            target="_blank"
            rel="noopener noreferrer"
            className="underline text-gray-300 hover:text-white"
          >
            {evm_tx_hash.slice(0, 10)}...{evm_tx_hash.slice(-8)}
          </a>
        </p>
      )}
      {bridge_message_id && (
        <p className="text-sm text-gray-400">Bridge message: {bridge_message_id.slice(0, 16)}...</p>
      )}
      {swap_tx_hash && (
        <p className="text-sm">
          Swap tx:{' '}
          <a
            href={link(swap_tx_hash, SOLANA_EXPLORER)}
            target="_blank"
            rel="noopener noreferrer"
            className="underline text-gray-300 hover:text-white"
          >
            {swap_tx_hash.slice(0, 10)}...{swap_tx_hash.slice(-8)}
          </a>
        </p>
      )}
      {(error_code || error_message) && (
        <p className="text-sm text-red-400">
          {error_code}: {error_message}
        </p>
      )}
    </div>
  )
}
