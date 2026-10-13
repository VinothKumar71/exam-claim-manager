import React, { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";
import SignIn from "./pages/SignIn";
import Home from "./pages/Home";
import PracticalClaim from "./pages/PracticalClaim";
import ProjectVivaVoce from "./pages/ProjectVivaVoce";
import ManageData from "./pages/ManageData";
import ClaimsHistory from "./pages/ClaimsHistory";
import StaffSummary from "./pages/StaffSummary";
import DashboardLayout from "./layouts/DashboardLayout";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Still loading auth state
  if (session === undefined) return null;

  // Not signed in
  if (!session) return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <SignIn onSignIn={() => {}} />
      </TooltipProvider>
    </QueryClientProvider>
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <HashRouter>
          <DashboardLayout>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/practical" element={<PracticalClaim />} />
              <Route path="/project-viva" element={<ProjectVivaVoce />} />
              <Route path="/manage-data" element={<ManageData />} />
              <Route path="/history" element={<ClaimsHistory />} />
              <Route path="/staff-summary" element={<StaffSummary />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </DashboardLayout>
        </HashRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;