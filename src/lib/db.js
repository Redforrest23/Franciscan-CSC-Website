import { supabase } from './supabase'

// ── Courses ───────────────────────────────────────────────

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

export function courseMap(courses) {
    return Object.fromEntries(courses.map((c) => [c.id, c]))
}

// ── Degrees ───────────────────────────────────────────────

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

    return (groups ?? []).map((g) => ({
        ...g,
        courses: (g.degree_requirement_courses ?? []).map((r) => r.course_id),
    }))
}

export async function fetchSemesterPlans(degreeId, planType = null) {
    const selectQuery = `
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
  `

    if (planType) {
        const { data, error } = await supabase
            .from('degree_semester_plans')
            .select(selectQuery)
            .eq('degree_id', degreeId)
            .eq('plan_type', planType)
            .order('year', { ascending: true })
            .order('semester', { ascending: true })

        if (error) {
            console.error('fetchSemesterPlans error:', error.message)
            return []
        }
        return (data ?? []).map((plan) => ({
            ...plan,
            entries: [...(plan.degree_semester_courses ?? [])].sort((a, b) => a.position - b.position),
        }))
    }

    // Try standard first, fall back to auto
    const { data: standardPlans, error: standardError } = await supabase
        .from('degree_semester_plans')
        .select(selectQuery)
        .eq('degree_id', degreeId)
        .eq('plan_type', 'standard')
        .order('year', { ascending: true })
        .order('semester', { ascending: true })

    if (!standardError && standardPlans?.length > 0) {
        return standardPlans.map((plan) => ({
            ...plan,
            entries: [...(plan.degree_semester_courses ?? [])].sort((a, b) => a.position - b.position),
        }))
    }

    const { data: autoPlans, error: autoError } = await supabase
        .from('degree_semester_plans')
        .select(selectQuery)
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
        entries: [...(plan.degree_semester_courses ?? [])].sort((a, b) => a.position - b.position),
    }))
}

export async function hasAustriaPlan(degreeId) {
    const { data, error } = await supabase
        .from('degree_semester_plans')
        .select('id')
        .eq('degree_id', degreeId)
        .eq('plan_type', 'austria')
        .limit(1)

    if (error) return false
    return (data?.length ?? 0) > 0
}

// ── Planner preferences ───────────────────────────────────

export async function fetchPlannerPreferences(userId) {
    const { data, error } = await supabase
        .from('profiles')
        .select('planner_preferences')
        .eq('id', userId)
        .single()

    if (error || !data) return {}
    return data.planner_preferences ?? {}
}

export async function savePlannerPreferences(userId, prefs) {
    const { error } = await supabase
        .from('profiles')
        .update({ planner_preferences: prefs, updated_at: new Date().toISOString() })
        .eq('id', userId)

    return !error
}

// ── Planned courses ───────────────────────────────────────

export async function fetchPlannedCourses(userId, degreeId) {
    const { data, error } = await supabase
        .from('planned_courses')
        .select('*')
        .eq('user_id', userId)
        .eq('degree_id', degreeId)
        .order('position', { ascending: true })

    if (error) {
        console.error('fetchPlannedCourses error:', error.message)
        return []
    }
    return data ?? []
}

export async function savePlannedCourses(userId, degreeId, rows) {
    await supabase
        .from('planned_courses')
        .delete()
        .eq('user_id', userId)
        .eq('degree_id', degreeId)

    if (!rows.length) return true
    const { error } = await supabase.from('planned_courses').insert(rows)
    return !error
}

// ── Prior courses ─────────────────────────────────────────

export async function fetchPriorCourses(userId) {
    const { data, error } = await supabase
        .from('prior_courses')
        .select('*')
        .eq('user_id', userId)

    if (error) {
        console.error('fetchPriorCourses error:', error.message)
        return []
    }
    return data ?? []
}

export async function savePriorCourse(userId, courseData) {
    const { error } = await supabase
        .from('prior_courses')
        .insert({ user_id: userId, ...courseData })
    return !error
}

export async function deletePriorCourse(userId, courseId) {
    const { error } = await supabase
        .from('prior_courses')
        .delete()
        .eq('user_id', userId)
        .eq('course_id', courseId)
    return !error
}

// ── Completed courses ─────────────────────────────────────

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

// ── Ignored warnings ──────────────────────────────────────

export async function fetchIgnoredWarnings(userId) {
    const { data, error } = await supabase
        .from('ignored_warnings')
        .select('course_id, warning_type')
        .eq('user_id', userId)

    if (error) return []
    return data ?? []
}

export async function toggleIgnoredWarning(userId, courseId, warningType, currentlyIgnored) {
    if (currentlyIgnored) {
        const { error } = await supabase
            .from('ignored_warnings')
            .delete()
            .eq('user_id', userId)
            .eq('course_id', courseId)
            .eq('warning_type', warningType)
        return !error
    } else {
        const { error } = await supabase
            .from('ignored_warnings')
            .insert({ user_id: userId, course_id: courseId, warning_type: warningType })
        return !error
    }
}

// ── Minors ────────────────────────────────────────────────

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