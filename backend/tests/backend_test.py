"""Regression tests for authentication, RBAC, CRUD, location isolation, finance flows, logs, and dashboard stats."""

import base64
import re
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import jwt
import pytest
import requests
from dotenv import dotenv_values
from pymongo import MongoClient

FRONTEND_ENV = dotenv_values("/app/frontend/.env")
BACKEND_ENV = dotenv_values("/app/backend/.env")
BASE_URL = (FRONTEND_ENV.get("REACT_APP_BACKEND_URL") or "").rstrip("/")
if not BASE_URL:
    raise RuntimeError("REACT_APP_BACKEND_URL is missing from /app/frontend/.env")

CREDENTIALS_PATH = Path("/app/memory/test_credentials.md")
RUN_ID = uuid.uuid4().hex[:10]
STATE = {
    "users": {},
    "projects": [],
    "locations": [],
    "assignments": [],
    "cashbook": [],
    "kasbon": [],
    "tagihan": [],
    "team_payments": [],
}


def _load_credentials():
    if not CREDENTIALS_PATH.exists():
        pytest.skip("Missing /app/memory/test_credentials.md")
    text = CREDENTIALS_PATH.read_text(encoding="utf-8")
    username = re.search(r"(?im)^\s*-\s*Username:\s*`([^`]+)`", text)
    password = re.search(r"(?im)^\s*-\s*Password:\s*`([^`]+)`", text)
    if not username or not password:
        pytest.skip("Owner username/password missing from test_credentials.md")
    return username.group(1), password.group(1)


def _headers(token):
    return {"Authorization": f"Bearer {token}"}


def _login(username, password):
    return requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"username": username, "password": password},
        timeout=20,
    )


def _create_user(owner_headers, role, label=None):
    label = label or role
    username = f"TEST_{RUN_ID}_{label}"
    password = f"Test!{RUN_ID}Aa1"
    payload = {
        "username": username,
        "password": password,
        "name": f"TEST {label} {RUN_ID}",
        "role": role,
        "phone": "081234567890",
    }
    response = requests.post(
        f"{BASE_URL}/api/users", json=payload, headers=owner_headers, timeout=20
    )
    assert response.status_code in (200, 201), response.text
    data = response.json()
    assert data["username"] == username
    assert data["name"] == payload["name"]
    assert data["role"] == role
    assert data["active"] is True
    assert isinstance(data["id"], str) and data["id"]
    assert "password_hash" not in data
    record = {**data, "password": password}
    STATE["users"][label] = record
    return record


@pytest.fixture(scope="session")
def owner_credentials():
    return _load_credentials()


@pytest.fixture(scope="session")
def owner_session(owner_credentials):
    username, password = owner_credentials
    response = _login(username, password)
    if response.status_code != 200:
        pytest.fail(f"Owner authentication failed: {response.status_code} {response.text[:300]}")
    data = response.json()
    token = data.get("token")
    if not token:
        pytest.fail("Owner authentication response has no token")
    return {
        "username": username,
        "password": password,
        "token": token,
        "headers": _headers(token),
        "user": data["user"],
    }


@pytest.fixture(scope="session", autouse=True)
def cleanup_test_data():
    yield
    mongo_url = BACKEND_ENV.get("MONGO_URL")
    db_name = BACKEND_ENV.get("DB_NAME")
    if not mongo_url or not db_name:
        return
    client = MongoClient(mongo_url, serverSelectionTimeoutMS=5000)
    db = client[db_name]
    ids_by_collection = {
        "users": [u["id"] for u in STATE["users"].values() if u.get("id")],
        "projects": STATE["projects"],
        "locations": STATE["locations"],
        "location_assignments": STATE["assignments"],
        "cashbook": STATE["cashbook"],
        "kasbon": STATE["kasbon"],
        "tagihan": STATE["tagihan"],
        "team_payments": STATE["team_payments"],
    }
    for collection, ids in ids_by_collection.items():
        if ids:
            db[collection].delete_many({"id": {"$in": ids}})
    db.activities.delete_many(
        {
            "$or": [
                {"entity_id": {"$in": [i for ids in ids_by_collection.values() for i in ids]}},
                {"details": {"$regex": RUN_ID}},
            ]
        }
    )
    client.close()


