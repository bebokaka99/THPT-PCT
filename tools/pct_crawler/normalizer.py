from __future__ import annotations

import re
import unicodedata
from html import unescape
from typing import Iterable
from urllib.parse import urljoin, urlparse, urlunparse

from bs4 import BeautifulSoup


MEDIA_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".gif",
    ".svg",
    ".pdf",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".ppt",
    ".pptx",
    ".zip",
    ".rar",
}


def normalize_whitespace(value: str | None) -> str:
    if not value:
        return ""
    return re.sub(r"\s+", " ", unescape(value)).strip()


def slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFD", value)
    ascii_value = normalized.encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", ascii_value.lower()).strip("-")
    return slug or "imported-content"


def make_absolute_url(base_url: str, url: str | None) -> str:
    if not url:
        return ""
    return urljoin(base_url, url.strip())


def normalize_url(url: str) -> str:
    parsed = urlparse(url)
    clean_path = re.sub(r"/+", "/", parsed.path)
    return urlunparse(
        (
            parsed.scheme.lower(),
            parsed.netloc.lower(),
            clean_path,
            "",
            parsed.query,
            "",
        )
    )


def same_domain(base_url: str, url: str) -> bool:
    base = urlparse(base_url)
    target = urlparse(url)
    return target.netloc.lower() == base.netloc.lower()


def looks_like_media_url(url: str) -> bool:
    path = urlparse(url).path.lower()
    return any(path.endswith(extension) for extension in MEDIA_EXTENSIONS)


def clean_html(html: str, base_url: str) -> str:
    soup = BeautifulSoup(html or "", "lxml")

    for node in soup(["script", "style", "noscript", "iframe", "form"]):
        node.decompose()

    for tag in soup.find_all(True):
        allowed_attrs: dict[str, str] = {}

        if tag.name == "a" and tag.get("href"):
            allowed_attrs["href"] = make_absolute_url(base_url, str(tag.get("href")))
            allowed_attrs["target"] = "_blank"
            allowed_attrs["rel"] = "noopener noreferrer"

        if tag.name == "img" and tag.get("src"):
            allowed_attrs["src"] = make_absolute_url(base_url, str(tag.get("src")))
            if tag.get("alt"):
                allowed_attrs["alt"] = normalize_whitespace(str(tag.get("alt")))

        tag.attrs = allowed_attrs

    body = soup.body or soup
    html_output = str(body)
    html_output = re.sub(r"^<body>|</body>$", "", html_output).strip()
    return html_output


def extract_text_from_html(html: str) -> str:
    soup = BeautifulSoup(html or "", "lxml")
    return normalize_whitespace(soup.get_text(" "))


def unique_strings(values: Iterable[str]) -> list[str]:
    seen: set[str] = set()
    output: list[str] = []
    for value in values:
        normalized = normalize_whitespace(value)
        if normalized and normalized not in seen:
            seen.add(normalized)
            output.append(normalized)
    return output
