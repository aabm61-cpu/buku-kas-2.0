import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, MapPin, User, Trash2, Pencil, UserCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { formatDate } from "@/lib/format";

const empty = { project_id: "", name: "", address: "", pic_user_id: "", status: "aktif" };

export default function Locations() {
  const { user } = useAuth();
  const canWrite = ["owner", "bendahara"].includes(user.role);
  const [items, setItems] = useState([]);
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    const [l, p, u] = await Promise.all([api.get("/locations"), api.get("/projects"), api.get("/users").catch(() => ({ data: [] }))]);
    setItems(l.data); setProjects(p.data); setUsers(u.data);
  };
  useEffect(() => { load(); }, []);

  const submit = async () => {
    try {
      const payload = { ...form, pic_user_id: form.pic_user_id || null };
      if (editing) { await api.patch(`/locations/${editing.id}`, payload); toast.success("Lokasi diperbarui"); }
      else { await api.post("/locations", payload); toast.success("Lokasi dibuat"); }
      setOpen(false); setForm(empty); setEditing(null); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Gagal"); }
  };

  const startEdit = (l) => { setEditing(l); setForm({ project_id: l.project_id, name: l.name, address: l.address || "", pic_user_id: l.pic_user_id || "", status: l.status || "aktif" }); setOpen(true); };
  const remove = async (id) => { if (!window.confirm("Hapus lokasi?")) return; await api.delete(`/locations/${id}`); load(); };

  const projectName = (pid) => projects.find(p => p.id === pid)?.name || "-";
  const userName = (uid) => users.find(u => u.id === uid)?.name || "—";

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs tracking-widest text-slate-500 mb-2">TITIK KERJA LAPANGAN</div>
          <h1 className="font-display font-extrabold text-3xl text-slate-900">Lokasi</h1>
        </div>
        {canWrite && (
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); setForm(empty); } }}>
            <DialogTrigger asChild><Button data-testid="location-add-btn" className="rounded-full bg-blue-700 hover:bg-blue-800"><Plus className="h-4 w-4 mr-2" /> Lokasi Baru</Button></DialogTrigger>
            <DialogContent className="bg-white">
              <DialogHeader><DialogTitle>{editing ? "Edit Lokasi" : "Lokasi Baru"}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Proyek</Label>
                  <Select value={form.project_id} onValueChange={v => setForm({ ...form, project_id: v })}>
                    <SelectTrigger data-testid="location-project-select"><SelectValue placeholder="Pilih proyek" /></SelectTrigger>
                    <SelectContent className="bg-white">
                      {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Nama Lokasi</Label><Input data-testid="location-name-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                <div><Label>Alamat</Label><Input data-testid="location-address-input" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
                <div>
                  <Label>PIC (Person In Charge)</Label>
                  <Select value={form.pic_user_id || "none"} onValueChange={v => setForm({ ...form, pic_user_id: v === "none" ? "" : v })}>
                    <SelectTrigger data-testid="location-pic-select"><SelectValue placeholder="Pilih PIC" /></SelectTrigger>
                    <SelectContent className="bg-white">
                      <SelectItem value="none">— Tidak ada —</SelectItem>
                      {users.filter(u => u.role === "tim" || u.role === "bendahara").map(u => <SelectItem key={u.id} value={u.id}>{u.name} ({u.role})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                    <SelectTrigger data-testid="location-status-select"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-white">
                      <SelectItem value="aktif">Aktif</SelectItem>
                      <SelectItem value="selesai">Selesai</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter><Button data-testid="location-submit-btn" onClick={submit} className="bg-blue-700 hover:bg-blue-800">Simpan</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card className="overflow-hidden bg-white border-slate-200">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead>Lokasi</TableHead>
              <TableHead>Proyek</TableHead>
              <TableHead>Alamat</TableHead>
              <TableHead>PIC</TableHead>
              <TableHead>Status</TableHead>
              {canWrite && <TableHead className="text-right">Aksi</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map(l => (
              <TableRow key={l.id} data-testid={`location-row-${l.id}`}>
                <TableCell className="font-medium"><div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-orange-500" /> {l.name}</div></TableCell>
                <TableCell>{projectName(l.project_id)}</TableCell>
                <TableCell className="text-slate-600">{l.address || "-"}</TableCell>
                <TableCell>{l.pic_user_id ? <div className="flex items-center gap-1.5 text-green-700"><UserCheck className="h-4 w-4" /> {userName(l.pic_user_id)}</div> : <span className="text-slate-400">—</span>}</TableCell>
                <TableCell><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${l.status === "aktif" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-700"}`}>{l.status?.toUpperCase()}</span></TableCell>
                {canWrite && (
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => startEdit(l)} data-testid={`location-edit-${l.id}`}><Pencil className="h-4 w-4" /></Button>
                    {user.role === "owner" && <Button size="icon" variant="ghost" onClick={() => remove(l.id)} data-testid={`location-delete-${l.id}`}><Trash2 className="h-4 w-4 text-red-600" /></Button>}
                  </TableCell>
                )}
              </TableRow>
            ))}
            {items.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-slate-500 py-8">Belum ada lokasi.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
