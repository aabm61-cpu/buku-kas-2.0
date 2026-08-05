import React, { useState } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, HardHat, Wrench } from "lucide-react";
import { formatIDR } from "@/lib/format";

const WORK_TYPES = ["Renov", "Return to LL Renov", "Addwork", "Maintenance", "Maintenance Return to LL"];
const emptyForm = { name: "", work_type: "Renov", client_name: "", project_value: "", retention_percent: 5, maintenance_notes: "" };

export default function QuickAddProject({ onCreated }) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const isMaintenance = form.work_type === "Maintenance";
  const projectValue = Number(form.project_value || 0);
  const retensiPct = Number(form.retention_percent || 0);
  const retensiValue = projectValue * retensiPct / 100;

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Nama HUB/SOC wajib diisi"); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        work_type: form.work_type,
        client_name: form.client_name,
        project_value: Number(form.project_value) || 0,
        retention_percent: Number(form.retention_percent) || 0,
        maintenance_notes: isMaintenance ? form.maintenance_notes : "",
      };
      await api.post("/projects", payload);
      toast.success("Proyek berhasil dibuat");
      setForm(emptyForm);
      onCreated?.();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Gagal menyimpan");
    } finally { setSaving(false); }
  };

  return (
    <Card className="p-6 bg-white border-slate-200 relative overflow-hidden">
      <div className="absolute top-0 right-0 h-32 w-32 bg-orange-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
      <div className="relative">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-lg bg-blue-700 text-white flex items-center justify-center"><HardHat className="h-5 w-5" /></div>
          <div>
            <div className="text-xs tracking-widest text-slate-500">FORM CEPAT</div>
            <h2 className="font-display font-bold text-xl text-slate-900">Input Proyek Baru</h2>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Nama HUB/SOC <span className="text-red-500">*</span></Label>
              <Input
                data-testid="quick-project-name-input"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="mis. HUB Jakarta Selatan / SOC Bekasi"
                className="h-11 mt-1.5"
                required
              />
            </div>
            <div>
              <Label>Jenis Pekerjaan <span className="text-red-500">*</span></Label>
              <Select value={form.work_type} onValueChange={v => setForm({ ...form, work_type: v })}>
                <SelectTrigger data-testid="quick-project-worktype-select" className="h-11 mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-white">
                  {WORK_TYPES.map(w => <SelectItem key={w} value={w}>{w}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isMaintenance && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <Label className="flex items-center gap-1.5 text-green-800"><Wrench className="h-3.5 w-3.5" /> Keterangan Pekerjaan Maintenance</Label>
              <Textarea
                data-testid="quick-project-maintenance-notes"
                value={form.maintenance_notes}
                onChange={e => setForm({ ...form, maintenance_notes: e.target.value })}
                placeholder="Detail pekerjaan maintenance: mis. perbaikan AC, pengecatan ulang, ganti lampu…"
                className="mt-1.5 min-h-[70px] text-sm"
              />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Nama Klien (opsional)</Label>
              <Input
                data-testid="quick-project-client-input"
                value={form.client_name}
                onChange={e => setForm({ ...form, client_name: e.target.value })}
                placeholder="Nama klien"
                className="h-11 mt-1.5"
              />
            </div>
            <div>
              <Label>Nilai Proyek (Rp)</Label>
              <Input
                data-testid="quick-project-value-input"
                type="number"
                value={form.project_value}
                onChange={e => setForm({ ...form, project_value: e.target.value })}
                placeholder="0"
                className="h-11 mt-1.5 font-mono tabular"
              />
              {projectValue > 0 && <div className="text-xs text-slate-500 mt-1 font-mono tabular">{formatIDR(projectValue)}</div>}
            </div>
            <div>
              <Label>Retensi (%)</Label>
              <div className="relative mt-1.5">
                <Input
                  data-testid="quick-project-retpct-input"
                  type="number"
                  step="0.5"
                  min="0"
                  max="100"
                  value={form.retention_percent}
                  onChange={e => setForm({ ...form, retention_percent: e.target.value })}
                  className="h-11 pr-8 font-mono tabular"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
              </div>
              {retensiValue > 0 && <div className="text-xs text-orange-700 mt-1 font-mono tabular font-semibold">= {formatIDR(retensiValue)}</div>}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              data-testid="quick-project-submit-btn"
              disabled={saving}
              className="rounded-full bg-blue-700 hover:bg-blue-800 h-11 px-8 font-semibold"
            >
              <Plus className="h-4 w-4 mr-2" /> {saving ? "Menyimpan…" : "Simpan Proyek"}
            </Button>
          </div>
        </form>
      </div>
    </Card>
  );
}
