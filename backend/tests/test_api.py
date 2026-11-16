import uuid
from datetime import datetime, timedelta, timezone

import jwt

from tests.db_guard import assert_test_database


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _register(client, email="ada@example.com", name="Ada Lovelace", password="password123"):
    response = client.post(
        "/auth/register",
        json={"name": name, "email": email, "password": password},
    )
    assert response.status_code == 201, response.text
    body = response.json()
    return body["access_token"], body["user"]


def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_refuses_non_test_database():
    try:
        assert_test_database("postgresql+psycopg://jigo:jigo@127.0.0.1:5432/jigo")
    except RuntimeError as exc:
        assert "jigo" in str(exc)
    else:
        raise AssertionError("expected non-test database to be refused")


def test_register_login_and_me(client):
    token, user = _register(client, email="Ada@Example.com", name="  Ada  ")
    assert user["name"] == "Ada"
    assert user["email"] == "ada@example.com"
    assert "password" not in user

    me = client.get("/auth/me", headers=_auth(token))
    assert me.status_code == 200
    assert me.json()["id"] == user["id"]

    login = client.post(
        "/auth/login",
        json={"email": "ada@example.com", "password": "password123"},
    )
    assert login.status_code == 200
    assert login.json()["token_type"] == "bearer"
    assert "password_hash" not in login.json()["user"]

    bad = client.post(
        "/auth/login",
        json={"email": "ada@example.com", "password": "wrong-password"},
    )
    assert bad.status_code == 401
    unknown = client.post(
        "/auth/login",
        json={"email": "missing@example.com", "password": "password123"},
    )
    assert unknown.status_code == 401
    assert unknown.json()["detail"] == bad.json()["detail"]


def test_register_validation_and_duplicate(client):
    short = client.post(
        "/auth/register",
        json={"name": "Ada", "email": "ada@example.com", "password": "short"},
    )
    assert short.status_code == 422
    blank = client.post(
        "/auth/register",
        json={"name": "   ", "email": "ada@example.com", "password": "password123"},
    )
    assert blank.status_code == 422

    _register(client)
    again = client.post(
        "/auth/register",
        json={"name": "Ada", "email": "ADA@example.com", "password": "password123"},
    )
    assert again.status_code == 409


def test_rejects_missing_and_forged_tokens(client):
    missing = client.get("/conversations")
    assert missing.status_code == 401

    forged = jwt.encode(
        {
            "sub": str(uuid.uuid4()),
            "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
        },
        "other-secret-please-use-32-bytes-min",
        algorithm="HS256",
    )
    rejected = client.get("/auth/me", headers=_auth(forged))
    assert rejected.status_code == 401


def test_conversations_and_messages_are_private(client):
    token_a, _user_a = _register(client, email="a@example.com", name="A")
    token_b, _user_b = _register(client, email="b@example.com", name="B")

    created = client.post("/conversations", json={}, headers=_auth(token_a))
    assert created.status_code == 201, created.text
    conversation = created.json()
    assert conversation["title"] == "New chat"
    assert conversation["preview"] is None
    conversation_id = conversation["id"]

    hidden = client.get(f"/conversations/{conversation_id}", headers=_auth(token_b))
    assert hidden.status_code == 404
    assert client.get("/conversations", headers=_auth(token_b)).json() == []

    blocked = client.post(
        f"/conversations/{conversation_id}/messages",
        json={"role": "user", "content": "secret"},
        headers=_auth(token_b),
    )
    assert blocked.status_code == 404

    long_content = "x" * 250
    message = client.post(
        f"/conversations/{conversation_id}/messages",
        json={"role": "user", "content": f"  {long_content}  "},
        headers=_auth(token_a),
    )
    assert message.status_code == 201, message.text
    assert message.json()["content"] == long_content
    after_user = client.get(f"/conversations/{conversation_id}", headers=_auth(token_a))
    assert after_user.json()["preview"] == "x" * 200
    reply = client.post(
        f"/conversations/{conversation_id}/messages",
        json={"role": "assistant", "content": "hello"},
        headers=_auth(token_a),
    )
    assert reply.status_code == 201

    listed = client.get(f"/conversations/{conversation_id}/messages", headers=_auth(token_a))
    assert [item["role"] for item in listed.json()] == ["user", "assistant"]

    updated = client.get(f"/conversations/{conversation_id}", headers=_auth(token_a))
    assert updated.json()["preview"] == "hello"

    renamed = client.patch(
        f"/conversations/{conversation_id}",
        json={"title": "  Status update  "},
        headers=_auth(token_a),
    )
    assert renamed.status_code == 200
    assert renamed.json()["title"] == "Status update"

    bad_role = client.post(
        f"/conversations/{conversation_id}/messages",
        json={"role": "tool", "content": "nope"},
        headers=_auth(token_a),
    )
    assert bad_role.status_code == 422

    deleted = client.delete(f"/conversations/{conversation_id}", headers=_auth(token_a))
    assert deleted.status_code == 204
    assert client.get(f"/conversations/{conversation_id}", headers=_auth(token_a)).status_code == 404
    assert (
        client.get(f"/conversations/{conversation_id}/messages", headers=_auth(token_a)).status_code
        == 404
    )


