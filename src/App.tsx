import { Routes, Route } from 'react-router-dom';
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

export default function App() {
  return (
    <ToastProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/leads" element={<LeadsPage />} />
          <Route path="/leads/:id" element={<LeadDetailPage />} />
          <Route path="/pipeline" element={<PipelinePage />} />
          <Route path="/outreach" element={<OutreachPage />} />
          <Route path="/email" element={<EmailPage />} />
          <Route path="/kimi" element={<KimiPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </Layout>
    </ToastProvider>
  );
}
