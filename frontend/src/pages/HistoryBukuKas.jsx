import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BookOpen, Archive, TrendingUp, TrendingDown } from "lucide-react";
import { formatIDR, formatDateTime } from "@/lib/format";

export default function HistoryBukuKas() {
  const [items, setItems] = useState([]);
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    Promise.all([
      api.get("/bukukas/history").catch(() => ({ data: [] })),
      api.get("/projects").catch(() => ({ data: [] })),
    ]).then(([h, p]) => { setItems(h.data); setProjects(p.data); });
  }, []);

  const projName = (id) => projects.find(p => p.id === id)?.name || "-";

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs tracking-widest text-slate-500 mb-2">ARSIP BUKU KAS SELESAI</div>
        <h1 className="font-display font-extrabold text-3xl text-slate-900">Riwayat Buku Kas</h1>
        <p className="text-slate-500 mt-1">Daftar buku kas yang sudah diselesaikan. Data tetap tersimpan untuk referensi.</p>
      </div>

      <Card className="bg-white border-slate-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead>Nama Buku Kas</TableHead>
              <TableHead>Proyek</TableHead>
              <TableHead>Ditutup</TableHead>
              <TableHead className="text-right">Pemasukan</TableHead>
              <TableHead className="text-right">Pengeluaran</TableHead>
              <TableHead className="text-right">Saldo Akhir</TableHead>
              <TableHead className="text-right">Pencatatan</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map(b => {
              const saldo = (b.total_in || 0) - (b.total_out || 0);
              return (
                <TableRow key={b.id} data-testid={`history-row-${b.id}`}>
                  <TableCell className="font-semibold flex items-center gap-2"><Archive className="h-4 w-4 text-slate-400" />{b.name}</TableCell>
                  <TableCell className="text-slate-600">{projName(b.project_id)}</TableCell>
                  <TableCell className="text-slate-600 text-sm">{formatDateTime(b.closed_at)}</TableCell>
                  <TableCell className="text-right font-mono tabular text-green-700"><TrendingUp className="h-3 w-3 inline mr-1" />{formatIDR(b.total_in)}</TableCell>
                  <TableCell className="text-right font-mono tabular text-red-700"><TrendingDown className="h-3 w-3 inline mr-1" />{formatIDR(b.total_out)}</TableCell>
                  <TableCell className={`text-right font-mono tabular font-bold ${saldo >= 0 ? "text-slate-900" : "text-red-700"}`}>{formatIDR(saldo)}</TableCell>
                  <TableCell className="text-right text-sm text-slate-500">{b.count} entri</TableCell>
                </TableRow>
              );
            })}
            {items.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center py-12 text-slate-500">
                <BookOpen className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                Belum ada buku kas yang diselesaikan.
              </TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
