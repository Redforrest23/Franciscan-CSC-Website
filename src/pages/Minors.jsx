import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { getCompletedSet, findOverlap, groupProgress } from '../lib/progress'
import CourseCard from '../components/CourseCard'
import ProgressBar from '../components/ProgressBar'

import minorsData from '../../data/minors.json'
import coursesData from '../../data/courses.json'
import degreesData from '../../data/degrees.json'

export default function Minors() {
  const { user } = useAuth()
  const [selectedMinorId, setSelectedMinorId] = useState(minorsData[0]?.id)
  const [selectedDegreeId, setSelectedDegreeId] = useState('BS_CS')
  const [completedCourses, setCompletedCourses] = useState([])
  const [savedMinors, setSavedMinors] = useState([])

  const minor = minorsData.find((m) => m.id === selectedMinorId)
  const degree = degreesData.find((d) => d.id === selectedDegreeId)
  const completedSet = getCompletedSet(completedCourses)
  const overlapIds = minor && degree ? findOverlap(degree, minor) : []

  useEffect(() => {
    if (!user) return
    Promise.all([
      supabase.from('completed_courses').select('*').eq('user_id', user.id),
      supabase.from('selected_minors').select('*').eq('user_id', user.id),
    ]).then(([coursesRes, minorsRes]) => {
      if (coursesRes.data) setCompletedCourses(coursesRes.data)
      if (minorsRes.data) setSavedMinors(minorsRes.data.map((m) => m.minor_id))
    })
  }, [user])

  async function handleToggleMinor(minorId) {
    if (!user) return
    if (savedMinors.includes(minorId)) {
      await supabase.from('selected_minors').delete()
        .eq('user_id', user.id).eq('minor_id', minorId)
      setSavedMinors((prev) => prev.filter((id) => id !== minorId))
    } else {
      await supabase.from('selected_minors').insert({ user_id: user.id, minor_id: minorId })
      setSavedMinors((prev) => [...prev, minorId])
    }
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <h1 className="text-2xl font-bold text-gray-900">Minors</h1>

        <select
          value={selectedMinorId}
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
          {degreesData.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </div>

      {minor && (
        <>
          <div className="mb-6 p-4 rounded-xl bg-gray-50 border border-gray-200">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{minor.name}</h2>
                <p className="text-sm text-gray-500 mt-1">{minor.description}</p>
                <p className="text-sm text-gray-400 mt-1">
                  {minor.totalCredits} credits required
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
              <div className="mt-4 p-3 rounded-lg bg-fus-gold-50 border border-fus-gold-200 text-sm text-fus-brown-700">
                <strong>Double-count opportunity:</strong> {overlapIds.length} course
                {overlapIds.length > 1 ? 's' : ''} from your {degree?.name} may also count
                toward this minor:{' '}
                {overlapIds
                  .map((id) => coursesData.find((c) => c.id === id)?.code ?? id)
                  .join(', ')}
                {minor.overlapNotes && (
                  <ul className="mt-2 list-disc list-inside text-xs text-fus-brown-500 space-y-1">
                    {minor.overlapNotes.map((note, i) => (
                      <li key={i}>{note}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {minor.requirementGroups.map((group) => {
            const courses = (group.courses || [])
              .map((id) => coursesData.find((c) => c.id === id))
              .filter(Boolean)
            const completed = courses.filter((c) => completedSet.has(c.id)).length

            return (
              <section key={group.id} className="mb-8">
                <div className="flex items-baseline justify-between mb-2">
                  <h3 className="text-base font-semibold text-gray-800">{group.label}</h3>
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

                {user && courses.length > 0 && (
                  <div className="mb-4">
                    <ProgressBar label="" completed={completed} total={courses.length} color="bg-fus-green-500" />
                  </div>
                )}

                {courses.length > 0 ? (
                  <div className="flex flex-col gap-3">
                    {courses.map((course) => {
                      const isOverlap = overlapIds.includes(course.id)
                      return (
                        <div key={course.id} className="relative">
                          {isOverlap && (
                            <span className="absolute -top-2 -right-2 z-10 text-xs bg-fus-gold-400 text-white rounded-full px-2 py-0.5">
                              counts for major
                            </span>
                          )}
                          <CourseCard
                            course={course}
                            allCourses={coursesData}
                            completed={completedSet.has(course.id)}
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
          })}
        </>
      )}
    </div>
  )
}