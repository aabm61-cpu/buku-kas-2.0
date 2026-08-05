import React, { useEffect, useState } from "react";
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
import { Plus, FileText, Trash2, Download, Send, AlertTriangle, Wallet } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { formatIDR, formatDate } from "@/lib/format";

const emptyItem = () => ({ description: "", amount: 0 });
const empty = () => ({ project_id: "", invoice_number: "", client_name: "", items: [emptyItem()], due_date: "", notes: "" });

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

  const total = form.items.reduce((s, i) => s + Number(i.amount || 0), 0);

  const submit = async () => {
    try {
      await api.post("/tagihan", { ...form, items: form.items.map(i => ({ description: i.description, amount: Number(i.amount) })) });
      toast.success("Tagihan dibuat");
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
    const rows = [["Invoice", "Klien", "Proyek", "Total", "Terbayar", "Sisa", "Jatuh Tempo", "Status"]];
    items.forEach(t => {
      const pname = projects.find(p => p.id === t.project_id)?.name || "";
      rows.push([t.invoice_number, t.client_name, pname, t.total, t.paid_amount, t.total - t.paid_amount, t.due_date, t.status]);
    });
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `tagihan-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const today = new Date().toISOString().slice(0, 10);
  const overdueCount = items.filter(t => t.due_date < today && t.paid_amount < t.total).length;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs tracking-widest text-slate-500 mb-2">PENAGIHAN KLIEN</div>
          <h1 className="font-display font-extrabold text-3xl text-slate-900">Tagihan</h1>
          <p className="text-slate-500 mt-1">Kelola invoice per proyek. Reminder otomatis untuk jatuh tempo.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportCSV} data-testid="tagihan-export-btn" className="rounded-full"><Download className="h-4 w-4 mr-2" /> Export CSV</Button>
          {canWrite && (
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setForm(empty()); }}>
              <DialogTrigger asChild><Button data-testid="tagihan-add-btn" className="rounded-full bg-blue-700 hover:bg-blue-800"><Plus className="h-4 w-4 mr-2" /> Tagihan Baru</Button></DialogTrigger>
              <DialogContent className="bg-white max-w-2xl">
                <DialogHeader><DialogTitle>Tagihan Baru</DialogTitle></DialogHeader>
                <div className="space-y-4 max-h-[70vh] overflow-y-auto">
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Nomor Invoice</Label><Input data-testid="tagihan-number-input" value={form.invoice_number} onChange={e => setForm({ ...form, invoice_number: e.target.value })} placeholder="INV-2026-001" /></div>
                    <div><Label>Klien</Label><Input data-testid="tagihan-client-input" value={form.client_name} onChange={e => setForm({ ...form, client_name: e.target.value })} /></div>
                  </div>
                  <div>
                    <Label>Proyek</Label>
                    <Select value={form.project_id} onValueChange={v => setForm({ ...form, project_id: v })}>
                      <SelectTrigger data-testid="tagihan-project-select"><SelectValue placeholder="Pilih proyek" /></SelectTrigger>
                      <SelectContent className="bg-white">{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Jatuh Tempo</Label><Input data-testid="tagihan-due-input" type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} /></div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label>Rincian Item</Label>
                      <Button type="button" size="sm" variant="outline" onClick={() => setForm({ ...form, items: [...form.items, emptyItem()] })} data-testid="tagihan-add-item-btn"><Plus className="h-3.5 w-3.5 mr-1" /> Tambah</Button>
                    </div>
                    <div className="space-y-2">
                      {form.items.map((it, i) => (
                        <div key={i} className="flex gap-2">
                          <Input placeholder="Deskripsi" value={it.description} onChange={e => { const arr = [...form.items]; arr[i].description = e.target.value; setForm({ ...form, items: arr }); }} className="flex-1" data-testid={`tagihan-item-desc-${i}`} />
                          <Input type="number" placeholder="Jumlah" value={it.amount} onChange={e => { const arr = [...form.items]; arr[i].amount = e.target.value; setForm({ ...form, items: arr }); }} className="w-40" data-testid={`tagihan-item-amount-${i}`} />
                          <Button type="button" variant="ghost" size="icon" onClick={() => setForm({ ...form, items: form.items.filter((_, x) => x !== i) })}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 text-right font-display font-bold text-lg">Total: {formatIDR(total)}</div>
                  </div>
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
              const pname = projects.find(p => p.id === t.project_id)?.name || "-";
              const status = t.due_date < today && t.paid_amount < t.total && t.status !== "lunas" ? "jatuh_tempo" : t.status;
              return (
                <TableRow key={t.id} data-testid={`tagihan-row-${t.id}`}>
                  <TableCell className="font-mono font-semibold">{t.invoice_number}</TableCell>
                  <TableCell>{t.client_name}</TableCell>
                  <TableCell className="text-slate-600">{pname}</TableCell>
                  <TableCell className="text-right font-mono tabular">{formatIDR(t.total)}</TableCell>
                  <TableCell className="text-right font-mono tabular text-green-700">{formatIDR(t.paid_amount)}</TableCell>
                  <TableCell>{formatDate(t.due_date)}</TableCell>
                  <TableCell><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColor[status]}`}>{status.replace("_", " ").toUpperCase()}</span></TableCell>
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
              <div className="text-sm">Invoice: <span className="font-mono font-semibold">{payDialog.invoice_number}</span></div>
              <div className="text-sm">Sisa: <span className="font-semibold text-red-600">{formatIDR(payDialog.total - payDialog.paid_amount)}</span></div>
              <div><Label>Jumlah Pembayaran</Label><Input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} data-testid="tagihan-pay-amount" /></div>
            </div>
          )}
          <DialogFooter><Button onClick={recordPayment} className="bg-green-600 hover:bg-green-700" data-testid="tagihan-pay-submit">Catat</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
