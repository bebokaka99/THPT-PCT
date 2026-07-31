from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


ROOT_DIR = Path(__file__).resolve().parent
INPUT_DIR = ROOT_DIR / "input"
OUTPUT_DIR = ROOT_DIR / "output"
PREVIEW_FILE = OUTPUT_DIR / "pct_import_preview.json"
REPORT_FILE = OUTPUT_DIR / "crawl_report.json"
DEBUG_HOMEPAGE_FILE = OUTPUT_DIR / "debug_homepage.html"


def _bool_env(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
      return default
    return value.strip().lower() in {"1", "true", "yes", "y", "on"}


@dataclass(frozen=True)
class Config:
    base_url: str
    entry_urls: list[str]
    max_pages_per_category: int
    max_total_posts: int
    request_delay_seconds: float
    dry_run: bool
    import_to_db: bool
    request_connect_timeout_seconds: float
    request_read_timeout_seconds: float
    max_retries: int
    retry_backoff_seconds: float
    local_input_path: Path | None
    user_agent: str
    database_url: str | None
    db_host: str
    db_port: int
    db_user: str
    db_password: str
    db_name: str


def load_config() -> Config:
    load_dotenv(ROOT_DIR / ".env")
    base_url = os.getenv("BASE_URL", "https://phanchutrinhbinhthuan.edu.vn").rstrip("/")
    entry_urls = _entry_urls(base_url)
    local_input_path = _local_input_path(os.getenv("LOCAL_INPUT_PATH"))

    return Config(
        base_url=base_url,
        entry_urls=entry_urls,
        max_pages_per_category=max(1, int(os.getenv("MAX_PAGES_PER_CATEGORY", "3"))),
        max_total_posts=max(1, int(os.getenv("MAX_TOTAL_POSTS", "30"))),
        request_delay_seconds=max(0.5, float(os.getenv("REQUEST_DELAY_SECONDS", "1.5"))),
        dry_run=_bool_env("DRY_RUN", True),
        import_to_db=_bool_env("IMPORT_TO_DB", False),
        request_connect_timeout_seconds=max(1.0, float(os.getenv("REQUEST_CONNECT_TIMEOUT_SECONDS", "10"))),
        request_read_timeout_seconds=max(5.0, float(os.getenv("REQUEST_READ_TIMEOUT_SECONDS", "30"))),
        max_retries=max(0, int(os.getenv("MAX_RETRIES", "2"))),
        retry_backoff_seconds=max(0.5, float(os.getenv("RETRY_BACKOFF_SECONDS", "2"))),
        local_input_path=local_input_path,
        user_agent=os.getenv(
            "USER_AGENT",
            "THPT-PCT-PT importer crawler/0.1 (+local admin import tool)",
        ),
        database_url=os.getenv("DATABASE_URL") or None,
        db_host=os.getenv("PGHOST", "localhost"),
        db_port=int(os.getenv("PGPORT", "55432")),
        db_user=os.getenv("PGUSER", "thpt_pct_pt"),
        db_password=os.getenv("PGPASSWORD", "thpt_pct_pt_dev"),
        db_name=os.getenv("PGDATABASE", "thpt_pct_pt"),
    )


def _entry_urls(base_url: str) -> list[str]:
    raw_value = os.getenv("ENTRY_URLS")
    if raw_value:
        candidates = [url.strip().rstrip("/") for url in raw_value.split(",") if url.strip()]
    else:
        candidates = [
            "https://phanchutrinhbinhthuan.edu.vn",
            "https://phanchutrinhbinhthuan.edu.vn/",
            "http://phanchutrinhbinhthuan.edu.vn",
            "http://phanchutrinhbinhthuan.edu.vn/",
            base_url,
        ]

    output: list[str] = []
    seen: set[str] = set()
    for url in candidates:
        normalized = url.rstrip("/")
        if normalized not in seen:
            seen.add(normalized)
            output.append(url)

    return output


def _local_input_path(raw_value: str | None) -> Path | None:
    if not raw_value or not raw_value.strip():
        return None

    path = Path(raw_value.strip())
    if not path.is_absolute():
        path = INPUT_DIR / path

    return path
