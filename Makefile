APP := agent-desk
MAIN := ./cmd/server
WEB_DIR := web
DIST_DIR := dist

GO ?= go
PNPM ?= pnpm
GOOS ?= $(shell $(GO) env GOOS)
GOARCH ?= $(shell $(GO) env GOARCH)
DEV_SERVER_URL ?= http://127.0.0.1:8083
LANCEDB_VERSION ?= v0.1.2
LANCEDB_DOWNLOAD_SCRIPT ?= https://raw.githubusercontent.com/lancedb/lancedb-go/main/scripts/download-artifacts.sh

UNAME_S := $(shell uname -s)
UNAME_M := $(shell uname -m)

ifeq ($(GOOS),windows)
	APP_EXT := .exe
else
	APP_EXT :=
endif

BUILD_OUTPUT := $(DIST_DIR)/$(APP)$(APP_EXT)

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

.DEFAULT_GOAL := build

.PHONY: help dev build release generator enums \
	_web-build-spa _web-dev _prepare-dist _lancedb-artifacts _lancedb-check

help:
	@echo "Available targets:"
	@echo "  make dev        Start backend and frontend development servers"
	@echo "  make build      Build the current system into dist/"
	@echo "  make release    Build linux/darwin/windows release binaries into dist/"
	@echo "  make generator  Run code generation"
	@echo "  make enums      Generate frontend enums"
	@echo "  make help       Show this help"

dev: _lancedb-check
	@CGO_ENABLED=1 CGO_CFLAGS="$(LANCEDB_CGO_CFLAGS)" CGO_LDFLAGS="$(LANCEDB_CGO_LDFLAGS)" \
		$(GO) run -tags "dev lancedb" $(MAIN) & \
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
	$(MAKE) _web-dev

build: _prepare-dist _web-build-spa
	@echo "Building $(BUILD_OUTPUT)..."
	@$(GO) build -v -o $(BUILD_OUTPUT) $(MAIN)

release: _prepare-dist _web-build-spa
	@echo "Building release binaries in $(DIST_DIR)..."
	@GOOS=linux GOARCH=amd64 $(GO) build -v -o $(DIST_DIR)/$(APP)-linux-amd64 $(MAIN)
	@GOOS=linux GOARCH=arm64 $(GO) build -v -o $(DIST_DIR)/$(APP)-linux-arm64 $(MAIN)
	@GOOS=darwin GOARCH=amd64 $(GO) build -v -o $(DIST_DIR)/$(APP)-darwin-amd64 $(MAIN)
	@GOOS=darwin GOARCH=arm64 $(GO) build -v -o $(DIST_DIR)/$(APP)-darwin-arm64 $(MAIN)
	@GOOS=windows GOARCH=amd64 $(GO) build -v -o $(DIST_DIR)/$(APP)-windows-amd64.exe $(MAIN)

generator:
	@$(GO) run ./cmd/generator/generator.go

enums:
	@$(GO) run ./cmd/enums/generator.go

_web-build-spa:
	@cd $(WEB_DIR) && $(PNPM) build:sdk && $(PNPM) build

_web-dev:
	@cd $(WEB_DIR) && $(PNPM) dev

_prepare-dist:
	@mkdir -p $(DIST_DIR)

_lancedb-artifacts:
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

_lancedb-check: _lancedb-artifacts
	@if [ ! -f "$(LANCEDB_NATIVE_LIB)" ]; then \
		echo "Missing LanceDB native library: $(LANCEDB_NATIVE_LIB)"; \
		exit 1; \
	fi
	@if [ ! -f "$(CURDIR)/include/lancedb.h" ]; then \
		echo "Missing LanceDB header: $(CURDIR)/include/lancedb.h"; \
		exit 1; \
	fi
