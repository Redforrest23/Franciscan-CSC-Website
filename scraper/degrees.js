import fetch from 'node-fetch'
import * as cheerio from 'cheerio'
import { createClient } from '@supabase/supabase-js'

// ── Supabase ──────────────────────────────────────────────
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ── Polite scraper config ─────────────────────────────────
const DELAY_MS = 2500
const USER_AGENT = 'FUS-Planner-Bot/1.0 (student academic planner tool)'

const delay = (ms) => new Promise((res) => setTimeout(res, ms))

async function fetchPage(url) {
    await delay(DELAY_MS)
    const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT }
    })
    if (!res.ok) {
        console.warn(`  ⚠ Failed to fetch ${url} — status ${res.status}`)
        return null
    }
    return res.text()
}

// ── Academic programs root ────────────────────────────────
const PROGRAMS_ROOT = 'https://franciscan.smartcatalogiq.com/en/2025-2026/undergraduate-catalog-2025-2026/academic-programs'

// ── Discover all degree program URLs ─────────────────────
async function discoverDegrees() {
    console.log('🔍 Discovering all degree programs...')
    const html = await fetchPage(PROGRAMS_ROOT)
    if (!html) return []

    const $ = cheerio.load(html)
    const deptUrls = []

    // Step 1 — collect all department pages (one level under /academic-programs/)
    $('a[href]').each((_, el) => {
        const href = $(el).attr('href') ?? ''
        const full = href.startsWith('http')
            ? href
            : `https://franciscan.smartcatalogiq.com${href}`
        const match = href.match(/\/academic-programs\/([a-z0-9\-]+)$/)
        if (match && href.includes('2025-2026')) {
            if (!deptUrls.includes(full)) deptUrls.push(full)
        }
    })

    console.log(`   Found ${deptUrls.length} department pages`)

    // Step 2 — visit each department page and find individual degree links
    const degrees = []
    for (const deptUrl of deptUrls) {
        const deptHtml = await fetchPage(deptUrl)
        if (!deptHtml) continue

        const $dept = cheerio.load(deptHtml)

        $dept('a[href]').each((_, el) => {
            const href = $dept(el).attr('href') ?? ''
            const text = $dept(el).text().trim()
            const full = href.startsWith('http')
                ? href
                : `https://franciscan.smartcatalogiq.com${href}`

            // Degree pages are two levels under /academic-programs/
            const match = href.match(/\/academic-programs\/([a-z0-9\-]+)\/([a-z0-9\-]+)$/)
            if (match && href.includes('2025-2026') && text.length > 5) {
                if (!degrees.find(d => d.url === full)) {
                    degrees.push({ url: full, name: text })
                }
            }
        })
    }

    console.log(`   Found ${degrees.length} degree programs`)
    return degrees
}

// ── Parse a degree program page ───────────────────────────
function parseDegree($, url) {
    const allH1s = $('h1').map((_, el) => $(el).text().trim()).get()
    const h1 = allH1s.find(t => t !== 'Franciscan University of Steubenville') ?? ''
    if (!h1) return null

    // Determine degree type from title
    const degreeType = h1.includes('Master') ? 'Master of Science'
        : h1.includes('Bachelor of Arts') ? 'Bachelor of Arts'
            : 'Bachelor of Science'

    // Generate a clean ID from the title
    const id = h1
        .replace(/Bachelor of (Science|Arts)|Master of Science/gi, '')
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .trim()
        .toUpperCase()
        .replace(/\s+/g, '_')
        .slice(0, 30)

    // Total credits
    const bodyText = $('body').text()
    const creditsMatch = bodyText.match(/(\d{3})\s*(?:semester\s+)?credit\s+hours?/i)
    const totalCredits = creditsMatch ? parseInt(creditsMatch[1]) : null

    // Description — first substantial paragraph
    let description = null
    $('p').each((_, el) => {
        const text = $(el).text().trim()
        if (!description && text.length > 80) description = text
    })

    // Requirement groups — look for headers followed by course lists
    const requirementGroups = []
    let groupPosition = 0

    $('h2, h3, h4').each((_, heading) => {
        const label = $(heading).text().trim()
        if (!label || label.length > 80) return

        // Skip navigation headings
        if (/catalog|contents|search|links/i.test(label)) return

        const courses = []
        let chooseOne = /choose one|select one/i.test(label)
        let elective = /elective/i.test(label)

        // Look for course codes in siblings after this heading
        $(heading).nextAll().each((_, el) => {
            const tag = el.tagName?.toLowerCase()
            // Stop at next heading of same or higher level
            if (['h2', 'h3', 'h4'].includes(tag)) return false

            const text = $(el).text()
            const codes = text.match(/[A-Z]{2,4}\s\d{3}[A-Z]?/g) ?? []
            codes.forEach(code => {
                const id = code.replace(/\s+/g, '')
                if (!courses.includes(id)) courses.push(id)
            })
        })

        if (courses.length > 0 || elective) {
            requirementGroups.push({
                id: `${id}_${groupPosition}`,
                label,
                courses,
                chooseOne,
                elective,
                position: groupPosition++
            })
        }
    })

    return {
        id,
        name: h1,
        degree: degreeType,
        totalCredits,
        description,
        catalogUrl: url,
        requirementGroups
    }
}

