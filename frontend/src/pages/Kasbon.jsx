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
import { Plus, Coins, CheckCircle2, Wallet } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { formatIDR, formatDate } from "@/lib/format";

const empty = () => ({ location_id: "", borrower_user_id: "", amount: "", description: "", date: new Date().toISOString().slice(0, 10) });

export default function Kasbon() {
  const { user } = useAuth();
  const isTim = user.role === "tim";
  const [items, setItems] = useState([]);
  const [locations, setLocations] = useState([]);
  const [users, setUsers] = useState([]);
  const [myPayments, setMyPayments] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty());

  const load = async () => {
    const [k, l, u] = await Promise.all([api.get("/kasbon"), api.get("/locations"), api.get("/users")]);
    setItems(k.data); setLocations(l.data); setUsers(u.data);
    if (isTim) {
      const tp = await api.get("/team-payments");
      setMyPayments(tp.data);
    }
  };
  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!form.location_id || !form.borrower_user_id) { toast.error("Lokasi & peminjam wajib diisi"); return; }
    try {
      await api.post("/kasbon", { ...form, amount: Number(form.amount), date: new Date(form.date).toISOString() });
      toast.success("Kasbon dicatat");
      setOpen(false); setForm(empty()); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Gagal"); }
  };

  const markPaid = async (k) => {
    await api.patch(`/kasbon/${k.id}`, { status: k.status === "pending" ? "lunas" : "pending" });
    load();
  };

  const locName = (id) => locations.find(l => l.id === id)?.name || "-";

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs tracking-widest text-slate-500 mb-2">PINJAMAN OPERASIONAL TIM</div>
          <h1 className="font-display font-extrabold text-3xl text-slate-900">Kasbon</h1>
          <p className="text-slate-500 mt-1">Catat kasbon per anggota tim & lokasi. Bendahara memvalidasi pelunasan.</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setForm(empty()); }}>
          <DialogTrigger asChild><Button data-testid="kasbon-add-btn" className="rounded-full bg-blue-700 hover:bg-blue-800"><Plus className="h-4 w-4 mr-2" /> Kasbon Baru</Button></DialogTrigger>
          <DialogContent className="bg-white">
            <DialogHeader><DialogTitle>Kasbon Baru</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Lokasi</Label>
                <Select value={form.location_id} onValueChange={v => setForm({ ...form, location_id: v })}>
                  <SelectTrigger data-testid="kasbon-location-select"><SelectValue placeholder="Pilih lokasi" /></SelectTrigger>
                  <SelectContent className="bg-white">{locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Peminjam</Label>
                <Select value={form.borrower_user_id} onValueChange={v => setForm({ ...form, borrower_user_id: v })}>
                  <SelectTrigger data-testid="kasbon-borrower-select"><SelectValue placeholder="Pilih anggota" /></SelectTrigger>
                  <SelectContent className="bg-white">{users.filter(u => u.role === "tim").map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Jumlah (Rp)</Label><Input type="number" data-testid="kasbon-amount-input" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></div>
                <div><Label>Tanggal</Label><Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
              </div>
              <div><Label>Keterangan</Label><Textarea data-testid="kasbon-desc-input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={submit} data-testid="kasbon-submit-btn" className="bg-blue-700 hover:bg-blue-800">Simpan</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isTim && (
        <div className="space-y-2" data-testid="my-payments-section">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-blue-700" />
            <span className="text-xs font-semibold tracking-widest text-slate-500">PEMBAYARAN SAYA · {myPayments.length}</span>
          </div>
          <Card className="overflow-hidden bg-white border-slate-200">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Lokasi</TableHead>
                  <TableHead className="text-right">Hasil</TableHead>
                  <TableHead className="text-right">Kasbon</TableHead>
                  <TableHead className="text-right">Diterima</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {myPayments.map(p => (
                  <TableRow key={p.id} data-testid={`my-payment-row-${p.id}`}>
                    <TableCell>{formatDate(p.date)}</TableCell>
                    <TableCell className="font-medium">{p.location_name || locName(p.location_id)}</TableCell>
                    <TableCell className="text-right font-mono tabular">{formatIDR(p.amount)}</TableCell>
                    <TableCell className="text-right font-mono tabular text-orange-700">{p.kasbon_total > 0 ? `- ${formatIDR(p.kasbon_total)}` : "-"}</TableCell>
                    <TableCell className="text-right font-mono tabular font-semibold text-green-700">{formatIDR(p.net)}</TableCell>
                  </TableRow>
                ))}
                {myPayments.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-slate-500 py-8"><Wallet className="h-8 w-8 mx-auto mb-2 text-slate-300" />Belum ada pembayaran dari Bendahara.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Card>
        </div>
      )}

      {isTim && (
        <div className="flex items-center gap-2 pt-2">
          <Coins className="h-4 w-4 text-blue-700" />
          <span className="text-xs font-semibold tracking-widest text-slate-500">KASBON · {items.length}</span>
        </div>
      )}
      <Card className="overflow-hidden bg-white border-slate-200">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead>Tanggal</TableHead>
              <TableHead>Peminjam</TableHead>
              <TableHead>Lokasi</TableHead>
              <TableHead>Keterangan</TableHead>
              <TableHead className="text-right">Jumlah</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map(k => (
              <TableRow key={k.id} data-testid={`kasbon-row-${k.id}`}>
                <TableCell>{formatDate(k.date)}</TableCell>
                <TableCell className="font-medium">{k.borrower_name}</TableCell>
                <TableCell>{locName(k.location_id)}</TableCell>
                <TableCell className="text-slate-600">{k.description}</TableCell>
                <TableCell className="text-right font-mono tabular font-semibold">{formatIDR(k.amount)}</TableCell>
                <TableCell><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${k.status === "lunas" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>{k.status.toUpperCase()}</span></TableCell>
                <TableCell>{["bendahara", "owner"].includes(user.role) && <Button size="sm" variant={k.status === "lunas" ? "outline" : "default"} onClick={() => markPaid(k)} data-testid={`kasbon-toggle-${k.id}`} className={k.status === "lunas" ? "" : "bg-green-600 hover:bg-green-700"}><CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> {k.status === "lunas" ? "Batalkan" : "Lunas"}</Button>}</TableCell>
              </TableRow>
            ))}
            {items.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-slate-500 py-8"><Coins className="h-8 w-8 mx-auto mb-2 text-slate-300" />Belum ada kasbon.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
