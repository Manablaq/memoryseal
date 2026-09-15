# MemorySeal tests

MemorySeal keeps multiple generations of tests because the repository records the development path as well as the current split-contract release. Test names alone do not define deployment authority.

## Current canonical split regression

The reproducible current contract regression is:

```bash
bash verification/run_memoryseal_split_regression.sh
```

It executes the `tests/split_runtime/` suite in isolated temporary working directories and requires the repository virtualenv at `.venv`.

Expected coverage:

| Group | Tests | Purpose |
| --- | ---: | --- |
| Registry wire conformance | 1 | Strict Registry wire-model shape/compatibility |
| Real Registry behavior | 9 | Policy/evidence behavior using the canonical Registry source |
| Composed Main behavior | 77 | Main claim/review/repair behavior against the split harness |
| Distinct mixed semantics | 53 | Recorded semantic combinations in the composed release suite |

Expected summary:

```text
MEMORYSEAL_SPLIT_REGRESSION=PASS
WIRE_MODEL_CONFORMANCE_TESTS=1
REAL_REGISTRY_TESTS=9
REAL_MAIN_COMPOSED_TESTS=77
DISTINCT_MIXED_SEMANTICS=53
NATIVE_CROSS_CONTRACT_ROUTING_PROVEN=NO
```

`NATIVE_CROSS_CONTRACT_ROUTING_PROVEN=NO` is an explicit limitation of the local harness, not a hidden failure. Finalized Bradbury deployment evidence separately binds the deployed Main to the Registry address.

## `tests/split_runtime/`

The split runtime suite contains:

- `registry_wire_conformance.py`
- `registry_behavior.py`
- `memoryseal_split_harness.py`
- `main_bradbury.py`
- `main_claims.py`
- `main_repair.py`

This is the best starting point for reviewers evaluating the current two-contract architecture.

## `tests/direct/`

The direct suite contains both canonical and historical/candidate regression coverage accumulated during development.

Files whose names include `candidate` or `probe` may test historical behavior. They do not make the corresponding contract file canonical.

The constructor compatibility test and canonical tests remain useful regression evidence, but deployment authority comes from the exact finalized source hashes and the verification artifacts under `verification/`.

## Pytest configuration

`pyproject.toml` points pytest at `tests/` and reserves the `integration` marker for tests that require a GenLayer network backend.

## Dependency setup

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements-lock.txt
```

The frozen Python dependency set includes `genlayer-test`, `genvm-linter`, and pytest.

See [`../docs/VERIFICATION.md`](../docs/VERIFICATION.md).
