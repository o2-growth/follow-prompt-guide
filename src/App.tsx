import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import AppShell from "@/components/layout/AppShell";
import Landing from "@/pages/Landing";
import Login from "@/pages/auth/Login";
import Signup from "@/pages/auth/Signup";
import Callback from "@/pages/auth/Callback";
import Onboarding from "@/pages/Onboarding";
import Dashboard from "@/pages/Dashboard";
import Vision from "@/pages/Vision";
import Okrs from "@/pages/Okrs";
import Financial from "@/pages/Financial";
import Team from "@/pages/Team";
import Rituals from "@/pages/Rituals";
import Maturity from "@/pages/Maturity";
import ExportPDF from "@/pages/ExportPDF";
import Settings from "@/pages/Settings";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/auth/login" element={<Login />} />
          <Route path="/auth/signup" element={<Signup />} />
          <Route path="/auth/callback" element={<Callback />} />
          <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
          <Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/vision" element={<Vision />} />
            <Route path="/okrs" element={<Okrs />} />
            <Route path="/financial" element={<Financial />} />
            <Route path="/team" element={<Team />} />
            <Route path="/rituals" element={<Rituals />} />
            <Route path="/maturity" element={<Maturity />} />
            <Route path="/export" element={<ExportPDF />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
          <Route path="/app" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
