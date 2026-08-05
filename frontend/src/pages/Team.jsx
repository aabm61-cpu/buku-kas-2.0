import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { UserPlus, Trash2, Users as UsersIcon } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { formatIDR, roleLabel } from "@/lib/format";

export default function Team() {
  const { user } = useAuth();
  const [locations, setLocations] = useState([]);
  const [users, setUsers] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [locId, setLocId] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ user_id: "", daily_rate: 0 });

  const load = async () => {
    const [l, u, a] = await Promise.all([api.get("/locations"), api.get("/users"), api.get("/assignments")]);
    setLocations(l.data); setUsers(u.data); setAssignments(a.data);
    if (!locId && l.data[0]) setLocId(l.data[0].id);
  };
  useEffect(() => { load(); }, []);

  const filtered = assignments.filter(a => a.location_id === locId);
  const userName = (id) => users.find(u => u.id === id)?.name || "?";
  const userRole = (id) => users.find(u => u.id === id)?.role || "-";

  const submit = async () => {
    try {
      await api.post("/assignments", { location_id: locId, user_id: form.user_id, daily_rate: Number(form.daily_rate) });
      toast.success("Anggota ditambahkan"); setOpen(false); setForm({ user_id: "", daily_rate: 0 }); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Gagal"); }
  };

  const remove = async (aid) => { if (!window.confirm("Hapus penugasan?")) return; await api.delete(`/assignments/${aid}`); load(); };

  const availableUsers = users.filter(u => u.role === "tim" && !filtered.find(a => a.user_id === u.id));

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs tracking-widest text-slate-500 mb-2">TIM PER LOKASI</div>
          <h1 className="font-display font-extrabold text-3xl text-slate-900">Anggota Tim</h1>
          <p className="text-slate-500 mt-1">Kelola anggota tim yang ditugaskan di setiap lokasi.</p>
        </div>
        <div className="flex gap-2 items-center">
          <Select value={locId} onValueChange={setLocId}>
            <SelectTrigger className="w-64" data-testid="team-location-select"><SelectValue placeholder="Pilih lokasi" /></SelectTrigger>
            <SelectContent className="bg-white">{locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
          </Select>
          {locId && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button data-testid="team-add-btn" className="rounded-full bg-blue-700 hover:bg-blue-800"><UserPlus className="h-4 w-4 mr-2" /> Tambah</Button></DialogTrigger>
              <DialogContent className="bg-white">
                <DialogHeader><DialogTitle>Tambah Anggota Tim</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Anggota</Label>
                    <Select value={form.user_id} onValueChange={v => setForm({ ...form, user_id: v })}>
                      <SelectTrigger data-testid="team-user-select"><SelectValue placeholder="Pilih anggota" /></SelectTrigger>
                      <SelectContent className="bg-white">{availableUsers.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Upah Harian (Rp)</Label><Input type="number" value={form.daily_rate} onChange={e => setForm({ ...form, daily_rate: e.target.value })} data-testid="team-rate-input" /></div>
                </div>
                <DialogFooter><Button onClick={submit} data-testid="team-submit-btn" className="bg-blue-700 hover:bg-blue-800">Simpan</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <Card className="overflow-hidden bg-white border-slate-200">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead>Nama</TableHead>
              <TableHead>Peran</TableHead>
              <TableHead className="text-right">Upah / Hari</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(a => (
              <TableRow key={a.id} data-testid={`team-row-${a.id}`}>
                <TableCell className="font-medium">{userName(a.user_id)}</TableCell>
                <TableCell><span className={`chip-${userRole(a.user_id)} inline-flex px-2 py-0.5 rounded-full text-xs font-semibold`}>{roleLabel(userRole(a.user_id))}</span></TableCell>
                <TableCell className="text-right font-mono tabular">{formatIDR(a.daily_rate)}</TableCell>
                <TableCell><Button size="icon" variant="ghost" onClick={() => remove(a.id)} data-testid={`team-remove-${a.id}`}><Trash2 className="h-4 w-4 text-red-600" /></Button></TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-slate-500 py-8"><UsersIcon className="h-8 w-8 mx-auto mb-2 text-slate-300" />Belum ada anggota di lokasi ini.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