class TestAuthenticationAndSecurity:
    """Owner login, token identity, cookie/CORS security, password hashing, and lockout."""

    def test_health_endpoint(self):
        response = requests.get(f"{BASE_URL}/api/", timeout=20)
        assert response.status_code == 200
        assert response.json() == {"ok": True, "service": "renovasi-akuntansi"}

    def test_owner_login_returns_jwt_and_owner_user(self, owner_credentials):
        username, password = owner_credentials
        response = _login(username, password)
        assert response.status_code == 200, response.text
        data = response.json()
        assert isinstance(data.get("token"), str) and data["token"]
        assert data["user"]["username"] == username
        assert data["user"]["role"] == "owner"
        assert "password_hash" not in data["user"]
        claims = jwt.decode(data["token"], options={"verify_signature": False})
        assert claims["sub"] == data["user"]["id"]
        assert claims["role"] == "owner"
        assert claims["type"] == "access"
        assert isinstance(claims["exp"], int)

    def test_auth_me_with_bearer(self, owner_session):
        response = requests.get(
            f"{BASE_URL}/api/auth/me", headers=owner_session["headers"], timeout=20
        )
        assert response.status_code == 200, response.text
        data = response.json()
        assert data["id"] == owner_session["user"]["id"]
        assert data["username"] == owner_session["username"]
        assert data["role"] == "owner"
        assert "password_hash" not in data

    def test_login_sets_httponly_cookie(self, owner_credentials):
        username, password = owner_credentials
        response = _login(username, password)
        assert response.status_code == 200
        cookie = response.cookies.get("access_token")
        assert cookie, "Login must set an access_token cookie"
        set_cookie = response.headers.get("set-cookie", "").lower()
        assert "httponly" in set_cookie
        assert "secure" in set_cookie

    def test_cors_uses_explicit_origin_and_credentials(self):
        origin = "https://qa-client.example"
        response = requests.options(
            f"{BASE_URL}/api/auth/login",
            headers={
                "Origin": origin,
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type,authorization",
            },
            timeout=20,
        )
        assert response.status_code in (200, 204), response.text
        assert response.headers.get("access-control-allow-origin") == origin
        assert response.headers.get("access-control-allow-credentials") == "true"

    def test_owner_created_password_hash_is_bcrypt_2b(self, owner_session):
        user = _create_user(owner_session["headers"], "owner", "bcrypt_owner")
        client = MongoClient(BACKEND_ENV["MONGO_URL"], serverSelectionTimeoutMS=5000)
        stored = client[BACKEND_ENV["DB_NAME"]].users.find_one({"id": user["id"]})
        client.close()
        assert stored is not None
        assert stored["password_hash"].startswith("$2b$")

    def test_bruteforce_lockout_after_five_failures(self, owner_session):
        user = _create_user(owner_session["headers"], "tim", "lockout_tim")
        for _ in range(5):
            failed = _login(user["username"], "definitely-wrong")
            assert failed.status_code == 401
        blocked = _login(user["username"], user["password"])
        assert blocked.status_code in (423, 429), (
            "Account/IP should be locked after five failed login attempts; "
            f"received {blocked.status_code}"
        )


