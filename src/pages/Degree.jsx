import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  fetchDegrees,
  fetchDegreeRequirements,
  fetchCourses,
  fetchCompletedCourses,
  toggleCompletedCourse,
  courseMap,
} from '../lib/db'
import { prereqsMet, degreeProgress, groupProgress } from '../lib/progress'
import CourseCard from '../components/CourseCard'
import ProgressBar from '../components/ProgressBar'

export default function Degree() {
  const { user } = useAuth()

  const [degrees, setDegrees] = useState([])
  const [selectedDegreeId, setSelectedDegreeId] = useState(null)
  const [groups, setGroups] = useState([])
  const [courses, setCourses] = useState({})
  const [completedSet, setCompletedSet] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [groupsLoading, setGroupsLoading] = useState(false)

  // Load degree list once on mount
  useEffect(() => {
    fetchDegrees().then((data) => {
      setDegrees(data)
      // Default to Computer Science if available
      const cs = data.find((d) => d.id === 'COMPUTER_SCIENCE')
      setSelectedDegreeId(cs?.id ?? data[0]?.id ?? null)
      setLoading(false)
    })
  }, [])

  // Load completed courses when user changes
  useEffect(() => {
    if (!user) { setCompletedSet(new Set()); return }
    fetchCompletedCourses(user.id).then(setCompletedSet)
  }, [user])

  // Load requirement groups when selected degree changes
  useEffect(() => {
    if (!selectedDegreeId) return
    setGroupsLoading(true)

    fetchDegreeRequirements(selectedDegreeId).then(async (groups) => {
      setGroups(groups)

      // Collect all course IDs across groups and fetch them
      const allIds = [...new Set(groups.flatMap((g) => g.courses))]
      if (allIds.length) {
        const courseList = await fetchCourses(allIds)
        setCourses(courseMap(courseList))
      } else {
        setCourses({})
      }
      setGroupsLoading(false)
    })
  }, [selectedDegreeId])

  const handleToggle = useCallback(async (courseId) => {
    if (!user) return
    const wasCompleted = completedSet.has(courseId)
    // Optimistic update
    setCompletedSet((prev) => {
      const next = new Set(prev)
      wasCompleted ? next.delete(courseId) : next.add(courseId)
      return next
    })
    const ok = await toggleCompletedCourse(user.id, courseId, wasCompleted)
    // Revert if failed
    if (!ok) {
      setCompletedSet((prev) => {
        const next = new Set(prev)
        wasCompleted ? next.add(courseId) : next.delete(courseId)
        return next
      })
    }
  }, [user, completedSet])

  const selectedDegree = degrees.find((d) => d.id === selectedDegreeId)
  const allRequiredCourses = groups
    .filter((g) => !g.elective && !g.choose_one)
    .flatMap((g) => g.courses)
  const overallCompleted = allRequiredCourses.filter((id) => completedSet.has(id)).length
  const overallTotal = allRequiredCourses.length

  if (loading) {
    return <div className="text-gray-400 text-sm py-12 text-center">Loading degrees...</div>
  }

  return (
    <div>
      {/* Header row */}
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <h1 className="text-2xl font-bold text-fus-green-700">Degree Requirements</h1>
        <select
          value={selectedDegreeId ?? ''}
          onChange={(e) => setSelectedDegreeId(e.target.value)}
          className="ml-auto border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-fus-gold-400"
        >
          {degrees.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </div>

      {/* Degree meta */}
      {selectedDegree && (
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          {selectedDegree.total_credits && (
            <span className="text-xs bg-fus-green-50 border border-fus-green-200 text-fus-green-700 rounded-full px-3 py-1">
              {selectedDegree.total_credits} credit hours
            </span>
          )}
          {selectedDegree.tier === 1 && (
            <span className="text-xs bg-fus-gold-50 border border-fus-gold-200 text-fus-gold-700 rounded-full px-3 py-1">
              ★ Hand-curated
            </span>
          )}
          {selectedDegree.tier === 2 && (
            <span className="text-xs bg-gray-50 border border-gray-200 text-gray-500 rounded-full px-3 py-1">
              Auto-generated — verify with your advisor
            </span>
          )}
          {selectedDegree.catalog_url && (
            <a
              href={selectedDegree.catalog_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-fus-green-600 hover:underline ml-auto"
            >
              View in catalog ↗
            </a>
          )}
        </div>
      )}

      {/* Overall progress */}
      {user && overallTotal > 0 && (
        <div className="mb-8 p-4 rounded-xl bg-fus-green-50 border border-fus-green-100">
          <ProgressBar
            label="Overall required courses"
            completed={overallCompleted}
            total={overallTotal}
            color="bg-fus-green-500"
          />
        </div>
      )}

      {!user && (
        <p className="mb-6 text-sm text-gray-400 italic">
          Sign in to check off completed courses and track your progress.
        </p>
      )}

      {groupsLoading && (
        <div className="text-gray-400 text-sm py-8 text-center">Loading requirements...</div>
      )}

      {/* Requirement groups */}
      {!groupsLoading && groups.map((group) => {
        const gp = groupProgress(
          { type: group.elective ? 'elective' : 'required', courses: group.courses },
          completedSet
        )

        return (
          <section key={group.id} className="mb-10">
            <div className="flex items-baseline justify-between mb-1">
              <h2 className="text-base font-semibold text-fus-green-800">{group.label}</h2>
              {!group.elective && user && group.courses.length > 0 && (
                <span className="text-xs text-gray-400">
                  {gp.completed}/{gp.total} completed
                </span>
              )}
              {group.elective && group.elective_count && (
                <span className="text-xs text-gray-400">
                  Choose {group.elective_count}
                </span>
              )}
            </div>

            {group.choose_one && (
              <p className="text-xs text-fus-gold-600 mb-2 font-medium">
                Choose one of the following
              </p>
            )}

            {!group.elective && user && group.courses.length > 0 && (
              <div className="mb-3">
                <ProgressBar
                  label=""
                  completed={gp.completed}
                  total={gp.total}
                  color="bg-fus-green-400"
                  showFraction={false}
                />
              </div>
            )}

            {group.courses.length > 0 ? (
              <div className="flex flex-col gap-2">
                {group.courses.map((courseId) => {
                  const course = courses[courseId]
                  if (!course) return (
                    <div key={courseId} className="text-xs text-gray-400 font-mono px-2">
                      {courseId}
                    </div>
                  )
                  return (
                    <CourseCard
                      key={courseId}
                      course={course}
                      allCourses={Object.values(courses)}
                      completed={completedSet.has(courseId)}
                      prereqsMet={prereqsMet(course, completedSet)}
                      onToggle={handleToggle}
                      showToggle={!!user}
                    />
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic">
                {group.elective_count
                  ? `Choose ${group.elective_count} course${group.elective_count > 1 ? 's' : ''} from any qualifying options — consult your advisor.`
                  : 'Elective requirement — consult your advisor for approved options.'}
              </p>
            )}
          </section>
        )
      })}
    </div>
  )
}
