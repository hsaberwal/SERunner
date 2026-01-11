import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Locations from './pages/Locations'
import SetupGenerator from './pages/SetupGenerator'
import SetupHistory from './pages/SetupHistory'
import SetupDetail from './pages/SetupDetail'
import Gear from './pages/Gear'
import './App.css'

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="loading">Loading...</div>
  }

  return user ? children : <Navigate to="/login" />
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="app">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route
              path="/"
              element={
                <PrivateRoute>
                  <Dashboard />
                </PrivateRoute>
              }
            />
            <Route
              path="/locations"
              element={
                <PrivateRoute>
                  <Locations />
                </PrivateRoute>
              }
            />
            <Route
              path="/generate"
              element={
                <PrivateRoute>
                  <SetupGenerator />
                </PrivateRoute>
              }
            />
            <Route
              path="/history"
              element={
                <PrivateRoute>
                  <SetupHistory />
                </PrivateRoute>
              }
            />
            <Route
              path="/setup/:id"
              element={
                <PrivateRoute>
                  <SetupDetail />
                </PrivateRoute>
              }
            />
            <Route
              path="/gear"
              element={
                <PrivateRoute>
                  <Gear />
                </PrivateRoute>
              }
            />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  )
}

export default App
