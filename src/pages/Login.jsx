import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { signInWithEmail, signUpWithEmail, signInWithGoogle } = useAuth()
  const navigate = useNavigate()

  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleEmailSubmit(e) {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setLoading(true)

    const { error } =
      mode === 'signin'
        ? await signInWithEmail(email, password)
        : await signUpWithEmail(email, password)

    setLoading(false)

    if (error) {
      setError(error.message)
    } else if (mode === 'signup') {
      setMessage('Check your email for a confirmation link before signing in.')
    } else {
      navigate('/')
    }
  }

  async function handleGoogle() {
    setError(null)
    const { error } = await signInWithGoogle()
    if (error) setError(error.message)
    // Supabase redirects automatically on success
  }

  return (
    <div className="max-w-sm mx-auto mt-16">
      <h1 className="text-2xl font-bold text-gray-900 mb-2 text-center">
        {mode === 'signin' ? 'Sign in' : 'Create account'}
      </h1>
      <p className="text-sm text-gray-500 text-center mb-8">
        {mode === 'signin'
          ? 'Sign in to save and sync your academic plan.'
          : 'Create a free account to track your degree progress.'}
      </p>

      {/* Google */}
      <button
        onClick={handleGoogle}
        className="w-full flex items-center justify-center gap-3 border border-gray-300 rounded-lg px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors mb-4"
      >
        <svg className="w-4 h-4" viewBox="0 0 48 48">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
        </svg>
        Continue with Google
      </button>

      <div className="flex items-center gap-3 my-4">
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-xs text-gray-400">or</span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>

      {/* Email form */}
      <form onSubmit={handleEmailSubmit} className="flex flex-col gap-3">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        />

        {error && (
          <p className="text-sm text-red-500">{error}</p>
        )}
        {message && (
          <p className="text-sm text-green-600">{message}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {loading
            ? 'Loading...'
            : mode === 'signin'
            ? 'Sign in'
            : 'Create account'}
        </button>
      </form>

      {/* Toggle mode */}
      <p className="text-sm text-center text-gray-500 mt-6">
        {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
        <button
          onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); setMessage(null) }}
          className="text-blue-500 hover:underline"
        >
          {mode === 'signin' ? 'Sign up' : 'Sign in'}
        </button>
      </p>
    </div>
  )
}
