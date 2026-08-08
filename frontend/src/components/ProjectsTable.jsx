import React, { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { formatIDR } from "@/lib/format";
import { Briefcase, CheckCircle2, Eye, Archive, RotateCcw, Lock, Unlock } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const WORK_TYPE_COLOR = {
  "Renov": "bg-blue-100 text-blue-700",
  "Return to LL Renov": "bg-purple-100 text-purple-700",
  "Addwork": "bg-orange-100 text-orange-700",
  "Maintenance": "bg-green-100 text-green-700",
  "Maintenance Return to LL": "bg-teal-100 text-teal-700",
};

const SPK_RAB_OPTS = [
  { v: "SPK", label: "SPK" },
  { v: "RAB", label: "RAB" },
];

const PENAGIHAN_OPTS = [
  { v: "belum_dibuat", label: "Belum Dibuat" },
  { v: "sudah_dibuat", label: "Sudah Dibuat" },
];

const WORK_STATUS = {
  belum_mulai: { label: "Belum Mulai", cls: "bg-red-100 text-red-700 border border-red-200", dot: "bg-red-500" },
  sedang_berlangsung: { label: "Sedang Berlangsung", cls: "bg-yellow-100 text-yellow-800 border border-yellow-200", dot: "bg-yellow-500 animate-pulse" },
  selesai: { label: "Selesai", cls: "bg-green-100 text-green-700 border border-green-200", dot: "bg-green-500" },
};

function DetailDialog({ project, open, onClose, onSaved }) {
  const [form, setForm] = useState(project || {});
  useEffect(() => { setForm(project || {}); }, [project]);
  if (!project) return null;

  const projValue = Number(form.project_value || 0);
  const retPct = Number(form.retention_percent || 0);
  const retValue = projValue * retPct / 100;
  const isSPK = (form.spk_rab_type || "SPK") === "SPK";

  const save = async () => {
    try {
      await api.patch(`/projects/${project.id}/meta`, {
        spk_rab_type: form.spk_rab_type,
        penagihan_status: form.penagihan_status,
        project_value: Number(form.project_value) || 0,
        retention_percent: Number(form.retention_percent) || 0,
        keterangan: form.keterangan || "",
        end_date: form.end_date || null,
      });
      toast.success("Perubahan tersimpan");
      onSaved?.();
      onClose();
    } catch (e) {
      toast.error("Gagal menyimpan");
    }
  };

  const ws = WORK_STATUS[project.work_status] || WORK_STATUS.belum_mulai;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-white max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>{project.name}</span>
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${WORK_TYPE_COLOR[project.work_type] || "bg-slate-100 text-slate-700"}`}>{project.work_type}</span>
            <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${ws.cls}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${ws.dot}`} />{ws.label}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {project.work_type === "Maintenance" && project.maintenance_notes && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="text-xs font-semibold text-green-800 mb-1">Keterangan Pekerjaan Maintenance</div>
              <div className="text-sm text-slate-700">{project.maintenance_notes}</div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><div className="text-xs text-slate-500 uppercase tracking-wider">Klien</div><div className="font-semibold text-slate-900">{project.client_name || "-"}</div></div>
            <div><div className="text-xs text-slate-500 uppercase tracking-wider">Tanggal Dibuat</div><div className="font-semibold text-slate-900">{project.created_at ? new Date(project.created_at).toLocaleDateString("id-ID") : "-"}</div></div>
            <div><div className="text-xs text-slate-500 uppercase tracking-wider">Jumlah Pencatatan Buku Kas</div><div className="font-semibold text-slate-900">{project.cashbook_count || 0} entri</div></div>
            <div><div className="text-xs text-slate-500 uppercase tracking-wider">Buku Kas Ditutup</div><div className={`font-semibold ${project.cashbook_closed ? "text-green-700" : "text-slate-500"}`}>{project.cashbook_closed ? "Ya" : "Belum"}</div></div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>SPK / RAB</Label>
              <Select value={form.spk_rab_type || "SPK"} onValueChange={v => setForm({ ...form, spk_rab_type: v })}>
                <SelectTrigger data-testid="detail-spk-rab" className="h-11 mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-white">{SPK_RAB_OPTS.map(o => <SelectItem key={o.v} value={o.v}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Penagihan</Label>
              <Select value={form.penagihan_status || "belum_dibuat"} onValueChange={v => setForm({ ...form, penagihan_status: v })}>
                <SelectTrigger data-testid="detail-penagihan" className="h-11 mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-white">{PENAGIHAN_OPTS.map(o => <SelectItem key={o.v} value={o.v}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div className={`grid gap-4 ${isSPK ? "grid-cols-3" : "grid-cols-1"}`}>
            <div>
              <Label>Nilai Proyek (Rp)</Label>
              <Input data-testid="detail-value" type="number" value={form.project_value ?? 0} onChange={e => setForm({ ...form, project_value: e.target.value })} className="h-11 mt-1.5 font-mono tabular" />
              {projValue > 0 && <div className="text-xs text-slate-500 mt-1 font-mono">{formatIDR(projValue)}</div>}
            </div>
            {isSPK && (
              <>
                <div>
                  <Label>Retensi (%)</Label>
                  <Input data-testid="detail-retpct" type="number" step="0.5" min="0" max="100" value={form.retention_percent ?? 0} onChange={e => setForm({ ...form, retention_percent: e.target.value })} className="h-11 mt-1.5 font-mono tabular" />
                </div>
                <div>
                  <Label>Nilai Retensi</Label>
                  <div className="h-11 mt-1.5 flex items-center justify-between px-3 rounded-md bg-slate-50 border border-slate-200">
                    <span className="font-mono tabular font-semibold text-orange-700">{formatIDR(retValue)}</span>
                    {project.retention_paid && <CheckCircle2 className="h-4 w-4 text-green-600" title="Retensi sudah dibayar" />}
                  </div>
                </div>
              </>
            )}
          </div>

          <div>
            <Label>Keterangan</Label>
            <Textarea data-testid="detail-keterangan" value={form.keterangan || ""} onChange={e => setForm({ ...form, keterangan: e.target.value })} className="mt-1.5 min-h-[70px]" placeholder="Catatan tambahan…" />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <Button variant="outline" onClick={onClose}>Tutup</Button>
          <Button data-testid="detail-save-btn" onClick={save} className="bg-blue-700 hover:bg-blue-800">Simpan Perubahan</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ProjectRow({ p, showComplete, onDetail, onComplete, onReopen }) {
  const ws = WORK_STATUS[p.work_status] || WORK_STATUS.belum_mulai;
  return (
    <TableRow data-testid={`proj-row-${p.id}`}>
      <TableCell className="font-semibold text-slate-900">
        {p.name}
        {p.work_type === "Maintenance" && p.maintenance_notes && (
          <div className="text-[10px] text-slate-500 font-normal italic mt-0.5 max-w-[280px] truncate" title={p.maintenance_notes}>{p.maintenance_notes}</div>
        )}
      </TableCell>
      <TableCell>
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${WORK_TYPE_COLOR[p.work_type] || "bg-slate-100 text-slate-700"}`}>
          <Briefcase className="h-3 w-3 inline mr-1" />{p.work_type || "-"}
        </span>
      </TableCell>
      <TableCell>
        <span
          className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${ws.cls}`}
          data-testid={`proj-work-status-${p.id}`}
          title={`${p.cashbook_count || 0} pencatatan buku kas`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${ws.dot}`} />
          {ws.label}
        </span>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8 rounded-full"
            onClick={() => onDetail(p)}
            data-testid={`proj-detail-btn-${p.id}`}
          >
            <Eye className="h-3.5 w-3.5 mr-1.5" /> Detail
          </Button>
          {showComplete ? (
            <Button
              size="sm"
              className="h-8 rounded-full bg-green-600 hover:bg-green-700 text-white"
              onClick={() => onComplete(p)}
              data-testid={`proj-complete-btn-${p.id}`}
            >
              <Archive className="h-3.5 w-3.5 mr-1.5" /> Selesai
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="h-8 rounded-full"
              onClick={() => onReopen(p)}
              data-testid={`proj-reopen-btn-${p.id}`}
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Kembalikan
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

export default function ProjectsTable() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailProject, setDetailProject] = useState(null);

  const load = () => api.get("/projects").then(r => setItems(r.data));
  useEffect(() => { load(); }, []);

  const berjalan = useMemo(() => items.filter(p => !p.is_completed), [items]);
  const selesai = useMemo(() => items.filter(p => p.is_completed), [items]);

  const openDetail = (p) => { setDetailProject(p); setDetailOpen(true); };

  const markComplete = async (p) => {
    try {
      await api.patch(`/projects/${p.id}/meta`, { is_completed: true });
      toast.success(`Proyek "${p.name}" dipindahkan ke Proyek Selesai`);
      load();
    } catch { toast.error("Gagal memindahkan"); }
  };

  const reopen = async (p) => {
    try {
      await api.patch(`/projects/${p.id}/meta`, { is_completed: false });
      toast.success(`Proyek "${p.name}" dikembalikan ke Proyek Berjalan`);
      load();
    } catch { toast.error("Gagal mengembalikan"); }
  };

  const renderTable = (list, showComplete) => (
    <Card className="bg-white border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead>Nama Lokasi</TableHead>
              <TableHead>Jenis Pekerjaan</TableHead>
              <TableHead>Status Pekerjaan</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map(p => (
              <ProjectRow
                key={p.id}
                p={p}
                showComplete={showComplete}
                onDetail={openDetail}
                onComplete={markComplete}
                onReopen={reopen}
              />
            ))}
            {list.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-slate-500">
                  {showComplete ? "Belum ada proyek berjalan." : "Belum ada proyek selesai."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );

  return (
    <div className="space-y-4">
      <Tabs defaultValue="berjalan">
        <TabsList data-testid="projects-tabs" className="bg-slate-100">
          <TabsTrigger value="berjalan" data-testid="tab-berjalan" className="data-[state=active]:bg-white">
            Proyek Berjalan <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">{berjalan.length}</span>
          </TabsTrigger>
          <TabsTrigger value="selesai" data-testid="tab-selesai" className="data-[state=active]:bg-white">
            Proyek Selesai <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">{selesai.length}</span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="berjalan" className="mt-4">{renderTable(berjalan, true)}</TabsContent>
        <TabsContent value="selesai" className="mt-4">{renderTable(selesai, false)}</TabsContent>
      </Tabs>

      <DetailDialog
        project={detailProject}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onSaved={load}
      />
    </div>
  );
}
