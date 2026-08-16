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
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Plus, TrendingUp, TrendingDown, Trash2, Download, Eye, Camera, BookOpen, MapPin, Layers, BookPlus, EyeOff, Crown, ArrowLeft, CheckCheck, UserPlus, UserCog } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { formatIDR, formatDateTime } from "@/lib/format";
import ReceiptUpload from "@/components/ReceiptUpload";

const emptyEntry = () => ({ type: "pengeluaran", category: "", amount: "", description: "", receipt_base64: "", kasbon_user_id: "" });

const PENGELUARAN_CATS = ["Operasional", "Material", "Kasbon"];

export default function CashBook() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [locations, setLocations] = useState([]);
  const [projects, setProjects] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [selectedLoc, setSelectedLoc] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyEntry());
  const [preview, setPreview] = useState(null);
  // Create Buku Kas dialog
  const [openCreate, setOpenCreate] = useState(false);
  const [availableProjects, setAvailableProjects] = useState([]);
  const [teamUsers, setTeamUsers] = useState([]);
  const [createForm, setCreateForm] = useState({ project_id: "", member_user_ids: [] });

  const load = async () => {
    const [c, l, p, a, us] = await Promise.all([
      api.get("/cashbook"),
      api.get("/locations"),
      api.get("/projects"),
      api.get("/assignments").catch(() => ({ data: [] })),
      api.get("/users").catch(() => ({ data: [] })),
    ]);
    setItems(c.data); setLocations(l.data); setProjects(p.data); setAssignments(a.data); setAllUsers(us.data);
  };
  useEffect(() => { load(); }, []); // eslint-disable-line

  const openCreateDialog = async () => {
    try {
      const [av, us] = await Promise.all([
        api.get("/bukukas/available"),
        api.get("/users"),
      ]);
      setAvailableProjects(av.data);
      setTeamUsers(us.data.filter(u => u.role === "tim" && u.id !== user.id && u.active !== false));
      setCreateForm({ project_id: "", member_user_ids: [] });
      setOpenCreate(true);
    } catch (e) { toast.error("Gagal memuat data"); }
  };

  const submitCreate = async () => {
    if (!createForm.project_id) { toast.error("Pilih proyek terlebih dulu"); return; }
    try {
      const res = await api.post("/bukukas", createForm);
      toast.success(`Buku kas "${res.data.name}" berhasil dibuat`);
      setOpenCreate(false); setCreateForm({ project_id: "", member_user_ids: [] });
      await load();
      setSelectedLoc(res.data.id);
    } catch (e) { toast.error(e.response?.data?.detail || "Gagal"); }
  };

  const toggleMember = (uid) => {
    const on = createForm.member_user_ids.includes(uid);
    setCreateForm({ ...createForm, member_user_ids: on ? createForm.member_user_ids.filter(x => x !== uid) : [...createForm.member_user_ids, uid] });
  };

  const projName = (id) => projects.find(p => p.id === id)?.name || "-";
  const projByLoc = (locId) => projects.find(p => p.id === locations.find(l => l.id === locId)?.project_id);
  const roleAtLoc = (locId) => assignments.find(a => a.location_id === locId && a.user_id === user.id)?.role_type;
  const isViewer = user.role === "tim" && roleAtLoc(selectedLoc) === "viewer";

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

  const activeEntries = useMemo(() => selectedLoc ? items.filter(i => i.location_id === selectedLoc) : [], [items, selectedLoc]);
  const activeSum = summaryByLoc[selectedLoc] || { in: 0, out: 0, count: 0 };
  const activeLoc = locations.find(l => l.id === selectedLoc);
  const activeProj = activeLoc ? projByLoc(activeLoc.id) : null;
  const activeMembers = useMemo(() => {
    if (!selectedLoc) return [];
    return assignments
      .filter(a => a.location_id === selectedLoc)
      .map(a => ({ ...a, name: allUsers.find(u => u.id === a.user_id)?.name || allUsers.find(u => u.id === a.user_id)?.username || "-" }))
      .sort((a, b) => (a.role_type === "pic" ? -1 : 1) - (b.role_type === "pic" ? -1 : 1));
  }, [assignments, allUsers, selectedLoc]);

  const submit = async () => {
    if (!selectedLoc) { toast.error("Pilih buku kas terlebih dulu"); return; }
    if (!form.amount || Number(form.amount) <= 0) { toast.error("Nominal tidak valid"); return; }
    const isKasbon = form.type === "pengeluaran" && form.category === "Kasbon";
    if (form.type === "pengeluaran") {
      if (!form.category) { toast.error("Kategori wajib dipilih"); return; }
      if (isKasbon && !form.kasbon_user_id) { toast.error("Pilih anggota tim yang mengajukan kasbon"); return; }
      if (!isKasbon && !form.receipt_base64) { toast.error("Foto nota wajib diupload untuk pengeluaran"); return; }
    }
    try {
      await api.post("/cashbook", {
        location_id: selectedLoc,
        type: form.type,
        category: form.type === "pemasukan" ? "Pemasukan" : form.category,
        amount: Number(form.amount),
        description: form.description || "",
        receipt_base64: form.type === "pengeluaran" && !isKasbon ? form.receipt_base64 : "",
        kasbon_user_id: isKasbon ? form.kasbon_user_id : null,
        kasbon_user_name: isKasbon ? (activeMembers.find(m => m.user_id === form.kasbon_user_id)?.name || "") : "",
        date: new Date().toISOString(),
      });
      toast.success("Pencatatan berhasil");
      setOpen(false); setForm(emptyEntry()); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Gagal"); }
  };

  const remove = async (id) => { if (!window.confirm("Hapus catatan?")) return; await api.delete(`/cashbook/${id}`); load(); };

  const closeBukuKas = async () => {
    if (!window.confirm(`Selesaikan buku kas "${activeLoc.name}"? Buku ini akan dipindah ke Riwayat Buku Kas dan tidak bisa dicatat lagi.`)) return;
    try {
      await api.post(`/bukukas/${activeLoc.id}/close`);
      toast.success("Buku kas diselesaikan & dipindah ke Riwayat");
      setSelectedLoc(null);
      await load();
    } catch (e) { toast.error(e.response?.data?.detail || "Gagal menyelesaikan"); }
  };

  const canClose = user.role === "owner" || user.role === "bendahara" || roleAtLoc(selectedLoc) === "pic";
  const isPic = user.role === "owner" || roleAtLoc(selectedLoc) === "pic";
  const [openTransfer, setOpenTransfer] = useState(false);
  const [openAddMember, setOpenAddMember] = useState(false);
  const [newPicId, setNewPicId] = useState("");
  const [pickedMembers, setPickedMembers] = useState([]);
  const [otherTims, setOtherTims] = useState([]);

  const openTransferDialog = async () => {
    try {
      const us = await api.get("/users");
      setOtherTims(us.data.filter(u => u.role === "tim" && u.id !== user.id && u.active !== false));
      setNewPicId("");
      setOpenTransfer(true);
    } catch { toast.error("Gagal memuat"); }
  };
  const submitTransfer = async () => {
    if (!newPicId) { toast.error("Pilih PIC baru"); return; }
    try {
      await api.post(`/bukukas/${selectedLoc}/transfer-pic`, { new_pic_user_id: newPicId });
      toast.success("PIC berhasil dipindahkan");
      setOpenTransfer(false); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Gagal"); }
  };

  const openAddDialog = async () => {
    try {
      const us = await api.get("/users");
      const existingIds = assignments.filter(a => a.location_id === selectedLoc).map(a => a.user_id);
      setOtherTims(us.data.filter(u => u.role === "tim" && u.id !== user.id && u.active !== false && !existingIds.includes(u.id)));
      setPickedMembers([]);
      setOpenAddMember(true);
    } catch { toast.error("Gagal memuat"); }
  };
  const submitAddMembers = async () => {
    if (pickedMembers.length === 0) { toast.error("Pilih minimal satu anggota"); return; }
    try {
      const res = await api.post(`/bukukas/${selectedLoc}/add-members`, { member_user_ids: pickedMembers });
      toast.success(`${res.data.added} anggota ditambahkan sebagai peninjau`);
      setOpenAddMember(false); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Gagal"); }
  };

  const exportCSV = () => {
    const rows = [["Tanggal", "Tipe", "Buku Kas", "Kategori", "Deskripsi", "Jumlah", "Oleh"]];
    activeEntries.forEach(i => rows.push([i.date, i.type, activeLoc?.name || "", i.category, i.description, i.amount, i.user_name || ""]));
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `buku-kas-${activeLoc?.name || "all"}-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  };

  const canWrite = ["bendahara", "owner"].includes(user.role) || (user.role === "tim" && !isViewer && roleAtLoc(selectedLoc));

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs tracking-widest text-slate-500 mb-2">MULTI BUKU KAS · SATU BUKU PER LOKASI PROYEK</div>
          <h1 className="font-display font-extrabold text-3xl text-slate-900">Buku Kas</h1>
          <p className="text-slate-500 mt-1">Pilih buku kas sesuai lokasi proyek Anda. Setiap buku berdiri sendiri — data tidak tercampur.</p>
        </div>
        {(user.role === "tim" || user.role === "owner") && !selectedLoc && (
          <Button onClick={openCreateDialog} data-testid="bukukas-create-btn" className="rounded-full bg-orange-500 hover:bg-orange-600">
            <BookPlus className="h-4 w-4 mr-2" /> Buat Buku Kas
          </Button>
        )}
      </div>

      {/* Buku Kas Selector - only shown when no active buku kas */}
      {!selectedLoc && (
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Layers className="h-4 w-4 text-blue-700" />
          <div className="text-xs font-semibold tracking-widest text-slate-500">PILIH BUKU KAS</div>
          <div className="text-xs text-slate-400">{locations.length} buku tersedia</div>
        </div>
        {locations.length === 0 ? (
          <Card className="p-6 text-center text-slate-500 bg-white border-slate-200">
            <BookOpen className="h-8 w-8 mx-auto mb-2 text-slate-300" />
            Belum ada buku kas. Klik <strong>Buat Buku Kas</strong> untuk mengklaim proyek pertama Anda.
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {locations.map(l => {
              const s = summaryByLoc[l.id] || { in: 0, out: 0, count: 0 };
              const proj = projByLoc(l.id);
              const isActive = selectedLoc === l.id;
              const saldo = s.in - s.out;
              const myRole = assignments.find(a => a.location_id === l.id && a.user_id === user.id)?.role_type;
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
                    <div className="flex items-center gap-1">
                      {myRole === "pic" && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 inline-flex items-center gap-1"><Crown className="h-3 w-3" />PEMILIK</span>}
                      {myRole === "viewer" && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 inline-flex items-center gap-1"><EyeOff className="h-3 w-3" />PENINJAU</span>}
                      {isActive && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-700 text-white">AKTIF</span>}
                    </div>
                  </div>
                  <div className="font-display font-bold text-slate-900 leading-tight truncate">{l.name}</div>
                  {proj && <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1"><MapPin className="h-3 w-3" /> {proj.work_type || "-"}</div>}
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
      )}

      {/* Active Buku Kas Detail */}
      {activeLoc && (
        <>
          <div className="flex items-end justify-between flex-wrap gap-4">
            <div className="flex items-start gap-3">
              <Button variant="outline" size="icon" onClick={() => setSelectedLoc(null)} data-testid="bukukas-back-btn" className="rounded-full mt-1"><ArrowLeft className="h-4 w-4" /></Button>
              <div>
                <div className="text-xs tracking-widest text-slate-500 mb-1">BUKU KAS AKTIF {isViewer && "· MODE PENINJAU"}</div>
                <h2 className="font-display font-extrabold text-2xl text-slate-900">{activeLoc.name}</h2>
                {activeProj && <div className="text-sm text-slate-500 mt-1">Proyek: <span className="font-semibold text-slate-700">{activeProj.name}</span> · {activeProj.work_type}</div>}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {isPic && (
                <>
                  <Button onClick={openTransferDialog} data-testid="bukukas-transfer-btn" variant="outline" className="rounded-full">
                    <UserCog className="h-4 w-4 mr-2" /> Pindah PIC
                  </Button>
                  <Button onClick={openAddDialog} data-testid="bukukas-add-member-btn" variant="outline" className="rounded-full">
                    <UserPlus className="h-4 w-4 mr-2" /> Tambah Tim
                  </Button>
                </>
              )}
              {canClose && (
                <Button onClick={closeBukuKas} data-testid="bukukas-close-btn" className="rounded-full bg-green-600 hover:bg-green-700 text-white">
                  <CheckCheck className="h-4 w-4 mr-2" /> Selesai
                </Button>
              )}
              {canWrite && (
                <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setForm(emptyEntry()); }}>
                  <DialogTrigger asChild><Button data-testid="cashbook-add-btn" className="rounded-full bg-blue-700 hover:bg-blue-800"><Plus className="h-4 w-4 mr-2" /> Catatan Baru</Button></DialogTrigger>
                  <DialogContent className="bg-white max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader><DialogTitle>Catatan Baru — <span className="text-blue-700">{activeLoc.name}</span></DialogTitle></DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label className="mb-2 block">Tipe Catatan</Label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            data-testid="cashbook-type-pemasukan"
                            onClick={() => setForm({ ...emptyEntry(), type: "pemasukan" })}
                            className={`p-3 rounded-lg border-2 flex flex-col items-center gap-1 transition ${form.type === "pemasukan" ? "border-green-600 bg-green-50 text-green-800" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`}
                          >
                            <TrendingUp className="h-5 w-5" />
                            <span className="font-semibold text-sm">Pemasukan</span>
                          </button>
                          <button
                            type="button"
                            data-testid="cashbook-type-pengeluaran"
                            onClick={() => setForm({ ...emptyEntry(), type: "pengeluaran" })}
                            className={`p-3 rounded-lg border-2 flex flex-col items-center gap-1 transition ${form.type === "pengeluaran" ? "border-red-600 bg-red-50 text-red-800" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`}
                          >
                            <TrendingDown className="h-5 w-5" />
                            <span className="font-semibold text-sm">Pengeluaran</span>
                          </button>
                        </div>
                      </div>

                      {form.type === "pemasukan" && (
                        <div><Label>Nominal (Rp) <span className="text-red-500">*</span></Label><Input type="number" data-testid="cashbook-amount-input" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} className="h-11 mt-1.5 font-mono tabular" placeholder="0" /></div>
                      )}

                      {form.type === "pengeluaran" && (
                        <>
                          <div>
                            <Label>Kategori <span className="text-red-500">*</span></Label>
                            <Select value={form.category} onValueChange={v => setForm({ ...form, category: v, kasbon_user_id: "", receipt_base64: v === "Kasbon" ? "" : form.receipt_base64 })}>
                              <SelectTrigger data-testid="cashbook-category-select" className="h-11 mt-1.5"><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
                              <SelectContent className="bg-white">{PENGELUARAN_CATS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          {form.category === "Kasbon" && (
                            <div>
                              <Label>Nama Pengaju Kasbon <span className="text-red-500">*</span></Label>
                              <Select value={form.kasbon_user_id} onValueChange={v => setForm({ ...form, kasbon_user_id: v })}>
                                <SelectTrigger data-testid="cashbook-kasbon-member-select" className="h-11 mt-1.5"><SelectValue placeholder="Pilih anggota tim" /></SelectTrigger>
                                <SelectContent className="bg-white">
                                  {activeMembers.length === 0 && <div className="p-3 text-sm text-slate-500 text-center">Belum ada anggota tim di buku kas ini.</div>}
                                  {activeMembers.map(m => <SelectItem key={m.user_id} value={m.user_id}>{m.name}{m.role_type === "pic" ? " (PIC)" : ""}</SelectItem>)}
                                </SelectContent>
                              </Select>
                              <p className="text-xs text-slate-500 mt-1">Diambil dari anggota tim yang sudah ditambahkan di buku kas ini. Foto nota tidak diperlukan untuk kasbon.</p>
                            </div>
                          )}
                          <div><Label>Nominal (Rp) <span className="text-red-500">*</span></Label><Input type="number" data-testid="cashbook-amount-input" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} className="h-11 mt-1.5 font-mono tabular" placeholder="0" /></div>
                          <div><Label>Keterangan / Deskripsi (opsional)</Label><Textarea data-testid="cashbook-desc-input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Contoh: Beli semen 5 sak" /></div>
                          {form.category !== "Kasbon" && (
                            <div>
                              <Label className="mb-2 block">Foto Nota <span className="text-red-500">*</span></Label>
                              <ReceiptUpload value={form.receipt_base64} onChange={(b64) => setForm({ ...form, receipt_base64: b64 })} testId="cashbook-receipt" />
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    <DialogFooter><Button onClick={submit} data-testid="cashbook-submit-btn" className={form.type === "pemasukan" ? "bg-green-600 hover:bg-green-700" : "bg-blue-700 hover:bg-blue-800"}>Simpan</Button></DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>

          {isViewer && (
            <Card className="p-3 bg-slate-50 border-slate-200 flex items-center gap-2 text-sm text-slate-700">
              <EyeOff className="h-4 w-4" /> Anda tercatat sebagai <strong>peninjau</strong> di buku kas ini — hanya bisa melihat, tidak bisa mencatat.
            </Card>
          )}

          {activeMembers.length > 0 && (
            <Card className="p-4 bg-white border-slate-200" data-testid="bukukas-members-card">
              <div className="flex items-center gap-2 mb-2.5">
                <UserPlus className="h-4 w-4 text-blue-700" />
                <span className="text-xs font-semibold tracking-widest text-slate-500">ANGGOTA TIM DI BUKU KAS INI · {activeMembers.length} ORANG</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {activeMembers.map(m => (
                  <span
                    key={m.id}
                    data-testid={`bukukas-member-${m.user_id}`}
                    className={`inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1 rounded-full border ${m.role_type === "pic" ? "bg-orange-50 border-orange-200 text-orange-800" : "bg-slate-50 border-slate-200 text-slate-700"}`}
                  >
                    {m.role_type === "pic" && <Crown className="h-3.5 w-3.5" />}
                    {m.name}
                    <span className="text-[10px] uppercase tracking-wider opacity-70">{m.role_type === "pic" ? "PIC" : "Peninjau"}</span>
                  </span>
                ))}
              </div>
            </Card>
          )}

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
                    <TableCell className="text-slate-700 max-w-xs truncate">{i.kasbon_user_name ? <span className="font-semibold text-slate-900">{i.kasbon_user_name}</span> : null}{i.kasbon_user_name && i.description ? " — " : ""}{i.description || (i.kasbon_user_name ? "" : "-")}</TableCell>
                    <TableCell className={`text-right font-mono tabular font-semibold ${i.type === "pemasukan" ? "text-green-700" : "text-red-700"}`}>{i.type === "pemasukan" ? "+" : "-"}{formatIDR(i.amount)}</TableCell>
                    <TableCell>{i.receipt_base64 ? <Button size="icon" variant="ghost" onClick={() => setPreview(i.receipt_base64)} data-testid={`cashbook-view-nota-${i.id}`}><Eye className="h-4 w-4" /></Button> : <span className="text-slate-300 text-xs">—</span>}</TableCell>
                    <TableCell>{(user.role === "owner" || (i.user_id === user.id && !isViewer)) && <Button size="icon" variant="ghost" onClick={() => remove(i.id)}><Trash2 className="h-4 w-4 text-red-600" /></Button>}</TableCell>
                  </TableRow>
                ))}
                {activeEntries.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-slate-500 py-8">Buku kas ini masih kosong.{canWrite && ` Tekan "Catatan Baru" untuk mulai.`}</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Card>
        </>
      )}

      {/* Buat Buku Kas Dialog */}
      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent className="bg-white max-w-lg">
          <DialogHeader><DialogTitle>Buat Buku Kas Baru</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nama Buku Kas (Proyek Berjalan)</Label>
              <Select value={createForm.project_id} onValueChange={v => setCreateForm({ ...createForm, project_id: v })}>
                <SelectTrigger data-testid="bukukas-project-select" className="h-11 mt-1.5"><SelectValue placeholder="Pilih proyek yang akan diklaim" /></SelectTrigger>
                <SelectContent className="bg-white">
                  {availableProjects.length === 0 && <div className="p-3 text-sm text-slate-500 text-center">Tidak ada proyek tersedia. Semua sudah diklaim tim lain.</div>}
                  {availableProjects.map(p => <SelectItem key={p.id} value={p.id}>{p.name} · {p.work_type}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500 mt-1.5">Setelah diklaim, proyek ini tidak muncul lagi di dropdown tim lain.</p>
              {(() => {
                const sp = availableProjects.find(p => p.id === createForm.project_id);
                if (sp && (sp.work_type === "Addwork" || sp.work_type === "Maintenance") && sp.maintenance_notes) {
                  return (
                    <div className={`mt-2 p-3 rounded-lg border text-sm ${sp.work_type === "Maintenance" ? "bg-green-50 border-green-200" : "bg-orange-50 border-orange-200"}`} data-testid="bukukas-project-notes">
                      <div className={`text-xs font-semibold mb-1 ${sp.work_type === "Maintenance" ? "text-green-800" : "text-orange-800"}`}>Keterangan Pekerjaan {sp.work_type}</div>
                      <div className="text-slate-700">{sp.maintenance_notes}</div>
                    </div>
                  );
                }
                return null;
              })()}
            </div>
            <div>
              <Label>Tambahkan Anggota Tim (Peninjau — Read Only)</Label>
              <div className="mt-1.5 border border-slate-200 rounded-lg max-h-48 overflow-y-auto p-2 bg-slate-50">
                {teamUsers.length === 0 && <div className="text-sm text-slate-500 p-2 text-center">Tidak ada anggota tim lain.</div>}
                {teamUsers.map(u => (
                  <label key={u.id} className="flex items-center gap-3 p-2 rounded hover:bg-white cursor-pointer" data-testid={`bukukas-member-${u.id}`}>
                    <Checkbox checked={createForm.member_user_ids.includes(u.id)} onCheckedChange={() => toggleMember(u.id)} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-slate-900 truncate">{u.name}</div>
                      <div className="text-xs text-slate-500">@{u.username}</div>
                    </div>
                    <EyeOff className="h-3.5 w-3.5 text-slate-400" />
                  </label>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-1.5">Anggota yang ditambahkan hanya dapat <strong>melihat</strong> buku kas ini, tidak dapat membuat/mengedit catatan.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenCreate(false)}>Batal</Button>
            <Button onClick={submitCreate} data-testid="bukukas-create-submit" className="bg-orange-500 hover:bg-orange-600">Buat Buku Kas</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer PIC Dialog */}
      <Dialog open={openTransfer} onOpenChange={setOpenTransfer}>
        <DialogContent className="bg-white max-w-md">
          <DialogHeader><DialogTitle>Pindah PIC Buku Kas</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-slate-600">PIC baru akan bisa mencatat pemasukan/pengeluaran. Anda otomatis menjadi peninjau (read-only).</p>
            <Label>Pilih Tim Pengganti</Label>
            <Select value={newPicId} onValueChange={setNewPicId}>
              <SelectTrigger data-testid="transfer-pic-select"><SelectValue placeholder="Pilih anggota tim" /></SelectTrigger>
              <SelectContent className="bg-white">
                {otherTims.map(u => <SelectItem key={u.id} value={u.id}>{u.name} · @{u.username}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenTransfer(false)}>Batal</Button>
            <Button onClick={submitTransfer} data-testid="transfer-pic-submit" className="bg-blue-700 hover:bg-blue-800">Pindahkan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Members Dialog */}
      <Dialog open={openAddMember} onOpenChange={setOpenAddMember}>
        <DialogContent className="bg-white max-w-md">
          <DialogHeader><DialogTitle>Tambah Anggota Tim (Peninjau)</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-slate-600">Anggota yang ditambahkan hanya bisa <strong>melihat</strong> catatan buku kas ini.</p>
            <div className="border border-slate-200 rounded-lg max-h-56 overflow-y-auto p-2 bg-slate-50">
              {otherTims.length === 0 && <div className="text-sm text-slate-500 p-2 text-center">Semua tim sudah tergabung atau tidak ada tim lain.</div>}
              {otherTims.map(u => (
                <label key={u.id} className="flex items-center gap-3 p-2 rounded hover:bg-white cursor-pointer" data-testid={`addmember-${u.id}`}>
                  <Checkbox
                    checked={pickedMembers.includes(u.id)}
                    onCheckedChange={() => setPickedMembers(p => p.includes(u.id) ? p.filter(x => x !== u.id) : [...p, u.id])}
                  />
                  <div className="flex-1">
                    <div className="text-sm font-semibold">{u.name}</div>
                    <div className="text-xs text-slate-500">@{u.username}</div>
                  </div>
                  <EyeOff className="h-3.5 w-3.5 text-slate-400" />
                </label>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenAddMember(false)}>Batal</Button>
            <Button onClick={submitAddMembers} data-testid="addmember-submit" className="bg-orange-500 hover:bg-orange-600">Tambahkan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!preview} onOpenChange={(v) => !v && setPreview(null)}>
        <DialogContent className="bg-white max-w-3xl">
          <DialogHeader><DialogTitle>Foto Nota</DialogTitle></DialogHeader>
          {preview && <img src={preview} alt="Nota" className="w-full rounded-lg" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
