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

// ── Department catalog index pages to scrape ─────────────
const DEPARTMENT_INDEXES = [
    {
        department: 'Computer Science',
        url: 'https://franciscan.smartcatalogiq.com/en/2025-2026/undergraduate-catalog-2025-2026/academic-programs/computer-science'
    },
    {
        department: 'Software Engineering',
        url: 'https://franciscan.smartcatalogiq.com/en/2025-2026/undergraduate-catalog-2025-2026/academic-programs/engineering'
    },
    {
        department: 'Mathematics',
        url: 'https://franciscan.smartcatalogiq.com/en/2025-2026/undergraduate-catalog-2025-2026/academic-programs/mathematics'
    },
    {
        department: 'Physics',
        url: 'https://franciscan.smartcatalogiq.com/en/2025-2026/undergraduate-catalog-2025-2026/academic-programs/physics'
    }
]

// ── Parse a single course page ────────────────────────────
function parseCourse($, url, department) {
    // SmartCatalogIQ course pages follow a consistent structure
    const title = $('h1.page-title, h1').first().text().trim()
    const codeMatch = title.match(/^([A-Z]{2,4}\s?\d{3}[A-Z]?)/)
    const code = codeMatch ? codeMatch[1].trim() : null

    if (!code) return null

    const id = code.replace(/\s+/g, '')

    // Credits
    const creditsText = $('*:contains("Credit")').filter((_, el) =>
        /\d+\s+Credit/i.test($(el).text())
    ).first().text()
    const creditsMatch = creditsText.match(/(\d+)\s+Credit/i)
    const credits = creditsMatch ? parseInt(creditsMatch[1]) : null

    // Description — usually the first substantial paragraph
    const description = $('.desc, .course-desc, #course-description, .sc-courseitem-desc')
        .first().text().trim()
        || $('p').filter((_, el) => $(el).text().length > 80).first().text().trim()

    // Prerequisites — look for "Prerequisite:" text
    const prereqText = $('*:contains("Prerequisite")').filter((_, el) =>
        /Prerequisite/i.test($(el).text()) && $(el).text().length < 300
    ).first().text()
    const prereqs = parseCourseCodes(prereqText)

    // Corequisites
    const coreqText = $('*:contains("Corequisite")').filter((_, el) =>
        /Corequisite/i.test($(el).text()) && $(el).text().length < 300
    ).first().text()
    const coreqs = parseCourseCodes(coreqText)

    // Typically offered
    const offeredText = $('*:contains("offered"), *:contains("Offered")').first().text().toLowerCase()
    const typicallyOffered = []
    if (offeredText.includes('fall')) typicallyOffered.push('fall')
    if (offeredText.includes('spring')) typicallyOffered.push('spring')
    if (offeredText.includes('summer')) typicallyOffered.push('summer')

    return {
        id,
        code,
        title: title.replace(codeMatch?.[0] ?? '', '').replace(/^[\s\-–:]+/, '').trim() || title,
        credits,
        description: description || null,
        prerequisites: prereqs,
        corequisites: coreqs,
        department,
        typically_offered: typicallyOffered.length ? typicallyOffered : null,
        catalog_url: url,
        last_scraped_at: new Date().toISOString()
    }
}

// Extract course codes like CSC144, MTH 161 from a string
function parseCourseCodes(text) {
    if (!text) return []
    const matches = text.match(/[A-Z]{2,4}\s?\d{3}[A-Z]?/g) ?? []
    return [...new Set(matches.map((c) => c.replace(/\s+/g, '')))]
}

// ── Find all course links on a department index page ──────
function findCourseLinks($, baseUrl) {
    const links = []
    $('a[href]').each((_, el) => {
        const href = $(el).attr('href')
        if (!href) return
        // Course pages have a course code pattern in the URL
        if (/\/[a-z]{2,4}-\d{3}/i.test(href) || /course/i.test(href)) {
            const full = href.startsWith('http')
                ? href
                : `https://franciscan.smartcatalogiq.com${href}`
            if (!links.includes(full)) links.push(full)
        }
    })
    return links
}

// ── Main ──────────────────────────────────────────────────
async function main() {
    console.log('🎓 FUS Course Scraper starting...')
    console.log(`   Delay between requests: ${DELAY_MS}ms`)
    console.log(`   Departments: ${DEPARTMENT_INDEXES.map(d => d.department).join(', ')}`)
    console.log('')

    const allCourses = []

    for (const { department, url } of DEPARTMENT_INDEXES) {
        console.log(`📚 Scraping department index: ${department}`)

        const indexHtml = await fetchPage(url)
        if (!indexHtml) continue

        const $ = cheerio.load(indexHtml)
        const courseLinks = findCourseLinks($, url)
        console.log(`   Found ${courseLinks.length} course links`)

        for (const courseUrl of courseLinks) {
            console.log(`   → ${courseUrl}`)
            const html = await fetchPage(courseUrl)
            if (!html) continue

            const $course = cheerio.load(html)
            const course = parseCourse($course, courseUrl, department)

            if (course) {
                console.log(`     ✓ ${course.id} — ${course.title} (${course.credits} cr)`)
                allCourses.push(course)
            } else {
                console.log(`     ✗ Could not parse course`)
            }
        }

        console.log('')
    }

    console.log(`📝 Total courses parsed: ${allCourses.length}`)
    console.log('💾 Upserting to Supabase...')

    // Upsert in batches of 20
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