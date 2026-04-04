import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const cards = [
  {
    to: '/degree',
    icon: '🎓',
    label: 'Degree Requirements',
    description: 'Browse CS requirements by category and track what you have completed.',
    accent: 'border-fus-green-400',
  },
  {
    to: '/minors',
    icon: '➕',
    label: 'Minors',
    description: 'Explore minors, see requirements, and find double-count opportunities.',
    accent: 'border-fus-gold-400',
  },
  {
    to: '/planner',
    icon: '📅',
    label: 'Semester Planner',
    description: 'Follow the recommended 4-year plan or map out your own schedule.',
    accent: 'border-fus-brown-400',
  },
]

export default function Home() {
  const { user } = useAuth()

  return (
    <div>
      {/* Hero */}
      <div className="text-center py-14 px-4">
        <div className="inline-block bg-fus-gold-100 text-fus-gold-700 text-xs font-semibold tracking-widest uppercase px-4 py-1.5 rounded-full mb-5">
          Franciscan University of Steubenville
        </div>
        <h1 className="text-4xl font-bold text-fus-green-700 mb-4 leading-tight">
          CS / SE Academic Planner
        </h1>
        <p className="text-gray-600 text-lg max-w-xl mx-auto mb-10 leading-relaxed">
          A student-built tool for Computer Science and Software Engineering students.
          Track your degree, explore minors, and plan your semesters — all in one place.
        </p>

        {/* Feature cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 max-w-3xl mx-auto text-left mb-12">
          {cards.map((card) => (
            <Link
              key={card.to}
              to={card.to}
              className={`block bg-white rounded-xl border-t-4 ${card.accent} border border-gray-100 p-5 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5`}
            >
              <div className="text-2xl mb-3">{card.icon}</div>
              <h2 className="font-semibold text-fus-green-700 mb-1 text-base">
                {card.label}
              </h2>
              <p className="text-sm text-gray-500 leading-relaxed">
                {card.description}
              </p>
            </Link>
          ))}
        </div>

        {/* Auth nudge */}
        {!user ? (
          <p className="text-sm text-gray-400">
            <Link to="/login" className="text-fus-green-600 font-medium hover:underline">
              Sign in
            </Link>{' '}
            to save your progress and sync across devices.
          </p>
        ) : (
          <p className="text-sm text-fus-green-600 font-medium">
            ✓ Signed in — your progress is saving automatically.
          </p>
        )}
      </div>

      {/* Info strip */}
      <div className="bg-fus-green-700 text-white rounded-xl px-8 py-6 max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <p className="font-semibold text-fus-gold-300 mb-0.5">
            Data sourced from the FUS Course Catalog
          </p>
          <p className="text-green-200 text-sm">
            Always verify course availability and requirements with your academic advisor.
          </p>
        </div>
        <a
          href="https://franciscan.smartcatalogiq.com/en/2025-2026/undergraduate-catalog-2025-2026/academic-programs/computer-science"
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 bg-fus-gold-400 hover:bg-fus-gold-300 text-fus-green-900 font-semibold text-sm px-5 py-2 rounded-full transition-colors"
        >
          View Catalog ↗
        </a>
      </div>
    </div>
  )
}
