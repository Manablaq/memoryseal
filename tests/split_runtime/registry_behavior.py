from pathlib import Path

REGISTRY_PATH = str(Path(__file__).resolve().parents[2] / "contracts" / "memoryseal_registry.py")

from gltest.direct import create_address


NOW_ISO = "2026-09-10T12:00:00Z"
NOW = 1_789_041_600

DAY = 24 * 60 * 60

MAX_AGE = 30 * DAY
MIN_VALIDITY = 60 * 60
CLAIM_LIFETIME = 14 * DAY

DIGEST_A = "a" * 64
DIGEST_B = "b" * 64


def _deploy(direct_vm, direct_deploy):
    direct_vm.check_pickling = True

    contract = direct_deploy(
        REGISTRY_PATH
    )

    # Recreate the fixture's deterministic default sender
    # after the SDK is loaded so this is a real Address.
    owner = create_address("default_sender")

    direct_vm.sender = owner
    direct_vm.warp(NOW_ISO)

    assert contract.get_owner().lower() == owner.as_hex.lower()

    return contract, owner


def _create_policy(
    contract,
    slug="workspace-main",
):
    return contract.create_policy(
        slug,
        1,
        2,
        2,
        2,
        MAX_AGE,
        MIN_VALIDITY,
        CLAIM_LIFETIME,
        4,
        100_000,
    )


def _issuer_set():
    issuers = [
        create_address("memoryseal-issuer-a"),
        create_address("memoryseal-issuer-b"),
        create_address("memoryseal-issuer-c"),
    ]

    return sorted(
        issuers,
        key=lambda address: address.as_hex,
    )


def _origin_set():
    return [
        "https://alpha.example.com",
        "https://docs.example.com",
        "https://zeta.example.com",
    ]


def _seal_standard_policy(
    contract,
    slug="workspace-main",
):
    policy_id = _create_policy(
        contract,
        slug=slug,
    )

    issuers = _issuer_set()
    origins = _origin_set()

    for issuer in issuers[:2]:
        contract.add_policy_issuer(
            policy_id,
            issuer.as_hex,
        )

    for origin in origins[:2]:
        contract.add_policy_origin(
            policy_id,
            origin,
        )

    fingerprint = contract.seal_policy(
        policy_id
    )

    return (
        policy_id,
        issuers,
        origins,
        fingerprint,
    )


def _register(
    contract,
    policy_id,
    stable_record_id,
    version,
    source_url,
    publisher_origin,
    digest,
    issued_at,
    expires_at,
):
    return contract.register_evidence(
        policy_id,
        stable_record_id,
        version,
        source_url,
        publisher_origin,
        digest,
        issued_at,
        expires_at,
    )


def test_policy_seals_and_becomes_immutable(
    direct_vm,
    direct_deploy,
):
    contract, owner = _deploy(
        direct_vm,
        direct_deploy,
    )

    (
        policy_id,
        issuers,
        origins,
        fingerprint,
    ) = _seal_standard_policy(contract)

    policy = contract.get_policy(policy_id)

    assert policy.sealed is True
    assert policy.fingerprint == fingerprint
    assert len(fingerprint) == 64
    assert int(policy.issuer_count) == 2
    assert int(policy.origin_count) == 2
    assert int(contract.get_policy_count()) == 1

    assert contract.derive_policy_id(
        owner.as_hex,
        "workspace-main",
        1,
    ) == policy_id

    for issuer in issuers[:2]:
        assert contract.is_policy_issuer(
            policy_id,
            issuer.as_hex,
        )

    for origin in origins[:2]:
        assert contract.is_policy_origin(
            policy_id,
            origin,
        )

    with direct_vm.expect_revert("POLICY_SEALED"):
        contract.add_policy_origin(
            policy_id,
            origins[2],
        )

    with direct_vm.expect_revert("POLICY_SEALED"):
        contract.seal_policy(policy_id)

    with direct_vm.expect_revert(
        "POLICY_ALREADY_EXISTS"
    ):
        _create_policy(contract)


def test_only_policy_owner_can_configure_and_thresholds_are_enforced(
    direct_vm,
    direct_deploy,
):
    contract, owner = _deploy(
        direct_vm,
        direct_deploy,
    )

    policy_id = _create_policy(contract)
    issuers = _issuer_set()
    origins = _origin_set()

    outsider = create_address(
        "memoryseal-outsider"
    )

    direct_vm.sender = outsider

    with direct_vm.expect_revert(
        "ONLY_POLICY_OWNER"
    ):
        contract.add_policy_issuer(
            policy_id,
            issuers[0].as_hex,
        )

    direct_vm.sender = owner

    with direct_vm.expect_revert(
        "INSUFFICIENT_POLICY_ISSUERS"
    ):
        contract.seal_policy(policy_id)

    contract.add_policy_issuer(
        policy_id,
        issuers[0].as_hex,
    )

    contract.add_policy_issuer(
        policy_id,
        issuers[1].as_hex,
    )

    with direct_vm.expect_revert(
        "INSUFFICIENT_POLICY_ORIGINS"
    ):
        contract.seal_policy(policy_id)

    contract.add_policy_origin(
        policy_id,
        origins[0],
    )

    contract.add_policy_origin(
        policy_id,
        origins[1],
    )

    fingerprint = contract.seal_policy(
        policy_id
    )

    assert len(fingerprint) == 64


