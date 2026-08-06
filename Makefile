CHART_DIRS := $(shell find charts -mindepth 1 -maxdepth 1 -type d)
DIST_DIR := dist

.PHONY: deps lint template package clean

deps:
	@for chart in $(CHART_DIRS); do \
		if grep -q '^dependencies:' "$$chart/Chart.yaml"; then \
			helm dependency update "$$chart"; \
		fi; \
	done

lint:
	helm lint $(CHART_DIRS)

template:
	@for chart in $(CHART_DIRS); do \
		helm template test "$$chart" >/dev/null; \
	done

package: deps
	mkdir -p $(DIST_DIR)
	helm package $(CHART_DIRS) --destination $(DIST_DIR)

clean:
	rm -rf $(DIST_DIR)
