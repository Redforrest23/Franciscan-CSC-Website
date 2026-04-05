/**
 * DraggableCoreSlot
 *
 * A draggable core requirement placeholder in the personal planner.
 * Supports:
 *   - Dragging between semesters
 *   - Assigning a specific course from a filtered dropdown
 *   - Dismissing (X) to remove from the plan
 *
 * Props:
 *   slot            - { id, label, credits, assignedCourseId? }
 *   semesterIndex   - which semester this slot lives in
 *   allCourses      - full course list for dropdown filtering
 *   onRemove        - function(slotId) — removes slot from plan
 *   onAssign        - function(slotId, courseId | null) — assigns or clears a course
 */

import { useState, useRef, useEffect } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { getCoursesForCoreSlot } from '../lib/coreSlotConfig'

export default function DraggableCoreSlot({
    slot,
    semesterIndex,
    allCourses = [],
    onRemove,
    onAssign,
}) {
    const [showDropdown, setShowDropdown] = useState(false)
    const [search, setSearch] = useState('')
    const dropdownRef = useRef(null)

    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: slot.id,
        data: { type: 'coreSlot', slotId: slot.id, fromSemester: semesterIndex },
    })

    const style = {
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.4 : 1,
        cursor: isDragging ? 'grabbing' : 'grab',
    }

    // Close dropdown on outside click
    useEffect(() => {
        function handleClick(e) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setShowDropdown(false)
                setSearch('')
            }
        }
        if (showDropdown) document.addEventListener('mousedown', handleClick)
        return () => document.removeEventListener('mousedown', handleClick)
    }, [showDropdown])

    const matchingCourses = getCoursesForCoreSlot(slot.label, allCourses)
    const filteredCourses = matchingCourses.filter((c) =>
        !search ||
        c.code?.toLowerCase().includes(search.toLowerCase()) ||
        c.title?.toLowerCase().includes(search.toLowerCase())
    ).slice(0, 20)

    const assignedCourse = slot.assignedCourseId
        ? allCourses.find((c) => c.id === slot.assignedCourseId)
        : null

    const hasOptions = matchingCourses.length > 0

    return (
        <div className="relative" ref={dropdownRef}>
            <div
                ref={setNodeRef}
                style={style}
                {...listeners}
                {...attributes}
                className={`rounded-lg border border-dashed px-3 py-2 select-none transition-colors ${assignedCourse
                        ? 'border-fus-green-300 bg-fus-green-50'
                        : 'border-gray-300 bg-gray-50 hover:border-fus-green-300 hover:bg-fus-green-50'
                    }`}
            >
                <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-500 italic leading-snug">{slot.label}</p>

                        {assignedCourse ? (
                            <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                                <span className="font-mono text-xs font-bold text-fus-green-600">
                                    {assignedCourse.code}
                                </span>
                                <span className="text-xs text-gray-500 truncate">
                                    {assignedCourse.title}
                                </span>
                                <button
                                    onPointerDown={(e) => e.stopPropagation()}
                                    onClick={() => onAssign(slot.id, null)}
                                    className="text-xs text-gray-300 hover:text-red-400 transition-colors ml-auto"
                                    title="Clear assigned course"
                                >
                                    ✕
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 mt-1">
                                <p className="text-xs text-gray-400">{slot.credits} cr</p>
                                {hasOptions && (
                                    <button
                                        onPointerDown={(e) => e.stopPropagation()}
                                        onClick={() => setShowDropdown((v) => !v)}
                                        className="text-xs text-fus-green-600 hover:underline transition-colors"
                                    >
                                        Assign course ▾
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* X to remove slot entirely */}
                    <button
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => onRemove(slot.id)}
                        className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0 text-sm leading-none mt-0.5"
                        title="Remove from plan"
                    >
                        ✕
                    </button>
                </div>
            </div>

            {/* Course assignment dropdown */}
            {showDropdown && (
                <div className="absolute z-50 top-full left-0 mt-1 w-72 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                    <div className="p-2 border-b border-gray-100">
                        <input
                            type="text"
                            placeholder={`Search ${slot.label}...`}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onPointerDown={(e) => e.stopPropagation()}
                            autoFocus
                            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-fus-gold-400"
                        />
                    </div>

                    <div className="max-h-48 overflow-y-auto">
                        {filteredCourses.length === 0 ? (
                            <p className="text-xs text-gray-400 italic p-3">No matching courses found.</p>
                        ) : (
                            filteredCourses.map((course) => (
                                <button
                                    key={course.id}
                                    onPointerDown={(e) => e.stopPropagation()}
                                    onClick={() => {
                                        onAssign(slot.id, course.id)
                                        setShowDropdown(false)
                                        setSearch('')
                                    }}
                                    className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-fus-green-50 transition-colors border-b border-gray-50 last:border-0"
                                >
                                    <span className="font-mono text-xs font-bold text-fus-green-600 flex-shrink-0">
                                        {course.code}
                                    </span>
                                    <span className="text-xs text-gray-600 truncate">{course.title}</span>
                                    <span className="text-xs text-gray-400 flex-shrink-0 ml-auto">
                                        {course.credits} cr
                                    </span>
                                </button>
                            ))
                        )}
                    </div>

                    <div className="p-2 border-t border-gray-100">
                        <button
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={() => { setShowDropdown(false); setSearch('') }}
                            className="text-xs text-gray-400 hover:text-gray-600 w-full text-center"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
