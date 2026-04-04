/**
 * MinorProgressCard
 *
 * A compact summary card showing a student's progress toward a specific minor.
 * Designed to appear on a dashboard or sidebar.
 *
 * Props:
 *   minor        - minor object from minors.json
 *   completedSet - Set<string> of completed course IDs
 *   onRemove     - optional function() called when student removes the minor
 */

import ProgressBar from './ProgressBar'
import coursesData from '../../data/courses.json'

export default function MinorProgressCard({ minor, completedSet, onRemove }) {
  if (!minor) return null

  // Only look at required groups for progress tracking
  const requiredGroups = minor.requirementGroups.filter(
    (g) => g.type === 'required' && g.courses?.length > 0
  )

  const totalRequired = requiredGroups.reduce(
    (sum, g) => sum + g.courses.length,
    0
  )
  const completedRequired = requiredGroups.reduce(
    (sum, g) => sum + g.courses.filter((id) => completedSet.has(id)).length,
    0
  )

  const percent =
    totalRequired === 0
      ? 0
      : Math.round((completedRequired / totalRequired) * 100)

  // Remaining required courses not yet completed
  const remaining = requiredGroups
    .flatMap((g) => g.courses)
    .filter((id) => !completedSet.has(id))
    .map((id) => coursesData.find((c) => c.id === id))
    .filter(Boolean)

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        <h3 className="font-semibold text-gray-900 text-sm leading-snug">
          {minor.title}
        </h3>
        {onRemove && (
          <button
            onClick={onRemove}
            className="text-gray-300 hover:text-red-400 transition-colors text-xs flex-shrink-0"
            title="Remove minor from my plan"
          >
            ✕
          </button>
        )}
      </div>

      <ProgressBar
        label=""
        completed={completedRequired}
        total={totalRequired}
        color="bg-purple-500"
      />

      {remaining.length > 0 && (
        <div className="mt-3">
          <p className="text-xs text-gray-400 mb-1">Still needed:</p>
          <div className="flex flex-wrap gap-1">
            {remaining.map((course) => (
              <span
                key={course.id}
                className="text-xs bg-gray-100 text-gray-600 rounded px-2 py-0.5 font-mono"
              >
                {course.code}
              </span>
            ))}
          </div>
        </div>
      )}

      {remaining.length === 0 && totalRequired > 0 && (
        <p className="mt-3 text-xs text-green-600 font-medium">
          ✓ All required courses completed
        </p>
      )}

      {minor.creditsRequired && (
        <p className="mt-2 text-xs text-gray-400">
          {minor.creditsRequired} total credits required — see advisor for elective options
        </p>
      )}
    </div>
  )
}
