# syntax=docker/dockerfile:1

ARG GO_IMAGE=xiaoniu-sz-cn-beijing.cr.volces.com/baseimage/golang:1.26
ARG NODE_IMAGE=xiaoniu-sz-cn-beijing.cr.volces.com/baseimage/node:26-alpine3.23
ARG RUNTIME_IMAGE=xiaoniu-sz-cn-beijing.cr.volces.com/baseimage/go_runtime:latest

FROM ${NODE_IMAGE} AS web-builder
WORKDIR /src/web

ENV NEXT_TELEMETRY_DISABLED=1

RUN corepack enable && corepack prepare pnpm@10.30.2 --activate
COPY web/package.json web/pnpm-lock.yaml web/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY web/ ./
RUN pnpm build:sdk && pnpm build

FROM ${GO_IMAGE} AS server-builder
WORKDIR /src

ARG GOPROXY=https://goproxy.cn,https://mirrors.aliyun.com/goproxy/,direct
ARG TARGETOS=linux
ARG TARGETARCH

ENV CGO_ENABLED=0
ENV GOPROXY=${GOPROXY}

COPY go.mod go.sum ./
RUN go mod download

COPY . ./
COPY --from=web-builder /src/web/out ./web/out

RUN GOOS=${TARGETOS} GOARCH=${TARGETARCH} \
	go build -v -trimpath -ldflags="-s -w" -o /out/agent-desk ./cmd/server

FROM ${RUNTIME_IMAGE} AS app
WORKDIR /ops/app

ENV TZ=Asia/Shanghai

RUN mkdir -p /ops/app/config /ops/app/data/storage /ops/app/logs

COPY --from=server-builder /out/agent-desk /ops/app/agent-desk
COPY config/config.example.yaml /ops/app/config/config.example.yaml
COPY config/config.example.yaml /ops/app/config.yaml

RUN chmod +x /ops/app/agent-desk

EXPOSE 8083
VOLUME ["/ops/app/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
	CMD wget -qO- http://127.0.0.1:8083/api/health >/dev/null || exit 1

ENTRYPOINT ["/ops/app/agent-desk"]
CMD ["-config", "/ops/app/config.yaml"]
