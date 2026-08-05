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
import { Plus, Wallet, CheckCircle2, Download, Calculator } from "lucide-react";
import { formatIDR, formatDate } from "@/lib/format";

const empty = () => ({ location_id: "", user_id: "", period_start: "", period_end: "", days_worked: 0, daily_rate: 0, kasbon_deduction: 0, bonus: 0, notes: "" });

export default function TeamPayments() {
  const [items, setItems] = useState([]);
  const [locations, setLocations] = useState([]);
  const [users, setUsers] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty());

  const load = async () => {
    const [t, l, u] = await Promise.all([api.get("/team-payments"), api.get("/locations"), api.get("/users")]);
    setItems(t.data); setLocations(l.data); setUsers(u.data);
  };
  useEffect(() => { load(); }, []);

  const gross = Number(form.days_worked || 0) * Number(form.daily_rate || 0) + Number(form.bonus || 0);
  const net = gross - Number(form.kasbon_deduction || 0);

  const submit = async () => {
    try {
      await api.post("/team-payments", {
        ...form,
        days_worked: Number(form.days_worked),
        daily_rate: Number(form.daily_rate),
        kasbon_deduction: Number(form.kasbon_deduction),
        bonus: Number(form.bonus),
      });
      toast.success("Bayaran tim dihitung"); setOpen(false); setForm(empty()); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Gagal"); }
  };

  const togglePaid = async (p) => {
    await api.patch(`/team-payments/${p.id}`, { paid: !p.paid });
    load();
  };

  const remove = async (id) => { if (!window.confirm("Hapus?")) return; await api.delete(`/team-payments/${id}`); load(); };

  const locName = (id) => locations.find(l => l.id === id)?.name || "-";

  const exportCSV = () => {
    const rows = [["Periode", "Nama", "Lokasi", "Hari", "Rate/hari", "Bonus", "Kasbon", "Gross", "Net", "Status"]];
    items.forEach(p => rows.push([`${p.period_start} s/d ${p.period_end}`, p.user_name, locName(p.location_id), p.days_worked, p.daily_rate, p.bonus, p.kasbon_deduction, p.gross, p.net, p.paid ? "DIBAYAR" : "BELUM"]));
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `bayaran-tim-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs tracking-widest text-slate-500 mb-2">PENGHITUNGAN BAYARAN TIM</div>
          <h1 className="font-display font-extrabold text-3xl text-slate-900">Bayaran Tim</h1>
          <p className="text-slate-500 mt-1">Hitung upah tim per lokasi & periode. Kurangi dengan kasbon.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCSV} className="rounded-full" data-testid="tp-export-btn"><Download className="h-4 w-4 mr-2" /> Export</Button>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setForm(empty()); }}>
            <DialogTrigger asChild><Button data-testid="tp-add-btn" className="rounded-full bg-blue-700 hover:bg-blue-800"><Plus className="h-4 w-4 mr-2" /> Hitung Baru</Button></DialogTrigger>
            <DialogContent className="bg-white max-w-lg">
              <DialogHeader><DialogTitle>Hitung Bayaran Tim</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Lokasi</Label>
                    <Select value={form.location_id} onValueChange={v => setForm({ ...form, location_id: v })}>
                      <SelectTrigger data-testid="tp-location-select"><SelectValue placeholder="Pilih" /></SelectTrigger>
                      <SelectContent className="bg-white">{locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Anggota Tim</Label>
                    <Select value={form.user_id} onValueChange={v => setForm({ ...form, user_id: v })}>
                      <SelectTrigger data-testid="tp-user-select"><SelectValue placeholder="Pilih" /></SelectTrigger>
                      <SelectContent className="bg-white">{users.filter(u => u.role === "tim").map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Periode Mulai</Label><Input type="date" value={form.period_start} onChange={e => setForm({ ...form, period_start: e.target.value })} data-testid="tp-start-input" /></div>
                  <div><Label>Periode Akhir</Label><Input type="date" value={form.period_end} onChange={e => setForm({ ...form, period_end: e.target.value })} data-testid="tp-end-input" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Jumlah Hari</Label><Input type="number" value={form.days_worked} onChange={e => setForm({ ...form, days_worked: e.target.value })} data-testid="tp-days-input" /></div>
                  <div><Label>Upah/Hari (Rp)</Label><Input type="number" value={form.daily_rate} onChange={e => setForm({ ...form, daily_rate: e.target.value })} data-testid="tp-rate-input" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Bonus (Rp)</Label><Input type="number" value={form.bonus} onChange={e => setForm({ ...form, bonus: e.target.value })} /></div>
                  <div><Label>Potongan Kasbon (Rp)</Label><Input type="number" value={form.kasbon_deduction} onChange={e => setForm({ ...form, kasbon_deduction: e.target.value })} data-testid="tp-kasbon-input" /></div>
                </div>
                <div><Label>Catatan</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>

                <Card className="p-4 bg-blue-50 border-blue-200 flex items-center gap-3">
                  <Calculator className="h-5 w-5 text-blue-700" />
                  <div className="flex-1 flex items-center justify-between">
                    <div>
                      <div className="text-xs text-blue-700 uppercase tracking-wider">Gross</div>
                      <div className="font-mono font-semibold">{formatIDR(gross)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-blue-700 uppercase tracking-wider">Bersih Dibayar</div>
                      <div className="font-mono font-bold text-lg text-blue-900">{formatIDR(net)}</div>
                    </div>
                  </div>
                </Card>
              </div>
              <DialogFooter><Button onClick={submit} data-testid="tp-submit-btn" className="bg-blue-700 hover:bg-blue-800">Simpan Hitungan</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="overflow-hidden bg-white border-slate-200">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead>Periode</TableHead>
              <TableHead>Anggota</TableHead>
              <TableHead>Lokasi</TableHead>
              <TableHead className="text-right">Hari</TableHead>
              <TableHead className="text-right">Rate</TableHead>
              <TableHead className="text-right">Kasbon</TableHead>
              <TableHead className="text-right">Bersih</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map(p => (
              <TableRow key={p.id} data-testid={`tp-row-${p.id}`}>
                <TableCell className="text-sm">{formatDate(p.period_start)} — {formatDate(p.period_end)}</TableCell>
                <TableCell className="font-medium">{p.user_name}</TableCell>
                <TableCell>{locName(p.location_id)}</TableCell>
                <TableCell className="text-right tabular">{p.days_worked}</TableCell>
                <TableCell className="text-right tabular">{formatIDR(p.daily_rate)}</TableCell>
                <TableCell className="text-right tabular text-orange-600">-{formatIDR(p.kasbon_deduction)}</TableCell>
                <TableCell className="text-right tabular font-bold text-green-700">{formatIDR(p.net)}</TableCell>
                <TableCell><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${p.paid ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-700"}`}>{p.paid ? "DIBAYAR" : "BELUM"}</span></TableCell>
                <TableCell>
                  <Button size="sm" variant={p.paid ? "outline" : "default"} onClick={() => togglePaid(p)} className={p.paid ? "" : "bg-green-600 hover:bg-green-700"} data-testid={`tp-toggle-${p.id}`}><CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> {p.paid ? "Batalkan" : "Tandai Bayar"}</Button>
                </TableCell>
              </TableRow>
            ))}
            {items.length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-slate-500 py-8"><Wallet className="h-8 w-8 mx-auto mb-2 text-slate-300" />Belum ada penghitungan.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
