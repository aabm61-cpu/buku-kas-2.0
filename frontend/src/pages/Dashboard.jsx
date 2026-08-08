import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { formatIDR, roleLabel } from "@/lib/format";
import { Card } from "@/components/ui/card";
import {
  TrendingUp, TrendingDown, Wallet, MapPin, FolderKanban, Users as UsersIcon,
  FileText, AlertTriangle, Coins, Clock, CheckCircle2,
} from "lucide-react";
import QuickAddProject from "@/components/QuickAddProject";

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

function TagihanDueList({ tagihan }) {
  const unpaid = tagihan
    .filter(t => (t.paid_amount || 0) < (t.total || 0) && t.due_date)
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
  const today = new Date(); today.setHours(0, 0, 0, 0);

  if (unpaid.length === 0) {
    return (
      <Card className="p-6 bg-gradient-to-br from-emerald-600 to-green-700 text-white border-0" data-testid="duelist-empty">
        <div className="flex items-start gap-4">
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

  return (
    <Card className="bg-white border-slate-200 overflow-hidden" data-testid="duelist-card">
      <div className="px-5 pt-4 pb-2 flex items-center gap-2">
        <Clock className="h-4 w-4 text-orange-500" />
        <div className="text-xs font-semibold tracking-widest text-slate-500">TAGIHAN BELUM LUNAS · URUT JATUH TEMPO</div>
      </div>
      <div className="divide-y divide-slate-100">
        {unpaid.map(t => {
          const overdue = new Date(t.due_date) < today;
          return (
            <div key={t.id} className="px-5 py-3 flex items-center gap-3" data-testid={`duelist-row-${t.id}`}>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-slate-900 truncate">{t.client_name}</div>
                <div className="text-xs text-slate-500 font-mono">{t.invoice_number}</div>
              </div>
              <div className={`text-sm whitespace-nowrap ${overdue ? "text-red-600 font-semibold" : "text-slate-600"}`}>
                {overdue && <AlertTriangle className="h-3.5 w-3.5 inline mr-1" />}
                {new Date(t.due_date).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
              </div>
              <div className="w-36 text-right font-mono tabular font-bold text-slate-900 whitespace-nowrap">{formatIDR(t.total || 0)}</div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function BendaharaDashboard({ stats }) {
  const [projects, setProjects] = useState([]);
  const [locations, setLocations] = useState([]);
  const [cashbook, setCashbook] = useState([]);

  useEffect(() => {
    Promise.all([
      api.get("/projects").catch(() => ({ data: [] })),
      api.get("/locations").catch(() => ({ data: [] })),
      api.get("/cashbook").catch(() => ({ data: [] })),
    ]).then(([p, l, c]) => { setProjects(p.data); setLocations(l.data); setCashbook(c.data); });
  }, []);

  // Group by location (=buku kas); only ongoing projects (work_status=sedang_berlangsung) with cashbook activity
  const rows = React.useMemo(() => {
    const byLoc = {};
    cashbook.forEach(e => {
      if (!byLoc[e.location_id]) byLoc[e.location_id] = { in: 0, out: 0, count: 0, last: e.date };
      if (e.type === "pemasukan") byLoc[e.location_id].in += e.amount;
      else byLoc[e.location_id].out += e.amount;
      byLoc[e.location_id].count += 1;
      if (e.date > byLoc[e.location_id].last) byLoc[e.location_id].last = e.date;
    });
    return locations.map(loc => {
      const proj = projects.find(p => p.id === loc.project_id);
      const s = byLoc[loc.id] || { in: 0, out: 0, count: 0, last: null };
      return {
        loc, proj,
        in: s.in, out: s.out, saldo: s.in - s.out,
        count: s.count, last: s.last,
        work_status: proj?.work_status,
      };
    }).filter(r => r.work_status === "sedang_berlangsung" && r.proj && !r.proj.is_completed)
      .sort((a, b) => a.saldo - b.saldo);
  }, [projects, locations, cashbook]);

  const totalSaldo = rows.reduce((s, r) => s + r.saldo, 0);
  const totalIn = rows.reduce((s, r) => s + r.in, 0);
  const totalOut = rows.reduce((s, r) => s + r.out, 0);
  const criticalCount = rows.filter(r => r.saldo < 0).length;

  return (
    <div className="space-y-8">
      <div>
        <div className="text-xs tracking-widest text-slate-500 mb-2">RINGKASAN — BENDAHARA</div>
        <h1 className="font-display font-extrabold text-3xl lg:text-4xl text-slate-900">Dashboard Bendahara</h1>
        <p className="text-slate-500 mt-1">Proyek yang sedang berjalan berdasarkan buku kas aktif dari tim lapangan.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard testId="stat-bendahara-berjalan" icon={FolderKanban} label="Buku Kas Aktif" value={rows.length} color="blue" />
        <StatCard testId="stat-bendahara-in" icon={TrendingUp} label="Total Pemasukan" value={formatIDR(totalIn)} color="green" />
        <StatCard testId="stat-bendahara-out" icon={TrendingDown} label="Total Pengeluaran" value={formatIDR(totalOut)} color="red" />
        <StatCard testId="stat-bendahara-saldo" icon={Wallet} label="Saldo Gabungan" value={formatIDR(totalSaldo)} color={totalSaldo >= 0 ? "blue" : "red"} />
      </div>

      {criticalCount > 0 && (
        <Card className="p-4 bg-red-50 border-red-200 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
          <div className="flex-1">
            <div className="font-semibold text-red-900">{criticalCount} buku kas dengan saldo minus</div>
            <div className="text-sm text-red-700">Segera tinjau pengeluaran atau tambahkan termin dari klien.</div>
          </div>
        </Card>
      )}

      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="text-xs font-semibold tracking-widest text-slate-500">PROYEK BERJALAN · BUKU KAS AKTIF</div>
          <span className="text-xs text-slate-400">Diurutkan berdasarkan saldo terkecil</span>
        </div>
        {rows.length === 0 ? (
          <Card className="p-10 text-center text-slate-500 bg-white border-slate-200">
            <FolderKanban className="h-10 w-10 mx-auto mb-3 text-slate-300" />
            Belum ada buku kas yang sedang berlangsung.
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rows.map(r => (
              <Card key={r.loc.id} data-testid={`bendahara-proj-${r.loc.id}`} className={`p-5 bg-white border-slate-200 card-lift relative overflow-hidden ${r.saldo < 0 ? "ring-2 ring-red-200" : ""}`}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-display font-bold text-slate-900 truncate">{r.loc.name}</div>
                    {r.proj && <div className="text-[11px] text-slate-500 mt-0.5">{r.proj.work_type} · {r.proj.client_name || "-"}</div>}
                  </div>
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 border border-yellow-200 whitespace-nowrap">
                    <span className="h-1.5 w-1.5 rounded-full bg-yellow-500 animate-pulse" />Berjalan
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-green-50 rounded-md p-2">
                    <div className="text-[10px] text-green-700 uppercase tracking-wider">Masuk</div>
                    <div className="font-mono tabular font-semibold text-green-900 text-sm">{formatIDR(r.in)}</div>
                  </div>
                  <div className="bg-red-50 rounded-md p-2">
                    <div className="text-[10px] text-red-700 uppercase tracking-wider">Keluar</div>
                    <div className="font-mono tabular font-semibold text-red-900 text-sm">{formatIDR(r.out)}</div>
                  </div>
                </div>
                <div className={`mt-3 pt-3 border-t border-slate-100 flex items-center justify-between ${r.saldo < 0 ? "text-red-700" : "text-slate-900"}`}>
                  <span className="text-xs uppercase tracking-wider font-medium">Sisa Saldo</span>
                  <span className="font-display font-extrabold text-lg font-mono tabular">{formatIDR(r.saldo)}</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1">{r.count} pencatatan{r.last ? ` · terakhir ${new Date(r.last).toLocaleDateString("id-ID")}` : ""}</div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PenagihanDashboard({ stats }) {
  const [tagihan, setTagihan] = useState([]);
  const [projects, setProjects] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadAll = () => {
    api.get("/tagihan").then(r => setTagihan(r.data)).catch(() => {});
    api.get("/projects").then(r => setProjects(r.data)).catch(() => {});
  };
  useEffect(() => { loadAll(); }, [refreshKey]);

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
          <TagihanDueList tagihan={tagihan} />
        </div>
        <div className="space-y-4">
          <StatCard testId="stat-proyek-aktif" icon={FolderKanban} label="Proyek Aktif" value={activeProjects} color="blue" />
          <StatCard testId="stat-tagihan-total" icon={FileText} label="Total Tagihan" value={formatIDR(stats.total_tagihan || 0)} color="orange" />
        </div>
      </div>

      <QuickAddProject onCreated={() => setRefreshKey(k => k + 1)} />
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
  if (user.role === "bendahara") return <BendaharaDashboard stats={stats} />;

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
