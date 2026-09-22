import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './styles/global.css';
import { AuthProvider } from './auth/AuthContext';
import { ToastProvider } from './components/ui/Toast';
import { ScrollToTop } from './components/layout/ScrollToTop';

// Layout Trees
import { PublicLayout } from './components/layout/PublicLayout';
import { AppLayout } from './components/layout/AppLayout';

// Landing page sections
import { HeroSection } from './components/sections/HeroSection';
import { WhatsAppSection } from './components/sections/WhatsAppSection';
import { HowItWorksSection } from './components/sections/HowItWorksSection';
import { LogisticsProviderSection } from './components/sections/LogisticsProviderSection';
import { TrustSection } from './components/sections/TrustSection';
import { FinalCtaSection } from './components/sections/FinalCtaSection';

// Auth pages
import { LoginPage } from './pages/LoginPage';
import { SignUpPage } from './pages/SignUpPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { RoleSelectionPage } from './pages/RoleSelectionPage';

// Onboarding pages
import { VendorOnboardingPage } from './pages/VendorOnboardingPage';
import { ProviderOnboardingPage } from './pages/ProviderOnboardingPage';

// Dashboards
import { VendorDashboardPage } from './pages/VendorDashboardPage';
import { ProviderDashboardPage } from './pages/ProviderDashboardPage';

// Phase 3 & 4 Delivery Pages
import { CreateDeliveryPage } from './pages/CreateDeliveryPage';
import { VendorDeliveryDetailPage } from './pages/VendorDeliveryDetailPage';
import { CustomerTrackingPage } from './pages/CustomerTrackingPage';

import { ProtectedRoute, PublicOnlyRoute } from './components/auth/ProtectedRoute';

export function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Router>
          <ScrollToTop />
          <Routes>
            {/* 1. PUBLIC MARKETING SITE LAYOUT (Navbar + Content + Footer) */}
            <Route element={<PublicLayout />}>
              <Route
                path="/"
                element={
                  <>
                    <HeroSection />
                    <WhatsAppSection />
                    <HowItWorksSection />
                    <LogisticsProviderSection />
                    <TrustSection />
                    <FinalCtaSection />
                  </>
                }
              />
              <Route path="/track" element={<CustomerTrackingPage />} />
              <Route path="/track/:trackingCode" element={<CustomerTrackingPage />} />
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

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
