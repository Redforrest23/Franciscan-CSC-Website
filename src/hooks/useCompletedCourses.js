/**
 * useCompletedCourses
 *
 * Centralizes all Supabase reads and writes for completed_courses
 * so Degree, Minors, and Planner pages don't each duplicate this logic.
 *
 * Returns:
 *   completedCourses  - raw rows from Supabase
 *   completedSet      - Set<string> of course IDs for fast lookup
 *   loading           - boolean
 *   toggle(courseId)  - adds or removes a course from completed
 */

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { getCompletedSet } from '../lib/progress'
import { useAuth } from '../context/AuthContext'

export function useCompletedCourses() {
  const { user } = useAuth()
  const [completedCourses, setCompletedCourses] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user) {
      setCompletedCourses([])
      return
    }

    setLoading(true)
    supabase
      .from('completed_courses')
      .select('*')
      .eq('user_id', user.id)
      .then(({ data, error }) => {
        if (!error && data) setCompletedCourses(data)
        setLoading(false)
      })
  }, [user])

  async function toggle(courseId) {
    if (!user) return

    const alreadyDone = completedCourses.some((c) => c.course_id === courseId)

    if (alreadyDone) {
      const { error } = await supabase
        .from('completed_courses')
        .delete()
        .eq('user_id', user.id)
        .eq('course_id', courseId)

      if (!error) {
        setCompletedCourses((prev) =>
          prev.filter((c) => c.course_id !== courseId)
        )
      }
    } else {
      const { data, error } = await supabase
        .from('completed_courses')
        .insert({ user_id: user.id, course_id: courseId })
        .select()
        .single()

      if (!error && data) {
        setCompletedCourses((prev) => [...prev, data])
      }
    }
  }

  return {
    completedCourses,
    completedSet: getCompletedSet(completedCourses),
    loading,
    toggle,
  }
}
