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
