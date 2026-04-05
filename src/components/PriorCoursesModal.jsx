import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function PriorCoursesModal({
    userId,
    semesterLabel,
    semesterIndex,
    allCourses,
    onClose,
    onSaved,
    existingPrior = [],
}) {
    const [search, setSearch] = useState('')
    const [selected, setSelected] = useState([])
    const [transferCode, setTransferCode] = useState('')
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        setSelected(existingPrior.map((p) => p.course_id ?? p.course_code).filter(Boolean))
    }, [existingPrior])

    const filtered = allCourses.filter((c) =>
        !search ||
        c.code.toLowerCase().includes(search.toLowerCase()) ||
        c.title.toLowerCase().includes(search.toLowerCase())
    ).slice(0, 30)

    function toggleCourse(id) {
        setSelected((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        )
    }

    async function handleSave() {
        setSaving(true)

        // Delete existing prior courses for this semester
        await supabase
            .from('prior_courses')
            .delete()
            .eq('user_id', userId)
            .eq('semester_label', semesterLabel)

        // Insert selected
        const rows = selected.map((id) => {
            const course = allCourses.find((c) => c.id === id)
            return {
                user_id: userId,
                course_id: course ? id : null,
                course_code: course ? course.code : id,
                semester_label: semesterLabel,
            }
        })

        // Add transfer course if entered
        if (transferCode.trim()) {
            rows.push({
                user_id: userId,
                course_id: null,
                course_code: transferCode.trim().toUpperCase(),
                semester_label: semesterLabel,
            })
        }

        if (rows.length) {
            await supabase.from('prior_courses').insert(rows)
        }

        setSaving(false)
        onSaved(selected)
        onClose()
    }

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-100">
                    <div>
                        <h2 className="font-bold text-fus-green-700 text-base">Prior Courses</h2>
                        <p className="text-xs text-gray-400 mt-0.5">{semesterLabel}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 text-lg leading-none"
                    >
                        ✕
                    </button>
                </div>

                {/* Search */}
                <div className="p-3 border-b border-gray-100">
                    <input
                        type="text"
                        placeholder="Search courses..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-fus-gold-400"
                    />
                </div>

                {/* Course list */}
                <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-1">
                    {filtered.map((course) => (
                        <button
                            key={course.id}
                            onClick={() => toggleCourse(course.id)}
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${selected.includes(course.id)
                                ? 'bg-fus-green-50 border border-fus-green-200'
                                : 'hover:bg-gray-50 border border-transparent'
                                }`}
                        >
                            <span className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center text-xs ${selected.includes(course.id)
                                ? 'bg-fus-green-500 border-fus-green-500 text-white'
                                : 'border-gray-300'
                                }`}>
                                {selected.includes(course.id) ? '✓' : ''}
                            </span>
                            <span className="font-mono text-xs font-bold text-fus-green-600 flex-shrink-0">
                                {course.code}
                            </span>
                            <span className="text-xs text-gray-600 truncate">{course.title}</span>
                            <span className="text-xs text-gray-400 flex-shrink-0 ml-auto">
                                {course.credits} cr
                            </span>
                        </button>
                    ))}
                </div>

                {/* Transfer course input */}
                <div className="p-3 border-t border-gray-100">
                    <p className="text-xs text-gray-400 mb-1.5">Transfer course not in list?</p>
                    <input
                        type="text"
                        placeholder="e.g. ENG 101"
                        value={transferCode}
                        onChange={(e) => setTransferCode(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-fus-gold-400"
                    />
                </div>

                {/* Footer */}
                <div className="p-3 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-xs text-gray-400">{selected.length} courses selected</span>
                    <div className="flex gap-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="px-4 py-2 text-sm bg-fus-green-600 text-white rounded-lg hover:bg-fus-green-700 disabled:opacity-50"
                        >
                            {saving ? 'Saving...' : 'Save'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}