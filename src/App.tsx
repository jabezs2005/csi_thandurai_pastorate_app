import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './components/auth/LoginPage';
import SignUpPage from './components/auth/SignUpPage';
import SuperAdminLoginPage from './components/auth/SuperAdminLoginPage';
import SuperAdminSignUpPage from './components/auth/SuperAdminSignUpPage';
import Layout from './components/layout/Layout';
import DashboardHome from './components/dashboard/DashboardHome';
import MemberList from './components/members/MemberList';
import MemberDetail from './components/members/MemberDetail';
import ChurchesPage from './components/pages/ChurchesPage';
import AdminsPage from './components/pages/AdminsPage';
import ActivityLogsPage from './components/pages/ActivityLogsPage';
import AccountApprovalsPage from './components/pages/AccountApprovalsPage';
import CircularsPage from './components/pages/CircularsPage';
import HarvestFestivalPage from './components/pages/HarvestFestivalPage';
import ReportsPage from './components/pages/ReportsPage';
import { NavState } from './types';

type Route = 'church-admin-login' | 'church-admin-signup' | 'super-admin-login' | 'super-admin-signup';

function getRoute(): Route {
  const path = window.location.pathname;
  if (path === '/super-admin/signup') return 'super-admin-signup';
  if (path === '/super-admin') return 'super-admin-login';
  if (path === '/signup') return 'church-admin-signup';
  return 'church-admin-login';
}

function navigate(path: string) {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function AppContent() {
  const { user, profile, loading, signOut } = useAuth();
  const [navState, setNavState] = useState<NavState>({ page: 'dashboard' });
  const [searchQuery, setSearchQuery] = useState('');
  const [route, setRoute] = useState<Route>(getRoute());

  useEffect(() => {
    const onPopState = () => setRoute(getRoute());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Redirect to correct dashboard URL after login based on role
  useEffect(() => {
    if (user && profile) {
      const isSuperAdmin = profile.role === 'super_admin';
      const currentPath = window.location.pathname;
      const correctPath = isSuperAdmin ? '/super-admin' : '/';

      // If logged-in user is on a login/signup page, redirect to their dashboard
      if (currentPath === '/super-admin' || currentPath === '/super-admin/signup' || currentPath === '/signup' || (currentPath === '/' && isSuperAdmin)) {
        if (currentPath !== correctPath) {
          window.history.replaceState({}, '', correctPath);
        }
      }
    }
  }, [user, profile]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (user && profile) {
    const isSuperAdmin = profile.role === 'super_admin';

    // Guard: if a super admin is on '/' or a church admin is on '/super-admin', redirect to their correct dashboard
    const currentPath = window.location.pathname;
    if (isSuperAdmin && currentPath === '/') {
      window.history.replaceState({}, '', '/super-admin');
    } else if (!isSuperAdmin && currentPath === '/super-admin') {
      window.history.replaceState({}, '', '/');
    }

    function handleNavigate(state: NavState) {
      setNavState(state);
      if (navState.page !== state.page) {
        setSearchQuery('');
      }
    }

    function renderPage() {
      switch (navState.page) {
        case 'dashboard':
          return <DashboardHome onNavigate={handleNavigate} />;

        case 'members':
          return <MemberList searchQuery={searchQuery} onNavigate={handleNavigate} onSearchChange={setSearchQuery} />;

        case 'member-detail':
          return (
            <MemberDetail
              memberId={navState.memberId}
              familyNumber={navState.familyNumber}
              onNavigate={handleNavigate}
            />
          );

        case 'churches':
          return isSuperAdmin ? <ChurchesPage /> : <DashboardHome onNavigate={handleNavigate} />;

        case 'admins':
          return isSuperAdmin ? <AdminsPage /> : <DashboardHome onNavigate={handleNavigate} />;

        case 'account-approvals':
          return isSuperAdmin ? <AccountApprovalsPage /> : <DashboardHome onNavigate={handleNavigate} />;

        case 'activity-logs':
          return isSuperAdmin ? <ActivityLogsPage /> : <DashboardHome onNavigate={handleNavigate} />;

        case 'circulars':
          return <CircularsPage />;

        case 'harvest-festival':
          return <HarvestFestivalPage />;

        case 'reports':
          return <ReportsPage />;

        default:
          return <DashboardHome onNavigate={handleNavigate} />;
      }
    }

    return (
      <Layout
        navState={navState}
        onNavigate={handleNavigate}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      >
        {renderPage()}
      </Layout>
    );
  }

  // Not authenticated — show the appropriate auth page based on route
  switch (route) {
    case 'super-admin-login':
      return <SuperAdminLoginPage />;
    case 'super-admin-signup':
      return <SuperAdminSignUpPage />;
    case 'church-admin-signup':
      return <SignUpPage onBack={() => navigate('/')} />;
    default:
      return <LoginPage onShowSignUp={() => navigate('/signup')} />;
  }
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
