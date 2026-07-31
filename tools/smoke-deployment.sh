#!/usr/bin/env bash
set -Eeuo pipefail

base_url="${1%/}"
max_attempts="${SMOKE_MAX_ATTEMPTS:-30}"
delay_seconds="${SMOKE_DELAY_SECONDS:-5}"

if [[ ! "$base_url" =~ ^https?:// ]]; then
  echo "Smoke base URL must start with http:// or https://." >&2
  exit 1
fi

for ((attempt = 1; attempt <= max_attempts; attempt++)); do
  portal_ok=false
  api_ok=false
  database_ok=false

  if curl --fail --silent --show-error --max-time 10 \
    "$base_url/" > /dev/null; then
    portal_ok=true
  fi

  if health_response="$(
    curl --fail --silent --show-error --max-time 10 \
      "$base_url/api/health" 2>/dev/null
  )" && grep -q '"status":"ok"' <<< "$health_response"; then
    api_ok=true
  fi

  if database_response="$(
    curl --fail --silent --show-error --max-time 10 \
      "$base_url/api/health/db" 2>/dev/null
  )" && grep -q '"database":"connected"' <<< "$database_response"; then
    database_ok=true
  fi

  if [[ "$portal_ok" == true && "$api_ok" == true && "$database_ok" == true ]]; then
    echo "Deployment smoke passed for $base_url."
    exit 0
  fi

  echo "Smoke attempt $attempt/$max_attempts failed; retrying in ${delay_seconds}s."
  sleep "$delay_seconds"
done

echo "Deployment smoke failed for $base_url." >&2
exit 1
