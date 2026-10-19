import os

# tests never touch your real DB: set TEST_DATABASE_URL to run them on a (throwaway) MySQL database
os.environ["DATABASE_URL"] = os.getenv("TEST_DATABASE_URL", "sqlite+pysqlite:///:memory:")
os.environ["MODEL_MODE"] = "mock"

import pytest
from fastapi.testclient import TestClient

from app import model_client
from app.config import settings
from app.db import Base, engine
from app.main import app


@pytest.fixture(autouse=True)
def clean():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    settings.api_key = None
    yield


@pytest.fixture
def client():
    return TestClient(app, raise_server_exceptions=False)


@pytest.fixture
def fake_model(monkeypatch):
    """fake_model(obj_or_exception) makes the model return / raise that."""
    def set_(result):
        class M:
            def call(self, text):
                if isinstance(result, Exception):
                    raise result
                return result
        monkeypatch.setattr("app.services.assessments.get_model", lambda: M())
    return set_
