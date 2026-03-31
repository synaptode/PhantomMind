# PhantomMindAI — Makefile
# Universal AI Development Enhancement Layer

.PHONY: all build dev test clean rebuild typecheck lint run install help \
        audit validate stats sync serve eval schema

# ── Variables ────────────────────────────────────────────────────────────────

PKG      := packages/core
SRC      := $(PKG)/src
DIST     := $(PKG)/dist
TSC      := npx tsc
NODE     := node
NPM      := npm

# Default task
CMD      ?= --help

# Colors
RESET    := \033[0m
BOLD     := \033[1m
CYAN     := \033[36m
GREEN    := \033[32m
YELLOW   := \033[33m
RED      := \033[31m
DIM      := \033[2m

# ── Default ──────────────────────────────────────────────────────────────────

all: build

# ── Core Build ───────────────────────────────────────────────────────────────

## build: Compile TypeScript → dist/
build:
	@echo "$(CYAN)$(BOLD)⚙  Building PhantomMindAI...$(RESET)"
	@$(NPM) run build
	@echo "$(GREEN)✓ Build complete → $(DIST)/$(RESET)"

## dev: Watch mode — rebuild on file changes
dev:
	@echo "$(CYAN)$(BOLD)👁  Watching for changes...$(RESET)"
	@$(NPM) run dev

## typecheck: Check types without emitting output
typecheck:
	@echo "$(CYAN)$(BOLD)🔍 Type checking...$(RESET)"
	@cd $(PKG) && npx tsc --noEmit
	@echo "$(GREEN)✓ No type errors$(RESET)"

## rebuild: Clean + build from scratch
rebuild: clean build

## clean: Remove build artifacts
clean:
	@echo "$(YELLOW)🧹 Cleaning dist/...$(RESET)"
	@rm -rf $(DIST)
	@echo "$(GREEN)✓ Cleaned$(RESET)"

# ── Dependencies ─────────────────────────────────────────────────────────────

## install: Install all npm dependencies
install:
	@echo "$(CYAN)$(BOLD)📦 Installing dependencies...$(RESET)"
	@$(NPM) install
	@echo "$(GREEN)✓ Dependencies installed$(RESET)"

# ── Testing ──────────────────────────────────────────────────────────────────

## test: Run the full test suite (vitest)
test:
	@echo "$(CYAN)$(BOLD)🧪 Running tests...$(RESET)"
	@$(NPM) run test

## test-watch: Run tests in interactive watch mode
test-watch:
	@echo "$(CYAN)$(BOLD)🧪 Watching tests...$(RESET)"
	@$(NPM) -w @phantomind/core run test:watch

# ── Linting ──────────────────────────────────────────────────────────────────

## lint: Run ESLint over source files
lint:
	@echo "$(CYAN)$(BOLD)🔎 Linting...$(RESET)"
	@$(NPM) run lint

# ── CLI (via tsx — no build required) ────────────────────────────────────────

## run: Run a CLI command via tsx (no build needed)
##      Usage: make run CMD="init --yes"
##             make run CMD="sync --dry-run"
##             make run CMD="agent 'add logging'"
run:
	@$(NPM) -w @phantomind/core run phantomind -- $(CMD)

## run-built: Run a CLI command using compiled dist/
##            Usage: make run-built CMD="--help"
run-built: $(DIST)/cli/main.js
	@$(NODE) $(DIST)/cli/main.js $(CMD)

$(DIST)/cli/main.js: $(shell find $(SRC) -name '*.ts' 2>/dev/null)
	@$(MAKE) build

# ── Convenience CLI Targets ──────────────────────────────────────────────────

## init: Initialize PhantomMindAI in the current project
init:
	@$(MAKE) run CMD="init"

## sync: Sync adapters (dry-run by default — set DRY= to disable)
##       Usage: make sync
##              make sync DRY=
sync:
	@$(MAKE) run CMD="sync $(if $(DRY),--dry-run,)"

## sync-force: Sync adapters without dry-run
sync-force:
	@$(MAKE) run CMD="sync"

## serve: Start the MCP server
serve:
	@$(MAKE) run CMD="serve"

## eval: Evaluate provider connection
##       Usage: make eval PROVIDER=openai
eval:
	@$(MAKE) run CMD="eval $(if $(PROVIDER),--provider $(PROVIDER),)"

## validate: Validate files for quality issues
##           Usage: make validate FILES="src/auth.ts src/api.ts"
validate:
	@$(MAKE) run CMD="validate $(FILES)"

## audit: Show audit trail and cost report
##        Usage: make audit PERIOD=week TYPE=costs
audit:
	@$(MAKE) run CMD="audit \
		$(if $(PERIOD),--period $(PERIOD),) \
		$(if $(TYPE),--type $(TYPE),) \
		$(if $(FORMAT),--format $(FORMAT),)"

## stats: Show project statistics
stats:
	@$(MAKE) run CMD="stats"

## stats-learn: Show stats + learn project patterns
stats-learn:
	@$(MAKE) run CMD="stats --learn"

## agent: Run an agentic task
##        Usage: make agent TASK="refactor auth module" ROLE=implementer
agent:
	@$(MAKE) run CMD="agent '$(TASK)' $(if $(ROLE),--role $(ROLE),) $(if $(STEPS),--max-steps $(STEPS),)"

## orchestrate: Run multi-agent orchestration
##              Usage: make orchestrate TASK="build OAuth2" ROLES="architect,implementer,testWriter"
orchestrate:
	@$(MAKE) run CMD="agent '$(TASK)' --orchestrate $(if $(ROLES),--roles $(ROLES),)"

## schema: List or view a schema
##         Usage: make schema
##                make schema NAME=api-response
schema:
	@$(MAKE) run CMD="schema $(NAME)"

# ── Project Health ───────────────────────────────────────────────────────────

## check: Full health check — typecheck + lint + test
check: typecheck lint test
	@echo ""
	@echo "$(GREEN)$(BOLD)✅ All checks passed!$(RESET)"

## ci: CI pipeline — install + build + check
ci: install build check

# ── Utilities ────────────────────────────────────────────────────────────────

## dist-size: Show size of compiled output
dist-size:
	@echo "$(CYAN)$(BOLD)📊 Build output sizes:$(RESET)"
	@find $(DIST) -name '*.js' | xargs du -sh 2>/dev/null | sort -h
	@echo ""
	@echo "  Total JS files: $$(find $(DIST) -name '*.js' | wc -l | tr -d ' ')"
	@echo "  Total size:     $$(du -sh $(DIST) 2>/dev/null | cut -f1)"

## tree: Show source directory tree
tree:
	@echo "$(CYAN)$(BOLD)📁 Source tree:$(RESET)"
	@find $(SRC) -type f -name '*.ts' | sort | sed 's|$(SRC)/||' | \
		awk -F/ '{ \
			indent=""; \
			for(i=1;i<NF;i++) indent=indent"  "; \
			if(NF>1) print indent"├── " $$NF; \
			else print "  " $$0 \
		}'

## version: Show current package version
version:
	@node -p "require('./$(PKG)/package.json').version"

## bump-patch: Bump patch version (x.x.N)
bump-patch:
	@cd $(PKG) && npm version patch --no-git-tag-version
	@echo "$(GREEN)✓ Patch version bumped$(RESET)"

## bump-minor: Bump minor version (x.N.0)
bump-minor:
	@cd $(PKG) && npm version minor --no-git-tag-version
	@echo "$(GREEN)✓ Minor version bumped$(RESET)"

# ── Help ─────────────────────────────────────────────────────────────────────

## help: Show this help message
help:
	@echo ""
	@echo "$(BOLD)$(CYAN)🔮 PhantomMindAI — Available Make Targets$(RESET)"
	@echo "$(DIM)──────────────────────────────────────────────────────$(RESET)"
	@echo ""
	@echo "$(BOLD)BUILD$(RESET)"
	@grep -E '^## (build|dev|typecheck|rebuild|clean):' $(MAKEFILE_LIST) | \
		sed 's/^## /  /' | sed 's/:/\t/' | expand -t24
	@echo ""
	@echo "$(BOLD)DEPENDENCIES$(RESET)"
	@grep -E '^## install:' $(MAKEFILE_LIST) | \
		sed 's/^## /  /' | sed 's/:/\t/' | expand -t24
	@echo ""
	@echo "$(BOLD)TESTING & QUALITY$(RESET)"
	@grep -E '^## (test|test-watch|lint|check|ci):' $(MAKEFILE_LIST) | \
		sed 's/^## /  /' | sed 's/:/\t/' | expand -t24
	@echo ""
	@echo "$(BOLD)CLI COMMANDS$(RESET)"
	@grep -E '^## (run|run-built|init|sync|sync-force|serve|eval|validate|audit|stats|stats-learn|agent|orchestrate|schema):' $(MAKEFILE_LIST) | \
		sed 's/^## /  /' | sed 's/:/\t/' | expand -t24
	@echo ""
	@echo "$(BOLD)UTILITIES$(RESET)"
	@grep -E '^## (dist-size|tree|version|bump-patch|bump-minor):' $(MAKEFILE_LIST) | \
		sed 's/^## /  /' | sed 's/:/\t/' | expand -t24
	@echo ""
	@echo "$(DIM)Examples:$(RESET)"
	@echo "  $(DIM)make build$(RESET)"
	@echo "  $(DIM)make run CMD=\"init --yes\"$(RESET)"
	@echo "  $(DIM)make agent TASK=\"add rate limiting\" ROLE=implementer$(RESET)"
	@echo "  $(DIM)make audit PERIOD=week TYPE=costs FORMAT=markdown$(RESET)"
	@echo "  $(DIM)make validate FILES=\"src/auth.ts\"$(RESET)"
	@echo ""
