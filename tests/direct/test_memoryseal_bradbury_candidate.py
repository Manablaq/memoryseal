import hashlib
import json
import re

from gltest.direct import create_address


NOW_ISO = "2026-09-10T12:00:00Z"
NOW = 1_789_041_600

DAY = 24 * 60 * 60
HOUR = 60 * 60

MAX_AGE = 30 * DAY
MIN_VALIDITY = HOUR
CLAIM_LIFETIME = 14 * DAY

BODY_A = (
    "Release verification report A confirms "
    "all required checks passed."
)

BODY_B = (
    "Independent release verification report B "
    "also confirms all required checks passed."
)


def _deploy(
    direct_vm,
    direct_deploy,
):
    direct_vm.check_pickling = True

    contract = direct_deploy(
        "contracts/memoryseal_bradbury_candidate.py"
    )

    owner = create_address(
        "default_sender"
    )

    direct_vm.sender = owner
    direct_vm.warp(NOW_ISO)

    return contract, owner


def _issuers():
    return sorted(
        [
            create_address(
                "memoryseal-issuer-a"
            ),
            create_address(
                "memoryseal-issuer-b"
            ),
        ],
        key=lambda address: address.as_hex,
    )


def _setup_policy_and_evidence(
    direct_vm,
    contract,
    claim_lifetime=CLAIM_LIFETIME,
):
    issuers = _issuers()

    origins = [
        "https://alpha.example.com",
        "https://docs.example.com",
    ]

    policy_id = contract.create_policy(
        "consensus-policy",
        1,
        2,
        2,
        2,
        MAX_AGE,
        MIN_VALIDITY,
        claim_lifetime,
        4,
        100_000,
    )

    for issuer in issuers:
        contract.add_policy_issuer(
            policy_id,
            issuer.as_hex,
        )

    for origin in origins:
        contract.add_policy_origin(
            policy_id,
            origin,
        )

    contract.seal_policy(
        policy_id
    )

    raw = [
        (
            "record-a",
            issuers[0],
            origins[0],
            BODY_A,
        ),
        (
            "record-b",
            issuers[1],
            origins[1],
            BODY_B,
        ),
    ]

    records = []

    for stable_id, issuer, origin, body in raw:
        digest = hashlib.sha256(
            body.encode("utf-8")
        ).hexdigest()

        direct_vm.sender = issuer

        url = (
            origin
            + "/records/"
            + stable_id
        )

        evidence_id = (
            contract.register_evidence(
                policy_id,
                stable_id,
                1,
                url,
                origin,
                digest,
                NOW - HOUR,
                NOW + (20 * DAY),
            )
        )

        records.append(
            {
                "evidence_id": evidence_id,
                "stable_id": stable_id,
                "issuer": issuer,
                "origin": origin,
                "url": url,
                "body": body,
            }
        )

    records.sort(
        key=lambda item: item[
            "evidence_id"
        ]
    )

    evidence_ids = [
        item["evidence_id"]
        for item in records
    ]

    return (
        policy_id,
        issuers,
        origins,
        records,
        evidence_ids,
    )


def _mock_web_records(
    direct_vm,
    records,
):
    for record in records:
        direct_vm.mock_web(
            re.escape(record["url"]),
            {
                "status": 200,
                "body": record["body"],
            },
        )


def _mock_llm(
    direct_vm,
    supported,
    reason_code,
):
    direct_vm.mock_llm(
        r"(?s).*MemorySeal semantic evidence review.*",
        json.dumps(
            {
                "claim_supported": (
                    supported
                ),
                "reason_code": (
                    reason_code
                ),
            }
        ),
    )


def _propose(
    direct_vm,
    contract,
    proposer,
    policy_id,
    evidence_ids,
    *,
    subject="agent.release-status",
    text="Release candidate passed verification.",
    supersedes="",
):
    direct_vm.sender = proposer

    return contract.propose_claim(
        subject,
        text,
        policy_id,
        evidence_ids,
        supersedes,
    )


def test_supported_review_sets_canonical_head_and_validity(
    direct_vm,
    direct_deploy,
):
    contract, owner = _deploy(
        direct_vm,
        direct_deploy,
    )

    (
        policy_id,
        _,
        _,
        records,
        evidence_ids,
    ) = _setup_policy_and_evidence(
        direct_vm,
        contract,
    )

    claim_id = _propose(
        direct_vm,
        contract,
        owner,
        policy_id,
        evidence_ids,
    )

    _mock_web_records(
        direct_vm,
        records,
    )

    _mock_llm(
        direct_vm,
        True,
        "SUPPORTED",
    )

    result = contract.review_claim(
        claim_id
    )

    assert result == "SUPPORTED|SUPPORTED|"

    claim = contract.get_claim(
        claim_id
    )

    assert claim.state == "SUPPORTED"
    assert claim.reason_code == "SUPPORTED"
    assert claim.repair_evidence_id == ""
    assert int(claim.reviewed_at) == NOW

    assert (
        int(claim.valid_until)
        == NOW + CLAIM_LIFETIME
    )

    assert (
        contract.get_subject_head(
            "agent.release-status"
        )
        == claim_id
    )

    assert direct_vm.run_validator() is True


def test_rejected_review_does_not_create_head(
    direct_vm,
    direct_deploy,
):
    contract, owner = _deploy(
        direct_vm,
        direct_deploy,
    )

    (
        policy_id,
        _,
        _,
        records,
        evidence_ids,
    ) = _setup_policy_and_evidence(
        direct_vm,
        contract,
    )

    claim_id = _propose(
        direct_vm,
        contract,
        owner,
        policy_id,
        evidence_ids,
    )

    _mock_web_records(
        direct_vm,
        records,
    )

    _mock_llm(
        direct_vm,
        False,
        "CONTRADICTED",
    )

    result = contract.review_claim(
        claim_id
    )

    assert (
        result
        == "REJECTED|CONTRADICTED|"
    )

    claim = contract.get_claim(
        claim_id
    )

    assert claim.state == "REJECTED"
    assert claim.valid_until == 0

    assert (
        contract.get_subject_head(
            claim.subject_id
        )
        == ""
    )

    assert direct_vm.run_validator() is True


def test_validator_disagreement_is_detectable(
    direct_vm,
    direct_deploy,
):
    contract, owner = _deploy(
        direct_vm,
        direct_deploy,
    )

    (
        policy_id,
        _,
        _,
        records,
        evidence_ids,
    ) = _setup_policy_and_evidence(
        direct_vm,
        contract,
    )

    claim_id = _propose(
        direct_vm,
        contract,
        owner,
        policy_id,
        evidence_ids,
    )

    _mock_web_records(
        direct_vm,
        records,
    )

    _mock_llm(
        direct_vm,
        True,
        "SUPPORTED",
    )

    assert (
        contract.review_claim(
            claim_id
        )
        == "SUPPORTED|SUPPORTED|"
    )

    direct_vm.clear_mocks()

    _mock_web_records(
        direct_vm,
        records,
    )

    _mock_llm(
        direct_vm,
        False,
        "CONTRADICTED",
    )

    assert direct_vm.run_validator() is False


