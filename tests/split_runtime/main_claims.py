from memoryseal_split_harness import deploy_composed_contract as _deploy_composed_contract
from gltest.direct import create_address


NOW_ISO = "2026-09-10T12:00:00Z"
NOW = 1_789_041_600

DAY = 24 * 60 * 60
HOUR = 60 * 60

MAX_AGE = 30 * DAY
MIN_VALIDITY = HOUR
CLAIM_LIFETIME = 14 * DAY

DIGEST_A = "a" * 64
DIGEST_B = "b" * 64
DIGEST_C = "c" * 64


def _deploy(
    direct_vm,
    direct_deploy,
):
    return _deploy_composed_contract(
        direct_vm,
        direct_deploy,
        NOW_ISO,
    )


def _issuers():
    values = [
        create_address("memoryseal-issuer-a"),
        create_address("memoryseal-issuer-b"),
        create_address("memoryseal-issuer-c"),
    ]

    return sorted(
        values,
        key=lambda address: address.as_hex,
    )


def _origins():
    return [
        "https://alpha.example.com",
        "https://docs.example.com",
        "https://zeta.example.com",
    ]


def _create_and_seal_policy(
    contract,
    slug="claim-policy",
    min_evidence_records=2,
    min_distinct_issuers=2,
    min_distinct_origins=2,
    max_evidence_records=4,
    approved_issuer_count=3,
    approved_origin_count=3,
):
    policy_id = contract.create_policy(
        slug,
        1,
        min_evidence_records,
        min_distinct_issuers,
        min_distinct_origins,
        MAX_AGE,
        MIN_VALIDITY,
        CLAIM_LIFETIME,
        max_evidence_records,
        100_000,
    )

    issuers = _issuers()
    origins = _origins()

    for issuer in issuers[
        :approved_issuer_count
    ]:
        contract.add_policy_issuer(
            policy_id,
            issuer.as_hex,
        )

    for origin in origins[
        :approved_origin_count
    ]:
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
    direct_vm,
    contract,
    policy_id,
    stable_record_id,
    version,
    issuer,
    origin,
    digest,
    issued_at,
    expires_at,
):
    direct_vm.sender = issuer

    return contract.register_evidence(
        policy_id,
        stable_record_id,
        version,
        origin
        + "/records/"
        + stable_record_id
        + "/v"
        + str(version),
        origin,
        digest,
        issued_at,
        expires_at,
    )


def _register_pair(
    direct_vm,
    contract,
    policy_id,
    issuers,
    origins,
    issued_at=NOW - HOUR,
    expires_a=NOW + (10 * DAY),
    expires_b=NOW + (10 * DAY),
):
    evidence_a = _register(
        direct_vm,
        contract,
        policy_id,
        "record-a",
        1,
        issuers[0],
        origins[0],
        DIGEST_A,
        issued_at,
        expires_a,
    )

    evidence_b = _register(
        direct_vm,
        contract,
        policy_id,
        "record-b",
        1,
        issuers[1],
        origins[1],
        DIGEST_B,
        issued_at,
        expires_b,
    )

    return sorted(
        [evidence_a, evidence_b]
    )


def _propose(
    direct_vm,
    contract,
    proposer,
    policy_id,
    evidence_ids,
    subject_id="agent.release-status",
    claim_text="Release candidate passed verification.",
    supersedes_claim_id="",
):
    direct_vm.sender = proposer

    return contract.propose_claim(
        subject_id,
        claim_text,
        policy_id,
        evidence_ids,
        supersedes_claim_id,
    )


