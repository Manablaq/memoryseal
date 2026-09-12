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
        "contracts/memoryseal_candidate.py"
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
