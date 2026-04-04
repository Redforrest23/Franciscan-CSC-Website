# FUS CS/SE Planner

A student-built academic planning tool for Computer Science and Software Engineering students at Franciscan University of Steubenville.

## What It Does

- Browse CS and SE degree requirements, organized by category
- Add minors and see their requirements alongside your major
- Check off completed courses to track your progress
- See overlap between your major and minor requirements
- Follow a recommended 4-year plan or build your own
- Prerequisite awareness — warns when you haven't completed prereqs
- Progress bars per requirement group and overall degree completion

## Architecture

```
GitHub Pages (Frontend)
├── React + Vite (static build)
├── Tailwind CSS
└── /data (static JSON — catalog truth)
    ├── courses.json
    ├── degrees.json
    └── minors.json

Supabase (Backend)
├── Auth (email/password + Google)
└── PostgreSQL
    ├── profiles
    ├── completed_courses
    ├── selected_minors
    └── planned_courses
```

**Key principle:** The catalog (courses, degrees, minors) lives as static JSON in the repo. Supabase only stores per-user data. This means the site loads and displays information even when logged out, and catalog updates are just a GitHub commit.

## Project Structure

```
fus-cs-planner/
├── data/
│   ├── courses.json       # All CS/SE/MATH courses
│   ├── degrees.json       # Degree requirement groups + recommended tracks
│   └── minors.json        # Minor definitions with overlap notes
├── supabase/
│   └── schema.sql         # Run this in Supabase SQL Editor to set up tables
├── src/
│   ├── components/
│   │   ├── CourseCard.jsx
│   │   ├── DegreeProgress.jsx
│   │   ├── MinorBrowser.jsx
│   │   ├── PrereqTree.jsx
│   │   └── SemesterPlanner.jsx
│   ├── pages/
│   │   ├── Home.jsx
│   │   ├── Degree.jsx
│   │   ├── Minors.jsx
│   │   └── Planner.jsx
│   ├── lib/
│   │   ├── supabase.js    # Supabase client init
│   │   └── progress.js    # Overlap detection, prereq logic
│   └── App.jsx
├── public/
└── vite.config.js
```

## Setup

### 1. Clone & install
```bash
git clone https://github.com/yourusername/fus-cs-planner.git
cd fus-cs-planner
npm install
```

### 2. Set up Supabase
1. Create a free project at [supabase.com](https://supabase.com)
2. Go to SQL Editor and run the contents of `supabase/schema.sql`
3. Enable Google OAuth in Authentication > Providers (optional)
4. Copy your project URL and anon key

### 3. Environment variables
Create a `.env.local` file:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Run locally
```bash
npm run dev
```

### 5. Deploy to GitHub Pages
```bash
npm run build
# Push to GitHub, enable Pages from /dist or use gh-pages package
```

## Data Maintenance

The JSON files in `/data` are the source of truth for the catalog. To update:
- Add a new course → add an entry to `courses.json`
- Change a requirement → edit the relevant group in `degrees.json`
- Add a new minor → add an entry to `minors.json`

No database migration needed for catalog changes — just commit and push.

## Roadmap

- [ ] v1: Degree checklist + progress tracking
- [ ] v1: Minor browser + overlap detection  
- [ ] v1: Prerequisite warnings
- [ ] v2: 4-year planner with drag-and-drop semesters
- [ ] v2: Prerequisite tree visualization (D3.js)
- [ ] v3: Course availability calendar
- [ ] v3: Export plan as PDF
