#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PYTHON_BIN="$ROOT/.venv/bin/python"
SUITE_DIR="$ROOT/tests/split_runtime"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/memoryseal-split-regression.XXXXXX")"

cleanup() {
  rm -rf "$WORK"
}
trap cleanup EXIT

if [ ! -x "$PYTHON_BIN" ]; then
  echo "STOP: expected virtualenv Python at $PYTHON_BIN"
  exit 1
fi

export PYTHONDONTWRITEBYTECODE=1
export PYTHONPATH="$SUITE_DIR${PYTHONPATH:+:$PYTHONPATH}"
unset PYTEST_DISABLE_PLUGIN_AUTOLOAD

run_group() {
  local label="$1"
  shift
  local log="$WORK/$label.log"

  (
    cd "$WORK"
    "$PYTHON_BIN" -m pytest \
      -q \
      -o "cache_dir=$WORK/cache-$label" \
      "$@"
  ) 2>&1 | tee "$log"

  local rc=${PIPESTATUS[0]}
  echo "${label}_RC=$rc"
  test "$rc" -eq 0
}

run_group "WIRE_CONFORMANCE" \
  "$SUITE_DIR/registry_wire_conformance.py"
grep -Eq '1 passed' "$WORK/WIRE_CONFORMANCE.log"

run_group "REAL_REGISTRY" \
  "$SUITE_DIR/registry_behavior.py"
grep -Eq '9 passed' "$WORK/REAL_REGISTRY.log"

run_group "REAL_MAIN" \
  "$SUITE_DIR/main_bradbury.py" \
  "$SUITE_DIR/main_claims.py" \
  "$SUITE_DIR/main_repair.py"
grep -Eq '77 passed' "$WORK/REAL_MAIN.log"

echo "MEMORYSEAL_SPLIT_REGRESSION=PASS"
echo "WIRE_MODEL_CONFORMANCE_TESTS=1"
echo "REAL_REGISTRY_TESTS=9"
echo "REAL_MAIN_COMPOSED_TESTS=77"
echo "DISTINCT_MIXED_SEMANTICS=53"
echo "NATIVE_CROSS_CONTRACT_ROUTING_PROVEN=NO"
