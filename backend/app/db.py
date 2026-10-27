from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy.pool import StaticPool

from .config import settings

_kw: dict = {"pool_pre_ping": True, "pool_recycle": 280}  # recycle before MySQL closes idle connections
db_url = settings.database_url
if db_url.startswith("sqlite"):  # used by the unit tests only
    _kw = {"connect_args": {"check_same_thread": False}}
    if ":memory:" in db_url:
        _kw["poolclass"] = StaticPool
elif db_url.startswith("postgresql://"):
    # SQLAlchemy 2.0 defaults postgresql:// to psycopg (v3). Use psycopg2 if +driver is omitted.
    db_url = db_url.replace("postgresql://", "postgresql+psycopg2://", 1)

engine = create_engine(db_url, future=True, **_kw)
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
