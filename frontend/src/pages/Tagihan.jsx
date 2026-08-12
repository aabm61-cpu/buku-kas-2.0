import React, { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Plus, AlertTriangle, Percent, Link2, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { formatIDR, formatDate } from "@/lib/format";

const empty = () => ({
  invoice_number: "",
  client_name: "",
  selections: {}, // { [project_id]: { full: bool, termins: [idx], retensi: bool } }
  due_date: "",
});

const statusColor = {
  draft: "bg-slate-100 text-slate-700",
  terkirim: "bg-blue-100 text-blue-700",
  lunas: "bg-green-100 text-green-700",
  jatuh_tempo: "bg-red-100 text-red-700",
};

export default function Tagihan() {
  const { user } = useAuth();
  const canWrite = ["owner", "penagihan"].includes(user.role);
  const [items, setItems] = useState([]);
  const [projects, setProjects] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty());

  const load = async () => {
    const [t, p] = await Promise.all([api.get("/tagihan"), api.get("/projects")]);
    setItems(t.data); setProjects(p.data);
  };
  useEffect(() => { load(); }, []);

  const projName = (id) => projects.find(p => p.id === id)?.name || id;

  // Proyek selesai sebagai sumber pilihan tagihan
  const completedProjects = useMemo(() => projects.filter(p => p.is_completed), [projects]);

  const projHasTermin = (p) => p.has_termin === "ada" && Number(p.termin_count) > 0;
  const projHasRetensi = (p) => p.spk_rab_type === "SPK" && (p.has_retensi || "ada") === "ada" && Number(p.retention_percent) > 0 && !p.retention_paid;

  // Rekap item yang SUDAH pernah ditagihkan per proyek (dari seluruh tagihan)
  const billed = useMemo(() => {
    const map = {}; // pid -> { termins: [idx], retensi: bool, full: bool }
    items.forEach(t => {
      (t.items || []).forEach(it => {
        const pid = it.project_id;
        if (!pid) return;
        if (!map[pid]) map[pid] = { termins: [], retensi: false, full: false };
        if (it.is_retensi) map[pid].retensi = true;
        else if (it.termin_index !== null && it.termin_index !== undefined) map[pid].termins.push(it.termin_index);
        else map[pid].full = true;
      });
    });
    return map;
  }, [items]);

  const availableTermins = (p) => {
    const b = billed[p.id];
    return Array.from({ length: Number(p.termin_count) }, (_, i) => i).filter(i => !b?.termins.includes(i));
  };
  const retensiAvailable = (p) => projHasRetensi(p) && !billed[p.id]?.retensi;
  const fullAvailable = (p) => !projHasTermin(p) && !billed[p.id]?.full;

  // Proyek tampil hanya jika masih ada yang bisa ditagihkan
  const billableProjects = useMemo(
    () => completedProjects.filter(p => (projHasTermin(p) ? availableTermins(p).length > 0 : fullAvailable(p)) || retensiAvailable(p)),
    [completedProjects, billed]
  );

  const toggleProject = (p) => {
    const sel = { ...form.selections };
    if (sel[p.id]) {
      delete sel[p.id];
    } else {
      sel[p.id] = { full: fullAvailable(p), termins: [], retensi: false };
    }
    setForm({ ...form, selections: sel });
  };

  const toggleTermin = (pid, idx) => {
    const sel = { ...form.selections };
    const s = { ...sel[pid] };
    s.termins = s.termins.includes(idx) ? s.termins.filter(x => x !== idx) : [...s.termins, idx].sort();
    sel[pid] = s;
    setForm({ ...form, selections: sel });
  };

  const toggleRetensi = (pid) => {
    const sel = { ...form.selections };
    sel[pid] = { ...sel[pid], retensi: !sel[pid].retensi };
    setForm({ ...form, selections: sel });
  };

  // Susun item tagihan dari pilihan
  const lines = useMemo(() => {
    const out = [];
    Object.entries(form.selections).forEach(([pid, s]) => {
      const p = projects.find(x => x.id === pid);
      if (!p) return;
      const val = Number(p.project_value || 0);
      if (s.full) {
        out.push({ project_id: pid, description: `Nilai Proyek - ${p.name}`, amount: val });
      }
      (s.termins || []).forEach(i => {
        const pct = Number((p.termin_percents || [])[i]) || 0;
        out.push({ project_id: pid, description: `Termin ${i + 1} (${pct}%) - ${p.name}`, amount: val * pct / 100, termin_index: i });
      });
      if (s.retensi) {
        const rpct = Number(p.retention_percent || 0);
        out.push({ project_id: pid, description: `Retensi (${rpct}%) - ${p.name}`, amount: val * rpct / 100, is_retensi: true });
      }
    });
    return out;
  }, [form.selections, projects]);

  const total = lines.reduce((s, l) => s + l.amount, 0);

  const submit = async () => {
    if (!form.invoice_number.trim() || !form.client_name.trim() || !form.due_date) {
      toast.error("Nomor invoice, klien, dan jatuh tempo wajib diisi"); return;
    }
    if (lines.length === 0) { toast.error("Pilih minimal satu proyek, termin, atau retensi"); return; }
    try {
      await api.post("/tagihan", {
        invoice_number: form.invoice_number,
        client_name: form.client_name,
        items: lines,
        due_date: form.due_date,
      });
      toast.success("Tagihan dibuat");
      setOpen(false); setForm(empty()); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Gagal"); }
  };

  const markPaid = async (t) => {
    await api.patch(`/tagihan/${t.id}`, { paid_amount: t.total });
    toast.success("Tagihan ditandai sudah terbayar");
    load();
  };

  const today = new Date().toISOString().slice(0, 10);
  const overdueCount = items.filter(t => t.due_date < today && t.paid_amount < t.total && t.status !== "lunas").length;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs tracking-widest text-slate-500 mb-2">PENAGIHAN KLIEN</div>
          <h1 className="font-display font-extrabold text-3xl text-slate-900">Tagihan</h1>
          <p className="text-slate-500 mt-1">Satu tagihan dapat mencakup beberapa proyek, termin, dan retensi.</p>
        </div>
        <div className="flex items-center gap-2">
          {canWrite && (
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setForm(empty()); }}>
              <DialogTrigger asChild><Button data-testid="tagihan-add-btn" className="rounded-full bg-blue-700 hover:bg-blue-800"><Plus className="h-4 w-4 mr-2" /> Tagihan Baru</Button></DialogTrigger>
              <DialogContent className="bg-white max-w-3xl">
                <DialogHeader><DialogTitle>Tagihan Baru — Multi Proyek</DialogTitle></DialogHeader>
                <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Nomor Invoice</Label><Input data-testid="tagihan-number-input" value={form.invoice_number} onChange={e => setForm({ ...form, invoice_number: e.target.value })} placeholder="INV-2026-001" /></div>
                    <div><Label>Klien</Label><Input data-testid="tagihan-client-input" value={form.client_name} onChange={e => setForm({ ...form, client_name: e.target.value })} /></div>
                  </div>

                  <div>
                    <Label className="mb-2 block">Pilih Proyek Selesai (bisa lebih dari satu)</Label>
                    <div className="border border-slate-200 rounded-lg p-3 max-h-64 overflow-y-auto space-y-2 bg-slate-50">
                      {billableProjects.length === 0 && <div className="text-sm text-slate-500">Tidak ada proyek selesai yang bisa ditagihkan.</div>}
                      {billableProjects.map(p => {
                        const sel = form.selections[p.id];
                        const val = Number(p.project_value || 0);
                        const hasTermin = projHasTermin(p);
                        const availTermins = hasTermin ? availableTermins(p) : [];
                        const retAvail = retensiAvailable(p);
                        return (
                          <div key={p.id} className="rounded-lg bg-white border border-slate-200 p-2">
                            <label className="flex items-center gap-3 cursor-pointer p-1" data-testid={`tagihan-pick-project-${p.id}`}>
                              <Checkbox checked={!!sel} onCheckedChange={() => toggleProject(p)} />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-semibold text-slate-900">{p.name}</div>
                                <div className="text-xs text-slate-500">{p.work_type} · {p.spk_rab_type || "SPK"}{hasTermin ? ` · ${p.termin_count} termin` : ""}</div>
                              </div>
                              <span className="text-sm font-mono tabular font-semibold text-slate-900 whitespace-nowrap">{formatIDR(val)}</span>
                            </label>
                            {sel && hasTermin && availTermins.length > 0 && (
                              <div className="pl-9 mt-1 space-y-1 border-t border-slate-100 pt-2">
                                {availTermins.map(i => {
                                  const pct = Number((p.termin_percents || [])[i]) || 0;
                                  return (
                                    <label key={i} className="flex items-center gap-2.5 cursor-pointer text-sm" data-testid={`tagihan-termin-${p.id}-${i}`}>
                                      <Checkbox checked={sel.termins.includes(i)} onCheckedChange={() => toggleTermin(p.id, i)} />
                                      <span className="flex-1 text-slate-700">Termin {i + 1} <span className="text-slate-400">({pct}%)</span></span>
                                      <span className="font-mono tabular font-semibold">{formatIDR(val * pct / 100)}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            )}
                            {sel && retAvail && (
                              <div className={`pl-9 mt-1 pt-2 ${hasTermin ? "" : "border-t border-slate-100"}`}>
                                <label className="flex items-center gap-2.5 cursor-pointer text-sm" data-testid={`tagihan-retensi-${p.id}`}>
                                  <Checkbox checked={sel.retensi} onCheckedChange={() => toggleRetensi(p.id)} />
                                  <span className="flex-1 text-orange-700 font-medium flex items-center gap-1"><Percent className="h-3.5 w-3.5" /> Retensi <span className="text-orange-400">({p.retention_percent}%)</span></span>
                                  <span className="font-mono tabular font-semibold text-orange-700">{formatIDR(val * Number(p.retention_percent) / 100)}</span>
                                </label>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Jatuh Tempo</Label><Input data-testid="tagihan-due-input" type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} /></div>
                  </div>

                  <Card className="p-4 bg-blue-50 border-blue-200 space-y-1" data-testid="tagihan-summary">
                    {lines.length === 0 && <div className="text-sm text-slate-500">Belum ada item dipilih.</div>}
                    {lines.map((l, i) => (
                      <div key={i} className={`flex justify-between text-sm ${l.is_retensi ? "text-orange-700" : "text-slate-700"}`}>
                        <span>{l.description}</span>
                        <span className="font-mono tabular font-semibold">{formatIDR(l.amount)}</span>
                      </div>
                    ))}
                    <div className="border-t border-blue-200 pt-2 mt-2 flex justify-between font-display font-bold text-lg text-blue-900"><span>Total Tagihan</span><span className="font-mono tabular" data-testid="tagihan-total">{formatIDR(total)}</span></div>
                  </Card>
                </div>
                <DialogFooter><Button data-testid="tagihan-submit-btn" onClick={submit} className="bg-blue-700 hover:bg-blue-800">Simpan</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {overdueCount > 0 && (
        <Card className="p-4 bg-red-50 border-red-200 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
          <div className="flex-1">
            <div className="font-semibold text-red-900">{overdueCount} tagihan telah jatuh tempo</div>
            <div className="text-sm text-red-700">Kirim reminder ke klien untuk mempercepat pelunasan.</div>
          </div>
        </Card>
      )}

      {renderSection("BELUM LUNAS", items.filter(t => (t.paid_amount || 0) < (t.total || 0)), "Semua tagihan sudah lunas.", "unpaid")}
      {renderSection("SUDAH LUNAS", items.filter(t => (t.paid_amount || 0) >= (t.total || 0)), "Belum ada tagihan yang lunas.", "paid")}
    </div>
  );

  function renderSection(title, list, emptyText, key) {
    return (
      <div className="space-y-2" data-testid={`tagihan-section-${key}`}>
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${key === "unpaid" ? "bg-orange-500" : "bg-green-500"}`} />
          <span className="text-xs font-semibold tracking-widest text-slate-500">TAGIHAN {title} · {list.length}</span>
        </div>
        <Card className="overflow-hidden bg-white border-slate-200">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Invoice</TableHead>
                <TableHead>Klien</TableHead>
                <TableHead>Proyek</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Jatuh Tempo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Pembayaran</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map(t => {
                const status = t.due_date < today && t.paid_amount < t.total && t.status !== "lunas" ? "jatuh_tempo" : t.status;
                const projectIds = t.project_ids || (t.project_id ? [t.project_id] : []);
                return (
                  <TableRow key={t.id} data-testid={`tagihan-row-${t.id}`} className={t.is_retensi ? "bg-orange-50/40" : ""}>
                    <TableCell className="font-mono font-semibold">
                      <div className="flex items-center gap-2">
                        {t.invoice_number}
                        {t.is_retensi && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-orange-500 text-white"><Percent className="h-3 w-3 inline mr-0.5" />RETENSI</span>}
                        {t.parent_tagihan_id && <Link2 className="h-3 w-3 text-slate-400" />}
                      </div>
                    </TableCell>
                    <TableCell>{t.client_name}</TableCell>
                    <TableCell className="text-slate-600 text-sm">
                      {(t.items && t.items.length > 0) ? (
                        <div className="space-y-1">
                          {t.items.map((it, i) => {
                            const detail = (it.description || "").split(" - ")[0];
                            return (
                              <div key={i} className="whitespace-normal leading-snug" data-testid={`tagihan-proj-line-${t.id}-${i}`}>
                                <span className="font-semibold text-slate-900">{projName(it.project_id)}</span>
                                {detail && <span className={it.is_retensi ? "text-orange-700" : "text-slate-500"}> · {detail}</span>}
                                <span className="text-slate-400 font-mono tabular"> · {formatIDR(it.amount || 0)}</span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        projectIds.length === 0 ? "-" : projectIds.map(projName).join(", ")
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular">{formatIDR(t.total)}</TableCell>
                    <TableCell>{formatDate(t.due_date)}</TableCell>
                    <TableCell><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColor[status] || statusColor.draft}`}>{(status || "draft").replace("_", " ").toUpperCase()}</span></TableCell>
                    <TableCell className="text-right">
                      {(t.paid_amount || 0) >= (t.total || 0) ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700" data-testid={`tagihan-paid-badge-${t.id}`}>
                          <CheckCircle2 className="h-3.5 w-3.5" /> Sudah Terbayar
                        </span>
                      ) : canWrite ? (
                        <Button size="sm" className="h-8 rounded-full bg-green-600 hover:bg-green-700 text-white" onClick={() => markPaid(t)} data-testid={`tagihan-markpaid-${t.id}`}>
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Sudah Terbayar
                        </Button>
                      ) : (
                        <span className="text-xs text-slate-400">Belum Dibayar</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {list.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-slate-500 py-8">{emptyText}</TableCell></TableRow>}
            </TableBody>
          </Table>
        </Card>
      </div>
    );
  }
}