def test_hash_mismatch_persists_repair_state(
    direct_vm,
    direct_deploy,
):
    contract, owner = _deploy(
        direct_vm,
        direct_deploy,
    )

    (
        policy_id,
        _,
        _,
        records,
        evidence_ids,
    ) = _setup_policy_and_evidence(
        direct_vm,
        contract,
    )

    claim_id = _propose(
        direct_vm,
        contract,
        owner,
        policy_id,
        evidence_ids,
    )

    first = records[0]

    for record in records:
        body = record["body"]

        if (
            record["evidence_id"]
            == first["evidence_id"]
        ):
            body = body + " tampered"

        direct_vm.mock_web(
            re.escape(record["url"]),
            {
                "status": 200,
                "body": body,
            },
        )

    result = contract.review_claim(
        claim_id
    )

    assert result == (
        "REPAIR_REQUIRED|HASH_MISMATCH|"
        + first["evidence_id"]
    )

    claim = contract.get_claim(
        claim_id
    )

    assert claim.state == "REPAIR_REQUIRED"
    assert claim.reason_code == "HASH_MISMATCH"

    assert (
        claim.repair_evidence_id
        == first["evidence_id"]
    )

    assert (
        contract.get_subject_head(
            claim.subject_id
        )
        == ""
    )

    assert direct_vm.run_validator() is True


def test_outdated_bound_evidence_becomes_repair_required(
    direct_vm,
    direct_deploy,
):
    contract, owner = _deploy(
        direct_vm,
        direct_deploy,
    )

    (
        policy_id,
        _,
        _,
        records,
        evidence_ids,
    ) = _setup_policy_and_evidence(
        direct_vm,
        contract,
    )

    claim_id = _propose(
        direct_vm,
        contract,
        owner,
        policy_id,
        evidence_ids,
    )

    target = records[0]

    direct_vm.sender = target["issuer"]

    contract.register_evidence(
        policy_id,
        target["stable_id"],
        2,
        target["url"] + "/v2",
        target["origin"],
        "c" * 64,
        NOW - HOUR,
        NOW + (20 * DAY),
    )

    result = contract.review_claim(
        claim_id
    )

    assert result == (
        "REPAIR_REQUIRED|EVIDENCE_NOT_LATEST|"
        + target["evidence_id"]
    )

    claim = contract.get_claim(
        claim_id
    )

    assert claim.state == "REPAIR_REQUIRED"

    assert (
        claim.repair_evidence_id
        == target["evidence_id"]
    )


