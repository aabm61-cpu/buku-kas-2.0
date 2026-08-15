import React, { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, Users, FolderKanban, MapPin, Activity as ActivityIcon,
  FileText, BookOpen, Wallet, History as HistoryIcon,
  HardHat, LogOut, Menu, X, PanelLeftClose, PanelLeftOpen, KeyRound, Building2,
} from "lucide-react";
import { roleLabel } from "@/lib/format";
import { ChangePasswordDialog } from "@/components/ChangePasswordDialog";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["owner", "penagihan", "bendahara", "tim"] },
  { to: "/users", label: "User", icon: Users, roles: ["owner"] },
  { to: "/clients", label: "Klien", icon: Building2, roles: ["owner"] },
  { to: "/projects", label: "Proyek", icon: FolderKanban, roles: ["owner", "penagihan"] },
  { to: "/locations", label: "Lokasi", icon: MapPin, roles: ["owner"] },
  { to: "/tagihan", label: "Tagihan", icon: FileText, roles: ["owner", "penagihan", "bendahara"] },
  { to: "/cashbook", label: "Buku Kas", icon: BookOpen, roles: ["owner", "bendahara", "tim"] },
  { to: "/team-payments", label: "Pembayaran Tim", icon: Wallet, roles: ["owner", "bendahara"] },
  { to: "/my-payments", label: "Pembayaran Saya", icon: Wallet, roles: ["tim"] },
  { to: "/history-bukukas", label: "Riwayat Buku Kas", icon: HistoryIcon, roles: ["owner", "bendahara", "tim"] },
  { to: "/history", label: "History Lokasi", icon: HistoryIcon, roles: ["tim", "owner", "bendahara"] },
  { to: "/activities", label: "Log Aktivitas", icon: ActivityIcon, roles: ["owner"] },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [openMobile, setOpenMobile] = useState(false);
  const [openChangePw, setOpenChangePw] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem("sidebar_collapsed") === "1"; } catch { return false; }
  });

  useEffect(() => {
    try { localStorage.setItem("sidebar_collapsed", collapsed ? "1" : "0"); } catch {}
  }, [collapsed]);

  if (!user) return null;

  const items = NAV.filter(n => n.roles.includes(user.role));

  // Desktop: when collapsed, hide the sidebar entirely (lg:hidden)
  // Mobile: use openMobile drawer overlay
  const asideClass = [
    "fixed lg:static inset-y-0 left-0 z-40 w-72 bg-white border-r border-slate-200 flex-col transform transition-transform duration-200",
    openMobile ? "translate-x-0" : "-translate-x-full",
    collapsed ? "lg:hidden" : "lg:flex lg:translate-x-0",
    openMobile ? "flex" : (collapsed ? "hidden" : "flex lg:flex"),
  ].join(" ");

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Sidebar */}
      <aside data-testid="app-sidebar" className={asideClass}>
        <div className="h-16 px-5 flex items-center justify-between gap-3 border-b border-slate-200">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 bg-blue-700 rounded-md flex items-center justify-center shrink-0">
              <HardHat className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="font-display font-extrabold text-slate-900 leading-tight truncate">RENOVASI KAS</div>
              <div className="text-[10px] tracking-widest text-slate-500">SISTEM AKUNTANSI</div>
            </div>
          </div>
          <button
            data-testid="sidebar-collapse-btn"
            onClick={() => { setCollapsed(true); setOpenMobile(false); }}
            className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 hover:text-slate-900"
            title="Sembunyikan sidebar"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              data-testid={`nav-${to.slice(1)}`}
              onClick={() => setOpenMobile(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-5 py-2.5 text-sm text-slate-700 hover:bg-slate-50 border-l-[3px] border-transparent ${isActive ? "sidebar-active" : ""}`
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-9 w-9 rounded-full bg-slate-900 text-white flex items-center justify-center font-display font-bold">
              {user.name?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">{user.name}</div>
              <div className="text-xs text-slate-500">{roleLabel(user.role)}</div>
            </div>
          </div>
          <Button
            data-testid="change-password-btn"
            variant="outline"
            size="sm"
            className="w-full mb-2"
            onClick={() => setOpenChangePw(true)}
          >
            <KeyRound className="h-4 w-4 mr-2" /> Ubah Password
          </Button>
          <Button
            data-testid="logout-btn"
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => { logout(); nav("/login"); }}
          >
            <LogOut className="h-4 w-4 mr-2" /> Keluar
          </Button>
        </div>
      </aside>

      <ChangePasswordDialog open={openChangePw} onOpenChange={setOpenChangePw} />

      {openMobile && <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={() => setOpenMobile(false)} />}

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-8">
          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <button
              data-testid="sidebar-toggle"
              className="lg:hidden p-2 -ml-2"
              onClick={() => setOpenMobile(v => !v)}
            >
              {openMobile ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            {/* Desktop reveal when collapsed */}
            {collapsed && (
              <button
                data-testid="sidebar-reveal-btn"
                className="hidden lg:inline-flex items-center gap-2 h-9 px-3 rounded-md hover:bg-slate-100 text-slate-600 hover:text-slate-900 -ml-1"
                onClick={() => setCollapsed(false)}
                title="Tampilkan sidebar"
              >
                <PanelLeftOpen className="h-4 w-4" />
                <span className="text-xs font-medium">Menu</span>
              </button>
            )}
            <div>
              <div className="text-xs text-slate-500 tracking-widest">SELAMAT DATANG</div>
              <div className="font-display font-bold text-slate-900">{user.name}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`chip-${user.role} inline-flex px-3 py-1 rounded-full text-xs font-semibold`}>
              {roleLabel(user.role)}
            </span>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
