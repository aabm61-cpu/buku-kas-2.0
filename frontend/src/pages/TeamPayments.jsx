import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Receipt, Eye, Trash2, Wallet, FolderSearch } from "lucide-react";
import { formatIDR, formatDate, formatDateTime, monthLabel } from "@/lib/format";

const PERIODS = [
  { value: "1-15", label: "Tanggal 1 s/d 15" },
  { value: "16-end", label: "Tanggal 16 s/d Akhir Bulan" },
];
const periodLabel = (v) => PERIODS.find(p => p.value === v)?.label || v;

export default function TeamPayments() {
  const [history, setHistory] = useState([]);
  const [projects, setProjects] = useState([]);
  const [payments, setPayments] = useState([]);
  const [entries, setEntries] = useState([]);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState("");
  const [period, setPeriod] = useState("");
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState(null);

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

  const readyList = history.filter(l => l.payment_ready);
  const months = [...new Set(readyList.map(l => (l.closed_at || "").slice(0, 7)).filter(Boolean))].sort().reverse();

  // Filter otomatis: proyek Siap Dibayar dengan tanggal selesai dalam rentang periode
  const inRange = (loc) => {
    const ca = loc.closed_at || "";
    if (!month || !period || ca.slice(0, 7) !== month) return false;
    const day = parseInt(ca.slice(8, 10), 10);
    return period === "1-15" ? day <= 15 : day >= 16;
  };
  const matched = readyList.filter(inRange);
  const matchedIds = matched.map(l => l.id);

  // Rekapitulasi per anggota: Total Nilai Proyek - Total Kasbon = Net
  const memberMap = {};
  let totalAmount = 0, totalKasbon = 0;
  payments.filter(p => matchedIds.includes(p.location_id) && p.paid).forEach(p => {
    const m = memberMap[p.user_id] || { user_id: p.user_id, name: p.user_name, amount: 0, kasbon: 0, net: 0 };
    m.amount += p.amount || 0;
    m.kasbon += p.kasbon_total || 0;
    m.net += p.net || 0;
    memberMap[p.user_id] = m;
    totalAmount += p.amount || 0;
    totalKasbon += p.kasbon_total || 0;
  });
  const members = Object.values(memberMap);

  const openForm = () => { setMonth(""); setPeriod(""); setOpen(true); };

  const submit = async () => {
    if (!month) { toast.error("Pilih bulan terlebih dahulu"); return; }
    if (!period) { toast.error("Pilih periode terlebih dahulu"); return; }
    if (matched.length === 0) { toast.error("Tidak ada proyek Siap Dibayar pada periode ini"); return; }
    setSaving(true);
    try {
      await api.post("/payment-entries", { month, period });
      toast.success("Pembayaran periode ini berhasil dibukukan");
      setOpen(false);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Gagal menyimpan");
    } finally { setSaving(false); }
  };

  const remove = async (entry) => {
    try {
      await api.delete(`/payment-entries/${entry.id}`);
      toast.success("Entri pembayaran dihapus");
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Gagal menghapus");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs tracking-widest text-slate-500 mb-2">ENTRI PEMBAYARAN TIM PER PERIODE</div>
          <h1 className="font-display font-extrabold text-3xl text-slate-900">Pembayaran Tim</h1>
          <p className="text-slate-500 mt-1">Bukukan pembayaran tim per periode. Sistem otomatis mengambil proyek Siap Dibayar sesuai rentang tanggal selesai.</p>
        </div>
        <Button onClick={openForm} className="rounded-full bg-blue-700 hover:bg-blue-800" data-testid="pe-create-btn">
          <Plus className="h-4 w-4 mr-1.5" /> Buat Pembayaran
        </Button>
      </div>

      <Card className="overflow-hidden bg-white border-slate-200">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead>Tanggal Dibuat</TableHead>
              <TableHead>Periode</TableHead>
              <TableHead>Proyek</TableHead>
              <TableHead className="text-right">Hasil</TableHead>
              <TableHead className="text-right">Kasbon</TableHead>
              <TableHead className="text-right">Diterima</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map(en => (
              <TableRow key={en.id} data-testid={`pe-row-${en.id}`}>
                <TableCell className="text-sm text-slate-600">{formatDateTime(en.created_at)}</TableCell>
                <TableCell>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                    {en.month ? `${monthLabel(en.month)} · ${periodLabel(en.period)}` : periodLabel(en.period)}
                  </span>
                </TableCell>
                <TableCell className="text-sm font-medium text-slate-900 max-w-[220px]">{(en.project_names || []).join(", ")}</TableCell>
                <TableCell className="text-right font-mono tabular">{formatIDR(en.total_amount)}</TableCell>
                <TableCell className="text-right font-mono tabular text-orange-700">{en.total_kasbon > 0 ? `- ${formatIDR(en.total_kasbon)}` : "-"}</TableCell>
                <TableCell className="text-right font-mono tabular font-semibold text-green-700">{formatIDR(en.total_net)}</TableCell>
                <TableCell className="text-right">
                  <div className="inline-flex items-center gap-2">
                    <Button size="sm" variant="outline" className="h-8 rounded-full" onClick={() => setDetail(en)} data-testid={`pe-detail-btn-${en.id}`}>
                      <Eye className="h-3.5 w-3.5 mr-1.5" /> Detail
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 rounded-full border-red-300 text-red-600 hover:bg-red-50" onClick={() => remove(en)} data-testid={`pe-delete-btn-${en.id}`}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {entries.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-slate-500 py-10"><Wallet className="h-8 w-8 mx-auto mb-2 text-slate-300" />Belum ada entri pembayaran. Klik <b>Buat Pembayaran</b> untuk membuat.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Form Buat Pembayaran per periode */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-white max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Buat Pembayaran</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>Pilih Bulan</Label>
                <Select value={month} onValueChange={setMonth}>
                  <SelectTrigger className="mt-1" data-testid="pe-month-select"><SelectValue placeholder="Pilih bulan" /></SelectTrigger>
                  <SelectContent className="bg-white">
                    {months.map(m => <SelectItem key={m} value={m} data-testid={`pe-month-opt-${m}`}>{monthLabel(m)}</SelectItem>)}
                    {months.length === 0 && <div className="px-3 py-2 text-sm text-slate-500">Belum ada proyek Siap Dibayar.</div>}
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

            {month && period && (
              <>
                <div>
                  <div className="text-xs font-semibold tracking-widest text-slate-500 mb-2">PROYEK DITEMUKAN · {matched.length}</div>
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50">
                          <TableHead>Nama Proyek</TableHead>
                          <TableHead>Jenis Pekerjaan</TableHead>
                          <TableHead>Keterangan</TableHead>
                          <TableHead>Tanggal Selesai</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {matched.map(loc => {
                          const proj = projects.find(p => p.id === loc.project_id);
                          return (
                            <TableRow key={loc.id} data-testid={`pe-proj-row-${loc.id}`}>
                              <TableCell className="font-semibold text-slate-900">{proj?.name || loc.name}</TableCell>
                              <TableCell className="text-sm">{proj?.work_type || "-"}</TableCell>
                              <TableCell className="text-sm text-slate-600 max-w-[180px]">{proj?.maintenance_notes || proj?.keterangan || "-"}</TableCell>
                              <TableCell className="text-sm">{formatDate(loc.closed_at)}</TableCell>
                            </TableRow>
                          );
                        })}
                        {matched.length === 0 && (
                          <TableRow><TableCell colSpan={4} className="text-center text-slate-500 py-6"><FolderSearch className="h-6 w-6 mx-auto mb-1 text-slate-300" />Tidak ada proyek Siap Dibayar pada periode ini.</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {matched.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold tracking-widest text-slate-500 mb-2">REKAPITULASI PEMBAYARAN ANGGOTA</div>
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50">
                            <TableHead>Nama Anggota</TableHead>
                            <TableHead className="text-right">Total Nilai Proyek</TableHead>
                            <TableHead className="text-right">Total Kasbon</TableHead>
                            <TableHead className="text-right">Net Pembayaran</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {members.map(m => (
                            <TableRow key={m.user_id} data-testid={`pe-member-row-${m.user_id}`}>
                              <TableCell className="font-medium text-slate-900">{m.name}</TableCell>
                              <TableCell className="text-right font-mono tabular">{formatIDR(m.amount)}</TableCell>
                              <TableCell className="text-right font-mono tabular text-orange-700">{m.kasbon > 0 ? `- ${formatIDR(m.kasbon)}` : "-"}</TableCell>
                              <TableCell className="text-right font-mono tabular font-semibold text-green-700">{formatIDR(m.net)}</TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="bg-blue-50 border-t-2 border-blue-200">
                            <TableCell className="font-bold text-slate-900">TOTAL</TableCell>
                            <TableCell className="text-right font-mono tabular font-bold" data-testid="pe-total-amount">{formatIDR(totalAmount)}</TableCell>
                            <TableCell className="text-right font-mono tabular font-bold text-orange-700" data-testid="pe-total-kasbon">{totalKasbon > 0 ? `- ${formatIDR(totalKasbon)}` : "-"}</TableCell>
                            <TableCell className="text-right font-mono tabular font-bold text-green-700" data-testid="pe-total-net">{formatIDR(totalAmount - totalKasbon)}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={submit} disabled={saving || matched.length === 0} className="bg-blue-700 hover:bg-blue-800" data-testid="pe-save-btn">{saving ? "Menyimpan…" : "Simpan"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail entri */}
      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="bg-white max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-blue-700" />
              Detail Pembayaran — {detail ? (detail.month ? `${monthLabel(detail.month)} · ${periodLabel(detail.period)}` : periodLabel(detail.period)) : ""}
            </DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-3">
              <div className="text-sm text-slate-600">Proyek: <span className="font-medium text-slate-900">{(detail.project_names || []).join(", ")}</span></div>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>Nama Anggota</TableHead>
                      <TableHead className="text-right">Nilai Proyek</TableHead>
                      <TableHead className="text-right">Kasbon</TableHead>
                      <TableHead className="text-right">Net</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(detail.members || []).map(m => (
                      <TableRow key={m.user_id}>
                        <TableCell className="font-medium text-slate-900">{m.name}</TableCell>
                        <TableCell className="text-right font-mono tabular">{formatIDR(m.amount)}</TableCell>
                        <TableCell className="text-right font-mono tabular text-orange-700">{m.kasbon > 0 ? `- ${formatIDR(m.kasbon)}` : "-"}</TableCell>
                        <TableCell className="text-right font-mono tabular font-semibold text-green-700">{formatIDR(m.net)}</TableCell>
                        <TableCell className="text-center"><span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">{(m.status || "dibayar").toUpperCase()}</span></TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-blue-50 border-t-2 border-blue-200">
                      <TableCell className="font-bold">TOTAL</TableCell>
                      <TableCell className="text-right font-mono tabular font-bold">{formatIDR(detail.total_amount)}</TableCell>
                      <TableCell className="text-right font-mono tabular font-bold text-orange-700">{detail.total_kasbon > 0 ? `- ${formatIDR(detail.total_kasbon)}` : "-"}</TableCell>
                      <TableCell className="text-right font-mono tabular font-bold text-green-700">{formatIDR(detail.total_net)}</TableCell>
                      <TableCell></TableCell>
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
}