class TestUsersAndRoleAccess:
    """User creation, unique usernames, owner-only mutations, password/active state, and deletion."""

    @pytest.mark.parametrize("role", ["owner", "penagihan", "bendahara", "tim"])
    def test_owner_creates_each_role(self, owner_session, role):
        user = _create_user(owner_session["headers"], role)
        login = _login(user["username"], user["password"])
        assert login.status_code == 200, login.text
        data = login.json()
        assert data["user"]["id"] == user["id"]
        assert data["user"]["role"] == role
        STATE["users"][role]["token"] = data["token"]

    def test_duplicate_username_rejected(self, owner_session):
        existing = STATE["users"]["tim"]
        response = requests.post(
            f"{BASE_URL}/api/users",
            headers=owner_session["headers"],
            json={
                "username": existing["username"],
                "password": "AnotherPass1!",
                "name": "TEST duplicate",
                "role": "tim",
            },
            timeout=20,
        )
        assert response.status_code in (400, 409)
        assert "dipakai" in response.json().get("detail", "").lower()

    def test_non_owner_cannot_create_user(self):
        penagihan = STATE["users"]["penagihan"]
        response = requests.post(
            f"{BASE_URL}/api/users",
            headers=_headers(penagihan["token"]),
            json={
                "username": f"TEST_{RUN_ID}_forbidden",
                "password": "Pass1234!",
                "name": "TEST forbidden",
                "role": "tim",
            },
            timeout=20,
        )
        assert response.status_code == 403
        assert response.json().get("detail")

    def test_owner_updates_password_and_active_state(self, owner_session):
        target = STATE["users"]["owner"]
        new_password = f"Changed!{RUN_ID}9"
        response = requests.patch(
            f"{BASE_URL}/api/users/{target['id']}",
            headers=owner_session["headers"],
            json={"name": f"TEST updated owner {RUN_ID}", "password": new_password},
            timeout=20,
        )
        assert response.status_code == 200, response.text
        assert response.json()["name"] == f"TEST updated owner {RUN_ID}"
        assert "password_hash" not in response.json()
        assert _login(target["username"], target["password"]).status_code == 401
        new_login = _login(target["username"], new_password)
        assert new_login.status_code == 200
        target["password"] = new_password
        target["token"] = new_login.json()["token"]

        disabled = requests.patch(
            f"{BASE_URL}/api/users/{target['id']}",
            headers=owner_session["headers"],
            json={"active": False},
            timeout=20,
        )
        assert disabled.status_code == 200
        assert disabled.json()["active"] is False
        assert _login(target["username"], new_password).status_code == 403
        assert requests.get(
            f"{BASE_URL}/api/auth/me", headers=_headers(target["token"]), timeout=20
        ).status_code == 401

        enabled = requests.patch(
            f"{BASE_URL}/api/users/{target['id']}",
            headers=owner_session["headers"],
            json={"active": True},
            timeout=20,
        )
        assert enabled.status_code == 200
        assert enabled.json()["active"] is True
        assert _login(target["username"], new_password).status_code == 200

    def test_owner_cannot_delete_self_and_can_delete_other_user(self, owner_session):
        self_delete = requests.delete(
            f"{BASE_URL}/api/users/{owner_session['user']['id']}",
            headers=owner_session["headers"],
            timeout=20,
        )
        assert self_delete.status_code == 400
        assert "diri sendiri" in self_delete.json().get("detail", "").lower()

        disposable = _create_user(owner_session["headers"], "tim", "delete_tim")
        deleted = requests.delete(
            f"{BASE_URL}/api/users/{disposable['id']}",
            headers=owner_session["headers"],
            timeout=20,
        )
        assert deleted.status_code in (200, 204)
        assert deleted.json().get("ok") is True
        assert _login(disposable["username"], disposable["password"]).status_code == 401

    def test_user_mutations_return_404_for_unknown_id(self, owner_session):
        missing = f"missing-{RUN_ID}"
        patch = requests.patch(
            f"{BASE_URL}/api/users/{missing}",
            headers=owner_session["headers"],
            json={"name": "TEST missing"},
            timeout=20,
        )
        assert patch.status_code == 404
        delete = requests.delete(
            f"{BASE_URL}/api/users/{missing}", headers=owner_session["headers"], timeout=20
        )
        assert delete.status_code == 404