def test_valid_claim_binds_exact_policy_evidence_and_deadline(
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
    ) = _create_and_seal_policy(contract)

    evidence_ids = _register_pair(
        direct_vm,
        contract,
        policy_id,
        issuers,
        origins,
        expires_a=NOW + (10 * DAY),
        expires_b=NOW + (5 * DAY),
    )

    claim_id = _propose(
        direct_vm,
        contract,
        owner,
        policy_id,
        evidence_ids,
    )

    claim = contract.get_claim(
        claim_id
    )

    assert int(contract.get_claim_count()) == 1
    assert int(claim.sequence) == 1

    assert (
        claim.subject_id
        == "agent.release-status"
    )

    assert (
        claim.claim_text
        == "Release candidate passed verification."
    )

    assert len(claim.claim_hash) == 64

    assert claim.policy_id == policy_id
    assert (
        claim.policy_fingerprint
        == fingerprint
    )

    assert (
        claim.proposer.as_hex.lower()
        == owner.as_hex.lower()
    )

    assert int(claim.evidence_count) == 2
    assert len(claim.source_set_digest) == 64

    assert (
        int(claim.evidence_expires_at)
        == NOW + (5 * DAY)
    )

    assert (
        int(claim.review_deadline)
        == NOW + (5 * DAY)
    )

    assert int(claim.created_at) == NOW
    assert int(claim.state_changed_at) == NOW

    assert claim.state == "REVIEWABLE"
    assert claim.reason_code == ""
    assert claim.supersedes_claim_id == ""

    assert contract.get_subject_head(
        "agent.release-status"
    ) == ""

    assert contract.get_claim_evidence_id(
        claim_id,
        0,
    ) == evidence_ids[0]

    assert contract.get_claim_evidence_id(
        claim_id,
        1,
    ) == evidence_ids[1]

    with direct_vm.expect_revert(
        "CLAIM_EVIDENCE_INDEX_OUT_OF_RANGE"
    ):
        contract.get_claim_evidence_id(
            claim_id,
            2,
        )


def test_claim_input_validation_and_minimum_evidence_fail_closed(
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
    ) = _create_and_seal_policy(contract)

    evidence_ids = _register_pair(
        direct_vm,
        contract,
        policy_id,
        issuers,
        origins,
    )

    direct_vm.sender = owner

    with direct_vm.expect_revert(
        "SUBJECT_ID_EMPTY"
    ):
        contract.propose_claim(
            "",
            "Valid claim.",
            policy_id,
            evidence_ids,
            "",
        )

    with direct_vm.expect_revert(
        "SUBJECT_ID_INVALID_CHARACTER"
    ):
        contract.propose_claim(
            "Invalid Subject",
            "Valid claim.",
            policy_id,
            evidence_ids,
            "",
        )

    with direct_vm.expect_revert(
        "CLAIM_TEXT_EMPTY"
    ):
        contract.propose_claim(
            "agent.status",
            "",
            policy_id,
            evidence_ids,
            "",
        )

    with direct_vm.expect_revert(
        "CLAIM_TEXT_NOT_CANONICAL"
    ):
        contract.propose_claim(
            "agent.status",
            "Trailing space. ",
            policy_id,
            evidence_ids,
            "",
        )

    with direct_vm.expect_revert(
        "CLAIM_TEXT_CONTROL_CHARACTER"
    ):
        contract.propose_claim(
            "agent.status",
            "Valid\x00Invalid",
            policy_id,
            evidence_ids,
            "",
        )

    with direct_vm.expect_revert(
        "CLAIM_TEXT_TOO_LONG"
    ):
        contract.propose_claim(
            "agent.status",
            "x" * 2049,
            policy_id,
            evidence_ids,
            "",
        )

    with direct_vm.expect_revert(
        "INSUFFICIENT_EVIDENCE_RECORDS"
    ):
        contract.propose_claim(
            "agent.status",
            "Valid claim.",
            policy_id,
            [evidence_ids[0]],
            "",
        )

    assert int(contract.get_claim_count()) == 0


def test_claim_rejects_too_many_evidence_records(
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
    ) = _create_and_seal_policy(
        contract,
        slug="max-evidence-policy",
        max_evidence_records=2,
    )

    evidence_a = _register(
        direct_vm,
        contract,
        policy_id,
        "record-a",
        1,
        issuers[0],
        origins[0],
        DIGEST_A,
        NOW - HOUR,
        NOW + (10 * DAY),
    )

    evidence_b = _register(
        direct_vm,
        contract,
        policy_id,
        "record-b",
        1,
        issuers[1],
        origins[1],
        DIGEST_B,
        NOW - HOUR,
        NOW + (10 * DAY),
    )

    evidence_c = _register(
        direct_vm,
        contract,
        policy_id,
        "record-c",
        1,
        issuers[2],
        origins[2],
        DIGEST_C,
        NOW - HOUR,
        NOW + (10 * DAY),
    )

    evidence_ids = sorted(
        [
            evidence_a,
            evidence_b,
            evidence_c,
        ]
    )

    with direct_vm.expect_revert(
        "TOO_MANY_EVIDENCE_RECORDS"
    ):
        _propose(
            direct_vm,
            contract,
            owner,
            policy_id,
            evidence_ids,
        )

    assert int(contract.get_claim_count()) == 0


