import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { formatIDR, roleLabel } from "@/lib/format";
import { Card } from "@/components/ui/card";
import {
  TrendingUp, TrendingDown, Wallet, MapPin, FolderKanban, Users as UsersIcon,
  FileText, AlertTriangle, Coins, Timer, Clock, CheckCircle2,
} from "lucide-react";

const StatCard = ({ icon: Icon, label, value, color = "blue", testId }) => (
  <Card className="p-5 card-lift bg-white border-slate-200" data-testid={testId}>
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <div className="text-xs text-slate-500 tracking-wider uppercase font-medium">{label}</div>
        <div className="mt-2 font-display font-extrabold text-2xl text-slate-900 tabular">{value}</div>
      </div>
      <div className={`h-10 w-10 rounded-lg flex items-center justify-center bg-${color}-50 text-${color}-700`}>
        <Icon className="h-5 w-5" />
      </div>
    </div>
  </Card>
);

function useCountdown(targetIso) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!targetIso) return null;
  const diff = new Date(targetIso).getTime() - now;
  const abs = Math.abs(diff);
  const days = Math.floor(abs / 86400000);
  const hours = Math.floor((abs % 86400000) / 3600000);
  const mins = Math.floor((abs % 3600000) / 60000);
  const secs = Math.floor((abs % 60000) / 1000);
  return { diff, days, hours, mins, secs, overdue: diff < 0 };
}

