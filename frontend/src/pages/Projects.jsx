import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, FolderKanban, Building2, Trash2, Pencil, Briefcase, HardHat } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { formatDate } from "@/lib/format";
import ProjectsTable from "@/components/ProjectsTable";

const WORK_TYPES = ["Renov", "Return to LL Renov", "Addwork", "Maintenance", "Maintenance Return to LL"];
const empty = { name: "", work_type: "Renov", client_name: "", description: "", status: "aktif" };

const workTypeColor = {
  "Renov": "bg-blue-100 text-blue-700",
  "Return to LL Renov": "bg-purple-100 text-purple-700",
  "Addwork": "bg-orange-100 text-orange-700",
  "Maintenance": "bg-green-100 text-green-700",
  "Maintenance Return to LL": "bg-teal-100 text-teal-700",
};

// Quick input strip - shown for owner & penagihan on top of table view
function QuickAdd({ onCreated }) {
  const [form, setForm] = useState({ name: "", work_type: "Renov" });
  const [saving, setSaving] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Nama HUB/SOC wajib diisi"); return; }
    setSaving(true);
    try {
      await api.post("/projects", form);
      toast.success("Proyek dibuat");
      setForm({ name: "", work_type: "Renov" });
      onCreated?.();
    } catch (err) { toast.error(err.response?.data?.detail || "Gagal"); }
    finally { setSaving(false); }
  };
  return (
    <Card className="p-5 bg-white border-slate-200 relative overflow-hidden">
      <div className="absolute top-0 right-0 h-32 w-32 bg-orange-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
      <div className="relative">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-9 w-9 rounded-lg bg-blue-700 text-white flex items-center justify-center"><HardHat className="h-4 w-4" /></div>
          <div>
            <div className="text-[10px] tracking-widest text-slate-500">FORM CEPAT</div>
            <h2 className="font-display font-bold text-lg text-slate-900">Input Proyek Baru</h2>
          </div>
        </div>
        <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div className="md:col-span-2">
            <Label>Nama HUB/SOC <span className="text-red-500">*</span></Label>
            <Input data-testid="quick-project-name-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="mis. HUB Jakarta Selatan / SOC Bekasi" className="h-11 mt-1.5" required />
          </div>
          <div>
            <Label>Jenis Pekerjaan <span className="text-red-500">*</span></Label>
            <Select value={form.work_type} onValueChange={v => setForm({ ...form, work_type: v })}>
              <SelectTrigger data-testid="quick-project-worktype-select" className="h-11 mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-white">{WORK_TYPES.map(w => <SelectItem key={w} value={w}>{w}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button type="submit" data-testid="quick-project-submit-btn" disabled={saving} className="w-full rounded-full bg-blue-700 hover:bg-blue-800 h-11 font-semibold">
            <Plus className="h-4 w-4 mr-2" /> {saving ? "Menyimpan…" : "Simpan Proyek"}
          </Button>
        </form>
      </div>
    </Card>
  );
}

export default function Projects() {
  const { user } = useAuth();
  const canWrite = ["owner", "penagihan"].includes(user.role);
  const [tableKey, setTableKey] = useState(0);
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);

  const load = () => api.get("/projects").then(r => setItems(r.data));
  useEffect(() => { load(); }, []);

  // Table view for owner + penagihan
  if (user.role === "owner" || user.role === "penagihan") {
    return (
      <div className="space-y-6">
        <div>
          <div className="text-xs tracking-widest text-slate-500 mb-2">PORTOFOLIO</div>
          <h1 className="font-display font-extrabold text-3xl text-slate-900">Proyek</h1>
          <p className="text-slate-500 mt-1">Daftar HUB/SOC lengkap dengan status penagihan, SPK/RAB, retensi & keterangan yang bisa diubah langsung dari tabel.</p>
        </div>
        <QuickAdd onCreated={() => setTableKey(k => k + 1)} />
        <ProjectsTable key={tableKey} />
      </div>
    );
  }

  // Card view for tim / bendahara (read-only)
  const submit = async () => {
    if (!form.name.trim()) { toast.error("Nama HUB/SOC wajib diisi"); return; }
    try {
      if (editing) { await api.patch(`/projects/${editing.id}`, form); toast.success("Proyek diperbarui"); }
      else { await api.post("/projects", form); toast.success("Proyek dibuat"); }
      setOpen(false); setForm(empty); setEditing(null); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Gagal"); }
  };
  const startEdit = (p) => { setEditing(p); setForm({ name: p.name, work_type: p.work_type || "Renov", client_name: p.client_name || "", description: p.description || "", status: p.status }); setOpen(true); };
  const remove = async (id) => { if (!window.confirm("Hapus proyek?")) return; await api.delete(`/projects/${id}`); toast.success("Dihapus"); load(); };
  const statusStyle = { aktif: "bg-green-100 text-green-700", selesai: "bg-slate-100 text-slate-700", ditunda: "bg-orange-100 text-orange-700" };

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs tracking-widest text-slate-500 mb-2">PORTOFOLIO</div>
        <h1 className="font-display font-extrabold text-3xl text-slate-900">Proyek</h1>
        <p className="text-slate-500 mt-1">Daftar HUB/SOC yang dikelola perusahaan.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map(p => (
          <Card key={p.id} className="p-5 card-lift bg-white border-slate-200" data-testid={`project-card-${p.id}`}>
            <div className="flex items-start justify-between mb-3">
              <div className="h-10 w-10 rounded-md bg-blue-50 text-blue-700 flex items-center justify-center"><FolderKanban className="h-5 w-5" /></div>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusStyle[p.status]}`}>{p.status?.toUpperCase()}</span>
            </div>
            <h3 className="font-display font-bold text-lg text-slate-900">{p.name}</h3>
            {p.work_type && (
              <div className="mt-2 inline-flex items-center gap-1.5">
                <Briefcase className="h-3.5 w-3.5 text-slate-400" />
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${workTypeColor[p.work_type] || "bg-slate-100 text-slate-700"}`}>{p.work_type}</span>
              </div>
            )}
            {p.client_name && <div className="text-sm text-slate-500 mt-3 flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" /> {p.client_name}</div>}
            {p.description && <p className="text-sm text-slate-600 mt-3 line-clamp-2">{p.description}</p>}
            <div className="text-xs text-slate-400 mt-4">{formatDate(p.created_at)}</div>
          </Card>
        ))}
        {items.length === 0 && <div className="col-span-full text-center text-slate-500 py-12">Belum ada proyek.</div>}
      </div>
    </div>
  );
}
