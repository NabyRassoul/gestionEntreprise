import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard-salesforce'
import SubmitCRA from './pages/SubmitCRA'
import ValidationCRA from './pages/ValidationCRA'
import PrivateRoute from './components/PrivateRoute'
import ProjectsManagement from './pages/ProjectsManagement'
import ProjectAssignments from './pages/ProjectAssignments'
import UsersManagement from './pages/UsersManagement'

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          {/* Toutes les autres routes dans Layout */}
          <Route path="/*" element={
            <PrivateRoute>
              <Layout>
                <Routes>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/cra/submit" element={<SubmitCRA />} />
                  <Route path="/admin/validation" element={<ValidationCRA />} />
                  <Route path="/admin/projects" element={<ProjectsManagement />} />
                  <Route path="/admin/assignments" element={<ProjectAssignments />} />
                  <Route path="/admin/users" element={<UsersManagement />} />
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </Layout>
            </PrivateRoute>
          } />
        </Routes>
      </Router>
    </AuthProvider>
  )
}

export default App