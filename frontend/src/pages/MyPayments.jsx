import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Wallet, CalendarDays } from "lucide-react";
import { formatIDR, formatDate, monthLabel } from "@/lib/format";

export default function MyPayments() {
  const [payments, setPayments] = useState([]);
  const [month, setMonth] = useState("all");

  useEffect(() => {
    api.get("/team-payments").then(r => setPayments(r.data));
  }, []);

  const months = [...new Set(payments.map(p => (p.date || "").slice(0, 7)).filter(Boolean))].sort().reverse();
  const filtered = month === "all" ? payments : payments.filter(p => (p.date || "").slice(0, 7) === month);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs tracking-widest text-slate-500 mb-2">RIWAYAT BAYARAN DARI BENDAHARA</div>
          <h1 className="font-display font-extrabold text-3xl text-slate-900">Pembayaran Saya</h1>
          <p className="text-slate-500 mt-1">Riwayat pembayaran individual Anda yang diinput oleh Bendahara. Hanya bisa dilihat.</p>
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
              <TableHead>Tanggal</TableHead>
              <TableHead>Lokasi</TableHead>
              <TableHead className="text-right">Hasil</TableHead>
              <TableHead className="text-right">Kasbon</TableHead>
              <TableHead className="text-right">Diterima</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(p => (
              <TableRow key={p.id} data-testid={`my-payment-row-${p.id}`}>
                <TableCell>{formatDate(p.date)}</TableCell>
                <TableCell className="font-medium">{p.location_name || "-"}</TableCell>
                <TableCell className="text-right font-mono tabular">{formatIDR(p.amount)}</TableCell>
                <TableCell className="text-right font-mono tabular text-orange-700">{p.kasbon_total > 0 ? `- ${formatIDR(p.kasbon_total)}` : "-"}</TableCell>
                <TableCell className="text-right font-mono tabular font-semibold text-green-700">{formatIDR(p.net)}</TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-slate-500 py-8"><Wallet className="h-8 w-8 mx-auto mb-2 text-slate-300" />{month === "all" ? "Belum ada pembayaran dari Bendahara." : "Tidak ada pembayaran pada bulan ini."}</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
