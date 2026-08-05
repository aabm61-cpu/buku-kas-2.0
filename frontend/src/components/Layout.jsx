import React, { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, Users, FolderKanban, MapPin, Activity as ActivityIcon,
  FileText, BookOpen, Coins, Wallet, History as HistoryIcon, UserPlus,
  HardHat, LogOut, Menu, X,
} from "lucide-react";
import { roleLabel } from "@/lib/format";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["owner", "penagihan", "bendahara", "tim"] },
  { to: "/users", label: "User", icon: Users, roles: ["owner"] },
  { to: "/projects", label: "Proyek", icon: FolderKanban, roles: ["owner", "penagihan", "bendahara", "tim"] },
  { to: "/locations", label: "Lokasi", icon: MapPin, roles: ["owner", "bendahara", "tim"] },
  { to: "/tagihan", label: "Tagihan", icon: FileText, roles: ["owner", "penagihan", "bendahara"] },
  { to: "/cashbook", label: "Buku Kas", icon: BookOpen, roles: ["owner", "bendahara", "tim"] },
  { to: "/kasbon", label: "Kasbon", icon: Coins, roles: ["owner", "bendahara", "tim"] },
  { to: "/team-payments", label: "Bayaran Tim", icon: Wallet, roles: ["owner", "bendahara"] },
  { to: "/team", label: "Anggota Tim", icon: UserPlus, roles: ["tim", "bendahara", "owner"] },
  { to: "/history", label: "History Lokasi", icon: HistoryIcon, roles: ["tim", "owner", "bendahara"] },
  { to: "/activities", label: "Log Aktivitas", icon: ActivityIcon, roles: ["owner"] },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  if (!user) return null;

  const items = NAV.filter(n => n.roles.includes(user.role));

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-40 w-72 bg-white border-r border-slate-200 flex flex-col transform ${open ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 transition-transform duration-200`}>
        <div className="h-16 px-5 flex items-center gap-3 border-b border-slate-200">
          <div className="h-9 w-9 bg-blue-700 rounded-md flex items-center justify-center">
            <HardHat className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="font-display font-extrabold text-slate-900 leading-tight">RENOVASI KAS</div>
            <div className="text-[10px] tracking-widest text-slate-500">SISTEM AKUNTANSI</div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-4">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              data-testid={`nav-${to.slice(1)}`}
              onClick={() => setOpen(false)}
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

      {open && <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={() => setOpen(false)} />}

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              data-testid="sidebar-toggle"
              className="lg:hidden p-2 -ml-2"
              onClick={() => setOpen(v => !v)}
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
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
