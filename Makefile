CHART_DIRS := $(shell find charts -mindepth 1 -maxdepth 1 -type d)
DIST_DIR := dist

.PHONY: deps lint template helmfile-template test verify package clean

deps:
	bash scripts/tests/render.sh deps

lint:
	bash scripts/tests/render.sh lint

template:
	bash scripts/tests/render.sh template

helmfile-template:
	bash scripts/tests/render.sh helmfile-template

test:
	bash scripts/tests/render.sh fail-fast
	@set -e; for test_script in scripts/tests/*.sh; do \
		[ -f "$$test_script" ] || continue; \
		bash "$$test_script"; \
	done

verify: deps test

package: deps
	mkdir -p $(DIST_DIR)
	helm package $(CHART_DIRS) --destination $(DIST_DIR)

clean:
	rm -rf $(DIST_DIR)
