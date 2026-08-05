import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { UserPlus, Trash2, Pencil, KeyRound } from "lucide-react";
import { formatDateTime, roleLabel } from "@/lib/format";

const emptyForm = { username: "", password: "", name: "", role: "tim", phone: "" };

export default function Users() {
  const [users, setUsers] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);

  const load = () => api.get("/users").then(r => setUsers(r.data));
  useEffect(() => { load(); }, []);

  const submit = async () => {
    try {
      if (editing) {
        const payload = { name: form.name, role: form.role, phone: form.phone };
        if (form.password) payload.password = form.password;
        await api.patch(`/users/${editing.id}`, payload);
        toast.success("User diperbarui");
      } else {
        await api.post("/users", form);
        toast.success("User dibuat");
      }
      setOpen(false); setForm(emptyForm); setEditing(null); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Gagal"); }
  };

  const toggleActive = async (u) => {
    await api.patch(`/users/${u.id}`, { active: !u.active });
    load();
  };

  const remove = async (u) => {
    try {
      await api.delete(`/users/${u.id}`);
      toast.success("User dihapus");
      load();
    } catch (e) { toast.error(e.response?.data?.detail || "Gagal"); }
  };

  const startEdit = (u) => { setEditing(u); setForm({ username: u.username, password: "", name: u.name, role: u.role, phone: u.phone || "" }); setOpen(true); };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs tracking-widest text-slate-500 mb-2">MANAJEMEN AKSES</div>
          <h1 className="font-display font-extrabold text-3xl text-slate-900">User</h1>
          <p className="text-slate-500 mt-1">Buat & kelola akun untuk seluruh peran.</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); setForm(emptyForm); } }}>
          <DialogTrigger asChild>
            <Button data-testid="user-add-btn" className="rounded-full bg-blue-700 hover:bg-blue-800">
              <UserPlus className="h-4 w-4 mr-2" /> Tambah User
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-white">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit User" : "Tambah User Baru"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Username</Label>
                <Input data-testid="user-username-input" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} disabled={!!editing} />
              </div>
              <div>
                <Label>Nama Lengkap</Label>
                <Input data-testid="user-name-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <Label>{editing ? "Password Baru (kosongkan jika tidak diubah)" : "Password"}</Label>
                <Input data-testid="user-password-input" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
              </div>
              <div>
                <Label>Peran</Label>
                <Select value={form.role} onValueChange={v => setForm({ ...form, role: v })}>
                  <SelectTrigger data-testid="user-role-select"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="owner">Owner</SelectItem>
                    <SelectItem value="penagihan">Penagihan</SelectItem>
                    <SelectItem value="bendahara">Bendahara</SelectItem>
                    <SelectItem value="tim">Tim Lapangan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>No. HP (opsional)</Label>
                <Input data-testid="user-phone-input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button data-testid="user-submit-btn" onClick={submit} className="bg-blue-700 hover:bg-blue-800">Simpan</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="overflow-hidden bg-white border-slate-200">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead>Username</TableHead>
              <TableHead>Nama</TableHead>
              <TableHead>Peran</TableHead>
              <TableHead>No. HP</TableHead>
              <TableHead>Dibuat</TableHead>
              <TableHead>Aktif</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map(u => (
              <TableRow key={u.id} data-testid={`user-row-${u.username}`}>
                <TableCell className="font-mono text-sm">{u.username}</TableCell>
                <TableCell className="font-medium">{u.name}</TableCell>
                <TableCell><span className={`chip-${u.role} inline-flex px-2 py-0.5 rounded-full text-xs font-semibold`}>{roleLabel(u.role)}</span></TableCell>
                <TableCell className="text-slate-600">{u.phone || "-"}</TableCell>
                <TableCell className="text-slate-500 text-sm">{formatDateTime(u.created_at)}</TableCell>
                <TableCell><Switch checked={u.active !== false} onCheckedChange={() => toggleActive(u)} data-testid={`user-active-${u.username}`} /></TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" onClick={() => startEdit(u)} data-testid={`user-edit-${u.username}`}><Pencil className="h-4 w-4" /></Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="icon" variant="ghost" data-testid={`user-delete-${u.username}`}><Trash2 className="h-4 w-4 text-red-600" /></Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="bg-white">
                      <AlertDialogHeader>
                        <AlertDialogTitle>Hapus user?</AlertDialogTitle>
                        <AlertDialogDescription>Aksi ini tidak dapat dibatalkan.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <AlertDialogAction onClick={() => remove(u)} className="bg-red-600 hover:bg-red-700">Hapus</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
