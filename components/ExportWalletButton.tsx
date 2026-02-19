'use client'

import { useExportWallet } from '@privy-io/react-auth/solana'
import { Button } from '@/components/ui/button'

interface ExportWalletButtonProps {
  solanaAddress?: string | null
}

export function ExportWalletButton({ solanaAddress }: ExportWalletButtonProps) {
  const { exportWallet } = useExportWallet()

  const handleExport = async () => {
    try {
      await exportWallet(solanaAddress ? { address: solanaAddress } : undefined)
    } catch (err) {
      console.error('[Kanz:ExportWallet]', err)
    }
  }

  if (!solanaAddress) return null

  return (
    <Button variant="outline" onClick={handleExport}>
      Export Solana key
    </Button>
  )
}
