#!/usr/bin/env bash

set -euo pipefail

print_usage() {
  cat <<'USAGE'
Build and push the Docker image to Docker Hub.

Required (either flags or env vars):
  -u, --username  Docker Hub username            (env: DOCKERHUB_USERNAME)
  -r, --repo      Docker Hub repository name     (env: DOCKERHUB_REPO)

Optional:
  -t, --tag       Image tag (default: git short SHA or timestamp) (env: IMAGE_TAG)
  -p, --platforms Comma-separated platforms for buildx (e.g. linux/amd64,linux/arm64)
  --latest        Also tag and push :latest
  --context PATH  Build context (default: repo root)
  --login         Perform docker login if DOCKERHUB_TOKEN or DOCKERHUB_PASSWORD is set
  -h, --help      Show this help

Environment variables:
  DOCKERHUB_USERNAME, DOCKERHUB_REPO, IMAGE_TAG, PLATFORMS
  DOCKERHUB_TOKEN or DOCKERHUB_PASSWORD for authentication (used with --login)

Examples:
  ./build-and-push.sh -u yourname -r kube-lab-image --latest
  PLATFORMS=linux/amd64,linux/arm64 ./build-and-push.sh -u yourname -r kube-lab-image --latest
USAGE
}

# Defaults
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$SCRIPT_DIR"

DOCKERHUB_USERNAME="${DOCKERHUB_USERNAME:-}"
DOCKERHUB_REPO="${DOCKERHUB_REPO:-}"
IMAGE_TAG="${IMAGE_TAG:-}"
PLATFORMS="${PLATFORMS:-}"
TAG_LATEST=false
DO_LOGIN=false
BUILD_CONTEXT="$REPO_ROOT"

# Parse args
while [[ ${1:-} != "" ]]; do
  case "$1" in
    -u|--username)
      DOCKERHUB_USERNAME="$2"; shift 2 ;;
    -r|--repo)
      DOCKERHUB_REPO="$2"; shift 2 ;;
    -t|--tag)
      IMAGE_TAG="$2"; shift 2 ;;
    -p|--platforms)
      PLATFORMS="$2"; shift 2 ;;
    --latest)
      TAG_LATEST=true; shift 1 ;;
    --login)
      DO_LOGIN=true; shift 1 ;;
    --context)
      BUILD_CONTEXT="$2"; shift 2 ;;
    -h|--help)
      print_usage; exit 0 ;;
    *)
      echo "Unknown argument: $1" >&2
      print_usage; exit 1 ;;
  esac
done

# Resolve default tag
if [[ -z "$IMAGE_TAG" ]]; then
  if command -v git >/dev/null 2>&1 && git -C "$REPO_ROOT" rev-parse >/dev/null 2>&1; then
    IMAGE_TAG="$(git -C "$REPO_ROOT" rev-parse --short HEAD)"
  else
    IMAGE_TAG="$(date +%Y%m%d%H%M%S)"
  fi
fi

# Validate required
if [[ -z "$DOCKERHUB_USERNAME" || -z "$DOCKERHUB_REPO" ]]; then
  echo "Error: username and repo are required." >&2
  echo "Provide with -u/--username and -r/--repo or via env DOCKERHUB_USERNAME/DOCKERHUB_REPO." >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Error: docker is not installed or not in PATH." >&2
  exit 1
fi

IMAGE_NAME="$DOCKERHUB_USERNAME/$DOCKERHUB_REPO"

# Optional login
if [[ "$DO_LOGIN" == true ]]; then
  if [[ -n "${DOCKERHUB_TOKEN:-}" ]]; then
    echo "$DOCKERHUB_TOKEN" | docker login -u "$DOCKERHUB_USERNAME" --password-stdin
  elif [[ -n "${DOCKERHUB_PASSWORD:-}" ]]; then
    echo "$DOCKERHUB_PASSWORD" | docker login -u "$DOCKERHUB_USERNAME" --password-stdin
  else
    echo "--login specified but DOCKERHUB_TOKEN/DOCKERHUB_PASSWORD not set; skipping login." >&2
  fi
fi

echo "Building $IMAGE_NAME:$IMAGE_TAG"

if [[ -n "$PLATFORMS" ]]; then
  if ! docker buildx version >/dev/null 2>&1; then
    echo "Error: docker buildx not available but platforms specified." >&2
    echo "Install buildx or omit --platforms/PLATFORMS." >&2
    exit 1
  fi

  # Build multi-arch and push directly with both tags if requested
  if [[ "$TAG_LATEST" == true ]]; then
    docker buildx build \
      --platform "$PLATFORMS" \
      -t "$IMAGE_NAME:$IMAGE_TAG" \
      -t "$IMAGE_NAME:latest" \
      --push \
      "$BUILD_CONTEXT"
  else
    docker buildx build \
      --platform "$PLATFORMS" \
      -t "$IMAGE_NAME:$IMAGE_TAG" \
      --push \
      "$BUILD_CONTEXT"
  fi
else
  # Single-arch build then push
  docker build -t "$IMAGE_NAME:$IMAGE_TAG" "$BUILD_CONTEXT"
  docker push "$IMAGE_NAME:$IMAGE_TAG"
  if [[ "$TAG_LATEST" == true ]]; then
    docker tag "$IMAGE_NAME:$IMAGE_TAG" "$IMAGE_NAME:latest"
    docker push "$IMAGE_NAME:latest"
  fi
fi

echo "Pushed: $IMAGE_NAME:$IMAGE_TAG"
if [[ "$TAG_LATEST" == true ]]; then
  echo "Pushed: $IMAGE_NAME:latest"
fi

echo "Done."


