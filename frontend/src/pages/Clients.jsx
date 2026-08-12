import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Trash2, Building2 } from "lucide-react";
import { formatDate } from "@/lib/format";

export default function Clients() {
  const [items, setItems] = useState([]);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => api.get("/clients").then(r => setItems(r.data));
  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) { toast.error("Nama klien wajib diisi"); return; }
    setSaving(true);
    try {
      await api.post("/clients", { name: name.trim().toUpperCase() });
      toast.success("Klien ditambahkan");
      setName("");
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Gagal menambahkan klien");
    } finally { setSaving(false); }
  };

  const remove = async (c) => {
    if (!window.confirm(`Hapus klien "${c.name}"?`)) return;
    try {
      await api.delete(`/clients/${c.id}`);
      toast.success("Klien dihapus");
      load();
    } catch (err) { toast.error(err.response?.data?.detail || "Gagal"); }
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs tracking-widest text-slate-500 mb-2">MASTER DATA</div>
        <h1 className="font-display font-extrabold text-3xl text-slate-900">Klien</h1>
        <p className="text-slate-500 mt-1">Daftar nama klien untuk dipilih saat input proyek baru.</p>
      </div>

      <Card className="p-5 bg-white border-slate-200">
        <form onSubmit={submit} className="flex items-end gap-3 flex-wrap">
          <div className="flex-1 min-w-[240px]">
            <Label>Nama Klien</Label>
            <Input
              data-testid="client-name-input"
              value={name}
              onChange={e => setName(e.target.value.toUpperCase())}
              placeholder="MIS. PT MITRA JAYA"
              className="h-11 mt-1.5 uppercase"
            />
          </div>
          <Button type="submit" disabled={saving} className="h-11 rounded-full bg-blue-700 hover:bg-blue-800" data-testid="client-add-btn">
            <Plus className="h-4 w-4 mr-2" /> Tambah Klien
          </Button>
        </form>
      </Card>

      <Card className="overflow-hidden bg-white border-slate-200">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead>Nama Klien</TableHead>
              <TableHead>Ditambahkan</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map(c => (
              <TableRow key={c.id} data-testid={`client-row-${c.id}`}>
                <TableCell className="font-semibold text-slate-900">
                  <span className="inline-flex items-center gap-2"><Building2 className="h-4 w-4 text-blue-700" /> {c.name}</span>
                </TableCell>
                <TableCell className="text-slate-500 text-sm">{formatDate(c.created_at)}</TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" onClick={() => remove(c)} data-testid={`client-delete-${c.id}`}>
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {items.length === 0 && (
              <TableRow><TableCell colSpan={3} className="text-center text-slate-500 py-8">Belum ada klien. Tambahkan di atas.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
