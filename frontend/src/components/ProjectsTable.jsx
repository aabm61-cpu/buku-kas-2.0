import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { formatDate, formatIDR } from "@/lib/format";
import { Briefcase, CheckCircle2 } from "lucide-react";

const WORK_TYPE_COLOR = {
  "Renov": "bg-blue-100 text-blue-700",
  "Return to LL Renov": "bg-purple-100 text-purple-700",
  "Addwork": "bg-orange-100 text-orange-700",
  "Maintenance": "bg-green-100 text-green-700",
  "Maintenance Return to LL": "bg-teal-100 text-teal-700",
};

const SPK_RAB_TYPE = [
  { v: "SPK", label: "SPK", cls: "bg-indigo-100 text-indigo-700" },
  { v: "RAB", label: "RAB", cls: "bg-amber-100 text-amber-800" },
];

const PENAGIHAN_STATUS = [
  { v: "belum_dibuat", label: "Belum Dibuat", cls: "bg-slate-100 text-slate-700" },
  { v: "sudah_dibuat", label: "Sudah Dibuat", cls: "bg-green-100 text-green-700" },
];

function StatusDropdown({ value, options, onChange, testId }) {
  const opt = options.find(o => o.v === value) || options[0];
  return (
    <Select value={value || options[0].v} onValueChange={onChange}>
      <SelectTrigger data-testid={testId} className={`h-8 px-2 py-0 rounded-full border-0 text-xs font-semibold ${opt.cls} focus:ring-2 focus:ring-offset-1 focus:ring-blue-400 w-full min-w-[130px]`}>
        <SelectValue>{opt.label}</SelectValue>
      </SelectTrigger>
      <SelectContent className="bg-white">
        {options.map(o => <SelectItem key={o.v} value={o.v}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

export default function ProjectsTable() {
  const [items, setItems] = useState([]);
  const [drafts, setDrafts] = useState({}); // { projectId: { field: value } }

  const load = () => api.get("/projects").then(r => setItems(r.data));
  useEffect(() => { load(); }, []);

  const patch = async (id, field, value) => {
    setItems(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
    try {
      await api.patch(`/projects/${id}/meta`, { [field]: value });
      toast.success("Tersimpan", { duration: 1000 });
    } catch (e) {
      toast.error("Gagal menyimpan");
      load();
    }
  };

  const getDraft = (id, field, fallback) => drafts[id]?.[field] !== undefined ? drafts[id][field] : fallback;
  const setDraft = (id, field, value) => setDrafts(prev => ({ ...prev, [id]: { ...(prev[id] || {}), [field]: value } }));
  const clearDraft = (id, field) => setDrafts(prev => {
    const next = { ...(prev[id] || {}) };
    delete next[field];
    const out = { ...prev };
    if (Object.keys(next).length) out[id] = next; else delete out[id];
    return out;
  });

  const commitNumber = (id, field, currentValue) => {
    const draft = drafts[id]?.[field];
    if (draft === undefined) return;
    const num = Number(draft);
    if (isNaN(num)) { clearDraft(id, field); return; }
    if (num !== currentValue) patch(id, field, num);
    clearDraft(id, field);
  };

  return (
    <Card className="bg-white border-slate-200 overflow-hidden">
      <div className="p-5 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h3 className="font-display font-bold text-slate-900">Daftar Proyek</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Isi Nilai Proyek & Retensi (%) — Nilai Retensi terhitung otomatis dari kedua nilai tersebut
          </p>
        </div>
        <span className="text-xs text-slate-500">{items.length} proyek</span>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead className="whitespace-nowrap">Nama Lokasi</TableHead>
              <TableHead className="whitespace-nowrap">Jenis Pekerjaan</TableHead>
              <TableHead className="whitespace-nowrap text-right">Nilai Proyek</TableHead>
              <TableHead className="whitespace-nowrap">Start Proyek</TableHead>
              <TableHead className="whitespace-nowrap">Tanggal Selesai</TableHead>
              <TableHead className="whitespace-nowrap">SPK / RAB</TableHead>
              <TableHead className="whitespace-nowrap">Penagihan</TableHead>
              <TableHead className="whitespace-nowrap text-right">Retensi (%)</TableHead>
              <TableHead className="whitespace-nowrap text-right">Nilai Retensi</TableHead>
              <TableHead className="whitespace-nowrap min-w-[180px]">Keterangan</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map(p => {
              const projValue = Number(p.project_value || 0);
              const retPct = Number(p.retention_percent || 0);
              const retValue = projValue * retPct / 100;
              return (
                <TableRow key={p.id} data-testid={`proj-row-${p.id}`}>
                  <TableCell className="font-semibold text-slate-900 whitespace-nowrap">
                    {p.name}
                    {p.work_type === "Maintenance" && p.maintenance_notes && (
                      <div className="text-[10px] text-slate-500 font-normal italic mt-0.5 max-w-[200px] truncate" title={p.maintenance_notes}>{p.maintenance_notes}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${WORK_TYPE_COLOR[p.work_type] || "bg-slate-100 text-slate-700"}`}>
                      <Briefcase className="h-3 w-3 inline mr-1" />{p.work_type || "-"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none">Rp</span>
                      <Input
                        data-testid={`proj-value-${p.id}`}
                        type="number"
                        value={getDraft(p.id, "project_value", projValue)}
                        onChange={e => setDraft(p.id, "project_value", e.target.value)}
                        onBlur={() => commitNumber(p.id, "project_value", projValue)}
                        className="h-8 w-[150px] text-xs text-right pl-7 font-mono tabular"
                      />
                    </div>
                    {projValue > 0 && drafts[p.id]?.project_value === undefined && (
                      <div className="text-[10px] text-slate-500 mt-0.5 font-mono tabular">{formatIDR(projValue)}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-slate-600 whitespace-nowrap">
                    {p.start_date ? formatDate(p.start_date) : <span className="text-slate-400 italic">Belum ada</span>}
                  </TableCell>
                  <TableCell>
                    <Input
                      data-testid={`proj-enddate-${p.id}`}
                      type="date"
                      value={p.end_date ? p.end_date.slice(0, 10) : ""}
                      onChange={e => patch(p.id, "end_date", e.target.value)}
                      className="h-8 w-[145px] text-xs"
                    />
                  </TableCell>
                  <TableCell>
                    <StatusDropdown testId={`proj-spk-rab-type-${p.id}`} value={p.spk_rab_type} options={SPK_RAB_TYPE} onChange={(v) => patch(p.id, "spk_rab_type", v)} />
                  </TableCell>
                  <TableCell>
                    <StatusDropdown testId={`proj-penagihan-status-${p.id}`} value={p.penagihan_status} options={PENAGIHAN_STATUS} onChange={(v) => patch(p.id, "penagihan_status", v)} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="relative">
                      <Input
                        data-testid={`proj-retpct-${p.id}`}
                        type="number"
                        step="0.5"
                        min="0"
                        max="100"
                        value={getDraft(p.id, "retention_percent", retPct)}
                        onChange={e => setDraft(p.id, "retention_percent", e.target.value)}
                        onBlur={() => commitNumber(p.id, "retention_percent", retPct)}
                        className="h-8 w-[80px] text-xs text-right pr-6 font-mono tabular"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none">%</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {p.retention_paid && <CheckCircle2 className="h-3.5 w-3.5 text-green-600" title="Retensi sudah dibayar" />}
                      <span className={`font-mono tabular text-sm font-semibold ${retValue > 0 ? (p.retention_paid ? "text-slate-400 line-through" : "text-orange-700") : "text-slate-400"}`}>
                        {formatIDR(retValue)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Input
                      data-testid={`proj-ket-${p.id}`}
                      value={getDraft(p.id, "keterangan", p.keterangan || "")}
                      onChange={e => setDraft(p.id, "keterangan", e.target.value)}
                      onBlur={() => {
                        const draft = drafts[p.id]?.keterangan;
                        if (draft !== undefined && draft !== (p.keterangan || "")) patch(p.id, "keterangan", draft);
                        clearDraft(p.id, "keterangan");
                      }}
                      placeholder="Catatan…"
                      className="h-8 text-xs min-w-[160px]"
                    />
                  </TableCell>
                </TableRow>
              );
            })}
            {items.length === 0 && (
              <TableRow><TableCell colSpan={10} className="text-center py-8 text-slate-500">Belum ada proyek. Input yang pertama di form Dashboard.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
