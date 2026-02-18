'use client'

import { useState, useEffect, useRef } from 'react'
import { fairscaleApi } from '@/lib/api'

export interface FairScaleScore {
  wallet: string
  fairscore_base: number
  social_score: number
  fairscore: number
  tier: 'bronze' | 'silver' | 'gold' | 'platinum'
  badges: Array<{
    id: string
    label: string
    description: string
    tier: string
  }>
  timestamp: string
  features?: {
    lst_percentile_score?: number
    major_percentile_score?: number
    native_sol_percentile?: number
    stable_percentile_score?: number
    tx_count?: number
    active_days?: number
    median_gap_hours?: number
    wallet_age_days?: number
  }
}

export function useFairscale(wallet: string | null) {
  const [score, setScore] = useState<FairScaleScore | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const fetchingRef = useRef(false)
  const walletRef = useRef<string | null>(null)

  useEffect(() => {
    // Reset if wallet becomes null
    if (!wallet) {
      setScore(null)
      setError(null)
      walletRef.current = null
      fetchingRef.current = false
      return
    }

    // Skip if already fetching for this wallet or wallet hasn't changed
    if (fetchingRef.current || walletRef.current === wallet) {
      return
    }

    // Mark that we're fetching for this wallet
    walletRef.current = wallet
    fetchingRef.current = true

    async function fetchScore() {
      setLoading(true)
      setError(null)

      try {
        const response = await fairscaleApi.getCompleteScore(wallet!)
        setScore(response.data)
      } catch (err: any) {
        setError(err.response?.data?.error || new Error('Failed to fetch wallet score'))
        // Don't set score on error to prevent retry loops
      } finally {
        setLoading(false)
        fetchingRef.current = false
      }
    }

    fetchScore()
  }, [wallet])

  return { score, loading, error }
}

export function useFairScore(wallet: string | null) {
  const [fairScore, setFairScore] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const fetchingRef = useRef(false)
  const walletRef = useRef<string | null>(null)

  useEffect(() => {
    // Reset if wallet becomes null
    if (!wallet) {
      setFairScore(null)
      setError(null)
      walletRef.current = null
      fetchingRef.current = false
      return
    }

    // Skip if already fetching for this wallet or wallet hasn't changed
    if (fetchingRef.current || walletRef.current === wallet) {
      return
    }

    // Mark that we're fetching for this wallet
    walletRef.current = wallet
    fetchingRef.current = true

    async function fetchScore() {
      setLoading(true)
      setError(null)

      try {
        const response = await fairscaleApi.getFairScore(wallet!)
        setFairScore(response.data.fair_score)
      } catch (err: any) {
        setError(err.response?.data?.error || new Error('Failed to fetch FairScore'))
        // Don't set score on error to prevent retry loops
      } finally {
        setLoading(false)
        fetchingRef.current = false
      }
    }

    fetchScore()
  }, [wallet])

  return { fairScore, loading, error }
}
