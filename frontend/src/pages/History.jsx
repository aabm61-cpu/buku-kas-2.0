import React, { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MapPin, CalendarCheck, TrendingUp, TrendingDown, Search, X } from "lucide-react";
import { formatIDR, formatDate } from "@/lib/format";

export default function History() {
  const [items, setItems] = useState([]);
  const [projects, setProjects] = useState([]);
  const [month, setMonth] = useState("");

  useEffect(() => {
    Promise.all([
      api.get("/bukukas/history").catch(() => ({ data: [] })),
      api.get("/projects").catch(() => ({ data: [] })),
    ]).then(([h, p]) => { setItems(h.data); setProjects(p.data); });
  }, []);

  const projName = (id) => projects.find(p => p.id === id)?.name || "-";

  const filtered = useMemo(() => {
    const sorted = [...items].sort((a, b) => (b.closed_at || "").localeCompare(a.closed_at || ""));
    if (!month) return sorted;
    return sorted.filter(l => (l.closed_at || "").slice(0, 7) === month);
  }, [items, month]);

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs tracking-widest text-slate-500 mb-2">RIWAYAT TEMPAT PENGERJAAN</div>
        <h1 className="font-display font-extrabold text-3xl text-slate-900">History Lokasi</h1>
        <p className="text-slate-500 mt-1">Lokasi dengan buku kas yang sudah diselesaikan, diurutkan dari yang terbaru.</p>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <Input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="pl-9 w-52 bg-white"
            data-testid="history-month-filter"
          />
        </div>
        {month && (
          <Button variant="ghost" size="sm" onClick={() => setMonth("")} data-testid="history-month-clear">
            <X className="h-4 w-4 mr-1" /> Hapus filter
          </Button>
        )}
        <span className="text-sm text-slate-500" data-testid="history-count">{filtered.length} lokasi selesai</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map(loc => (
          <Card key={loc.id} className="p-6 card-lift bg-white border-slate-200" data-testid={`history-card-${loc.id}`}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-orange-500" />
                  <h3 className="font-display font-bold text-lg">{loc.name}</h3>
                </div>
                <div className="text-sm text-slate-500 mt-1">{projName(loc.project_id)}</div>
                {loc.address && <div className="text-xs text-slate-400 mt-1">{loc.address}</div>}
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">SELESAI</span>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-green-50 rounded-lg p-3">
                <div className="flex items-center gap-1.5 text-xs text-green-700 font-medium"><TrendingUp className="h-3.5 w-3.5" /> Pemasukan</div>
                <div className="font-mono font-bold text-green-900 mt-1">{formatIDR(loc.total_in)}</div>
              </div>
              <div className="bg-red-50 rounded-lg p-3">
                <div className="flex items-center gap-1.5 text-xs text-red-700 font-medium"><TrendingDown className="h-3.5 w-3.5" /> Pengeluaran</div>
                <div className="font-mono font-bold text-red-900 mt-1">{formatIDR(loc.total_out)}</div>
              </div>
            </div>

            <div className="text-sm text-slate-600 flex items-center gap-2 border-t border-slate-100 pt-3">
              <CalendarCheck className="h-4 w-4 text-green-600" />
              <span>Pekerjaan selesai: <span className="font-semibold">{formatDate(loc.closed_at)}</span></span>
              <span className="text-slate-400">· {loc.count} transaksi</span>
            </div>
          </Card>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full text-center text-slate-500 py-12" data-testid="history-empty">
            {month ? "Tidak ada lokasi selesai pada bulan tersebut." : "Belum ada buku kas yang diselesaikan."}
          </div>
        )}
      </div>
    </div>
  );
}
