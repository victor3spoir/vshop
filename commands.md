# Comamnds

## Variables

```sh
TAG="${TAG:-dev}"
REGISTRY="${REGISTRY:-ghcr.io}"
IMAGE_NAMESPACE="${IMAGE_NAMESPACE:-victor3spoir}"
PROJECT="${PROJECT:-vshop}"
REVISION="${REVISION:-}"
```

## Frontend

```sh

docker buildx build \
  --file ./frontend/Dockerfile \
  --tag "${REGISTRY}/${IMAGE_NAMESPACE}/${PROJECT}-frontend:${TAG}" \
  --label "org.opencontainers.image.source=https://github.com/victor3spoir/vshop" \
  --label "org.opencontainers.image.version=${TAG}" \
  --label "org.opencontainers.image.revision=${REVISION}" \
  --label "org.opencontainers.image.title=vshop-frontend" \
  --push \
  ./frontend

```

## Backend

```sh

docker buildx build \
  --file ./backend/Dockerfile \
  --tag "${REGISTRY}/${IMAGE_NAMESPACE}/${PROJECT}-backend:${TAG}" \
  --label "org.opencontainers.image.source=https://github.com/victor3spoir/vshop" \
  --label "org.opencontainers.image.version=${TAG}" \
  --label "org.opencontainers.image.revision=${REVISION}" \
  --label "org.opencontainers.image.title=vshop-backend" \
  --push \
  ./backend

```
