import { Routes, Route, Navigate } from 'react-router';
import { AuthGuard, AdminGuard } from './components/AuthGuard';
import Layout from './components/Layout';
import { ToastProvider } from './hooks/useToast';
import Dashboard from './pages/Dashboard';
import SearchPage from './pages/SearchPage';
import LeadsPage from './pages/LeadsPage';
import LeadDetailPage from './pages/LeadDetailPage';
import PipelinePage from './pages/PipelinePage';
import OutreachPage from './pages/OutreachPage';
import EmailPage from './pages/EmailPage';
import KimiPage from './pages/KimiPage';
import SettingsPage from './pages/SettingsPage';
import AdminDashboard from './pages/AdminDashboard';
import Login from './pages/Login';
import NotFound from './pages/NotFound';

function AppLayout({ children }: { children: React.ReactNode }) {
  console.log('[RENDER] AppLayout');
  return <Layout>{children}</Layout>;
}

export default function App() {
  console.log('[RENDER] App');
  return (
    <ToastProvider>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />

        {/* Redirect root to dashboard (AuthGuard handles login redirect) */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* Protected routes */}
        <Route
          path="/dashboard"
          element={
            <AuthGuard>
              <AppLayout>
                <Dashboard />
              </AppLayout>
            </AuthGuard>
          }
        />
        <Route
          path="/search"
          element={
            <AuthGuard>
              <AppLayout>
                <SearchPage />
              </AppLayout>
            </AuthGuard>
          }
        />
        <Route
          path="/leads"
          element={
            <AuthGuard>
              <AppLayout>
                <LeadsPage />
              </AppLayout>
            </AuthGuard>
          }
        />
        <Route
          path="/leads/:id"
          element={
            <AuthGuard>
              <AppLayout>
                <LeadDetailPage />
              </AppLayout>
            </AuthGuard>
          }
        />
        <Route
          path="/pipeline"
          element={
            <AuthGuard>
              <AppLayout>
                <PipelinePage />
              </AppLayout>
            </AuthGuard>
          }
        />
        <Route
          path="/outreach"
          element={
            <AuthGuard>
              <AppLayout>
                <OutreachPage />
              </AppLayout>
            </AuthGuard>
          }
        />
        <Route
          path="/email"
          element={
            <AuthGuard>
              <AppLayout>
                <EmailPage />
              </AppLayout>
            </AuthGuard>
          }
        />
        <Route
          path="/kimi"
          element={
            <AuthGuard>
              <AppLayout>
                <KimiPage />
              </AppLayout>
            </AuthGuard>
          }
        />
        <Route
          path="/settings"
          element={
            <AuthGuard>
              <AppLayout>
                <SettingsPage />
              </AppLayout>
            </AuthGuard>
          }
        />
        <Route
          path="/admin"
          element={
            <AdminGuard>
              <AppLayout>
                <AdminDashboard />
              </AppLayout>
            </AdminGuard>
          }
        />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </ToastProvider>
  );
}
