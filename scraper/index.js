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
const USER_AGENT = 'FUS-Planner-Bot/1.0 (student academic planner tool; contact: your@email.com)'

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

// ── Catalog root — we discover ALL departments from here ──
const CATALOG_COURSES_ROOT = 'https://franciscan.smartcatalogiq.com/en/2025-2026/undergraduate-catalog-2025-2026/courses'

// ── Discover all department index URLs from the courses root
async function discoverDepartments() {
    console.log('🔍 Discovering all departments...')
    const html = await fetchPage(CATALOG_COURSES_ROOT)
    if (!html) return []

    const $ = cheerio.load(html)
    const departments = []

    // Each department is a link under the courses section in the sidebar
    $('a[href]').each((_, el) => {
        const href = $(el).attr('href') ?? ''
        const text = $(el).text().trim()
        // Department index pages are one level under /courses/ with no further path
        const match = href.match(/\/courses\/([a-z0-9\-]+)$/)
        if (match && href.includes('2025-2026')) {
            const full = href.startsWith('http')
                ? href
                : `https://franciscan.smartcatalogiq.com${href}`
            // Extract prefix like CSC, MTH, SFE from the text
            const prefixMatch = text.match(/^([A-Z]{2,4})\s*[-–]/)
            const prefix = prefixMatch ? prefixMatch[1] : match[1].split('-')[0].toUpperCase()
            const name = text.replace(/^[A-Z]{2,4}\s*[-–]\s*/, '').replace(/\s*Course Descriptions.*$/i, '').trim()
            if (!departments.find(d => d.url === full)) {
                departments.push({ url: full, prefix, name })
            }
        }
    })

    console.log(`   Found ${departments.length} departments`)
    return departments
}

// ── Find level subpages (100, 200, 300, 400) under a department
async function findLevelPages(deptUrl) {
    const html = await fetchPage(deptUrl)
    if (!html) return []

    const $ = cheerio.load(html)
    const levels = []

    $('a[href]').each((_, el) => {
        const href = $(el).attr('href') ?? ''
        const full = href.startsWith('http')
            ? href
            : `https://franciscan.smartcatalogiq.com${href}`
        // Level pages end in /100 /200 /300 /400 /500
        if (full.startsWith(deptUrl + '/') && /\/\d00$/.test(full)) {
            if (!levels.includes(full)) levels.push(full)
        }
    })

    // If no level subpages found, the dept page itself lists courses
    return levels.length > 0 ? levels : [deptUrl]
}

// ── Find individual course links on a level page ──────────
function findCourseLinks($, levelUrl) {
    const links = []
    $('a[href]').each((_, el) => {
        const href = $(el).attr('href') ?? ''
        const full = href.startsWith('http')
            ? href
            : `https://franciscan.smartcatalogiq.com${href}`
        if (full.startsWith(levelUrl + '/') && full !== levelUrl) {
            if (!links.includes(full)) links.push(full)
        }
    })
    return links
}