class TestProjectsLocationsAndAssignments:
    """Project/location CRUD role matrix, PIC assignment, teammate assignment, and duplicates."""

    def test_project_crud_role_matrix(self, owner_session):
        penagihan = STATE["users"]["penagihan"]
        response = requests.post(
            f"{BASE_URL}/api/projects",
            headers=_headers(penagihan["token"]),
            json={
                "name": f"TEST Proyek {RUN_ID}",
                "client_name": "TEST Client",
                "description": "Created by penagihan",
                "status": "aktif",
            },
            timeout=20,
        )
        assert response.status_code in (200, 201), response.text
        project = response.json()
        STATE["projects"].append(project["id"])
        assert project["created_by"] == penagihan["id"]
        assert project["status"] == "aktif"

        updated = requests.patch(
            f"{BASE_URL}/api/projects/{project['id']}",
            headers=owner_session["headers"],
            json={
                "name": f"TEST Proyek Updated {RUN_ID}",
                "client_name": "TEST Client Updated",
                "description": "Updated by owner",
                "status": "ditunda",
            },
            timeout=20,
        )
        assert updated.status_code == 200
        assert updated.json()["name"] == f"TEST Proyek Updated {RUN_ID}"
        assert updated.json()["status"] == "ditunda"
        listed = requests.get(
            f"{BASE_URL}/api/projects", headers=owner_session["headers"], timeout=20
        )
        assert listed.status_code == 200
        assert any(p["id"] == project["id"] and p["status"] == "ditunda" for p in listed.json())

        forbidden = requests.post(
            f"{BASE_URL}/api/projects",
            headers=_headers(STATE["users"]["bendahara"]["token"]),
            json={"name": "TEST forbidden", "client_name": "TEST", "status": "aktif"},
            timeout=20,
        )
        assert forbidden.status_code == 403

        disposable = requests.post(
            f"{BASE_URL}/api/projects",
            headers=owner_session["headers"],
            json={"name": f"TEST Delete Project {RUN_ID}", "client_name": "TEST", "status": "aktif"},
            timeout=20,
        )
        assert disposable.status_code in (200, 201)
        disposable_id = disposable.json()["id"]
        STATE["projects"].append(disposable_id)
        deleted = requests.delete(
            f"{BASE_URL}/api/projects/{disposable_id}",
            headers=owner_session["headers"],
            timeout=20,
        )
        assert deleted.status_code in (200, 204)
        after_delete = requests.get(
            f"{BASE_URL}/api/projects", headers=owner_session["headers"], timeout=20
        )
        assert all(p["id"] != disposable_id for p in after_delete.json())

    def test_location_crud_pic_and_role_matrix(self, owner_session):
        project_id = STATE["projects"][0]
        tim_id = STATE["users"]["tim"]["id"]
        bendahara_headers = _headers(STATE["users"]["bendahara"]["token"])
        for label in ("A", "B"):
            response = requests.post(
                f"{BASE_URL}/api/locations",
                headers=bendahara_headers if label == "A" else owner_session["headers"],
                json={
                    "project_id": project_id,
                    "name": f"TEST Lokasi {label} {RUN_ID}",
                    "address": f"Alamat {label}",
                    "pic_user_id": tim_id,
                    "status": "aktif",
                },
                timeout=20,
            )
            assert response.status_code in (200, 201), response.text
            location = response.json()
            STATE["locations"].append(location["id"])
            assert location["project_id"] == project_id
            assert location["pic_user_id"] == tim_id
        updated = requests.patch(
            f"{BASE_URL}/api/locations/{STATE['locations'][0]}",
            headers=bendahara_headers,
            json={
                "project_id": project_id,
                "name": f"TEST Lokasi A Updated {RUN_ID}",
                "address": "Alamat updated",
                "pic_user_id": tim_id,
                "status": "aktif",
            },
            timeout=20,
        )
        assert updated.status_code == 200
        assert updated.json()["address"] == "Alamat updated"
        forbidden = requests.post(
            f"{BASE_URL}/api/locations",
            headers=_headers(STATE["users"]["penagihan"]["token"]),
            json={"project_id": project_id, "name": "TEST forbidden"},
            timeout=20,
        )
        assert forbidden.status_code == 403

        disposable = requests.post(
            f"{BASE_URL}/api/locations",
            headers=owner_session["headers"],
            json={"project_id": project_id, "name": f"TEST Delete Location {RUN_ID}"},
            timeout=20,
        )
        assert disposable.status_code in (200, 201)
        disposable_id = disposable.json()["id"]
        STATE["locations"].append(disposable_id)
        deleted = requests.delete(
            f"{BASE_URL}/api/locations/{disposable_id}",
            headers=owner_session["headers"],
            timeout=20,
        )
        assert deleted.status_code in (200, 204)
        after_delete = requests.get(
            f"{BASE_URL}/api/locations", headers=owner_session["headers"], timeout=20
        )
        assert all(location["id"] != disposable_id for location in after_delete.json())

    def test_assignment_rules_duplicate_and_tim_scope(self, owner_session):
        tim1 = STATE["users"]["tim"]
        tim2 = _create_user(owner_session["headers"], "tim", "tim2")
        tim3 = _create_user(owner_session["headers"], "tim", "tim3")
        for user in (tim2, tim3):
            logged = _login(user["username"], user["password"])
            assert logged.status_code == 200
            user["token"] = logged.json()["token"]

        assign1 = requests.post(
            f"{BASE_URL}/api/assignments",
            headers=owner_session["headers"],
            json={"location_id": STATE["locations"][0], "user_id": tim1["id"], "daily_rate": 150000},
            timeout=20,
        )
        assert assign1.status_code in (200, 201), assign1.text
        STATE["assignments"].append(assign1.json()["id"])

        duplicate = requests.post(
            f"{BASE_URL}/api/assignments",
            headers=owner_session["headers"],
            json={"location_id": STATE["locations"][0], "user_id": tim1["id"], "daily_rate": 175000},
            timeout=20,
        )
        assert duplicate.status_code == 400

        teammate = requests.post(
            f"{BASE_URL}/api/assignments",
            headers=_headers(tim1["token"]),
            json={"location_id": STATE["locations"][0], "user_id": tim2["id"], "daily_rate": 140000},
            timeout=20,
        )
        assert teammate.status_code in (200, 201), teammate.text
        STATE["assignments"].append(teammate.json()["id"])
        assert teammate.json()["added_by"] == tim1["id"]

        unassigned_location = requests.post(
            f"{BASE_URL}/api/assignments",
            headers=_headers(tim1["token"]),
            json={"location_id": STATE["locations"][1], "user_id": tim3["id"], "daily_rate": 140000},
            timeout=20,
        )
        assert unassigned_location.status_code == 403

        non_tim_target = requests.post(
            f"{BASE_URL}/api/assignments",
            headers=owner_session["headers"],
            json={
                "location_id": STATE["locations"][0],
                "user_id": STATE["users"]["penagihan"]["id"],
                "daily_rate": 100000,
            },
            timeout=20,
        )
        if non_tim_target.status_code in (200, 201) and non_tim_target.json().get("id"):
            STATE["assignments"].append(non_tim_target.json()["id"])
        assert non_tim_target.status_code == 400, "Assignments must target a tim user"

    def test_tim_assignment_and_location_listing_cannot_leak_other_location(self, owner_session):
        tim1 = STATE["users"]["tim"]
        tim3 = STATE["users"]["tim3"]
        other_assignment = requests.post(
            f"{BASE_URL}/api/assignments",
            headers=owner_session["headers"],
            json={"location_id": STATE["locations"][1], "user_id": tim3["id"], "daily_rate": 140000},
            timeout=20,
        )
        assert other_assignment.status_code in (200, 201)
        STATE["assignments"].append(other_assignment.json()["id"])

        tim_headers = _headers(tim1["token"])
        locations = requests.get(f"{BASE_URL}/api/locations", headers=tim_headers, timeout=20)
        assert locations.status_code == 200
        location_ids = {location["id"] for location in locations.json()}
        assert STATE["locations"][0] in location_ids
        assert STATE["locations"][1] not in location_ids

        assignments = requests.get(
            f"{BASE_URL}/api/assignments",
            params={"location_id": STATE["locations"][1]},
            headers=tim_headers,
            timeout=20,
        )
        assert assignments.status_code == 403 or assignments.json() == []

    def test_project_and_location_missing_ids_return_404(self, owner_session):
        missing = f"missing-{RUN_ID}"
        project_patch = requests.patch(
            f"{BASE_URL}/api/projects/{missing}",
            headers=owner_session["headers"],
            json={"name": "TEST missing", "client_name": "TEST", "status": "aktif"},
            timeout=20,
        )
        assert project_patch.status_code == 404

    def test_missing_location_update_returns_404(self, owner_session):
        missing = f"missing-location-{RUN_ID}"
        location_patch = requests.patch(
            f"{BASE_URL}/api/locations/{missing}",
            headers=owner_session["headers"],
            json={"project_id": STATE["projects"][0], "name": "TEST missing", "status": "aktif"},
            timeout=20,
        )
        assert location_patch.status_code == 404


