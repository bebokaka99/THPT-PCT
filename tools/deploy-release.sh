#!/usr/bin/env bash
set -Eeuo pipefail

environment_name="${1:-}"
release_sha="${2:-}"
image_prefix="${3:-}"
env_file="${4:-}"

if [[ ! "$environment_name" =~ ^[a-z0-9-]+$ ]]; then
  echo "Environment name must contain only lowercase letters, numbers, and hyphens." >&2
  exit 1
fi

if [[ ! "$release_sha" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Release SHA must be a full 40-character Git commit SHA." >&2
  exit 1
fi

if [[ ! "$image_prefix" =~ ^ghcr\.io/[a-z0-9._-]+/[a-z0-9._-]+$ ]]; then
  echo "Image prefix must use ghcr.io/<owner>/<repository>." >&2
  exit 1
fi

if [[ ! -f "$env_file" ]]; then
  echo "Deployment env file does not exist: $env_file" >&2
  exit 1
fi

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
state_root="${DEPLOY_STATE_ROOT:-${XDG_STATE_HOME:-$HOME/.local/state}/thpt-pct-pt}"
if [[ "$state_root" != /* ]]; then
  echo "DEPLOY_STATE_ROOT must be an absolute path." >&2
  exit 1
fi

state_directory="$state_root/$environment_name"
release_directory="$state_directory/releases"
release_file="$release_directory/$release_sha.env"
caddy_config_file="$release_directory/$release_sha.Caddyfile"
current_file="$state_directory/current-release"
previous_file="$state_directory/previous-release"
project_name="thpt-pct-pt-$environment_name"
compose_files=(-f docker-compose.yml)
services=(backend frontend)
if [[ "$environment_name" == "production" ]]; then
  compose_files+=(-f docker-compose.production.yml)
  services+=(edge)
fi

mkdir -p "$release_directory"
cat > "$release_file" <<EOF
BACKEND_IMAGE=${image_prefix}-backend:${release_sha}
FRONTEND_IMAGE=${image_prefix}-frontend:${release_sha}
EOF
if [[ "$environment_name" == "production" ]]; then
  if [[ ! -f "$project_root/deploy/Caddyfile" ]]; then
    echo "Production Caddyfile is missing from the release source." >&2
    exit 1
  fi
  cp "$project_root/deploy/Caddyfile" "$caddy_config_file"
  chmod 0444 "$caddy_config_file"
  printf 'CADDY_CONFIG_PATH=%s\n' "$caddy_config_file" >> "$release_file"
fi

if [[ -f "$current_file" ]]; then
  current_release="$(tr -d '[:space:]' < "$current_file")"
  if [[ -n "$current_release" && "$current_release" != "$release_sha" ]]; then
    printf '%s\n' "$current_release" > "$previous_file"
  fi
fi

compose=(
  docker compose
  "${compose_files[@]}"
  --project-name "$project_name"
  --env-file "$env_file"
  --env-file "$release_file"
)

cd "$project_root"
"${compose[@]}" config --quiet
if [[ "${DEPLOY_VALIDATE_ONLY:-false}" == "true" ]]; then
  echo "Validated $environment_name release $release_sha without deploying services."
  exit 0
fi
if [[ "${DEPLOY_SKIP_PULL:-false}" != "true" ]]; then
  "${compose[@]}" pull "${services[@]}"
fi
"${compose[@]}" up -d --no-build "${services[@]}"
printf '%s\n' "$release_sha" > "$current_file"

echo "Deployed $environment_name release $release_sha."
