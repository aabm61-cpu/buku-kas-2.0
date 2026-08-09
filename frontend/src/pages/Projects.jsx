import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { formatDate, formatIDR } from "@/lib/format";
import { Briefcase, FolderKanban, Building2 } from "lucide-react";
import QuickAddProject from "@/components/QuickAddProject";
import ProjectsTable from "@/components/ProjectsTable";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

const workTypeColor = {
  "Renov": "bg-blue-100 text-blue-700",
  "Return to LL Renov": "bg-purple-100 text-purple-700",
  "Addwork": "bg-orange-100 text-orange-700",
  "Maintenance": "bg-green-100 text-green-700",
  "Maintenance Return to LL": "bg-teal-100 text-teal-700",
};

const statusStyle = { aktif: "bg-green-100 text-green-700", selesai: "bg-slate-100 text-slate-700", ditunda: "bg-orange-100 text-orange-700" };

export default function Projects() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [tableKey, setTableKey] = useState(0);
  const load = () => api.get("/projects").then(r => setItems(r.data));
  useEffect(() => { load(); }, []);

  if (user.role === "owner" || user.role === "penagihan") {
    return (
      <div className="space-y-6">
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <div className="text-xs tracking-widest text-slate-500 mb-2">PORTOFOLIO</div>
            <h1 className="font-display font-extrabold text-3xl text-slate-900">Proyek</h1>
            <p className="text-slate-500 mt-1">Daftar HUB/SOC — nilai proyek, retensi, penagihan & keterangan bisa diubah langsung dari tabel.</p>
          </div>
          <Button
            data-testid="projects-add-btn"
            onClick={() => setShowAdd(v => !v)}
            className="rounded-full bg-blue-700 hover:bg-blue-800"
          >
            <Plus className="h-4 w-4 mr-2" /> Input Proyek Baru
          </Button>
        </div>
        {showAdd && (
          <QuickAddProject onCreated={() => { setShowAdd(false); setTableKey(k => k + 1); }} />
        )}
        <ProjectsTable key={tableKey} />
      </div>
    );
  }

  // Tim / Bendahara: read-only card grid
  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs tracking-widest text-slate-500 mb-2">PORTOFOLIO</div>
        <h1 className="font-display font-extrabold text-3xl text-slate-900">Proyek</h1>
        <p className="text-slate-500 mt-1">Daftar HUB/SOC yang dikelola perusahaan.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map(p => (
          <Card key={p.id} className="p-5 card-lift bg-white border-slate-200" data-testid={`project-card-${p.id}`}>
            <div className="flex items-start justify-between mb-3">
              <div className="h-10 w-10 rounded-md bg-blue-50 text-blue-700 flex items-center justify-center"><FolderKanban className="h-5 w-5" /></div>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusStyle[p.status]}`}>{p.status?.toUpperCase()}</span>
            </div>
            <h3 className="font-display font-bold text-lg text-slate-900">{p.name}</h3>
            {p.work_type && (
              <div className="mt-2 inline-flex items-center gap-1.5">
                <Briefcase className="h-3.5 w-3.5 text-slate-400" />
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${workTypeColor[p.work_type] || "bg-slate-100 text-slate-700"}`}>{p.work_type}</span>
              </div>
            )}
            {p.client_name && <div className="text-sm text-slate-500 mt-3 flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" /> {p.client_name}</div>}
            {p.project_value > 0 && <div className="text-sm font-mono tabular font-semibold text-slate-900 mt-2">{formatIDR(p.project_value)}</div>}
            <div className="text-xs text-slate-400 mt-4">{formatDate(p.created_at)}</div>
          </Card>
        ))}
        {items.length === 0 && <div className="col-span-full text-center text-slate-500 py-12">Belum ada proyek.</div>}
      </div>
    </div>
  );
}
