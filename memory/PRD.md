# PRD - Aplikasi Akuntansi Renovasi

## Problem Statement (Original)
Buat aplikasi akuntansi untuk perusahaan renovasi dengan 4 peran user. Owner: membuat dan mengelola akun semua user, serta melihat seluruh aktivitas di aplikasi. Penagihan: mengelola tagihan ke klien per proyek. Bendahara: mengelola data buku kas dari tim lapangan, menghitung bayaran setiap tim per lokasi, dan menentukan PIC di setiap lokasi. User Tim: mencatat buku kas pemasukan dan pengeluaran operasional, setiap pencatatan wajib menyertakan foto nota sebagai bukti, mencatat kasbon tim, dapat menambahkan anggota tim lain, dan dapat melihat history tempat pengerjaan mereka.

## User Choices
- Auth: Admin creates all accounts, **username-based (no email)**
- Photo storage: **Base64 in MongoDB** (compressed client-side to ~1200px)
- Currency: **IDR**
- Language: **Bahasa Indonesia**
- Extra: Export CSV/PDF, invoice due-date reminder

## Architecture
- **Backend**: FastAPI + Motor + MongoDB (`renovasi_akuntansi` DB). JWT + bcrypt. All routes under `/api`.
- **Frontend**: React 19 + React Router 7 + Tailwind + Shadcn UI. Manrope + IBM Plex Sans fonts. Blueprint Blue (#1d4ed8) + Safety Orange (#f97316) palette.
- **Auth**: Bearer JWT in `Authorization` header (localStorage on client).

## Personas & Access
| Role | Access |
|---|---|
| Owner | Everything. User CRUD, project mgmt, activity log. |
| Penagihan | Tagihan CRUD per project, view projects |
| Bendahara | All locations & cashbook, PIC assignment, team-payment calculator |
| Tim (Field) | Only assigned locations. Records cashbook (mandatory receipt photo) & kasbon. Adds teammates. Views location history. |

## Implemented (v1 — Feb 2026)
- [x] JWT username-based auth, seeded owner `aabm61@gmail.com` / `admin123`
- [x] Users CRUD (Owner only)
- [x] Projects CRUD (owner, penagihan write)
- [x] Locations CRUD with PIC assignment (owner, bendahara)
- [x] Team assignments per location with `daily_rate`
- [x] Cash Book (pemasukan/pengeluaran) with **mandatory base64 receipt photo**
- [x] Kasbon with pending/lunas status
- [x] Tagihan (invoices) with items, auto-computed total, payment recording, auto-mark jatuh_tempo, overdue alert
- [x] Team Payment calculator (days × rate + bonus − kasbon)
- [x] Activity log (owner)
- [x] Role-based routes & data isolation (tim scoped to assigned locations)
- [x] Dashboard stats scoped per role
- [x] Export CSV for tagihan, cashbook, team-payments
- [x] Responsive layout with mobile hamburger sidebar
- [x] Photo capture via camera or file upload, client-side JPEG compression
- [x] History Lokasi rework (7 Feb 2026): sourced from CLOSED buku kas via `/api/bukukas/history`, shows project name + tanggal pekerjaan selesai (`closed_at`), sorted newest first, month filter (`data-testid=history-month-filter`)
- [x] SPK/RAB retensi rework (8 Feb 2026): Retensi fields in project detail dialog hidden when RAB, visible when SPK. Tagihan Baru form no longer has retensi %, retensi due date fields. Backend `POST /api/tagihan` uses each project's own `retention_percent` (SPK only) to auto-split into 2 invoices (main + `-RET`, due +90 days). RAB projects never generate retensi invoice.
- [x] Detail proyek: posisi kolom Penagihan & SPK/RAB ditukar (8 Feb 2026) — Penagihan kiri, SPK/RAB kanan
- [x] Termin SPK (8 Feb 2026): jika SPK dipilih, muncul select Termin (1/2/3). Tabel termin (Presentase manual + Nilai otomatis dari % × nilai proyek) + baris Retensi di bawah (terikat ke `retention_percent`). Disimpan via `termin_count` & `termin_percents` di `PATCH /api/projects/{id}/meta`.
- [x] Dropdown Termin Ada/Tidak Ada (8 Feb 2026): field `has_termin` terpisah (Ada/Tidak Ada). "Ada" → tampil select Jumlah Termin + tabel termin; "Tidak Ada" → tabel tersembunyi. Persisted di project meta.
- [x] Dropdown Retensi Ada/Tidak Ada (8 Feb 2026): field `has_retensi` terpisah (default "ada"). "Ada" → baris Retensi tampil di tabel termin; "Tidak Ada" → baris tersembunyi DAN backend `POST /api/tagihan` + preview frontend tidak membuat tagihan retensi untuk proyek tsb.
- [x] Form Tagihan Baru rework (8 Feb 2026): pilihan proyek dari PROYEK SELESAI (`is_completed`) beserta nominal. Proyek ber-termin → checkbox per termin (nominal = % × nilai proyek); proyek ber-retensi → checkbox Retensi opsional. Multi proyek & multi termin dalam 1 tagihan. Backend: TIDAK ada lagi auto-split invoice retensi (-RET); retensi kini item eksplisit (`is_retensi` di TagihanItem); saat tagihan lunas, proyek dengan item retensi otomatis `retention_paid=true`. Manual "Rincian Item" editor dihapus.
- [x] Filter termin/retensi sudah ditagih (8 Feb 2026): termin & retensi yang sudah pernah masuk tagihan tidak muncul lagi di form Tagihan Baru (dihitung dari items semua tagihan: `termin_index`, `is_retensi`); proyek hilang dari daftar jika semua sudah ditagihkan.
- [x] Hapus field Catatan di form Tagihan Baru, hapus tombol Export CSV, hapus aksi hapus tagihan (8 Feb 2026). Endpoint DELETE /api/tagihan tetap ada di backend (tidak diekspos di UI).
- [x] Dashboard Penagihan (8 Feb 2026): countdown timer diganti daftar tagihan belum lunas (klien, nomor invoice, jatuh tempo dengan tanda merah bila lewat, nominal total), urut jatuh tempo terdekat — komponen `TagihanDueList` (data-testid `duelist-card`).
- [x] Kolom Proyek di tabel Tagihan (9 Feb 2026): tampil rinci per item — nama lokasi proyek lengkap (bold) + jenis (Termin n (%) / Retensi (%) / Nilai Proyek) + nominal per baris (data-testid `tagihan-proj-line-{tid}-{i}`).
- [x] Kolom Terbayar & Aksi dihapus (9 Feb 2026): diganti satu kolom "Pembayaran" — tombol "Sudah Terbayar" (`tagihan-markpaid-{id}`, set paid_amount=total → status lunas) untuk yang belum dibayar, badge hijau "Sudah Terbayar" (`tagihan-paid-badge-{id}`) untuk yang lunas. Dialog pembayaran parsial & aksi kirim dihapus.
- [x] Input Proyek Baru dipindah ke menu Proyek (9 Feb 2026): tombol `projects-add-btn` toggle form QuickAddProject di halaman Proyek; dihapus dari Dashboard Penagihan. Field Keterangan kini tampil untuk Addwork DAN Maintenance (wajib hanya untuk Maintenance, disimpan di `maintenance_notes`). Saat Tim membuat buku kas, keterangan proyek Addwork/Maintenance tampil di dialog (`bukukas-project-notes`).
- [x] Tombol Kembalikan disembunyikan untuk Penagihan (11 Feb 2026): hanya Owner yang bisa mengembalikan proyek selesai ke berjalan (prop `canReopen`).
- [x] Detail proyek selesai read-only (11 Feb 2026): semua field (select, input, textarea) disabled bila `is_completed`, tombol Simpan disembunyikan, ada label "Proyek selesai — hanya bisa dilihat."
- [x] Visual edit (8 Feb 2026): hapus info "Jumlah Pencatatan Buku Kas" dari dialog detail proyek.

## Backlog (P1)
- [ ] PDF export (currently CSV only)
- [ ] Email/SMS reminder for due invoices (integration)
- [ ] Chart/graph on dashboard (recharts)
- [ ] Password reset flow

## Backlog (P2)
- [ ] Bulk import users
- [ ] Cashbook categories customization
- [ ] Weekly/monthly summary reports
- [ ] Multi-currency support
