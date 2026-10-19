from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy.pool import StaticPool

from .config import settings

_kw: dict = {"pool_pre_ping": True, "pool_recycle": 280}  # recycle before MySQL closes idle connections
if settings.database_url.startswith("sqlite"):  # used by the unit tests only
    _kw = {"connect_args": {"check_same_thread": False}}
    if ":memory:" in settings.database_url:
        _kw["poolclass"] = StaticPool

engine = create_engine(settings.database_url, future=True, **_kw)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    from . import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
