import React, { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, TrendingUp, TrendingDown, Trash2, Download, Eye, Camera } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { formatIDR, formatDateTime } from "@/lib/format";
import ReceiptUpload from "@/components/ReceiptUpload";

const empty = () => ({ location_id: "", type: "pengeluaran", category: "", amount: "", description: "", receipt_base64: "", date: new Date().toISOString().slice(0, 10) });

const categories = {
  pemasukan: ["Termin Klien", "Kas Awal", "Lain-lain"],
  pengeluaran: ["Material", "Upah Harian", "Transport", "Konsumsi", "Sewa Alat", "Lain-lain"],
};

export default function CashBook() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [locations, setLocations] = useState([]);
  const [projects, setProjects] = useState([]);
  const [filter, setFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty());
  const [preview, setPreview] = useState(null);

  const load = async () => {
    const [c, l, p] = await Promise.all([api.get("/cashbook"), api.get("/locations"), api.get("/projects")]);
    setItems(c.data); setLocations(l.data); setProjects(p.data);
  };
  useEffect(() => { load(); }, []);

  const canWrite = ["tim", "bendahara", "owner"].includes(user.role);

  const submit = async () => {
    if (!form.receipt_base64) { toast.error("Foto nota wajib diupload"); return; }
    if (!form.location_id) { toast.error("Pilih lokasi"); return; }
    if (!form.amount || Number(form.amount) <= 0) { toast.error("Nominal tidak valid"); return; }
    try {
      await api.post("/cashbook", { ...form, amount: Number(form.amount), date: new Date(form.date).toISOString() });
      toast.success("Pencatatan berhasil");
      setOpen(false); setForm(empty()); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Gagal"); }
  };

  const remove = async (id) => { if (!window.confirm("Hapus catatan?")) return; await api.delete(`/cashbook/${id}`); load(); };

  const locName = (id) => locations.find(l => l.id === id)?.name || "-";
  const projName = (id) => projects.find(p => p.id === id)?.name || "-";

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    return items.filter(i => i.location_id === filter);
  }, [items, filter]);

  const totalIn = filtered.filter(i => i.type === "pemasukan").reduce((s, i) => s + i.amount, 0);
  const totalOut = filtered.filter(i => i.type === "pengeluaran").reduce((s, i) => s + i.amount, 0);

  const exportCSV = () => {
    const rows = [["Tanggal", "Tipe", "Lokasi", "Proyek", "Kategori", "Deskripsi", "Jumlah", "Dicatat oleh"]];
    filtered.forEach(i => rows.push([i.date, i.type, locName(i.location_id), projName(i.project_id), i.category, i.description, i.amount, i.user_name || ""]));
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `buku-kas-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs tracking-widest text-slate-500 mb-2">CATATAN OPERASIONAL LAPANGAN</div>
          <h1 className="font-display font-extrabold text-3xl text-slate-900">Buku Kas</h1>
          <p className="text-slate-500 mt-1">Setiap pencatatan wajib menyertakan foto nota sebagai bukti.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-56" data-testid="cashbook-filter"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-white">
              <SelectItem value="all">Semua Lokasi</SelectItem>
              {locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={exportCSV} className="rounded-full" data-testid="cashbook-export-btn"><Download className="h-4 w-4 mr-2" /> Export</Button>
          {canWrite && (
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setForm(empty()); }}>
              <DialogTrigger asChild><Button data-testid="cashbook-add-btn" className="rounded-full bg-blue-700 hover:bg-blue-800"><Plus className="h-4 w-4 mr-2" /> Catatan Baru</Button></DialogTrigger>
              <DialogContent className="bg-white max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Catatan Buku Kas</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Lokasi</Label>
                    <Select value={form.location_id} onValueChange={v => setForm({ ...form, location_id: v })}>
                      <SelectTrigger data-testid="cashbook-location-select"><SelectValue placeholder="Pilih lokasi" /></SelectTrigger>
                      <SelectContent className="bg-white">{locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Tipe</Label>
                      <Select value={form.type} onValueChange={v => setForm({ ...form, type: v, category: "" })}>
                        <SelectTrigger data-testid="cashbook-type-select"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-white">
                          <SelectItem value="pemasukan">Pemasukan</SelectItem>
                          <SelectItem value="pengeluaran">Pengeluaran</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Kategori</Label>
                      <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                        <SelectTrigger data-testid="cashbook-category-select"><SelectValue placeholder="Pilih" /></SelectTrigger>
                        <SelectContent className="bg-white">{categories[form.type].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Jumlah (Rp)</Label><Input type="number" data-testid="cashbook-amount-input" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></div>
                    <div><Label>Tanggal</Label><Input type="date" data-testid="cashbook-date-input" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
                  </div>
                  <div><Label>Deskripsi</Label><Textarea data-testid="cashbook-desc-input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Contoh: Beli semen 5 sak" /></div>
                  <div>
                    <Label className="mb-2 block">Foto Nota <span className="text-red-500">*</span></Label>
                    <ReceiptUpload value={form.receipt_base64} onChange={(b64) => setForm({ ...form, receipt_base64: b64 })} testId="cashbook-receipt" />
                  </div>
                </div>
                <DialogFooter><Button onClick={submit} data-testid="cashbook-submit-btn" className="bg-blue-700 hover:bg-blue-800">Simpan</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5 bg-white border-slate-200 card-lift" data-testid="cashbook-summary-in"><div className="flex items-center gap-3"><div className="h-10 w-10 rounded-lg bg-green-50 text-green-700 flex items-center justify-center"><TrendingUp className="h-5 w-5" /></div><div><div className="text-xs text-slate-500 uppercase tracking-wider">Pemasukan</div><div className="font-display font-bold text-xl tabular">{formatIDR(totalIn)}</div></div></div></Card>
        <Card className="p-5 bg-white border-slate-200 card-lift" data-testid="cashbook-summary-out"><div className="flex items-center gap-3"><div className="h-10 w-10 rounded-lg bg-red-50 text-red-700 flex items-center justify-center"><TrendingDown className="h-5 w-5" /></div><div><div className="text-xs text-slate-500 uppercase tracking-wider">Pengeluaran</div><div className="font-display font-bold text-xl tabular">{formatIDR(totalOut)}</div></div></div></Card>
        <Card className="p-5 bg-blue-700 text-white border-0 card-lift" data-testid="cashbook-summary-balance"><div className="text-xs text-blue-200 uppercase tracking-wider">Saldo</div><div className="font-display font-bold text-2xl tabular mt-2">{formatIDR(totalIn - totalOut)}</div></Card>
      </div>

      <Card className="overflow-hidden bg-white border-slate-200">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead>Tanggal</TableHead>
              <TableHead>Lokasi</TableHead>
              <TableHead>Kategori</TableHead>
              <TableHead>Deskripsi</TableHead>
              <TableHead>Oleh</TableHead>
              <TableHead className="text-right">Jumlah</TableHead>
              <TableHead>Nota</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(i => (
              <TableRow key={i.id} data-testid={`cashbook-row-${i.id}`}>
                <TableCell className="text-sm text-slate-600">{formatDateTime(i.date)}</TableCell>
                <TableCell>{locName(i.location_id)}</TableCell>
                <TableCell><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${i.type === "pemasukan" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{i.category}</span></TableCell>
                <TableCell className="text-slate-700 max-w-xs truncate">{i.description}</TableCell>
                <TableCell className="text-slate-600 text-sm">{i.user_name || "-"}</TableCell>
                <TableCell className={`text-right font-mono tabular font-semibold ${i.type === "pemasukan" ? "text-green-700" : "text-red-700"}`}>{i.type === "pemasukan" ? "+" : "-"}{formatIDR(i.amount)}</TableCell>
                <TableCell>{i.receipt_base64 ? <Button size="icon" variant="ghost" onClick={() => setPreview(i.receipt_base64)} data-testid={`cashbook-view-nota-${i.id}`}><Eye className="h-4 w-4" /></Button> : <Camera className="h-4 w-4 text-slate-300" />}</TableCell>
                <TableCell>{(user.role === "owner" || i.user_id === user.id) && <Button size="icon" variant="ghost" onClick={() => remove(i.id)}><Trash2 className="h-4 w-4 text-red-600" /></Button>}</TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-slate-500 py-8">Belum ada catatan.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!preview} onOpenChange={(v) => !v && setPreview(null)}>
        <DialogContent className="bg-white max-w-3xl">
          <DialogHeader><DialogTitle>Foto Nota</DialogTitle></DialogHeader>
          {preview && <img src={preview} alt="Nota" className="w-full rounded-lg" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
