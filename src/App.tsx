import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { AppLayout } from './components/layout/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ParcelsListPage } from './pages/parcels/ParcelsListPage';
import { ParcelNewPage } from './pages/parcels/ParcelNewPage';
import { ParcelDetailPage } from './pages/parcels/ParcelDetailPage';
import { ClientsListPage } from './pages/clients/ClientsListPage';
import { ClientNewPage } from './pages/clients/ClientNewPage';
import { ClientDetailPage } from './pages/clients/ClientDetailPage';
import { PaymentsListPage, PaymentNewPage } from './pages/payments/PaymentsPage';
import { ExpensesPage } from './pages/expenses/ExpensesPage';
import { ExpenseTripDetailPage } from './pages/expenses/ExpenseTripDetailPage';
import { AgentsPage } from './pages/AgentsPage';
import { ReportsPage } from './pages/ReportsPage';
import { LogsPage } from './pages/LogsPage';
import { SettingsPage } from './pages/SettingsPage';
import { OfflinePage } from './pages/OfflinePage';
import { TripsListPage } from './pages/trips/TripsListPage';
import { TripNewPage } from './pages/trips/TripNewPage';
import { TripDetailPage } from './pages/trips/TripDetailPage';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import type { ReactNode } from 'react';

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

function OfflineDetector() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOnline) return <OfflinePage />;
  return null;
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <>
      <OfflineDetector />
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
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
