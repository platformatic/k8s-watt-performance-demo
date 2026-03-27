#!/bin/bash
set -e

# Generate HTML charts from benchmark results
# Usage: ./generate-charts.sh results/<cluster-name>

RESULTS_DIR="${1:?Usage: ./generate-charts.sh results/<cluster-name>}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE="$SCRIPT_DIR/charts-template.html"
OUTPUT="$RESULTS_DIR/charts.html"

if [[ ! -d "$RESULTS_DIR" ]]; then
	echo "Error: Directory not found: $RESULTS_DIR"
	exit 1
fi

if [[ ! -f "$TEMPLATE" ]]; then
	echo "Error: Template not found: $TEMPLATE"
	exit 1
fi

# Build JSON data object from CSV files
json="{"
first=true

for metrics_file in "$RESULTS_DIR"/*-metrics.csv; do
	[[ -f "$metrics_file" ]] || continue
	scaler=$(basename "$metrics_file" | sed 's/-metrics.csv//')
	pods_file="$RESULTS_DIR/${scaler}-pods.csv"

	[[ -f "$pods_file" ]] || continue

	# Get k6 start timestamp
	start_file="$RESULTS_DIR/${scaler}-loadtest-start.txt"
	k6_start=""
	if [[ -f "$start_file" ]]; then
		k6_start=$(cat "$start_file" | tr -d '[:space:]')
	fi

	echo "Processing: $scaler (k6 start: ${k6_start:-unknown})"

	# Convert metrics CSV to JSON array
	metrics_json=$(awk -F',' 'NR>1 && $1!="" {
		printf "%s{\"timestamp\":\"%s\",\"avg_elu\":%s,\"hpa_cpu_pct\":\"%s\"}", (NR>2?",":""), $1, $2, $3
	}' "$metrics_file")

	# Convert pods CSV to JSON array
	pods_json=$(awk -F',' 'NR>1 && $1!="" {
		printf "%s{\"timestamp\":\"%s\",\"replicas\":%s}", (NR>2?",":""), $1, $2
	}' "$pods_file")

	if [[ "$first" == "true" ]]; then
		first=false
	else
		json+=","
	fi

	json+="\"$scaler\":{\"k6Start\":\"$k6_start\",\"metrics\":[$metrics_json],\"pods\":[$pods_json]}"
done

json+="}"

# Inject data into template
awk -v data="$json" '{ gsub(/__DATA__/, data); print }' "$TEMPLATE" > "$OUTPUT"

echo "Charts generated: $OUTPUT"
echo "Open: open $OUTPUT"