// ── Parse a single course page ────────────────────────────
function parseCourse($, url, department) {
    const h1 = $('h1').first().text().trim()
    const allH1s = $('h1').map((_, el) => $(el).text().trim()).get()

    console.log(`       [DEBUG] h1 text: "${h1}"`)
    console.log(`       [DEBUG] all h1s: ${JSON.stringify(allH1s)}`)

    const codeMatch = h1.match(/^([A-Z]{2,4}\s\d{3}[A-Z]?)\s+(.+)/)
    if (!codeMatch) {
        // Try alternate format — some pages may have code and title split
        const altMatch = h1.match(/^([A-Z]{2,4}\s?\d{3}[A-Z]?)$/)
        console.log(`       [DEBUG] altMatch: ${JSON.stringify(altMatch)}`)
        return null
    }

    const code = codeMatch[1].trim()
    const id = code.replace(/\s+/g, '')
    const title = codeMatch[2].trim()

    // Credits
    let credits = null
    const bodyText = $('body').text()
    console.log(`       [DEBUG] body snippet: "${bodyText.slice(0, 300).replace(/\n/g, '|')}"`)

    $('h3, h2, strong, b').each((_, el) => {
        if (/^credits?$/i.test($(el).text().trim())) {
            const next = $(el).next()
            const val = parseInt(next.text().trim())
            if (!isNaN(val)) credits = val
        }
    })

    if (!credits) {
        const m = bodyText.match(/Credits?\s*\n\s*(\d+)/)
        if (m) credits = parseInt(m[1])
    }

    const prereqText = $('*').filter((_, el) =>
        /Prerequisite/i.test($(el).text()) && $(el).text().length < 400
    ).first().text()
    const prereqs = parseCourseCodes(prereqText)

    const coreqText = $('*').filter((_, el) =>
        /Corequisite/i.test($(el).text()) && $(el).text().length < 400
    ).first().text()
    const coreqs = parseCourseCodes(coreqText)

    let description = null
    $('p').each((_, el) => {
        const text = $(el).text().trim()
        if (!description && text.length > 60) description = text
    })

    const typicallyOffered = []
    if (/offered.{0,30}fall|fall.{0,30}semester/i.test(bodyText)) typicallyOffered.push('fall')
    if (/offered.{0,30}spring|spring.{0,30}semester/i.test(bodyText)) typicallyOffered.push('spring')
    if (/offered.{0,30}summer|summer.{0,30}semester/i.test(bodyText)) typicallyOffered.push('summer')

    return {
        id, code, title, credits, description,
        prerequisites: prereqs,
        corequisites: coreqs,
        department,
        typically_offered: typicallyOffered.length ? typicallyOffered : null,
        catalog_url: url,
        last_scraped_at: new Date().toISOString()
    }
}

// ── Extract course codes like CSC144, MTH 161 ─────────────
function parseCourseCodes(text) {
    if (!text) return []
    const matches = text.match(/[A-Z]{2,4}\s?\d{3}[A-Z]?/g) ?? []
    return [...new Set(matches.map((c) => c.replace(/\s+/g, '')))]
}

// ── Main ──────────────────────────────────────────────────
async function main() {
    console.log('🎓 FUS Course Scraper starting...')
    console.log(`   Delay between requests: ${DELAY_MS}ms`)
    console.log('')

    const departments = await discoverDepartments()
    if (!departments.length) {
        console.error('No departments found — aborting')
        process.exit(1)
    }

    const allCourses = []
    const seen = new Set()

    for (const { url: deptUrl, prefix, name } of departments.slice(0, 2)) {
        console.log(`📚 ${prefix} — ${name}`)

        const levels = await findLevelPages(deptUrl)

        for (const levelUrl of levels) {
            const indexHtml = await fetchPage(levelUrl)
            if (!indexHtml) continue

            const $ = cheerio.load(indexHtml)
            const courseLinks = findCourseLinks($, levelUrl)
            if (!courseLinks.length) continue
            console.log(`   📂 ${levelUrl.split('/').pop()} — ${courseLinks.length} courses`)

            for (const courseUrl of courseLinks) {
                if (seen.has(courseUrl)) continue
                seen.add(courseUrl)

                const html = await fetchPage(courseUrl)
                if (!html) continue

                const $course = cheerio.load(html)
                const course = parseCourse($course, courseUrl, name)

                if (course) {
                    console.log(`     ✓ ${course.id} — ${course.title} (${course.credits ?? '?'} cr)`)
                    allCourses.push(course)
                } else {
                    console.log(`     ✗ ${courseUrl.split('/').pop()} — could not parse`)
                }
            }
        }
    }

    console.log('')
    console.log(`📝 Total courses parsed: ${allCourses.length}`)
    console.log('💾 Upserting to Supabase...')

    const BATCH = 20
    for (let i = 0; i < allCourses.length; i += BATCH) {
        const batch = allCourses.slice(i, i + BATCH)
        const { error } = await supabase
            .from('courses')
            .upsert(batch, { onConflict: 'id' })

        if (error) {
            console.error(`  ✗ Batch ${i / BATCH + 1} failed:`, error.message)
        } else {
            console.log(`  ✓ Batch ${i / BATCH + 1} saved (${batch.length} courses)`)
        }
    }

    console.log('')
    console.log('✅ Scrape complete!')
}

main().catch((err) => {
    console.error('Fatal error:', err)
    process.exit(1)
})