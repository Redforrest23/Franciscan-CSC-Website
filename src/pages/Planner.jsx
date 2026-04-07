import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  fetchDegrees,
  fetchSemesterPlans,
  fetchCourses,
  fetchCompletedCourses,
  fetchPriorCourses,
  fetchIgnoredWarnings,
  fetchPlannerPreferences,
  savePlannerPreferences,
  toggleIgnoredWarning,
  courseMap,
  hasAustriaPlan,
  fetchSelectedMinors,
  fetchMinors,
  fetchMinorRequirements,
} from '../lib/db'
import { DndContext, DragOverlay, pointerWithin } from '@dnd-kit/core'
import CourseCard from '../components/CourseCard'
import SemesterColumn from '../components/SemesterColumn'
import PriorCoursesModal from '../components/PriorCoursesModal'
import { usePlannedCourses } from '../hooks/usePlannedCourses'

const HONORS_MAP = [
  { semesterIndex: 0, courseId: 'HON101', replaces: ['literature', 'history'] },
  { semesterIndex: 1, courseId: 'HON102', replaces: ['literature', 'philosophy'] },
  { semesterIndex: 2, courseId: 'HON201', replaces: ['history', 'the 110', 'theology'] },
  { semesterIndex: 3, courseId: 'HON202', replaces: ['literature', 'history'] },
  { semesterIndex: 4, courseId: 'HON301', replaces: ['history', 'philosophy'] },
  { semesterIndex: 5, courseId: 'HON302', replaces: ['american founding', 'economics', 'social science'] },
  { semesterIndex: 6, courseId: 'HON401', replaces: ['american founding', 'philosophy', 'social science'] },
  { semesterIndex: 7, courseId: 'HON402', replaces: ['philosophy', 'social science'] },
]

const HONORS_DOES_NOT_REPLACE = ['fine arts', 'natural science', 'the 101', 'the 115', 'lab']

function slotIsReplacedByHonors(slotLabel, replaces) {
  const lower = slotLabel.toLowerCase()
  if (HONORS_DOES_NOT_REPLACE.some((k) => lower.includes(k))) return false
  return replaces.some((k) => lower.includes(k))
}

const SEMESTER_LABELS = [
  'Freshman Fall', 'Freshman Spring',
  'Sophomore Fall', 'Sophomore Spring',
  'Junior Fall', 'Junior Spring',
  'Senior Fall', 'Senior Spring',
]

const CORE_DEPARTMENTS = ['HST', 'POL', 'ENG', 'PHL', 'THE', 'ECO', 'SOC', 'PSY', 'ART', 'MUS', 'BIO', 'CHM', 'PHY', 'SCI']

