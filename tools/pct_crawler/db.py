from __future__ import annotations

import json
from typing import Iterable

import psycopg
from psycopg.types.json import Jsonb

from config import Config
from parser import ImportedContent


def get_connection(config: Config):
    connection_kwargs = {
        "host": config.db_host,
        "port": config.db_port,
        "user": config.db_user,
        "password": config.db_password,
        "dbname": config.db_name,
    }

    if config.database_url:
        return psycopg.connect(config.database_url)

    return psycopg.connect(**connection_kwargs)


def import_contents(config: Config, contents: Iterable[ImportedContent]) -> int:
    imported_count = 0
    connection = get_connection(config)

    try:
        cursor = connection.cursor()
        for item in contents:
            cursor.execute(
                """
                INSERT INTO imported_contents (
                  source_site,
                  source_url,
                  title,
                  slug,
                  excerpt,
                  content_html,
                  content_text,
                  category_name,
                  detected_published_at,
                  images_json,
                  attachments_json,
                  import_status
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'imported')
                ON CONFLICT (source_url) DO UPDATE SET
                  title = EXCLUDED.title,
                  slug = EXCLUDED.slug,
                  excerpt = EXCLUDED.excerpt,
                  content_html = EXCLUDED.content_html,
                  content_text = EXCLUDED.content_text,
                  category_name = EXCLUDED.category_name,
                  detected_published_at = EXCLUDED.detected_published_at,
                  images_json = EXCLUDED.images_json,
                  attachments_json = EXCLUDED.attachments_json,
                  import_status = CASE
                    WHEN imported_contents.import_status = 'converted'
                    THEN imported_contents.import_status
                    ELSE 'imported'
                  END,
                  updated_at = CURRENT_TIMESTAMP
                """,
                (
                    item.source_site,
                    item.source_url,
                    item.title,
                    item.slug,
                    item.excerpt,
                    item.content_html,
                    item.content_text,
                    item.category_name,
                    item.detected_published_at,
                    Jsonb(item.images),
                    Jsonb(item.attachments),
                ),
            )
            imported_count += 1

        connection.commit()
        return imported_count
    finally:
        connection.close()
