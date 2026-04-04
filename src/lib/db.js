/**
 * db.js
 * All Supabase data fetching for the FUS CS/SE Planner.
 * Pages import from here instead of querying Supabase directly.
 */

import { supabase } from './supabase'

// ── Courses ───────────────────────────────────────────────

/**
 * Fetch all courses, or a specific list by ID.
 */
export async function fetchCourses(ids = null) {
    let query = supabase
        .from('courses')
        .select('*')
        .order('code', { ascending: true })

    if (ids && ids.length > 0) {
        query = query.in('id', ids)
    }

    const { data, error } = await query
    if (error) {
        console.error('fetchCourses error:', error.message)
        return []
    }
    return data ?? []
}

/**
 * Build a id→course map from a courses array for fast lookup.
 */
export function courseMap(courses) {
    return Object.fromEntries(courses.map((c) => [c.id, c]))
}

// ── Degrees ───────────────────────────────────────────────

/**
 * Fetch all degrees for the dropdown selector.
 */
export async function fetchDegrees() {
    const { data, error } = await supabase
        .from('degrees')
        .select('id, name, degree, total_credits, tier, catalog_url')
        .not('name', 'ilike', '%minor%')
        .not('name', 'ilike', '%certificate%')
        .order('name', { ascending: true })

    if (error) {
        console.error('fetchDegrees error:', error.message)
        return []
    }
    return data ?? []
}

/**
 * Fetch a single degree's full requirement groups and their courses.
 */
export async function fetchDegreeRequirements(degreeId) {
    const { data: groups, error: groupsError } = await supabase
        .from('degree_requirement_groups')
        .select(`
      id,
      label,
      choose_one,
      elective,
      elective_count,
      position,
      degree_requirement_courses (
        course_id
      )
    `)
        .eq('degree_id', degreeId)
        .order('position', { ascending: true })

    if (groupsError) {
        console.error('fetchDegreeRequirements error:', groupsError.message)
        return []
    }

    // Flatten course IDs into each group
    return (groups ?? []).map((g) => ({
        ...g,
        courses: (g.degree_requirement_courses ?? []).map((r) => r.course_id),
    }))
}

/**
 * Fetch all semester plans for a degree, with their courses and core slots.
 */
export async function fetchSemesterPlans(degreeId) {
    // Try standard (hand-curated) first, fall back to auto-generated
    const { data: standardPlans, error: standardError } = await supabase
        .from('degree_semester_plans')
        .select(`
      id,
      year,
      semester,
      label,
      austria_semester,
      austria_note,
      plan_type,
      degree_semester_courses (
        course_id,
        core_slot_label,
        core_slot_credits,
        position
      )
    `)
        .eq('degree_id', degreeId)
        .eq('plan_type', 'standard')
        .order('year', { ascending: true })
        .order('semester', { ascending: true })

    if (!standardError && standardPlans?.length > 0) {
        return standardPlans.map((plan) => ({
            ...plan,
            entries: [...(plan.degree_semester_courses ?? [])].sort(
                (a, b) => a.position - b.position
            ),
        }))
    }

    // Fall back to auto-generated
    const { data: autoPlans, error: autoError } = await supabase
        .from('degree_semester_plans')
        .select(`
      id,
      year,
      semester,
      label,
      austria_semester,
      austria_note,
      plan_type,
      degree_semester_courses (
        course_id,
        core_slot_label,
        core_slot_credits,
        position
      )
    `)
        .eq('degree_id', degreeId)
        .eq('plan_type', 'auto')
        .order('year', { ascending: true })
        .order('semester', { ascending: true })

    if (autoError) {
        console.error('fetchSemesterPlans error:', autoError.message)
        return []
    }

    return (autoPlans ?? []).map((plan) => ({
        ...plan,
        entries: [...(plan.degree_semester_courses ?? [])].sort(
            (a, b) => a.position - b.position
        ),
    }))
}

// Sort each semester's entries by position
return (plans ?? []).map((plan) => ({
    ...plan,
    entries: [...(plan.degree_semester_courses ?? [])].sort(
        (a, b) => a.position - b.position
    ),
}))

// ── User progress ─────────────────────────────────────────

/**
 * Fetch all completed course IDs for the current user.
 */
export async function fetchCompletedCourses(userId) {
    const { data, error } = await supabase
        .from('completed_courses')
        .select('course_id')
        .eq('user_id', userId)

    if (error) {
        console.error('fetchCompletedCourses error:', error.message)
        return new Set()
    }
    return new Set((data ?? []).map((r) => r.course_id))
}

/**
 * Toggle a course as completed or not for the current user.
 */
export async function toggleCompletedCourse(userId, courseId, currentlyCompleted) {
    if (currentlyCompleted) {
        const { error } = await supabase
            .from('completed_courses')
            .delete()
            .eq('user_id', userId)
            .eq('course_id', courseId)
        return !error
    } else {
        const { error } = await supabase
            .from('completed_courses')
            .insert({ user_id: userId, course_id: courseId })
        return !error
    }
}

// ── Minors ────────────────────────────────────────────────

/**
 * Fetch user's selected minor IDs.
 */
export async function fetchSelectedMinors(userId) {
    const { data, error } = await supabase
        .from('selected_minors')
        .select('minor_id')
        .eq('user_id', userId)

    if (error) {
        console.error('fetchSelectedMinors error:', error.message)
        return []
    }
    return (data ?? []).map((r) => r.minor_id)
}

/**
 * Add or remove a minor from the user's plan.
 */
export async function toggleSelectedMinor(userId, minorId, currentlySelected) {
    if (currentlySelected) {
        const { error } = await supabase
            .from('selected_minors')
            .delete()
            .eq('user_id', userId)
            .eq('minor_id', minorId)
        return !error
    } else {
        const { error } = await supabase
            .from('selected_minors')
            .insert({ user_id: userId, minor_id: minorId })
        return !error
    }
}