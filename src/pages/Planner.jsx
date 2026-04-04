import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  fetchDegrees,
  fetchSemesterPlans,
  fetchCourses,
  fetchCompletedCourses,
  courseMap,
} from '../lib/db'
import CourseCard from '../components/CourseCard'

export default function Planner() {
  const { user } = useAuth()

  const [degrees, setDegrees] = useState([])
  const [selectedDegreeId, setSelectedDegreeId] = useState(null)
  const [plans, setPlans] = useState([])
  const [courses, setCourses] = useState({})
  const [completedSet, setCompletedSet] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [plansLoading, setPlansLoading] = useState(false)

  // Load degree list
  useEffect(() => {
    fetchDegrees().then((data) => {
      setDegrees(data)
      const cs = data.find((d) => d.id === 'COMPUTER_SCIENCE')
      setSelectedDegreeId(cs?.id ?? data[0]?.id ?? null)
      setLoading(false)
    })
  }, [])

  // Load completed courses
  useEffect(() => {
    if (!user) { setCompletedSet(new Set()); return }
    fetchCompletedCourses(user.id).then(setCompletedSet)
  }, [user])

  // Load semester plans when degree changes
  useEffect(() => {
    if (!selectedDegreeId) return
    setPlansLoading(true)

    fetchSemesterPlans(selectedDegreeId).then(async (plans) => {
      setPlans(plans)

      const allCourseIds = [...new Set(
        plans.flatMap((p) => p.entries.map((e) => e.course_id).filter(Boolean))
      )]

      if (allCourseIds.length) {
        const courseList = await fetchCourses(allCourseIds)
        setCourses(courseMap(courseList))
      } else {
        setCourses({})
      }
      setPlansLoading(false)
    })
  }, [selectedDegreeId])

  const selectedDegree = degrees.find((d) => d.id === selectedDegreeId)

  const termLabel = (semester) => semester === 1 ? 'Fall' : 'Spring'

  // Group plans by year
  const byYear = [1, 2, 3, 4].map((year) => ({
    year,
    semesters: plans.filter((p) => p.year === year),
  }))

  if (loading) {
    return <div className="text-gray-400 text-sm py-12 text-center">Loading...</div>
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <h1 className="text-2xl font-bold text-fus-green-700">4-Year Planner</h1>
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

      {selectedDegree?.tier === 2 && (
        <div className="mb-6 p-3 rounded-lg bg-fus-gold-50 border border-fus-gold-200 text-sm text-fus-gold-800">
          This plan was auto-generated based on prerequisite ordering.
          Semester placement may vary — always verify with your academic advisor.
        </div>
      )}

      <p className="text-sm text-gray-500 mb-8">
        The recommended course sequence for the {selectedDegree?.name}.
        Your actual schedule may vary based on transfer credits, AP credit, or advisor guidance.
      </p>

      {plansLoading && (
        <div className="text-gray-400 text-sm py-8 text-center">Loading plan...</div>
      )}

      {!plansLoading && plans.length === 0 && (
        <div className="text-gray-400 text-sm py-8 text-center">
          No semester plan available for this degree yet.
        </div>
      )}

      {!plansLoading && byYear.map(({ year, semesters }) => (
        semesters.length === 0 ? null : (
          <div key={year} className="mb-10">
            <h2 className="text-lg font-bold text-fus-green-800 mb-4 border-b border-fus-green-100 pb-2">
              Year {year}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {semesters.map((plan) => {
                const semesterCredits = plan.entries.reduce((sum, e) => {
                  if (e.course_id) return sum + (courses[e.course_id]?.credits ?? 3)
                  return sum + (e.core_slot_credits ?? 3)
                }, 0)

                return (
                  <div key={plan.id}>
                    <div className="flex items-baseline justify-between mb-3">
                      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                        {termLabel(plan.semester)}
                      </h3>
                      <span className="text-xs text-gray-400">{semesterCredits} credits</span>
                    </div>

                    {plan.austria_semester && (
                      <div className="mb-3 p-2.5 rounded-lg bg-fus-green-50 border border-fus-green-200 text-xs text-fus-green-700">
                        🌍 {plan.austria_note}
                      </div>
                    )}

                    <div className="flex flex-col gap-2">
                      {plan.entries.map((entry, i) => {
                        if (entry.course_id) {
                          const course = courses[entry.course_id]
                          if (!course) return (
                            <div key={i} className="text-xs text-gray-400 font-mono px-2">
                              {entry.course_id}
                            </div>
                          )
                          return (
                            <CourseCard
                              key={i}
                              course={course}
                              allCourses={Object.values(courses)}
                              completed={completedSet.has(course.id)}
                              prereqsMet={true}
                              showToggle={false}
                            />
                          )
                        }

                        // Core slot
                        return (
                          <div
                            key={i}
                            className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-3"
                          >
                            <p className="text-xs text-gray-500 italic">
                              {entry.core_slot_label}
                            </p>
                            {entry.core_slot_credits && (
                              <p className="text-xs text-gray-400 mt-0.5">
                                {entry.core_slot_credits} cr
                              </p>
                            )}
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
      ))}
    </div>
  )
}
