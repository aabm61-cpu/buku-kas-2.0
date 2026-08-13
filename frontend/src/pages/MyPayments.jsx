import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Wallet } from "lucide-react";
import { formatIDR, formatDate } from "@/lib/format";

export default function MyPayments() {
  const [payments, setPayments] = useState([]);

  useEffect(() => {
    api.get("/team-payments").then(r => setPayments(r.data));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs tracking-widest text-slate-500 mb-2">RIWAYAT BAYARAN DARI BENDAHARA</div>
        <h1 className="font-display font-extrabold text-3xl text-slate-900">Pembayaran Saya</h1>
        <p className="text-slate-500 mt-1">Riwayat pembayaran individual Anda yang diinput oleh Bendahara. Hanya bisa dilihat.</p>
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
            {payments.map(p => (
              <TableRow key={p.id} data-testid={`my-payment-row-${p.id}`}>
                <TableCell>{formatDate(p.date)}</TableCell>
                <TableCell className="font-medium">{p.location_name || "-"}</TableCell>
                <TableCell className="text-right font-mono tabular">{formatIDR(p.amount)}</TableCell>
                <TableCell className="text-right font-mono tabular text-orange-700">{p.kasbon_total > 0 ? `- ${formatIDR(p.kasbon_total)}` : "-"}</TableCell>
                <TableCell className="text-right font-mono tabular font-semibold text-green-700">{formatIDR(p.net)}</TableCell>
              </TableRow>
            ))}
            {payments.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-slate-500 py-8"><Wallet className="h-8 w-8 mx-auto mb-2 text-slate-300" />Belum ada pembayaran dari Bendahara.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
