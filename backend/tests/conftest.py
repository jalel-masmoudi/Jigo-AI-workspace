import atexit
import os
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import text

from tests.db_guard import assert_test_database

ROOT = Path(__file__).resolve().parents[1]
_container = None


def _postgres_url() -> str:
    global _container
    os.environ.setdefault("JWT_SECRET", "test-jwt-secret-please-change-me")
    url = os.environ.get("DATABASE_URL")
    if url:
        assert_test_database(url)
        return url

    from testcontainers.postgres import PostgresContainer

    _container = PostgresContainer("postgres:16-alpine")
    _container.start()
    atexit.register(_container.stop)
    raw = _container.get_connection_url()
    raw = raw.replace("postgresql+psycopg2://", "postgresql+psycopg://")
    if raw.startswith("postgresql://"):
        raw = "postgresql+psycopg://" + raw[len("postgresql://") :]
    if raw.startswith("postgres://"):
        raw = "postgresql+psycopg://" + raw[len("postgres://") :]
    os.environ["DATABASE_URL"] = raw
    assert_test_database(raw)
    return raw


_postgres_url()


@pytest.fixture(scope="session", autouse=True)
def apply_migrations():
    cfg = Config(str(ROOT / "alembic.ini"))
    cfg.set_main_option("script_location", str(ROOT / "alembic"))
    command.upgrade(cfg, "head")
    import app.database  # noqa: F401

    yield


@pytest.fixture(autouse=True)
def clean_tables(apply_migrations):
    yield
    from app.database import engine

    with engine.begin() as conn:
        conn.execute(
            text(
                "TRUNCATE messages, reminders, documents, conversations, users "
                "RESTART IDENTITY CASCADE"
            )
        )


@pytest.fixture
def client():
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as test_client:
        yield test_client
