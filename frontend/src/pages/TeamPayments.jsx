import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Wallet, MapPin, Users, ListChecks, Crown, CheckCircle2, CalendarDays, Hourglass } from "lucide-react";
import { formatIDR, formatDate, monthLabel } from "@/lib/format";

const todayStr = () => new Date().toISOString().slice(0, 10);

export default function TeamPayments() {
  const [history, setHistory] = useState([]);
  const [projects, setProjects] = useState([]);
  const [payments, setPayments] = useState([]);
  const [actionLoc, setActionLoc] = useState(null);
  const [rows, setRows] = useState([]);
  const [saving, setSaving] = useState(false);
  const [month, setMonth] = useState("all");

  const load = async () => {
    const [h, p, tp] = await Promise.all([
      api.get("/bukukas/history"),
      api.get("/projects"),
      api.get("/team-payments"),
    ]);
    setHistory(h.data);
    setProjects(p.data);
    setPayments(tp.data);
  };
  useEffect(() => { load(); }, []);

  const paidCount = (locId) => payments.filter(p => p.location_id === locId && p.paid).length;

  const months = [...new Set(history.map(l => (l.closed_at || "").slice(0, 7)).filter(Boolean))].sort().reverse();
  const filteredHistory = month === "all" ? history : history.filter(l => (l.closed_at || "").slice(0, 7) === month);
  const waitingList = filteredHistory.filter(l => paidCount(l.id) === 0);
  const readyList = filteredHistory.filter(l => paidCount(l.id) > 0);

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

  const submit = async () => {
    const lines = rows.filter(r => Number(r.amount) > 0);
    if (lines.length === 0) { toast.error("Isi jumlah pembayaran minimal satu anggota"); return; }
    setSaving(true);
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
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs tracking-widest text-slate-500 mb-2">PENGHITUNGAN BAYARAN TIM</div>
          <h1 className="font-display font-extrabold text-3xl text-slate-900">Pembayaran Tim</h1>
          <p className="text-slate-500 mt-1">Proyek dengan buku kas selesai. Klik Aksi untuk mengisi pembayaran setiap anggota tim — kasbon terhitung otomatis dari buku kas.</p>
        </div>
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
      </div>

      <Tabs defaultValue="waiting">
        <TabsList className="bg-slate-100">
          <TabsTrigger value="waiting" data-testid="tp-tab-waiting" className="gap-1.5">
            <Hourglass className="h-3.5 w-3.5" /> Menunggu Pembayaran
            <span className="ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700">{waitingList.length}</span>
          </TabsTrigger>
          <TabsTrigger value="ready" data-testid="tp-tab-ready" className="gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" /> Siap Dibayar
            <span className="ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">{readyList.length}</span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="waiting" data-testid="tp-panel-waiting">
          {renderTable(waitingList, "Tidak ada proyek yang menunggu pembayaran.")}
        </TabsContent>
        <TabsContent value="ready" data-testid="tp-panel-ready">
          {renderTable(readyList, "Belum ada proyek yang siap dibayar.")}
        </TabsContent>
      </Tabs>

      <Dialog open={!!actionLoc} onOpenChange={(v) => !v && setActionLoc(null)}>
        <DialogContent className="bg-white max-w-3xl">
          <DialogHeader>
            <DialogTitle>Pembayaran Tim — <span className="text-blue-700">{(() => {
              const proj = projects.find(p => p.id === actionLoc?.project_id);
              if (!proj) return actionLoc?.name;
              return `${proj.name} - ${proj.work_type}${proj.maintenance_notes ? ` - ${proj.maintenance_notes}` : ""}`;
            })()}</span></DialogTitle>
          </DialogHeader>
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
                        {r.already_paid && <CheckCircle2 className="h-3.5 w-3.5 text-green-600" title="Sudah pernah disimpan" />}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Input type="number" placeholder="0" value={r.amount} onChange={e => setRow(i, "amount", e.target.value)} className="h-9 font-mono tabular" data-testid={`tp-amount-${r.user_id}`} />
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
            <Button variant="outline" onClick={() => setActionLoc(null)}>Batal</Button>
            <Button onClick={submit} disabled={saving} className="bg-blue-700 hover:bg-blue-800" data-testid="tp-save-btn">{saving ? "Menyimpan…" : "Simpan Pembayaran"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  function renderTable(list, emptyText) {
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
                    <div className="text-xs text-slate-500 mt-0.5">{proj?.work_type || "-"}{ket ? ` — ${ket}` : ""}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-start gap-1.5 text-sm text-slate-700">
                      <Users className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <span>{(loc.team || []).map(m => m.name).join(", ") || "-"}</span>
                    </div>
                  </TableCell>
                  <TableCell>{formatDate(loc.closed_at)}</TableCell>
                  <TableCell className="text-center">
                    {paid > 0 ? (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">SIAP DIBAYAR · {paid}/{total}</span>
                    ) : (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">MENUNGGU</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" className="h-8 rounded-full bg-blue-700 hover:bg-blue-800" onClick={() => openAction(loc)} data-testid={`tp-action-btn-${loc.id}`}>
                      <ListChecks className="h-3.5 w-3.5 mr-1.5" /> Aksi
                    </Button>
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
