CHART_DIRS := $(shell find charts -mindepth 1 -maxdepth 1 -type d)
RENDER_CHART_DIRS := charts/redis charts/postgresql charts/traefik
HELMFILE_SELECTORS := --selector name=redis --selector name=postgresql --selector name=traefik
DIST_DIR := dist

.PHONY: deps lint template helmfile-template test verify package clean

deps:
	@for chart in $(RENDER_CHART_DIRS); do \
		if grep -q '^dependencies:' "$$chart/Chart.yaml"; then \
			if ! helm dependency list "$$chart" | awk 'NR > 1 && NF && $$NF != "ok" { exit 1 }'; then \
				helm dependency build --skip-refresh "$$chart"; \
			fi; \
		fi; \
	done

lint:
	@for chart in $(RENDER_CHART_DIRS); do \
		helm lint "$$chart"; \
	done

template:
	@for chart in $(RENDER_CHART_DIRS); do \
		helm template test "$$chart" >/dev/null; \
	done

helmfile-template:
	@selected_releases="$$(helmfile -e dev $(HELMFILE_SELECTORS) list --skip-deps | awk 'NR > 1 { print $$1 }' | LC_ALL=C sort)"; \
	expected_releases="$$(printf '%s\n' postgresql redis traefik)"; \
	if [ "$$selected_releases" != "$$expected_releases" ]; then \
		printf 'unexpected Helmfile releases:\n%s\n' "$$selected_releases" >&2; \
		exit 1; \
	fi
	helmfile -e dev $(HELMFILE_SELECTORS) template --skip-deps >/dev/null

test:
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