// ── Auto-sequence algorithm ───────────────────────────────
async function autoSequence(degreeId, requirementGroups) {
    // Get all required course IDs
    const allCourseIds = [...new Set(
        requirementGroups.flatMap(g => g.courses)
    )]

    if (!allCourseIds.length) return []

    // Fetch course data from Supabase (prereqs, credits)
    const { data: courses, error } = await supabase
        .from('courses')
        .select('id, credits, prerequisites, corequisites')
        .in('id', allCourseIds)

    if (error || !courses?.length) {
        console.warn(`   ⚠ Could not fetch course data for sequencing`)
        return []
    }

    const courseMap = Object.fromEntries(courses.map(c => [c.id, c]))

    // Assign minimum semester based on prereq depth
    const semesterMap = {}

    function getMinSemester(courseId, visited = new Set()) {
        if (semesterMap[courseId] !== undefined) return semesterMap[courseId]
        if (visited.has(courseId)) return 1 // circular dep guard

        visited.add(courseId)
        const course = courseMap[courseId]
        if (!course) return 1

        const prereqs = course.prerequisites ?? []
        // Filter to only prereqs that are also in this degree
        const relevantPrereqs = prereqs.filter(p => allCourseIds.includes(p))

        if (!relevantPrereqs.length) {
            semesterMap[courseId] = 1
            return 1
        }

        const maxPrereqSem = Math.max(
            ...relevantPrereqs.map(p => getMinSemester(p, new Set(visited)))
        )
        semesterMap[courseId] = maxPrereqSem + 1
        return semesterMap[courseId]
    }

    // Calculate min semester for all courses
    allCourseIds.forEach(id => getMinSemester(id))

    // Group courses by their minimum semester
    const semesterBuckets = {}
    allCourseIds.forEach(id => {
        const sem = Math.min(semesterMap[id] ?? 1, 8)
        if (!semesterBuckets[sem]) semesterBuckets[sem] = []
        semesterBuckets[sem].push(id)
    })

    // Balance credit loads — target 12-15 major credits per semester
    const TARGET_CREDITS = 13
    const MAX_CREDITS = 16
    const balanced = Array.from({ length: 8 }, () => [])

    for (let sem = 1; sem <= 8; sem++) {
        const bucket = semesterBuckets[sem] ?? []
        let currentSem = sem

        for (const courseId of bucket) {
            const credits = courseMap[courseId]?.credits ?? 3
            const currentLoad = balanced[currentSem - 1].reduce(
                (sum, id) => sum + (courseMap[id]?.credits ?? 3), 0
            )

            if (currentLoad + credits > MAX_CREDITS && currentSem < 8) {
                // Try to push to next semester if prereqs allow
                const nextSem = currentSem + 1
                balanced[nextSem - 1].push(courseId)
            } else {
                balanced[currentSem - 1].push(courseId)
            }
        }
    }

    // Convert to semester plan objects
    const semLabels = [
        'Freshman Fall', 'Freshman Spring',
        'Sophomore Fall', 'Sophomore Spring',
        'Junior Fall', 'Junior Spring',
        'Senior Fall', 'Senior Spring'
    ]

    return balanced.map((courses, i) => ({
        degreeId,
        planType: 'auto',
        year: Math.ceil((i + 1) / 2),
        semester: (i % 2) + 1,
        label: semLabels[i],
        courses
    }))
}

