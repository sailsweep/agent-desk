# syntax=docker/dockerfile:1.7

FROM node:24-alpine AS web-builder
WORKDIR /src/web

RUN corepack enable && corepack prepare pnpm@10.30.2 --activate
COPY web/package.json web/pnpm-lock.yaml web/pnpm-workspace.yaml ./
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
	pnpm install --frozen-lockfile

COPY web/ ./
RUN pnpm build:sdk && pnpm build

FROM golang:1.26-alpine AS server-builder
WORKDIR /src

RUN apk add --no-cache git
COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod \
	go mod download

COPY . ./
COPY --from=web-builder /src/web/out ./web/out

ARG TARGETOS=linux
ARG TARGETARCH
RUN --mount=type=cache,target=/go/pkg/mod \
	--mount=type=cache,target=/root/.cache/go-build \
	CGO_ENABLED=0 GOOS=${TARGETOS} GOARCH=${TARGETARCH} \
	go build -v -trimpath -ldflags="-s -w" -o /out/agent-desk ./cmd/server

FROM golang:1.26-bookworm AS server-builder-lancedb
WORKDIR /src

ARG TARGETOS=linux
ARG TARGETARCH
ARG LANCEDB_VERSION=v0.1.2

RUN apt-get update \
	&& apt-get install -y --no-install-recommends bash build-essential ca-certificates curl git \
	&& rm -rf /var/lib/apt/lists/*

COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod \
	go mod download

COPY . ./
COPY --from=web-builder /src/web/out ./web/out

RUN --mount=type=cache,target=/go/pkg/mod \
	--mount=type=cache,target=/root/.cache/go-build \
	set -eux; \
	if [ "${TARGETOS}" != "linux" ]; then \
		echo "LanceDB Docker image supports TARGETOS=linux only, got ${TARGETOS}" >&2; \
		exit 1; \
	fi; \
	arch="${TARGETARCH:-$(go env GOARCH)}"; \
	case "$arch" in \
		amd64|arm64) ;; \
		*) echo "Unsupported LanceDB Docker architecture: $arch" >&2; exit 1 ;; \
	esac; \
	curl -sSL https://raw.githubusercontent.com/lancedb/lancedb-go/main/scripts/download-artifacts.sh | bash -s "${LANCEDB_VERSION}"; \
	CGO_ENABLED=1 GOOS="${TARGETOS}" GOARCH="$arch" \
	CGO_CFLAGS="-I/src/include" \
	CGO_LDFLAGS="/src/lib/linux_$arch/liblancedb_go.a -lm -ldl -lpthread" \
	go build -tags lancedb -v -trimpath -ldflags="-s -w" -o /out/agent-desk ./cmd/server

FROM debian:bookworm-slim AS app-lancedb
WORKDIR /app

ENV TZ=Asia/Shanghai

RUN apt-get update \
	&& apt-get install -y --no-install-recommends ca-certificates tzdata wget \
	&& mkdir -p /app/config /app/data/storage /app/data/lancedb \
	&& rm -rf /var/lib/apt/lists/*

COPY --from=server-builder-lancedb /out/agent-desk /app/agent-desk
COPY config/config.example.yaml /app/config/config.example.yaml
COPY config/config.example.yaml /app/config/config.yaml

EXPOSE 8083
VOLUME ["/app/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
	CMD wget -qO- http://127.0.0.1:8083/ >/dev/null || exit 1

CMD ["/app/agent-desk", "-config", "/app/config/config.yaml"]

FROM alpine:3.22 AS app
WORKDIR /app

ENV TZ=Asia/Shanghai

RUN apk add --no-cache ca-certificates tzdata wget \
	&& mkdir -p /app/config /app/data/storage

COPY --from=server-builder /out/agent-desk /app/agent-desk
COPY config/config.example.yaml /app/config/config.example.yaml
COPY config/config.example.yaml /app/config/config.yaml

EXPOSE 8083
VOLUME ["/app/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
	CMD wget -qO- http://127.0.0.1:8083/ >/dev/null || exit 1

CMD ["/app/agent-desk", "-config", "/app/config/config.yaml"]