function CountdownCard({ tagihan }) {
  // Find nearest unpaid invoice (due date >= today) — else pick most overdue unpaid
  const unpaid = tagihan.filter(t => (t.paid_amount || 0) < (t.total || 0) && t.due_date);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const upcoming = unpaid
    .filter(t => new Date(t.due_date) >= today)
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))[0];
  const overdue = unpaid
    .filter(t => new Date(t.due_date) < today)
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))[0];
  const target = upcoming || overdue;
  const targetDate = target ? new Date(target.due_date + "T23:59:59").toISOString() : null;
  const cd = useCountdown(targetDate);

  if (!target) {
    return (
      <Card className="p-6 bg-gradient-to-br from-emerald-600 to-green-700 text-white border-0 relative overflow-hidden" data-testid="countdown-empty">
        <div className="relative z-10 flex items-start gap-4">
          <div className="h-11 w-11 rounded-lg bg-white/20 flex items-center justify-center"><CheckCircle2 className="h-5 w-5" /></div>
          <div>
            <div className="text-[10px] tracking-widest text-emerald-100">STATUS TAGIHAN</div>
            <div className="font-display font-extrabold text-2xl mt-1">Semua Lunas</div>
            <p className="text-emerald-100 text-sm mt-1">Tidak ada tagihan yang jatuh tempo.</p>
          </div>
        </div>
      </Card>
    );
  }

  const bg = cd?.overdue
    ? "from-red-600 to-rose-700"
    : cd && cd.days < 3
    ? "from-orange-500 to-red-600"
    : "from-blue-700 to-indigo-800";

  return (
    <Card className={`p-6 bg-gradient-to-br ${bg} text-white border-0 relative overflow-hidden`} data-testid="countdown-card">
      <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10 blur-2xl pointer-events-none" />
      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-10 w-10 rounded-lg bg-white/20 flex items-center justify-center">
            {cd?.overdue ? <AlertTriangle className="h-5 w-5" /> : <Timer className="h-5 w-5" />}
          </div>
          <div>
            <div className="text-[10px] tracking-widest opacity-80">
              {cd?.overdue ? "TERLAMBAT" : "WAKTU MUNDUR INVOICE"}
            </div>
            <div className="font-display font-bold text-lg">{target.invoice_number}</div>
            <div className="text-xs opacity-90">{target.client_name}</div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2 mt-4">
          {[
            { v: cd?.days ?? 0, l: "HARI" },
            { v: cd?.hours ?? 0, l: "JAM" },
            { v: cd?.mins ?? 0, l: "MENIT" },
            { v: cd?.secs ?? 0, l: "DETIK" },
          ].map((s, i) => (
            <div key={i} className="bg-white/15 backdrop-blur rounded-lg py-3 text-center">
              <div className="font-display font-extrabold text-3xl tabular" data-testid={`countdown-${s.l.toLowerCase()}`}>{String(s.v).padStart(2, "0")}</div>
              <div className="text-[10px] tracking-widest opacity-80 mt-0.5">{s.l}</div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between text-sm">
          <div className="flex items-center gap-1.5 opacity-90">
            <Clock className="h-3.5 w-3.5" />
            {cd?.overdue ? "Sudah lewat jatuh tempo" : `Jatuh tempo ${new Date(target.due_date).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })}`}
          </div>
          <div className="text-lg font-display font-bold tabular">{formatIDR((target.total || 0) - (target.paid_amount || 0))}</div>
        </div>
      </div>
    </Card>
  );
}

function PenagihanDashboard({ stats }) {
  const [tagihan, setTagihan] = useState([]);
  const [projects, setProjects] = useState([]);
  useEffect(() => {
    api.get("/tagihan").then(r => setTagihan(r.data)).catch(() => {});
    api.get("/projects").then(r => setProjects(r.data)).catch(() => {});
  }, []);
  const activeProjects = projects.filter(p => p.status === "aktif").length;

  return (
    <div className="space-y-8">
      <div>
        <div className="text-xs tracking-widest text-slate-500 mb-2">RINGKASAN — PENAGIHAN</div>
        <h1 className="font-display font-extrabold text-3xl lg:text-4xl text-slate-900">Dashboard Penagihan</h1>
        <p className="text-slate-500 mt-1">Ringkasan performa penagihan proyek renovasi.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <CountdownCard tagihan={tagihan} />
        </div>
        <div className="space-y-4">
          <StatCard testId="stat-proyek-aktif" icon={FolderKanban} label="Proyek Aktif" value={activeProjects} color="blue" />
          <StatCard testId="stat-tagihan-total" icon={FileText} label="Total Tagihan" value={formatIDR(stats.total_tagihan || 0)} color="orange" />
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get("/dashboard/stats").then(r => setStats(r.data)).catch(() => {});
  }, []);

  if (!stats) return <div className="text-slate-500">Memuat…</div>;

  if (user.role === "penagihan") return <PenagihanDashboard stats={stats} />;

  return (
    <div className="space-y-8">
      <div>
        <div className="text-xs tracking-widest text-slate-500 mb-2">RINGKASAN — {roleLabel(user.role).toUpperCase()}</div>
        <h1 className="font-display font-extrabold text-3xl lg:text-4xl text-slate-900">Dashboard</h1>
        <p className="text-slate-500 mt-1">Ikhtisar keuangan & aktivitas proyek renovasi.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard testId="stat-pemasukan" icon={TrendingUp} label="Total Pemasukan" value={formatIDR(stats.total_pemasukan)} color="green" />
        <StatCard testId="stat-pengeluaran" icon={TrendingDown} label="Total Pengeluaran" value={formatIDR(stats.total_pengeluaran)} color="red" />
        <StatCard testId="stat-saldo" icon={Wallet} label="Saldo Bersih" value={formatIDR(stats.saldo)} color="blue" />
        <StatCard testId="stat-lokasi" icon={MapPin} label="Jumlah Lokasi" value={stats.jumlah_lokasi} color="orange" />
      </div>

      {user.role === "owner" && (
        <div>
          <h2 className="text-lg font-display font-bold mb-3 text-slate-900">Penagihan</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard testId="stat-tagihan-total" icon={FileText} label="Total Tagihan" value={formatIDR(stats.total_tagihan || 0)} color="blue" />
            <StatCard testId="stat-tagihan-terbayar" icon={Wallet} label="Sudah Terbayar" value={formatIDR(stats.total_terbayar || 0)} color="green" />
            <StatCard testId="stat-jatuh-tempo" icon={AlertTriangle} label="Jatuh Tempo" value={stats.tagihan_jatuh_tempo || 0} color="red" />
          </div>
        </div>
      )}

      {(user.role === "owner" || user.role === "bendahara") && (
        <div>
          <h2 className="text-lg font-display font-bold mb-3 text-slate-900">Kasbon & Sumber Daya</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard testId="stat-kasbon-pending" icon={Coins} label="Kasbon Belum Lunas" value={formatIDR(stats.kasbon_pending || 0)} color="orange" />
            <StatCard testId="stat-proyek" icon={FolderKanban} label="Jumlah Proyek" value={stats.jumlah_proyek} color="blue" />
            {user.role === "owner" && <StatCard testId="stat-user" icon={UsersIcon} label="Jumlah User" value={stats.jumlah_user} color="slate" />}
          </div>
        </div>
      )}

      <Card className="p-6 bg-gradient-to-br from-blue-700 to-blue-900 text-white border-0 relative overflow-hidden">
        <div className="relative z-10 max-w-xl">
          <div className="text-xs tracking-widest text-blue-200 mb-2">TIPS PROFESIONAL</div>
          <h3 className="font-display font-bold text-xl mb-2">Setiap transaksi wajib difoto</h3>
          <p className="text-blue-100 text-sm">Semua pencatatan buku kas dari tim lapangan menyertakan foto nota — meminimalkan sengketa dan mempercepat rekonsiliasi bendahara.</p>
        </div>
      </Card>
    </div>
  );
}
