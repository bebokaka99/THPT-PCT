from __future__ import annotations

import re
from dataclasses import dataclass, asdict
from datetime import datetime
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from normalizer import (
    clean_html,
    extract_text_from_html,
    looks_like_media_url,
    make_absolute_url,
    normalize_url,
    normalize_whitespace,
    same_domain,
    slugify,
    unique_strings,
)


ATTACHMENT_EXTENSIONS = (".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".zip", ".rar")
IMAGE_EXTENSIONS = (".jpg", ".jpeg", ".png", ".webp", ".gif")
TITLE_SELECTORS = [
    "h1",
    ".title",
    ".news-title",
    ".detail-title",
    ".entry-title",
    ".post-title",
    "title",
]
LOCAL_CONTENT_SELECTORS = [
    "article",
    ".content",
    ".news-content",
    ".detail-content",
    ".post-content",
    ".ct_detail",
    ".content_detail",
    ".entry-content",
    "main",
]
NOISE_SELECTORS = [
    "script",
    "style",
    "link",
    "meta",
    "noscript",
    "iframe",
    "form",
    "header",
    "footer",
    "nav",
    "aside",
    ".menu",
    "#menu",
    ".navbar",
    ".nav",
    ".sidebar",
    "#sidebar",
    ".left-sidebar",
    ".right-sidebar",
    ".widget",
    ".breadcrumb",
    ".breadcrumbs",
    ".pagination",
    ".related",
    ".related-posts",
    ".comments",
    "#comments",
]
TECHNICAL_NOISE_SELECTORS = [
    "link",
    "meta",
    "noscript",
    "iframe",
    "form",
]
LOCAL_LAYOUT_NOISE_SELECTORS = [
    "header",
    "footer",
    "nav",
    "aside",
    ".menu",
    "#menu",
    ".navbar",
    ".nav",
    ".sidebar",
    "#sidebar",
    ".left-sidebar",
    ".right-sidebar",
    ".widget",
    ".breadcrumb",
    ".breadcrumbs",
    ".pagination",
    ".related",
    ".related-posts",
    ".comments",
    "#comments",
]


@dataclass
class ImportedContent:
    source_site: str
    source_url: str
    title: str
    slug: str
    excerpt: str
    content_html: str
    content_text: str
    category_name: str
    detected_published_at: str | None
    images: list[str]
    attachments: list[str]

    def to_dict(self) -> dict[str, object]:
        return asdict(self)


def parse_category_links(html: str, base_url: str) -> list[tuple[str, str]]:
    soup = BeautifulSoup(html, "lxml")
    candidates: list[tuple[str, str]] = []

    for anchor in soup.select("nav a, .menu a, .navbar a, #menu a, a"):
        href = anchor.get("href")
        label = normalize_whitespace(anchor.get_text(" "))
        absolute_url = normalize_url(make_absolute_url(base_url, str(href or "")))

        if not href or not label or not same_domain(base_url, absolute_url):
            continue

        if looks_like_media_url(absolute_url) or "#" in href or "mailto:" in href or "tel:" in href:
            continue

        if len(label) > 80:
            continue

        candidates.append((label, absolute_url))

    seen: set[str] = set()
    output: list[tuple[str, str]] = []
    for label, url in candidates:
        if url not in seen:
            seen.add(url)
            output.append((label, url))

    return output[:30]


def build_list_page_urls(category_url: str, max_pages: int) -> list[str]:
    urls = [category_url]
    stripped = category_url.rstrip("/")
    for page in range(2, max_pages + 1):
        urls.append(f"{stripped}/page/{page}/")
    return urls


def parse_post_links(html: str, page_url: str, base_url: str) -> list[str]:
    soup = BeautifulSoup(html, "lxml")
    links: list[str] = []
    selectors = [
        "article a[href]",
        ".post a[href]",
        ".entry-title a[href]",
        ".news a[href]",
        ".list-news a[href]",
        "h1 a[href]",
        "h2 a[href]",
        "h3 a[href]",
        "a[href]",
    ]

    for selector in selectors:
        for anchor in soup.select(selector):
            href = anchor.get("href")
            if not href:
                continue

            absolute_url = normalize_url(make_absolute_url(page_url, str(href)))
            if not same_domain(base_url, absolute_url) or looks_like_media_url(absolute_url):
                continue

            text = normalize_whitespace(anchor.get_text(" "))
            if len(text) < 8:
                continue

            links.append(absolute_url)

    return unique_strings(links)


def parse_post_detail(html: str, source_url: str, base_url: str, category_name: str) -> ImportedContent | None:
    soup = BeautifulSoup(html, "lxml")

    for node in soup(["script", "style", "noscript", "iframe", "form"]):
        node.decompose()

    title = _pick_title(soup)
    if not title:
        return None

    content_node = _pick_content_node(soup)
    if content_node is None:
        return None

    raw_content_html = str(content_node)
    content_html = clean_html(raw_content_html, source_url)
    content_text = extract_text_from_html(content_html)

    if len(content_text) < 80:
        return None

    excerpt = _pick_excerpt(soup, content_text)
    detected_date = _pick_date(soup)
    images = _extract_images(content_node, source_url)
    attachments = _extract_attachments(content_node, source_url)

    return ImportedContent(
        source_site=base_url,
        source_url=source_url,
        title=title,
        slug=slugify(title),
        excerpt=excerpt,
        content_html=content_html,
        content_text=content_text,
        category_name=category_name,
        detected_published_at=detected_date,
        images=images,
        attachments=attachments,
    )


def parse_local_html_best_effort(
    html: str,
    source_url: str,
    base_url: str,
    category_name: str,
    fallback_title: str,
) -> tuple[ImportedContent | None, dict[str, str]]:
    soup = BeautifulSoup(html or "", "lxml")
    _remove_local_noise(soup)

    content_node, content_source = _pick_local_content_node(soup)
    if content_node is None:
        title, title_source = _pick_local_title(soup)
        return None, {
            "selected_title_source": title_source or "none",
            "selected_content_source": "none",
        }

    title, title_source = _pick_local_title(content_node)
    if title_source == "h1" and len(title) < 30:
        title_tag = soup.select_one("title")
        title_tag_text = normalize_whitespace(title_tag.get_text(" ") if title_tag else "")
        if len(title_tag_text) > len(title):
            title = title_tag_text
            title_source = "title:short-h1-fallback"
    if not title:
        title, title_source = _pick_local_title(soup)
    if not title:
        title = normalize_whitespace(fallback_title)
        title_source = "filename"

    content_html = clean_html(str(content_node), source_url)
    content_text = extract_text_from_html(content_html)

    if not content_text:
        body_text = normalize_whitespace(soup.get_text(" "))
        if not body_text:
            return None, {
                "selected_title_source": title_source,
                "selected_content_source": content_source,
            }
        content_text = body_text
        content_html = f"<p>{body_text}</p>"
        content_source = f"{content_source}:text-fallback"

    excerpt = _pick_excerpt(soup, content_text)
    detected_date = _pick_date(soup)
    images = _extract_images(content_node, source_url)
    attachments = _extract_attachments(content_node, source_url)

    return (
        ImportedContent(
            source_site=base_url,
            source_url=source_url,
            title=title,
            slug=slugify(title),
            excerpt=excerpt,
            content_html=content_html,
            content_text=content_text,
            category_name=category_name,
            detected_published_at=detected_date,
            images=images,
            attachments=attachments,
        ),
        {
            "selected_title_source": title_source,
            "selected_content_source": content_source,
        },
    )


def _remove_local_noise(soup: BeautifulSoup) -> None:
    for selector in ["script", "style"]:
        for node in soup.select(selector):
            node.decompose()

    for selector in TECHNICAL_NOISE_SELECTORS:
        for node in soup.select(selector):
            if len(normalize_whitespace(node.get_text(" "))) <= 20:
                node.decompose()

    for selector in LOCAL_LAYOUT_NOISE_SELECTORS:
        for node in soup.select(selector):
            text_length = len(normalize_whitespace(node.get_text(" ")))
            # Chrome-saved pages may wrap almost the entire document in menu/nav-like classes.
            # Keep large wrappers so local HTML never becomes an empty document.
            if node.select("article, .news-content, .detail-content, .post-content, .ct_detail, .content_detail"):
                continue
            if text_length <= 2000:
                node.decompose()


def parse_mock_sample(base_url: str) -> list[ImportedContent]:
    html = """
    <html><body>
      <article>
        <h1>Thong bao tuyen sinh lop 10 nam hoc moi</h1>
        <p class="date">22/05/2026</p>
        <p>Truong THPT Phan Chu Trinh thong bao ke hoach tuyen sinh lop 10 nam hoc moi.</p>
        <p>Phu huynh va hoc sinh theo doi thong tin chi tiet tai cong thong tin nha truong.</p>
        <p><a href="/uploads/thong-bao-tuyen-sinh.pdf">Tai van ban thong bao</a></p>
      </article>
    </body></html>
    """
    sample_url = urljoin(base_url, "/mock/thong-bao-tuyen-sinh-lop-10")
    parsed = parse_post_detail(html, sample_url, base_url, "Thong bao")
    return [parsed] if parsed else []


def _pick_title(soup: BeautifulSoup) -> str:
    for selector in ["h1.entry-title", "h1.post-title", "article h1", ".entry-title", "h1", "title"]:
        node = soup.select_one(selector)
        title = normalize_whitespace(node.get_text(" ") if node else "")
        if title:
            return title
    return ""


def _pick_local_title(soup: BeautifulSoup) -> tuple[str, str]:
    for selector in TITLE_SELECTORS:
        node = soup.select_one(selector)
        title = normalize_whitespace(node.get_text(" ") if node else "")
        if title:
            return title, selector
    return "", "none"


def _pick_local_content_node(soup: BeautifulSoup):
    for selector in LOCAL_CONTENT_SELECTORS:
        nodes = soup.select(selector)
        if not nodes:
            continue

        best_node = max(nodes, key=lambda node: len(normalize_whitespace(node.get_text(" "))))
        if len(normalize_whitespace(best_node.get_text(" "))) > 0:
            return best_node, selector

    body = soup.body or soup
    if normalize_whitespace(body.get_text(" ")):
        return body, "body"

    return None, "none"


def _pick_content_node(soup: BeautifulSoup):
    for selector in [
        "article .entry-content",
        ".entry-content",
        ".post-content",
        ".content-detail",
        ".detail-content",
        "article",
        "main",
        ".content",
    ]:
        node = soup.select_one(selector)
        if node and len(normalize_whitespace(node.get_text(" "))) >= 80:
            return node
    return soup.body


def _pick_excerpt(soup: BeautifulSoup, content_text: str) -> str:
    meta = soup.select_one("meta[name='description']")
    if meta and meta.get("content"):
        return normalize_whitespace(str(meta.get("content")))[:500]

    first_paragraph = soup.select_one("article p, .entry-content p, .post-content p, p")
    excerpt = normalize_whitespace(first_paragraph.get_text(" ") if first_paragraph else "")
    if not excerpt:
        excerpt = content_text[:300]
    return excerpt[:500]


def _pick_date(soup: BeautifulSoup) -> str | None:
    text = normalize_whitespace(" ".join(node.get_text(" ") for node in soup.select("time, .date, .posted-on, .entry-date")))
    raw_match = re.search(r"(\d{1,2})[/-](\d{1,2})[/-](\d{4})", text)
    if raw_match:
        day, month, year = raw_match.groups()
        try:
            return datetime(int(year), int(month), int(day)).isoformat(sep=" ")
        except ValueError:
            return None

    iso_node = soup.select_one("time[datetime]")
    if iso_node and iso_node.get("datetime"):
        return str(iso_node.get("datetime"))[:19].replace("T", " ")

    return None


def _extract_images(content_node, page_url: str) -> list[str]:
    images = []
    for image in content_node.select("img[src]"):
        src = make_absolute_url(page_url, str(image.get("src")))
        if src.lower().split("?")[0].endswith(IMAGE_EXTENSIONS):
            images.append(src)
    return unique_strings(images)


def _extract_attachments(content_node, page_url: str) -> list[str]:
    attachments = []
    for anchor in content_node.select("a[href]"):
        href = make_absolute_url(page_url, str(anchor.get("href")))
        if href.lower().split("?")[0].endswith(ATTACHMENT_EXTENSIONS):
            attachments.append(href)
    return unique_strings(attachments)