def test_policy_authority_sets_require_canonical_order_and_no_duplicates(
    direct_vm,
    direct_deploy,
):
    contract, _ = _deploy(
        direct_vm,
        direct_deploy,
    )

    issuers = _issuer_set()
    origins = _origin_set()

    issuer_policy = _create_policy(
        contract,
        slug="issuer-order",
    )

    contract.add_policy_issuer(
        issuer_policy,
        issuers[1].as_hex,
    )

    with direct_vm.expect_revert(
        "DUPLICATE_ISSUER"
    ):
        contract.add_policy_issuer(
            issuer_policy,
            issuers[1].as_hex,
        )

    with direct_vm.expect_revert(
        "ISSUERS_NOT_STRICTLY_SORTED"
    ):
        contract.add_policy_issuer(
            issuer_policy,
            issuers[0].as_hex,
        )

    assert int(
        contract.get_policy(
            issuer_policy
        ).issuer_count
    ) == 1

    origin_policy = _create_policy(
        contract,
        slug="origin-order",
    )

    contract.add_policy_origin(
        origin_policy,
        origins[1],
    )

    with direct_vm.expect_revert(
        "DUPLICATE_ORIGIN"
    ):
        contract.add_policy_origin(
            origin_policy,
            origins[1],
        )

    with direct_vm.expect_revert(
        "ORIGINS_NOT_STRICTLY_SORTED"
    ):
        contract.add_policy_origin(
            origin_policy,
            origins[0],
        )

    assert int(
        contract.get_policy(
            origin_policy
        ).origin_count
    ) == 1


def test_policy_security_bounds_reject_invalid_configuration(
    direct_vm,
    direct_deploy,
):
    contract, _ = _deploy(
        direct_vm,
        direct_deploy,
    )

    with direct_vm.expect_revert(
        "POLICY_SLUG_EMPTY"
    ):
        contract.create_policy(
            "",
            1,
            2,
            2,
            2,
            MAX_AGE,
            MIN_VALIDITY,
            CLAIM_LIFETIME,
            4,
            100_000,
        )

    with direct_vm.expect_revert(
        "POLICY_SLUG_INVALID_CHARACTER"
    ):
        contract.create_policy(
            "BadSlug",
            1,
            2,
            2,
            2,
            MAX_AGE,
            MIN_VALIDITY,
            CLAIM_LIFETIME,
            4,
            100_000,
        )

    with direct_vm.expect_revert(
        "INVALID_POLICY_VERSION"
    ):
        contract.create_policy(
            "bad-version",
            0,
            2,
            2,
            2,
            MAX_AGE,
            MIN_VALIDITY,
            CLAIM_LIFETIME,
            4,
            100_000,
        )

    with direct_vm.expect_revert(
        "MIN_ISSUERS_BELOW_TWO"
    ):
        contract.create_policy(
            "one-issuer",
            1,
            2,
            1,
            2,
            MAX_AGE,
            MIN_VALIDITY,
            CLAIM_LIFETIME,
            4,
            100_000,
        )

    with direct_vm.expect_revert(
        "MIN_ORIGINS_BELOW_TWO"
    ):
        contract.create_policy(
            "one-origin",
            1,
            2,
            2,
            1,
            MAX_AGE,
            MIN_VALIDITY,
            CLAIM_LIFETIME,
            4,
            100_000,
        )

    with direct_vm.expect_revert(
        "MIN_EVIDENCE_BELOW_DISTINCTNESS"
    ):
        contract.create_policy(
            "bad-distinctness",
            1,
            2,
            3,
            2,
            MAX_AGE,
            MIN_VALIDITY,
            CLAIM_LIFETIME,
            4,
            100_000,
        )

    with direct_vm.expect_revert(
        "INVALID_MAX_EVIDENCE_RECORDS"
    ):
        contract.create_policy(
            "too-many-evidence",
            1,
            2,
            2,
            2,
            MAX_AGE,
            MIN_VALIDITY,
            CLAIM_LIFETIME,
            9,
            100_000,
        )

    with direct_vm.expect_revert(
        "INVALID_MAX_EVIDENCE_AGE"
    ):
        contract.create_policy(
            "bad-age",
            1,
            2,
            2,
            2,
            3599,
            MIN_VALIDITY,
            CLAIM_LIFETIME,
            4,
            100_000,
        )

    with direct_vm.expect_revert(
        "INVALID_MIN_REMAINING_VALIDITY"
    ):
        contract.create_policy(
            "bad-validity",
            1,
            2,
            2,
            2,
            MAX_AGE,
            59,
            CLAIM_LIFETIME,
            4,
            100_000,
        )

    with direct_vm.expect_revert(
        "INVALID_MAX_CLAIM_LIFETIME"
    ):
        contract.create_policy(
            "bad-lifetime",
            1,
            2,
            2,
            2,
            MAX_AGE,
            MIN_VALIDITY,
            3599,
            4,
            100_000,
        )

    with direct_vm.expect_revert(
        "INVALID_MAX_CONTENT_BYTES"
    ):
        contract.create_policy(
            "bad-content-limit",
            1,
            2,
            2,
            2,
            MAX_AGE,
            MIN_VALIDITY,
            CLAIM_LIFETIME,
            4,
            1023,
        )

    assert int(contract.get_policy_count()) == 0