def test_claim_evidence_ids_must_be_strictly_sorted(
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
    ) = _create_and_seal_policy(contract)

    evidence_ids = _register_pair(
        direct_vm,
        contract,
        policy_id,
        issuers,
        origins,
    )

    reversed_ids = list(
        reversed(evidence_ids)
    )

    with direct_vm.expect_revert(
        "EVIDENCE_IDS_NOT_STRICTLY_SORTED"
    ):
        _propose(
            direct_vm,
            contract,
            owner,
            policy_id,
            reversed_ids,
        )

    with direct_vm.expect_revert(
        "EVIDENCE_IDS_NOT_STRICTLY_SORTED"
    ):
        _propose(
            direct_vm,
            contract,
            owner,
            policy_id,
            [
                evidence_ids[0],
                evidence_ids[0],
            ],
        )

    assert int(contract.get_claim_count()) == 0


def test_duplicate_content_digest_cannot_fake_corroboration(
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
    ) = _create_and_seal_policy(contract)

    evidence_a = _register(
        direct_vm,
        contract,
        policy_id,
        "record-a",
        1,
        issuers[0],
        origins[0],
        DIGEST_A,
        NOW - HOUR,
        NOW + (10 * DAY),
    )

    evidence_b = _register(
        direct_vm,
        contract,
        policy_id,
        "record-b",
        1,
        issuers[1],
        origins[1],
        DIGEST_A,
        NOW - HOUR,
        NOW + (10 * DAY),
    )

    with direct_vm.expect_revert(
        "DUPLICATE_EVIDENCE_DIGEST"
    ):
        _propose(
            direct_vm,
            contract,
            owner,
            policy_id,
            sorted(
                [evidence_a, evidence_b]
            ),
        )

    assert int(contract.get_claim_count()) == 0


def test_distinct_issuer_threshold_is_rechecked(
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
    ) = _create_and_seal_policy(contract)

    evidence_a = _register(
        direct_vm,
        contract,
        policy_id,
        "same-issuer-a",
        1,
        issuers[0],
        origins[0],
        DIGEST_A,
        NOW - HOUR,
        NOW + (10 * DAY),
    )

    evidence_b = _register(
        direct_vm,
        contract,
        policy_id,
        "same-issuer-b",
        1,
        issuers[0],
        origins[1],
        DIGEST_B,
        NOW - HOUR,
        NOW + (10 * DAY),
    )

    with direct_vm.expect_revert(
        "INSUFFICIENT_DISTINCT_ISSUERS"
    ):
        _propose(
            direct_vm,
            contract,
            owner,
            policy_id,
            sorted(
                [evidence_a, evidence_b]
            ),
        )

    assert int(contract.get_claim_count()) == 0


def test_distinct_origin_threshold_is_rechecked(
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
    ) = _create_and_seal_policy(contract)

    evidence_a = _register(
        direct_vm,
        contract,
        policy_id,
        "same-origin-a",
        1,
        issuers[0],
        origins[0],
        DIGEST_A,
        NOW - HOUR,
        NOW + (10 * DAY),
    )

    evidence_b = _register(
        direct_vm,
        contract,
        policy_id,
        "same-origin-b",
        1,
        issuers[1],
        origins[0],
        DIGEST_B,
        NOW - HOUR,
        NOW + (10 * DAY),
    )

    with direct_vm.expect_revert(
        "INSUFFICIENT_DISTINCT_ORIGINS"
    ):
        _propose(
            direct_vm,
            contract,
            owner,
            policy_id,
            sorted(
                [evidence_a, evidence_b]
            ),
        )

    assert int(contract.get_claim_count()) == 0


