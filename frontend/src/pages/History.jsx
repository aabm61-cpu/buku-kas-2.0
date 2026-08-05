import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { MapPin, Calendar, TrendingUp, TrendingDown } from "lucide-react";
import { formatIDR, formatDate } from "@/lib/format";

export default function History() {
  const [locations, setLocations] = useState([]);
  const [cashbook, setCashbook] = useState([]);
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    Promise.all([api.get("/locations"), api.get("/cashbook"), api.get("/projects")])
      .then(([l, c, p]) => { setLocations(l.data); setCashbook(c.data); setProjects(p.data); });
  }, []);

  const projName = (id) => projects.find(p => p.id === id)?.name || "-";

  const byLocation = locations.map(loc => {
    const entries = cashbook.filter(c => c.location_id === loc.id);
    const totalIn = entries.filter(e => e.type === "pemasukan").reduce((s, e) => s + e.amount, 0);
    const totalOut = entries.filter(e => e.type === "pengeluaran").reduce((s, e) => s + e.amount, 0);
    const dates = entries.map(e => e.date).sort();
    return { ...loc, totalIn, totalOut, count: entries.length, firstDate: dates[0], lastDate: dates[dates.length - 1] };
  });

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs tracking-widest text-slate-500 mb-2">RIWAYAT PENUGASAN</div>
        <h1 className="font-display font-extrabold text-3xl text-slate-900">History Lokasi</h1>
        <p className="text-slate-500 mt-1">Rekap aktivitas di setiap lokasi yang dikerjakan.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {byLocation.map(loc => (
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
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${loc.status === "aktif" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-700"}`}>{loc.status?.toUpperCase()}</span>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-green-50 rounded-lg p-3">
                <div className="flex items-center gap-1.5 text-xs text-green-700 font-medium"><TrendingUp className="h-3.5 w-3.5" /> Pemasukan</div>
                <div className="font-mono font-bold text-green-900 mt-1">{formatIDR(loc.totalIn)}</div>
              </div>
              <div className="bg-red-50 rounded-lg p-3">
                <div className="flex items-center gap-1.5 text-xs text-red-700 font-medium"><TrendingDown className="h-3.5 w-3.5" /> Pengeluaran</div>
                <div className="font-mono font-bold text-red-900 mt-1">{formatIDR(loc.totalOut)}</div>
              </div>
            </div>

            <div className="text-sm text-slate-500 flex items-center gap-2 border-t border-slate-100 pt-3">
              <Calendar className="h-4 w-4" />
              {loc.count > 0 ? `${loc.count} transaksi · ${formatDate(loc.firstDate)} — ${formatDate(loc.lastDate)}` : "Belum ada transaksi"}
            </div>
          </Card>
        ))}
        {byLocation.length === 0 && <div className="col-span-full text-center text-slate-500 py-12">Belum ada lokasi yang bisa ditampilkan.</div>}
      </div>
    </div>
  );
}