def test_origin_canonicalization_rejects_unsafe_policy_origins(
    direct_vm,
    direct_deploy,
):
    contract, _ = _deploy(
        direct_vm,
        direct_deploy,
    )

    policy_id = _create_policy(contract)

    with direct_vm.expect_revert(
        "ORIGIN_NOT_HTTPS"
    ):
        contract.add_policy_origin(
            policy_id,
            "http://alpha.example.com",
        )

    with direct_vm.expect_revert(
        "ORIGIN_NOT_CANONICAL"
    ):
        contract.add_policy_origin(
            policy_id,
            "https://Alpha.example.com",
        )

    with direct_vm.expect_revert(
        "ORIGIN_NOT_CANONICAL"
    ):
        contract.add_policy_origin(
            policy_id,
            "https://alpha.example.com/path",
        )

    with direct_vm.expect_revert(
        "ORIGIN_INVALID_HOST"
    ):
        contract.add_policy_origin(
            policy_id,
            "https://localhost",
        )

    assert int(
        contract.get_policy(
            policy_id
        ).origin_count
    ) == 0


def test_evidence_requires_approved_issuer_origin_and_exact_origin_boundary(
    direct_vm,
    direct_deploy,
):
    contract, owner = _deploy(
        direct_vm,
        direct_deploy,
    )

    (
        policy_id,
        issuers,
        origins,
        _,
    ) = _seal_standard_policy(contract)

    outsider = create_address(
        "memoryseal-unapproved-issuer"
    )

    direct_vm.sender = outsider

    with direct_vm.expect_revert(
        "ISSUER_NOT_APPROVED"
    ):
        _register(
            contract,
            policy_id,
            "record-outsider",
            1,
            origins[0] + "/record",
            origins[0],
            DIGEST_A,
            NOW - DAY,
            NOW + DAY,
        )

    direct_vm.sender = issuers[0]

    with direct_vm.expect_revert(
        "ORIGIN_NOT_APPROVED"
    ):
        _register(
            contract,
            policy_id,
            "record-origin",
            1,
            "https://evil.example.com/record",
            "https://evil.example.com",
            DIGEST_A,
            NOW - DAY,
            NOW + DAY,
        )

    with direct_vm.expect_revert(
        "SOURCE_ORIGIN_MISMATCH"
    ):
        _register(
            contract,
            policy_id,
            "record-prefix",
            1,
            "https://alpha.example.com.evil.com/record",
            origins[0],
            DIGEST_A,
            NOW - DAY,
            NOW + DAY,
        )

    with direct_vm.expect_revert(
        "INVALID_SHA256"
    ):
        _register(
            contract,
            policy_id,
            "record-digest",
            1,
            origins[0] + "/record",
            origins[0],
            "A" * 64,
            NOW - DAY,
            NOW + DAY,
        )

    assert int(contract.get_evidence_count()) == 0

    direct_vm.sender = owner


