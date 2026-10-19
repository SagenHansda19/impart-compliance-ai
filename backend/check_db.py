"""Check that the backend can use your PostgreSQL or MySQL server.
   python check_db.py            (reads DATABASE_URL from backend/.env or the environment)
   python check_db.py --create-db   (also creates the database if it does not exist)
"""
import sys

from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import OperationalError, ProgrammingError

from app.config import settings

OK, BAD = "[ OK ]", "[FAIL]"
HINTS = {
    1045: "Wrong user name or password. Check DATABASE_URL. Special characters in the password must be URL-encoded (@ -> %40, # -> %23, / -> %2F).",
    1049: "That database does not exist. Create it or re-run this check with --create-db",
    2003: "Cannot reach the database server. Is it running? Check the host and port in DATABASE_URL.",
    2005: "Unknown host name in DATABASE_URL.",
}


def explain(e: Exception) -> str:
    orig = getattr(e, "orig", None)
    code = orig.args[0] if orig is not None and orig.args and isinstance(orig.args[0], int) else None
    msg = str(orig or e)
    if "No module named 'psycopg2'" in msg or "No module named 'psycopg'" in msg:
        return "The PostgreSQL driver is missing:  pip install psycopg2-binary"
    if "No module named 'pymysql'" in msg:
        return "The MySQL driver is missing:  pip install pymysql"
    return HINTS.get(code, "") + f"\n       Database said: {msg[:300]}"


def main() -> int:
    url = make_url(settings.database_url)
    shown = url.render_as_string(hide_password=True)
    print(f"Checking {shown}")
    
    is_postgres = url.drivername.startswith("postgres")
    is_mysql = url.drivername.startswith("mysql")

    if not (is_postgres or is_mysql):
        print(f"{BAD} DATABASE_URL driver '{url.drivername}' is not supported. Expected postgresql+psycopg2://... or mysql+pymysql://...")
        return 1

    if "--create-db" in sys.argv and url.database:
        try:
            if is_postgres:
                # Postgres requires connecting to default 'postgres' database to create a new one
                server_url = url._replace(database="postgres")
                server = create_engine(server_url, isolation_level="AUTOCOMMIT")
                with server.connect() as c:
                    exists = c.execute(text(f"SELECT 1 FROM pg_database WHERE datname = '{url.database}'")).scalar()
                    if not exists:
                        c.execute(text(f"CREATE DATABASE {url.database}"))
                print(f"{OK} PostgreSQL database '{url.database}' exists (created if it was missing)")
            else:
                server = create_engine(url._replace(database=None))
                with server.begin() as c:
                    c.execute(text(f"CREATE DATABASE IF NOT EXISTS `{url.database}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"))
                print(f"{OK} MySQL database '{url.database}' exists (created if it was missing)")
        except Exception as e:
            print(f"{BAD} could not create the database: {explain(e)}")
            return 1

    try:
        engine = create_engine(url)
        with engine.connect() as c:
            if is_postgres:
                version = c.execute(text("SELECT version()")).scalar()
                print(f"{OK} connected to PostgreSQL. Server version: {version[:80]}")
                # Optional: ensure vector extension exists for pgvector support
                try:
                    c.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
                    c.commit()
                    print(f"{OK} pgvector extension enabled.")
                except Exception:
                    pass
            else:
                version = c.execute(text("SELECT VERSION()")).scalar()
                charset = c.execute(text("SELECT @@character_set_database")).scalar()
                print(f"{OK} connected to MySQL. Server version {version}, charset {charset}")
    except (OperationalError, ProgrammingError, ModuleNotFoundError, ImportError) as e:
        print(f"{BAD} cannot connect: {explain(e)}")
        return 1

    try:
        from app import models  # noqa: F401
        from app.db import Base
        from app.models import ChangeRequest

        Base.metadata.create_all(engine)
        print(f"{OK} tables ready: {', '.join(sorted(Base.metadata.tables))}")
        from sqlalchemy.orm import Session

        with Session(engine) as s:  # write + read + JSON round trip, then undo everything
            row = ChangeRequest(text="check_db test ✓ café", text_hash="check_db_test_" + "0" * 50, source_type="text")
            s.add(row)
            s.flush()
            back = s.get(ChangeRequest, row.id)
            assert back is not None and back.text == "check_db test ✓ café"
            s.rollback()
        print(f"{OK} write/read test passed (and rolled back, nothing was left in your tables)")
    except Exception as e:
        print(f"{BAD} table check failed: {explain(e)}")
        return 1

    print("\nAll good. Start the backend:  uvicorn app.main:app --port 8080")
    return 0


if __name__ == "__main__":
    sys.exit(main())