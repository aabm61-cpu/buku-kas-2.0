import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Wallet, MapPin, Users, ListChecks, Crown, CheckCircle2 } from "lucide-react";
import { formatIDR, formatDate } from "@/lib/format";

const todayStr = () => new Date().toISOString().slice(0, 10);

export default function TeamPayments() {
  const [history, setHistory] = useState([]);
  const [projects, setProjects] = useState([]);
  const [payments, setPayments] = useState([]);
  const [actionLoc, setActionLoc] = useState(null);
  const [rows, setRows] = useState([]);
  const [saving, setSaving] = useState(false);

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

  const projName = (id) => projects.find(p => p.id === id)?.name || "-";
  const paidCount = (locId) => payments.filter(p => p.location_id === locId && p.paid).length;

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
      <div>
        <div className="text-xs tracking-widest text-slate-500 mb-2">PENGHITUNGAN BAYARAN TIM</div>
        <h1 className="font-display font-extrabold text-3xl text-slate-900">Pembayaran Tim</h1>
        <p className="text-slate-500 mt-1">Proyek dengan buku kas selesai. Klik Aksi untuk mengisi pembayaran setiap anggota tim — kasbon terhitung otomatis dari buku kas.</p>
      </div>

      <Card className="overflow-hidden bg-white border-slate-200">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead>Lokasi</TableHead>
              <TableHead>Proyek</TableHead>
              <TableHead>Pekerjaan Selesai</TableHead>
              <TableHead className="text-center">Anggota Tim</TableHead>
              <TableHead className="text-center">Status Pembayaran</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {history.map(loc => {
              const paid = paidCount(loc.id);
              const total = (loc.team || []).length;
              return (
                <TableRow key={loc.id} data-testid={`tp-loc-row-${loc.id}`}>
                  <TableCell className="font-semibold text-slate-900">
                    <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-orange-500" /> {loc.name}</span>
                  </TableCell>
                  <TableCell className="text-slate-600">{projName(loc.project_id)}</TableCell>
                  <TableCell>{formatDate(loc.closed_at)}</TableCell>
                  <TableCell className="text-center">
                    <span className="inline-flex items-center gap-1 text-sm text-slate-700"><Users className="h-3.5 w-3.5" /> {total}</span>
                  </TableCell>
                  <TableCell className="text-center">
                    {paid > 0 ? (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">{paid}/{total} DIBAYAR</span>
                    ) : (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">BELUM</span>
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
            {history.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-slate-500 py-8"><Wallet className="h-8 w-8 mx-auto mb-2 text-slate-300" />Belum ada buku kas yang diselesaikan.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

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
}
