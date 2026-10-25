import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './styles/global.css';
import { AuthProvider } from './auth/AuthContext';
import { ToastProvider } from './components/ui/Toast';
import { ScrollToTop } from './components/layout/ScrollToTop';
import { PageLoader } from './components/ui/PageLoader';

// Layout Trees
import { PublicLayout } from './components/layout/PublicLayout';
import { AppLayout } from './components/layout/AppLayout';

// Landing page sections (eagerly loaded for instant first paint)
import { HeroSection } from './components/sections/HeroSection';
import { HowItWorksSection } from './components/sections/HowItWorksSection';
import { FeaturesSection } from './components/sections/FeaturesSection';
import { TrustSection } from './components/sections/TrustSection';
import { LogisticsProviderSection } from './components/sections/LogisticsProviderSection';
import { GetAppSection } from './components/sections/GetAppSection';

// Lazy-loaded Auth pages
const LoginPage = lazy(() => import('./pages/LoginPage').then(m => ({ default: m.LoginPage })));
const SignUpPage = lazy(() => import('./pages/SignUpPage').then(m => ({ default: m.SignUpPage })));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage').then(m => ({ default: m.ForgotPasswordPage })));
const RoleSelectionPage = lazy(() => import('./pages/RoleSelectionPage').then(m => ({ default: m.RoleSelectionPage })));

// Lazy-loaded Onboarding pages
const VendorOnboardingPage = lazy(() => import('./pages/VendorOnboardingPage').then(m => ({ default: m.VendorOnboardingPage })));
const ProviderOnboardingPage = lazy(() => import('./pages/ProviderOnboardingPage').then(m => ({ default: m.ProviderOnboardingPage })));

// Lazy-loaded Dashboards
const VendorDashboardPage = lazy(() => import('./pages/VendorDashboardPage').then(m => ({ default: m.VendorDashboardPage })));
const ProviderDashboardPage = lazy(() => import('./pages/ProviderDashboardPage').then(m => ({ default: m.ProviderDashboardPage })));

// Lazy-loaded Delivery Pages
const CreateDeliveryPage = lazy(() => import('./pages/CreateDeliveryPage').then(m => ({ default: m.CreateDeliveryPage })));
const VendorDeliveryDetailPage = lazy(() => import('./pages/VendorDeliveryDetailPage').then(m => ({ default: m.VendorDeliveryDetailPage })));
const CustomerTrackingPage = lazy(() => import('./pages/CustomerTrackingPage').then(m => ({ default: m.CustomerTrackingPage })));

// Lazy-loaded Legal & Error Pages
const TermsPage = lazy(() => import('./pages/TermsPage').then(m => ({ default: m.TermsPage })));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage').then(m => ({ default: m.PrivacyPage })));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage').then(m => ({ default: m.NotFoundPage })));

import { ProtectedRoute, PublicOnlyRoute } from './components/auth/ProtectedRoute';

export function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Router>
          <ScrollToTop />
          <Suspense fallback={<PageLoader />}>
            <Routes>
            {/* 1. PUBLIC MARKETING SITE LAYOUT (Navbar + Content + Footer) */}
            <Route element={<PublicLayout />}>
              <Route
                path="/"
                element={
                  <>
                    <HeroSection />
                    <HowItWorksSection />
                    <FeaturesSection />
                    <TrustSection />
                    <LogisticsProviderSection />
                    <GetAppSection />
                  </>
                }
              />
              <Route path="/track" element={<CustomerTrackingPage />} />
              <Route path="/track/:trackingCode" element={<CustomerTrackingPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
            </Route>

            {/* 2. AUTHENTICATION FLOW (Clean Auth Shell, NO marketing Navbar/Footer) */}
            <Route
              path="/login"
              element={
                <PublicOnlyRoute>
                  <LoginPage />
                </PublicOnlyRoute>
              }
            />
            <Route
              path="/signup"
              element={
                <PublicOnlyRoute>
                  <SignUpPage />
                </PublicOnlyRoute>
              }
            />
            <Route
              path="/forgot-password"
              element={
                <PublicOnlyRoute>
                  <ForgotPasswordPage />
                </PublicOnlyRoute>
              }
            />

            {/* 3. ROLE SELECTION & ONBOARDING (Clean Shell, NO marketing Navbar/Footer) */}
            <Route
              path="/role-selection"
              element={
                <ProtectedRoute>
                  <RoleSelectionPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/onboarding/vendor"
              element={
                <ProtectedRoute requiredRole="vendor">
                  <VendorOnboardingPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/onboarding/provider"
              element={
                <ProtectedRoute requiredRole="logistics_provider">
                  <ProviderOnboardingPage />
                </ProtectedRoute>
              }
            />

            {/* 4. AUTHENTICATED APPLICATION LAYOUT (App Header + Workspace + NO marketing Footer) */}
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route
                path="/vendor/dashboard"
                element={
                  <ProtectedRoute requiredRole="vendor" onboardingOnly={false}>
                    <VendorDashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/vendor/deliveries/create"
                element={
                  <ProtectedRoute requiredRole="vendor" onboardingOnly={false}>
                    <CreateDeliveryPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/vendor/deliveries/:id"
                element={
                  <ProtectedRoute requiredRole="vendor" onboardingOnly={false}>
                    <VendorDeliveryDetailPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/logistics/dashboard"
                element={
                  <ProtectedRoute requiredRole="logistics_provider" onboardingOnly={false}>
                    <ProviderDashboardPage />
                  </ProtectedRoute>
                }
              />
              {/* Backward-compatibility aliases */}
              <Route
                path="/dashboard/vendor"
                element={<Navigate to="/vendor/dashboard" replace />}
              />
              <Route
                path="/dashboard/provider"
                element={<Navigate to="/logistics/dashboard" replace />}
              />
            </Route>

            {/* Fallback & 404 */}
            <Route path="/404" element={<NotFoundPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </Router>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
