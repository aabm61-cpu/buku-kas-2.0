import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BookOpen, TrendingUp, TrendingDown, Eye, Undo2 } from "lucide-react";
import { formatIDR, formatDateTime } from "@/lib/format";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

export default function HistoryBukuKas() {
  const { user } = useAuth();
  const canReopen = user.role === "owner" || user.role === "bendahara";
  const [items, setItems] = useState([]);
  const [projects, setProjects] = useState([]);
  const [detailLoc, setDetailLoc] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [preview, setPreview] = useState(null);

  useEffect(() => { load(); }, []);

  const load = () => {
    Promise.all([
      api.get("/bukukas/history").catch(() => ({ data: [] })),
      api.get("/projects").catch(() => ({ data: [] })),
    ]).then(([h, p]) => { setItems(h.data); setProjects(p.data); });
  };

  const reopen = async (loc) => {
    try {
      await api.post(`/bukukas/${loc.id}/reopen`);
      toast.success("Buku kas dikembalikan menjadi aktif. Tim lapangan dapat mengedit kembali.");
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Gagal mengembalikan buku kas");
    }
  };

  const projName = (id) => projects.find(p => p.id === id)?.name || "-";

  const openDetail = async (loc) => {
    setDetailLoc(loc);
    setLoadingEntries(true);
    try {
      const r = await api.get(`/cashbook?location_id=${loc.id}`);
      setEntries(r.data);
    } catch { setEntries([]); }
    setLoadingEntries(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs tracking-widest text-slate-500 mb-2">ARSIP BUKU KAS SELESAI</div>
        <h1 className="font-display font-extrabold text-3xl text-slate-900">Riwayat Buku Kas</h1>
        <p className="text-slate-500 mt-1">Daftar buku kas yang sudah diselesaikan. Klik Lihat Detail untuk membuka pencatatannya.</p>
      </div>

      <Card className="bg-white border-slate-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead>Proyek</TableHead>
              <TableHead>Ditutup</TableHead>
              <TableHead className="text-right">Pemasukan</TableHead>
              <TableHead className="text-right">Pengeluaran</TableHead>
              <TableHead className="text-right">Saldo Akhir</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map(b => {
              const saldo = (b.total_in || 0) - (b.total_out || 0);
              return (
                <TableRow key={b.id} data-testid={`history-row-${b.id}`}>
                  <TableCell className="font-semibold text-slate-900">{projName(b.project_id)}</TableCell>
                  <TableCell className="text-slate-600 text-sm">{formatDateTime(b.closed_at)}</TableCell>
                  <TableCell className="text-right font-mono tabular text-green-700"><TrendingUp className="h-3 w-3 inline mr-1" />{formatIDR(b.total_in)}</TableCell>
                  <TableCell className="text-right font-mono tabular text-red-700"><TrendingDown className="h-3 w-3 inline mr-1" />{formatIDR(b.total_out)}</TableCell>
                  <TableCell className={`text-right font-mono tabular font-bold ${saldo >= 0 ? "text-slate-900" : "text-red-700"}`}>{formatIDR(saldo)}</TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex items-center gap-2">
                      <Button size="sm" variant="outline" className="h-8 rounded-full" onClick={() => openDetail(b)} data-testid={`history-detail-btn-${b.id}`}>
                        <Eye className="h-3.5 w-3.5 mr-1.5" /> Lihat Detail
                      </Button>
                      {canReopen && (
                        <Button size="sm" variant="outline" className="h-8 rounded-full border-orange-500 text-orange-600 hover:bg-orange-50" onClick={() => reopen(b)} data-testid={`history-reopen-btn-${b.id}`}>
                          <Undo2 className="h-3.5 w-3.5 mr-1.5" /> Kembali
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {items.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center py-12 text-slate-500">
                <BookOpen className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                Belum ada buku kas yang diselesaikan.
              </TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!detailLoc} onOpenChange={(v) => !v && setDetailLoc(null)}>
        <DialogContent className="bg-white max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detail Pencatatan — <span className="text-blue-700">{detailLoc ? projName(detailLoc.project_id) : ""}</span></DialogTitle>
          </DialogHeader>
          {loadingEntries ? (
            <div className="text-center text-slate-500 py-8">Memuat…</div>
          ) : (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Tipe</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead>Keterangan</TableHead>
                    <TableHead className="text-right">Nominal</TableHead>
                    <TableHead className="text-center">Nota</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map(e => (
                    <TableRow key={e.id} data-testid={`history-entry-${e.id}`}>
                      <TableCell className="text-sm text-slate-600 whitespace-nowrap">{formatDateTime(e.date)}</TableCell>
                      <TableCell>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${e.type === "pemasukan" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                          {e.type === "pemasukan" ? "MASUK" : "KELUAR"}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">{e.category || "-"}</TableCell>
                      <TableCell className="text-sm text-slate-600 max-w-[220px]">
                        {e.kasbon_user_name ? <span className="font-semibold text-slate-900">{e.kasbon_user_name}</span> : null}
                        {e.kasbon_user_name && e.description ? " — " : ""}{e.description || (e.kasbon_user_name ? "" : "-")}
                      </TableCell>
                      <TableCell className={`text-right font-mono tabular font-semibold ${e.type === "pemasukan" ? "text-green-700" : "text-red-700"}`}>
                        {e.type === "pemasukan" ? "+" : "-"}{formatIDR(e.amount)}
                      </TableCell>
                      <TableCell className="text-center">
                        {e.receipt_base64 ? (
                          <img
                            src={e.receipt_base64}
                            alt="Nota"
                            className="h-10 w-10 object-cover rounded cursor-pointer inline-block border border-slate-200"
                            onClick={() => setPreview(e.receipt_base64)}
                            data-testid={`history-nota-${e.id}`}
                          />
                        ) : <span className="text-xs text-slate-400">-</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                  {entries.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-slate-500 py-8">Tidak ada pencatatan.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!preview} onOpenChange={(v) => !v && setPreview(null)}>
        <DialogContent className="bg-white max-w-3xl">
          <DialogHeader><DialogTitle>Foto Nota</DialogTitle></DialogHeader>
          {preview && <img src={preview} alt="Nota" className="w-full rounded-lg" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
