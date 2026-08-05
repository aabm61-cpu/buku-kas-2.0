import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { formatIDR, roleLabel, formatDate } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  TrendingUp, TrendingDown, Wallet, MapPin, FolderKanban, Users as UsersIcon,
  FileText, AlertTriangle, Coins, Plus, HardHat, ArrowRight,
} from "lucide-react";

const WORK_TYPES = ["Renov", "Return to LL Renov", "Addwork", "Maintenance", "Maintenance Return to LL"];

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

// Penagihan-specific dashboard: quick project input
function PenagihanDashboard({ stats }) {
  const nav = useNavigate();
  const [form, setForm] = useState({ name: "", work_type: "Renov", client_name: "", description: "" });
  const [projects, setProjects] = useState([]);
  const [saving, setSaving] = useState(false);

  const load = () => api.get("/projects").then(r => setProjects(r.data));
  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Nama HUB/SOC wajib diisi"); return; }
    setSaving(true);
    try {
      await api.post("/projects", form);
      toast.success("Proyek berhasil dibuat");
      setForm({ name: "", work_type: "Renov", client_name: "", description: "" });
      load();
      setTimeout(() => nav("/projects"), 600);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Gagal menyimpan");
    } finally { setSaving(false); }
  };

  const workTypeColor = {
    "Renov": "bg-blue-100 text-blue-700",
    "Return to LL Renov": "bg-purple-100 text-purple-700",
    "Addwork": "bg-orange-100 text-orange-700",
    "Maintenance": "bg-green-100 text-green-700",
    "Maintenance Return to LL": "bg-teal-100 text-teal-700",
  };

  return (
    <div className="space-y-8">
      <div>
        <div className="text-xs tracking-widest text-slate-500 mb-2">RINGKASAN — PENAGIHAN</div>
        <h1 className="font-display font-extrabold text-3xl lg:text-4xl text-slate-900">Dashboard Penagihan</h1>
        <p className="text-slate-500 mt-1">Input proyek baru & pantau status tagihan klien.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard testId="stat-tagihan-total" icon={FileText} label="Total Tagihan" value={formatIDR(stats.total_tagihan || 0)} color="blue" />
        <StatCard testId="stat-tagihan-terbayar" icon={Wallet} label="Sudah Terbayar" value={formatIDR(stats.total_terbayar || 0)} color="green" />
        <StatCard testId="stat-jatuh-tempo" icon={AlertTriangle} label="Jatuh Tempo" value={stats.tagihan_jatuh_tempo || 0} color="red" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Quick project input */}
        <Card className="lg:col-span-3 p-6 bg-white border-slate-200 relative overflow-hidden">
          <div className="absolute top-0 right-0 h-32 w-32 bg-orange-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          <div className="relative">
            <div className="flex items-center gap-3 mb-1">
              <div className="h-10 w-10 rounded-lg bg-blue-700 text-white flex items-center justify-center"><HardHat className="h-5 w-5" /></div>
              <div>
                <div className="text-xs tracking-widest text-slate-500">FORM CEPAT</div>
                <h2 className="font-display font-bold text-xl text-slate-900">Input Proyek Baru</h2>
              </div>
            </div>
            <p className="text-sm text-slate-500 mb-5">Isi Nama HUB/SOC dan jenis pekerjaan. Proyek akan otomatis masuk ke menu Proyek.</p>

            <form onSubmit={submit} className="space-y-4">
              <div>
                <Label>Nama HUB/SOC <span className="text-red-500">*</span></Label>
                <Input
                  data-testid="quick-project-name-input"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="mis. HUB Jakarta Selatan / SOC Bekasi"
                  className="h-11 mt-1.5"
                  required
                />
              </div>
              <div>
                <Label>Jenis Pekerjaan <span className="text-red-500">*</span></Label>
                <Select value={form.work_type} onValueChange={v => setForm({ ...form, work_type: v })}>
                  <SelectTrigger data-testid="quick-project-worktype-select" className="h-11 mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white">
                    {WORK_TYPES.map(w => <SelectItem key={w} value={w}>{w}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Nama Klien (opsional)</Label>
                  <Input
                    data-testid="quick-project-client-input"
                    value={form.client_name}
                    onChange={e => setForm({ ...form, client_name: e.target.value })}
                    placeholder="Nama klien"
                    className="h-11 mt-1.5"
                  />
                </div>
                <div>
                  <Label>Keterangan (opsional)</Label>
                  <Input
                    value={form.description}
                    onChange={e => setForm({ ...form, description: e.target.value })}
                    placeholder="Catatan singkat"
                    className="h-11 mt-1.5"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <Button
                  type="submit"
                  data-testid="quick-project-submit-btn"
                  disabled={saving}
                  className="rounded-full bg-blue-700 hover:bg-blue-800 h-11 px-6 font-semibold"
                >
                  <Plus className="h-4 w-4 mr-2" /> {saving ? "Menyimpan…" : "Simpan Proyek"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  data-testid="quick-project-view-btn"
                  onClick={() => nav("/projects")}
                  className="rounded-full h-11"
                >
                  Lihat Semua Proyek <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </form>
          </div>
        </Card>

        {/* Recent projects */}
        <Card className="lg:col-span-2 p-6 bg-white border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold text-slate-900">Proyek Terbaru</h3>
            <span className="text-xs text-slate-500">{projects.length} total</span>
          </div>
          <div className="space-y-3">
            {projects.slice(0, 6).map(p => (
              <div key={p.id} className="p-3 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-slate-50 cursor-pointer" onClick={() => nav("/projects")} data-testid={`recent-project-${p.id}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-slate-900 truncate">{p.name}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{p.client_name || "—"}</div>
                  </div>
                  {p.work_type && (
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${workTypeColor[p.work_type] || "bg-slate-100 text-slate-700"}`}>{p.work_type}</span>
                  )}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">{formatDate(p.created_at)}</div>
              </div>
            ))}
            {projects.length === 0 && (
              <div className="text-center py-8 text-sm text-slate-500">
                <FolderKanban className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                Belum ada proyek. Input yang pertama di form sebelah.
              </div>
            )}
          </div>
        </Card>
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

  // Custom dashboard for penagihan
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
