import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import Degree from './pages/Degree'
import Minors from './pages/Minors'
import Planner from './pages/Planner'
import Login from './pages/Login'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename="/fus-cs-planner">
        <Navbar />
        <main className="max-w-5xl mx-auto px-4 py-8">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/degree" element={<Degree />} />
            <Route path="/minors" element={<Minors />} />
            <Route path="/planner" element={<Planner />} />
            <Route path="/login" element={<Login />} />
          </Routes>
        </main>
      </BrowserRouter>
    </AuthProvider>
  )
}
