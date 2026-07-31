from __future__ import annotations

import json
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

import requests

from config import DEBUG_HOMEPAGE_FILE, INPUT_DIR, OUTPUT_DIR, PREVIEW_FILE, REPORT_FILE, Config, load_config
from db import import_contents
from normalizer import clean_html, extract_text_from_html, normalize_url, normalize_whitespace, slugify
from parser import (
    ImportedContent,
    build_list_page_urls,
    parse_category_links,
    parse_local_html_best_effort,
    parse_mock_sample,
    parse_post_detail,
    parse_post_links,
)


@dataclass
class FailedFetch:
    url: str
    error: str
    attempts: int


@dataclass
class CrawlReport:
    successful_urls: list[str]
    failed_urls: list[FailedFetch]
    total_items: int
    used_fallback: bool
    used_local_input: bool
    selected_title_source: str | None = None
    selected_content_source: str | None = None
    local_html_encoding_used: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "successful_urls": self.successful_urls,
            "failed_urls": [asdict(item) for item in self.failed_urls],
            "total_items": self.total_items,
            "used_fallback": self.used_fallback,
            "used_local_input": self.used_local_input,
            "selected_title_source": self.selected_title_source,
            "selected_content_source": self.selected_content_source,
            "local_html_encoding_used": self.local_html_encoding_used,
        }


def fetch(session: requests.Session, url: str, config: Config, report: CrawlReport) -> str:
    last_error: Exception | None = None
    timeout = (config.request_connect_timeout_seconds, config.request_read_timeout_seconds)
    total_attempts = config.max_retries + 1

    for attempt in range(1, total_attempts + 1):
        if attempt > 1:
            sleep_seconds = config.retry_backoff_seconds * (2 ** (attempt - 2))
            time.sleep(sleep_seconds)

        time.sleep(config.request_delay_seconds)

        try:
            response = session.get(url, timeout=timeout)
            response.raise_for_status()
            if not response.encoding:
                response.encoding = response.apparent_encoding
            report.successful_urls.append(url)
            return response.text
        except requests.RequestException as exc:
            last_error = exc

    error_message = str(last_error) if last_error else "Unknown fetch error"
    report.failed_urls.append(FailedFetch(url=url, error=error_message, attempts=total_attempts))
    raise RuntimeError(error_message)


def crawl(config: Config) -> tuple[list[ImportedContent], list[str], CrawlReport]:
    report = CrawlReport(
        successful_urls=[],
        failed_urls=[],
        total_items=0,
        used_fallback=False,
        used_local_input=False,
        selected_title_source=None,
        selected_content_source=None,
        local_html_encoding_used=None,
    )
    errors: list[str] = []

    if config.local_input_path:
        contents = load_local_input(config, config.local_input_path, errors, report)
        report.used_local_input = True
        report.total_items = len(contents)
        return contents, errors, report

    session = requests.Session()
    session.headers.update({"User-Agent": config.user_agent})
    imported: list[ImportedContent] = []
    seen_detail_urls: set[str] = set()
    home_html = ""
    home_url = ""

    for entry_url in config.entry_urls:
        try:
            home_html = fetch(session, entry_url, config, report)
            home_url = entry_url
            OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
            DEBUG_HOMEPAGE_FILE.write_text(home_html, encoding="utf-8")
            break
        except Exception as exc:
            errors.append(f"Failed to fetch entry URL {entry_url}: {exc}")

    if home_html:
        category_links = parse_category_links(home_html, home_url or config.base_url)
        if not category_links:
            category_links = [("Trang chu", home_url or config.base_url)]
    else:
        category_links = []

    for category_name, category_url in category_links:
        for list_url in build_list_page_urls(category_url, config.max_pages_per_category):
            if len(imported) >= config.max_total_posts:
                break

            try:
                list_html = fetch(session, list_url, config, report)
                detail_urls = parse_post_links(list_html, list_url, config.base_url)
            except Exception as exc:
                errors.append(f"Failed to fetch list page {list_url}: {exc}")
                continue

            for detail_url in detail_urls:
                if len(imported) >= config.max_total_posts:
                    break

                normalized_detail_url = normalize_url(detail_url)
                if normalized_detail_url in seen_detail_urls:
                    continue
                seen_detail_urls.add(normalized_detail_url)

                try:
                    detail_html = fetch(session, normalized_detail_url, config, report)
                    parsed = parse_post_detail(
                        detail_html,
                        normalized_detail_url,
                        config.base_url,
                        category_name,
                    )
                    if parsed:
                        imported.append(parsed)
                except Exception as exc:
                    errors.append(f"Failed to fetch detail page {normalized_detail_url}: {exc}")

    if not imported:
        errors.append("No real content parsed; using built-in mock sample to validate pipeline.")
        report.used_fallback = True
        imported = parse_mock_sample(config.base_url)

    report.total_items = len(imported)
    return imported, errors, report


