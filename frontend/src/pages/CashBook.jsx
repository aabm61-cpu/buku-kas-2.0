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
import { Plus, TrendingUp, TrendingDown, Trash2, Download, Eye, Camera, BookOpen, MapPin, Layers } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { formatIDR, formatDateTime } from "@/lib/format";
import ReceiptUpload from "@/components/ReceiptUpload";

const emptyEntry = () => ({ type: "pengeluaran", category: "", amount: "", description: "", receipt_base64: "", date: new Date().toISOString().slice(0, 10) });

const categories = {
  pemasukan: ["Termin Klien", "Kas Awal", "Lain-lain"],
  pengeluaran: ["Material", "Upah Harian", "Transport", "Konsumsi", "Sewa Alat", "Lain-lain"],
};

export default function CashBook() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [locations, setLocations] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedLoc, setSelectedLoc] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyEntry());
  const [preview, setPreview] = useState(null);

  const load = async () => {
    const [c, l, p] = await Promise.all([api.get("/cashbook"), api.get("/locations"), api.get("/projects")]);
    setItems(c.data); setLocations(l.data); setProjects(p.data);
    if (!selectedLoc && l.data.length > 0) setSelectedLoc(l.data[0].id);
  };
  useEffect(() => { load(); }, []); // eslint-disable-line

  const canWrite = ["tim", "bendahara", "owner"].includes(user.role);
  const projName = (id) => projects.find(p => p.id === id)?.name || "-";
  const projByLoc = (locId) => projects.find(p => p.id === locations.find(l => l.id === locId)?.project_id);

  // Per-buku-kas summary
  const summaryByLoc = useMemo(() => {
    const map = {};
    locations.forEach(l => { map[l.id] = { in: 0, out: 0, count: 0 }; });
    items.forEach(i => {
      if (!map[i.location_id]) map[i.location_id] = { in: 0, out: 0, count: 0 };
      if (i.type === "pemasukan") map[i.location_id].in += i.amount;
      else map[i.location_id].out += i.amount;
      map[i.location_id].count += 1;
    });
    return map;
  }, [items, locations]);

  const activeEntries = useMemo(() => {
    if (!selectedLoc) return [];
    return items.filter(i => i.location_id === selectedLoc);
  }, [items, selectedLoc]);
  const activeSum = summaryByLoc[selectedLoc] || { in: 0, out: 0, count: 0 };
  const activeLoc = locations.find(l => l.id === selectedLoc);
  const activeProj = activeLoc ? projByLoc(activeLoc.id) : null;

  const submit = async () => {
    if (!selectedLoc) { toast.error("Pilih buku kas terlebih dulu"); return; }
    if (!form.receipt_base64) { toast.error("Foto nota wajib diupload"); return; }
    if (!form.amount || Number(form.amount) <= 0) { toast.error("Nominal tidak valid"); return; }
    try {
      await api.post("/cashbook", { ...form, location_id: selectedLoc, amount: Number(form.amount), date: new Date(form.date).toISOString() });
      toast.success("Pencatatan berhasil");
      setOpen(false); setForm(emptyEntry()); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Gagal"); }
  };

  const remove = async (id) => { if (!window.confirm("Hapus catatan?")) return; await api.delete(`/cashbook/${id}`); load(); };

  const exportCSV = () => {
    const rows = [["Tanggal", "Tipe", "Buku Kas", "Proyek", "Kategori", "Deskripsi", "Jumlah", "Oleh"]];
    activeEntries.forEach(i => rows.push([i.date, i.type, activeLoc?.name || "", projName(i.project_id), i.category, i.description, i.amount, i.user_name || ""]));
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `buku-kas-${activeLoc?.name || "all"}-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs tracking-widest text-slate-500 mb-2">MULTI BUKU KAS · SATU BUKU PER LOKASI PROYEK</div>
        <h1 className="font-display font-extrabold text-3xl text-slate-900">Buku Kas</h1>
        <p className="text-slate-500 mt-1">Pilih buku kas sesuai lokasi proyek Anda. Setiap buku berdiri sendiri — data tidak tercampur antar proyek.</p>
      </div>

      {/* Buku Kas Selector */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Layers className="h-4 w-4 text-blue-700" />
          <div className="text-xs font-semibold tracking-widest text-slate-500">PILIH BUKU KAS</div>
          <div className="text-xs text-slate-400">{locations.length} buku tersedia</div>
        </div>

        {locations.length === 0 ? (
          <Card className="p-6 text-center text-slate-500 bg-white border-slate-200">
            <BookOpen className="h-8 w-8 mx-auto mb-2 text-slate-300" />
            Belum ada lokasi/proyek yang tersedia untuk Anda.
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {locations.map(l => {
              const s = summaryByLoc[l.id] || { in: 0, out: 0, count: 0 };
              const proj = projByLoc(l.id);
              const isActive = selectedLoc === l.id;
              const saldo = s.in - s.out;
              return (
                <button
                  key={l.id}
                  onClick={() => setSelectedLoc(l.id)}
                  data-testid={`bukukas-card-${l.id}`}
                  className={`text-left p-4 rounded-xl border-2 transition-all ${isActive ? "border-blue-700 bg-blue-50 shadow-md" : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${isActive ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-500"}`}>
                      <BookOpen className="h-4 w-4" />
                    </div>
                    {isActive && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-700 text-white">AKTIF</span>}
                  </div>
                  <div className="font-display font-bold text-slate-900 leading-tight truncate">{l.name}</div>
                  {proj && (
                    <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {proj.work_type || "-"}
                    </div>
                  )}
                  <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-500">{s.count} pencatatan</span>
                    <span className={`font-mono tabular font-semibold ${saldo >= 0 ? "text-green-700" : "text-red-700"}`}>{formatIDR(saldo)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Selected Buku Kas Detail */}
      {activeLoc && (
        <>
          <div className="flex items-end justify-between flex-wrap gap-4">
            <div>
              <div className="text-xs tracking-widest text-slate-500 mb-1">BUKU KAS AKTIF</div>
              <h2 className="font-display font-extrabold text-2xl text-slate-900">{activeLoc.name}</h2>
              {activeProj && <div className="text-sm text-slate-500 mt-1">Proyek: <span className="font-semibold text-slate-700">{activeProj.name}</span> · {activeProj.work_type}</div>}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={exportCSV} className="rounded-full" data-testid="cashbook-export-btn"><Download className="h-4 w-4 mr-2" /> Export</Button>
              {canWrite && (
                <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setForm(emptyEntry()); }}>
                  <DialogTrigger asChild><Button data-testid="cashbook-add-btn" className="rounded-full bg-blue-700 hover:bg-blue-800"><Plus className="h-4 w-4 mr-2" /> Catatan Baru</Button></DialogTrigger>
                  <DialogContent className="bg-white max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader><DialogTitle>Catatan Baru — <span className="text-blue-700">{activeLoc.name}</span></DialogTitle></DialogHeader>
                    <div className="space-y-4">
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
            <Card className="p-5 bg-white border-slate-200 card-lift" data-testid="cashbook-summary-in"><div className="flex items-center gap-3"><div className="h-10 w-10 rounded-lg bg-green-50 text-green-700 flex items-center justify-center"><TrendingUp className="h-5 w-5" /></div><div><div className="text-xs text-slate-500 uppercase tracking-wider">Pemasukan</div><div className="font-display font-bold text-xl tabular">{formatIDR(activeSum.in)}</div></div></div></Card>
            <Card className="p-5 bg-white border-slate-200 card-lift" data-testid="cashbook-summary-out"><div className="flex items-center gap-3"><div className="h-10 w-10 rounded-lg bg-red-50 text-red-700 flex items-center justify-center"><TrendingDown className="h-5 w-5" /></div><div><div className="text-xs text-slate-500 uppercase tracking-wider">Pengeluaran</div><div className="font-display font-bold text-xl tabular">{formatIDR(activeSum.out)}</div></div></div></Card>
            <Card className="p-5 bg-blue-700 text-white border-0 card-lift" data-testid="cashbook-summary-balance"><div className="text-xs text-blue-200 uppercase tracking-wider">Saldo</div><div className="font-display font-bold text-2xl tabular mt-2">{formatIDR(activeSum.in - activeSum.out)}</div></Card>
          </div>

          <Card className="overflow-hidden bg-white border-slate-200">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Deskripsi</TableHead>
                  <TableHead>Oleh</TableHead>
                  <TableHead className="text-right">Jumlah</TableHead>
                  <TableHead>Nota</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeEntries.map(i => (
                  <TableRow key={i.id} data-testid={`cashbook-row-${i.id}`}>
                    <TableCell className="text-sm text-slate-600">{formatDateTime(i.date)}</TableCell>
                    <TableCell><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${i.type === "pemasukan" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{i.category}</span></TableCell>
                    <TableCell className="text-slate-700 max-w-xs truncate">{i.description}</TableCell>
                    <TableCell className="text-slate-600 text-sm">{i.user_name || "-"}</TableCell>
                    <TableCell className={`text-right font-mono tabular font-semibold ${i.type === "pemasukan" ? "text-green-700" : "text-red-700"}`}>{i.type === "pemasukan" ? "+" : "-"}{formatIDR(i.amount)}</TableCell>
                    <TableCell>{i.receipt_base64 ? <Button size="icon" variant="ghost" onClick={() => setPreview(i.receipt_base64)} data-testid={`cashbook-view-nota-${i.id}`}><Eye className="h-4 w-4" /></Button> : <Camera className="h-4 w-4 text-slate-300" />}</TableCell>
                    <TableCell>{(user.role === "owner" || i.user_id === user.id) && <Button size="icon" variant="ghost" onClick={() => remove(i.id)}><Trash2 className="h-4 w-4 text-red-600" /></Button>}</TableCell>
                  </TableRow>
                ))}
                {activeEntries.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-slate-500 py-8">Buku kas ini masih kosong. Tekan "Catatan Baru" untuk mulai.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Card>
        </>
      )}

      <Dialog open={!!preview} onOpenChange={(v) => !v && setPreview(null)}>
        <DialogContent className="bg-white max-w-3xl">
          <DialogHeader><DialogTitle>Foto Nota</DialogTitle></DialogHeader>
          {preview && <img src={preview} alt="Nota" className="w-full rounded-lg" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