def test_repair_required_claim_can_be_canceled_by_proposer(
    direct_vm,
    direct_deploy,
):
    contract, owner = _deploy(
        direct_vm,
        direct_deploy,
    )

    (
        policy_id,
        _,
        _,
        records,
        evidence_ids,
    ) = _setup_policy_and_evidence(
        direct_vm,
        contract,
    )

    claim_id = _propose(
        direct_vm,
        contract,
        owner,
        policy_id,
        evidence_ids,
    )

    first = records[0]

    for record in records:
        body = record["body"]

        if (
            record["evidence_id"]
            == first["evidence_id"]
        ):
            body = body + " changed"

        direct_vm.mock_web(
            re.escape(record["url"]),
            {
                "status": 200,
                "body": body,
            },
        )

    contract.review_claim(
        claim_id
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


def test_positive_supersession_updates_head_and_history(
    direct_vm,
    direct_deploy,
):
    contract, owner = _deploy(
        direct_vm,
        direct_deploy,
    )

    (
        policy_id,
        _,
        _,
        records,
        evidence_ids,
    ) = _setup_policy_and_evidence(
        direct_vm,
        contract,
    )

    base_claim = _propose(
        direct_vm,
        contract,
        owner,
        policy_id,
        evidence_ids,
        subject="agent.model-version",
        text="Model version is 1.",
    )

    _mock_web_records(
        direct_vm,
        records,
    )

    _mock_llm(
        direct_vm,
        True,
        "SUPPORTED",
    )

    contract.review_claim(
        base_claim
    )

    direct_vm.clear_mocks()

    replacement = _propose(
        direct_vm,
        contract,
        owner,
        policy_id,
        evidence_ids,
        subject="agent.model-version",
        text="Model version is 2.",
        supersedes=base_claim,
    )

    _mock_web_records(
        direct_vm,
        records,
    )

    _mock_llm(
        direct_vm,
        True,
        "SUPPORTED",
    )

    result = contract.review_claim(
        replacement
    )

    assert result == "SUPPORTED|SUPPORTED|"

    old_claim = contract.get_claim(
        base_claim
    )

    new_claim = contract.get_claim(
        replacement
    )

    assert old_claim.state == "SUPERSEDED"

    assert (
        old_claim.superseded_by_claim_id
        == replacement
    )

    assert (
        new_claim.supersedes_claim_id
        == base_claim
    )

    assert new_claim.state == "SUPPORTED"

    assert (
        contract.get_subject_head(
            "agent.model-version"
        )
        == replacement
    )


def test_second_base_claim_cannot_overwrite_existing_head(
    direct_vm,
    direct_deploy,
):
    contract, owner = _deploy(
        direct_vm,
        direct_deploy,
    )

    (
        policy_id,
        _,
        _,
        records,
        evidence_ids,
    ) = _setup_policy_and_evidence(
        direct_vm,
        contract,
    )

    first_claim = _propose(
        direct_vm,
        contract,
        owner,
        policy_id,
        evidence_ids,
        subject="agent.identity",
        text="Agent identity is alpha.",
    )

    _mock_web_records(
        direct_vm,
        records,
    )

    _mock_llm(
        direct_vm,
        True,
        "SUPPORTED",
    )

    contract.review_claim(
        first_claim
    )

    direct_vm.clear_mocks()

    second_claim = _propose(
        direct_vm,
        contract,
        owner,
        policy_id,
        evidence_ids,
        subject="agent.identity",
        text="Agent identity is beta.",
    )

    result = contract.review_claim(
        second_claim
    )

    assert result == (
        "REJECTED|SUBJECT_HEAD_ALREADY_EXISTS|"
    )

    assert (
        contract.get_subject_head(
            "agent.identity"
        )
        == first_claim
    )

    assert (
        contract.get_claim(
            second_claim
        ).state
        == "REJECTED"
    )


def test_review_at_deadline_expires_without_consensus(
    direct_vm,
    direct_deploy,
):
    contract, owner = _deploy(
        direct_vm,
        direct_deploy,
    )

    (
        policy_id,
        _,
        _,
        _,
        evidence_ids,
    ) = _setup_policy_and_evidence(
        direct_vm,
        contract,
    )

    claim_id = _propose(
        direct_vm,
        contract,
        owner,
        policy_id,
        evidence_ids,
    )

    direct_vm.warp(
        "2026-09-17T12:00:00Z"
    )

    result = contract.review_claim(
        claim_id
    )

    assert result == (
        "EXPIRED|REVIEW_WINDOW_EXPIRED|"
    )

    claim = contract.get_claim(
        claim_id
    )

    assert claim.state == "EXPIRED"

    assert (
        contract.get_subject_head(
            claim.subject_id
        )
        == ""
    )



def test_delayed_review_does_not_extend_policy_lifetime(
    direct_vm,
    direct_deploy,
):
    contract, owner = _deploy(
        direct_vm,
        direct_deploy,
    )

    (
        policy_id,
        _,
        _,
        records,
        evidence_ids,
    ) = _setup_policy_and_evidence(
        direct_vm,
        contract,
    )

    claim_id = _propose(
        direct_vm,
        contract,
        owner,
        policy_id,
        evidence_ids,
        subject="agent.delayed-review",
        text="Delayed claim is supported.",
    )

    original = contract.get_claim(
        claim_id
    )

    assert int(original.created_at) == NOW

    direct_vm.warp(
        "2026-09-11T12:00:00Z"
    )

    _mock_web_records(
        direct_vm,
        records,
    )

    _mock_llm(
        direct_vm,
        True,
        "SUPPORTED",
    )

    result = contract.review_claim(
        claim_id
    )

    assert result == "SUPPORTED|SUPPORTED|"

    reviewed = contract.get_claim(
        claim_id
    )

    assert int(reviewed.reviewed_at) == NOW + DAY

    # Critical invariant:
    # reviewing later must not extend the policy-bound lifetime.
    assert (
        int(reviewed.valid_until)
        == NOW + CLAIM_LIFETIME
    )

    assert (
        int(reviewed.valid_until)
        != NOW + DAY + CLAIM_LIFETIME
    )

    assert direct_vm.run_validator() is True


def test_short_policy_lifetime_caps_review_deadline(
    direct_vm,
    direct_deploy,
):
    contract, owner = _deploy(
        direct_vm,
        direct_deploy,
    )

    (
        policy_id,
        _,
        _,
        _,
        evidence_ids,
    ) = _setup_policy_and_evidence(
        direct_vm,
        contract,
        claim_lifetime=HOUR,
    )

    claim_id = _propose(
        direct_vm,
        contract,
        owner,
        policy_id,
        evidence_ids,
        subject="agent.short-lived",
        text="This claim has a one-hour policy lifetime.",
    )

    claim = contract.get_claim(
        claim_id
    )

    assert (
        int(claim.review_deadline)
        == NOW + HOUR
    )

    direct_vm.warp(
        "2026-09-10T13:00:00Z"
    )

    # No web or LLM mock is registered.
    # The deterministic expiry path must run first.
    result = contract.review_claim(
        claim_id
    )

    assert result == (
        "EXPIRED|REVIEW_WINDOW_EXPIRED|"
    )

    expired = contract.get_claim(
        claim_id
    )

    assert expired.state == "EXPIRED"
    assert int(expired.valid_until) == 0

    assert (
        contract.get_subject_head(
            expired.subject_id
        )
        == ""
    )


def test_transient_http_503_does_not_persist_terminal_state(
    direct_vm,
    direct_deploy,
):
    contract, owner = _deploy(
        direct_vm,
        direct_deploy,
    )

    (
        policy_id,
        _,
        _,
        records,
        evidence_ids,
    ) = _setup_policy_and_evidence(
        direct_vm,
        contract,
    )

    claim_id = _propose(
        direct_vm,
        contract,
        owner,
        policy_id,
        evidence_ids,
        subject="agent.transient-http",
        text="Transient HTTP failures must not decide memory.",
    )

    for record in records:
        direct_vm.mock_web(
            re.escape(record["url"]),
            {
                "status": 503,
                "body": "",
            },
        )

    with direct_vm.expect_revert(
        "[TRANSIENT]HTTP_SERVER_ERROR"
    ):
        contract.review_claim(
            claim_id
        )

    claim = contract.get_claim(
        claim_id
    )

    assert claim.state == "REVIEWABLE"
    assert claim.reason_code == ""
    assert claim.repair_evidence_id == ""
    assert int(claim.reviewed_at) == 0
    assert int(claim.valid_until) == 0

    assert (
        contract.get_subject_head(
            claim.subject_id
        )
        == ""
    )


def test_invalid_llm_output_does_not_persist_decision(
    direct_vm,
    direct_deploy,
):
    contract, owner = _deploy(
        direct_vm,
        direct_deploy,
    )

    (
        policy_id,
        _,
        _,
        records,
        evidence_ids,
    ) = _setup_policy_and_evidence(
        direct_vm,
        contract,
    )

    claim_id = _propose(
        direct_vm,
        contract,
        owner,
        policy_id,
        evidence_ids,
        subject="agent.invalid-llm",
        text="Malformed LLM output must not decide memory.",
    )

    _mock_web_records(
        direct_vm,
        records,
    )

    direct_vm.mock_llm(
        r"(?s).*MemorySeal semantic evidence review.*",
        json.dumps(
            {
                "claim_supported": "yes",
                "reason_code": "SUPPORTED",
            }
        ),
    )

    with direct_vm.expect_revert(
        "[LLM_ERROR]INVALID_SUPPORT_FLAG"
    ):
        contract.review_claim(
            claim_id
        )

    claim = contract.get_claim(
        claim_id
    )

    assert claim.state == "REVIEWABLE"
    assert claim.reason_code == ""
    assert claim.repair_evidence_id == ""
    assert int(claim.reviewed_at) == 0
    assert int(claim.valid_until) == 0

    assert (
        contract.get_subject_head(
            claim.subject_id
        )
        == ""
    )



def _create_hash_repair_parent(
    direct_vm,
    contract,
    owner,
):
    (
        policy_id,
        _,
        _,
        records,
        evidence_ids,
    ) = _setup_policy_and_evidence(
        direct_vm,
        contract,
    )

    parent_id = _propose(
        direct_vm,
        contract,
        owner,
        policy_id,
        evidence_ids,
        subject="agent.repairable-fact",
        text="The repairable fact is verified.",
    )

    first = records[0]

    for record in records:
        body = record["body"]

        if (
            record["evidence_id"]
            == first["evidence_id"]
        ):
            body = body + " tampered"

        direct_vm.mock_web(
            re.escape(record["url"]),
            {
                "status": 200,
                "body": body,
            },
        )

    result = contract.review_claim(
        parent_id
    )

    assert result == (
        "REPAIR_REQUIRED|HASH_MISMATCH|"
        + first["evidence_id"]
    )

    direct_vm.clear_mocks()

    return (
        policy_id,
        records,
        evidence_ids,
        parent_id,
        first,
    )


def _register_repair_version(
    direct_vm,
    contract,
    policy_id,
    record,
    version,
    body,
):
    direct_vm.sender = record["issuer"]

    digest = hashlib.sha256(
        body.encode("utf-8")
    ).hexdigest()

    url = (
        record["url"]
        + "/v"
        + str(version)
    )

    evidence_id = contract.register_evidence(
        policy_id,
        record["stable_id"],
        version,
        url,
        record["origin"],
        digest,
        NOW - HOUR,
        NOW + (20 * DAY),
    )

    return {
        "evidence_id": evidence_id,
        "stable_id": record["stable_id"],
        "issuer": record["issuer"],
        "origin": record["origin"],
        "url": url,
        "body": body,
    }


def test_repair_child_is_append_only_and_can_become_canonical(
    direct_vm,
    direct_deploy,
):
    contract, owner = _deploy(
        direct_vm,
        direct_deploy,
    )

    (
        policy_id,
        records,
        _,
        parent_id,
        offending,
    ) = _create_hash_repair_parent(
        direct_vm,
        contract,
        owner,
    )

    parent_before = contract.get_claim(
        parent_id
    )

    original_source_set = (
        parent_before.source_set_digest
    )

    original_claim_hash = (
        parent_before.claim_hash
    )

    original_repair_evidence = (
        parent_before.repair_evidence_id
    )

    repaired_body = (
        "Corrected authoritative evidence now "
        "matches its registered digest."
    )

    replacement = _register_repair_version(
        direct_vm,
        contract,
        policy_id,
        offending,
        2,
        repaired_body,
    )

    other = next(
        record
        for record in records
        if record["evidence_id"]
        != offending["evidence_id"]
    )

    child_evidence_ids = sorted(
        [
            replacement["evidence_id"],
            other["evidence_id"],
        ]
    )

    direct_vm.sender = owner

    child_id = contract.propose_repair_claim(
        parent_id,
        child_evidence_ids,
    )

    child = contract.get_claim(
        child_id
    )

    assert child_id != parent_id
    assert child.repairs_claim_id == parent_id

    assert (
        child.subject_id
        == parent_before.subject_id
    )

    assert (
        child.claim_text
        == parent_before.claim_text
    )

    assert (
        child.claim_hash
        == parent_before.claim_hash
    )

    assert (
        child.policy_id
        == parent_before.policy_id
    )

    assert (
        child.policy_fingerprint
        == parent_before.policy_fingerprint
    )

    assert (
        child.supersedes_claim_id
        == parent_before.supersedes_claim_id
    )

    assert (
        child.source_set_digest
        != original_source_set
    )

    parent_after_child = contract.get_claim(
        parent_id
    )

    assert (
        parent_after_child.source_set_digest
        == original_source_set
    )

    assert (
        parent_after_child.claim_hash
        == original_claim_hash
    )

    assert (
        parent_after_child.repair_evidence_id
        == original_repair_evidence
    )

    assert (
        parent_after_child.state
        == "REPAIR_REQUIRED"
    )

    direct_vm.mock_web(
        re.escape(replacement["url"]),
        {
            "status": 200,
            "body": replacement["body"],
        },
    )

    direct_vm.mock_web(
        re.escape(other["url"]),
        {
            "status": 200,
            "body": other["body"],
        },
    )

    _mock_llm(
        direct_vm,
        True,
        "SUPPORTED",
    )

    result = contract.review_claim(
        child_id
    )

    assert result == "SUPPORTED|SUPPORTED|"

    supported_child = contract.get_claim(
        child_id
    )

    assert supported_child.state == "SUPPORTED"

    assert (
        contract.get_subject_head(
            supported_child.subject_id
        )
        == child_id
    )

    final_parent = contract.get_claim(
        parent_id
    )

    assert (
        final_parent.state
        == "REPAIR_REQUIRED"
    )

    assert (
        final_parent.source_set_digest
        == original_source_set
    )

    assert direct_vm.run_validator() is True


def test_only_original_proposer_can_create_repair_child(
    direct_vm,
    direct_deploy,
):
    contract, owner = _deploy(
        direct_vm,
        direct_deploy,
    )

    (
        _,
        _,
        evidence_ids,
        parent_id,
        _,
    ) = _create_hash_repair_parent(
        direct_vm,
        contract,
        owner,
    )

    outsider = create_address(
        "memoryseal-repair-outsider"
    )

    direct_vm.sender = outsider

    with direct_vm.expect_revert(
        "ONLY_CLAIM_PROPOSER"
    ):
        contract.propose_repair_claim(
            parent_id,
            evidence_ids,
        )


def test_repair_must_advance_exact_offending_lineage(
    direct_vm,
    direct_deploy,
):
    contract, owner = _deploy(
        direct_vm,
        direct_deploy,
    )

    (
        policy_id,
        records,
        evidence_ids,
        parent_id,
        offending,
    ) = _create_hash_repair_parent(
        direct_vm,
        contract,
        owner,
    )

    direct_vm.sender = owner

    with direct_vm.expect_revert(
        "REPAIR_LINEAGE_NOT_ADVANCED"
    ):
        contract.propose_repair_claim(
            parent_id,
            evidence_ids,
        )

    other = next(
        record
        for record in records
        if record["evidence_id"]
        != offending["evidence_id"]
    )

    unrelated_v2 = _register_repair_version(
        direct_vm,
        contract,
        policy_id,
        other,
        2,
        "Updated unrelated evidence.",
    )

    wrong_repair_set = sorted(
        [
            offending["evidence_id"],
            unrelated_v2["evidence_id"],
        ]
    )

    direct_vm.sender = owner

    with direct_vm.expect_revert(
        "REPAIR_LINEAGE_NOT_ADVANCED"
    ):
        contract.propose_repair_claim(
            parent_id,
            wrong_repair_set,
        )


def test_only_repair_required_claim_can_be_repaired(
    direct_vm,
    direct_deploy,
):
    contract, owner = _deploy(
        direct_vm,
        direct_deploy,
    )

    (
        policy_id,
        _,
        _,
        _,
        evidence_ids,
    ) = _setup_policy_and_evidence(
        direct_vm,
        contract,
    )

    reviewable = _propose(
        direct_vm,
        contract,
        owner,
        policy_id,
        evidence_ids,
        subject="agent.not-yet-repairable",
        text="This proposal is still reviewable.",
    )

    direct_vm.sender = owner

    with direct_vm.expect_revert(
        "CLAIM_NOT_REPAIR_REQUIRED"
    ):
        contract.propose_repair_claim(
            reviewable,
            evidence_ids,
        )


def test_repair_window_is_bounded_by_parent_deadline(
    direct_vm,
    direct_deploy,
):
    contract, owner = _deploy(
        direct_vm,
        direct_deploy,
    )

    (
        policy_id,
        records,
        _,
        parent_id,
        offending,
    ) = _create_hash_repair_parent(
        direct_vm,
        contract,
        owner,
    )

    replacement = _register_repair_version(
        direct_vm,
        contract,
        policy_id,
        offending,
        2,
        "Corrected evidence after the parent failure.",
    )

    other = next(
        record
        for record in records
        if record["evidence_id"]
        != offending["evidence_id"]
    )

    repair_set = sorted(
        [
            replacement["evidence_id"],
            other["evidence_id"],
        ]
    )

    parent = contract.get_claim(
        parent_id
    )

    assert (
        int(parent.review_deadline)
        == NOW + (7 * DAY)
    )

    direct_vm.warp(
        "2026-09-17T12:00:00Z"
    )

    direct_vm.sender = owner

    with direct_vm.expect_revert(
        "REPAIR_WINDOW_EXPIRED"
    ):
        contract.propose_repair_claim(
            parent_id,
            repair_set,
        )


def test_repair_child_preserves_supersession_target(
    direct_vm,
    direct_deploy,
):
    contract, owner = _deploy(
        direct_vm,
        direct_deploy,
    )

    (
        policy_id,
        _,
        _,
        records,
        evidence_ids,
    ) = _setup_policy_and_evidence(
        direct_vm,
        contract,
    )

    base_claim = _propose(
        direct_vm,
        contract,
        owner,
        policy_id,
        evidence_ids,
        subject="agent.repair-supersession",
        text="Model version is 1.",
    )

    _mock_web_records(
        direct_vm,
        records,
    )

    _mock_llm(
        direct_vm,
        True,
        "SUPPORTED",
    )

    contract.review_claim(
        base_claim
    )

    direct_vm.clear_mocks()

    parent = _propose(
        direct_vm,
        contract,
        owner,
        policy_id,
        evidence_ids,
        subject="agent.repair-supersession",
        text="Model version is 2.",
        supersedes=base_claim,
    )

    offending = records[0]

    for record in records:
        body = record["body"]

        if (
            record["evidence_id"]
            == offending["evidence_id"]
        ):
            body = body + " tampered"

        direct_vm.mock_web(
            re.escape(record["url"]),
            {
                "status": 200,
                "body": body,
            },
        )

    result = contract.review_claim(
        parent
    )

    assert result == (
        "REPAIR_REQUIRED|HASH_MISMATCH|"
        + offending["evidence_id"]
    )

    direct_vm.clear_mocks()

    replacement = _register_repair_version(
        direct_vm,
        contract,
        policy_id,
        offending,
        2,
        "Corrected evidence supports model version 2.",
    )

    other = next(
        record
        for record in records
        if record["evidence_id"]
        != offending["evidence_id"]
    )

    repaired_set = sorted(
        [
            replacement["evidence_id"],
            other["evidence_id"],
        ]
    )

    direct_vm.sender = owner

    child = contract.propose_repair_claim(
        parent,
        repaired_set,
    )

    child_record = contract.get_claim(
        child
    )

    assert child_record.repairs_claim_id == parent

    assert (
        child_record.supersedes_claim_id
        == base_claim
    )

    direct_vm.mock_web(
        re.escape(replacement["url"]),
        {
            "status": 200,
            "body": replacement["body"],
        },
    )

    direct_vm.mock_web(
        re.escape(other["url"]),
        {
            "status": 200,
            "body": other["body"],
        },
    )

    _mock_llm(
        direct_vm,
        True,
        "SUPPORTED",
    )

    result = contract.review_claim(
        child
    )

    assert result == "SUPPORTED|SUPPORTED|"

    old_head = contract.get_claim(
        base_claim
    )

    repaired_child = contract.get_claim(
        child
    )

    assert old_head.state == "SUPERSEDED"
    assert repaired_child.state == "SUPPORTED"

    assert (
        contract.get_subject_head(
            "agent.repair-supersession"
        )
        == child
    )

    failed_parent = contract.get_claim(
        parent
    )

    assert (
        failed_parent.state
        == "REPAIR_REQUIRED"
    )

    assert direct_vm.run_validator() is True



def test_repair_child_cannot_replace_unrelated_evidence(
    direct_vm,
    direct_deploy,
):
    contract, owner = _deploy(
        direct_vm,
        direct_deploy,
    )

    (
        policy_id,
        records,
        _,
        parent_id,
        offending,
    ) = _create_hash_repair_parent(
        direct_vm,
        contract,
        owner,
    )

    replacement = _register_repair_version(
        direct_vm,
        contract,
        policy_id,
        offending,
        2,
        "Corrected exact offending evidence.",
    )

    other = next(
        record
        for record in records
        if record["evidence_id"]
        != offending["evidence_id"]
    )

    unrelated_body = (
        "Entirely different approved evidence."
    )

    unrelated_digest = hashlib.sha256(
        unrelated_body.encode("utf-8")
    ).hexdigest()

    direct_vm.sender = other["issuer"]

    unrelated_id = contract.register_evidence(
        policy_id,
        "unrelated-record",
        1,
        other["origin"]
        + "/records/unrelated-record",
        other["origin"],
        unrelated_digest,
        NOW - HOUR,
        NOW + (20 * DAY),
    )

    repair_set = sorted(
        [
            replacement["evidence_id"],
            unrelated_id,
        ]
    )

    direct_vm.sender = owner

    with direct_vm.expect_revert(
        "REPAIR_SET_CHANGED_UNRELATED_EVIDENCE"
    ):
        contract.propose_repair_claim(
            parent_id,
            repair_set,
        )

    parent = contract.get_claim(
        parent_id
    )

    assert (
        parent.repair_child_claim_id
        == ""
    )


def test_repair_child_inherits_parent_review_deadline_cap(
    direct_vm,
    direct_deploy,
):
    contract, owner = _deploy(
        direct_vm,
        direct_deploy,
    )

    (
        policy_id,
        records,
        _,
        parent_id,
        offending,
    ) = _create_hash_repair_parent(
        direct_vm,
        contract,
        owner,
    )

    parent = contract.get_claim(
        parent_id
    )

    assert (
        int(parent.review_deadline)
        == NOW + (7 * DAY)
    )

    direct_vm.warp(
        "2026-09-16T12:00:00Z"
    )

    replacement = _register_repair_version(
        direct_vm,
        contract,
        policy_id,
        offending,
        2,
        "Corrected evidence near repair deadline.",
    )

    other = next(
        record
        for record in records
        if record["evidence_id"]
        != offending["evidence_id"]
    )

    repair_set = sorted(
        [
            replacement["evidence_id"],
            other["evidence_id"],
        ]
    )

    direct_vm.sender = owner

    child_id = contract.propose_repair_claim(
        parent_id,
        repair_set,
    )

    child = contract.get_claim(
        child_id
    )

    assert (
        int(child.review_deadline)
        == int(parent.review_deadline)
    )

    direct_vm.warp(
        "2026-09-17T12:00:00Z"
    )

    result = contract.review_claim(
        child_id
    )

    assert result == (
        "EXPIRED|REVIEW_WINDOW_EXPIRED|"
    )

    expired_child = contract.get_claim(
        child_id
    )

    assert expired_child.state == "EXPIRED"


def test_failed_parent_audit_state_cannot_be_overwritten_after_repair_child(
    direct_vm,
    direct_deploy,
):
    contract, owner = _deploy(
        direct_vm,
        direct_deploy,
    )

    (
        policy_id,
        records,
        _,
        parent_id,
        offending,
    ) = _create_hash_repair_parent(
        direct_vm,
        contract,
        owner,
    )

    parent_before = contract.get_claim(
        parent_id
    )

    original_reason = (
        parent_before.reason_code
    )

    original_repair_evidence = (
        parent_before.repair_evidence_id
    )

    replacement = _register_repair_version(
        direct_vm,
        contract,
        policy_id,
        offending,
        2,
        "Corrected evidence for immutable parent audit.",
    )

    other = next(
        record
        for record in records
        if record["evidence_id"]
        != offending["evidence_id"]
    )

    repair_set = sorted(
        [
            replacement["evidence_id"],
            other["evidence_id"],
        ]
    )

    direct_vm.sender = owner

    child_id = contract.propose_repair_claim(
        parent_id,
        repair_set,
    )

    parent = contract.get_claim(
        parent_id
    )

    assert (
        parent.repair_child_claim_id
        == child_id
    )

    with direct_vm.expect_revert(
        "REPAIR_CHILD_ALREADY_EXISTS"
    ):
        contract.cancel_claim(
            parent_id
        )

    direct_vm.warp(
        "2026-09-17T12:00:00Z"
    )

    outsider = create_address(
        "memoryseal-parent-expiry-outsider"
    )

    direct_vm.sender = outsider

    with direct_vm.expect_revert(
        "REPAIR_CHILD_ALREADY_EXISTS"
    ):
        contract.expire_claim(
            parent_id
        )

    final_parent = contract.get_claim(
        parent_id
    )

    assert (
        final_parent.state
        == "REPAIR_REQUIRED"
    )

    assert (
        final_parent.reason_code
        == original_reason
    )

    assert (
        final_parent.repair_evidence_id
        == original_repair_evidence
    )

    assert (
        final_parent.repair_child_claim_id
        == child_id
    )


def test_only_one_repair_child_can_be_created_per_parent(
    direct_vm,
    direct_deploy,
):
    contract, owner = _deploy(
        direct_vm,
        direct_deploy,
    )

    (
        policy_id,
        records,
        _,
        parent_id,
        offending,
    ) = _create_hash_repair_parent(
        direct_vm,
        contract,
        owner,
    )

    replacement = _register_repair_version(
        direct_vm,
        contract,
        policy_id,
        offending,
        2,
        "Corrected evidence for one repair child.",
    )

    other = next(
        record
        for record in records
        if record["evidence_id"]
        != offending["evidence_id"]
    )

    repair_set = sorted(
        [
            replacement["evidence_id"],
            other["evidence_id"],
        ]
    )

    direct_vm.sender = owner

    first_child = contract.propose_repair_claim(
        parent_id,
        repair_set,
    )

    assert first_child != ""

    with direct_vm.expect_revert(
        "REPAIR_CHILD_ALREADY_EXISTS"
    ):
        contract.propose_repair_claim(
            parent_id,
            repair_set,
        )

    parent = contract.get_claim(
        parent_id
    )

    assert (
        parent.repair_child_claim_id
        == first_child
    )



def test_nonoffending_lineage_can_advance_without_repair_deadlock(
    direct_vm,
    direct_deploy,
):
    contract, owner = _deploy(
        direct_vm,
        direct_deploy,
    )

    (
        policy_id,
        records,
        _,
        parent_id,
        offending,
    ) = _create_hash_repair_parent(
        direct_vm,
        contract,
        owner,
    )

    offending_v2 = _register_repair_version(
        direct_vm,
        contract,
        policy_id,
        offending,
        2,
        "Corrected offending evidence.",
    )

    other = next(
        record
        for record in records
        if record["evidence_id"]
        != offending["evidence_id"]
    )

    other_v2 = _register_repair_version(
        direct_vm,
        contract,
        policy_id,
        other,
        2,
        "Updated evidence from the same unaffected lineage.",
    )

    repair_set = sorted(
        [
            offending_v2["evidence_id"],
            other_v2["evidence_id"],
        ]
    )

    direct_vm.sender = owner

    child_id = contract.propose_repair_claim(
        parent_id,
        repair_set,
    )

    child = contract.get_claim(
        child_id
    )

    assert child.repairs_claim_id == parent_id
    assert int(child.evidence_count) == 2

    child_bound_ids = sorted(
        [
            contract.get_claim_evidence_id(
                child_id,
                0,
            ),
            contract.get_claim_evidence_id(
                child_id,
                1,
            ),
        ]
    )

    assert child_bound_ids == repair_set

    direct_vm.mock_web(
        re.escape(offending_v2["url"]),
        {
            "status": 200,
            "body": offending_v2["body"],
        },
    )

    direct_vm.mock_web(
        re.escape(other_v2["url"]),
        {
            "status": 200,
            "body": other_v2["body"],
        },
    )

    _mock_llm(
        direct_vm,
        True,
        "SUPPORTED",
    )

    result = contract.review_claim(
        child_id
    )

    assert result == "SUPPORTED|SUPPORTED|"

    supported = contract.get_claim(
        child_id
    )

    assert supported.state == "SUPPORTED"

    assert (
        contract.get_subject_head(
            supported.subject_id
        )
        == child_id
    )

    parent = contract.get_claim(
        parent_id
    )

    assert parent.state == "REPAIR_REQUIRED"

    assert (
        parent.repair_child_claim_id
        == child_id
    )

    assert direct_vm.run_validator() is True



def _support_expiry_head(
    direct_vm,
    contract,
    owner,
):
    (
        policy_id,
        _,
        _,
        records,
        evidence_ids,
    ) = _setup_policy_and_evidence(
        direct_vm,
        contract,
    )

    claim_id = _propose(
        direct_vm,
        contract,
        owner,
        policy_id,
        evidence_ids,
        subject="agent.expiry-aware",
        text="Expiry-aware canonical memory is verified.",
    )

    _mock_web_records(
        direct_vm,
        records,
    )

    _mock_llm(
        direct_vm,
        True,
        "SUPPORTED",
    )

    result = contract.review_claim(
        claim_id
    )

    assert result == "SUPPORTED|SUPPORTED|"

    direct_vm.clear_mocks()

    return (
        policy_id,
        records,
        evidence_ids,
        claim_id,
    )


def test_effective_head_expires_exactly_at_valid_until_without_erasing_history(
    direct_vm,
    direct_deploy,
):
    contract, owner = _deploy(
        direct_vm,
        direct_deploy,
    )

    (
        _,
        _,
        _,
        claim_id,
    ) = _support_expiry_head(
        direct_vm,
        contract,
        owner,
    )

    claim = contract.get_claim(
        claim_id
    )

    assert (
        int(claim.valid_until)
        == NOW + CLAIM_LIFETIME
    )

    assert (
        contract.get_subject_head(
            "agent.expiry-aware"
        )
        == claim_id
    )

    assert (
        contract.get_recorded_subject_head(
            "agent.expiry-aware"
        )
        == claim_id
    )

    direct_vm.warp(
        "2026-09-24T11:59:59Z"
    )

    assert (
        contract.get_subject_head(
            "agent.expiry-aware"
        )
        == claim_id
    )

    direct_vm.warp(
        "2026-09-24T12:00:00Z"
    )

    assert (
        contract.get_subject_head(
            "agent.expiry-aware"
        )
        == ""
    )

    # Historical pointer remains inspectable.
    assert (
        contract.get_recorded_subject_head(
            "agent.expiry-aware"
        )
        == claim_id
    )

    historical = contract.get_claim(
        claim_id
    )

    assert historical.state == "SUPPORTED"

    assert (
        int(historical.valid_until)
        == NOW + CLAIM_LIFETIME
    )


def test_rejected_fresh_claim_cannot_replace_expired_head(
    direct_vm,
    direct_deploy,
):
    contract, owner = _deploy(
        direct_vm,
        direct_deploy,
    )

    (
        policy_id,
        records,
        evidence_ids,
        old_claim_id,
    ) = _support_expiry_head(
        direct_vm,
        contract,
        owner,
    )

    direct_vm.warp(
        "2026-09-24T12:00:00Z"
    )

    assert (
        contract.get_subject_head(
            "agent.expiry-aware"
        )
        == ""
    )

    new_claim_id = _propose(
        direct_vm,
        contract,
        owner,
        policy_id,
        evidence_ids,
        subject="agent.expiry-aware",
        text="A replacement fact is proposed.",
    )

    _mock_web_records(
        direct_vm,
        records,
    )

    _mock_llm(
        direct_vm,
        False,
        "CONTRADICTED",
    )

    result = contract.review_claim(
        new_claim_id
    )

    assert (
        result
        == "REJECTED|CONTRADICTED|"
    )

    assert (
        contract.get_subject_head(
            "agent.expiry-aware"
        )
        == ""
    )

    assert (
        contract.get_recorded_subject_head(
            "agent.expiry-aware"
        )
        == old_claim_id
    )

    assert (
        contract.get_claim(
            new_claim_id
        ).state
        == "REJECTED"
    )

    assert (
        contract.get_claim(
            old_claim_id
        ).state
        == "SUPPORTED"
    )

    assert direct_vm.run_validator() is True


def test_supported_fresh_claim_can_replace_expired_head(
    direct_vm,
    direct_deploy,
):
    contract, owner = _deploy(
        direct_vm,
        direct_deploy,
    )

    (
        policy_id,
        records,
        evidence_ids,
        old_claim_id,
    ) = _support_expiry_head(
        direct_vm,
        contract,
        owner,
    )

    direct_vm.warp(
        "2026-09-24T12:00:00Z"
    )

    assert (
        contract.get_subject_head(
            "agent.expiry-aware"
        )
        == ""
    )

    new_claim_id = _propose(
        direct_vm,
        contract,
        owner,
        policy_id,
        evidence_ids,
        subject="agent.expiry-aware",
        text="Fresh review renews the canonical fact.",
    )

    _mock_web_records(
        direct_vm,
        records,
    )

    _mock_llm(
        direct_vm,
        True,
        "SUPPORTED",
    )

    result = contract.review_claim(
        new_claim_id
    )

    assert result == "SUPPORTED|SUPPORTED|"

    new_claim = contract.get_claim(
        new_claim_id
    )

    assert new_claim.state == "SUPPORTED"

    # Evidence expires at NOW + 20 days, earlier than
    # the renewed claim's policy-lifetime endpoint.
    assert (
        int(new_claim.valid_until)
        == NOW + (20 * DAY)
    )

    assert (
        contract.get_subject_head(
            "agent.expiry-aware"
        )
        == new_claim_id
    )

    assert (
        contract.get_recorded_subject_head(
            "agent.expiry-aware"
        )
        == new_claim_id
    )

    old_claim = contract.get_claim(
        old_claim_id
    )

    assert old_claim.state == "SUPPORTED"

    assert (
        int(old_claim.valid_until)
        == NOW + CLAIM_LIFETIME
    )

    assert direct_vm.run_validator() is True


def test_expired_head_cannot_be_used_as_supersession_target(
    direct_vm,
    direct_deploy,
):
    contract, owner = _deploy(
        direct_vm,
        direct_deploy,
    )

    (
        policy_id,
        _,
        evidence_ids,
        old_claim_id,
    ) = _support_expiry_head(
        direct_vm,
        contract,
        owner,
    )

    direct_vm.warp(
        "2026-09-24T12:00:00Z"
    )

    assert (
        contract.get_subject_head(
            "agent.expiry-aware"
        )
        == ""
    )

    assert (
        contract.get_recorded_subject_head(
            "agent.expiry-aware"
        )
        == old_claim_id
    )

    direct_vm.sender = owner

    with direct_vm.expect_revert(
        "SUPERSESSION_TARGET_NOT_CURRENT_HEAD"
    ):
        contract.propose_claim(
            "agent.expiry-aware",
            "Expired memory must not be superseded as current.",
            policy_id,
            evidence_ids,
            old_claim_id,
        )

    assert int(contract.get_claim_count()) == 1



def test_canonical_history_is_append_only_across_expiry_renewal(
    direct_vm,
    direct_deploy,
):
    contract, owner = _deploy(
        direct_vm,
        direct_deploy,
    )

    (
        policy_id,
        records,
        evidence_ids,
        old_claim_id,
    ) = _support_expiry_head(
        direct_vm,
        contract,
        owner,
    )

    subject = "agent.expiry-aware"

    assert (
        int(
            contract.get_subject_history_count(
                subject
            )
        )
        == 1
    )

    assert (
        contract.get_subject_history_claim_id(
            subject,
            0,
        )
        == old_claim_id
    )

    direct_vm.warp(
        "2026-09-24T12:00:00Z"
    )

    assert (
        contract.get_subject_head(
            subject
        )
        == ""
    )

    new_claim_id = _propose(
        direct_vm,
        contract,
        owner,
        policy_id,
        evidence_ids,
        subject=subject,
        text="Fresh canonical memory replaces the expired entry.",
    )

    _mock_web_records(
        direct_vm,
        records,
    )

    _mock_llm(
        direct_vm,
        True,
        "SUPPORTED",
    )

    result = contract.review_claim(
        new_claim_id
    )

    assert result == "SUPPORTED|SUPPORTED|"

    assert (
        int(
            contract.get_subject_history_count(
                subject
            )
        )
        == 2
    )

    assert (
        contract.get_subject_history_claim_id(
            subject,
            0,
        )
        == old_claim_id
    )

    assert (
        contract.get_subject_history_claim_id(
            subject,
            1,
        )
        == new_claim_id
    )

    assert (
        contract.get_subject_head(
            subject
        )
        == new_claim_id
    )

    old_claim = contract.get_claim(
        old_claim_id
    )

    assert old_claim.state == "SUPPORTED"

    assert direct_vm.run_validator() is True


def test_rejected_claim_never_enters_canonical_history(
    direct_vm,
    direct_deploy,
):
    contract, owner = _deploy(
        direct_vm,
        direct_deploy,
    )

    (
        policy_id,
        _,
        _,
        records,
        evidence_ids,
    ) = _setup_policy_and_evidence(
        direct_vm,
        contract,
    )

    subject = "agent.rejected-history"

    claim_id = _propose(
        direct_vm,
        contract,
        owner,
        policy_id,
        evidence_ids,
        subject=subject,
        text="This rejected proposal must never enter history.",
    )

    _mock_web_records(
        direct_vm,
        records,
    )

    _mock_llm(
        direct_vm,
        False,
        "CONTRADICTED",
    )

    result = contract.review_claim(
        claim_id
    )

    assert (
        result
        == "REJECTED|CONTRADICTED|"
    )

    assert (
        int(
            contract.get_subject_history_count(
                subject
            )
        )
        == 0
    )

    assert contract.get_subject_head(
        subject
    ) == ""

    assert (
        contract.get_recorded_subject_head(
            subject
        )
        == ""
    )

    assert direct_vm.run_validator() is True


def test_supersession_appends_canonical_history(
    direct_vm,
    direct_deploy,
):
    contract, owner = _deploy(
        direct_vm,
        direct_deploy,
    )

    (
        policy_id,
        _,
        _,
        records,
        evidence_ids,
    ) = _setup_policy_and_evidence(
        direct_vm,
        contract,
    )

    subject = "agent.history-supersession"

    first = _propose(
        direct_vm,
        contract,
        owner,
        policy_id,
        evidence_ids,
        subject=subject,
        text="Canonical version is one.",
    )

    _mock_web_records(
        direct_vm,
        records,
    )

    _mock_llm(
        direct_vm,
        True,
        "SUPPORTED",
    )

    contract.review_claim(
        first
    )

    direct_vm.clear_mocks()

    second = _propose(
        direct_vm,
        contract,
        owner,
        policy_id,
        evidence_ids,
        subject=subject,
        text="Canonical version is two.",
        supersedes=first,
    )

    _mock_web_records(
        direct_vm,
        records,
    )

    _mock_llm(
        direct_vm,
        True,
        "SUPPORTED",
    )

    result = contract.review_claim(
        second
    )

    assert result == "SUPPORTED|SUPPORTED|"

    assert (
        int(
            contract.get_subject_history_count(
                subject
            )
        )
        == 2
    )

    assert (
        contract.get_subject_history_claim_id(
            subject,
            0,
        )
        == first
    )

    assert (
        contract.get_subject_history_claim_id(
            subject,
            1,
        )
        == second
    )

    old_claim = contract.get_claim(
        first
    )

    assert old_claim.state == "SUPERSEDED"

    assert (
        contract.get_subject_head(
            subject
        )
        == second
    )

    assert direct_vm.run_validator() is True


def test_repair_child_history_excludes_failed_parent(
    direct_vm,
    direct_deploy,
):
    contract, owner = _deploy(
        direct_vm,
        direct_deploy,
    )

    (
        policy_id,
        records,
        _,
        parent_id,
        offending,
    ) = _create_hash_repair_parent(
        direct_vm,
        contract,
        owner,
    )

    parent = contract.get_claim(
        parent_id
    )

    subject = parent.subject_id

    assert (
        int(
            contract.get_subject_history_count(
                subject
            )
        )
        == 0
    )

    replacement = _register_repair_version(
        direct_vm,
        contract,
        policy_id,
        offending,
        2,
        "Corrected evidence for canonical history.",
    )

    other = next(
        record
        for record in records
        if record["evidence_id"]
        != offending["evidence_id"]
    )

    repair_set = sorted(
        [
            replacement["evidence_id"],
            other["evidence_id"],
        ]
    )

    direct_vm.sender = owner

    child_id = contract.propose_repair_claim(
        parent_id,
        repair_set,
    )

    direct_vm.mock_web(
        re.escape(replacement["url"]),
        {
            "status": 200,
            "body": replacement["body"],
        },
    )

    direct_vm.mock_web(
        re.escape(other["url"]),
        {
            "status": 200,
            "body": other["body"],
        },
    )

    _mock_llm(
        direct_vm,
        True,
        "SUPPORTED",
    )

    result = contract.review_claim(
        child_id
    )

    assert result == "SUPPORTED|SUPPORTED|"

    assert (
        int(
            contract.get_subject_history_count(
                subject
            )
        )
        == 1
    )

    assert (
        contract.get_subject_history_claim_id(
            subject,
            0,
        )
        == child_id
    )

    failed_parent = contract.get_claim(
        parent_id
    )

    assert (
        failed_parent.state
        == "REPAIR_REQUIRED"
    )

    assert (
        failed_parent.repair_child_claim_id
        == child_id
    )

    assert direct_vm.run_validator() is True


def test_subject_history_bounds_fail_closed(
    direct_vm,
    direct_deploy,
):
    contract, owner = _deploy(
        direct_vm,
        direct_deploy,
    )

    subject = "agent.history-bounds"

    assert (
        int(
            contract.get_subject_history_count(
                subject
            )
        )
        == 0
    )

    with direct_vm.expect_revert(
        "SUBJECT_HISTORY_INDEX_OUT_OF_RANGE"
    ):
        contract.get_subject_history_claim_id(
            subject,
            0,
        )

    (
        policy_id,
        _,
        _,
        records,
        evidence_ids,
    ) = _setup_policy_and_evidence(
        direct_vm,
        contract,
    )

    claim_id = _propose(
        direct_vm,
        contract,
        owner,
        policy_id,
        evidence_ids,
        subject=subject,
        text="One canonical history entry exists.",
    )

    _mock_web_records(
        direct_vm,
        records,
    )

    _mock_llm(
        direct_vm,
        True,
        "SUPPORTED",
    )

    contract.review_claim(
        claim_id
    )

    assert (
        int(
            contract.get_subject_history_count(
                subject
            )
        )
        == 1
    )

    assert (
        contract.get_subject_history_claim_id(
            subject,
            0,
        )
        == claim_id
    )

    with direct_vm.expect_revert(
        "SUBJECT_HISTORY_INDEX_OUT_OF_RANGE"
    ):
        contract.get_subject_history_claim_id(
            subject,
            1,
        )
