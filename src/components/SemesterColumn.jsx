import { useDroppable } from '@dnd-kit/core'
import PlannerCourseCard from './PlannerCourseCard'
import DraggableCoreSlot from './DraggableCoreSlot'

export default function SemesterColumn({
    semester,
    semesterIndex,
    allSemesters,
    courses,
    allCoursesForDropdown = [],
    completedSet,
    priorSet,
    honorsMode,
    isPast,
    onRemove,
    onRemoveCoreSlot,
    onAssignCoreSlot,
    onOpenPrior,
    ignoredWarnings = new Set(),
    onToggleIgnore,
}) {
    const { setNodeRef, isOver } = useDroppable({
        id: `semester-${semesterIndex}`,
        data: { semesterIndex },
    })

    const maxCredits = honorsMode ? 19 : 18

    const semesterCredits =
        semester.courseIds.reduce((sum, id) => sum + (courses[id]?.credits ?? 3), 0) +
        semester.coreSlots.reduce((sum, slot) => {
            if (slot.assignedCourseId && courses[slot.assignedCourseId]) {
                return sum + (courses[slot.assignedCourseId].credits ?? slot.credits ?? 3)
            }
            return sum + (slot.credits ?? 3)
        }, 0)

    const overloaded = semesterCredits > maxCredits

    return (
        <div
            ref={setNodeRef}
            className={`rounded-xl border-2 transition-colors p-3 min-h-48 ${isPast
                    ? 'border-fus-green-200 bg-fus-green-50 opacity-75'
                    : isOver
                        ? 'border-fus-gold-400 bg-fus-gold-50'
                        : 'border-gray-200 bg-white'
                }`}
        >
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold text-gray-600 uppercase tracking-wide">
                    {semester.label}
                </h3>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${overloaded
                        ? 'text-red-600 bg-red-50 border border-red-200'
                        : 'text-fus-green-600 bg-fus-green-50'
                    }`}>
                    {semesterCredits} cr {overloaded ? '⚠' : ''}
                </span>
            </div>

            {semester.austriaSemester && (
                <div className="mb-2 p-2 rounded-lg bg-fus-green-50 border border-fus-green-200 text-xs text-fus-green-700">
                    🌍 {semester.austriaNote}
                </div>
            )}

            {isPast && (
                <div className="mb-2">
                    <button
                        onClick={() => onOpenPrior(semesterIndex)}
                        className="w-full text-xs text-fus-green-600 border border-dashed border-fus-green-300 rounded-lg py-1.5 hover:bg-fus-green-100 transition-colors"
                    >
                        + Log prior courses
                    </button>
                </div>
            )}

            <div className="flex flex-col gap-1.5">
                {semester.courseIds.map((courseId) => {
                    const course = courses[courseId]
                    if (!course) return (
                        <div key={courseId} className="text-xs text-gray-400 font-mono px-2 py-1">
                            {courseId}
                        </div>
                    )
                    return (
                        <PlannerCourseCard
                            key={courseId}
                            course={course}
                            allCourses={Object.values(courses)}
                            completedSet={completedSet}
                            priorSet={priorSet}
                            semesterIndex={semesterIndex}
                            allSemesters={allSemesters}
                            onRemove={onRemove}
                            isCompleted={completedSet.has(courseId) || priorSet.has(courseId)}
                            ignoredWarnings={ignoredWarnings}
                            onToggleIgnore={onToggleIgnore}
                        />
                    )
                })}

                {semester.coreSlots.map((slot) => (
                    <DraggableCoreSlot
                        key={slot.id}
                        slot={slot}
                        semesterIndex={semesterIndex}
                        allCourses={allCoursesForDropdown}
                        onRemove={onRemoveCoreSlot}
                        onAssign={onAssignCoreSlot}
                    />
                ))}

                {!isPast && semester.courseIds.length === 0 && semester.coreSlots.length === 0 && (
                    <div className="text-xs text-gray-300 text-center py-4 italic">
                        Drop courses here
                    </div>
                )}
            </div>
        </div>
    )
}