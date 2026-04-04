import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { getCompletedSet, groupProgress, degreeProgress, prereqsMet } from '../lib/progress'
import CourseCard from '../components/CourseCard'
import ProgressBar from '../components/ProgressBar'

import degreesData from '../../data/degrees.json'
import coursesData from '../../data/courses.json'

export default function Degree() {
  const { user } = useAuth()
  const [selectedDegreeId, setSelectedDegreeId] = useState('BS_CS')
  const [completedCourses, setCompletedCourses] = useState([])
  const [loading, setLoading] = useState(false)

  const degree = degreesData.find((d) => d.id === selectedDegreeId)
  const completedSet = getCompletedSet(completedCourses)

  useEffect(() => {
    if (!user) { setCompletedCourses([]); return }
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

  async function handleToggle(courseId) {
    if (!user) return
    if (completedSet.has(courseId)) {
      await supabase.from('completed_courses').delete()
        .eq('user_id', user.id).eq('course_id', courseId)
      setCompletedCourses((prev) => prev.filter((c) => c.course_id !== courseId))
    } else {
      const { data, error } = await supabase.from('completed_courses')
        .insert({ user_id: user.id, course_id: courseId }).select().single()
      if (!error && data) setCompletedCourses((prev) => [...prev, data])
    }
  }

  const totalRequired = degree?.requirementGroups
    .flatMap((g) => g.courses || [])
    .filter((id, i, arr) => arr.indexOf(id) === i).length ?? 0

  const completedRequired = degree?.requirementGroups
    .flatMap((g) => g.courses || [])
    .filter((id, i, arr) => arr.indexOf(id) === i && completedSet.has(id)).length ?? 0

  return (
    <div>
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <h1 className="text-2xl font-bold text-gray-900">Degree Requirements</h1>
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

      {degree && (
        <p className="text-sm text-gray-500 mb-6">{degree.description}</p>
      )}

      {user && (
        <div className="mb-8 p-4 rounded-xl bg-gray-50 border border-gray-200">
          <ProgressBar
            label="Overall Required Courses"
            completed={completedRequired}
            total={totalRequired}
            percent={totalRequired ? Math.round((completedRequired / totalRequired) * 100) : 0}
            color="bg-fus-green-500"
          />
        </div>
      )}

      {!user && (
        <p className="mb-6 text-sm text-gray-400 italic">
          Sign in to check off completed courses and track your progress.
        </p>
      )}

      {degree?.requirementGroups.map((group) => {
        const courses = (group.courses || []).map((id) => coursesData.find((c) => c.id === id)).filter(Boolean)
        const completed = courses.filter((c) => completedSet.has(c.id)).length
        return (
          <section key={group.id} className="mb-10">
            <div className="flex items-baseline justify-between mb-2">
              <h2 className="text-lg font-semibold text-gray-800">{group.label}</h2>
              {user && courses.length > 0 && (
                <span className="text-sm text-gray-400">{completed}/{courses.length} completed</span>
              )}
            </div>

            {group.chooseOne && (
              <p className="text-xs italic text-fus-brown-400 mb-2">Choose one of the following.</p>
            )}
            {group.elective && (
              <p className="text-xs italic text-fus-brown-400 mb-2">
                Elective — {group.count} course{group.count > 1 ? 's' : ''} required. Consult your advisor.
              </p>
            )}

            {courses.length > 0 ? (
              <div className="flex flex-col gap-3">
                {courses.map((course) => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    allCourses={coursesData}
                    completed={completedSet.has(course.id)}
                    prereqsMet={prereqsMet(course, completedSet)}
                    onToggle={handleToggle}
                    showToggle={!!user}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic">
                Choose any qualifying CSC/SFE 2xx or above course. Consult your advisor.
              </p>
            )}
          </section>
        )
      })}
    </div>
  )
}