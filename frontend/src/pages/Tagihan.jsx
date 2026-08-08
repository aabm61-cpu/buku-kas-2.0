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
import { Plus, Trash2, Download, Send, AlertTriangle, Wallet, Percent, Link2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { formatIDR, formatDate } from "@/lib/format";

const emptyItem = (project_id = "") => ({ project_id, description: "", amount: 0 });
const empty = () => ({
  invoice_number: "",
  client_name: "",
  selected_projects: [],
  items: [emptyItem()],
  due_date: "",
  notes: "",
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
  const [payDialog, setPayDialog] = useState(null);
  const [payAmount, setPayAmount] = useState(0);

  const load = async () => {
    const [t, p] = await Promise.all([api.get("/tagihan"), api.get("/projects")]);
    setItems(t.data); setProjects(p.data);
  };
  useEffect(() => { load(); }, []);

  const projName = (id) => projects.find(p => p.id === id)?.name || id;

  // Retensi preview — persentase diambil dari data proyek masing-masing (khusus SPK)
  const retensiPreview = useMemo(() => {
    const byProject = {};
    form.items.forEach(it => {
      if (!it.project_id) return;
      byProject[it.project_id] = (byProject[it.project_id] || 0) + Number(it.amount || 0);
    });
    const lines = [];
    let total = 0;
    Object.entries(byProject).forEach(([pid, subtotal]) => {
      const p = projects.find(x => x.id === pid);
      if (p?.spk_rab_type === "SPK" && !p?.retention_paid && (p?.has_retensi || "ada") !== "tidak_ada") {
        const pct = Number(p.retention_percent || 0);
        const amt = subtotal * (pct / 100);
        if (amt > 0) {
          lines.push({ projectName: p.name, subtotal, amount: amt, pct });
          total += amt;
        }
      }
    });
    return { lines, total };
  }, [form.items, projects]);

  const subtotal = form.items.reduce((s, i) => s + Number(i.amount || 0), 0);
  const mainTotal = subtotal - retensiPreview.total;

  const toggleProject = (pid) => {
    const on = form.selected_projects.includes(pid);
    let sp = on ? form.selected_projects.filter(x => x !== pid) : [...form.selected_projects, pid];
    // remove items belonging to unselected project
    let newItems = on ? form.items.filter(i => i.project_id !== pid) : form.items;
    if (!on && newItems.length === 1 && !newItems[0].project_id) {
      newItems = [{ ...newItems[0], project_id: pid }];
    }
    if (newItems.length === 0) newItems = [emptyItem(sp[0] || "")];
    setForm({ ...form, selected_projects: sp, items: newItems });
  };

  const submit = async () => {
    if (!form.invoice_number.trim() || !form.client_name.trim() || !form.due_date) {
      toast.error("Nomor invoice, klien, dan jatuh tempo wajib diisi"); return;
    }
    const validItems = form.items.filter(i => i.project_id && Number(i.amount) > 0);
    if (validItems.length === 0) { toast.error("Minimal satu item dengan proyek & jumlah"); return; }
    try {
      const res = await api.post("/tagihan", {
        invoice_number: form.invoice_number,
        client_name: form.client_name,
        items: validItems.map(i => ({ project_id: i.project_id, description: i.description, amount: Number(i.amount) })),
        due_date: form.due_date,
        notes: form.notes,
      });
      if (Array.isArray(res.data) && res.data.length > 1) {
        toast.success(`Tagihan utama & tagihan retensi dibuat (${res.data.length} invoice)`);
      } else {
        toast.success("Tagihan dibuat");
      }
      setOpen(false); setForm(empty()); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Gagal"); }
  };

  const updateStatus = async (t, status) => {
    await api.patch(`/tagihan/${t.id}`, { status });
    toast.success("Status diperbarui"); load();
  };

  const recordPayment = async () => {
    const newPaid = Number(payDialog.paid_amount || 0) + Number(payAmount);
    await api.patch(`/tagihan/${payDialog.id}`, { paid_amount: newPaid });
    toast.success("Pembayaran dicatat");
    setPayDialog(null); setPayAmount(0); load();
  };

  const remove = async (id) => { if (!window.confirm("Hapus tagihan?")) return; await api.delete(`/tagihan/${id}`); load(); };

  const exportCSV = () => {
    const rows = [["Invoice", "Klien", "Proyek", "Tipe", "Total", "Terbayar", "Sisa", "Jatuh Tempo", "Status"]];
    items.forEach(t => {
      const pnames = (t.project_ids || (t.project_id ? [t.project_id] : [])).map(projName).join(", ");
      rows.push([t.invoice_number, t.client_name, pnames, t.is_retensi ? "RETENSI" : "UTAMA", t.total, t.paid_amount, t.total - t.paid_amount, t.due_date, t.status]);
    });
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `tagihan-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const today = new Date().toISOString().slice(0, 10);
  const overdueCount = items.filter(t => t.due_date < today && t.paid_amount < t.total && t.status !== "lunas").length;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs tracking-widest text-slate-500 mb-2">PENAGIHAN KLIEN</div>
          <h1 className="font-display font-extrabold text-3xl text-slate-900">Tagihan</h1>
          <p className="text-slate-500 mt-1">Satu tagihan dapat mencakup beberapa proyek. Retensi otomatis dipecah menjadi tagihan terpisah.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportCSV} data-testid="tagihan-export-btn" className="rounded-full"><Download className="h-4 w-4 mr-2" /> Export CSV</Button>
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
                    <Label className="mb-2 block">Pilih Proyek (bisa lebih dari satu)</Label>
                    <div className="border border-slate-200 rounded-lg p-3 max-h-40 overflow-y-auto space-y-2 bg-slate-50">
                      {projects.length === 0 && <div className="text-sm text-slate-500">Belum ada proyek.</div>}
                      {projects.map(p => (
                        <label key={p.id} className="flex items-center gap-3 cursor-pointer p-1.5 rounded hover:bg-white" data-testid={`tagihan-pick-project-${p.id}`}>
                          <Checkbox checked={form.selected_projects.includes(p.id)} onCheckedChange={() => toggleProject(p.id)} />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-slate-900">{p.name}</div>
                            <div className="text-xs text-slate-500">{p.work_type} · {p.spk_rab_type || "SPK"}{(p.spk_rab_type || "SPK") === "SPK" ? ` · Retensi: ${p.retention_percent || 0}%` : ""}</div>
                          </div>
                          {p.spk_rab_type === "SPK" && !p.retention_paid && (p.has_retensi || "ada") !== "tidak_ada" && (Number(p.retention_percent) > 0) && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 whitespace-nowrap"><Percent className="h-3 w-3 inline mr-1" />Retensi aktif</span>
                          )}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label>Rincian Item</Label>
                      <Button type="button" size="sm" variant="outline" onClick={() => setForm({ ...form, items: [...form.items, emptyItem(form.selected_projects[0] || "")] })} data-testid="tagihan-add-item-btn"><Plus className="h-3.5 w-3.5 mr-1" /> Tambah Item</Button>
                    </div>
                    <div className="space-y-2">
                      {form.items.map((it, i) => (
                        <div key={i} className="flex gap-2">
                          <Select value={it.project_id} onValueChange={(v) => { const arr = [...form.items]; arr[i].project_id = v; setForm({ ...form, items: arr }); }}>
                            <SelectTrigger className="w-44" data-testid={`tagihan-item-project-${i}`}><SelectValue placeholder="Proyek" /></SelectTrigger>
                            <SelectContent className="bg-white">
                              {(form.selected_projects.length ? projects.filter(p => form.selected_projects.includes(p.id)) : projects).map(p => (
                                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input placeholder="Deskripsi" value={it.description} onChange={e => { const arr = [...form.items]; arr[i].description = e.target.value; setForm({ ...form, items: arr }); }} className="flex-1" data-testid={`tagihan-item-desc-${i}`} />
                          <Input type="number" placeholder="Jumlah" value={it.amount} onChange={e => { const arr = [...form.items]; arr[i].amount = e.target.value; setForm({ ...form, items: arr }); }} className="w-40" data-testid={`tagihan-item-amount-${i}`} />
                          <Button type="button" variant="ghost" size="icon" onClick={() => setForm({ ...form, items: form.items.filter((_, x) => x !== i) })}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Jatuh Tempo Utama</Label><Input data-testid="tagihan-due-input" type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} /></div>
                  </div>

                  <Card className="p-4 bg-blue-50 border-blue-200 space-y-1">
                    <div className="flex justify-between text-sm"><span className="text-slate-600">Subtotal Item</span><span className="font-mono tabular font-semibold">{formatIDR(subtotal)}</span></div>
                    {retensiPreview.total > 0 && (
                      <>
                        <div className="flex justify-between text-sm text-orange-700"><span className="flex items-center gap-1"><Percent className="h-3.5 w-3.5" /> Dipotong Retensi (sesuai % proyek)</span><span className="font-mono tabular font-semibold">- {formatIDR(retensiPreview.total)}</span></div>
                        <div className="text-xs text-slate-500 pl-4">
                          {retensiPreview.lines.map((l, i) => <div key={i}>• {l.projectName} ({l.pct}%): {formatIDR(l.amount)}</div>)}
                        </div>
                      </>
                    )}
                    <div className="border-t border-blue-200 pt-2 mt-2 flex justify-between font-display font-bold text-lg text-blue-900"><span>Total Invoice Utama</span><span className="font-mono tabular">{formatIDR(mainTotal)}</span></div>
                    {retensiPreview.total > 0 && (
                      <div className="mt-1 text-xs bg-orange-100 border border-orange-200 rounded px-2 py-1.5 text-orange-800">
                        + Sistem akan otomatis membuat <strong>tagihan retensi terpisah</strong> sebesar {formatIDR(retensiPreview.total)} (jatuh tempo +90 hari)
                      </div>
                    )}
                  </Card>

                  <div><Label>Catatan</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
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

      <Card className="overflow-hidden bg-white border-slate-200">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead>Invoice</TableHead>
              <TableHead>Klien</TableHead>
              <TableHead>Proyek</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Terbayar</TableHead>
              <TableHead>Jatuh Tempo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map(t => {
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
                  <TableCell className="text-slate-600 text-sm max-w-xs">
                    {projectIds.length === 0 ? "-" : projectIds.map(projName).join(", ")}
                    {projectIds.length > 1 && <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold">{projectIds.length} proyek</span>}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular">{formatIDR(t.total)}</TableCell>
                  <TableCell className="text-right font-mono tabular text-green-700">{formatIDR(t.paid_amount)}</TableCell>
                  <TableCell>{formatDate(t.due_date)}</TableCell>
                  <TableCell><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColor[status] || statusColor.draft}`}>{(status || "draft").replace("_", " ").toUpperCase()}</span></TableCell>
                  <TableCell className="text-right">
                    {canWrite && t.status === "draft" && <Button size="icon" variant="ghost" onClick={() => updateStatus(t, "terkirim")} title="Tandai terkirim"><Send className="h-4 w-4 text-blue-600" /></Button>}
                    {canWrite && t.paid_amount < t.total && <Button size="icon" variant="ghost" onClick={() => { setPayDialog(t); setPayAmount(t.total - t.paid_amount); }} title="Catat pembayaran" data-testid={`tagihan-pay-${t.id}`}><Wallet className="h-4 w-4 text-green-600" /></Button>}
                    {canWrite && <Button size="icon" variant="ghost" onClick={() => remove(t.id)}><Trash2 className="h-4 w-4 text-red-600" /></Button>}
                  </TableCell>
                </TableRow>
              );
            })}
            {items.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-slate-500 py-8">Belum ada tagihan.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!payDialog} onOpenChange={(v) => !v && setPayDialog(null)}>
        <DialogContent className="bg-white">
          <DialogHeader><DialogTitle>Catat Pembayaran</DialogTitle></DialogHeader>
          {payDialog && (
            <div className="space-y-3">
              <div className="text-sm">Invoice: <span className="font-mono font-semibold">{payDialog.invoice_number}</span>{payDialog.is_retensi && <span className="ml-2 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-orange-500 text-white">RETENSI</span>}</div>
              <div className="text-sm">Sisa: <span className="font-semibold text-red-600">{formatIDR(payDialog.total - payDialog.paid_amount)}</span></div>
              <div><Label>Jumlah Pembayaran</Label><Input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} data-testid="tagihan-pay-amount" /></div>
              {payDialog.is_retensi && <p className="text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded p-2">Ketika tagihan retensi ini lunas, status Payment Retensi pada proyek terkait akan otomatis diperbarui ke <strong>lunas</strong>.</p>}
            </div>
          )}
          <DialogFooter><Button onClick={recordPayment} className="bg-green-600 hover:bg-green-700" data-testid="tagihan-pay-submit">Catat</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
