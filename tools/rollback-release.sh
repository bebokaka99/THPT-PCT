#!/usr/bin/env bash
set -Eeuo pipefail

environment_name="${1:-}"
env_file="${2:-}"

if [[ ! "$environment_name" =~ ^[a-z0-9-]+$ ]]; then
  echo "Environment name must contain only lowercase letters, numbers, and hyphens." >&2
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
current_file="$state_directory/current-release"
previous_file="$state_directory/previous-release"

if [[ ! -f "$current_file" || ! -f "$previous_file" ]]; then
  echo "Rollback requires both current-release and previous-release state." >&2
  exit 1
fi

current_release="$(tr -d '[:space:]' < "$current_file")"
previous_release="$(tr -d '[:space:]' < "$previous_file")"
release_file="$state_directory/releases/$previous_release.env"
compose_files=(-f docker-compose.yml)
services=(backend frontend)
if [[ "$environment_name" == "production" ]]; then
  compose_files+=(-f docker-compose.production.yml)
  services+=(edge)
fi

if [[ ! "$previous_release" =~ ^[0-9a-f]{40}$ || ! -f "$release_file" ]]; then
  echo "Previous release state is invalid or its image manifest is missing." >&2
  exit 1
fi

compose=(
  docker compose
  "${compose_files[@]}"
  --project-name "thpt-pct-pt-$environment_name"
  --env-file "$env_file"
  --env-file "$release_file"
)

cd "$project_root"
"${compose[@]}" config --quiet
if [[ "${DEPLOY_SKIP_PULL:-false}" != "true" ]]; then
  "${compose[@]}" pull "${services[@]}"
fi
"${compose[@]}" up -d --no-build "${services[@]}"

printf '%s\n' "$previous_release" > "$current_file"
printf '%s\n' "$current_release" > "$previous_file"

echo "Rolled back $environment_name from $current_release to $previous_release."
