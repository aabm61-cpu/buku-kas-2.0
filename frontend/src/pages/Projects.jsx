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
import { Plus, FolderKanban, Building2, Trash2, Pencil } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { formatDate } from "@/lib/format";

const empty = { name: "", client_name: "", description: "", status: "aktif" };

export default function Projects() {
  const { user } = useAuth();
  const canWrite = ["owner", "penagihan"].includes(user.role);
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);

  const load = () => api.get("/projects").then(r => setItems(r.data));
  useEffect(() => { load(); }, []);

  const submit = async () => {
    try {
      if (editing) { await api.patch(`/projects/${editing.id}`, form); toast.success("Proyek diperbarui"); }
      else { await api.post("/projects", form); toast.success("Proyek dibuat"); }
      setOpen(false); setForm(empty); setEditing(null); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Gagal"); }
  };

  const startEdit = (p) => { setEditing(p); setForm({ name: p.name, client_name: p.client_name, description: p.description || "", status: p.status }); setOpen(true); };

  const remove = async (id) => {
    if (!window.confirm("Hapus proyek?")) return;
    await api.delete(`/projects/${id}`);
    toast.success("Dihapus"); load();
  };

  const statusStyle = { aktif: "bg-green-100 text-green-700", selesai: "bg-slate-100 text-slate-700", ditunda: "bg-orange-100 text-orange-700" };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs tracking-widest text-slate-500 mb-2">PORTOFOLIO</div>
          <h1 className="font-display font-extrabold text-3xl text-slate-900">Proyek</h1>
          <p className="text-slate-500 mt-1">Semua proyek renovasi yang dikelola perusahaan.</p>
        </div>
        {canWrite && (
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); setForm(empty); } }}>
            <DialogTrigger asChild><Button data-testid="project-add-btn" className="rounded-full bg-blue-700 hover:bg-blue-800"><Plus className="h-4 w-4 mr-2" /> Proyek Baru</Button></DialogTrigger>
            <DialogContent className="bg-white">
              <DialogHeader><DialogTitle>{editing ? "Edit Proyek" : "Proyek Baru"}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Nama Proyek</Label><Input data-testid="project-name-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                <div><Label>Nama Klien</Label><Input data-testid="project-client-input" value={form.client_name} onChange={e => setForm({ ...form, client_name: e.target.value })} /></div>
                <div><Label>Deskripsi</Label><Textarea data-testid="project-desc-input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
                <div>
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                    <SelectTrigger data-testid="project-status-select"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-white">
                      <SelectItem value="aktif">Aktif</SelectItem>
                      <SelectItem value="selesai">Selesai</SelectItem>
                      <SelectItem value="ditunda">Ditunda</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter><Button data-testid="project-submit-btn" onClick={submit} className="bg-blue-700 hover:bg-blue-800">Simpan</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map(p => (
          <Card key={p.id} className="p-5 card-lift bg-white border-slate-200" data-testid={`project-card-${p.id}`}>
            <div className="flex items-start justify-between mb-3">
              <div className="h-10 w-10 rounded-md bg-blue-50 text-blue-700 flex items-center justify-center"><FolderKanban className="h-5 w-5" /></div>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusStyle[p.status]}`}>{p.status.toUpperCase()}</span>
            </div>
            <h3 className="font-display font-bold text-lg text-slate-900">{p.name}</h3>
            <div className="text-sm text-slate-500 mt-1 flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" /> {p.client_name}</div>
            {p.description && <p className="text-sm text-slate-600 mt-3 line-clamp-2">{p.description}</p>}
            <div className="text-xs text-slate-400 mt-4">{formatDate(p.created_at)}</div>
            {canWrite && (
              <div className="mt-4 flex gap-2 border-t border-slate-100 pt-3">
                <Button size="sm" variant="ghost" onClick={() => startEdit(p)} data-testid={`project-edit-${p.id}`}><Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit</Button>
                {user.role === "owner" && <Button size="sm" variant="ghost" onClick={() => remove(p.id)} data-testid={`project-delete-${p.id}`} className="text-red-600 hover:text-red-700"><Trash2 className="h-3.5 w-3.5 mr-1.5" /> Hapus</Button>}
              </div>
            )}
          </Card>
        ))}
        {items.length === 0 && <div className="col-span-full text-center text-slate-500 py-12">Belum ada proyek.</div>}
      </div>
    </div>
  );
}
