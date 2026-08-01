import os
from pathlib import Path
from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import sessionmaker

BASE_DIR = Path(__file__).resolve().parents[2]


def _normalize_db_url(url: str) -> str:
    url = url.strip()
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+psycopg2://", 1)
    if url.startswith("postgresql://") and "+psycopg2" not in url:
        return url.replace("postgresql://", "postgresql+psycopg2://", 1)
    if url.startswith("mysql://"):
        return url.replace("mysql://", "mysql+pymysql://", 1)
    return url


def _discover_database_url() -> str:
    found = None
    candidates = [
        "DATABASE_URL",
        "POSTGRES_URL",
        "POSTGRESQL_URL",
        "MYSQL_URL",
        "JAWSDB_URL",
        "CLEARDB_DATABASE_URL",
    ]
    for name in candidates:
        value = os.getenv(name)
        if value:
            found = value
            break
    if found:
        return found

    host = os.getenv("PGHOST") or os.getenv("POSTGRES_HOST")
    user = os.getenv("PGUSER") or os.getenv("POSTGRES_USER")
    password = os.getenv("PGPASSWORD") or os.getenv("POSTGRES_PASSWORD")
    port = os.getenv("PGPORT") or os.getenv("POSTGRES_PORT", "5432")
    database = os.getenv("PGDATABASE") or os.getenv("POSTGRES_DB")
    if host and user and database:
        return f"postgresql+psycopg2://{user}:{password}@{host}:{port}/{database}"

    if os.environ.get("RAILWAY_PUBLIC_DOMAIN"):
        raise RuntimeError(
            "Running on Railway but DATABASE_URL is not set. "
            "Attach a Postgres database to BOTH services and set DATABASE_URL."
        )

    return f"sqlite:///{BASE_DIR / 'kundalik.db'}"


DATABASE_URL = _normalize_db_url(_discover_database_url())

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args, future=True)


if DATABASE_URL.startswith("sqlite"):

    @event.listens_for(engine, "connect")
    def enable_sqlite_foreign_keys(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()
