import React, { useState } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";

const formatDetail = (d) => {
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map(e => e?.msg || "").filter(Boolean).join(" ");
  return "Gagal mengubah password";
};

const emptyForm = { current_password: "", new_password: "", confirm_password: "" };

export const ChangePasswordDialog = ({ open, onOpenChange }) => {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const close = (v) => { onOpenChange(v); if (!v) setForm(emptyForm); };

  const submit = async () => {
    if (!form.current_password || !form.new_password) { toast.error("Semua field wajib diisi"); return; }
    if (form.new_password.length < 6) { toast.error("Password baru minimal 6 karakter"); return; }
    if (form.new_password !== form.confirm_password) { toast.error("Konfirmasi password tidak sama"); return; }
    setSaving(true);
    try {
      await api.post("/auth/change-password", {
        current_password: form.current_password,
        new_password: form.new_password,
      });
      toast.success("Password berhasil diubah");
      close(false);
    } catch (e) {
      toast.error(formatDetail(e.response?.data?.detail));
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="bg-white max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-blue-700" /> Ubah Password</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Password Saat Ini</Label>
            <Input data-testid="changepw-current" type="password" value={form.current_password} onChange={e => setForm({ ...form, current_password: e.target.value })} className="h-11 mt-1.5" autoComplete="current-password" />
          </div>
          <div>
            <Label>Password Baru</Label>
            <Input data-testid="changepw-new" type="password" value={form.new_password} onChange={e => setForm({ ...form, new_password: e.target.value })} className="h-11 mt-1.5" autoComplete="new-password" />
          </div>
          <div>
            <Label>Konfirmasi Password Baru</Label>
            <Input data-testid="changepw-confirm" type="password" value={form.confirm_password} onChange={e => setForm({ ...form, confirm_password: e.target.value })} className="h-11 mt-1.5" autoComplete="new-password" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)}>Batal</Button>
          <Button data-testid="changepw-submit" onClick={submit} disabled={saving} className="bg-blue-700 hover:bg-blue-800">{saving ? "Menyimpan…" : "Simpan Password"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
