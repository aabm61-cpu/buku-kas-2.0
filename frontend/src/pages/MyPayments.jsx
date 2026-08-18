import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Wallet, CalendarDays, Eye, MapPin, CheckCircle2, Clock } from "lucide-react";
import { formatIDR, formatDateTime, monthLabel } from "@/lib/format";

const PERIODS = [
  { value: "1-15", label: "Tanggal 1 s/d 15" },
  { value: "16-end", label: "Tanggal 16 s/d Akhir Bulan" },
];
const periodLabel = (v) => PERIODS.find(p => p.value === v)?.label || v;

export default function MyPayments() {
  const [entries, setEntries] = useState([]);
  const [month, setMonth] = useState("all");
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    api.get("/my-payment-entries").then(r => setEntries(r.data));
  }, []);

  const months = [...new Set(entries.map(e => e.month).filter(Boolean))].sort().reverse();
  const filtered = month === "all" ? entries : entries.filter(e => e.month === month);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs tracking-widest text-slate-500 mb-2">PEMBAYARAN DARI BENDAHARA</div>
          <h1 className="font-display font-extrabold text-3xl text-slate-900">Pembayaran Saya</h1>
          <p className="text-slate-500 mt-1">Rincian pembayaran Anda yang sudah dientri oleh Bendahara per periode. Hanya bisa dilihat.</p>
        </div>
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-slate-500" />
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-48 bg-white" data-testid="mp-month-filter"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-white">
              <SelectItem value="all">Semua Bulan</SelectItem>
              {months.map(m => <SelectItem key={m} value={m} data-testid={`mp-month-opt-${m}`}>{monthLabel(m)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="overflow-hidden bg-white border-slate-200" data-testid="my-payments-section">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead>Periode Pembayaran</TableHead>
              <TableHead className="text-right">Total Hasil</TableHead>
              <TableHead className="text-right">Potongan Kasbon</TableHead>
              <TableHead className="text-right">Diterima</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-center">Detail</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(e => (
              <TableRow key={e.id} data-testid={`mp-entry-row-${e.id}`}>
                <TableCell>
                  <div className="font-semibold text-slate-900">{e.month ? `${monthLabel(e.month)} · ${periodLabel(e.period)}` : periodLabel(e.period)}</div>
                  <div className="text-xs text-slate-500 mt-0.5">Dientri {formatDateTime(e.created_at)}</div>
                </TableCell>
                <TableCell className="text-right font-mono tabular">{formatIDR(e.amount)}</TableCell>
                <TableCell className="text-right font-mono tabular text-orange-700">{e.kasbon > 0 ? `- ${formatIDR(e.kasbon)}` : "-"}</TableCell>
                <TableCell className="text-right font-mono tabular font-semibold text-green-700">{formatIDR(e.net)}</TableCell>
                <TableCell className="text-center">
                  {e.received ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700"><CheckCircle2 className="h-3 w-3" /> DITERIMA</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700"><Clock className="h-3 w-3" /> MENUNGGU</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  <Button size="sm" variant="outline" className="h-7 rounded-full text-xs" onClick={() => setDetail(e)} data-testid={`mp-detail-btn-${e.id}`}>
                    <Eye className="h-3 w-3 mr-1" /> Detail
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-slate-500 py-8"><Wallet className="h-8 w-8 mx-auto mb-2 text-slate-300" />{month === "all" ? "Belum ada pembayaran yang dientri Bendahara." : "Tidak ada pembayaran pada bulan ini."}</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>

      {/* Detail lokasi proyek */}
      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="bg-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-orange-500" /> Detail Lokasi Proyek
            </DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-3" data-testid="mp-loc-detail">
              <div className="text-sm text-slate-600">
                Periode: <span className="font-medium text-slate-900">{detail.month ? `${monthLabel(detail.month)} · ${periodLabel(detail.period)}` : periodLabel(detail.period)}</span>
              </div>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>Lokasi Proyek</TableHead>
                      <TableHead className="text-right">Hasil</TableHead>
                      <TableHead className="text-right">Kasbon</TableHead>
                      <TableHead className="text-right">Diterima</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(detail.locations || []).map((r, i) => (
                      <TableRow key={i} data-testid={`mp-loc-row-${i}`}>
                        <TableCell className="font-medium text-slate-900">{r.location_name}</TableCell>
                        <TableCell className="text-right font-mono tabular">{formatIDR(r.amount)}</TableCell>
                        <TableCell className="text-right font-mono tabular text-orange-700">{r.kasbon > 0 ? `- ${formatIDR(r.kasbon)}` : "-"}</TableCell>
                        <TableCell className="text-right font-mono tabular font-semibold text-green-700">{formatIDR(r.net)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-blue-50 border-t-2 border-blue-200">
                      <TableCell className="font-bold">TOTAL</TableCell>
                      <TableCell className="text-right font-mono tabular font-bold">{formatIDR(detail.amount)}</TableCell>
                      <TableCell className="text-right font-mono tabular font-bold text-orange-700">{detail.kasbon > 0 ? `- ${formatIDR(detail.kasbon)}` : "-"}</TableCell>
                      <TableCell className="text-right font-mono tabular font-bold text-green-700">{formatIDR(detail.net)}</TableCell>
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
