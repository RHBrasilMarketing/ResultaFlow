import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import Auth from "./pages/Auth.tsx";
import Admin from "./pages/Admin.tsx";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState<boolean | null>(null);
  useEffect(() => {
    const local = localStorage.getItem("resultaflow_local_session");
    if (local) {
      setAuthed(true);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setAuthed(!!data.session);
    }).catch(() => {
      setAuthed(!!localStorage.getItem("resultaflow_local_session"));
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) setAuthed(true);
      else setAuthed(!!localStorage.getItem("resultaflow_local_session"));
    });
    return () => sub.subscription.unsubscribe();
  }, []);
  if (authed === null) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" /></div>;
  if (!authed) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
