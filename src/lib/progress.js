/**
 * progress.js
 * Core logic for computing degree progress, prerequisite checks,
 * and overlap detection between major and minor requirements.
 */

/**
 * Returns the set of course IDs a student has completed.
 * @param {Array} completedCourses - rows from Supabase completed_courses table
 * @returns {Set<string>}
 */
export function getCompletedSet(completedCourses) {
  return new Set(completedCourses.map((c) => c.course_id))
}

/**
 * Given a requirement group and the completed set, returns
 * how many required courses are done and total required.
 * @param {Object} group - a requirementGroup from degrees.json or minors.json
 * @param {Set<string>} completedSet
 * @returns {{ completed: number, total: number, percent: number }}
 */
export function groupProgress(group, completedSet) {
  if (group.type === 'required') {
    const total = group.courses.length
    const completed = group.courses.filter((id) => completedSet.has(id)).length
    return {
      completed,
      total,
      percent: total === 0 ? 0 : Math.round((completed / total) * 100),
    }
  }

  if (group.type === 'elective' || group.type === 'free') {
    // For elective/free groups we track by credits required vs earned
    // This is an approximation until we have credit data per course
    return {
      completed: 0,
      total: group.creditsRequired || 0,
      percent: 0,
      isCredit: true,
    }
  }

  return { completed: 0, total: 0, percent: 0 }
}

/**
 * Returns overall degree completion percentage across all required groups.
 * Does not include elective/free groups (those require credit tracking).
 * @param {Object} degree - a degree object from degrees.json
 * @param {Set<string>} completedSet
 * @returns {number} 0–100
 */
export function degreeProgress(degree, completedSet) {
  const requiredGroups = degree.requirementGroups.filter(
    (g) => g.type === 'required'
  )
  const totalCourses = requiredGroups.reduce(
    (sum, g) => sum + g.courses.length,
    0
  )
  const completedCourses = requiredGroups.reduce(
    (sum, g) => sum + g.courses.filter((id) => completedSet.has(id)).length,
    0
  )
  return totalCourses === 0
    ? 0
    : Math.round((completedCourses / totalCourses) * 100)
}

/**
 * Checks whether a course's prerequisites are all completed.
 * @param {Object} course - a course object from courses.json
 * @param {Set<string>} completedSet
 * @returns {boolean}
 */
export function prereqsMet(course, completedSet) {
  if (!course.prerequisites || course.prerequisites.length === 0) return true
  return course.prerequisites.every((prereqId) => completedSet.has(prereqId))
}

/**
 * Finds courses that appear in both the degree requirements and
 * a selected minor's requirements — i.e. double-countable courses.
 * @param {Object} degree - from degrees.json
 * @param {Object} minor - from minors.json
 * @returns {string[]} array of course IDs that overlap
 */
export function findOverlap(degree, minor) {
  const degreeCourses = new Set(
    degree.requirementGroups.flatMap((g) => g.courses || [])
  )
  const minorCourses = minor.requirementGroups.flatMap((g) => g.courses || [])
  return minorCourses.filter((id) => degreeCourses.has(id))
}

/**
 * Returns a list of courses the student can take next —
 * i.e. not yet completed and all prereqs met.
 * @param {Array} allCourses - full courses array from courses.json
 * @param {Set<string>} completedSet
 * @returns {Array} courses available to take
 */
export function availableToTake(allCourses, completedSet) {
  return allCourses.filter(
    (course) =>
      !completedSet.has(course.id) && prereqsMet(course, completedSet)
  )
}
