export default function CourseCard({
  course,
  allCourses = [],
  completed = false,
  prereqsMet = true,
  onToggle,
  showToggle = false,
}) {
  const prereqNames = course.prerequisites
    .map((id) => allCourses.find((c) => c.id === id)?.code ?? id)
    .join(', ')

  const offeredLabel = course.offered
    .map((t) => t.charAt(0).toUpperCase() + t.slice(1))
    .join(' / ')

  return (
    <div
      className={`rounded-lg border px-4 py-3 transition-all ${completed
          ? 'border-fus-green-300 bg-fus-green-50'
          : !prereqsMet
            ? 'border-fus-gold-200 bg-fus-gold-50 opacity-80'
            : 'border-gray-200 bg-white hover:border-fus-green-300'
        }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">

          {/* Course meta row */}
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-mono text-xs font-bold text-fus-green-600 bg-fus-green-50 border border-fus-green-200 rounded px-1.5 py-0.5">
              {course.code}
            </span>
            <span className="text-xs text-gray-400">{course.credits} cr</span>
            <span className="text-xs text-gray-300">·</span>
            <span className="text-xs text-gray-400">{offeredLabel}</span>

            {!prereqsMet && (
              <span className="text-xs bg-fus-gold-100 text-fus-gold-700 border border-fus-gold-200 rounded px-1.5 py-0.5 font-medium">
                Prereqs needed
              </span>
            )}
            {completed && (
              <span className="text-xs bg-fus-green-100 text-fus-green-700 border border-fus-green-200 rounded px-1.5 py-0.5 font-medium">
                ✓ Completed
              </span>
            )}
          </div>

          {/* Title */}
          <p className="font-semibold text-gray-900 text-sm">{course.title}</p>

          {/* Description */}
          {course.description && (
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
              {course.description}
            </p>
          )}

          {/* Prereqs */}
          {course.prerequisites.length > 0 && (
            <p className="mt-1.5 text-xs text-gray-400">
              Prerequisites:{' '}
              <span className={prereqsMet ? 'text-fus-green-600' : 'text-fus-gold-600 font-medium'}>
                {prereqNames}
              </span>
            </p>
          )}

          {/* Port search */}
          {course.portSearch && (
            <p className="mt-1.5 text-xs text-gray-400">
              Search on The Port:{' '}
              <span className="font-mono font-semibold text-fus-brown-500 bg-fus-brown-50 border border-fus-brown-200 rounded px-1.5 py-0.5">
                {course.portSearch}
              </span>
            </p>
          )}

          {/* Notes */}
          {course.notes && (
            <p className="mt-1 text-xs italic text-gray-400">{course.notes}</p>
          )}
        </div>

        {/* Checkbox */}
        {showToggle && (
          <input
            type="checkbox"
            checked={completed}
            onChange={() => onToggle?.(course.id)}
            className="mt-1 h-4 w-4 rounded border-gray-300 cursor-pointer flex-shrink-0"
            title={completed ? 'Mark as not completed' : 'Mark as completed'}
          />
        )}
      </div>
    </div>
  )
}
