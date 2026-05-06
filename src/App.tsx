import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Loader2 } from "lucide-react";

// Páginas leves (pré-carga ok)
import Landing from "@/pages/Landing";
import Login from "@/pages/auth/Login";
import Signup from "@/pages/auth/Signup";
import Callback from "@/pages/auth/Callback";
import NotFound from "@/pages/NotFound";

// Páginas pesadas (Recharts, jsPDF, formulários grandes) — code-split
const AppShell = lazy(() => import("@/components/layout/AppShell"));
const Onboarding = lazy(() => import("@/pages/Onboarding"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Vision = lazy(() => import("@/pages/Vision"));
const Okrs = lazy(() => import("@/pages/Okrs"));
const Financial = lazy(() => import("@/pages/Financial"));
const Team = lazy(() => import("@/pages/Team"));
const Rituals = lazy(() => import("@/pages/Rituals"));
const Maturity = lazy(() => import("@/pages/Maturity"));
const Diagnostic360 = lazy(() => import("@/pages/Diagnostic360"));
const ExportPDF = lazy(() => import("@/pages/ExportPDF"));
const Settings = lazy(() => import("@/pages/Settings"));
const PrivacyPolicy = lazy(() => import("@/pages/legal/PrivacyPolicy"));
const Terms = lazy(() => import("@/pages/legal/Terms"));

const queryClient = new QueryClient();

function PageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/auth/login" element={<Login />} />
            <Route path="/auth/signup" element={<Signup />} />
            <Route path="/auth/callback" element={<Callback />} />
            <Route path="/privacidade" element={<PrivacyPolicy />} />
            <Route path="/termos" element={<Terms />} />
            <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
            <Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/vision" element={<Vision />} />
              <Route path="/okrs" element={<Okrs />} />
              <Route path="/financial" element={<Financial />} />
              <Route path="/team" element={<Team />} />
              <Route path="/rituals" element={<Rituals />} />
              <Route path="/maturity" element={<Maturity />} />
              <Route path="/diagnostic-360" element={<Diagnostic360 />} />
              <Route path="/export" element={<ExportPDF />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
            <Route path="/app" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
