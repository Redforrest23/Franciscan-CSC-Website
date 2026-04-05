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

// ── Discover all minor program URLs ──────────────────────
async function discoverMinors() {
    console.log('🔍 Discovering all minor programs...')
    const html = await fetchPage(PROGRAMS_ROOT)
    if (!html) return []

    const $ = cheerio.load(html)
    const deptUrls = []

    // Step 1 — collect all department pages
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

    // Step 2 — visit each department page and find minor links
    const minors = []
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

            // Minor pages are two levels under /academic-programs/
            const match = href.match(/\/academic-programs\/([a-z0-9\-]+)\/([a-z0-9\-]+)$/)
            if (
                match &&
                href.includes('2025-2026') &&
                text.toLowerCase().includes('minor') &&
                text.length > 5
            ) {
                if (!minors.find((m) => m.url === full)) {
                    minors.push({ url: full, name: text })
                }
            }
        })
    }

    console.log(`   Found ${minors.length} minor programs`)
    return minors
}

// ── Parse a minor program page ────────────────────────────
function parseMinor($, url, name) {
    const allH1s = $('h1').map((_, el) => $(el).text().trim()).get()
    const h1 = allH1s.find((t) => t !== 'Franciscan University of Steubenville') ?? name ?? ''
    if (!h1) return null

    // Generate a clean ID
    const id = h1
        .replace(/minor/gi, '')
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .trim()
        .toUpperCase()
        .replace(/\s+/g, '_')
        .slice(0, 30)
        + '_MINOR'

    // Department — infer from URL
    const urlParts = url.split('/')
    const deptSlug = urlParts[urlParts.length - 2] ?? ''
    const department = deptSlug
        .replace(/-/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase())

    // Total credits
    const bodyText = $('body').text()
    const creditsMatch = bodyText.match(/(\d{2,3})\s*(?:semester\s+)?credit\s+hours?/i)
    const totalCredits = creditsMatch ? parseInt(creditsMatch[1]) : null

    // Description — first substantial paragraph
    let description = null
    $('p').each((_, el) => {
        const text = $(el).text().trim()
        if (!description && text.length > 80) description = text
    })

    // Catalog link
    const catalogUrl = url

    // Requirement groups
    const requirementGroups = []
    let groupPosition = 0

    $('h2, h3, h4').each((_, heading) => {
        const label = $(heading).text().trim()
        if (!label || label.length > 100) return
        if (/catalog|contents|search|links|navigation/i.test(label)) return

        const courses = []
        const chooseOne = /choose one|select one/i.test(label)
        const elective = /elective/i.test(label)

        // Collect course codes in siblings after this heading
        $(heading).nextAll().each((_, el) => {
            const tag = el.tagName?.toLowerCase()
            if (['h2', 'h3', 'h4'].includes(tag)) return false

            const text = $(el).text()
            const codes = text.match(/[A-Z]{2,4}\s\d{3}[A-Z]?/g) ?? []
            codes.forEach((code) => {
                const courseId = code.replace(/\s+/g, '')
                if (!courses.includes(courseId)) courses.push(courseId)
            })
        })

        if (courses.length > 0 || elective) {
            requirementGroups.push({
                id: `${id}_${groupPosition}`,
                label,
                courses,
                chooseOne,
                elective,
                position: groupPosition++,
            })
        }
    })

    // If no requirement groups found via headings, try scanning the whole page
    // for course codes as a fallback
    if (!requirementGroups.length) {
        const allCodes = []
        $('body').find('*').each((_, el) => {
            const text = $(el).children().length === 0 ? $(el).text() : ''
            const codes = text.match(/[A-Z]{2,4}\s\d{3}[A-Z]?/g) ?? []
            codes.forEach((code) => {
                const courseId = code.replace(/\s+/g, '')
                if (!allCodes.includes(courseId)) allCodes.push(courseId)
            })
        })
        if (allCodes.length) {
            requirementGroups.push({
                id: `${id}_0`,
                label: 'Required Courses',
                courses: allCodes,
                chooseOne: false,
                elective: false,
                position: 0,
            })
        }
    }

    return {
        id,
        name: h1,
        department,
        totalCredits,
        description,
        catalogUrl,
        requirementGroups,
    }
}

// ── Save minor to Supabase ────────────────────────────────
async function saveMinor(minor) {
    // Upsert minor row
    const { error: minorError } = await supabase
        .from('minors')
        .upsert(
            {
                id: minor.id,
                name: minor.name,
                department: minor.department,
                total_credits: minor.totalCredits,
                description: minor.description,
                catalog_url: minor.catalogUrl,
                last_scraped_at: new Date().toISOString(),
            },
            { onConflict: 'id' }
        )

    if (minorError) {
        console.error(`  ✗ Failed to save minor ${minor.id}:`, minorError.message)
        return
    }

    // Delete existing requirement groups and reinsert fresh
    await supabase.from('minor_requirement_groups').delete().eq('minor_id', minor.id)

    for (const group of minor.requirementGroups) {
        const { error: groupError } = await supabase
            .from('minor_requirement_groups')
            .insert({
                id: group.id,
                minor_id: minor.id,
                label: group.label,
                choose_one: group.chooseOne,
                elective: group.elective,
                position: group.position,
            })

        if (groupError) {
            console.warn(`    ⚠ Group insert failed: ${groupError.message}`)
            continue
        }

        if (group.courses.length) {
            const courseRows = group.courses.map((courseId) => ({
                group_id: group.id,
                course_id: courseId,
            }))
            await supabase.from('minor_requirement_courses').insert(courseRows)
        }
    }

    console.log(
        `  ✓ Saved ${minor.name} — ${minor.requirementGroups.length} groups, ${minor.totalCredits ?? '?'} credits`
    )
}

// ── Main ──────────────────────────────────────────────────
async function main() {
    console.log('📚 FUS Minor Scraper starting...')
    console.log(`   Delay between requests: ${DELAY_MS}ms`)
    console.log('')

    const minorUrls = await discoverMinors()
    if (!minorUrls.length) {
        console.error('No minors found — aborting')
        process.exit(1)
    }

    let saved = 0
    let skipped = 0

    for (const { url, name } of minorUrls) {
        console.log(`📋 ${name}`)

        const html = await fetchPage(url)
        if (!html) {
            skipped++
            continue
        }

        const $ = cheerio.load(html)
        const minor = parseMinor($, url, name)

        if (!minor) {
            console.log(`   ✗ Could not parse`)
            skipped++
            continue
        }

        if (!minor.requirementGroups.length) {
            console.log(`   ✗ No requirements found — skipping`)
            skipped++
            continue
        }

        await saveMinor(minor)
        saved++
    }

    console.log('')
    console.log(`📝 Minors saved: ${saved} — Skipped: ${skipped}`)
    console.log('✅ Minor scrape complete!')
}

main().catch((err) => {
    console.error('Fatal error:', err)
    process.exit(1)
})