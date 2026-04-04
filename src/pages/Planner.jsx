import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { getCompletedSet } from '../lib/progress'
import CourseCard from '../components/CourseCard'

import degreesData from '../../data/degrees.json'
import coursesData from '../../data/courses.json'

export default function Planner() {
  const { user } = useAuth()
  const [selectedDegreeId, setSelectedDegreeId] = useState('BS_CS')
  const [austriaMode, setAustriaMode] = useState(false)
  const [completedCourses, setCompletedCourses] = useState([])

  const degree = degreesData.find((d) => d.id === selectedDegreeId)
  const hasAustriaPlan = !!degree?.fourYearPlan?.austria
  const plan = austriaMode && hasAustriaPlan
    ? degree.fourYearPlan.austria
    : degree?.fourYearPlan?.standard ?? []
  const completedSet = getCompletedSet(completedCourses)

  useEffect(() => {
    if (!user) return
    supabase.from('completed_courses').select('*').eq('user_id', user.id)
      .then(({ data }) => { if (data) setCompletedCourses(data) })
  }, [user])

  useEffect(() => {
    if (!hasAustriaPlan) setAustriaMode(false)
  }, [selectedDegreeId, hasAustriaPlan])

  function semesterCredits(sem) {
    const majorCr = (sem.courses || []).reduce((total, courseId) => {
      const course = coursesData.find((c) => c.id === courseId)
      return total + (course?.credits ?? 0)
    }, 0)
    const coreCr = (sem.coreSlots || []).reduce((total, slot) => {
      return total + (slot.credits ?? 0)
    }, 0)
    return majorCr + coreCr
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <h1 className="text-2xl font-bold text-gray-900">4-Year Planner</h1>
        <select
          value={selectedDegreeId}
          onChange={(e) => setSelectedDegreeId(e.target.value)}
          className="ml-auto border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-fus-gold-400"
        >
          {degreesData.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </div>

      {hasAustriaPlan && (
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => setAustriaMode(false)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${!austriaMode
              ? 'bg-fus-green-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
          >
            Standard Plan
          </button>
          <button
            onClick={() => setAustriaMode(true)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${austriaMode
              ? 'bg-fus-green-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
          >
            ✈️ Austria Plan
          </button>
        </div>
      )}

      <p className="text-sm text-gray-500 mb-8">
        Recommended course sequence for <strong>{degree?.name}</strong>.
        Your actual schedule may vary based on transfer credits, AP credit, or advisor recommendations.
        {austriaMode && ' This plan accounts for a semester abroad in Gaming, Austria.'}
      </p>

      <div className="space-y-10">
        {[1, 2, 3, 4].map((year) => {
          const semesters = plan.filter((s) => s.year === year)
          if (!semesters.length) return null
          return (
            <div key={year}>
              <h2 className="text-lg font-bold text-gray-800 mb-4 border-b border-gray-200 pb-2">
                Year {year}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {semesters.map((sem) => {
                  const credits = semesterCredits(sem)
                  return (
                    <div key={sem.label}>
                      <div className="flex items-baseline justify-between mb-3">
                        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                          {sem.label}
                        </h3>
                        <span className="text-xs font-medium text-fus-green-600 bg-fus-green-50 px-2 py-0.5 rounded-full">
                          {credits} cr
                        </span>
                      </div>

                      {sem.austriaSemester && (
                        <div className="mb-3 p-3 rounded-lg bg-fus-gold-50 border border-fus-gold-300 text-sm text-fus-brown-500">
                          ✈️ <strong>Austria Semester</strong> — {sem.austriaNote}
                        </div>
                      )}
                      {!sem.austriaSemester && sem.austriaNote && (
                        <div className="mb-3 p-3 rounded-lg bg-gray-50 border border-gray-200 text-xs text-gray-400 italic">
                          💡 {sem.austriaNote}
                        </div>
                      )}

                      <div className="flex flex-col gap-2">
                        {(sem.courses || []).map((courseId) => {
                          const course = coursesData.find((c) => c.id === courseId)
                          if (!course) return null
                          return (
                            <CourseCard
                              key={course.id}
                              course={course}
                              allCourses={coursesData}
                              completed={completedSet.has(course.id)}
                              prereqsMet={true}
                              showToggle={false}
                            />
                          )
                        })}
                        {(sem.coreSlots || []).map((slot, i) => (
                          <div
                            key={i}
                            className="px-4 py-3 rounded-lg border border-dashed border-gray-300 text-sm text-gray-400 italic"
                          >
                            {slot.label}
                          </div>
                        ))}
                      </div>
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
}