def test_documents_are_scoped_to_the_owner(client):
    token_a, _user_a = _register(client, email="docs-a@example.com")
    token_b, _user_b = _register(client, email="docs-b@example.com")

    created = client.post(
        "/documents",
        json={"name": " notes.md ", "file_type": "md", "size": "2 KB", "source": " upload "},
        headers=_auth(token_a),
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["name"] == "notes.md"
    assert body["file_type"] == "md"
    assert body["status"] == "processing"
    assert body["source"] == "upload"
    document_id = body["id"]

    listed = client.get("/documents", headers=_auth(token_a))
    assert [item["id"] for item in listed.json()] == [document_id]
    assert client.get("/documents", headers=_auth(token_b)).json() == []
    assert client.get(f"/documents/{document_id}", headers=_auth(token_b)).status_code == 404

    invalid = client.post(
        "/documents",
        json={"name": "x", "file_type": "pdf", "size": "1 KB", "status": "done"},
        headers=_auth(token_a),
    )
    assert invalid.status_code == 422

    assert client.delete(f"/documents/{document_id}", headers=_auth(token_b)).status_code == 404
    assert client.delete(f"/documents/{document_id}", headers=_auth(token_a)).status_code == 204
    assert client.get(f"/documents/{document_id}", headers=_auth(token_a)).status_code == 404


def test_reminders_complete_snooze_and_delete(client):
    token, _user = _register(client, email="reminders@example.com")
    other, _other_user = _register(client, email="other@example.com")

    later = client.post(
        "/reminders",
        json={
            "title": " Send notes ",
            "due_at": "2026-12-02T15:00:00Z",
            "priority": "high",
            "source_provider": "slack",
            "source_label": "standup",
        },
        headers=_auth(token),
    )
    sooner = client.post(
        "/reminders",
        json={"title": "Review", "due_at": "2026-12-01T09:00:00", "priority": "low"},
        headers=_auth(token),
    )
    assert later.status_code == 201, later.text
    assert sooner.status_code == 201, sooner.text
    assert sooner.json()["completed"] is False
    assert sooner.json()["due_at"].startswith("2026-12-01T09:00:00")

    listed = client.get("/reminders", headers=_auth(token))
    assert [item["title"] for item in listed.json()] == ["Review", "Send notes"]
    assert client.get("/reminders", headers=_auth(other)).json() == []

    reminder_id = later.json()["id"]
    patched = client.patch(
        f"/reminders/{reminder_id}",
        json={"completed": True, "due_at": "2026-12-03T00:00:00Z", "description": "  "},
        headers=_auth(token),
    )
    assert patched.status_code == 200, patched.text
    assert patched.json()["completed"] is True
    assert patched.json()["description"] is None
    assert patched.json()["due_at"].startswith("2026-12-03")

    bad = client.patch(f"/reminders/{reminder_id}", json={"priority": "urgent"}, headers=_auth(token))
    assert bad.status_code == 422
    assert client.delete(f"/reminders/{reminder_id}", headers=_auth(other)).status_code == 404
    assert client.delete(f"/reminders/{reminder_id}", headers=_auth(token)).status_code == 204
    assert client.get("/reminders", headers=_auth(token)).json()[0]["title"] == "Review"


def test_list_limit_is_bounded(client):
    token, _user = _register(client)
    response = client.get("/conversations", params={"limit": 0}, headers=_auth(token))
    assert response.status_code == 422
    response = client.get("/reminders", params={"limit": 101}, headers=_auth(token))
    assert response.status_code == 422
