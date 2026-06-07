APP := agent-desk
MAIN := ./cmd/server
WEB_DIR := web
SPA_INDEX := $(WEB_DIR)/out/index.html

GO ?= go
PNPM ?= pnpm
DOCKER ?= docker
GOOS ?= $(shell $(GO) env GOOS)
GOARCH ?= $(shell $(GO) env GOARCH)
DEV_SERVER_URL ?= http://127.0.0.1:8083
LANCEDB_VERSION ?= v0.1.2
LANCEDB_DOWNLOAD_SCRIPT ?= https://raw.githubusercontent.com/lancedb/lancedb-go/main/scripts/download-artifacts.sh
LANCEDB_TEST_PKGS ?= ./internal/ai/rag/vectordb
LANCEDB_DOCKER_IMAGE ?= mlogclub/agent-desk:lancedb

UNAME_S := $(shell uname -s)
UNAME_M := $(shell uname -m)

ifeq ($(UNAME_M),x86_64)
	LANCEDB_ARCH := amd64
else ifeq ($(UNAME_M),amd64)
	LANCEDB_ARCH := amd64
else ifeq ($(UNAME_M),arm64)
	LANCEDB_ARCH := arm64
else ifeq ($(UNAME_M),aarch64)
	LANCEDB_ARCH := arm64
else
	LANCEDB_ARCH := unsupported
endif

ifeq ($(UNAME_S),Darwin)
	LANCEDB_PLATFORM := darwin
	LANCEDB_SYSTEM_LDFLAGS := -framework Security -framework CoreFoundation
else ifeq ($(UNAME_S),Linux)
	LANCEDB_PLATFORM := linux
	LANCEDB_SYSTEM_LDFLAGS := -lm -ldl -lpthread
else ifneq (,$(findstring MINGW,$(UNAME_S)))
	LANCEDB_PLATFORM := windows
	LANCEDB_ARCH := amd64
	LANCEDB_SYSTEM_LDFLAGS :=
else ifneq (,$(findstring MSYS,$(UNAME_S)))
	LANCEDB_PLATFORM := windows
	LANCEDB_ARCH := amd64
	LANCEDB_SYSTEM_LDFLAGS :=
else ifneq (,$(findstring CYGWIN,$(UNAME_S)))
	LANCEDB_PLATFORM := windows
	LANCEDB_ARCH := amd64
	LANCEDB_SYSTEM_LDFLAGS :=
else
	LANCEDB_PLATFORM := unsupported
	LANCEDB_SYSTEM_LDFLAGS :=
endif

LANCEDB_PLATFORM_ARCH := $(LANCEDB_PLATFORM)_$(LANCEDB_ARCH)
LANCEDB_NATIVE_LIB := $(CURDIR)/lib/$(LANCEDB_PLATFORM_ARCH)/liblancedb_go.a
LANCEDB_CGO_CFLAGS := -I$(CURDIR)/include
LANCEDB_CGO_LDFLAGS := $(LANCEDB_NATIVE_LIB) $(LANCEDB_SYSTEM_LDFLAGS)

.DEFAULT_GOAL := help

.PHONY: all help build build-go build-linux release run run-go dev test check clean clean-web \
	web-install web-dev web-build-spa ensure-spa build-spa web-build-ssr web-typecheck web-lint \
	generator enums migration testdata lancedb-platform-info lancedb-artifacts lancedb-check \
	build-lancedb test-lancedb clean-lancedb-artifacts docker-build-lancedb

all: build

help:
	@echo "Available targets:"
	@echo "  make build                Build web SPA and Go binary"
	@echo "  make build-go             Build Go binary only, ensuring SPA exists"
	@echo "  make build-linux          Build linux amd64 binary"
	@echo "  make release              Build release binaries for common platforms"
	@echo "  make run                  Build web SPA then run server"
	@echo "  make run-go               Run server only, ensuring SPA exists"
	@echo "  make dev                  Run Go server with dev tag and web dev server"
	@echo "  make test                 Run Go tests, ensuring SPA exists"
	@echo "  make check                Run Go tests, web typecheck, and web lint"
	@echo "  make clean                Remove Go binaries"
	@echo "  make clean-web            Remove web build output"
	@echo "  make web-install          Install web dependencies"
	@echo "  make web-dev              Run web dev server"
	@echo "  make web-build-spa        Build static web SPA"
	@echo "  make web-typecheck        Run web typecheck"
	@echo "  make web-lint             Run web lint"
	@echo "  make generator            Run code generator"
	@echo "  make enums                Generate frontend enums"
	@echo "  make migration            Run migration command"
	@echo "  make testdata             Run testdata generator"
	@echo "  make lancedb-artifacts    Download LanceDB native libraries for this platform"
	@echo "  make build-lancedb        Build Go binary with LanceDB provider enabled"
	@echo "  make test-lancedb         Run LanceDB provider tests with native libraries"
	@echo "  make docker-build-lancedb Build Docker image with LanceDB provider enabled"

build: web-build-spa
	@$(MAKE) build-go

build-go: ensure-spa
	@echo "Building $(APP)..."
	@$(GO) build -v -o $(APP) $(MAIN)

build-linux: web-build-spa
	@echo "Building $(APP) for linux/amd64..."
	@GOOS=linux GOARCH=amd64 $(GO) build -v -o $(APP)-linux-amd64 $(MAIN)