def test_evidence_time_guards_are_deterministic(
    direct_vm,
    direct_deploy,
):
    contract, _ = _deploy(
        direct_vm,
        direct_deploy,
    )

    (
        policy_id,
        issuers,
        origins,
        _,
    ) = _seal_standard_policy(contract)

    direct_vm.sender = issuers[0]

    with direct_vm.expect_revert(
        "ISSUED_AT_IN_FUTURE"
    ):
        _register(
            contract,
            policy_id,
            "future-record",
            1,
            origins[0] + "/future",
            origins[0],
            DIGEST_A,
            NOW + 1,
            NOW + DAY,
        )

    with direct_vm.expect_revert(
        "EVIDENCE_TOO_OLD"
    ):
        _register(
            contract,
            policy_id,
            "stale-record",
            1,
            origins[0] + "/stale",
            origins[0],
            DIGEST_A,
            NOW - MAX_AGE - 1,
            NOW + DAY,
        )

    with direct_vm.expect_revert(
        "EVIDENCE_EXPIRED"
    ):
        _register(
            contract,
            policy_id,
            "expired-record",
            1,
            origins[0] + "/expired",
            origins[0],
            DIGEST_A,
            NOW - DAY,
            NOW,
        )

    with direct_vm.expect_revert(
        "INSUFFICIENT_REMAINING_VALIDITY"
    ):
        _register(
            contract,
            policy_id,
            "short-record",
            1,
            origins[0] + "/short",
            origins[0],
            DIGEST_A,
            NOW - DAY,
            NOW + MIN_VALIDITY - 1,
        )

    with direct_vm.expect_revert(
        "INVALID_EVIDENCE_INTERVAL"
    ):
        _register(
            contract,
            policy_id,
            "bad-interval",
            1,
            origins[0] + "/interval",
            origins[0],
            DIGEST_A,
            NOW - DAY,
            NOW - DAY,
        )

    assert int(contract.get_evidence_count()) == 0


def test_evidence_lineage_cannot_be_hijacked_and_version_must_increase(
    direct_vm,
    direct_deploy,
):
    contract, _ = _deploy(
        direct_vm,
        direct_deploy,
    )

    (
        policy_id,
        issuers,
        origins,
        _,
    ) = _seal_standard_policy(contract)

    stable_id = "canonical-record"

    direct_vm.sender = issuers[0]

    evidence_v1 = _register(
        contract,
        policy_id,
        stable_id,
        1,
        origins[0] + "/v1",
        origins[0],
        DIGEST_A,
        NOW - DAY,
        NOW + (2 * DAY),
    )

    assert int(
        contract.get_latest_evidence_version(
            policy_id,
            stable_id,
        )
    ) == 1

    with direct_vm.expect_revert(
        "VERSION_NOT_INCREASING"
    ):
        _register(
            contract,
            policy_id,
            stable_id,
            1,
            origins[0] + "/v1-again",
            origins[0],
            DIGEST_A,
            NOW - DAY,
            NOW + (2 * DAY),
        )

    direct_vm.sender = issuers[1]

    with direct_vm.expect_revert(
        "LINEAGE_ISSUER_MISMATCH"
    ):
        _register(
            contract,
            policy_id,
            stable_id,
            2,
            origins[0] + "/v2-hijack",
            origins[0],
            DIGEST_B,
            NOW - DAY,
            NOW + (2 * DAY),
        )

    direct_vm.sender = issuers[0]

    with direct_vm.expect_revert(
        "LINEAGE_ORIGIN_MISMATCH"
    ):
        _register(
            contract,
            policy_id,
            stable_id,
            2,
            origins[1] + "/v2",
            origins[1],
            DIGEST_B,
            NOW - DAY,
            NOW + (2 * DAY),
        )

    evidence_v2 = _register(
        contract,
        policy_id,
        stable_id,
        2,
        origins[0] + "/v2",
        origins[0],
        DIGEST_B,
        NOW - DAY,
        NOW + (2 * DAY),
    )

    assert evidence_v1 != evidence_v2

    assert int(
        contract.get_latest_evidence_version(
            policy_id,
            stable_id,
        )
    ) == 2

    assert int(contract.get_evidence_count()) == 2

    old_record = contract.get_evidence(
        evidence_v1
    )

    new_record = contract.get_evidence(
        evidence_v2
    )

    assert int(old_record.version) == 1
    assert old_record.sha256_digest == DIGEST_A

    assert int(new_record.version) == 2
    assert new_record.sha256_digest == DIGEST_B

    assert contract.derive_evidence_id(
        policy_id,
        stable_id,
        1,
    ) == evidence_v1

    assert contract.derive_evidence_id(
        policy_id,
        stable_id,
        2,
    ) == evidence_v2


def test_missing_records_fail_closed_without_mutation(
    direct_vm,
    direct_deploy,
):
    contract, _ = _deploy(
        direct_vm,
        direct_deploy,
    )

    with direct_vm.expect_revert(
        "POLICY_NOT_FOUND"
    ):
        contract.get_policy(
            "missing-policy"
        )

    with direct_vm.expect_revert(
        "EVIDENCE_NOT_FOUND"
    ):
        contract.get_evidence(
            "missing-evidence"
        )

    assert int(contract.get_policy_count()) == 0
    assert int(contract.get_evidence_count()) == 0