// ── Save degree to Supabase ───────────────────────────────
async function saveDegree(degree, semesterPlans) {
    // Check if a higher-tier version already exists — if so, skip entirely
    const { data: existing } = await supabase
        .from('degrees')
        .select('tier')
        .eq('id', degree.id)
        .single()

    if (existing && existing.tier < degree.tier) {
        console.log(`  ⏭ Skipping ${degree.name} — existing Tier ${existing.tier} outranks incoming Tier ${degree.tier}`)
        return
    }

    // Upsert degree row
    const { error: degreeError } = await supabase
        .from('degrees')
        .upsert({
            id: degree.id,
            name: degree.name,
            degree: degree.degree,
            total_credits: degree.totalCredits,
            description: degree.description,
            catalog_url: degree.catalogUrl,
            tier: 2,
            last_scraped_at: new Date().toISOString()
        }, { onConflict: 'id' })

    if (degreeError) {
        console.error(`  ✗ Failed to save degree ${degree.id}:`, degreeError.message)
        return
    }

    // Delete existing child data and reinsert fresh
    await supabase.from('degree_requirement_groups').delete().eq('degree_id', degree.id)
    await supabase.from('degree_semester_plans').delete().eq('degree_id', degree.id)

    // Insert requirement groups and their courses
    for (const group of degree.requirementGroups) {
        const { error: groupError } = await supabase
            .from('degree_requirement_groups')
            .insert({
                id: group.id,
                degree_id: degree.id,
                label: group.label,
                choose_one: group.chooseOne,
                elective: group.elective,
                position: group.position
            })

        if (groupError) {
            console.warn(`    ⚠ Group insert failed: ${groupError.message}`)
            continue
        }

        if (group.courses.length) {
            const courseRows = group.courses.map(courseId => ({
                group_id: group.id,
                course_id: courseId
            }))
            await supabase.from('degree_requirement_courses').insert(courseRows)
        }
    }

    // Insert semester plans
    for (const plan of semesterPlans) {
        const { data: planRow, error: planError } = await supabase
            .from('degree_semester_plans')
            .insert({
                degree_id: plan.degreeId,
                plan_type: plan.planType,
                year: plan.year,
                semester: plan.semester,
                label: plan.label
            })
            .select()
            .single()

        if (planError) {
            console.warn(`    ⚠ Semester plan insert failed: ${planError.message}`)
            continue
        }

        if (plan.courses.length) {
            const courseRows = plan.courses.map((courseId, i) => ({
                semester_plan_id: planRow.id,
                course_id: courseId,
                position: i
            }))
            await supabase.from('degree_semester_courses').insert(courseRows)
        }
    }

    console.log(`  ✓ Saved ${degree.name} — ${degree.requirementGroups.length} groups, ${semesterPlans.length} semesters`)
}

// ── Main ──────────────────────────────────────────────────
async function main() {
    console.log('🎓 FUS Degree Scraper starting...')
    console.log(`   Delay between requests: ${DELAY_MS}ms`)
    console.log('')

    const degreeUrls = await discoverDegrees()
    if (!degreeUrls.length) {
        console.error('No degrees found — aborting')
        process.exit(1)
    }

    let saved = 0
    let skipped = 0
    let protected_ = 0

    for (const { url, name } of degreeUrls) {
        console.log(`📋 ${name}`)

        const html = await fetchPage(url)
        if (!html) { skipped++; continue }

        const $ = cheerio.load(html)
        const degree = parseDegree($, url)

        if (!degree || !degree.requirementGroups.length) {
            console.log(`   ✗ Could not parse or no requirements found`)
            skipped++
            continue
        }

        // Check tier before sequencing to avoid unnecessary Supabase calls
        const { data: existing } = await supabase
            .from('degrees')
            .select('tier')
            .eq('id', degree.id)
            .single()

        if (existing && existing.tier < 2) {
            console.log(`  ⏭ Skipping ${degree.name} — Tier ${existing.tier} protected`)
            protected_++
            continue
        }

        const semesterPlans = await autoSequence(degree.id, degree.requirementGroups)
        await saveDegree(degree, semesterPlans)
        saved++
    }

    console.log('')
    console.log(`📝 Degrees saved: ${saved} — Skipped: ${skipped} — Protected (higher tier): ${protected_}`)
    console.log('✅ Degree scrape complete!')
}

main().catch((err) => {
    console.error('Fatal error:', err)
    process.exit(1)
})