release: web-build-spa
	@echo "Building release binaries..."
	@GOOS=linux GOARCH=amd64 $(GO) build -v -o $(APP)-linux-amd64 $(MAIN)
	@GOOS=linux GOARCH=arm64 $(GO) build -v -o $(APP)-linux-arm64 $(MAIN)
	@GOOS=darwin GOARCH=amd64 $(GO) build -v -o $(APP)-darwin-amd64 $(MAIN)
	@GOOS=darwin GOARCH=arm64 $(GO) build -v -o $(APP)-darwin-arm64 $(MAIN)
	@GOOS=windows GOARCH=amd64 $(GO) build -v -o $(APP)-windows-amd64.exe $(MAIN)

run: web-build-spa
	@$(GO) run $(MAIN)

run-go: ensure-spa
	@$(GO) run $(MAIN)

dev:
	@$(GO) run -tags dev $(MAIN) & \
	server_pid=$$!; \
	trap 'kill $$server_pid 2>/dev/null || true' EXIT INT TERM; \
	echo "Waiting for server at $(DEV_SERVER_URL)..."; \
	until curl -fsS "$(DEV_SERVER_URL)" >/dev/null 2>&1; do \
		if ! kill -0 $$server_pid 2>/dev/null; then \
			wait $$server_pid; \
			exit $$?; \
		fi; \
		sleep 1; \
	done; \
	echo "Server is ready; starting web dev server..."; \
	$(MAKE) web-dev

test: ensure-spa
	@$(GO) test ./...

check: test web-typecheck web-lint

clean:
	@rm -f $(APP) $(APP)-linux-amd64 $(APP)-linux-arm64 $(APP)-darwin-amd64 $(APP)-darwin-arm64 $(APP)-windows-amd64.exe

clean-web:
	@rm -rf $(WEB_DIR)/out

web-install:
	@cd $(WEB_DIR) && $(PNPM) install --frozen-lockfile

web-dev:
	@cd $(WEB_DIR) && $(PNPM) dev

web-build-spa:
	@cd $(WEB_DIR) && $(PNPM) build:sdk && $(PNPM) build

ensure-spa:
	@if [ ! -f "$(SPA_INDEX)" ]; then \
		echo "SPA build missing; running web-build-spa..."; \
		$(MAKE) web-build-spa; \
	fi

build-spa: web-build-spa

web-build-ssr:
	@cd $(WEB_DIR) && $(PNPM) build

web-typecheck:
	@cd $(WEB_DIR) && $(PNPM) typecheck

web-lint:
	@cd $(WEB_DIR) && $(PNPM) lint

generator:
	@$(GO) run ./cmd/generator/generator.go

enums:
	@$(GO) run ./cmd/enums/generator.go

migration:
	@$(GO) run ./cmd/migration

testdata:
	@$(GO) run ./cmd/testdata -lang $(or $(TESTDATA_LANG),zh)

lancedb-platform-info:
	@echo "LanceDB platform information:"
	@echo "  OS/arch:          $(UNAME_S)/$(UNAME_M)"
	@echo "  platform-arch:    $(LANCEDB_PLATFORM_ARCH)"
	@echo "  version:          $(LANCEDB_VERSION)"
	@echo "  CGO_CFLAGS:       $(LANCEDB_CGO_CFLAGS)"
	@echo "  CGO_LDFLAGS:      $(LANCEDB_CGO_LDFLAGS)"
	@echo "  native library:   $(LANCEDB_NATIVE_LIB)"

lancedb-artifacts:
	@if [ "$(LANCEDB_PLATFORM)" = "unsupported" ] || [ "$(LANCEDB_ARCH)" = "unsupported" ]; then \
		echo "Unsupported LanceDB platform: $(UNAME_S)/$(UNAME_M)"; \
		exit 1; \
	fi
	@if [ -f "$(LANCEDB_NATIVE_LIB)" ] && [ -f "$(CURDIR)/include/lancedb.h" ]; then \
		echo "LanceDB native artifacts already exist for $(LANCEDB_PLATFORM_ARCH)."; \
	else \
		echo "Downloading LanceDB native artifacts $(LANCEDB_VERSION) for $(LANCEDB_PLATFORM_ARCH)..."; \
		curl -sSL "$(LANCEDB_DOWNLOAD_SCRIPT)" | bash -s "$(LANCEDB_VERSION)"; \
	fi

lancedb-check: lancedb-artifacts
	@if [ ! -f "$(LANCEDB_NATIVE_LIB)" ]; then \
		echo "Missing LanceDB native library: $(LANCEDB_NATIVE_LIB)"; \
		exit 1; \
	fi
	@if [ ! -f "$(CURDIR)/include/lancedb.h" ]; then \
		echo "Missing LanceDB header: $(CURDIR)/include/lancedb.h"; \
		exit 1; \
	fi

build-lancedb: ensure-spa lancedb-check
	@echo "Building $(APP) with LanceDB provider enabled..."
	@CGO_ENABLED=1 CGO_CFLAGS="$(LANCEDB_CGO_CFLAGS)" CGO_LDFLAGS="$(LANCEDB_CGO_LDFLAGS)" \
		$(GO) build -tags lancedb -v -o $(APP) $(MAIN)

test-lancedb: lancedb-check
	@echo "Running LanceDB tests with native libraries..."
	@CGO_ENABLED=1 CGO_CFLAGS="$(LANCEDB_CGO_CFLAGS)" CGO_LDFLAGS="$(LANCEDB_CGO_LDFLAGS)" \
		$(GO) test -tags lancedb $(LANCEDB_TEST_PKGS)

clean-lancedb-artifacts:
	@rm -rf lib include

docker-build-lancedb:
	@$(DOCKER) build \
		--target app-lancedb \
		--build-arg LANCEDB_VERSION=$(LANCEDB_VERSION) \
		-t $(LANCEDB_DOCKER_IMAGE) \
		.
