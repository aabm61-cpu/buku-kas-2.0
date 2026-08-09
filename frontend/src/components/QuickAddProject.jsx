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

const WORK_TYPES = ["Renov", "Return to LL Renov", "Addwork", "Maintenance", "Maintenance Return to LL"];
const emptyForm = { name: "", work_type: "Renov", client_name: "", maintenance_notes: "" };

export default function QuickAddProject({ onCreated }) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const needsNotes = form.work_type === "Maintenance" || form.work_type === "Addwork";
  const isMaintenance = form.work_type === "Maintenance";

  // Auto-uppercase every character typed into any text field
  const upper = (v) => (v || "").toUpperCase();

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Nama HUB/SOC wajib diisi"); return; }
    if (!form.client_name.trim()) { toast.error("Nama Klien wajib diisi"); return; }
    if (isMaintenance && !form.maintenance_notes.trim()) { toast.error("Keterangan pekerjaan Maintenance wajib diisi"); return; }
    setSaving(true);
    try {
      await api.post("/projects", {
        name: upper(form.name).trim(),
        work_type: form.work_type,
        client_name: upper(form.client_name).trim(),
        maintenance_notes: needsNotes ? upper(form.maintenance_notes) : "",
      });
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
        <div className="flex items-center gap-3 mb-5">
          <div className="h-10 w-10 rounded-lg bg-blue-700 text-white flex items-center justify-center"><HardHat className="h-5 w-5" /></div>
          <h2 className="font-display font-bold text-xl text-slate-900">Input Proyek Baru</h2>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Nama HUB/SOC <span className="text-red-500">*</span></Label>
              <Input
                data-testid="quick-project-name-input"
                value={form.name}
                onChange={e => setForm({ ...form, name: upper(e.target.value) })}
                placeholder="MIS. HUB JAKARTA SELATAN"
                className="h-11 mt-1.5 uppercase"
                autoComplete="off"
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
            <div>
              <Label>Nama Klien <span className="text-red-500">*</span></Label>
              <Input
                data-testid="quick-project-client-input"
                value={form.client_name}
                onChange={e => setForm({ ...form, client_name: upper(e.target.value) })}
                placeholder="MIS. PT MITRA JAYA"
                className="h-11 mt-1.5 uppercase"
                autoComplete="off"
                required
              />
            </div>
          </div>

          {needsNotes && (
            <div className={`p-3 rounded-lg border ${isMaintenance ? "bg-green-50 border-green-200" : "bg-orange-50 border-orange-200"}`}>
              <Label className={`flex items-center gap-1.5 ${isMaintenance ? "text-green-800" : "text-orange-800"}`}>
                <Wrench className="h-3.5 w-3.5" /> Keterangan Pekerjaan {form.work_type} {isMaintenance && <span className="text-red-500">*</span>}
              </Label>
              <Textarea
                data-testid="quick-project-maintenance-notes"
                value={form.maintenance_notes}
                onChange={e => setForm({ ...form, maintenance_notes: upper(e.target.value) })}
                placeholder="DETAIL PEKERJAAN: MIS. PERBAIKAN AC, PENGECATAN ULANG, GANTI LAMPU…"
                className="mt-1.5 min-h-[70px] text-sm uppercase"
                required={isMaintenance}
              />
            </div>
          )}

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