def test_cross_policy_and_outdated_evidence_are_rejected(
    direct_vm,
    direct_deploy,
):
    contract, owner = _deploy(
        direct_vm,
        direct_deploy,
    )

    (
        policy_a,
        issuers,
        origins,
        _,
    ) = _create_and_seal_policy(
        contract,
        slug="policy-a",
    )

    (
        policy_b,
        _,
        _,
        _,
    ) = _create_and_seal_policy(
        contract,
        slug="policy-b",
    )

    evidence_a = _register(
        direct_vm,
        contract,
        policy_a,
        "policy-a-record",
        1,
        issuers[0],
        origins[0],
        DIGEST_A,
        NOW - HOUR,
        NOW + (10 * DAY),
    )

    evidence_b = _register(
        direct_vm,
        contract,
        policy_b,
        "policy-b-record",
        1,
        issuers[1],
        origins[1],
        DIGEST_B,
        NOW - HOUR,
        NOW + (10 * DAY),
    )

    with direct_vm.expect_revert(
        "EVIDENCE_POLICY_MISMATCH"
    ):
        _propose(
            direct_vm,
            contract,
            owner,
            policy_a,
            sorted(
                [evidence_a, evidence_b]
            ),
        )

    lineage_v1 = _register(
        direct_vm,
        contract,
        policy_a,
        "versioned-record",
        1,
        issuers[0],
        origins[0],
        DIGEST_A,
        NOW - HOUR,
        NOW + (10 * DAY),
    )

    _register(
        direct_vm,
        contract,
        policy_a,
        "versioned-record",
        2,
        issuers[0],
        origins[0],
        DIGEST_C,
        NOW - HOUR,
        NOW + (10 * DAY),
    )

    independent = _register(
        direct_vm,
        contract,
        policy_a,
        "independent-record",
        1,
        issuers[1],
        origins[1],
        DIGEST_B,
        NOW - HOUR,
        NOW + (10 * DAY),
    )

    with direct_vm.expect_revert(
        "EVIDENCE_NOT_LATEST"
    ):
        _propose(
            direct_vm,
            contract,
            owner,
            policy_a,
            sorted(
                [lineage_v1, independent]
            ),
        )

    assert int(contract.get_claim_count()) == 0


def test_evidence_freshness_is_rechecked_when_claim_is_proposed(
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
    ) = _create_and_seal_policy(contract)

    evidence_ids = _register_pair(
        direct_vm,
        contract,
        policy_id,
        issuers,
        origins,
        issued_at=NOW,
        expires_a=NOW + (40 * DAY),
        expires_b=NOW + (40 * DAY),
    )

    direct_vm.warp(
        "2026-10-10T12:00:01Z"
    )

    with direct_vm.expect_revert(
        "EVIDENCE_TOO_OLD"
    ):
        _propose(
            direct_vm,
            contract,
            owner,
            policy_id,
            evidence_ids,
        )

    assert int(contract.get_claim_count()) == 0


def test_evidence_expiry_is_rechecked_when_claim_is_proposed(
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
    ) = _create_and_seal_policy(contract)

    evidence_ids = _register_pair(
        direct_vm,
        contract,
        policy_id,
        issuers,
        origins,
        issued_at=NOW - HOUR,
        expires_a=NOW + (2 * HOUR),
        expires_b=NOW + (2 * HOUR),
    )

    direct_vm.warp(
        "2026-09-10T14:00:00Z"
    )

    with direct_vm.expect_revert(
        "EVIDENCE_EXPIRED"
    ):
        _propose(
            direct_vm,
            contract,
            owner,
            policy_id,
            evidence_ids,
        )

    assert int(contract.get_claim_count()) == 0


def test_remaining_validity_is_rechecked_when_claim_is_proposed(
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
    ) = _create_and_seal_policy(contract)

    evidence_ids = _register_pair(
        direct_vm,
        contract,
        policy_id,
        issuers,
        origins,
        issued_at=NOW - HOUR,
        expires_a=NOW + (2 * HOUR),
        expires_b=NOW + (2 * HOUR),
    )

    direct_vm.warp(
        "2026-09-10T13:00:01Z"
    )

    with direct_vm.expect_revert(
        "INSUFFICIENT_REMAINING_VALIDITY"
    ):
        _propose(
            direct_vm,
            contract,
            owner,
            policy_id,
            evidence_ids,
        )

    assert int(contract.get_claim_count()) == 0


def test_only_proposer_can_cancel_and_cancellation_is_terminal(
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
    ) = _create_and_seal_policy(contract)

    evidence_ids = _register_pair(
        direct_vm,
        contract,
        policy_id,
        issuers,
        origins,
    )

    claim_id = _propose(
        direct_vm,
        contract,
        owner,
        policy_id,
        evidence_ids,
    )

    outsider = create_address(
        "memoryseal-claim-outsider"
    )

    direct_vm.sender = outsider

    with direct_vm.expect_revert(
        "ONLY_CLAIM_PROPOSER"
    ):
        contract.cancel_claim(
            claim_id
        )

    assert (
        contract.get_claim(
            claim_id
        ).state
        == "REVIEWABLE"
    )

    direct_vm.sender = owner

    contract.cancel_claim(
        claim_id
    )

    claim = contract.get_claim(
        claim_id
    )

    assert claim.state == "CANCELED"
    assert (
        claim.reason_code
        == "PROPOSER_CANCELED"
    )

    with direct_vm.expect_revert(
        "CLAIM_NOT_REVIEWABLE"
    ):
        contract.cancel_claim(
            claim_id
        )

    with direct_vm.expect_revert(
        "CLAIM_NOT_REVIEWABLE"
    ):
        contract.expire_claim(
            claim_id
        )

    assert contract.get_subject_head(
        claim.subject_id
    ) == ""


