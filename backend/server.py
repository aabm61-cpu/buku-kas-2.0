from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

import bcrypt
import jwt
from bson import ObjectId
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Query
from fastapi.responses import Response
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field

# ---------------- Setup ----------------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_ALGORITHM = "HS256"
JWT_SECRET = os.environ['JWT_SECRET']

app = FastAPI(title="Renovasi Akuntansi API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("app")

ROLES = ("owner", "penagihan", "bendahara", "tim")

# ---------------- Utils ----------------
def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def verify_password(pw: str, hashed: str) -> bool:
    return bcrypt.checkpw(pw.encode(), hashed.encode())

def create_token(user_id: str, username: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "username": username,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def new_id() -> str:
    return str(uuid.uuid4())

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def clean_doc(doc: dict) -> dict:
    if not doc:
        return doc
    doc.pop("_id", None)
    doc.pop("password_hash", None)
    return doc

async def get_current_user(request: Request) -> dict:
    token = None
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        token = auth[7:]
    if not token:
        token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(401, "Tidak terautentikasi")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token kadaluarsa")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Token tidak valid")
    user = await db.users.find_one({"id": payload["sub"]})
    if not user or not user.get("active", True):
        raise HTTPException(401, "User tidak ditemukan")
    return clean_doc(user)

def require_role(*roles):
    async def checker(user: dict = Depends(get_current_user)):
        if user["role"] not in roles:
            raise HTTPException(403, "Akses ditolak")
        return user
    return checker

async def log_activity(user: dict, action: str, entity_type: str, entity_id: str = "", details: str = ""):
    await db.activities.insert_one({
        "id": new_id(),
        "user_id": user["id"],
        "username": user["username"],
        "user_name": user.get("name", ""),
        "role": user["role"],
        "action": action,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "details": details,
        "created_at": now_iso(),
    })

async def user_location_ids(user: dict) -> List[str]:
    """Locations a user is allowed to see."""
    if user["role"] in ("owner", "bendahara"):
        return None  # None means all
    if user["role"] == "penagihan":
        return None
    # tim
    cur = db.location_assignments.find({"user_id": user["id"]})
    return [a["location_id"] async for a in cur]

# ---------------- Models ----------------
class LoginIn(BaseModel):
    username: str
    password: str

class UserCreate(BaseModel):
    username: str
    password: str
    name: str
    role: Literal["owner", "penagihan", "bendahara", "tim"]
    phone: Optional[str] = ""

class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[Literal["owner", "penagihan", "bendahara", "tim"]] = None
    phone: Optional[str] = None
    active: Optional[bool] = None
    password: Optional[str] = None

WORK_TYPES = ("Renov", "Return to LL Renov", "Addwork", "Maintenance", "Maintenance Return to LL")

class ProjectIn(BaseModel):
    name: str  # Nama HUB/SOC
    work_type: Literal["Renov", "Return to LL Renov", "Addwork", "Maintenance", "Maintenance Return to LL"] = "Renov"
    client_name: Optional[str] = ""
    description: Optional[str] = ""
    status: Optional[Literal["aktif", "selesai", "ditunda"]] = "aktif"
    project_value: Optional[float] = 0
    maintenance_notes: Optional[str] = ""
    retention_percent: Optional[float] = 0

class ProjectMeta(BaseModel):
    end_date: Optional[str] = None
    spk_rab_type: Optional[Literal["SPK", "RAB"]] = None
    penagihan_status: Optional[Literal["belum_dibuat", "sudah_dibuat"]] = None
    project_value: Optional[float] = None
    maintenance_notes: Optional[str] = None
    retention_percent: Optional[float] = None
    retention_paid: Optional[bool] = None
    has_retensi: Optional[Literal["ada", "tidak_ada"]] = None
    has_termin: Optional[Literal["ada", "tidak_ada"]] = None
    termin_count: Optional[int] = None
    termin_percents: Optional[List[float]] = None
    cashbook_closed: Optional[bool] = None
    is_completed: Optional[bool] = None
    keterangan: Optional[str] = None

class LocationIn(BaseModel):
    project_id: str
    name: str
    address: Optional[str] = ""
    pic_user_id: Optional[str] = None
    status: Optional[Literal["aktif", "selesai"]] = "aktif"

class AssignmentIn(BaseModel):
    location_id: str
    user_id: str
    daily_rate: float = 0
    role_type: Literal["pic", "member", "viewer"] = "pic"

class BukuKasCreate(BaseModel):
    project_id: str
    member_user_ids: List[str] = []

class TransferPIC(BaseModel):
    new_pic_user_id: str

class AddMembers(BaseModel):
    member_user_ids: List[str]

class CashBookIn(BaseModel):
    location_id: str
    type: Literal["pemasukan", "pengeluaran"]
    category: str
    amount: float
    description: str = ""
    receipt_base64: str = ""  # required only for pengeluaran non-Kasbon
    kasbon_user_id: Optional[str] = None
    kasbon_user_name: Optional[str] = ""
    date: Optional[str] = None

class KasbonIn(BaseModel):
    location_id: str
    borrower_user_id: str
    amount: float
    description: str
    date: Optional[str] = None

class KasbonUpdate(BaseModel):
    status: Literal["pending", "lunas"]

class TagihanItem(BaseModel):
    project_id: str
    description: str
    amount: float
    is_retensi: bool = False
    termin_index: Optional[int] = None

class TagihanIn(BaseModel):
    invoice_number: str
    client_name: str
    items: List[TagihanItem]
    due_date: str
    notes: Optional[str] = ""

class TagihanUpdate(BaseModel):
    paid_amount: Optional[float] = None
    status: Optional[Literal["draft", "terkirim", "lunas", "jatuh_tempo"]] = None
    notes: Optional[str] = None

class TeamPaymentIn(BaseModel):
    location_id: str
    user_id: str
    period_start: str
    period_end: str
    days_worked: int
    daily_rate: float
    kasbon_deduction: float = 0
    bonus: float = 0
    notes: Optional[str] = ""

class TeamPaymentUpdate(BaseModel):
    paid: bool

# ---------------- Auth ----------------
@api.post("/auth/login")
async def login(payload: LoginIn):
    user = await db.users.find_one({"username": payload.username.strip()})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(401, "Username atau password salah")
    if not user.get("active", True):
        raise HTTPException(403, "Akun dinonaktifkan")
    token = create_token(user["id"], user["username"], user["role"])
    return {"token": token, "user": clean_doc(user)}

@api.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return user

class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str

@api.post("/auth/change-password")
async def change_password(payload: ChangePasswordIn, user=Depends(get_current_user)):
    doc = await db.users.find_one({"id": user["id"]})
    if not doc or not verify_password(payload.current_password, doc["password_hash"]):
        raise HTTPException(400, "Password saat ini salah")
    if len(payload.new_password) < 6:
        raise HTTPException(400, "Password baru minimal 6 karakter")
    if payload.new_password == payload.current_password:
        raise HTTPException(400, "Password baru tidak boleh sama dengan password lama")
    await db.users.update_one({"id": user["id"]}, {"$set": {"password_hash": hash_password(payload.new_password)}})
    await log_activity(user, "update", "user", user["id"], "Ubah password sendiri")
    return {"ok": True}

# ---------------- Users (Owner) ----------------
@api.get("/users")
async def list_users(user=Depends(get_current_user)):
    # owner sees all; bendahara & penagihan see tim/others for assignments; tim sees teammates
    cur = db.users.find({})
    users = [clean_doc(u) async for u in cur]
    return users

@api.post("/users")
async def create_user(payload: UserCreate, user=Depends(require_role("owner"))):
    if await db.users.find_one({"username": payload.username.strip()}):
        raise HTTPException(400, "Username sudah dipakai")
    doc = {
        "id": new_id(),
        "username": payload.username.strip(),
        "password_hash": hash_password(payload.password),
        "name": payload.name,
        "role": payload.role,
        "phone": payload.phone or "",
        "active": True,
        "created_at": now_iso(),
        "created_by": user["id"],
    }
    await db.users.insert_one(doc)
    await log_activity(user, "create", "user", doc["id"], f"Buat user {doc['username']} ({doc['role']})")
    return clean_doc(doc)

@api.patch("/users/{uid}")
async def update_user(uid: str, payload: UserUpdate, user=Depends(require_role("owner"))):
    update = {k: v for k, v in payload.model_dump(exclude_none=True).items() if k != "password"}
    if payload.password:
        update["password_hash"] = hash_password(payload.password)
    if not update:
        raise HTTPException(400, "Tidak ada perubahan")
    res = await db.users.update_one({"id": uid}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(404, "User tidak ditemukan")
    await log_activity(user, "update", "user", uid, f"Update user {list(update.keys())}")
    u = await db.users.find_one({"id": uid})
    return clean_doc(u)

@api.delete("/users/{uid}")
async def delete_user(uid: str, user=Depends(require_role("owner"))):
    if uid == user["id"]:
        raise HTTPException(400, "Tidak bisa menghapus diri sendiri")
    res = await db.users.delete_one({"id": uid})
    if res.deleted_count == 0:
        raise HTTPException(404, "User tidak ditemukan")
    await log_activity(user, "delete", "user", uid)
    return {"ok": True}

# ---------------- Clients (master data) ----------------
class ClientIn(BaseModel):
    name: str

@api.get("/clients")
async def list_clients(user=Depends(get_current_user)):
    return [clean_doc(c) async for c in db.clients.find({}).sort("name", 1)]

@api.post("/clients")
async def create_client(payload: ClientIn, user=Depends(require_role("owner"))):
    name = payload.name.strip().upper()
    if not name:
        raise HTTPException(400, "Nama klien wajib diisi")
    exists = await db.clients.find_one({"name": name})
    if exists:
        raise HTTPException(400, "Nama klien sudah ada")
    doc = {"id": new_id(), "name": name, "created_at": now_iso(), "created_by": user["id"]}
    await db.clients.insert_one(doc)
    await log_activity(user, "create", "client", doc["id"], f"Tambah klien {name}")
    return clean_doc(doc)

@api.delete("/clients/{cid}")
async def delete_client(cid: str, user=Depends(require_role("owner"))):
    res = await db.clients.delete_one({"id": cid})
    if res.deleted_count == 0:
        raise HTTPException(404, "Klien tidak ditemukan")
    await log_activity(user, "delete", "client", cid)
    return {"ok": True}


# ---------------- Projects ----------------
@api.get("/projects")
async def list_projects(user=Depends(get_current_user)):
    projects = [clean_doc(p) async for p in db.projects.find({})]
    # for tim: filter to assigned projects
    if user["role"] == "tim":
        loc_ids = await user_location_ids(user) or []
        locs = [clean_doc(l) async for l in db.locations.find({"id": {"$in": loc_ids}})]
        pids = {l["project_id"] for l in locs}
        projects = [p for p in projects if p["id"] in pids]

    # Compute start_date & count from cashbook per project
    pipeline = [{"$group": {"_id": "$project_id", "start_date": {"$min": "$date"}, "cnt": {"$sum": 1}}}]
    first_dates = {}
    counts = {}
    async for row in db.cashbook.aggregate(pipeline):
        first_dates[row["_id"]] = row["start_date"]
        counts[row["_id"]] = row["cnt"]
    for p in projects:
        p["start_date"] = first_dates.get(p["id"])
        p["cashbook_count"] = counts.get(p["id"], 0)
        p.setdefault("spk_rab_type", "SPK")
        p.setdefault("penagihan_status", "belum_dibuat")
        p.setdefault("project_value", 0.0)
        p.setdefault("maintenance_notes", "")
        p.setdefault("retention_percent", 0.0)
        p.setdefault("retention_paid", False)
        p.setdefault("cashbook_closed", False)
        p.setdefault("is_completed", False)
        p.setdefault("end_date", None)
        p.setdefault("keterangan", "")
        if p.get("cashbook_closed"):
            p["work_status"] = "selesai"
        elif p["cashbook_count"] > 0:
            p["work_status"] = "sedang_berlangsung"
        else:
            p["work_status"] = "belum_mulai"
    return projects

@api.post("/projects")
async def create_project(payload: ProjectIn, user=Depends(require_role("owner", "penagihan"))):
    doc = {"id": new_id(), **payload.model_dump(), "created_at": now_iso(), "created_by": user["id"]}
    await db.projects.insert_one(doc)
    # Auto-create a matching Location (=buku kas) with same name as project
    loc_id = new_id()
    await db.locations.insert_one({
        "id": loc_id,
        "project_id": doc["id"],
        "name": doc["name"],
        "address": "",
        "pic_user_id": None,
        "status": "aktif",
        "auto_created": True,
        "created_at": now_iso(),
    })
    await log_activity(user, "create", "project", doc["id"], f"Buat proyek {doc['name']} (+ buku kas otomatis)")
    return clean_doc(doc)

@api.patch("/projects/{pid}")
async def update_project(pid: str, payload: ProjectIn, user=Depends(require_role("owner", "penagihan"))):
    res = await db.projects.update_one({"id": pid}, {"$set": payload.model_dump()})
    if res.matched_count == 0:
        raise HTTPException(404, "Proyek tidak ditemukan")
    await log_activity(user, "update", "project", pid)
    p = await db.projects.find_one({"id": pid})
    return clean_doc(p)

@api.patch("/projects/{pid}/meta")
async def update_project_meta(pid: str, payload: ProjectMeta, user=Depends(require_role("owner", "penagihan"))):
    update = payload.model_dump(exclude_none=True)
    if not update:
        raise HTTPException(400, "Tidak ada perubahan")
    res = await db.projects.update_one({"id": pid}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(404, "Proyek tidak ditemukan")
    await log_activity(user, "update", "project", pid, f"Meta: {list(update.keys())}")
    p = await db.projects.find_one({"id": pid})
    return clean_doc(p)

@api.delete("/projects/{pid}")
async def delete_project(pid: str, user=Depends(require_role("owner"))):
    await db.projects.delete_one({"id": pid})
    await log_activity(user, "delete", "project", pid)
    return {"ok": True}

# ---------------- Locations ----------------
@api.get("/locations")
async def list_locations(user=Depends(get_current_user)):
    allowed = await user_location_ids(user)
    q = {"is_closed": {"$ne": True}}
    if allowed is not None:
        q["id"] = {"$in": allowed}
    return [clean_doc(l) async for l in db.locations.find(q)]

@api.post("/locations")
async def create_location(payload: LocationIn, user=Depends(require_role("owner", "bendahara"))):
    doc = {"id": new_id(), **payload.model_dump(), "created_at": now_iso()}
    await db.locations.insert_one(doc)
    await log_activity(user, "create", "location", doc["id"], f"Buat lokasi {doc['name']}")
    return clean_doc(doc)

@api.patch("/locations/{lid}")
async def update_location(lid: str, payload: LocationIn, user=Depends(require_role("owner", "bendahara"))):
    res = await db.locations.update_one({"id": lid}, {"$set": payload.model_dump()})
    if res.matched_count == 0:
        raise HTTPException(404, "Lokasi tidak ditemukan")
    await log_activity(user, "update", "location", lid)
    l = await db.locations.find_one({"id": lid})
    return clean_doc(l)

@api.delete("/locations/{lid}")
async def delete_location(lid: str, user=Depends(require_role("owner"))):
    await db.locations.delete_one({"id": lid})
    await log_activity(user, "delete", "location", lid)
    return {"ok": True}

# ---------------- Location Assignments ----------------
@api.get("/assignments")
async def list_assignments(location_id: Optional[str] = None, user=Depends(get_current_user)):
    q = {}
    if user["role"] == "tim":
        allowed = await user_location_ids(user) or []
        if location_id:
            if location_id not in allowed:
                raise HTTPException(403, "Akses lokasi ditolak")
            q["location_id"] = location_id
        else:
            q["location_id"] = {"$in": allowed}
    elif location_id:
        q["location_id"] = location_id
    return [clean_doc(a) async for a in db.location_assignments.find(q)]

@api.post("/assignments")
async def create_assignment(payload: AssignmentIn, user=Depends(require_role("owner", "bendahara", "tim"))):
    # tim can add teammates only for locations they're already assigned to
    if user["role"] == "tim":
        exists = await db.location_assignments.find_one({"location_id": payload.location_id, "user_id": user["id"]})
        if not exists:
            raise HTTPException(403, "Anda tidak ditugaskan di lokasi ini")
    loc = await db.locations.find_one({"id": payload.location_id})
    if not loc:
        raise HTTPException(404, "Lokasi tidak ditemukan")
    target = await db.users.find_one({"id": payload.user_id})
    if not target:
        raise HTTPException(404, "User target tidak ditemukan")
    if target["role"] != "tim":
        raise HTTPException(400, "Hanya user dengan peran 'tim' yang dapat ditugaskan")
    if await db.location_assignments.find_one({"location_id": payload.location_id, "user_id": payload.user_id}):
        raise HTTPException(400, "User sudah ditugaskan di lokasi ini")
    doc = {"id": new_id(), **payload.model_dump(), "created_at": now_iso(), "added_by": user["id"]}
    await db.location_assignments.insert_one(doc)
    await log_activity(user, "assign", "assignment", doc["id"], f"Tugaskan user ke lokasi")
    return clean_doc(doc)

@api.delete("/assignments/{aid}")
async def delete_assignment(aid: str, user=Depends(require_role("owner", "bendahara"))):
    await db.location_assignments.delete_one({"id": aid})
    await log_activity(user, "unassign", "assignment", aid)
    return {"ok": True}

# ---------------- Buku Kas (Tim ownership + viewers) ----------------
@api.get("/bukukas/available")
async def bukukas_available(user=Depends(require_role("tim", "owner"))):
    """Projects yg belum diklaim jadi buku kas oleh Tim manapun."""
    # find all locations that are already claimed
    claimed_project_ids = set()
    async for l in db.locations.find({"claimed_by_user_id": {"$ne": None, "$exists": True}}):
        if l.get("claimed_by_user_id"):
            claimed_project_ids.add(l["project_id"])
    # active projects not claimed & not completed
    result = []
    async for p in db.projects.find({}):
        if p["id"] in claimed_project_ids:
            continue
        if p.get("is_completed"):
            continue
        if p.get("status") == "selesai":
            continue
        result.append(clean_doc(p))
    return result

@api.post("/bukukas")
async def create_bukukas(payload: BukuKasCreate, user=Depends(require_role("tim", "owner"))):
    proj = await db.projects.find_one({"id": payload.project_id})
    if not proj:
        raise HTTPException(404, "Proyek tidak ditemukan")
    # Find matching location (auto-created); if missing (legacy project), create one now
    loc = await db.locations.find_one({"project_id": payload.project_id})
    if not loc:
        loc = {
            "id": new_id(),
            "project_id": payload.project_id,
            "name": proj["name"],
            "address": "",
            "pic_user_id": None,
            "status": "aktif",
            "auto_created": True,
            "created_at": now_iso(),
        }
        await db.locations.insert_one(loc)
    if loc.get("claimed_by_user_id"):
        raise HTTPException(400, "Buku kas untuk proyek ini sudah diklaim tim lain")
    # Claim location
    await db.locations.update_one({"id": loc["id"]}, {"$set": {"claimed_by_user_id": user["id"]}})
    # Assign creator as pic (writable)
    await db.location_assignments.insert_one({
        "id": new_id(), "location_id": loc["id"], "user_id": user["id"],
        "daily_rate": 0, "role_type": "pic", "created_at": now_iso(), "added_by": user["id"],
    })
    # Assign members as viewers (read-only)
    added = 0
    for uid in payload.member_user_ids:
        if uid == user["id"]:
            continue
        u = await db.users.find_one({"id": uid, "role": "tim"})
        if not u:
            continue
        exists = await db.location_assignments.find_one({"location_id": loc["id"], "user_id": uid})
        if exists:
            continue
        await db.location_assignments.insert_one({
            "id": new_id(), "location_id": loc["id"], "user_id": uid,
            "daily_rate": 0, "role_type": "viewer", "created_at": now_iso(), "added_by": user["id"],
        })
        added += 1
    await log_activity(user, "create", "bukukas", loc["id"], f"Klaim buku kas {loc['name']} (+{added} peninjau)")
    l = await db.locations.find_one({"id": loc["id"]})
    return clean_doc(l)

@api.post("/bukukas/{lid}/close")
async def close_bukukas(lid: str, user=Depends(require_role("tim", "bendahara", "owner"))):
    loc = await db.locations.find_one({"id": lid})
    if not loc:
        raise HTTPException(404, "Buku kas tidak ditemukan")
    if user["role"] == "tim":
        # Only pic (creator) or bendahara/owner can close
        a = await db.location_assignments.find_one({"location_id": lid, "user_id": user["id"]})
        if not a or a.get("role_type") != "pic":
            raise HTTPException(403, "Hanya pemilik buku kas yang dapat menyelesaikan")
    await db.locations.update_one({"id": lid}, {"$set": {"is_closed": True, "closed_at": now_iso(), "closed_by": user["id"]}})
    await log_activity(user, "close", "bukukas", lid, f"Selesaikan buku kas {loc['name']}")
    return {"ok": True}

@api.post("/bukukas/{lid}/reopen")
async def reopen_bukukas(lid: str, user=Depends(require_role("owner", "bendahara"))):
    loc = await db.locations.find_one({"id": lid})
    if not loc:
        raise HTTPException(404, "Buku kas tidak ditemukan")
    if not loc.get("is_closed"):
        raise HTTPException(400, "Buku kas ini masih aktif")
    await db.locations.update_one({"id": lid}, {"$set": {"is_closed": False, "payment_ready": False}, "$unset": {"closed_at": "", "closed_by": ""}})
    await log_activity(user, "reopen", "bukukas", lid, f"Kembalikan buku kas {loc['name']} menjadi aktif")
    return {"ok": True}

@api.get("/bukukas/history")
async def bukukas_history(user=Depends(get_current_user)):
    """List all CLOSED buku kas (locations)."""
    q = {"is_closed": True}
    if user["role"] == "tim":
        allowed = await user_location_ids(user) or []
        q["id"] = {"$in": allowed}
    result = []
    async for l in db.locations.find(q).sort("closed_at", -1):
        # attach cashbook summary
        pipeline = [{"$match": {"location_id": l["id"]}}, {"$group": {"_id": "$type", "sum": {"$sum": "$amount"}, "cnt": {"$sum": 1}}}]
        s_in = 0.0; s_out = 0.0; cnt = 0
        async for r in db.cashbook.aggregate(pipeline):
            if r["_id"] == "pemasukan": s_in = r["sum"]
            elif r["_id"] == "pengeluaran": s_out = r["sum"]
            cnt += r["cnt"]
        entry = clean_doc(l)
        entry["total_in"] = s_in
        entry["total_out"] = s_out
        entry["count"] = cnt
        # attach team members involved at this location
        team = []
        async for a in db.location_assignments.find({"location_id": l["id"]}):
            u = await db.users.find_one({"id": a["user_id"]})
            # kasbon total per member from cashbook (category Kasbon)
            kasbon_total = 0.0
            async for cb in db.cashbook.find({"location_id": l["id"], "category": "Kasbon"}):
                attributed = cb.get("kasbon_user_id") or cb.get("user_id")
                if attributed == a["user_id"]:
                    kasbon_total += float(cb.get("amount") or 0)
            team.append({
                "user_id": a["user_id"],
                "name": (u or {}).get("name") or (u or {}).get("username") or "-",
                "role_type": a.get("role_type", "viewer"),
                "kasbon_total": kasbon_total,
            })
        team.sort(key=lambda m: 0 if m["role_type"] == "pic" else 1)
        entry["team"] = team
        result.append(entry)
    return result

@api.post("/bukukas/{lid}/transfer-pic")
async def transfer_pic(lid: str, payload: TransferPIC, user=Depends(require_role("tim", "owner"))):
    loc = await db.locations.find_one({"id": lid})
    if not loc:
        raise HTTPException(404, "Buku kas tidak ditemukan")
    # Verify caller is current PIC
    my_a = await db.location_assignments.find_one({"location_id": lid, "user_id": user["id"]})
    if user["role"] != "owner" and (not my_a or my_a.get("role_type") != "pic"):
        raise HTTPException(403, "Hanya PIC yang dapat memindahkan")
    new_user = await db.users.find_one({"id": payload.new_pic_user_id, "role": "tim"})
    if not new_user:
        raise HTTPException(404, "User tim target tidak ditemukan")
    if payload.new_pic_user_id == user["id"]:
        raise HTTPException(400, "Anda sudah menjadi PIC")
    # Demote current pic → viewer
    if my_a:
        await db.location_assignments.update_one({"id": my_a["id"]}, {"$set": {"role_type": "viewer"}})
    # Promote or create new pic
    target_a = await db.location_assignments.find_one({"location_id": lid, "user_id": payload.new_pic_user_id})
    if target_a:
        await db.location_assignments.update_one({"id": target_a["id"]}, {"$set": {"role_type": "pic"}})
    else:
        await db.location_assignments.insert_one({
            "id": new_id(), "location_id": lid, "user_id": payload.new_pic_user_id,
            "daily_rate": 0, "role_type": "pic", "created_at": now_iso(), "added_by": user["id"],
        })
    await db.locations.update_one({"id": lid}, {"$set": {"claimed_by_user_id": payload.new_pic_user_id}})
    await log_activity(user, "transfer", "bukukas", lid, f"Pindah PIC ke {new_user['name']}")
    return {"ok": True}

@api.post("/bukukas/{lid}/add-members")
async def add_members(lid: str, payload: AddMembers, user=Depends(require_role("tim", "owner"))):
    loc = await db.locations.find_one({"id": lid})
    if not loc:
        raise HTTPException(404, "Buku kas tidak ditemukan")
    my_a = await db.location_assignments.find_one({"location_id": lid, "user_id": user["id"]})
    if user["role"] != "owner" and (not my_a or my_a.get("role_type") != "pic"):
        raise HTTPException(403, "Hanya PIC yang dapat menambahkan anggota")
    added = 0
    for uid in payload.member_user_ids:
        if uid == user["id"]:
            continue
        u = await db.users.find_one({"id": uid, "role": "tim"})
        if not u:
            continue
        exists = await db.location_assignments.find_one({"location_id": lid, "user_id": uid})
        if exists:
            continue
        await db.location_assignments.insert_one({
            "id": new_id(), "location_id": lid, "user_id": uid,
            "daily_rate": 0, "role_type": "viewer", "created_at": now_iso(), "added_by": user["id"],
        })
        added += 1
    await log_activity(user, "add-members", "bukukas", lid, f"Tambah {added} anggota peninjau")
    return {"ok": True, "added": added}

# ---------------- Cash Book ----------------
@api.get("/cashbook")
async def list_cashbook(location_id: Optional[str] = None, user=Depends(get_current_user)):
    q = {}
    allowed = await user_location_ids(user)
    if allowed is None:
        if location_id:
            q["location_id"] = location_id
    else:
        if location_id:
            if location_id not in allowed:
                raise HTTPException(403, "Akses lokasi ditolak")
            q["location_id"] = location_id
        else:
            q["location_id"] = {"$in": allowed}
    entries = [clean_doc(e) async for e in db.cashbook.find(q).sort("date", -1)]
    return entries

@api.post("/cashbook")
async def create_cashbook(payload: CashBookIn, user=Depends(require_role("tim", "bendahara", "owner"))):
    if payload.type == "pengeluaran" and payload.category != "Kasbon" and not payload.receipt_base64:
        raise HTTPException(400, "Foto nota wajib untuk pengeluaran")
    if payload.type == "pengeluaran" and payload.category == "Kasbon" and not payload.kasbon_user_id:
        raise HTTPException(400, "Pilih anggota tim yang mengajukan kasbon")
    # verify access
    if user["role"] == "tim":
        assignment = await db.location_assignments.find_one({"location_id": payload.location_id, "user_id": user["id"]})
        if not assignment:
            raise HTTPException(403, "Anda tidak ditugaskan di lokasi ini")
        if assignment.get("role_type") == "viewer":
            raise HTTPException(403, "Anda hanya peninjau buku kas ini, tidak bisa membuat catatan")
    loc = await db.locations.find_one({"id": payload.location_id})
    if not loc:
        raise HTTPException(404, "Lokasi tidak ditemukan")
    doc = {
        "id": new_id(),
        "location_id": payload.location_id,
        "project_id": loc["project_id"],
        "user_id": user["id"],
        "user_name": user.get("name", ""),
        "type": payload.type,
        "category": payload.category,
        "amount": payload.amount,
        "description": payload.description,
        "receipt_base64": payload.receipt_base64,
        "kasbon_user_id": payload.kasbon_user_id or None,
        "kasbon_user_name": payload.kasbon_user_name or "",
        "date": payload.date or now_iso(),
        "created_at": now_iso(),
    }
    await db.cashbook.insert_one(doc)
    await log_activity(user, "create", "cashbook", doc["id"], f"{payload.type} Rp{payload.amount:,.0f} - {payload.description}")
    return clean_doc(doc)

@api.delete("/cashbook/{cid}")
async def delete_cashbook(cid: str, user=Depends(get_current_user)):
    entry = await db.cashbook.find_one({"id": cid})
    if not entry:
        raise HTTPException(404, "Tidak ditemukan")
    if user["role"] == "tim" and entry["user_id"] != user["id"]:
        raise HTTPException(403, "Hanya bisa menghapus milik sendiri")
    if user["role"] not in ("owner", "bendahara", "tim"):
        raise HTTPException(403, "Akses ditolak")
    await db.cashbook.delete_one({"id": cid})
    await log_activity(user, "delete", "cashbook", cid)
    return {"ok": True}

# ---------------- Kasbon ----------------
@api.get("/kasbon")
async def list_kasbon(location_id: Optional[str] = None, user=Depends(get_current_user)):
    q = {}
    allowed = await user_location_ids(user)
    if allowed is None:
        if location_id:
            q["location_id"] = location_id
    else:
        if location_id:
            if location_id not in allowed:
                raise HTTPException(403, "Akses lokasi ditolak")
            q["location_id"] = location_id
        else:
            q["location_id"] = {"$in": allowed}
    return [clean_doc(k) async for k in db.kasbon.find(q).sort("date", -1)]

@api.post("/kasbon")
async def create_kasbon(payload: KasbonIn, user=Depends(require_role("tim", "bendahara", "owner"))):
    if user["role"] == "tim":
        allowed = await user_location_ids(user) or []
        if payload.location_id not in allowed:
            raise HTTPException(403, "Akses lokasi ditolak")
    loc = await db.locations.find_one({"id": payload.location_id})
    if not loc:
        raise HTTPException(404, "Lokasi tidak ditemukan")
    borrower = await db.users.find_one({"id": payload.borrower_user_id})
    doc = {
        "id": new_id(),
        "location_id": payload.location_id,
        "project_id": loc["project_id"],
        "recorded_by": user["id"],
        "borrower_user_id": payload.borrower_user_id,
        "borrower_name": borrower.get("name", "") if borrower else "",
        "amount": payload.amount,
        "description": payload.description,
        "status": "pending",
        "date": payload.date or now_iso(),
        "created_at": now_iso(),
    }
    await db.kasbon.insert_one(doc)
    await log_activity(user, "create", "kasbon", doc["id"], f"Kasbon Rp{payload.amount:,.0f} untuk {doc['borrower_name']}")
    return clean_doc(doc)

@api.patch("/kasbon/{kid}")
async def update_kasbon(kid: str, payload: KasbonUpdate, user=Depends(require_role("bendahara", "owner"))):
    await db.kasbon.update_one({"id": kid}, {"$set": {"status": payload.status}})
    await log_activity(user, "update", "kasbon", kid, f"Status: {payload.status}")
    k = await db.kasbon.find_one({"id": kid})
    return clean_doc(k)

# ---------------- Tagihan (Invoices) ----------------
@api.get("/tagihan")
async def list_tagihan(user=Depends(require_role("owner", "penagihan", "bendahara"))):
    items = [clean_doc(t) async for t in db.tagihan.find({}).sort("created_at", -1)]
    # auto-mark jatuh tempo
    today = datetime.now(timezone.utc).date().isoformat()
    for t in items:
        if t.get("status") in ("terkirim", "draft") and t.get("due_date", "") < today and t.get("paid_amount", 0) < t.get("total", 0):
            t["status"] = "jatuh_tempo"
    return items

@api.post("/tagihan")
async def create_tagihan(payload: TagihanIn, user=Depends(require_role("owner", "penagihan"))):
    if not payload.items:
        raise HTTPException(400, "Minimal satu item diperlukan")

    project_ids = list({i.project_id for i in payload.items})
    subtotal = sum(i.amount for i in payload.items)
    retensi_total = sum(i.amount for i in payload.items if i.is_retensi)

    main_id = new_id()
    main_doc = {
        "id": main_id,
        "project_ids": project_ids,
        "invoice_number": payload.invoice_number,
        "client_name": payload.client_name,
        "items": [i.model_dump() for i in payload.items],
        "subtotal": subtotal,
        "retention_amount": retensi_total,
        "total": subtotal,
        "paid_amount": 0,
        "due_date": payload.due_date,
        "status": "draft",
        "is_retensi": False,
        "notes": payload.notes or "",
        "created_at": now_iso(),
        "created_by": user["id"],
    }
    await db.tagihan.insert_one(main_doc)

    detail = f"Tagihan {payload.invoice_number} Rp{subtotal:,.0f}"
    if retensi_total > 0:
        detail += f" (termasuk retensi Rp{retensi_total:,.0f})"
    await log_activity(user, "create", "tagihan", main_id, detail)
    return [clean_doc(main_doc)]

@api.patch("/tagihan/{tid}")
async def update_tagihan(tid: str, payload: TagihanUpdate, user=Depends(require_role("owner", "penagihan"))):
    update = payload.model_dump(exclude_none=True)
    t = await db.tagihan.find_one({"id": tid})
    if not t:
        raise HTTPException(404, "Tagihan tidak ditemukan")
    if "paid_amount" in update and update["paid_amount"] >= t.get("total", 0):
        update["status"] = "lunas"
    await db.tagihan.update_one({"id": tid}, {"$set": update})

    # When invoice fully paid, mark retention_paid for projects billed via retensi
    new_t = await db.tagihan.find_one({"id": tid})
    if new_t.get("paid_amount", 0) >= new_t.get("total", 0):
        retensi_pids = set()
        if new_t.get("is_retensi"):
            retensi_pids.update(new_t.get("project_ids", []))
        for it in new_t.get("items", []):
            if it.get("is_retensi"):
                retensi_pids.add(it.get("project_id"))
        for pid in retensi_pids:
            await db.projects.update_one({"id": pid}, {"$set": {"retention_paid": True}})

    await log_activity(user, "update", "tagihan", tid, str(update))
    return clean_doc(new_t)

@api.delete("/tagihan/{tid}")
async def delete_tagihan(tid: str, user=Depends(require_role("owner", "penagihan"))):
    await db.tagihan.delete_one({"id": tid})
    await log_activity(user, "delete", "tagihan", tid)
    return {"ok": True}

# ---------------- Team Payments ----------------
@api.get("/team-payments")
async def list_team_payments(location_id: Optional[str] = None, user=Depends(require_role("owner", "bendahara", "tim"))):
    q = {"location_id": location_id} if location_id else {}
    if user["role"] == "tim":
        q["user_id"] = user["id"]  # tim hanya melihat bayaran miliknya sendiri
    out = [clean_doc(p) async for p in db.team_payments.find(q).sort("created_at", -1)]
    loc_ids = list({p.get("location_id") for p in out if p.get("location_id")})
    loc_names = {l["id"]: l.get("name", "") async for l in db.locations.find({"id": {"$in": loc_ids}})}
    for p in out:
        p["location_name"] = loc_names.get(p.get("location_id"), "")
    return out

class TeamPaymentLine(BaseModel):
    user_id: str
    user_name: str = ""
    kasbon_total: float = 0
    amount: float = 0
    date: Optional[str] = None

class TeamPaymentBatch(BaseModel):
    location_id: str
    payments: List[TeamPaymentLine]

@api.post("/team-payments/batch")
async def save_team_payments_batch(payload: TeamPaymentBatch, user=Depends(require_role("owner", "bendahara"))):
    saved = 0
    for line in payload.payments:
        if line.amount <= 0:
            continue
        fields = {
            "location_id": payload.location_id,
            "user_id": line.user_id,
            "user_name": line.user_name,
            "kasbon_total": line.kasbon_total,
            "amount": line.amount,
            "net": line.amount - line.kasbon_total,
            "date": line.date or now_iso()[:10],
            "paid": True,
            "created_by": user["id"],
        }
        existing = await db.team_payments.find_one({"location_id": payload.location_id, "user_id": line.user_id})
        if existing:
            await db.team_payments.update_one({"id": existing["id"]}, {"$set": {**fields, "updated_at": now_iso()}})
        else:
            await db.team_payments.insert_one({"id": new_id(), "created_at": now_iso(), **fields})
        saved += 1
    await log_activity(user, "create", "team_payment", payload.location_id, f"Pembayaran tim {saved} anggota")
    return {"ok": True, "saved": saved}

class PaymentReadyBody(BaseModel):
    ready: bool

@api.patch("/team-payments/ready/{location_id}")
async def set_payment_ready(location_id: str, body: PaymentReadyBody, user=Depends(require_role("owner", "bendahara"))):
    loc = await db.locations.find_one({"id": location_id})
    if not loc:
        raise HTTPException(404, "Lokasi tidak ditemukan")
    if body.ready:
        members = [a async for a in db.location_assignments.find({"location_id": location_id})]
        if not members:
            raise HTTPException(400, "Tidak ada anggota tim di buku kas ini")
        for m in members:
            p = await db.team_payments.find_one({"location_id": location_id, "user_id": m["user_id"], "paid": True})
            if not p:
                u = await db.users.find_one({"id": m["user_id"]})
                nama = (u or {}).get("name") or (u or {}).get("username") or "anggota"
                raise HTTPException(400, f"Pembayaran untuk {nama} belum diisi. Lengkapi semua anggota terlebih dahulu.")
    await db.locations.update_one({"id": location_id}, {"$set": {"payment_ready": body.ready}})
    await log_activity(user, "update", "team_payment", location_id, f"Status pembayaran: {'Siap Dibayar' if body.ready else 'Menunggu Pembayaran'}")
    return {"ok": True, "payment_ready": body.ready}

@api.post("/team-payments")
async def create_team_payment(payload: TeamPaymentIn, user=Depends(require_role("owner", "bendahara"))):
    gross = payload.days_worked * payload.daily_rate + payload.bonus
    net = gross - payload.kasbon_deduction
    borrower = await db.users.find_one({"id": payload.user_id})
    doc = {
        "id": new_id(),
        **payload.model_dump(),
        "user_name": borrower.get("name", "") if borrower else "",
        "gross": gross,
        "net": net,
        "paid": False,
        "created_at": now_iso(),
        "created_by": user["id"],
    }
    await db.team_payments.insert_one(doc)
    await log_activity(user, "create", "team_payment", doc["id"], f"Bayaran {doc['user_name']} Rp{net:,.0f}")
    return clean_doc(doc)

@api.patch("/team-payments/{pid}")
async def update_team_payment(pid: str, payload: TeamPaymentUpdate, user=Depends(require_role("owner", "bendahara"))):
    upd = {"paid": payload.paid}
    if payload.paid:
        upd["paid_at"] = now_iso()
    await db.team_payments.update_one({"id": pid}, {"$set": upd})
    await log_activity(user, "update", "team_payment", pid, f"paid={payload.paid}")
    p = await db.team_payments.find_one({"id": pid})
    return clean_doc(p)

@api.delete("/team-payments/{pid}")
async def delete_team_payment(pid: str, user=Depends(require_role("owner", "bendahara"))):
    res = await db.team_payments.delete_one({"id": pid})
    if res.deleted_count == 0:
        raise HTTPException(404, "Tidak ditemukan")
    await log_activity(user, "delete", "team_payment", pid)
    return {"ok": True}

# ---------------- Activities ----------------
@api.get("/activities")
async def list_activities(limit: int = Query(100, le=500), user=Depends(require_role("owner"))):
    cur = db.activities.find({}).sort("created_at", -1).limit(limit)
    return [clean_doc(a) async for a in cur]

# ---------------- Dashboard Stats ----------------
@api.get("/dashboard/stats")
async def dashboard_stats(user=Depends(get_current_user)):
    allowed = await user_location_ids(user)
    q_cb = {} if allowed is None else {"location_id": {"$in": allowed}}

    total_in = 0.0
    total_out = 0.0
    async for e in db.cashbook.find(q_cb):
        if e["type"] == "pemasukan":
            total_in += float(e["amount"])
        else:
            total_out += float(e["amount"])

    stats = {
        "total_pemasukan": total_in,
        "total_pengeluaran": total_out,
        "saldo": total_in - total_out,
        "jumlah_lokasi": await db.locations.count_documents({} if allowed is None else {"id": {"$in": allowed}}),
        "jumlah_proyek": 0,
        "jumlah_user": await db.users.count_documents({}),
    }

    if allowed is None:
        stats["jumlah_proyek"] = await db.projects.count_documents({})
    else:
        locs = [l async for l in db.locations.find({"id": {"$in": allowed}}, {"project_id": 1, "_id": 0})]
        stats["jumlah_proyek"] = len({l["project_id"] for l in locs})

    if user["role"] in ("owner", "penagihan"):
        total_tagihan = 0.0
        total_paid = 0.0
        total_overdue = 0
        today = datetime.now(timezone.utc).date().isoformat()
        async for t in db.tagihan.find({}):
            total_tagihan += float(t.get("total", 0))
            total_paid += float(t.get("paid_amount", 0))
            if t.get("due_date", "") < today and t.get("paid_amount", 0) < t.get("total", 0):
                total_overdue += 1
        stats["total_tagihan"] = total_tagihan
        stats["total_terbayar"] = total_paid
        stats["tagihan_jatuh_tempo"] = total_overdue

    if user["role"] in ("owner", "bendahara"):
        pending_kasbon = 0.0
        async for k in db.kasbon.find({"status": "pending"}):
            pending_kasbon += float(k["amount"])
        stats["kasbon_pending"] = pending_kasbon

    return stats

# ---------------- Health ----------------
@api.get("/")
async def root():
    return {"ok": True, "service": "renovasi-akuntansi"}

# ---------------- Startup ----------------
app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def on_start():
    await db.users.create_index("username", unique=True)
    await db.locations.create_index("project_id")
    await db.cashbook.create_index([("location_id", 1), ("date", -1)])
    await db.kasbon.create_index("location_id")
    await db.activities.create_index([("created_at", -1)])

    # Seed owner
    admin_username = os.environ["ADMIN_USERNAME"]
    admin_password = os.environ["ADMIN_PASSWORD"]
    admin_name = os.environ.get("ADMIN_NAME", "Owner")
    existing = await db.users.find_one({"username": admin_username})
    if not existing:
        await db.users.insert_one({
            "id": new_id(),
            "username": admin_username,
            "password_hash": hash_password(admin_password),
            "name": admin_name,
            "role": "owner",
            "phone": "",
            "active": True,
            "created_at": now_iso(),
            "created_by": "system",
        })
        logger.info(f"Seeded owner {admin_username}")
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"username": admin_username}, {"$set": {"password_hash": hash_password(admin_password), "role": "owner", "active": True}})
        logger.info(f"Updated owner password for {admin_username}")

@app.on_event("shutdown")
async def on_shutdown():
    client.close()
