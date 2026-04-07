import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  fetchCompletedCourses,
  fetchSelectedMinors,
  toggleSelectedMinor,
  fetchCourses,
  fetchDegrees,
  fetchMinors,
  fetchMinorRequirements,
  courseMap,
} from '../lib/db'
import { groupProgress } from '../lib/progress'
import CourseCard from '../components/CourseCard'
import ProgressBar from '../components/ProgressBar'
import MinorProgressCard from '../components/MinorProgressCard'

export default function Minors() {
  const { user } = useAuth()

  const [minorsData, setMinorsData] = useState([])
  const [selectedMinorId, setSelectedMinorId] = useState(null)
  const [requirementGroups, setRequirementGroups] = useState([])
  const [selectedDegreeId, setSelectedDegreeId] = useState('COMPUTER_SCIENCE')
  const [degrees, setDegrees] = useState([])
  const [completedSet, setCompletedSet] = useState(new Set())
  const [savedMinors, setSavedMinors] = useState([])
  const [savedMinorGroups, setSavedMinorGroups] = useState({})
  const [courses, setCourses] = useState({})
  const [loadingMinors, setLoadingMinors] = useState(true)
  const [loadingRequirements, setLoadingRequirements] = useState(false)

  const minor = minorsData.find((m) => m.id === selectedMinorId) ?? null

  // Load all minors from Supabase
  useEffect(() => {
    fetchMinors().then((data) => {
      setMinorsData(data)
      if (data.length) setSelectedMinorId(data[0].id)
      setLoadingMinors(false)
    })
  }, [])

  // Load degrees for the overlap selector
  useEffect(() => {
    fetchDegrees().then(setDegrees)
  }, [])

  // Load requirement groups whenever selected minor changes
  useEffect(() => {
    if (!selectedMinorId) return
    setLoadingRequirements(true)
    fetchMinorRequirements(selectedMinorId).then((groups) => {
      setRequirementGroups(groups)
      setLoadingRequirements(false)

      const allIds = [...new Set(groups.flatMap((g) => g.courses ?? []))]
      if (allIds.length) {
        fetchCourses(allIds).then((list) =>
          setCourses((prev) => ({ ...prev, ...courseMap(list) }))
        )
      }
    })
  }, [selectedMinorId])

  // Load user data
  useEffect(() => {
    if (!user) {
      setCompletedSet(new Set())
      setSavedMinors([])
      return
    }
    fetchCompletedCourses(user.id).then(setCompletedSet)
    fetchSelectedMinors(user.id).then(setSavedMinors)
  }, [user])

  // Fetch requirement groups for all saved minors (for progress cards)
  useEffect(() => {
    if (!savedMinors.length) return
    savedMinors.forEach((minorId) => {
      if (savedMinorGroups[minorId]) return
      fetchMinorRequirements(minorId).then((groups) => {
        setSavedMinorGroups((prev) => ({ ...prev, [minorId]: groups }))

        const allIds = [...new Set(groups.flatMap((g) => g.courses ?? []))]
        if (allIds.length) {
          fetchCourses(allIds).then((list) =>
            setCourses((prev) => ({ ...prev, ...courseMap(list) }))
          )
        }
      })
    })
  }, [savedMinors])

  async function handleToggleMinor(minorId) {
    if (!user) return
    const isSelected = savedMinors.includes(minorId)
    const ok = await toggleSelectedMinor(user.id, minorId, isSelected)
    if (ok) {
      setSavedMinors((prev) =>
        isSelected ? prev.filter((id) => id !== minorId) : [...prev, minorId]
      )
    }
  }

  const csCoreCourses = new Set([
    'CSC142', 'CSC144', 'CSC145', 'CSC204', 'CSC261', 'CSC265', 'CSC276',
    'CSC310', 'CSC344', 'CSC401', 'CSC438', 'CSC439', 'CSC335',
    'SFE128', 'SFE240', 'SFE305',
    'MTH161', 'MTH171', 'MTH172', 'MTH220', 'MTH320',
    'PHL212', 'SCI147', 'EGR102',
  ])

  const overlapIds = requirementGroups
    .flatMap((g) => g.courses ?? [])
    .filter((id) => csCoreCourses.has(id))

  if (loadingMinors) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400 text-sm">
        Loading minors...
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <h1 className="text-2xl font-bold text-fus-green-700">Minors</h1>

        <select
          value={selectedMinorId ?? ''}
          onChange={(e) => setSelectedMinorId(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-fus-gold-400"
        >
          {minorsData.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>

        <select
          value={selectedDegreeId}
          onChange={(e) => setSelectedDegreeId(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-fus-gold-400"
        >
          {degrees.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </div>

      {/* Saved minors summary */}
      {user && savedMinors.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            My Minors
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {savedMinors.map((minorId) => {
              const m = minorsData.find((x) => x.id === minorId)
              if (!m) return null
              return (
                <MinorProgressCard
                  key={minorId}
                  minor={m}
                  requirementGroups={savedMinorGroups[minorId] ?? []}
                  courses={courses}
                  completedSet={completedSet}
                  onRemove={() => handleToggleMinor(minorId)}
                />
              )
            })}
          </div>
        </div>
      )}

      {minor && (
        <>
          <div className="mb-6 p-4 rounded-xl bg-white border border-gray-200 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-fus-green-700">{minor.name}</h2>
                <p className="text-sm text-gray-500 mt-1">{minor.description}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {minor.total_credits} credits required
                </p>
              </div>
              {user && (
                <button
                  onClick={() => handleToggleMinor(minor.id)}
                  className={`text-sm px-4 py-2 rounded-lg border transition-all flex-shrink-0 ${savedMinors.includes(minor.id)
                      ? 'bg-fus-green-600 text-white border-fus-green-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-fus-green-400'
                    }`}
                >
                  {savedMinors.includes(minor.id) ? '✓ Added to my plan' : '+ Add to my plan'}
                </button>
              )}
            </div>

            {overlapIds.length > 0 && (
              <div className="mt-4 p-3 rounded-lg bg-fus-gold-50 border border-fus-gold-200 text-sm text-fus-gold-800">
                <strong>Double-count opportunity:</strong>{' '}
                {overlapIds.length} course{overlapIds.length > 1 ? 's' : ''} from this minor
                may also count toward your major:{' '}
                {overlapIds.map((id) => courses[id]?.code ?? id).join(', ')}
              </div>
            )}
          </div>

          {loadingRequirements ? (
            <div className="text-sm text-gray-400 italic py-4">Loading requirements...</div>
          ) : (
            requirementGroups.map((group) => {
              const gp = groupProgress(
                { type: group.elective ? 'elective' : 'required', courses: group.courses ?? [] },
                completedSet
              )

              return (
                <section key={group.id} className="mb-8">
                  <div className="flex items-baseline justify-between mb-2">
                    <h3 className="text-base font-semibold text-fus-green-800">{group.label}</h3>
                    {!group.elective && user && group.courses?.length > 0 && (
                      <span className="text-xs text-gray-400">
                        {gp.completed}/{gp.total} completed
                      </span>
                    )}
                  </div>

                  {!group.elective && user && group.courses?.length > 0 && (
                    <div className="mb-3">
                      <ProgressBar
                        label=""
                        completed={gp.completed}
                        total={gp.total}
                        color="bg-fus-gold-400"
                        showFraction={false}
                      />
                    </div>
                  )}

                  {group.courses && group.courses.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      {group.courses.map((courseId) => {
                        const course = courses[courseId]
                        const isOverlap = overlapIds.includes(courseId)
                        if (!course) return (
                          <div key={courseId} className="text-xs text-gray-400 font-mono px-2">
                            {courseId}
                          </div>
                        )
                        return (
                          <div key={courseId} className="relative">
                            {isOverlap && (
                              <span className="absolute -top-2 -right-2 z-10 text-xs bg-fus-gold-400 text-fus-green-900 font-semibold rounded-full px-2 py-0.5">
                                counts for major
                              </span>
                            )}
                            <CourseCard
                              course={course}
                              allCourses={Object.values(courses)}
                              completed={completedSet.has(courseId)}
                              prereqsMet={true}
                              showToggle={false}
                            />
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 italic">
                      Elective requirement — consult your advisor for approved course options.
                    </p>
                  )}
                </section>
              )
            })
          )}
        </>
      )}
    </div>
  )
}