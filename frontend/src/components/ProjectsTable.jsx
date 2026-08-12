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

  const readOnly = !!project.is_completed;
  const projValue = Number(form.project_value || 0);
  const retPct = Number(form.retention_percent || 0);
  const retValue = projValue * retPct / 100;
  const isSPK = (form.spk_rab_type || "SPK") === "SPK";
  const hasTermin = form.has_termin === "ada";
  const hasRetensi = (form.has_retensi || "ada") === "ada";
  const terminCount = Number(form.termin_count || 0);
  const terminPercents = form.termin_percents || [];

  const setTerminCount = (v) => {
    const n = Number(v);
    const arr = Array.from({ length: n }, (_, i) => Number(terminPercents[i]) || 0);
    setForm({ ...form, termin_count: n, termin_percents: arr });
  };

  const setTerminPct = (i, val) => {
    const arr = [...terminPercents];
    arr[i] = val;
    setForm({ ...form, termin_percents: arr });
  };

  const save = async () => {
    try {
      await api.patch(`/projects/${project.id}/meta`, {
        spk_rab_type: form.spk_rab_type,
        penagihan_status: form.penagihan_status,
        project_value: Number(form.project_value) || 0,
        retention_percent: Number(form.retention_percent) || 0,
        has_retensi: form.has_retensi || "ada",
        has_termin: form.has_termin || "tidak_ada",
        termin_count: Number(form.termin_count) || 0,
        termin_percents: (form.termin_percents || []).map(v => Number(v) || 0),
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
            <div><div className="text-xs text-slate-500 uppercase tracking-wider">Buku Kas Ditutup</div><div className={`font-semibold ${project.cashbook_closed ? "text-green-700" : "text-slate-500"}`}>{project.cashbook_closed ? "Ya" : "Belum"}</div></div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Penagihan</Label>
              <Select disabled={readOnly} value={form.penagihan_status || "belum_dibuat"} onValueChange={v => setForm({ ...form, penagihan_status: v })}>
                <SelectTrigger data-testid="detail-penagihan" className="h-11 mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-white">{PENAGIHAN_OPTS.map(o => <SelectItem key={o.v} value={o.v}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>SPK / RAB</Label>
              <Select disabled={readOnly} value={form.spk_rab_type || "SPK"} onValueChange={v => setForm({ ...form, spk_rab_type: v })}>
                <SelectTrigger data-testid="detail-spk-rab" className="h-11 mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-white">{SPK_RAB_OPTS.map(o => <SelectItem key={o.v} value={o.v}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div className={`grid gap-4 ${isSPK ? "grid-cols-2" : "grid-cols-1"}`}>
            <div>
              <Label>Nilai Proyek (Rp)</Label>
              <Input data-testid="detail-value" type="number" disabled={readOnly} value={form.project_value ?? 0} onChange={e => setForm({ ...form, project_value: e.target.value })} className="h-11 mt-1.5 font-mono tabular" />
              {projValue > 0 && <div className="text-xs text-slate-500 mt-1 font-mono">{formatIDR(projValue)}</div>}
            </div>
            {isSPK && (
              <div>
                <Label>Retensi</Label>
                <Select value={form.has_retensi || "ada"} onValueChange={v => setForm({ ...form, has_retensi: v })}>
                  <SelectTrigger data-testid="detail-has-retensi" className="h-11 mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="ada">Ada</SelectItem>
                    <SelectItem value="tidak_ada">Tidak Ada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {isSPK && (
              <div>
                <Label>Termin</Label>
                <Select disabled={readOnly} value={form.has_termin || "tidak_ada"} onValueChange={v => setForm({ ...form, has_termin: v })}>
                  <SelectTrigger data-testid="detail-has-termin" className="h-11 mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="ada">Ada</SelectItem>
                    <SelectItem value="tidak_ada">Tidak Ada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {isSPK && hasTermin && (
              <div>
                <Label>Jumlah Termin</Label>
                <Select disabled={readOnly} value={terminCount ? String(terminCount) : ""} onValueChange={setTerminCount}>
                  <SelectTrigger data-testid="detail-termin-count" className="h-11 mt-1.5"><SelectValue placeholder="Pilih jumlah termin" /></SelectTrigger>
                  <SelectContent className="bg-white">
                    {[1, 2, 3].map(n => <SelectItem key={n} value={String(n)}>{n} Termin</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {isSPK && hasTermin && terminCount > 0 && (
            <div className="border border-slate-200 rounded-lg overflow-hidden" data-testid="detail-termin-table">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Tahap</TableHead>
                    <TableHead className="w-36">Presentase (%)</TableHead>
                    <TableHead className="text-right">Nilai</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: terminCount }, (_, i) => {
                    const pct = Number(terminPercents[i]) || 0;
                    return (
                      <TableRow key={i}>
                        <TableCell className="font-semibold">Termin {i + 1}</TableCell>
                        <TableCell>
                          <Input data-testid={`detail-termin-pct-${i}`} type="number" step="0.5" min="0" max="100" disabled={readOnly} value={terminPercents[i] ?? 0} onChange={e => setTerminPct(i, e.target.value)} className="h-9 font-mono tabular" />
                        </TableCell>
                        <TableCell className="text-right font-mono tabular font-semibold" data-testid={`detail-termin-nilai-${i}`}>{formatIDR(projValue * pct / 100)}</TableCell>
                      </TableRow>
                    );
                  })}
                  {hasRetensi && (
                    <TableRow className="bg-orange-50/50">
                      <TableCell className="font-semibold text-orange-800">Retensi</TableCell>
                      <TableCell>
                        <Input data-testid="detail-retpct" type="number" step="0.5" min="0" max="100" disabled={readOnly} value={form.retention_percent ?? 0} onChange={e => setForm({ ...form, retention_percent: e.target.value })} className="h-9 font-mono tabular" />
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="inline-flex items-center gap-2 font-mono tabular font-semibold text-orange-700" data-testid="detail-retensi-nilai">
                          {formatIDR(retValue)}
                          {project.retention_paid && <CheckCircle2 className="h-4 w-4 text-green-600" title="Retensi sudah dibayar" />}
                        </span>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          <div>
            <Label>Keterangan</Label>
            <Textarea data-testid="detail-keterangan" disabled={readOnly} value={form.keterangan || ""} onChange={e => setForm({ ...form, keterangan: e.target.value })} className="mt-1.5 min-h-[70px]" placeholder="Catatan tambahan…" />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          {readOnly && <span className="text-xs text-slate-500 self-center mr-auto">Proyek selesai — hanya bisa dilihat.</span>}
          <Button variant="outline" onClick={onClose}>Tutup</Button>
          {!readOnly && <Button data-testid="detail-save-btn" onClick={save} className="bg-blue-700 hover:bg-blue-800">Simpan Perubahan</Button>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ProjectRow({ p, showComplete, canReopen, onDetail, onComplete, onReopen }) {
  const ws = WORK_STATUS[p.work_status] || WORK_STATUS.belum_mulai;
  return (
    <TableRow data-testid={`proj-row-${p.id}`}>
      <TableCell>
        <div className="font-semibold text-slate-900" data-testid={`proj-name-${p.id}`}>{p.name}</div>
        <div className="mt-1">
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${WORK_TYPE_COLOR[p.work_type] || "bg-slate-100 text-slate-700"}`} data-testid={`proj-worktype-${p.id}`}>
            <Briefcase className="h-3 w-3 inline mr-1" />{p.work_type || "-"}
          </span>
        </div>
        {p.work_type === "Maintenance" && p.maintenance_notes && (
          <div className="text-[10px] text-slate-500 font-normal italic mt-1 max-w-[280px] truncate" title={p.maintenance_notes}>{p.maintenance_notes}</div>
        )}
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
          ) : canReopen ? (
            <Button
              size="sm"
              variant="outline"
              className="h-8 rounded-full"
              onClick={() => onReopen(p)}
              data-testid={`proj-reopen-btn-${p.id}`}
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Kembalikan
            </Button>
          ) : null}
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
              <TableHead>Nama Lokasi & Jenis Pekerjaan</TableHead>
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
                canReopen={user.role === "owner"}
                onDetail={openDetail}
                onComplete={markComplete}
                onReopen={reopen}
              />
            ))}
            {list.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-8 text-slate-500">
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
