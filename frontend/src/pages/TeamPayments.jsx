import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Plus, Eye, Trash2, Wallet, FolderSearch, AlertTriangle, Download, CheckCircle2, MapPin,
  Users, ListChecks, Crown, CalendarDays, Hourglass, Undo2, Lock, Receipt,
} from "lucide-react";
import { formatIDR, formatDate, formatDateTime, monthLabel } from "@/lib/format";
import { useAuth } from "@/context/AuthContext";

const todayStr = () => new Date().toISOString().slice(0, 10);

const PERIODS = [
  { value: "1-15", label: "Tanggal 1 s/d 15" },
  { value: "16-end", label: "Tanggal 16 s/d Akhir Bulan" },
];
const periodLabel = (v) => PERIODS.find(p => p.value === v)?.label || v;

export default function TeamPayments() {
  const { user } = useAuth();
  const canDelete = user.role === "owner";
  const [activeTab, setActiveTab] = useState("waiting");
  const [history, setHistory] = useState([]);
  const [projects, setProjects] = useState([]);
  const [payments, setPayments] = useState([]);
  const [entries, setEntries] = useState([]);
  // Tab Menunggu/Siap Dibayar
  const [actionLoc, setActionLoc] = useState(null);
  const [rows, setRows] = useState([]);
  const [savingPay, setSavingPay] = useState(false);
  const [month, setMonth] = useState("all");
  // Tab Riwayat Entri
  const [open, setOpen] = useState(false);
  const [fMonth, setFMonth] = useState("");
  const [period, setPeriod] = useState("");
  const [savingEntry, setSavingEntry] = useState(false);
  const [memberDetail, setMemberDetail] = useState(null); // { entry, member }

  const load = async () => {
    const [h, p, tp, en] = await Promise.all([
      api.get("/bukukas/history"),
      api.get("/projects"),
      api.get("/team-payments"),
      api.get("/payment-entries"),
    ]);
    setHistory(h.data); setProjects(p.data); setPayments(tp.data); setEntries(en.data);
  };
  useEffect(() => { load(); }, []);

  const paidCount = (locId) => payments.filter(p => p.location_id === locId && p.paid).length;

  const months = [...new Set(history.map(l => (l.closed_at || "").slice(0, 7)).filter(Boolean))].sort().reverse();
  const filteredHistory = month === "all" ? history : history.filter(l => (l.closed_at || "").slice(0, 7) === month);
  // Lokasi yang sudah dibukukan di entri pembayaran hilang dari tab Siap Dibayar (muncul lagi jika entri dihapus)
  const bookedIds = new Set(entries.flatMap(en => en.location_ids || []));
  const waitingList = filteredHistory.filter(l => !l.payment_ready);
  const readyListFiltered = filteredHistory.filter(l => l.payment_ready && !bookedIds.has(l.id));
  const readyListAll = history.filter(l => l.payment_ready && !bookedIds.has(l.id));
  const fMonths = [...new Set(readyListAll.map(l => (l.closed_at || "").slice(0, 7)).filter(Boolean))].sort().reverse();

  const setReady = async (loc, ready) => {
    try {
      await api.patch(`/team-payments/ready/${loc.id}`, { ready });
      toast.success(ready ? "Proyek dipindah ke Siap Dibayar" : "Proyek dikembalikan ke Menunggu Pembayaran");
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Gagal mengubah status");
    }
  };

  const openAction = (loc) => {
    const existing = payments.filter(p => p.location_id === loc.id);
    setRows((loc.team || []).map(m => {
      const prev = existing.find(p => p.user_id === m.user_id);
      return {
        user_id: m.user_id,
        name: m.name,
        role_type: m.role_type,
        kasbon_total: Number(m.kasbon_total || 0),
        date: prev?.date || todayStr(),
        amount: prev ? String(prev.amount) : "",
        already_paid: !!prev,
      };
    }));
    setActionLoc(loc);
  };

  const setRow = (i, key, val) => {
    const arr = [...rows];
    arr[i] = { ...arr[i], [key]: val };
    setRows(arr);
  };

  const submitPayments = async () => {
    const lines = rows.filter(r => Number(r.amount) > 0);
    if (lines.length === 0) { toast.error("Isi jumlah pembayaran minimal satu anggota"); return; }
    setSavingPay(true);
    try {
      await api.post("/team-payments/batch", {
        location_id: actionLoc.id,
        payments: lines.map(r => ({
          user_id: r.user_id,
          user_name: r.name,
          kasbon_total: r.kasbon_total,
          amount: Number(r.amount),
          date: r.date,
        })),
      });
      toast.success("Pembayaran tim disimpan");
      setActionLoc(null);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Gagal menyimpan");
    } finally { setSavingPay(false); }
  };

  // ===== Riwayat Entri Pembayaran =====
  const inRange = (loc) => {
    const ca = loc.closed_at || "";
    if (!fMonth || !period || ca.slice(0, 7) !== fMonth) return false;
    const day = parseInt(ca.slice(8, 10), 10);
    return period === "1-15" ? day <= 15 : day >= 16;
  };
  const matched = readyListAll.filter(inRange);
  const isDuplicate = !!(fMonth && period && entries.some(en => en.month === fMonth && en.period === period));

  const openForm = () => { setFMonth(""); setPeriod(""); setOpen(true); };

  const submitEntry = async () => {
    if (!fMonth) { toast.error("Pilih bulan terlebih dahulu"); return; }
    if (!period) { toast.error("Pilih periode terlebih dahulu"); return; }
    if (isDuplicate) { toast.error("Pembayaran untuk periode ini sudah pernah dibuat"); return; }
    if (matched.length === 0) { toast.error("Tidak ada proyek Siap Dibayar pada periode ini"); return; }
    setSavingEntry(true);
    try {
      await api.post("/payment-entries", { month: fMonth, period });
      toast.success("Pembayaran periode ini berhasil dibukukan");
      setOpen(false);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Gagal menyimpan");
    } finally { setSavingEntry(false); }
  };

  const downloadPdf = async (entry, member) => {
    try {
      const r = await api.get(`/payment-entries/${entry.id}/pdf/${member.user_id}`, { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([r.data], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `pembayaran-${member.name}-${entry.month || ""}-${entry.period || ""}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`PDF pembayaran ${member.name} berhasil diunduh`);
    } catch {
      toast.error("Gagal mengunduh PDF");
    }
  };

  const confirmReceived = async (entry, member) => {
    try {
      const r = await api.patch(`/payment-entries/${entry.id}/confirm`, { user_id: member.user_id, received: true });
      setEntries(entries.map(en => (en.id === r.data.id ? r.data : en)));
      toast.success(`Pembayaran ${member.name} dikonfirmasi diterima`);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Gagal konfirmasi");
    }
  };

  const removeEntry = async (entry) => {
    try {
      await api.delete(`/payment-entries/${entry.id}`);
      toast.success("Entri pembayaran dihapus");
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Gagal menghapus");
    }
  };

  const memberLocations = (entry, member) =>
    (entry.details || []).filter(d => d.user_name === member.name);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs tracking-widest text-slate-500 mb-2">KELOLA SELURUH ALUR PEMBAYARAN TIM</div>
          <h1 className="font-display font-extrabold text-3xl text-slate-900">Pembayaran Tim</h1>
        </div>
        {activeTab === "entries" ? (
          <Button onClick={openForm} className="rounded-full bg-blue-700 hover:bg-blue-800" data-testid="pe-create-btn">
            <Plus className="h-4 w-4 mr-1.5" /> Buat Pembayaran
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-slate-500" />
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="w-48 bg-white" data-testid="tp-month-filter"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="all">Semua Bulan</SelectItem>
                {months.map(m => <SelectItem key={m} value={m} data-testid={`tp-month-opt-${m}`}>{monthLabel(m)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-100">
          <TabsTrigger value="waiting" data-testid="tp-tab-waiting" className="gap-1.5">
            <Hourglass className="h-3.5 w-3.5" /> Menunggu Pembayaran
            <span className="ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700">{waitingList.length}</span>
          </TabsTrigger>
          <TabsTrigger value="ready" data-testid="tp-tab-ready" className="gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" /> Siap Dibayar
            <span className="ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">{readyListFiltered.length}</span>
          </TabsTrigger>
          <TabsTrigger value="entries" data-testid="tp-tab-entries" className="gap-1.5">
            <Receipt className="h-3.5 w-3.5" /> Entry Pembayaran
            <span className="ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">{entries.length}</span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="waiting" data-testid="tp-panel-waiting">
          {renderLocTable(waitingList, "waiting", "Tidak ada proyek yang menunggu pembayaran.")}
        </TabsContent>
        <TabsContent value="ready" data-testid="tp-panel-ready">
          {renderLocTable(readyListFiltered, "ready", "Belum ada proyek yang siap dibayar.")}
        </TabsContent>
        <TabsContent value="entries" data-testid="tp-panel-entries">
          <div className="space-y-5">
            {entries.map(en => (
              <Card key={en.id} className="overflow-hidden bg-white border-slate-200" data-testid={`pe-group-${en.id}`}>
                <div className="flex items-center justify-between flex-wrap gap-2 px-4 py-3 bg-blue-50 border-b border-blue-100">
                  <div>
                    <div className="font-bold text-slate-900" data-testid={`pe-group-title-${en.id}`}>
                      Pembayaran ({en.month ? `${monthLabel(en.month)} · ${periodLabel(en.period)}` : periodLabel(en.period)})
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">Dibuat {formatDateTime(en.created_at)}</div>
                  </div>
                  {canDelete && (
                    <Button size="sm" variant="outline" className="h-8 rounded-full border-red-300 text-red-600 hover:bg-red-50 bg-white" onClick={() => removeEntry(en)} data-testid={`pe-delete-btn-${en.id}`}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>Nama</TableHead>
                      <TableHead className="text-right">Hasil</TableHead>
                      <TableHead className="text-right">Kasbon</TableHead>
                      <TableHead className="text-right">Diterima</TableHead>
                      <TableHead className="text-center">Detail</TableHead>
                      <TableHead className="text-center">Konfirmasi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(en.members || []).map(m => (
                      <TableRow key={m.user_id} data-testid={`pe-member-row-${en.id}-${m.user_id}`}>
                        <TableCell className="font-semibold text-slate-900">{m.name}</TableCell>
                        <TableCell className="text-right font-mono tabular">{formatIDR(m.amount)}</TableCell>
                        <TableCell className="text-right font-mono tabular text-orange-700">{m.kasbon > 0 ? `- ${formatIDR(m.kasbon)}` : "-"}</TableCell>
                        <TableCell className="text-right font-mono tabular font-semibold text-green-700">{formatIDR(m.net)}</TableCell>
                        <TableCell className="text-center">
                          <div className="inline-flex items-center gap-1.5">
                            <Button size="sm" variant="outline" className="h-7 rounded-full text-xs" onClick={() => setMemberDetail({ entry: en, member: m })} data-testid={`pe-member-detail-btn-${en.id}-${m.user_id}`}>
                              <Eye className="h-3 w-3 mr-1" /> Detail
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 rounded-full text-xs border-blue-300 text-blue-700 hover:bg-blue-50" onClick={() => downloadPdf(en, m)} data-testid={`pe-member-pdf-btn-${en.id}-${m.user_id}`}>
                              <Download className="h-3 w-3 mr-1" /> PDF
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {m.received ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700" data-testid={`pe-received-badge-${en.id}-${m.user_id}`}>
                              <CheckCircle2 className="h-3 w-3" /> DITERIMA
                            </span>
                          ) : (
                            <Button size="sm" variant="outline" className="h-7 rounded-full text-xs border-green-600 text-green-700 hover:bg-green-50"
                              onClick={() => confirmReceived(en, m)} data-testid={`pe-confirm-btn-${en.id}-${m.user_id}`}>
                              <CheckCircle2 className="h-3 w-3 mr-1" /> Konfirmasi Diterima
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-blue-50/60 border-t-2 border-blue-100">
                      <TableCell className="font-bold text-slate-900">TOTAL</TableCell>
                      <TableCell className="text-right font-mono tabular font-bold">{formatIDR(en.total_amount)}</TableCell>
                      <TableCell className="text-right font-mono tabular font-bold text-orange-700">{en.total_kasbon > 0 ? `- ${formatIDR(en.total_kasbon)}` : "-"}</TableCell>
                      <TableCell className="text-right font-mono tabular font-bold text-green-700">{formatIDR(en.total_net)}</TableCell>
                      <TableCell colSpan={2}></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </Card>
            ))}
            {entries.length === 0 && (
              <Card className="bg-white border-slate-200 py-12 text-center text-slate-500">
                <Wallet className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                Belum ada entri pembayaran.
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialog Aksi: isi pembayaran per anggota */}
      <Dialog open={!!actionLoc} onOpenChange={(v) => !v && setActionLoc(null)}>
        <DialogContent className="bg-white max-w-3xl">
          <DialogHeader>
            <DialogTitle>Pembayaran Tim — <span className="text-blue-700">{(() => {
              const proj = projects.find(p => p.id === actionLoc?.project_id);
              if (!proj) return actionLoc?.name;
              return `${proj.name} - ${proj.work_type}${proj.maintenance_notes ? ` - ${proj.maintenance_notes}` : ""}`;
            })()}</span></DialogTitle>
          </DialogHeader>
          {actionLoc?.payment_ready && (
            <div className="flex items-center gap-2 text-sm text-orange-700 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2" data-testid="tp-locked-note">
              <Lock className="h-4 w-4 shrink-0" />
              Data terkunci — Siap Dibayar.
            </div>
          )}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Nama Anggota</TableHead>
                  <TableHead className="w-44">Hasil</TableHead>
                  <TableHead className="text-right">Kasbon</TableHead>
                  <TableHead className="text-right">Diterima</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={r.user_id} data-testid={`tp-member-row-${r.user_id}`}>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 font-medium text-slate-900">
                        {r.role_type === "pic" && <Crown className="h-3.5 w-3.5 text-orange-500" />}
                        {r.name}
                        {r.already_paid && <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Input type="number" placeholder="0" value={r.amount} disabled={!!actionLoc?.payment_ready} onChange={e => setRow(i, "amount", e.target.value)} className="h-9 font-mono tabular" data-testid={`tp-amount-${r.user_id}`} />
                    </TableCell>
                    <TableCell className="text-right font-mono tabular text-orange-700" data-testid={`tp-kasbon-${r.user_id}`}>
                      {formatIDR(r.kasbon_total)}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular font-bold text-green-700" data-testid={`tp-net-${r.user_id}`}>
                      {formatIDR(Number(r.amount || 0) - r.kasbon_total)}
                    </TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-slate-500 py-6">Tidak ada anggota tim di buku kas ini.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionLoc(null)}>{actionLoc?.payment_ready ? "Tutup" : "Batal"}</Button>
            {!actionLoc?.payment_ready && (
              <Button onClick={submitPayments} disabled={savingPay} className="bg-blue-700 hover:bg-blue-800" data-testid="tp-save-btn">{savingPay ? "Menyimpan…" : "Simpan Pembayaran"}</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Form Buat Pembayaran per periode */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-white max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Buat Pembayaran</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>Pilih Bulan</Label>
                <Select value={fMonth} onValueChange={setFMonth}>
                  <SelectTrigger className="mt-1" data-testid="pe-month-select"><SelectValue placeholder="Pilih bulan" /></SelectTrigger>
                  <SelectContent className="bg-white">
                    {fMonths.map(m => <SelectItem key={m} value={m} data-testid={`pe-month-opt-${m}`}>{monthLabel(m)}</SelectItem>)}
                    {fMonths.length === 0 && <div className="px-3 py-2 text-sm text-slate-500">Belum ada proyek Siap Dibayar.</div>}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Pilih Periode</Label>
                <Select value={period} onValueChange={setPeriod}>
                  <SelectTrigger className="mt-1" data-testid="pe-period-select"><SelectValue placeholder="Pilih periode" /></SelectTrigger>
                  <SelectContent className="bg-white">
                    {PERIODS.map(p => <SelectItem key={p.value} value={p.value} data-testid={`pe-period-opt-${p.value}`}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {fMonth && period && isDuplicate && (
              <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2" data-testid="pe-duplicate-warning">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Pembayaran untuk {monthLabel(fMonth)} · {periodLabel(period)} sudah pernah dibuat. Hapus entri lama di riwayat jika ingin membuat ulang.
              </div>
            )}

            {fMonth && period && (
              <div>
                <div className="text-xs font-semibold tracking-widest text-slate-500 mb-2">PROYEK DITEMUKAN · {matched.length}</div>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead>Proyek</TableHead>
                        <TableHead>Tanggal Selesai</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {matched.map(loc => {
                        const proj = projects.find(p => p.id === loc.project_id);
                        const ket = proj?.maintenance_notes || proj?.keterangan || "";
                        return (
                          <TableRow key={loc.id} data-testid={`pe-proj-row-${loc.id}`}>
                            <TableCell>
                              <div className="font-semibold text-slate-900">{proj?.name || loc.name}</div>
                              <div className="text-sm text-slate-600 mt-0.5">{proj?.work_type || "-"}</div>
                              {ket && <div className="text-xs text-slate-500 mt-0.5">{ket}</div>}
                            </TableCell>
                            <TableCell className="text-sm">{formatDate(loc.closed_at)}</TableCell>
                          </TableRow>
                        );
                      })}
                      {matched.length === 0 && (
                        <TableRow><TableCell colSpan={2} className="text-center text-slate-500 py-6"><FolderSearch className="h-6 w-6 mx-auto mb-1 text-slate-300" />Tidak ada proyek Siap Dibayar pada periode ini.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={submitEntry} disabled={savingEntry || matched.length === 0 || isDuplicate} className="bg-blue-700 hover:bg-blue-800" data-testid="pe-save-btn">{savingEntry ? "Menyimpan…" : "Simpan"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail lokasi per anggota */}
      <Dialog open={!!memberDetail} onOpenChange={(v) => !v && setMemberDetail(null)}>
        <DialogContent className="bg-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-orange-500" />
              Lokasi Pekerjaan — {memberDetail?.member?.name}
            </DialogTitle>
          </DialogHeader>
          {memberDetail && (
            <div className="space-y-3" data-testid="pe-member-loc-detail">
              <div className="text-sm text-slate-600">
                Periode: <span className="font-medium text-slate-900">
                  {memberDetail.entry.month ? `${monthLabel(memberDetail.entry.month)} · ${periodLabel(memberDetail.entry.period)}` : periodLabel(memberDetail.entry.period)}
                </span>
              </div>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>Proyek</TableHead>
                      <TableHead className="text-right">Hasil</TableHead>
                      <TableHead className="text-right">Kasbon</TableHead>
                      <TableHead className="text-right">Diterima</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {memberLocations(memberDetail.entry, memberDetail.member).map((r, i) => (
                      <TableRow key={i} data-testid={`pe-member-loc-row-${i}`}>
                        <TableCell>
                          <div className="font-medium text-slate-900">{r.location_name}</div>
                          {r.work_type && <div className="text-xs text-slate-600 mt-0.5">{r.work_type}</div>}
                          {r.keterangan && <div className="text-[11px] text-slate-500 mt-0.5">{r.keterangan}</div>}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular">{formatIDR(r.amount)}</TableCell>
                        <TableCell className="text-right font-mono tabular text-orange-700">{r.kasbon > 0 ? `- ${formatIDR(r.kasbon)}` : "-"}</TableCell>
                        <TableCell className="text-right font-mono tabular font-semibold text-green-700">{formatIDR(r.net)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-blue-50 border-t-2 border-blue-200">
                      <TableCell className="font-bold">TOTAL</TableCell>
                      <TableCell className="text-right font-mono tabular font-bold">{formatIDR(memberDetail.member.amount)}</TableCell>
                      <TableCell className="text-right font-mono tabular font-bold text-orange-700">{memberDetail.member.kasbon > 0 ? `- ${formatIDR(memberDetail.member.kasbon)}` : "-"}</TableCell>
                      <TableCell className="text-right font-mono tabular font-bold text-green-700">{formatIDR(memberDetail.member.net)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );

  function renderLocTable(list, tab, emptyText) {
    return (
      <Card className="overflow-hidden bg-white border-slate-200">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead>Proyek</TableHead>
              <TableHead>Anggota Tim</TableHead>
              <TableHead>Pekerjaan Selesai</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map(loc => {
              const paid = paidCount(loc.id);
              const total = (loc.team || []).length;
              const proj = projects.find(p => p.id === loc.project_id);
              const ket = proj?.maintenance_notes || proj?.keterangan || "";
              return (
                <TableRow key={loc.id} data-testid={`tp-loc-row-${loc.id}`}>
                  <TableCell>
                    <div className="font-semibold text-slate-900 inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-orange-500" /> {proj?.name || loc.name}</div>
                    <div className="text-sm text-slate-600 mt-0.5">{proj?.work_type || "-"}</div>
                    {ket && <div className="text-xs text-slate-500 mt-0.5">{ket}</div>}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-start gap-1.5 text-sm text-slate-700">
                      <Users className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <span>{(loc.team || []).map(m => m.name).join(", ") || "-"}</span>
                    </div>
                  </TableCell>
                  <TableCell>{formatDate(loc.closed_at)}</TableCell>
                  <TableCell className="text-center">
                    {tab === "ready" ? (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">SIAP DIBAYAR</span>
                    ) : paid > 0 ? (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">TERISI {paid}/{total}</span>
                    ) : (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">MENUNGGU</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex items-center gap-2">
                      <Button size="sm" className="h-8 rounded-full bg-blue-700 hover:bg-blue-800" onClick={() => openAction(loc)} data-testid={`tp-action-btn-${loc.id}`}>
                        <ListChecks className="h-3.5 w-3.5 mr-1.5" /> Aksi
                      </Button>
                      {tab === "waiting" ? (
                        <Button size="sm" variant="outline" disabled={total === 0 || paid < total}
                          className="h-8 rounded-full border-green-600 text-green-700 hover:bg-green-50 disabled:border-slate-200 disabled:text-slate-400"
                          onClick={() => setReady(loc, true)} data-testid={`tp-ready-btn-${loc.id}`}>
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Siap Dibayar
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline"
                          className="h-8 rounded-full border-orange-500 text-orange-600 hover:bg-orange-50"
                          onClick={() => setReady(loc, false)} data-testid={`tp-back-btn-${loc.id}`}>
                          <Undo2 className="h-3.5 w-3.5 mr-1.5" /> Kembali
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {list.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-slate-500 py-8"><Wallet className="h-8 w-8 mx-auto mb-2 text-slate-300" />{month === "all" ? emptyText : "Tidak ada data pada bulan ini."}</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    );
  }
}
