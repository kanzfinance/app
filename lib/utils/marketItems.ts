import { marketUtilsApi } from '@/lib/api'

/**
 * Calculate items hash from array of item strings using backend API
 */
export async function calculateItemsHash(items: string[]): Promise<string> {
  if (items.length === 0) {
    throw new Error('Items array cannot be empty')
  }

  try {
    const response = await marketUtilsApi.calculateItemsHash(items)
    return response.data.itemsHash
  } catch (error: any) {
    throw new Error(error.response?.data?.error || 'Failed to calculate items hash')
  }
}

/**
 * Synchronous version for display purposes (uses a placeholder)
 */
export function calculateItemsHashSync(items: string[]): string {
  if (items.length === 0) {
    return '0x' + '0'.repeat(64)
  }
  
  // Simple hash for display - actual hash will be calculated on backend
  const sortedItems = [...items].sort()
  const combined = sortedItems.join('|')
  let hash = 0
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  
  // Convert to hex and pad to 64 chars (32 bytes)
  return '0x' + Math.abs(hash).toString(16).padStart(64, '0').slice(0, 64)
}

/**
 * Validate items array
 */
export function validateItems(items: string[]): { valid: boolean; error?: string } {
  if (items.length < 2) {
    return { valid: false, error: 'Must have at least 2 items' }
  }
  
  if (items.length > 255) {
    return { valid: false, error: 'Cannot have more than 255 items' }
  }
  
  // Check for empty items (guard against undefined)
  const emptyItems = items.filter((item) => !(item ?? '').trim())
  if (emptyItems.length > 0) {
    return { valid: false, error: 'Items cannot be empty' }
  }

  // Check for duplicates (guard against undefined before trim/toLowerCase)
  const uniqueItems = new Set(items.map((item) => (item ?? '').trim().toLowerCase()))
  if (uniqueItems.size !== items.length) {
    return { valid: false, error: 'Items must be unique' }
  }
  
  return { valid: true }
}
