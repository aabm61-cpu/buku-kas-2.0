import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Plus, Receipt, ChevronDown, Eye, Trash2, Wallet } from "lucide-react";
import { formatIDR, formatDateTime } from "@/lib/format";

const PERIODS = [
  { value: "5-19", label: "Tanggal 5 s/d 19" },
  { value: "20-4", label: "Tanggal 20 s/d 4" },
];
const periodLabel = (v) => PERIODS.find(p => p.value === v)?.label || v;

export default function TeamPayments() {
  const [history, setHistory] = useState([]);
  const [projects, setProjects] = useState([]);
  const [payments, setPayments] = useState([]);
  const [entries, setEntries] = useState([]);
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState({});
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
  const projName = (loc) => projects.find(p => p.id === loc.project_id)?.name || loc.name;
  const selectedLocs = readyList.filter(l => sel[l.id]);

  // Kalkulasi otomatis: agregasi per anggota dari team_payments proyek terpilih
  const selIds = selectedLocs.map(l => l.id);
  const memberMap = {};
  let totalAmount = 0, totalKasbon = 0;
  payments.filter(p => selIds.includes(p.location_id) && p.paid).forEach(p => {
    const m = memberMap[p.user_id] || { user_id: p.user_id, name: p.user_name, net: 0 };
    m.net += p.net || 0;
    memberMap[p.user_id] = m;
    totalAmount += p.amount || 0;
    totalKasbon += p.kasbon_total || 0;
  });
  const members = Object.values(memberMap);

  const openForm = () => { setSel({}); setPeriod(""); setOpen(true); };

  const submit = async () => {
    if (selIds.length === 0) { toast.error("Pilih minimal satu proyek"); return; }
    if (!period) { toast.error("Pilih kategori pembayaran"); return; }
    setSaving(true);
    try {
      await api.post("/payment-entries", { location_ids: selIds, period });
      toast.success("Entri pembayaran disimpan");
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
          <div className="text-xs tracking-widest text-slate-500 mb-2">ENTRI PEMBAYARAN TIM</div>
          <h1 className="font-display font-extrabold text-3xl text-slate-900">Pembayaran Tim</h1>
          <p className="text-slate-500 mt-1">Buat entri pembayaran gabungan dari proyek berstatus Siap Dibayar. Kalkulasi kasbon otomatis per anggota.</p>
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
              <TableHead>Kategori</TableHead>
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
                <TableCell><span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{periodLabel(en.period)}</span></TableCell>
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

      {/* Form Buat Pembayaran */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-white max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Buat Pembayaran</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>Pilih Proyek (Siap Dibayar)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-between font-normal mt-1" data-testid="pe-project-multiselect">
                      {selIds.length > 0 ? `${selIds.length} proyek dipilih` : "Pilih satu atau beberapa proyek"}
                      <ChevronDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="bg-white w-80 p-2" align="start">
                    {readyList.map(loc => (
                      <label key={loc.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-50 cursor-pointer">
                        <Checkbox checked={!!sel[loc.id]} onCheckedChange={(v) => setSel({ ...sel, [loc.id]: !!v })} data-testid={`pe-project-check-${loc.id}`} />
                        <span className="text-sm text-slate-800">{projName(loc)}</span>
                      </label>
                    ))}
                    {readyList.length === 0 && <div className="px-2 py-3 text-sm text-slate-500">Belum ada proyek Siap Dibayar. Kelola di menu Rekap Pembayaran.</div>}
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label>Kategori Pembayaran</Label>
                <Select value={period} onValueChange={setPeriod}>
                  <SelectTrigger className="mt-1" data-testid="pe-period-select"><SelectValue placeholder="Pilih periode" /></SelectTrigger>
                  <SelectContent className="bg-white">
                    {PERIODS.map(p => <SelectItem key={p.value} value={p.value} data-testid={`pe-period-opt-${p.value}`}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {selIds.length > 0 && (
              <>
                <div className="grid grid-cols-3 gap-3" data-testid="pe-auto-calc">
                  <Card className="p-3 bg-slate-50 border-slate-200">
                    <div className="text-[10px] tracking-widest text-slate-500">TOTAL NILAI PROYEK</div>
                    <div className="font-mono tabular font-bold text-slate-900 mt-1" data-testid="pe-total-amount">{formatIDR(totalAmount)}</div>
                  </Card>
                  <Card className="p-3 bg-orange-50 border-orange-200">
                    <div className="text-[10px] tracking-widest text-slate-500">TOTAL POTONGAN KASBON</div>
                    <div className="font-mono tabular font-bold text-orange-700 mt-1" data-testid="pe-total-kasbon">{totalKasbon > 0 ? `- ${formatIDR(totalKasbon)}` : "Rp 0"}</div>
                  </Card>
                  <Card className="p-3 bg-green-50 border-green-200">
                    <div className="text-[10px] tracking-widest text-slate-500">TOTAL DITERIMA</div>
                    <div className="font-mono tabular font-bold text-green-700 mt-1" data-testid="pe-total-net">{formatIDR(totalAmount - totalKasbon)}</div>
                  </Card>
                </div>

                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead>Nama Anggota</TableHead>
                        <TableHead className="text-right">Diterima (setelah kasbon)</TableHead>
                        <TableHead className="text-center">Status Pembayaran</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {members.map(m => (
                        <TableRow key={m.user_id} data-testid={`pe-member-row-${m.user_id}`}>
                          <TableCell className="font-medium text-slate-900">{m.name}</TableCell>
                          <TableCell className="text-right font-mono tabular font-semibold text-green-700">{formatIDR(m.net)}</TableCell>
                          <TableCell className="text-center"><span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">DIBAYAR</span></TableCell>
                        </TableRow>
                      ))}
                      {members.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-slate-500 py-6">Belum ada data pembayaran anggota untuk proyek terpilih.</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={submit} disabled={saving} className="bg-blue-700 hover:bg-blue-800" data-testid="pe-save-btn">{saving ? "Menyimpan…" : "Simpan Pembayaran"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail entri */}
      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="bg-white max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Receipt className="h-4 w-4 text-blue-700" /> Detail Pembayaran — {detail ? periodLabel(detail.period) : ""}</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-3">
              <div className="text-sm text-slate-600">Proyek: <span className="font-medium text-slate-900">{(detail.project_names || []).join(", ")}</span></div>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>Nama Anggota</TableHead>
                      <TableHead className="text-right">Diterima</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(detail.members || []).map(m => (
                      <TableRow key={m.user_id}>
                        <TableCell className="font-medium text-slate-900">{m.name}</TableCell>
                        <TableCell className="text-right font-mono tabular font-semibold text-green-700">{formatIDR(m.net)}</TableCell>
                        <TableCell className="text-center"><span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">{(m.status || "dibayar").toUpperCase()}</span></TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-blue-50 border-t-2 border-blue-200">
                      <TableCell className="font-bold">TOTAL</TableCell>
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
