/**
 * MinorProgressCard
 * Props:
 *   minor            - minor object from Supabase (has .name, .total_credits)
 *   requirementGroups - array from fetchMinorRequirements() for this minor
 *   courses          - courseMap object { [courseId]: course } from Supabase
 *   completedSet     - Set<string> of completed course IDs
 *   onRemove         - optional function() called when student removes the minor
 */

import ProgressBar from './ProgressBar'

export default function MinorProgressCard({ minor, requirementGroups = [], courses = {}, completedSet, onRemove }) {
  if (!minor) return null

  const requiredGroups = requirementGroups.filter(
    (g) => !g.elective && g.courses?.length > 0
  )

  const totalRequired = requiredGroups.reduce((sum, g) => sum + g.courses.length, 0)
  const completedRequired = requiredGroups.reduce(
    (sum, g) => sum + g.courses.filter((id) => completedSet.has(id)).length,
    0
  )

  const remaining = requiredGroups
    .flatMap((g) => g.courses)
    .filter((id) => !completedSet.has(id))
    .map((id) => courses[id])
    .filter(Boolean)

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        <h3 className="font-semibold text-gray-900 text-sm leading-snug">
          {minor.name}
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

      {minor.total_credits && (
        <p className="mt-2 text-xs text-gray-400">
          {minor.total_credits} total credits required — see advisor for elective options
        </p>
      )}
    </div>
  )
}