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

    // Validate prereqs — all prereqs must appear in earlier semesters
    const satisfiedPre = new Set([...completedSet, ...priorSet])
    allSemesters.forEach((sem, i) => {
        if (i < semesterIndex) {
            sem.courseIds.forEach((id) => satisfiedPre.add(id))
        }
    })

    const missingPrereqs = prerequisites.filter((p) => !satisfiedPre.has(p))

    // Validate coreqs — must be in same or earlier semester
    const currentAndEarlier = new Set(satisfiedPre)
    if (allSemesters[semesterIndex]) {
        allSemesters[semesterIndex].courseIds.forEach((id) => currentAndEarlier.add(id))
    }
    const missingCoreqs = corequisites.filter((c) => !currentAndEarlier.has(c))

    const hasIssues = missingPrereqs.length > 0 || missingCoreqs.length > 0

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
            className={`rounded-lg border px-3 py-2 select-none transition-colors ${hasIssues
                    ? 'border-red-200 bg-red-50'
                    : 'border-gray-200 bg-white hover:border-fus-green-300'
                }`}
        >
            <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-fus-green-600">
                            {course.code}
                        </span>
                        <span className="text-xs text-gray-400">{course.credits ?? '?'} cr</span>
                    </div>
                    <p className="text-xs text-gray-700 mt-0.5 leading-snug">{course.title}</p>

                    {missingPrereqs.length > 0 && (
                        <p className="mt-1 text-xs text-red-600 font-medium">
                            🔴 Prereq missing: {prereqNames}
                        </p>
                    )}
                    {missingCoreqs.length > 0 && (
                        <p className="mt-1 text-xs text-yellow-600 font-medium">
                            🟡 Coreq needed in same semester: {coreqNames}
                        </p>
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