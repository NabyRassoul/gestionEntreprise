import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import Layout from './components/Layout'
import PrivateRoute from './components/PrivateRoute'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import SubmitCRA from './pages/SubmitCRA'
import CRAHistory from './pages/CRAHistory'
import ValidationCRA from './pages/ValidationCRA'
import ProjectsManagement from './pages/ProjectsManagement'
import ProjectAssignments from './pages/ProjectAssignments'
import UsersManagement from './pages/UsersManagement'
import Holidays from './pages/Holidays'
import { FeedbackProvider } from './contexts/FeedbackContext'
import Profile from './pages/Profile'
// Qui peut accéder à quoi
const CONTRIBUTORS = ['collaborator', 'manager'] // saisissent un CRA
const MANAGERS = ['manager', 'admin']
const ADMINS = ['admin']

const guard = (element, roles) => <PrivateRoute roles={roles}>{element}</PrivateRoute>

function App() {
  return (
    <AuthProvider>
        <FeedbackProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* Toutes les autres routes : connecté + Layout */}
          <Route
            path="/*"
            element={
              <PrivateRoute>
                <Layout>
                  <Routes>
                    <Route path="/dashboard" element={<Dashboard />} />
                     <Route path="/profile" element={<Profile />} />
                    {/* Collaborateurs & managers */}
                    <Route path="/cra/submit" element={guard(<SubmitCRA />, CONTRIBUTORS)} />
                    <Route path="/cra/history" element={guard(<CRAHistory />, CONTRIBUTORS)} />

                    {/* Managers & admins */}
                    <Route path="/admin/validation" element={guard(<ValidationCRA />, MANAGERS)} />
                    <Route path="/admin/projects" element={guard(<ProjectsManagement />, MANAGERS)} />
                    <Route path="/admin/assignments" element={guard(<ProjectAssignments />, MANAGERS)} />

                    {/* Admins */}
                    <Route path="/admin/users" element={guard(<UsersManagement />, ADMINS)} />
                    <Route path="/admin/holidays" element={guard(<Holidays />, ADMINS)} />

                    {/* Racine + URL inconnue → dashboard */}
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                  </Routes>
                </Layout>
              </PrivateRoute>
            }
          />
        </Routes>
      </Router>
       </FeedbackProvider>
    </AuthProvider>
  )
}

export default App