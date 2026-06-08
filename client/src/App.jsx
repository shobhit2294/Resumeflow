import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import useAuthStore from './context/authStore';

import Layout from './components/layout/Layout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import PipelinePage from './pages/PipelinePage';
import AnalyticsPage from './pages/AnalyticsPage';
import InterviewPage from './pages/InterviewPage';
import InterviewSessionPage from './pages/InterviewSessionPage';
import VideoInterviewPage from './pages/VideoInterviewPage';
import JobsSearchPage from './pages/JobsSearchPage';
import ApplicationTrackerPage from './pages/ApplicationTrackerPage';
import JobPortalPage from './pages/JobPortalPage';
import CertificatePage from './pages/CertificatePage';
import ResumePage from './pages/ResumePage';
import RemindersPage from './pages/RemindersPage';
import ProfilePage from './pages/ProfilePage';

function PrivateRoute({ children }) {
  const { token, isLoading } = useAuthStore();
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  return token ? children : <Navigate to="/login" replace />;
}

function PublicRoute({ children }) {
  const { token, isLoading } = useAuthStore();
  if (isLoading) return null;
  return !token ? children : <Navigate to="/" replace />;
}

export default function App() {
  const fetchMe = useAuthStore((s) => s.fetchMe);
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    if (token) fetchMe();
    else useAuthStore.setState({ isLoading: false });
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />

        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index element={<PipelinePage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="interview" element={<InterviewPage />} />
          <Route path="interview/:id" element={<InterviewSessionPage />} />
          <Route path="interview/:id/video" element={<VideoInterviewPage />} />
          <Route path="resume" element={<ResumePage />} />
          <Route path="reminders" element={<RemindersPage />} />
          <Route path="jobs-search" element={<JobsSearchPage />} />
          <Route path="tracker" element={<ApplicationTrackerPage />} />
          <Route path="portal" element={<JobPortalPage />} />
          <Route path="certificates" element={<CertificatePage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}