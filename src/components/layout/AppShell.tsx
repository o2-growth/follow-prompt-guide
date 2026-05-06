import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard, Compass, Target, TrendingUp, Users2, CalendarCheck,
  Gauge, Settings, FileDown, LogOut, Menu, X
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CoBranding } from "@/components/branding/CoBranding";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/vision", label: "Visão", icon: Compass },
  { to: "/okrs", label: "OKRs", icon: Target },
  { to: "/financial", label: "Financeiro", icon: TrendingUp },
  { to: "/team", label: "Time", icon: Users2 },
  { to: "/rituals", label: "Rituais", icon: CalendarCheck },
  { to: "/maturity", label: "Maturidade", icon: Gauge },
  { to: "/export", label: "Exportar PDF", icon: FileDown },
  { to: "/settings", label: "Configurações", icon: Settings },
];

export default function AppShell() {
  const { user } = useAuth();
  const { data: m } = useTenant();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const logout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex w-64 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
        <div className="px-6 py-6 border-b border-sidebar-border">
          <div className="font-serif text-xl font-bold text-sidebar-primary">Strategic OS</div>
          <div className="mt-2"><CoBranding size="sm" variant="dark" /></div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-smooth",
              isActive
                ? "bg-sidebar-accent text-sidebar-primary font-medium"
                : "hover:bg-sidebar-accent/60 text-sidebar-foreground/85"
            )}>
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <div className="px-3 py-2 text-xs text-sidebar-foreground/70 truncate">
            {(m as any)?.tenants?.name ?? "Workspace"}
          </div>
          <button onClick={logout} className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-sidebar-accent/60 transition-smooth">
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </div>
      </aside>

      {/* Mobile topbar */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b bg-card">
          <div className="font-serif font-semibold">Strategic OS</div>
          <Button variant="ghost" size="icon" onClick={() => setOpen(!open)}>
            {open ? <X /> : <Menu />}
          </Button>
        </header>
        {open && (
          <div className="md:hidden bg-sidebar text-sidebar-foreground border-b border-sidebar-border">
            <nav className="px-3 py-2 grid grid-cols-2 gap-1">
              {NAV.map(({ to, label, icon: Icon }) => (
                <NavLink key={to} to={to} onClick={() => setOpen(false)}
                  className={({ isActive }) => cn(
                    "flex items-center gap-2 px-3 py-2 rounded-md text-sm",
                    isActive ? "bg-sidebar-accent text-sidebar-primary font-medium" : "hover:bg-sidebar-accent/60"
                  )}>
                  <Icon className="h-4 w-4" /> {label}
                </NavLink>
              ))}
              <button onClick={logout} className="col-span-2 flex items-center gap-2 px-3 py-2 rounded-md hover:bg-sidebar-accent/60 text-sm">
                <LogOut className="h-4 w-4" /> Sair
              </button>
            </nav>
          </div>
        )}
        <main className="flex-1 overflow-y-auto">
          <div className="container max-w-6xl py-6 md:py-10">
            <Outlet context={{ user, membership: m }} />
          </div>
        </main>
      </div>
    </div>
  );
}
