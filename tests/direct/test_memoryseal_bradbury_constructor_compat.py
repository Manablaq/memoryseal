from pathlib import Path
import hashlib
import importlib

import pytest

from gltest.direct.sdk_loader import parse_contract_header, setup_sdk_paths


ROOT = Path(__file__).resolve().parents[2]
MAIN = ROOT / "contracts" / "memoryseal_claim_consensus.py"

REGISTRY_ADDRESS = "0xd5f0B44394810bBaEBd7cfd5D44b3B568895bd8B"
SDK_VERSION = "v0.3.0-rc7"
RUNNER_HASH = "1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6"
EXPECTED_MAIN_SHA = "4aa0a9c1a5da486aa3c4730424212def4a95d500d9b55242000e07d8f8df892c"
EXPECTED_MAIN_BYTES = 18384

ADDED_PATHS = setup_sdk_paths(MAIN, SDK_VERSION)
_types = importlib.import_module("genlayer.py.types")
_calldata = importlib.import_module("genlayer.py.calldata")
Address = _types.Address
REAL_ADDRESS_ARG = Address(REGISTRY_ADDRESS)


def test_exact_runtime_and_constructor_normalization() -> None:
    raw = MAIN.read_bytes()
    text = raw.decode("utf-8")
    deps = parse_contract_header(MAIN)

    assert len(raw) == EXPECTED_MAIN_BYTES
    assert hashlib.sha256(raw).hexdigest() == EXPECTED_MAIN_SHA
    assert deps["py-genlayer"] == RUNNER_HASH
    assert any(RUNNER_HASH in str(path) for path in ADDED_PATHS)

    assert text.count("Address(str(registry_address))") == 1
    assert text.count("Address(registry_address)") == 0

    assert type(REAL_ADDRESS_ARG).__name__ == "Address"
    assert isinstance(REAL_ADDRESS_ARG, Address)
    assert isinstance(REAL_ADDRESS_ARG, _calldata.Address)
    assert str(REAL_ADDRESS_ARG).lower() == REGISTRY_ADDRESS.lower()
    assert REAL_ADDRESS_ARG.as_hex.lower() == REGISTRY_ADDRESS.lower()


def test_double_wrap_failure_reproduces_bradbury_root_cause() -> None:
    with pytest.raises(
        TypeError,
        match="cannot convert 'Address' object to bytes",
    ):
        Address(REAL_ADDRESS_ARG)

    normalized = Address(str(REAL_ADDRESS_ARG))
    assert normalized.as_hex.lower() == REGISTRY_ADDRESS.lower()


def test_canonical_main_accepts_real_address_calldata(direct_deploy) -> None:
    contract = direct_deploy(
        str(MAIN),
        REAL_ADDRESS_ARG,
        sdk_version=SDK_VERSION,
    )

    assert contract.get_registry().lower() == REGISTRY_ADDRESS.lower()
