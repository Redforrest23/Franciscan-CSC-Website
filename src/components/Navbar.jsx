import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Navbar() {
  const { user, signOut } = useAuth()

  const navLinkClass = ({ isActive }) =>
    isActive
      ? 'text-fus-gold-400 font-semibold border-b-2 border-fus-gold-400 pb-0.5'
      : 'text-green-100 hover:text-fus-gold-300 transition-colors pb-0.5'

  return (
    <nav className="bg-fus-green-700 shadow-md">
      <div className="max-w-5xl mx-auto px-4 py-0 flex items-stretch justify-between">

        {/* Logo / wordmark */}
        <Link
          to="/"
          className="flex items-center gap-3 py-4 group"
        >
          <div className="flex flex-col leading-tight">
            <span className="text-white font-bold text-base tracking-wide">
              FUS CS/SE
            </span>
            <span className="text-fus-gold-300 text-xs font-medium tracking-widest uppercase">
              Planner
            </span>
          </div>
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-7 text-sm font-medium">
          <NavLink to="/degree" className={navLinkClass}>
            Degree
          </NavLink>
          <NavLink to="/minors" className={navLinkClass}>
            Minors
          </NavLink>
          <NavLink to="/planner" className={navLinkClass}>
            Planner
          </NavLink>

          <div className="w-px h-5 bg-green-600 mx-1" />

          {user ? (
            <button
              onClick={signOut}
              className="text-green-200 hover:text-red-300 transition-colors text-sm"
            >
              Sign out
            </button>
          ) : (
            <NavLink
              to="/login"
              className="bg-fus-gold-400 hover:bg-fus-gold-300 text-fus-green-900 font-semibold text-sm px-4 py-1.5 rounded-full transition-colors"
            >
              Sign in
            </NavLink>
          )}
        </div>
      </div>

      {/* Gold accent bar */}
      <div className="h-0.5 bg-fus-gold-400 w-full" />
    </nav>
  )
}
