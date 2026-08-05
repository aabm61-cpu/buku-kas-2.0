import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import { Briefcase } from "lucide-react";

const WORK_TYPE_COLOR = {
  "Renov": "bg-blue-100 text-blue-700",
  "Return to LL Renov": "bg-purple-100 text-purple-700",
  "Addwork": "bg-orange-100 text-orange-700",
  "Maintenance": "bg-green-100 text-green-700",
  "Maintenance Return to LL": "bg-teal-100 text-teal-700",
};

const STATUS_PENAGIHAN = [
  { v: "belum_ditagih", label: "Belum Ditagih", cls: "bg-slate-100 text-slate-700" },
  { v: "proses", label: "Proses", cls: "bg-blue-100 text-blue-700" },
  { v: "terbayar_sebagian", label: "Terbayar Sebagian", cls: "bg-orange-100 text-orange-700" },
  { v: "lunas", label: "Lunas", cls: "bg-green-100 text-green-700" },
];

const SPK_RAB = [
  { v: "belum", label: "Belum", cls: "bg-slate-100 text-slate-700" },
  { v: "draft", label: "Draft", cls: "bg-yellow-100 text-yellow-800" },
  { v: "dikirim", label: "Dikirim", cls: "bg-blue-100 text-blue-700" },
  { v: "disetujui", label: "Disetujui", cls: "bg-green-100 text-green-700" },
];

const RETENSI = [
  { v: "tidak_ada", label: "Tidak Ada", cls: "bg-slate-100 text-slate-700" },
  { v: "ditahan", label: "Ditahan", cls: "bg-orange-100 text-orange-700" },
  { v: "dikembalikan", label: "Dikembalikan", cls: "bg-green-100 text-green-700" },
];

const PAYMENT_RETENSI = [
  { v: "belum", label: "Belum", cls: "bg-slate-100 text-slate-700" },
  { v: "sebagian", label: "Sebagian", cls: "bg-orange-100 text-orange-700" },
  { v: "lunas", label: "Lunas", cls: "bg-green-100 text-green-700" },
];

function StatusDropdown({ value, options, onChange, testId }) {
  const opt = options.find(o => o.v === value) || options[0];
  return (
    <Select value={value || options[0].v} onValueChange={onChange}>
      <SelectTrigger
        data-testid={testId}
        className={`h-8 px-2 py-0 rounded-full border-0 text-xs font-semibold ${opt.cls} focus:ring-2 focus:ring-offset-1 focus:ring-blue-400 w-full min-w-[130px]`}
      >
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
  const [editingKet, setEditingKet] = useState({}); // { projectId: string }

  const load = () => api.get("/projects").then(r => setItems(r.data));
  useEffect(() => { load(); }, []);

  const patch = async (id, field, value) => {
    // optimistic
    setItems(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
    try {
      await api.patch(`/projects/${id}/meta`, { [field]: value });
      toast.success("Tersimpan", { duration: 1200 });
    } catch (e) {
      toast.error("Gagal menyimpan");
      load();
    }
  };

  return (
    <Card className="bg-white border-slate-200 overflow-hidden">
      <div className="p-5 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h3 className="font-display font-bold text-slate-900">Daftar Proyek</h3>
          <p className="text-xs text-slate-500 mt-0.5">Semua kolom dropdown dapat diubah langsung dari tabel</p>
        </div>
        <span className="text-xs text-slate-500">{items.length} proyek</span>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead className="whitespace-nowrap">Nama Lokasi</TableHead>
              <TableHead className="whitespace-nowrap">Jenis Pekerjaan</TableHead>
              <TableHead className="whitespace-nowrap">Start Proyek</TableHead>
              <TableHead className="whitespace-nowrap">Tanggal Selesai</TableHead>
              <TableHead className="whitespace-nowrap">Status Penagihan</TableHead>
              <TableHead className="whitespace-nowrap">SPK/RAB</TableHead>
              <TableHead className="whitespace-nowrap">Retensi</TableHead>
              <TableHead className="whitespace-nowrap">Payment Retensi</TableHead>
              <TableHead className="whitespace-nowrap min-w-[200px]">Keterangan</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map(p => (
              <TableRow key={p.id} data-testid={`proj-row-${p.id}`}>
                <TableCell className="font-semibold text-slate-900 whitespace-nowrap">{p.name}</TableCell>
                <TableCell><span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${WORK_TYPE_COLOR[p.work_type] || "bg-slate-100 text-slate-700"}`}><Briefcase className="h-3 w-3 inline mr-1" />{p.work_type || "-"}</span></TableCell>
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
                  <StatusDropdown testId={`proj-status-penagihan-${p.id}`} value={p.status_penagihan} options={STATUS_PENAGIHAN} onChange={(v) => patch(p.id, "status_penagihan", v)} />
                </TableCell>
                <TableCell>
                  <StatusDropdown testId={`proj-spk-${p.id}`} value={p.spk_rab} options={SPK_RAB} onChange={(v) => patch(p.id, "spk_rab", v)} />
                </TableCell>
                <TableCell>
                  <StatusDropdown testId={`proj-retensi-${p.id}`} value={p.retensi} options={RETENSI} onChange={(v) => patch(p.id, "retensi", v)} />
                </TableCell>
                <TableCell>
                  <StatusDropdown testId={`proj-pay-retensi-${p.id}`} value={p.payment_retensi} options={PAYMENT_RETENSI} onChange={(v) => patch(p.id, "payment_retensi", v)} />
                </TableCell>
                <TableCell>
                  <Input
                    data-testid={`proj-ket-${p.id}`}
                    value={editingKet[p.id] !== undefined ? editingKet[p.id] : (p.keterangan || "")}
                    onChange={e => setEditingKet({ ...editingKet, [p.id]: e.target.value })}
                    onBlur={() => {
                      if (editingKet[p.id] !== undefined && editingKet[p.id] !== (p.keterangan || "")) {
                        patch(p.id, "keterangan", editingKet[p.id]);
                      }
                      const { [p.id]: _, ...rest } = editingKet;
                      setEditingKet(rest);
                    }}
                    placeholder="Catatan…"
                    className="h-8 text-xs min-w-[180px]"
                  />
                </TableCell>
              </TableRow>
            ))}
            {items.length === 0 && (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-slate-500">Belum ada proyek. Input yang pertama di form di atas.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
