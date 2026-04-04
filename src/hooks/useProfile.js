/**
 * useProfile
 *
 * Fetches the current user's profile from Supabase (major, year in program)
 * and provides an updateProfile function to save changes.
 *
 * Returns:
 *   profile          - { id, display_name, major_id, year_in_program }
 *   loading          - boolean
 *   error            - string or null
 *   updateProfile    - async function({ major_id, year_in_program, display_name })
 */

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export function useProfile() {
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!user) {
      setProfile(null)
      return
    }

    setLoading(true)
    supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setProfile(data)
        setLoading(false)
      })
  }, [user])

  async function updateProfile(updates) {
    if (!user) return { error: 'Not logged in' }

    setError(null)
    const { data, error } = await supabase
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', user.id)
      .select()
      .single()

    if (error) {
      setError(error.message)
      return { error }
    }

    setProfile(data)
    return { data }
  }

  return { profile, loading, error, updateProfile }
}
