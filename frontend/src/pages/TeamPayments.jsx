import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarDays, Receipt } from "lucide-react";
import { formatIDR, monthLabel } from "@/lib/format";

export default function TeamPayments() {
  const [history, setHistory] = useState([]);
  const [projects, setProjects] = useState([]);
  const [payments, setPayments] = useState([]);
  const [month, setMonth] = useState("all");
  const [recapSel, setRecapSel] = useState({});

  useEffect(() => {
    Promise.all([
      api.get("/bukukas/history"),
      api.get("/projects"),
      api.get("/team-payments"),
    ]).then(([h, p, tp]) => { setHistory(h.data); setProjects(p.data); setPayments(tp.data); });
  }, []);

  const months = [...new Set(history.map(l => (l.closed_at || "").slice(0, 7)).filter(Boolean))].sort().reverse();
  const filteredHistory = month === "all" ? history : history.filter(l => (l.closed_at || "").slice(0, 7) === month);
  const readyList = filteredHistory.filter(l => l.payment_ready);

  const locTotals = (locId) => {
    const rows = payments.filter(p => p.location_id === locId && p.paid);
    return {
      amount: rows.reduce((s, p) => s + (p.amount || 0), 0),
      kasbon: rows.reduce((s, p) => s + (p.kasbon_total || 0), 0),
      net: rows.reduce((s, p) => s + (p.net || 0), 0),
    };
  };
  const selectedLocs = readyList.filter(l => recapSel[l.id]);
  const grand = selectedLocs.reduce((acc, l) => {
    const t = locTotals(l.id);
    return { amount: acc.amount + t.amount, kasbon: acc.kasbon + t.kasbon, net: acc.net + t.net };
  }, { amount: 0, kasbon: 0, net: 0 });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs tracking-widest text-slate-500 mb-2">REKAP INVOICE GABUNGAN TIM</div>
          <h1 className="font-display font-extrabold text-3xl text-slate-900">Pembayaran Tim</h1>
          <p className="text-slate-500 mt-1">Pilih beberapa proyek berstatus Siap Dibayar untuk membuat rekap invoice gabungan tim.</p>
        </div>
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-slate-500" />
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-48 bg-white" data-testid="tp-month-filter"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-white">
              <SelectItem value="all">Semua Bulan</SelectItem>
              {months.map(m => <SelectItem key={m} value={m} data-testid={`tp-month-opt-${m}`}>{monthLabel(m)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div data-testid="tp-panel-recap" className="space-y-4">
        <Card className="overflow-hidden bg-white border-slate-200">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="w-10"></TableHead>
                <TableHead>Proyek</TableHead>
                <TableHead>Anggota Tim</TableHead>
                <TableHead className="text-right">Hasil</TableHead>
                <TableHead className="text-right">Kasbon</TableHead>
                <TableHead className="text-right">Diterima</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {readyList.map(loc => {
                const proj = projects.find(p => p.id === loc.project_id);
                const t = locTotals(loc.id);
                return (
                  <TableRow key={loc.id} data-testid={`recap-row-${loc.id}`} className={recapSel[loc.id] ? "bg-blue-50/50" : ""}>
                    <TableCell>
                      <Checkbox checked={!!recapSel[loc.id]} onCheckedChange={(v) => setRecapSel({ ...recapSel, [loc.id]: !!v })} data-testid={`recap-check-${loc.id}`} />
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold text-slate-900">{proj?.name || loc.name}</div>
                      <div className="text-xs text-slate-500">{proj?.work_type || "-"}</div>
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">{(loc.team || []).map(m => m.name).join(", ") || "-"}</TableCell>
                    <TableCell className="text-right font-mono tabular">{formatIDR(t.amount)}</TableCell>
                    <TableCell className="text-right font-mono tabular text-orange-700">{t.kasbon > 0 ? `- ${formatIDR(t.kasbon)}` : "-"}</TableCell>
                    <TableCell className="text-right font-mono tabular font-semibold text-green-700">{formatIDR(t.net)}</TableCell>
                  </TableRow>
                );
              })}
              {readyList.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-slate-500 py-8"><Receipt className="h-8 w-8 mx-auto mb-2 text-slate-300" />Belum ada proyek berstatus Siap Dibayar untuk direkap. Kelola status di menu Rekap Pembayaran.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Card>

        {selectedLocs.length > 0 && (
          <Card className="bg-white border-blue-200 p-5" data-testid="recap-summary">
            <div className="flex items-center gap-2 mb-4">
              <Receipt className="h-4 w-4 text-blue-700" />
              <span className="text-xs font-semibold tracking-widest text-slate-500">REKAP INVOICE GABUNGAN · {selectedLocs.length} PROYEK</span>
            </div>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Proyek</TableHead>
                    <TableHead className="text-right">Hasil</TableHead>
                    <TableHead className="text-right">Kasbon</TableHead>
                    <TableHead className="text-right">Diterima</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedLocs.map(loc => {
                    const proj = projects.find(p => p.id === loc.project_id);
                    const t = locTotals(loc.id);
                    return (
                      <TableRow key={loc.id} data-testid={`recap-sum-row-${loc.id}`}>
                        <TableCell className="font-medium text-slate-900">{proj?.name || loc.name}</TableCell>
                        <TableCell className="text-right font-mono tabular">{formatIDR(t.amount)}</TableCell>
                        <TableCell className="text-right font-mono tabular text-orange-700">{t.kasbon > 0 ? `- ${formatIDR(t.kasbon)}` : "-"}</TableCell>
                        <TableCell className="text-right font-mono tabular">{formatIDR(t.net)}</TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow className="bg-blue-50 border-t-2 border-blue-200">
                    <TableCell className="font-bold text-slate-900">TOTAL ({selectedLocs.length} proyek)</TableCell>
                    <TableCell className="text-right font-mono tabular font-bold" data-testid="recap-total-amount">{formatIDR(grand.amount)}</TableCell>
                    <TableCell className="text-right font-mono tabular font-bold text-orange-700" data-testid="recap-total-kasbon">{grand.kasbon > 0 ? `- ${formatIDR(grand.kasbon)}` : "-"}</TableCell>
                    <TableCell className="text-right font-mono tabular font-bold text-green-700 text-base" data-testid="recap-total-net">{formatIDR(grand.net)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
