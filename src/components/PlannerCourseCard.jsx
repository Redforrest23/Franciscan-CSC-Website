import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'

export default function PlannerCourseCard({
    course,
    allCourses = [],
    completedSet = new Set(),
    priorSet = new Set(),
    semesterIndex,
    allSemesters,
    onRemove,
    isCompleted,
    ignoredWarnings = new Set(),
    onToggleIgnore,
}) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: course.id,
        data: { courseId: course.id, fromSemester: semesterIndex },
    })

    const style = {
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.4 : 1,
        cursor: isDragging ? 'grabbing' : 'grab',
    }

    const prerequisites = course.prerequisites ?? []
    const corequisites = course.corequisites ?? []

    // Build set of satisfied prereqs from completed, prior, and earlier semesters
    const satisfiedPre = new Set([...completedSet, ...priorSet])
    allSemesters.forEach((sem, i) => {
        if (i < semesterIndex) sem.courseIds.forEach((id) => satisfiedPre.add(id))
    })

    const missingPrereqs = prerequisites.filter((p) => !satisfiedPre.has(p))

    // Coreqs must be in same or earlier semester
    const currentAndEarlier = new Set(satisfiedPre)
    if (allSemesters[semesterIndex]) {
        allSemesters[semesterIndex].courseIds.forEach((id) => currentAndEarlier.add(id))
    }
    const missingCoreqs = corequisites.filter((c) => !currentAndEarlier.has(c))

    const prereqIgnored = ignoredWarnings.has(`${course.id}:prereq`)
    const coreqIgnored = ignoredWarnings.has(`${course.id}:coreq`)

    const hasActiveIssues =
        (missingPrereqs.length > 0 && !prereqIgnored) ||
        (missingCoreqs.length > 0 && !coreqIgnored)

    const prereqNames = missingPrereqs
        .map((id) => allCourses.find((c) => c.id === id)?.code ?? id)
        .join(', ')
    const coreqNames = missingCoreqs
        .map((id) => allCourses.find((c) => c.id === id)?.code ?? id)
        .join(', ')

    if (isCompleted) {
        return (
            <div className="rounded-lg border border-fus-green-200 bg-fus-green-50 px-3 py-2 flex items-center justify-between gap-2 opacity-60">
                <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs text-fus-green-600">✓</span>
                    <span className="font-mono text-xs font-bold text-fus-green-600">{course.code}</span>
                    <span className="text-xs text-gray-500 truncate">{course.title}</span>
                </div>
                <span className="text-xs text-gray-400 flex-shrink-0">{course.credits} cr</span>
            </div>
        )
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            className={`rounded-lg border px-3 py-2 select-none transition-colors ${hasActiveIssues
                    ? 'border-red-200 bg-red-50'
                    : 'border-gray-200 bg-white hover:border-fus-green-300'
                }`}
        >
            <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-fus-green-600">{course.code}</span>
                        <span className="text-xs text-gray-400">{course.credits ?? '?'} cr</span>
                    </div>
                    <p className="text-xs text-gray-700 mt-0.5 leading-snug">{course.title}</p>

                    {/* Prereq warning */}
                    {missingPrereqs.length > 0 && (
                        <div className={`mt-1 flex items-start gap-1.5 ${prereqIgnored ? 'opacity-40' : ''}`}>
                            <p className={`text-xs font-medium flex-1 ${prereqIgnored ? 'text-gray-400' : 'text-red-600'}`}>
                                🔴 Prereq missing: {prereqNames}
                                {prereqIgnored && ' (ignored)'}
                            </p>
                            <button
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={() => onToggleIgnore?.(course.id, 'prereq', prereqIgnored)}
                                className={`text-xs flex-shrink-0 px-1.5 py-0.5 rounded border transition-colors ${prereqIgnored
                                        ? 'border-gray-200 text-gray-400 hover:border-red-200 hover:text-red-500'
                                        : 'border-red-200 text-red-500 hover:bg-red-100'
                                    }`}
                                title={prereqIgnored ? 'Re-enable warning' : 'Ignore this warning'}
                            >
                                {prereqIgnored ? 'unignore' : 'ignore'}
                            </button>
                        </div>
                    )}

                    {/* Coreq warning */}
                    {missingCoreqs.length > 0 && (
                        <div className={`mt-1 flex items-start gap-1.5 ${coreqIgnored ? 'opacity-40' : ''}`}>
                            <p className={`text-xs font-medium flex-1 ${coreqIgnored ? 'text-gray-400' : 'text-yellow-600'}`}>
                                🟡 Coreq needed in same semester: {coreqNames}
                                {coreqIgnored && ' (ignored)'}
                            </p>
                            <button
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={() => onToggleIgnore?.(course.id, 'coreq', coreqIgnored)}
                                className={`text-xs flex-shrink-0 px-1.5 py-0.5 rounded border transition-colors ${coreqIgnored
                                        ? 'border-gray-200 text-gray-400 hover:border-yellow-200 hover:text-yellow-600'
                                        : 'border-yellow-200 text-yellow-600 hover:bg-yellow-50'
                                    }`}
                                title={coreqIgnored ? 'Re-enable warning' : 'Ignore this warning'}
                            >
                                {coreqIgnored ? 'unignore' : 'ignore'}
                            </button>
                        </div>
                    )}
                </div>

                <button
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => onRemove(course.id)}
                    className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0 text-sm leading-none mt-0.5"
                    title="Remove from plan"
                >
                    ✕
                </button>
            </div>
        </div>
    )
}