def test_claim_expiry_is_permissionless_at_exact_deadline(
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
    ) = _create_and_seal_policy(contract)

    evidence_ids = _register_pair(
        direct_vm,
        contract,
        policy_id,
        issuers,
        origins,
        expires_a=NOW + (20 * DAY),
        expires_b=NOW + (20 * DAY),
    )

    claim_id = _propose(
        direct_vm,
        contract,
        owner,
        policy_id,
        evidence_ids,
    )

    claim = contract.get_claim(
        claim_id
    )

    assert (
        int(claim.review_deadline)
        == NOW + (7 * DAY)
    )

    outsider = create_address(
        "memoryseal-expiry-caller"
    )

    direct_vm.sender = outsider

    with direct_vm.expect_revert(
        "CLAIM_NOT_EXPIRED"
    ):
        contract.expire_claim(
            claim_id
        )

    direct_vm.warp(
        "2026-09-17T12:00:00Z"
    )

    contract.expire_claim(
        claim_id
    )

    expired = contract.get_claim(
        claim_id
    )

    assert expired.state == "EXPIRED"
    assert (
        expired.reason_code
        == "REVIEW_WINDOW_EXPIRED"
    )

    assert (
        int(expired.state_changed_at)
        == NOW + (7 * DAY)
    )

    assert contract.get_subject_head(
        expired.subject_id
    ) == ""


def test_supersession_fails_closed_before_canonical_admission(
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
    ) = _create_and_seal_policy(contract)

    evidence_ids = _register_pair(
        direct_vm,
        contract,
        policy_id,
        issuers,
        origins,
    )

    base_claim = _propose(
        direct_vm,
        contract,
        owner,
        policy_id,
        evidence_ids,
        subject_id="agent.model",
        claim_text="Model version is 1.",
    )

    assert (
        contract.get_subject_head(
            "agent.model"
        )
        == ""
    )

    with direct_vm.expect_revert(
        "SUPERSESSION_TARGET_NOT_FOUND"
    ):
        _propose(
            direct_vm,
            contract,
            owner,
            policy_id,
            evidence_ids,
            subject_id="agent.model",
            claim_text="Model version is 2.",
            supersedes_claim_id=(
                "missing-claim"
            ),
        )

    with direct_vm.expect_revert(
        "SUPERSESSION_TARGET_NOT_CURRENT_HEAD"
    ):
        _propose(
            direct_vm,
            contract,
            owner,
            policy_id,
            evidence_ids,
            subject_id="agent.model",
            claim_text="Model version is 2.",
            supersedes_claim_id=base_claim,
        )

    assert int(contract.get_claim_count()) == 1

    assert (
        contract.get_subject_head(
            "agent.model"
        )
        == ""
    )


def test_source_set_commitment_is_stable_across_claim_texts(
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
    ) = _create_and_seal_policy(contract)

    evidence_ids = _register_pair(
        direct_vm,
        contract,
        policy_id,
        issuers,
        origins,
    )

    claim_a_id = _propose(
        direct_vm,
        contract,
        owner,
        policy_id,
        evidence_ids,
        subject_id="agent.fact-a",
        claim_text="First proposition.",
    )

    claim_b_id = _propose(
        direct_vm,
        contract,
        owner,
        policy_id,
        evidence_ids,
        subject_id="agent.fact-b",
        claim_text="Second proposition.",
    )

    claim_a = contract.get_claim(
        claim_a_id
    )

    claim_b = contract.get_claim(
        claim_b_id
    )

    assert claim_a_id != claim_b_id
    assert claim_a.claim_hash != claim_b.claim_hash

    assert (
        claim_a.source_set_digest
        == claim_b.source_set_digest
    )

    assert (
        claim_a.policy_fingerprint
        == fingerprint
    )

    assert (
        claim_b.policy_fingerprint
        == fingerprint
    )

    assert int(contract.get_claim_count()) == 2

    assert (
        contract.get_subject_head(
            "agent.fact-a"
        )
        == ""
    )

    assert (
        contract.get_subject_head(
            "agent.fact-b"
        )
        == ""
    )