class TestFinancialFlowsIsolationAndDashboard:
    """Cashbook, kasbon, invoice, payroll, activity audit, isolation, and role-aware dashboard."""

    def test_cashbook_receipt_role_access_and_project_autofill(self, owner_session):
        image = "data:image/png;base64," + base64.b64encode(b"TEST_RECEIPT").decode()
        empty = requests.post(
            f"{BASE_URL}/api/cashbook",
            headers=owner_session["headers"],
            json={
                "location_id": STATE["locations"][0], "type": "pengeluaran", "category": "Material",
                "amount": 250000, "description": "TEST empty receipt", "receipt_base64": "",
            },
            timeout=20,
        )
        assert empty.status_code == 400

        forbidden = requests.post(
            f"{BASE_URL}/api/cashbook",
            headers=_headers(STATE["users"]["penagihan"]["token"]),
            json={
                "location_id": STATE["locations"][0], "type": "pemasukan", "category": "Termin",
                "amount": 100000, "description": "TEST forbidden", "receipt_base64": image,
            },
            timeout=20,
        )
        assert forbidden.status_code == 403

        creators = [
            (STATE["users"]["tim"], STATE["locations"][0], "pengeluaran", 250000),
            (owner_session, STATE["locations"][1], "pemasukan", 900000),
        ]
        for actor, location_id, cash_type, amount in creators:
            headers = actor["headers"] if "headers" in actor else _headers(actor["token"])
            response = requests.post(
                f"{BASE_URL}/api/cashbook",
                headers=headers,
                json={
                    "location_id": location_id, "type": cash_type, "category": "TEST category",
                    "amount": amount, "description": f"TEST cash {RUN_ID} {location_id}",
                    "receipt_base64": image,
                },
                timeout=20,
            )
            assert response.status_code in (200, 201), response.text
            entry = response.json()
            STATE["cashbook"].append(entry["id"])
            assert entry["project_id"] == STATE["projects"][0]
            assert entry["receipt_base64"] == image
            assert entry["amount"] == amount

    def test_tim_cashbook_location_isolation(self):
        tim_headers = _headers(STATE["users"]["tim"]["token"])
        listed = requests.get(f"{BASE_URL}/api/cashbook", headers=tim_headers, timeout=20)
        assert listed.status_code == 200
        ids = {e["id"] for e in listed.json()}
        assert STATE["cashbook"][0] in ids
        assert STATE["cashbook"][1] not in ids
        forbidden = requests.get(
            f"{BASE_URL}/api/cashbook",
            params={"location_id": STATE["locations"][1]},
            headers=tim_headers,
            timeout=20,
        )
        assert forbidden.status_code == 403

    def test_cashbook_rejects_malformed_receipt_base64(self, owner_session):
        malformed = requests.post(
            f"{BASE_URL}/api/cashbook",
            headers=owner_session["headers"],
            json={
                "location_id": STATE["locations"][0], "type": "pengeluaran", "category": "Material",
                "amount": 250000, "description": "TEST malformed receipt", "receipt_base64": "not-base64",
            },
            timeout=20,
        )
        if malformed.status_code in (200, 201) and malformed.json().get("id"):
            STATE["cashbook"].append(malformed.json()["id"])
        assert malformed.status_code == 400, "receipt_base64 must contain valid base64 image data"

    def test_kasbon_create_get_status_and_location_isolation(self, owner_session):
        tim = STATE["users"]["tim"]
        tim_headers = _headers(tim["token"])
        for location_id, actor_headers, amount in (
            (STATE["locations"][0], tim_headers, 100000),
            (STATE["locations"][1], owner_session["headers"], 200000),
        ):
            response = requests.post(
                f"{BASE_URL}/api/kasbon",
                headers=actor_headers,
                json={
                    "location_id": location_id, "borrower_user_id": tim["id"], "amount": amount,
                    "description": f"TEST kasbon {RUN_ID} {location_id}",
                },
                timeout=20,
            )
            assert response.status_code in (200, 201), response.text
            record = response.json()
            STATE["kasbon"].append(record["id"])
            assert record["status"] == "pending"
            assert record["project_id"] == STATE["projects"][0]
            assert record["borrower_name"] == tim["name"]

        listed = requests.get(f"{BASE_URL}/api/kasbon", headers=tim_headers, timeout=20)
        assert listed.status_code == 200
        ids = {k["id"] for k in listed.json()}
        assert STATE["kasbon"][0] in ids
        assert STATE["kasbon"][1] not in ids

        tim_patch = requests.patch(
            f"{BASE_URL}/api/kasbon/{STATE['kasbon'][0]}",
            headers=tim_headers,
            json={"status": "lunas"},
            timeout=20,
        )
        assert tim_patch.status_code == 403

        owner_patch = requests.patch(
            f"{BASE_URL}/api/kasbon/{STATE['kasbon'][0]}",
            headers=owner_session["headers"],
            json={"status": "lunas"},
            timeout=20,
        )
        assert owner_patch.status_code == 200
        assert owner_patch.json()["status"] == "lunas"

        inaccessible = requests.get(
            f"{BASE_URL}/api/kasbon",
            params={"location_id": STATE["locations"][1]},
            headers=tim_headers,
            timeout=20,
        )
        assert inaccessible.status_code == 403

    def test_tagihan_crud_overdue_and_paid_status(self, owner_session):
        penagihan_headers = _headers(STATE["users"]["penagihan"]["token"])
        past_due = (datetime.now(timezone.utc).date() - timedelta(days=2)).isoformat()
        response = requests.post(
            f"{BASE_URL}/api/tagihan",
            headers=penagihan_headers,
            json={
                "project_id": STATE["projects"][0], "invoice_number": f"TEST-INV-{RUN_ID}",
                "client_name": "TEST Client", "items": [
                    {"description": "Pekerjaan A", "amount": 350000},
                    {"description": "Pekerjaan B", "amount": 150000},
                ], "due_date": past_due, "notes": "TEST overdue",
            },
            timeout=20,
        )
        assert response.status_code in (200, 201), response.text
        invoice = response.json()
        STATE["tagihan"].append(invoice["id"])
        assert invoice["total"] == 500000
        assert invoice["paid_amount"] == 0
        assert invoice["status"] == "draft"

        listed = requests.get(f"{BASE_URL}/api/tagihan", headers=penagihan_headers, timeout=20)
        assert listed.status_code == 200
        fetched = next(t for t in listed.json() if t["id"] == invoice["id"])
        assert fetched["status"] == "jatuh_tempo"

        paid = requests.patch(
            f"{BASE_URL}/api/tagihan/{invoice['id']}",
            headers=owner_session["headers"],
            json={"paid_amount": 500000},
            timeout=20,
        )
        assert paid.status_code == 200
        assert paid.json()["paid_amount"] == 500000
        assert paid.json()["status"] == "lunas"

        forbidden = requests.post(
            f"{BASE_URL}/api/tagihan",
            headers=_headers(STATE["users"]["bendahara"]["token"]),
            json={
                "project_id": STATE["projects"][0], "invoice_number": f"TEST-FORBID-{RUN_ID}",
                "client_name": "TEST", "items": [{"description": "X", "amount": 1}],
                "due_date": datetime.now(timezone.utc).date().isoformat(),
            },
            timeout=20,
        )
        assert forbidden.status_code == 403

        disposable = requests.post(
            f"{BASE_URL}/api/tagihan",
            headers=owner_session["headers"],
            json={
                "project_id": STATE["projects"][0], "invoice_number": f"TEST-DELETE-{RUN_ID}",
                "client_name": "TEST", "items": [{"description": "Delete", "amount": 10}],
                "due_date": datetime.now(timezone.utc).date().isoformat(),
            },
            timeout=20,
        )
        assert disposable.status_code in (200, 201)
        disposable_id = disposable.json()["id"]
        STATE["tagihan"].append(disposable_id)
        deleted = requests.delete(
            f"{BASE_URL}/api/tagihan/{disposable_id}", headers=penagihan_headers, timeout=20
        )
        assert deleted.status_code in (200, 204)
        after_delete = requests.get(f"{BASE_URL}/api/tagihan", headers=penagihan_headers, timeout=20)
        assert all(item["id"] != disposable_id for item in after_delete.json())

    def test_team_payment_computation_roles_and_paid_update(self, owner_session):
        payload = {
            "location_id": STATE["locations"][0],
            "user_id": STATE["users"]["tim"]["id"],
            "period_start": (datetime.now(timezone.utc).date() - timedelta(days=7)).isoformat(),
            "period_end": datetime.now(timezone.utc).date().isoformat(),
            "days_worked": 6,
            "daily_rate": 150000,
            "kasbon_deduction": 100000,
            "bonus": 50000,
            "notes": f"TEST payroll {RUN_ID}",
        }
        response = requests.post(
            f"{BASE_URL}/api/team-payments",
            headers=_headers(STATE["users"]["bendahara"]["token"]),
            json=payload,
            timeout=20,
        )
        assert response.status_code in (200, 201), response.text
        payment = response.json()
        STATE["team_payments"].append(payment["id"])
        assert payment["gross"] == 950000
        assert payment["net"] == 850000
        assert payment["paid"] is False
        assert payment["user_name"] == STATE["users"]["tim"]["name"]

        forbidden = requests.post(
            f"{BASE_URL}/api/team-payments",
            headers=_headers(STATE["users"]["tim"]["token"]),
            json=payload,
            timeout=20,
        )
        assert forbidden.status_code == 403

        paid = requests.patch(
            f"{BASE_URL}/api/team-payments/{payment['id']}",
            headers=owner_session["headers"],
            json={"paid": True},
            timeout=20,
        )
        assert paid.status_code == 200
        assert paid.json()["paid"] is True
        assert paid.json().get("paid_at")

    def test_activities_owner_only_and_all_mutations_logged(self, owner_session):
        forbidden = requests.get(
            f"{BASE_URL}/api/activities",
            headers=_headers(STATE["users"]["bendahara"]["token"]),
            timeout=20,
        )
        assert forbidden.status_code == 403

        disposable = requests.post(
            f"{BASE_URL}/api/team-payments",
            headers=owner_session["headers"],
            json={
                "location_id": STATE["locations"][0], "user_id": STATE["users"]["tim"]["id"],
                "period_start": datetime.now(timezone.utc).date().isoformat(), "period_end": datetime.now(timezone.utc).date().isoformat(),
                "days_worked": 1, "daily_rate": 100000, "kasbon_deduction": 0,
                "bonus": 0, "notes": f"TEST audit delete {RUN_ID}",
            },
            timeout=20,
        )
        assert disposable.status_code in (200, 201)
        payment_id = disposable.json()["id"]
        STATE["team_payments"].append(payment_id)
        deleted = requests.delete(
            f"{BASE_URL}/api/team-payments/{payment_id}",
            headers=owner_session["headers"],
            timeout=20,
        )
        assert deleted.status_code in (200, 204)

        response = requests.get(
            f"{BASE_URL}/api/activities",
            params={"limit": 500},
            headers=owner_session["headers"],
            timeout=20,
        )
        assert response.status_code == 200
        activities = response.json()
        assert isinstance(activities, list)
        assert all("password_hash" not in item and "_id" not in item for item in activities)
        assert any(a["entity_type"] == "cashbook" and a["action"] == "create" and a["entity_id"] == STATE["cashbook"][0] for a in activities)
        assert any(a["entity_type"] == "tagihan" and a["action"] == "update" and a["entity_id"] == STATE["tagihan"][0] for a in activities)
        assert any(a["entity_type"] == "team_payment" and a["action"] == "delete" and a["entity_id"] == payment_id for a in activities)

    def test_dashboard_stats_are_role_appropriate_and_tim_isolated(self, owner_session):
        unassigned = requests.post(
            f"{BASE_URL}/api/projects",
            headers=owner_session["headers"],
            json={"name": f"TEST Unassigned Project {RUN_ID}", "client_name": "TEST", "status": "aktif"},
            timeout=20,
        )
        assert unassigned.status_code in (200, 201)
        STATE["projects"].append(unassigned.json()["id"])

        owner = requests.get(
            f"{BASE_URL}/api/dashboard/stats", headers=owner_session["headers"], timeout=20
        )
        assert owner.status_code == 200
        owner_stats = owner.json()
        for key in (
            "total_pemasukan", "total_pengeluaran", "saldo", "jumlah_lokasi", "jumlah_proyek",
            "jumlah_user", "total_tagihan", "total_terbayar", "tagihan_jatuh_tempo", "kasbon_pending",
        ):
            assert key in owner_stats
        assert owner_stats["saldo"] == pytest.approx(owner_stats["total_pemasukan"] - owner_stats["total_pengeluaran"])

        tim_headers = _headers(STATE["users"]["tim"]["token"])
        tim_stats_response = requests.get(
            f"{BASE_URL}/api/dashboard/stats", headers=tim_headers, timeout=20
        )
        assert tim_stats_response.status_code == 200
        tim_stats = tim_stats_response.json()
        assert tim_stats["jumlah_lokasi"] == 1
        assert tim_stats["total_pengeluaran"] >= 250000
        assert tim_stats["total_pemasukan"] < owner_stats["total_pemasukan"]
        assert "total_tagihan" not in tim_stats
        assert "kasbon_pending" not in tim_stats
        tim_projects = requests.get(f"{BASE_URL}/api/projects", headers=tim_headers, timeout=20)
        assert tim_projects.status_code == 200
        assert tim_stats["jumlah_proyek"] == len(tim_projects.json())