export default function Planner() {
  const { user } = useAuth()

  const [degrees, setDegrees] = useState([])
  const [selectedDegreeId, setSelectedDegreeId] = useState(null)
  const [suggestedPlans, setSuggestedPlans] = useState([])
  const [courses, setCourses] = useState({})
  const [allCoursesForDropdown, setAllCoursesForDropdown] = useState([])
  const [completedSet, setCompletedSet] = useState(new Set())
  const [priorCourses, setPriorCourses] = useState([])
  const [ignoredWarnings, setIgnoredWarnings] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [plansLoading, setPlansLoading] = useState(false)
  const [prefsLoaded, setPrefsLoaded] = useState(false)

  const [viewMode, setViewMode] = useState('suggested')
  const [honorsMode, setHonorsMode] = useState(false)
  const [austriaMode, setAustriaMode] = useState(false)
  const [hasAustria, setHasAustria] = useState(false)
  const [startingSemester, setStartingSemester] = useState(0)

  const [activeDragId, setActiveDragId] = useState(null)
  const [activeDragType, setActiveDragType] = useState(null)
  const [sidebarSearch, setSidebarSearch] = useState('')
  const [priorModalSemester, setPriorModalSemester] = useState(null)
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  // Minor course pool: [{minorName, courseIds}]
  const [minorCoursePool, setMinorCoursePool] = useState([])

  const {
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
  } = usePlannedCourses(user?.id, selectedDegreeId, suggestedPlans, courses)

  const priorSet = new Set(priorCourses.map((p) => p.course_id).filter(Boolean))

  // Load degrees
  useEffect(() => {
    fetchDegrees().then((data) => {
      setDegrees(data)
      const cs = data.find((d) => d.id === 'COMPUTER_SCIENCE')
      setSelectedDegreeId(cs?.id ?? data[0]?.id ?? null)
      setLoading(false)
    })
  }, [])

  // Load core-eligible courses for slot dropdowns
  useEffect(() => {
    fetchCourses().then((all) => {
      setAllCoursesForDropdown(
        all.filter((c) =>
          CORE_DEPARTMENTS.some((dept) => c.id?.startsWith(dept) || c.code?.startsWith(dept))
        )
      )
    })
  }, [])

  // Load user data + preferences
  useEffect(() => {
    if (!user) {
      setCompletedSet(new Set())
      setPriorCourses([])
      setIgnoredWarnings(new Set())
      setPrefsLoaded(true)
      return
    }

    fetchCompletedCourses(user.id).then(setCompletedSet)
    fetchPriorCourses(user.id).then(setPriorCourses)
    fetchIgnoredWarnings(user.id).then((rows) => {
      setIgnoredWarnings(new Set(rows.map((r) => `${r.course_id}:${r.warning_type}`)))
    })

    fetchPlannerPreferences(user.id).then((prefs) => {
      if (prefs.austriaMode !== undefined) setAustriaMode(prefs.austriaMode)
      if (prefs.honorsMode !== undefined) setHonorsMode(prefs.honorsMode)
      if (prefs.startingSemester !== undefined) setStartingSemester(prefs.startingSemester)
      setPrefsLoaded(true)
    })
  }, [user])

  // Load saved minors for the course pool
  useEffect(() => {
    if (!user) { setMinorCoursePool([]); return }
    fetchSelectedMinors(user.id).then(async (minorIds) => {
      if (!minorIds.length) { setMinorCoursePool([]); return }
      const [minorsList, ...groupsArr] = await Promise.all([
        fetchMinors(),
        ...minorIds.map((id) => fetchMinorRequirements(id)),
      ])
      const pools = minorIds.map((minorId, i) => {
        const minor = minorsList.find((m) => m.id === minorId)
        const groups = groupsArr[i] ?? []
        const courseIds = [...new Set(groups.flatMap((g) => g.courses ?? []))]
        return { minorName: minor?.name ?? minorId, courseIds }
      })
      setMinorCoursePool(pools)

      // Load those courses into the courses map
      const allIds = [...new Set(pools.flatMap((p) => p.courseIds))]
      if (allIds.length) {
        fetchCourses(allIds).then((list) =>
          setCourses((prev) => ({ ...prev, ...courseMap(list) }))
        )
      }
    })
  }, [user])

  // Persist preferences whenever they change (after initial load)
  useEffect(() => {
    if (!user || !prefsLoaded) return
    savePlannerPreferences(user.id, { austriaMode, honorsMode, startingSemester })
  }, [austriaMode, honorsMode, startingSemester, user, prefsLoaded])

  // Load semester plans when degree changes
  useEffect(() => {
    if (!selectedDegreeId) return
    setPlansLoading(true)

    Promise.all([
      fetchSemesterPlans(selectedDegreeId, austriaMode ? 'austria' : null),
      hasAustriaPlan(selectedDegreeId),
    ]).then(async ([plans, austriaAvailable]) => {
      setHasAustria(austriaAvailable)
      setSuggestedPlans(plans)
      await loadCoursesForPlans(plans)
      setPlansLoading(false)
    })
  }, [selectedDegreeId])

  // Reload plans when Austria mode changes
  useEffect(() => {
    if (!selectedDegreeId) return
    setPlansLoading(true)
    fetchSemesterPlans(selectedDegreeId, austriaMode ? 'austria' : null).then(async (plans) => {
      setSuggestedPlans(plans)
      await loadCoursesForPlans(plans)
      setPlansLoading(false)
    })
  }, [austriaMode])

  async function loadCoursesForPlans(plans) {
    const allIds = [...new Set([
      ...plans.flatMap((p) => p.entries.map((e) => e.course_id).filter(Boolean)),
      ...HONORS_MAP.map((h) => h.courseId),
    ])]
    if (allIds.length) {
      const courseList = await fetchCourses(allIds)
      setCourses(courseMap(courseList))
    } else {
      setCourses({})
    }
  }

  async function handleToggleIgnore(courseId, warningType, currentlyIgnored) {
    if (!user) return
    const key = `${courseId}:${warningType}`
    setIgnoredWarnings((prev) => {
      const next = new Set(prev)
      currentlyIgnored ? next.delete(key) : next.add(key)
      return next
    })
    const ok = await toggleIgnoredWarning(user.id, courseId, warningType, currentlyIgnored)
    if (!ok) {
      setIgnoredWarnings((prev) => {
        const next = new Set(prev)
        currentlyIgnored ? next.add(key) : next.delete(key)
        return next
      })
    }
  }

  const selectedDegree = degrees.find((d) => d.id === selectedDegreeId)
  const termLabel = (semester) => (semester === 1 ? 'Fall' : 'Spring')

  const allSemestersSorted = suggestedPlans
    .slice()
    .sort((a, b) => a.year !== b.year ? a.year - b.year : a.semester - b.semester)

  const byYear = [1, 2, 3, 4].map((year) => ({
    year,
    semesters: allSemestersSorted.filter((p) => p.year === year),
  }))

  function getSemesterIndex(plan) {
    return allSemestersSorted.findIndex((p) => p.id === plan.id)
  }

  function applyHonors(plan, semesterIndex) {
    const honorsEntry = HONORS_MAP.find((h) => h.semesterIndex === semesterIndex)
    if (!honorsEntry) return plan.entries
    const entries = []
    let honorsAdded = false
    let lastCoreSlotIndex = -1
    plan.entries.forEach((entry, i) => {
      if (!entry.course_id) {
        const lower = (entry.core_slot_label ?? '').toLowerCase()
        if (!HONORS_DOES_NOT_REPLACE.some((k) => lower.includes(k))) lastCoreSlotIndex = i
      }
    })
    for (let i = 0; i < plan.entries.length; i++) {
      const entry = plan.entries[i]
      if (entry.course_id) {
        entries.push(entry)
      } else {
        const lower = (entry.core_slot_label ?? '').toLowerCase()
        const isProtected = HONORS_DOES_NOT_REPLACE.some((k) => lower.includes(k))
        if (!honorsAdded && !isProtected && slotIsReplacedByHonors(entry.core_slot_label ?? '', honorsEntry.replaces)) {
          entries.push({ course_id: honorsEntry.courseId, _isHonors: true })
          honorsAdded = true
        } else if (!honorsAdded && !isProtected && i === lastCoreSlotIndex) {
          entries.push({ course_id: honorsEntry.courseId, _isHonors: true })
          honorsAdded = true
        } else {
          entries.push(entry)
        }
      }
    }
    if (!honorsAdded) entries.push({ course_id: honorsEntry.courseId, _isHonors: true })
    return entries
  }

  function handleDragStart(event) {
    const type = event.active.data?.current?.type === 'coreSlot' ? 'coreSlot' : 'course'
    setActiveDragType(type)
    setActiveDragId(event.active.id)
  }

  function handleDragEnd(event) {
    setActiveDragId(null)
    setActiveDragType(null)
    const { active, over } = event
    if (!over) return
    const targetSemesterIndex = over.data?.current?.semesterIndex
    if (targetSemesterIndex === undefined) return
    if (active.data?.current?.type === 'coreSlot') {
      moveCoreSlot(active.data.current.slotId, active.data.current.fromSemester, targetSemesterIndex)
    } else {
      moveCourse(active.id, targetSemesterIndex)
    }
  }

  const allDegreeCourseIds = [...new Set(
    suggestedPlans.flatMap((p) => p.entries.filter((e) => e.course_id).map((e) => e.course_id))
  )]
  const placedCourseIds = new Set(semesters.flatMap((s) => s.courseIds))

  const sidebarCourses = allDegreeCourseIds
    .map((id) => courses[id])
    .filter(Boolean)
    .filter((c) =>
      !sidebarSearch ||
      c.code?.toLowerCase().includes(sidebarSearch.toLowerCase()) ||
      c.title?.toLowerCase().includes(sidebarSearch.toLowerCase())
    )

  const allCoreSlotLabels = (() => {
    const seen = new Set()
    const slots = []
    suggestedPlans.forEach((plan, planIndex) => {
      plan.entries
        .filter((e) => !e.course_id && e.core_slot_label)
        .forEach((e, slotIdx) => {
          if (!seen.has(e.core_slot_label)) {
            seen.add(e.core_slot_label)
            slots.push({
              id: `coreSlot-${planIndex}-${slotIdx}`,
              label: e.core_slot_label,
              credits: e.core_slot_credits ?? 3,
              assignedCourseId: null,
            })
          }
        })
    })
    return slots.filter((slot) =>
      !sidebarSearch || slot.label.toLowerCase().includes(sidebarSearch.toLowerCase())
    )
  })()

  function renderToggles() {
    return (
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <button onClick={() => setHonorsMode(false)} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${!honorsMode ? 'bg-fus-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Standard</button>
        <button onClick={() => setHonorsMode(true)} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${honorsMode ? 'bg-fus-gold-400 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>🎓 Honors</button>
        {hasAustria && (
          <>
            <div className="w-px h-5 bg-gray-300" />
            <button onClick={() => setAustriaMode(false)} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${!austriaMode ? 'bg-fus-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Standard Plan</button>
            <button onClick={() => setAustriaMode(true)} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${austriaMode ? 'bg-fus-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>✈️ Austria Plan</button>
          </>
        )}
        {honorsMode && (
          <span className="text-xs text-fus-gold-700 bg-fus-gold-50 border border-fus-gold-200 rounded-full px-3 py-1 ml-auto">
            Max 19 cr/semester · Must maintain 3.0 GPA
          </span>
        )}
      </div>
    )
  }

  if (loading) return <div className="text-gray-400 text-sm py-12 text-center">Loading...</div>

  return (
    <div>
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <h1 className="text-2xl font-bold text-fus-green-700">4-Year Planner</h1>
        <select value={selectedDegreeId ?? ''} onChange={(e) => setSelectedDegreeId(e.target.value)} className="ml-auto border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-fus-gold-400">
          {degrees.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <button onClick={() => setViewMode('suggested')} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${viewMode === 'suggested' ? 'bg-fus-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Suggested Plan</button>
        {user ? (
          <button onClick={() => setViewMode('my-plan')} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${viewMode === 'my-plan' ? 'bg-fus-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>My Plan</button>
        ) : (
          <span className="text-xs text-gray-400 italic">Sign in to build your personal plan</span>
        )}
      </div>

      {renderToggles()}

      {honorsMode && (
        <div className="mb-4 p-3 rounded-lg bg-fus-gold-50 border border-fus-gold-200 text-sm text-fus-gold-800">
          <strong>Honors Program:</strong> HON 101–402 replace select core slots (one per semester). Does <strong>not</strong> cover: Catholic Traditions in Fine Arts, Natural Science, THE 101, or THE 115.
        </div>
      )}
      {selectedDegree?.tier === 2 && (
        <div className="mb-4 p-3 rounded-lg bg-fus-gold-50 border border-fus-gold-200 text-sm text-fus-gold-800">
          This plan was auto-generated based on prerequisite ordering. Always verify with your academic advisor.
        </div>
      )}

      {viewMode === 'my-plan' && (
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Starting semester:</label>
            <select value={startingSemester} onChange={(e) => setStartingSemester(Number(e.target.value))} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-fus-gold-400">
              {SEMESTER_LABELS.map((label, i) => <option key={i} value={i}>{label}</option>)}
            </select>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {saveStatus === 'saving' && <span className="text-xs text-gray-400">Saving...</span>}
            {saveStatus === 'saved' && <span className="text-xs text-fus-green-600">✓ Saved</span>}
            {saveStatus === 'error' && <span className="text-xs text-red-500">Save failed — try again</span>}
            <button
              onClick={saveNow}
              disabled={saveStatus === 'saving'}
              className="text-xs bg-fus-green-600 text-white border border-fus-green-600 rounded-lg px-3 py-1.5 hover:bg-fus-green-700 transition-colors disabled:opacity-50"
            >
              {saveStatus === 'saving' ? 'Saving...' : 'Save plan'}
            </button>
            <button onClick={() => setShowResetConfirm(true)} className="text-xs text-gray-500 border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors">
              Reset to suggested
            </button>
          </div>
        </div>
      )}

      <p className="text-sm text-gray-500 mb-6">
        {viewMode === 'suggested'
          ? <><strong>{selectedDegree?.name}</strong> recommended sequence. Your actual schedule may vary.</>
          : <>Build your personal plan. Drag courses and core slots between semesters. Use ✕ to remove, or assign a course to any core slot.</>
        }
        {austriaMode && ' This plan accounts for a semester abroad in Gaming, Austria.'}
      </p>

      {plansLoading && <div className="text-gray-400 text-sm py-8 text-center">Loading plan...</div>}

      {/* ── Suggested Plan ── */}
      {!plansLoading && viewMode === 'suggested' && (
        <>
          {suggestedPlans.length === 0 && <div className="text-gray-400 text-sm py-8 text-center">No semester plan available for this degree yet.</div>}
          {byYear.map(({ year, semesters: yearSems }) =>
            yearSems.length === 0 ? null : (
              <div key={year} className="mb-10">
                <h2 className="text-lg font-bold text-fus-green-800 mb-4 border-b border-fus-green-100 pb-2">Year {year}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {yearSems.map((plan) => {
                    const semIndex = getSemesterIndex(plan)
                    const entries = honorsMode ? applyHonors(plan, semIndex) : plan.entries
                    const semesterCredits = entries.reduce((sum, e) => e.course_id ? sum + (courses[e.course_id]?.credits ?? 4) : sum + (e.core_slot_credits ?? 3), 0)
                    const overloaded = semesterCredits > (honorsMode ? 19 : 18)
                    return (
                      <div key={plan.id}>
                        <div className="flex items-baseline justify-between mb-3">
                          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{plan.label ?? termLabel(plan.semester)}</h3>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${overloaded ? 'text-red-600 bg-red-50 border border-red-200' : 'text-gray-400'}`}>{semesterCredits} cr {overloaded ? '⚠ overloaded' : ''}</span>
                        </div>
                        {plan.austria_semester && (
                          <div className="mb-3 p-2.5 rounded-lg bg-fus-green-50 border border-fus-green-200 text-xs text-fus-green-700">🌍 {plan.austria_note}</div>
                        )}
                        <div className="flex flex-col gap-2">
                          {entries.map((entry, i) => {
                            if (entry.course_id) {
                              const course = courses[entry.course_id]
                              if (!course) return <div key={i} className="text-xs text-gray-400 font-mono px-2">{entry.course_id}</div>
                              return (
                                <div key={i} className="relative">
                                  {entry._isHonors && <span className="absolute -top-2 -right-2 z-10 text-xs bg-fus-gold-400 text-white rounded-full px-2 py-0.5">Honors</span>}
                                  <CourseCard course={course} allCourses={Object.values(courses)} completed={completedSet.has(course.id)} prereqsMet={true} showToggle={false} />
                                </div>
                              )
                            }
                            return (
                              <div key={i} className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-3">
                                <p className="text-xs text-gray-500 italic">{entry.core_slot_label}</p>
                                {entry.core_slot_credits && <p className="text-xs text-gray-400 mt-0.5">{entry.core_slot_credits} cr</p>}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          )}
        </>
      )}

      {/* ── My Plan ── */}
      {!plansLoading && viewMode === 'my-plan' && initialized && (
        <DndContext collisionDetection={pointerWithin} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex gap-6">

            {/* Sidebar */}
            <div className="w-56 flex-shrink-0">
              <div className="sticky top-4">
                <input
                  type="text"
                  placeholder="Search courses..."
                  value={sidebarSearch}
                  onChange={(e) => setSidebarSearch(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs mb-3 focus:outline-none focus:ring-2 focus:ring-fus-gold-400"
                />
                <div className="flex flex-col gap-1.5 max-h-[70vh] overflow-y-auto pr-1">

                  {/* ── Major ── */}
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    Major
                  </p>
                  {sidebarCourses.map((course) => {
                    const isPlaced = placedCourseIds.has(course.id)
                    const isDone = completedSet.has(course.id) || priorSet.has(course.id)
                    return (
                      <div key={course.id} className={`rounded-lg border px-2.5 py-2 transition-colors ${isDone ? 'border-fus-green-200 bg-fus-green-50 opacity-50' : isPlaced ? 'border-gray-200 bg-gray-50 opacity-60' : 'border-gray-200 bg-white'}`}>
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-mono text-xs font-bold text-fus-green-600">{course.code}</span>
                          <span className="text-xs text-gray-400">{course.credits} cr</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 leading-snug truncate">{course.title}</p>
                        {!isDone && !isPlaced && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {semesters.map((sem, i) => (
                              <button key={i} onClick={() => addCourse(course.id, i)}
                                className="text-xs text-fus-green-600 bg-fus-green-50 border border-fus-green-200 rounded px-1.5 py-0.5 hover:bg-fus-green-100 transition-colors"
                                title={`Add to ${sem.label}`}>
                                Y{sem.year}{sem.term === 'fall' ? 'F' : 'S'}
                              </button>
                            ))}
                          </div>
                        )}
                        {isPlaced && !isDone && <p className="text-xs text-gray-400 mt-1 italic">Already placed</p>}
                      </div>
                    )
                  })}

                  {/* ── Core Slots ── */}
                  {allCoreSlotLabels.length > 0 && (
                    <>
                      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mt-3 mb-1 px-1">Core Slots</div>
                      {allCoreSlotLabels.map((slot, i) => (
                        <div key={i} className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-2.5 py-2">
                          <p className="text-xs text-gray-500 italic">{slot.label}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{slot.credits} cr</p>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {semesters.map((sem, si) => (
                              <button key={si} onClick={() => addCoreSlot({ label: slot.label, credits: slot.credits, assignedCourseId: null }, si)}
                                className="text-xs text-gray-500 bg-gray-100 border border-gray-200 rounded px-1.5 py-0.5 hover:bg-gray-200 transition-colors"
                                title={`Add to ${sem.label}`}>
                                Y{sem.year}{sem.term === 'fall' ? 'F' : 'S'}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </>
                  )}

                  {/* ── Minors ── */}
                  {minorCoursePool.map(({ minorName, courseIds }) => {
                    const filtered = courseIds
                      .map((id) => courses[id])
                      .filter(Boolean)
                      .filter((c) =>
                        !sidebarSearch ||
                        c.code?.toLowerCase().includes(sidebarSearch.toLowerCase()) ||
                        c.title?.toLowerCase().includes(sidebarSearch.toLowerCase())
                      )
                    if (!filtered.length) return null
                    return (
                      <div key={minorName}>
                        <div className="text-xs font-semibold text-fus-gold-700 uppercase tracking-wide mt-4 mb-1 px-1 border-t border-fus-gold-100 pt-3">
                          Minor: {minorName}
                        </div>
                        {filtered.map((course) => {
                          const isPlaced = placedCourseIds.has(course.id)
                          const isDone = completedSet.has(course.id) || priorSet.has(course.id)
                          return (
                            <div key={course.id} className={`rounded-lg border px-2.5 py-2 transition-colors mb-1.5 ${isDone ? 'border-fus-gold-200 bg-fus-gold-50 opacity-50' : isPlaced ? 'border-gray-200 bg-gray-50 opacity-60' : 'border-fus-gold-200 bg-fus-gold-50'}`}>
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-mono text-xs font-bold text-fus-gold-700">{course.code}</span>
                                <span className="text-xs text-gray-400">{course.credits} cr</span>
                              </div>
                              <p className="text-xs text-gray-500 mt-0.5 leading-snug truncate">{course.title}</p>
                              {!isDone && !isPlaced && (
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                  {semesters.map((sem, i) => (
                                    <button key={i} onClick={() => addCourse(course.id, i)}
                                      className="text-xs text-fus-gold-700 bg-fus-gold-100 border border-fus-gold-200 rounded px-1.5 py-0.5 hover:bg-fus-gold-200 transition-colors"
                                      title={`Add to ${sem.label}`}>
                                      Y{sem.year}{sem.term === 'fall' ? 'F' : 'S'}
                                    </button>
                                  ))}
                                </div>
                              )}
                              {isPlaced && !isDone && <p className="text-xs text-gray-400 mt-1 italic">Already placed</p>}
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}

                  {/* No minors message */}
                  {user && minorCoursePool.length === 0 && (
                    <p className="text-xs text-gray-400 italic mt-4 px-1">
                      Add minors on the Minors page to see their courses here.
                    </p>
                  )}

                </div>
              </div>
            </div>

            {/* Semester grid */}
            <div className="flex-1 grid grid-cols-2 gap-4">
              {semesters.map((sem, i) => (
                <SemesterColumn
                  key={i}
                  semester={sem}
                  semesterIndex={i}
                  allSemesters={semesters}
                  courses={courses}
                  allCoursesForDropdown={allCoursesForDropdown}
                  completedSet={completedSet}
                  priorSet={priorSet}
                  honorsMode={honorsMode}
                  isPast={i < startingSemester}
                  onRemove={removeCourse}
                  onRemoveCoreSlot={removeCoreSlot}
                  onAssignCoreSlot={assignCoreSlot}
                  onOpenPrior={(idx) => setPriorModalSemester(idx)}
                  ignoredWarnings={ignoredWarnings}
                  onToggleIgnore={handleToggleIgnore}
                />
              ))}
            </div>
          </div>

          <DragOverlay>
            {activeDragId && activeDragType === 'course' && courses[activeDragId] && (
              <div className="rounded-lg border border-fus-green-300 bg-white shadow-lg px-3 py-2 text-xs font-bold text-fus-green-700">{courses[activeDragId].code}</div>
            )}
            {activeDragId && activeDragType === 'coreSlot' && (
              <div className="rounded-lg border border-dashed border-fus-gold-400 bg-fus-gold-50 shadow-lg px-3 py-2 text-xs text-fus-gold-700 italic">Core slot</div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {priorModalSemester !== null && (
        <PriorCoursesModal
          userId={user?.id}
          semesterLabel={semesters[priorModalSemester]?.label ?? SEMESTER_LABELS[priorModalSemester]}
          semesterIndex={priorModalSemester}
          allCourses={Object.values(courses)}
          existingPrior={priorCourses.filter((p) => p.semester_label === (semesters[priorModalSemester]?.label ?? SEMESTER_LABELS[priorModalSemester]))}
          onClose={() => setPriorModalSemester(null)}
          onSaved={(ids) => {
            setPriorCourses((prev) => [
              ...prev.filter((p) => p.semester_label !== semesters[priorModalSemester]?.label),
              ...ids.map((id) => ({ course_id: id, semester_label: semesters[priorModalSemester]?.label })),
            ])
          }}
        />
      )}

      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full">
            <h3 className="font-bold text-gray-900 mb-2">Reset to suggested plan?</h3>
            <p className="text-sm text-gray-500 mb-6">This will replace your current personal plan with the recommended sequence. Your completed courses won't be affected.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowResetConfirm(false)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Cancel</button>
              <button onClick={() => { resetToSuggested(); setShowResetConfirm(false) }} className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600">Reset</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
