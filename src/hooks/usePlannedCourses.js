import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

const AUTOSAVE_DELAY = 1000

export function usePlannedCourses(userId, degreeId, suggestedPlans, courses) {
    const [semesters, setSemesters] = useState([])
    const [saveStatus, setSaveStatus] = useState('idle')
    const [initialized, setInitialized] = useState(false)
    const saveTimer = useRef(null)

    // Always holds the latest semesters so saveNow can read it without stale closure
    const semestersRef = useRef([])
    useEffect(() => {
        semestersRef.current = semesters
    }, [semesters])

    function buildFromSuggested(plans, savedCourseMap = null, savedCoreSlotMap = null) {
        return plans.map((plan, i) => {
            const term = plan.semester === 1 ? 'fall' : 'spring'
            const courseIds = savedCourseMap
                ? (savedCourseMap[`${plan.year}-${term}`] ?? [])
                : plan.entries.filter((e) => e.course_id).map((e) => e.course_id)

            const defaultCoreSlots = plan.entries
                .filter((e) => !e.course_id && e.core_slot_label)
                .map((e, slotIdx) => ({
                    id: `coreSlot-${i}-${slotIdx}`,
                    label: e.core_slot_label,
                    credits: e.core_slot_credits ?? 3,
                    assignedCourseId: null,
                }))

            const coreSlots = savedCoreSlotMap?.[`${plan.year}-${term}`] ?? defaultCoreSlots

            return {
                id: plan.id,
                year: plan.year,
                term,
                label: plan.label,
                courseIds,
                coreSlots,
                austriaSemester: plan.austria_semester,
                austriaNote: plan.austria_note,
            }
        })
    }

    useEffect(() => {
        if (!userId || !degreeId || !suggestedPlans.length) return
        setInitialized(false)

        supabase
            .from('planned_courses')
            .select('*')
            .eq('user_id', userId)
            .eq('degree_id', degreeId)
            .order('position', { ascending: true })
            .then(({ data }) => {
                if (data && data.length > 0) {
                    const courseMap = {}
                    const coreSlotMap = {}

                    data.forEach((row) => {
                        const key = `${row.planned_year}-${row.planned_term}`
                        if (row.course_id) {
                            if (!courseMap[key]) courseMap[key] = []
                            courseMap[key].push(row.course_id)
                        } else if (row.core_slot_label) {
                            if (!coreSlotMap[key]) coreSlotMap[key] = []
                            coreSlotMap[key].push({
                                id: row.core_slot_id ?? `coreSlot-saved-${coreSlotMap[key].length}`,
                                label: row.core_slot_label,
                                credits: row.core_slot_credits ?? 3,
                                assignedCourseId: row.assigned_course_id ?? null,
                            })
                        }
                    })

                    setSemesters(buildFromSuggested(suggestedPlans, courseMap, coreSlotMap))
                } else {
                    setSemesters(buildFromSuggested(suggestedPlans))
                }
                setInitialized(true)
            })
    }, [userId, degreeId, suggestedPlans.length])

    function resetToSuggested(plans = suggestedPlans, doSave = true) {
        const built = buildFromSuggested(plans)
        setSemesters(built)
        semestersRef.current = built
        if (doSave) scheduleAutosave(built)
    }

    function scheduleAutosave(data) {
        setSaveStatus('saving')
        if (saveTimer.current) clearTimeout(saveTimer.current)
        saveTimer.current = setTimeout(() => persistSaveData(data), AUTOSAVE_DELAY)
    }

    // Core persist function — always takes explicit data so it never reads stale state
    async function persistSaveData(data) {
        if (!userId || !degreeId) return false
        setSaveStatus('saving')

        await supabase
            .from('planned_courses')
            .delete()
            .eq('user_id', userId)
            .eq('degree_id', degreeId)

        const rows = []
        data.forEach((sem) => {
            sem.courseIds.forEach((courseId, i) => {
                rows.push({
                    user_id: userId,
                    degree_id: degreeId,
                    course_id: courseId,
                    planned_year: sem.year,
                    planned_term: sem.term,
                    semester_label: sem.label,
                    position: i,
                })
            })
            sem.coreSlots.forEach((slot, i) => {
                rows.push({
                    user_id: userId,
                    degree_id: degreeId,
                    course_id: null,
                    core_slot_label: slot.label,
                    core_slot_credits: slot.credits,
                    core_slot_id: slot.id,
                    assigned_course_id: slot.assignedCourseId ?? null,
                    planned_year: sem.year,
                    planned_term: sem.term,
                    semester_label: sem.label,
                    position: sem.courseIds.length + i,
                })
            })
        })

        const success = rows.length
            ? !(await supabase.from('planned_courses').insert(rows)).error
            : true

        setSaveStatus(success ? 'saved' : 'error')
        setTimeout(() => setSaveStatus('idle'), 2000)
        return success
    }

    // Stable save function — always reads from ref so it's never stale
    // This is what the Save button calls directly
    const saveNow = useCallback(async () => {
        if (saveTimer.current) {
            clearTimeout(saveTimer.current)
            saveTimer.current = null
        }
        return persistSaveData(semestersRef.current)
    }, [userId, degreeId])

    const moveCourse = useCallback((courseId, toSemesterIndex) => {
        setSemesters((prev) => {
            const next = prev.map((s) => ({
                ...s,
                courseIds: s.courseIds.filter((id) => id !== courseId),
            }))
            next[toSemesterIndex] = {
                ...next[toSemesterIndex],
                courseIds: [...next[toSemesterIndex].courseIds, courseId],
            }
            scheduleAutosave(next)
            return next
        })
    }, [])

    const moveCoreSlot = useCallback((slotId, fromSemesterIndex, toSemesterIndex) => {
        if (fromSemesterIndex === toSemesterIndex) return
        setSemesters((prev) => {
            const slot = prev[fromSemesterIndex]?.coreSlots.find((s) => s.id === slotId)
            if (!slot) return prev
            const next = prev.map((s, i) => {
                if (i === fromSemesterIndex) return { ...s, coreSlots: s.coreSlots.filter((cs) => cs.id !== slotId) }
                if (i === toSemesterIndex) return { ...s, coreSlots: [...s.coreSlots, slot] }
                return s
            })
            scheduleAutosave(next)
            return next
        })
    }, [])

    const removeCoreSlot = useCallback((slotId) => {
        setSemesters((prev) => {
            const next = prev.map((s) => ({
                ...s,
                coreSlots: s.coreSlots.filter((cs) => cs.id !== slotId),
            }))
            scheduleAutosave(next)
            return next
        })
    }, [])

    const assignCoreSlot = useCallback((slotId, courseId) => {
        setSemesters((prev) => {
            const next = prev.map((s) => ({
                ...s,
                coreSlots: s.coreSlots.map((cs) =>
                    cs.id === slotId ? { ...cs, assignedCourseId: courseId } : cs
                ),
            }))
            scheduleAutosave(next)
            return next
        })
    }, [])

    const addCoreSlot = useCallback((slot, semesterIndex) => {
        const newSlot = {
            id: `coreSlot-added-${Date.now()}`,
            label: slot.label,
            credits: slot.credits ?? 3,
            assignedCourseId: slot.assignedCourseId ?? null,
        }
        setSemesters((prev) => {
            const next = prev.map((s, i) =>
                i === semesterIndex
                    ? { ...s, coreSlots: [...s.coreSlots, newSlot] }
                    : s
            )
            scheduleAutosave(next)
            return next
        })
    }, [])

    const removeCourse = useCallback((courseId) => {
        setSemesters((prev) => {
            const next = prev.map((s) => ({
                ...s,
                courseIds: s.courseIds.filter((id) => id !== courseId),
            }))
            scheduleAutosave(next)
            return next
        })
    }, [])

    const addCourse = useCallback((courseId, semesterIndex) => {
        setSemesters((prev) => {
            const next = prev.map((s) => ({
                ...s,
                courseIds: s.courseIds.filter((id) => id !== courseId),
            }))
            next[semesterIndex] = {
                ...next[semesterIndex],
                courseIds: [...next[semesterIndex].courseIds, courseId],
            }
            scheduleAutosave(next)
            return next
        })
    }, [])

    return {
        semesters,
        saveStatus,
        initialized,
        moveCourse,
        moveCoreSlot,
        removeCoreSlot,
        assignCoreSlot,
        addCoreSlot,
        removeCourse,
        addCourse,
        resetToSuggested,
        saveNow,
    }
}