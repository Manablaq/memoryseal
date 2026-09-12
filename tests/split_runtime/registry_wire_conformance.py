import hashlib
from pathlib import Path

from gltest.direct import create_address

from memoryseal_split_harness import (
    CanonicalRegistryWireModel,
)

REGISTRY_PATH = str(Path(__file__).resolve().parents[2] / "contracts" / "memoryseal_registry.py")
SDK_VERSION = 'v0.3.0-rc7'
NOW_ISO = "2026-09-12T12:00:00Z"
NOW = 1_789_214_400
DAY = 24 * 60 * 60
HOUR = 60 * 60


def test_real_registry_matches_wire_model(
    direct_vm,
    direct_deploy,
):
    direct_vm.check_pickling = True

    real = direct_deploy(
        REGISTRY_PATH,
        sdk_version=SDK_VERSION,
    )

    owner = create_address("default_sender")
    issuer_a = create_address("memoryseal-conformance-issuer-a")
    issuer_b = create_address("memoryseal-conformance-issuer-b")

    issuers = sorted(
        [issuer_a, issuer_b],
        key=lambda value: value.as_hex,
    )

    origins = [
        "https://alpha.example.com",
        "https://docs.example.com",
    ]

    direct_vm.sender = owner
    direct_vm.warp(NOW_ISO)

    model = CanonicalRegistryWireModel(
        direct_vm,
        owner,
    )

    args = (
        "conformance-policy",
        1,
        2,
        2,
        2,
        30 * DAY,
        HOUR,
        14 * DAY,
        4,
        100_000,
    )

    real_policy = real.create_policy(*args)
    model_policy = model.create_policy(*args)
    assert model_policy == real_policy

    for issuer in issuers:
        real.add_policy_issuer(
            real_policy,
            issuer.as_hex,
        )
        model.add_policy_issuer(
            model_policy,
            issuer.as_hex,
        )

    for origin in origins:
        real.add_policy_origin(
            real_policy,
            origin,
        )
        model.add_policy_origin(
            model_policy,
            origin,
        )

    real_fingerprint = real.seal_policy(real_policy)
    model_fingerprint = model.seal_policy(model_policy)

    assert model_fingerprint == real_fingerprint
    assert (
        model.get_policy_wire(model_policy)
        == list(real.get_policy_wire(real_policy))
    )

    body_a = "Conformance evidence A."
    body_b = "Conformance evidence B."
    body_a2 = "Conformance evidence A version two."

    direct_vm.sender = issuers[0]
    digest_a = hashlib.sha256(
        body_a.encode("utf-8")
    ).hexdigest()

    real_a1 = real.register_evidence(
        real_policy,
        "stable-a",
        1,
        origins[0] + "/records/stable-a",
        origins[0],
        digest_a,
        NOW - HOUR,
        NOW + (20 * DAY),
    )
    model_a1 = model.register_evidence(
        model_policy,
        "stable-a",
        1,
        origins[0] + "/records/stable-a",
        origins[0],
        digest_a,
        NOW - HOUR,
        NOW + (20 * DAY),
    )
    assert model_a1 == real_a1

    direct_vm.sender = issuers[1]
    digest_b = hashlib.sha256(
        body_b.encode("utf-8")
    ).hexdigest()

    real_b1 = real.register_evidence(
        real_policy,
        "stable-b",
        1,
        origins[1] + "/records/stable-b",
        origins[1],
        digest_b,
        NOW - HOUR,
        NOW + (20 * DAY),
    )
    model_b1 = model.register_evidence(
        model_policy,
        "stable-b",
        1,
        origins[1] + "/records/stable-b",
        origins[1],
        digest_b,
        NOW - HOUR,
        NOW + (20 * DAY),
    )
    assert model_b1 == real_b1

    assert (
        model.get_evidence_wire(model_a1)
        == list(real.get_evidence_wire(real_a1))
    )
    assert (
        model.get_evidence_wire(model_b1)
        == list(real.get_evidence_wire(real_b1))
    )

    direct_vm.sender = issuers[0]
    digest_a2 = hashlib.sha256(
        body_a2.encode("utf-8")
    ).hexdigest()

    real_a2 = real.register_evidence(
        real_policy,
        "stable-a",
        2,
        origins[0] + "/records/stable-a/v2",
        origins[0],
        digest_a2,
        NOW - HOUR,
        NOW + (20 * DAY),
    )
    model_a2 = model.register_evidence(
        model_policy,
        "stable-a",
        2,
        origins[0] + "/records/stable-a/v2",
        origins[0],
        digest_a2,
        NOW - HOUR,
        NOW + (20 * DAY),
    )
    assert model_a2 == real_a2

    assert (
        model.get_evidence_wire(model_a1)
        == list(real.get_evidence_wire(real_a1))
    )
    assert (
        model.get_evidence_wire(model_a2)
        == list(real.get_evidence_wire(real_a2))
    )
    assert model.get_evidence_wire(model_a1)[9] == "2"
    assert model.get_evidence_wire(model_a2)[9] == "2"
