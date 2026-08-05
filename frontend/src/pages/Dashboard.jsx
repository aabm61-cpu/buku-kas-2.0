import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { formatIDR, roleLabel } from "@/lib/format";
import { Card } from "@/components/ui/card";
import {
  TrendingUp, TrendingDown, Wallet, MapPin, FolderKanban, Users as UsersIcon,
  FileText, AlertTriangle, Coins,
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

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get("/dashboard/stats").then(r => setStats(r.data)).catch(() => {});
  }, []);

  if (!stats) return <div className="text-slate-500">Memuat…</div>;

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

      {(user.role === "owner" || user.role === "penagihan") && (
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
