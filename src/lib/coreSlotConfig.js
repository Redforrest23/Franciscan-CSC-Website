/**
 * coreSlotConfig.js
 */

export const CORE_SLOT_MAP = [
    {
        keywords: ['american founding principles'],
        departments: ['HST', 'POL'],
        allowedCodes: ['HST 105', 'HST 106', 'HST 207', 'HST 208', 'POL 200', 'POL 201'],
        labOnly: false,
    },
    {
        keywords: ['history core'],
        departments: ['HST'],
        allowedCodes: ['HST 105', 'HST 106', 'HST 207', 'HST 208'],
        labOnly: false,
    },
    {
        keywords: ['literature core'],
        departments: ['ENG'],
        allowedCodes: null,
        labOnly: false,
    },
    {
        keywords: ['philosophy core'],
        departments: ['PHL'],
        allowedCodes: null,
        labOnly: false,
    },
    {
        keywords: ['theology core'],
        departments: ['THE'],
        allowedCodes: null,
        labOnly: false,
    },
    {
        keywords: ['economics core'],
        departments: ['ECO'],
        allowedCodes: ['ECO 201', 'ECO 202', 'ECO 212'],
        labOnly: false,
    },
    {
        keywords: ['social science core'],
        departments: ['SOC', 'PSY', 'POL', 'ECO'],
        allowedCodes: null,
        labOnly: false,
    },
    {
        keywords: ['fine arts', 'catholic traditions'],
        departments: ['ART', 'MUS', 'THE'],
        allowedCodes: null,
        labOnly: false,
    },
    {
        keywords: ['natural science core'],
        departments: ['BIO', 'CHM', 'PHY', 'SCI'],
        allowedCodes: null,
        labOnly: false,
    },
    {
        keywords: ['natural science lab'],
        departments: ['BIO', 'CHM', 'PHY', 'SCI'],
        allowedCodes: null,
        labOnly: true,
    },
    {
        keywords: ['statistics elective'],
        departments: ['ECO', 'MTH', 'PSY'],
        allowedCodes: ['ECO 212', 'MTH 204', 'PSY 204', 'MTH 401'],
        labOnly: false,
    },
]

/**
 * If the label lists courses inline like "ECO 212, MTH 204, or MTH 401",
 * extract all of them.
 */
function extractInlineCodes(label) {
    const matches = [...label.matchAll(/\b([A-Z]{2,4})\s(\d{3}[A-Z]?)\b/g)]
    return matches.map((m) => `${m[1]} ${m[2]}`)
}

/**
 * Given a core slot label, returns the matching config entry or null.
 */
export function getCoreSlotConfig(label) {
    if (!label) return null
    const lower = label.toLowerCase()
    return CORE_SLOT_MAP.find((entry) =>
        entry.keywords.some((kw) => lower.includes(kw))
    ) ?? null
}

/**
 * Given a core slot label and a list of all courses,
 * returns courses that match the relevant departments.
 */
export function getCoursesForCoreSlot(label, allCourses) {
    if (!label || !allCourses?.length) return []

    // 1. If the label itself names specific courses (e.g. "ECO 212, MTH 204, or MTH 401"),
    //    use exactly those — works for "Statistics Elective — ECO 212, MTH 204..." style labels
    const inlineCodes = extractInlineCodes(label)
    if (inlineCodes.length > 0) {
        return allCourses.filter((c) =>
            inlineCodes.some((code) => c.code === code || c.id === code)
        )
    }

    // 2. Check the config map
    const config = getCoreSlotConfig(label)
    if (!config) return []

    // 3. If config has a specific allowedCodes list, filter to only those
    if (config.allowedCodes) {
        return allCourses.filter((c) =>
            config.allowedCodes.some((code) => c.code === code || c.id === code)
        )
    }

    // 4. Otherwise fall back to department-level filtering, with optional lab filter
    return allCourses.filter((c) => {
        const deptMatch = config.departments.some(
            (dept) => c.id?.startsWith(dept + ' ') || c.code?.startsWith(dept + ' ')
        )
        if (!deptMatch) return false
        if (config.labOnly) {
            const title = c.title?.toLowerCase() ?? ''
            return title.includes('lab') && c.credits === 1
        }
        return true
    })
}