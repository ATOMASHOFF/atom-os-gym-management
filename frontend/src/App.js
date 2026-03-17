import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import ErrorBoundary from './components/shared/ErrorBoundary';
import Layout from './components/layout/Layout';
import { T } from './utils/helpers';

// ── Pages ────────────────────────────────────────────────────
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';

// Super Admin
import SuperDashboard from './pages/superadmin/SuperDashboard';
import GymListPage from './pages/superadmin/GymListPage';
import GymDetailPage from './pages/superadmin/GymDetailPage';

// Gym Admin + Staff
import Dashboard from './pages/admin/Dashboard';
import MembersPage from './pages/admin/MembersPage';
import StaffPage from './pages/admin/StaffPage';
import SubscriptionsPage from './pages/admin/SubscriptionsPage';
import AttendancePage from './pages/admin/AttendancePage';
import PlansPage from './pages/admin/PlansPage';
import QRCodesPage from './pages/admin/QRCodesPage';
import SettingsPage from './pages/admin/SettingsPage';
import ScanMemberPage from './pages/admin/ScanMemberPage';
import BulkImportPage from './pages/admin/BulkImportPage';
import OnboardingPage from './pages/admin/OnboardingPage';

// Member
import MyProfilePage from './pages/member/MyProfilePage';
import MyAttendancePage from './pages/member/MyAttendancePage';
import CheckInPage from './pages/member/CheckInPage';
import NotFoundPage from './pages/NotFoundPage';

// ── Loading screen ───────────────────────────────────────────
export const LoadingScreen = () => (
  <div style={{
    minHeight: '100vh', display: 'flex', alignItems: 'center',
    justifyContent: 'center', background: T.bg0, flexDirection: 'column', gap: 16,
  }}>
    <div style={{
      width: 40, height: 40, borderRadius: '50%',
      border: `2px solid ${T.border}`, borderTop: `2px solid ${T.accent}`,
      animation: 'spin 0.7s linear infinite',
    }} />
    <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 11, color: T.muted, letterSpacing: '0.14em' }}>
      ATOM FITNESS OS · LOADING...
    </div>
  </div>
);

// ── Simple auth guard — ONLY checks login + role, nothing else ─
// Onboarding is handled separately in DashboardGate below
function PrivateRoute({ children, roles }) {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;

  return children;
}

// ── Dashboard entry point — checks onboarding for gym admins ──
// This is the ONLY place onboarding redirect happens.
// Once user is on /onboarding or any other page, no more redirects.
function DashboardGate() {
  const { user, loading } = useAuth();
  const [checking, setChecking] = React.useState(true);
  const [needsOnboarding, setNeedsOnboarding] = React.useState(false);

  React.useEffect(() => {
    if (!user) { setChecking(false); return; }

    // Only gym admins get onboarding check
    if (user.role !== 'admin') { setChecking(false); return; }

    // Check if already dismissed this session
    if (sessionStorage.getItem('onboarding_skipped') === 'true') {
      setChecking(false);
      return;
    }

    import('./utils/api').then(({ default: api }) => {
      api.get('/gyms/onboarding')
        .then(r => {
          const data = r.data;
          const isComplete = data?.is_complete ?? data?.data?.is_complete;
          setNeedsOnboarding(isComplete === false);
        })
        .catch(() => {/* ignore — don't block on error */})
        .finally(() => setChecking(false));
    });
  }, [user]);

  if (loading || checking) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;

  if (user.role === 'super_admin') return <Navigate to="/super/dashboard" replace />;
  if (user.role === 'member')      return <Navigate to="/my-profile" replace />;

  // Gym admin needs onboarding
  if (user.role === 'admin' && needsOnboarding) {
    return <Navigate to="/onboarding" replace />;
  }

  // Everyone else → dashboard
  return <Navigate to="/dashboard" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login"    element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Root redirect — handles onboarding check */}
      <Route path="/" element={
        <PrivateRoute>
          <DashboardGate />
        </PrivateRoute>
      } />

      {/* Onboarding — standalone full-screen page, no Layout */}
      <Route path="/onboarding" element={
        <PrivateRoute roles={['admin']}>
          <OnboardingPage />
        </PrivateRoute>
      } />

      {/* All app pages inside Layout */}
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>

        {/* ─── Super Admin ──────────────────────────────── */}
        <Route path="super/dashboard" element={
          <PrivateRoute roles={['super_admin']}><SuperDashboard /></PrivateRoute>
        } />
        <Route path="super/gyms" element={
          <PrivateRoute roles={['super_admin']}><GymListPage /></PrivateRoute>
        } />
        <Route path="super/gyms/:gymId" element={
          <PrivateRoute roles={['super_admin']}><GymDetailPage /></PrivateRoute>
        } />

        {/* ─── Gym Admin + Staff ────────────────────────── */}
        <Route path="dashboard" element={
          <PrivateRoute roles={['admin','staff']}><Dashboard /></PrivateRoute>
        } />
        <Route path="members" element={
          <PrivateRoute roles={['admin','staff']}><MembersPage /></PrivateRoute>
        } />
        <Route path="subscriptions" element={
          <PrivateRoute roles={['admin','staff']}><SubscriptionsPage /></PrivateRoute>
        } />
        <Route path="attendance" element={
          <PrivateRoute roles={['admin','staff']}><AttendancePage /></PrivateRoute>
        } />
        <Route path="scan-member" element={
          <PrivateRoute roles={['admin','staff']}><ScanMemberPage /></PrivateRoute>
        } />

        {/* ─── Gym Admin only ───────────────────────────── */}
        <Route path="staff"    element={<PrivateRoute roles={['admin']}><StaffPage /></PrivateRoute>} />
        <Route path="plans"    element={<PrivateRoute roles={['admin']}><PlansPage /></PrivateRoute>} />
        <Route path="qr-codes" element={<PrivateRoute roles={['admin']}><QRCodesPage /></PrivateRoute>} />
        <Route path="import"   element={<PrivateRoute roles={['admin']}><BulkImportPage /></PrivateRoute>} />
        <Route path="settings" element={
          <PrivateRoute roles={['admin','super_admin']}><SettingsPage /></PrivateRoute>
        } />

        {/* ─── Member ───────────────────────────────────── */}
        <Route path="my-profile"    element={<PrivateRoute roles={['member']}><MyProfilePage /></PrivateRoute>} />
        <Route path="my-attendance" element={<PrivateRoute roles={['member']}><MyAttendancePage /></PrivateRoute>} />
        <Route path="checkin"       element={<PrivateRoute><CheckInPage /></PrivateRoute>} />

        {/* Fallback */}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <ErrorBoundary fullPage>
            <AppRoutes />
          </ErrorBoundary>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