def load_local_input(config: Config, input_path: Path, errors: list[str], report: CrawlReport) -> list[ImportedContent]:
    if not input_path.exists():
        errors.append(f"LOCAL_INPUT_PATH does not exist: {input_path}")
        return []

    paths = sorted(input_path.glob("*")) if input_path.is_dir() else [input_path]
    contents: list[ImportedContent] = []

    for path in paths:
        if path.suffix.lower() in {".json"}:
            contents.extend(load_local_json(config, path, errors))
        elif path.suffix.lower() in {".html", ".htm"}:
            html, encoding_used = read_local_html(path)
            parsed, debug = parse_local_html_best_effort(
                html,
                f"{config.base_url}/local-file/{path.stem}",
                config.base_url,
                "Local HTML",
                path.stem,
            )
            report.local_html_encoding_used = encoding_used
            report.selected_title_source = debug.get("selected_title_source")
            report.selected_content_source = debug.get("selected_content_source")

            if parsed:
                contents.append(parsed)
            else:
                errors.append(f"Could not parse local HTML file: {path}")

    return contents[: config.max_total_posts]


def read_local_html(path: Path) -> tuple[str, str]:
    encodings = ["utf-8", "utf-8-sig", "windows-1258", "cp1252", "latin-1"]
    raw_bytes = path.read_bytes()

    for encoding in encodings:
        try:
            return raw_bytes.decode(encoding), encoding
        except UnicodeDecodeError:
            continue

    return raw_bytes.decode("latin-1", errors="replace"), "latin-1-replace"


def load_local_json(config: Config, path: Path, errors: list[str]) -> list[ImportedContent]:
    try:
        raw_payload = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        errors.append(f"Invalid JSON file {path}: {exc}")
        return []

    if isinstance(raw_payload, dict) and isinstance(raw_payload.get("items"), list):
        raw_items = raw_payload["items"]
    elif isinstance(raw_payload, list):
        raw_items = raw_payload
    elif isinstance(raw_payload, dict):
        raw_items = [raw_payload]
    else:
        errors.append(f"Unsupported JSON shape in {path}")
        return []

    contents: list[ImportedContent] = []
    for index, raw_item in enumerate(raw_items):
        if not isinstance(raw_item, dict):
            errors.append(f"Skipped non-object JSON item #{index} in {path}")
            continue

        item = content_from_dict(config, raw_item, path.stem, index)
        if item:
            contents.append(item)

    return contents


def content_from_dict(config: Config, raw_item: dict[str, Any], source_name: str, index: int) -> ImportedContent | None:
    title = normalize_whitespace(str(raw_item.get("title") or ""))
    content_html = str(raw_item.get("content_html") or "")
    content_text = normalize_whitespace(str(raw_item.get("content_text") or ""))

    if not title:
        return None

    if content_html:
        content_html = clean_html(content_html, config.base_url)
    elif content_text:
        content_html = f"<p>{content_text}</p>"

    if not content_text:
        content_text = extract_text_from_html(content_html)

    source_url = normalize_whitespace(str(raw_item.get("source_url") or ""))
    if not source_url:
        source_url = f"{config.base_url}/local-json/{source_name}-{index + 1}"

    images = raw_item.get("images")
    if images is None:
        images = raw_item.get("images_json")
    attachments = raw_item.get("attachments")
    if attachments is None:
        attachments = raw_item.get("attachments_json")

    return ImportedContent(
        source_site=normalize_whitespace(str(raw_item.get("source_site") or config.base_url)),
        source_url=normalize_url(source_url),
        title=title,
        slug=slugify(str(raw_item.get("slug") or title)),
        excerpt=normalize_whitespace(str(raw_item.get("excerpt") or content_text[:300])),
        content_html=content_html,
        content_text=content_text,
        category_name=normalize_whitespace(str(raw_item.get("category_name") or "Local Import")),
        detected_published_at=raw_item.get("detected_published_at") or None,
        images=coerce_string_list(images),
        attachments=coerce_string_list(attachments),
    )


def coerce_string_list(value: Any) -> list[str]:
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            value = parsed
        except json.JSONDecodeError:
            return [value] if value.strip() else []

    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]

    return []


def write_preview(contents: list[ImportedContent], errors: list[str]) -> Path:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    payload = {
        "count": len(contents),
        "errors": errors,
        "items": [item.to_dict() for item in contents],
    }
    PREVIEW_FILE.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return PREVIEW_FILE


def write_report(report: CrawlReport) -> Path:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_FILE.write_text(json.dumps(report.to_dict(), ensure_ascii=False, indent=2), encoding="utf-8")
    return REPORT_FILE


def main() -> None:
    config = load_config()
    contents, errors, report = crawl(config)
    report_path = write_report(report)

    if config.dry_run:
        preview_path = write_preview(contents, errors)
        print(f"DRY_RUN=true. Wrote preview JSON: {preview_path}")
        print(f"Preview item count: {len(contents)}")

    if config.import_to_db:
        count = import_contents(config, contents)
        print(f"IMPORT_TO_DB=true. Imported/upserted records: {count}")

    print(f"Wrote crawl report: {report_path}")

    if errors:
        print("Crawler warnings/errors:")
        for error in errors[:20]:
            print(f"- {error}")

    if not config.dry_run and not config.import_to_db:
        print("Nothing persisted because DRY_RUN=false and IMPORT_TO_DB=false.")


if __name__ == "__main__":
    main()
