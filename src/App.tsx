import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { SyncProvider } from './context/SyncContext';
import { AppLayout } from './components/layout/AppLayout';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import type { ReactNode } from 'react';

const LoginPage = lazy(() => import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })));
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const ParcelsListPage = lazy(() => import('./pages/parcels/ParcelsListPage').then((m) => ({ default: m.ParcelsListPage })));
const ParcelNewPage = lazy(() => import('./pages/parcels/ParcelNewPage').then((m) => ({ default: m.ParcelNewPage })));
const ParcelDetailPage = lazy(() => import('./pages/parcels/ParcelDetailPage').then((m) => ({ default: m.ParcelDetailPage })));
const ClientsListPage = lazy(() => import('./pages/clients/ClientsListPage').then((m) => ({ default: m.ClientsListPage })));
const ClientNewPage = lazy(() => import('./pages/clients/ClientNewPage').then((m) => ({ default: m.ClientNewPage })));
const ClientDetailPage = lazy(() => import('./pages/clients/ClientDetailPage').then((m) => ({ default: m.ClientDetailPage })));
const PaymentsListPage = lazy(() => import('./pages/payments/PaymentsPage').then((m) => ({ default: m.PaymentsListPage })));
const PaymentNewPage = lazy(() => import('./pages/payments/PaymentsPage').then((m) => ({ default: m.PaymentNewPage })));
const ExpensesPage = lazy(() => import('./pages/expenses/ExpensesPage').then((m) => ({ default: m.ExpensesPage })));
const ExpenseTripDetailPage = lazy(() => import('./pages/expenses/ExpenseTripDetailPage').then((m) => ({ default: m.ExpenseTripDetailPage })));
const AgentsPage = lazy(() => import('./pages/AgentsPage').then((m) => ({ default: m.AgentsPage })));
const ReportsPage = lazy(() => import('./pages/ReportsPage').then((m) => ({ default: m.ReportsPage })));
const LogsPage = lazy(() => import('./pages/LogsPage').then((m) => ({ default: m.LogsPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const TripsListPage = lazy(() => import('./pages/trips/TripsListPage').then((m) => ({ default: m.TripsListPage })));
const TripNewPage = lazy(() => import('./pages/trips/TripNewPage').then((m) => ({ default: m.TripNewPage })));
const TripDetailPage = lazy(() => import('./pages/trips/TripDetailPage').then((m) => ({ default: m.TripDetailPage })));

function RouteFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
      <svg className="animate-spin h-8 w-8 text-brand-500" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </div>
  );
}

function ProtectedRoute({ children, adminOnly = false }: { children: ReactNode; adminOnly?: boolean }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <svg className="animate-spin h-8 w-8 text-brand-500" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (adminOnly && user.role !== 'admin') return <Navigate to="/" replace />;

  return <AppLayout>{children}</AppLayout>;
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
          <Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/parcels" element={<ProtectedRoute><ParcelsListPage /></ProtectedRoute>} />
          <Route path="/parcels/new" element={<ProtectedRoute><ParcelNewPage /></ProtectedRoute>} />
          <Route path="/parcels/:id" element={<ProtectedRoute><ParcelDetailPage /></ProtectedRoute>} />
          <Route path="/clients" element={<ProtectedRoute><ClientsListPage /></ProtectedRoute>} />
          <Route path="/clients/new" element={<ProtectedRoute><ClientNewPage /></ProtectedRoute>} />
          <Route path="/clients/:id" element={<ProtectedRoute><ClientDetailPage /></ProtectedRoute>} />
          <Route path="/payments" element={<ProtectedRoute><PaymentsListPage /></ProtectedRoute>} />
          <Route path="/payments/new" element={<ProtectedRoute><PaymentNewPage /></ProtectedRoute>} />
          <Route path="/expenses" element={<ProtectedRoute adminOnly><ExpensesPage /></ProtectedRoute>} />
          <Route path="/expenses/trip/:id" element={<ProtectedRoute adminOnly><ExpenseTripDetailPage /></ProtectedRoute>} />
          <Route path="/trips" element={<ProtectedRoute><TripsListPage /></ProtectedRoute>} />
          <Route path="/trips/new" element={<ProtectedRoute><TripNewPage /></ProtectedRoute>} />
          <Route path="/trips/:id" element={<ProtectedRoute><TripDetailPage /></ProtectedRoute>} />
          <Route path="/agents" element={<ProtectedRoute adminOnly><AgentsPage /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute adminOnly><ReportsPage /></ProtectedRoute>} />
          <Route path="/logs" element={<ProtectedRoute adminOnly><LogsPage /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute adminOnly><SettingsPage /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <SyncProvider>
              <BrowserRouter>
                <AppRoutes />
              </BrowserRouter>
            </SyncProvider>
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
