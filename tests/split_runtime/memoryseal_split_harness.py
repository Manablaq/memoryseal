from __future__ import annotations

import datetime as _datetime_module
from dataclasses import dataclass
from pathlib import Path

MAIN_PATH = str(Path(__file__).resolve().parents[2] / "contracts" / "memoryseal_claim_consensus.py")
REGISTRY_ADDRESS = '0xd5f0B44394810bBaEBd7cfd5D44b3B568895bd8B'
SDK_VERSION = 'v0.3.0-rc7'
EXPECTED_MAIN_SHA256 = '4aa0a9c1a5da486aa3c4730424212def4a95d500d9b55242000e07d8f8df892c'
EXPECTED_REGISTRY_SHA256 = 'ac7a08ac5a57636a8b8fcb100a1e1b1d37ee2a8841bee304c828472b064de90b'
EXPECTED_RUNNER_HASH = '1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6'

_CANONICAL_HELPER_SOURCE = 'def _keccak_text(a:str)->str:return Keccak256(a.encode(\'utf-8\')).hexdigest()\n\ndef _pair_key(a:str,b:str)->str:return f"{len(a)}:{a}{len(b)}:{b}"\n\ndef _derive_policy_id(b:str,c:str,d:u64)->str:a=\'\\x00\'.join((\'memoryseal-policy-id-v1\',b,c,str(int(d))));return _keccak_text(a)\n\ndef _derive_evidence_id(b:str,c:str,d:u64)->str:a=\'\\x00\'.join((\'memoryseal-evidence-id-v1\',b,c,str(int(d))));return _keccak_text(a)\n'
_HELPERS = None


def _ensure_helpers():
    global _HELPERS
    if _HELPERS is None:
        namespace = {}
        source = (
            "import hashlib\n"
            "import json\n"
            "from genlayer import *\n\n"
            + _CANONICAL_HELPER_SOURCE
        )
        exec(source, namespace, namespace)
        _HELPERS = namespace
    return _HELPERS


def _h(name):
    return _ensure_helpers()[name]


def _address_hex(value):
    attr = getattr(value, "as_hex", None)
    if attr is not None:
        if callable(attr):
            attr = attr()
        return str(attr)
    if isinstance(value, (bytes, bytearray)):
        return "0x" + bytes(value).hex()
    text = str(value)
    if text.startswith("0x") and len(text) == 42:
        return text
    raise TypeError("cannot normalize address: " + repr(value))


@dataclass
class _PolicyState:
    owner_hex: str
    slug: str
    version: int
    sealed: bool
    min_evidence_records: int
    min_distinct_issuers: int
    min_distinct_origins: int
    max_evidence_age_seconds: int
    min_remaining_validity_seconds: int
    max_claim_lifetime_seconds: int
    max_evidence_records: int
    max_content_bytes: int
    issuer_count: int
    origin_count: int
    base_commitment: str
    issuer_commitment: str
    origin_commitment: str
    fingerprint: str


@dataclass
class _EvidenceState:
    policy_id: str
    stable_record_id: str
    version: int
    issuer_hex: str
    source_url: str
    publisher_origin: str
    sha256_digest: str
    issued_at: int
    expires_at: int


class CanonicalRegistryWireModel:
    # Main-side setup/wire model only. Registry validation semantics remain
    # covered by the real canonical Registry Direct Mode behavior suite.
    def __init__(self, vm, deployment_owner):
        self.vm = vm
        self.deployment_owner = deployment_owner
        self.policies = {}
        self.latest_versions = {}
        self.evidence = {}

    def get_owner(self):
        return self.deployment_owner

    def create_policy(
        self,
        slug,
        version,
        min_evidence_records,
        min_distinct_issuers,
        min_distinct_origins,
        max_evidence_age_seconds,
        min_remaining_validity_seconds,
        max_claim_lifetime_seconds,
        max_evidence_records,
        max_content_bytes,
    ):
        owner_hex = _address_hex(self.vm.sender)
        version_i = int(version)
        min_records = int(min_evidence_records)
        min_issuers = int(min_distinct_issuers)
        min_origins = int(min_distinct_origins)
        max_age = int(max_evidence_age_seconds)
        min_validity = int(min_remaining_validity_seconds)
        claim_lifetime = int(max_claim_lifetime_seconds)
        max_records = int(max_evidence_records)
        content_bytes = int(max_content_bytes)

        policy_id = _h("_derive_policy_id")(
            owner_hex,
            str(slug),
            version_i,
        )

        base_material = "\x00".join((
            "memoryseal-policy-base-v1",
            policy_id,
            owner_hex,
            str(slug),
            str(version_i),
            str(min_records),
            str(min_issuers),
            str(min_origins),
            str(max_age),
            str(min_validity),
            str(claim_lifetime),
            str(max_records),
            str(content_bytes),
        ))

        keccak = _h("_keccak_text")
        base_commitment = keccak(base_material)
        issuer_commitment = keccak(
            "memoryseal-policy-issuers-v1"
            + "\x00"
            + policy_id
        )
        origin_commitment = keccak(
            "memoryseal-policy-origins-v1"
            + "\x00"
            + policy_id
        )

        self.policies[policy_id] = _PolicyState(
            owner_hex=owner_hex,
            slug=str(slug),
            version=version_i,
            sealed=False,
            min_evidence_records=min_records,
            min_distinct_issuers=min_issuers,
            min_distinct_origins=min_origins,
            max_evidence_age_seconds=max_age,
            min_remaining_validity_seconds=min_validity,
            max_claim_lifetime_seconds=claim_lifetime,
            max_evidence_records=max_records,
            max_content_bytes=content_bytes,
            issuer_count=0,
            origin_count=0,
            base_commitment=base_commitment,
            issuer_commitment=issuer_commitment,
            origin_commitment=origin_commitment,
            fingerprint="",
        )
        return policy_id

    def add_policy_issuer(self, policy_id, issuer_address):
        policy = self.policies[str(policy_id)]
        issuer_hex = _address_hex(issuer_address)
        policy.issuer_count += 1
        policy.issuer_commitment = _h("_keccak_text")(
            policy.issuer_commitment
            + "\x00"
            + issuer_hex
        )

    def add_policy_origin(self, policy_id, origin):
        policy = self.policies[str(policy_id)]
        origin = str(origin)
        policy.origin_count += 1
        policy.origin_commitment = _h("_keccak_text")(
            policy.origin_commitment
            + "\x00"
            + origin
        )

    def seal_policy(self, policy_id):
        policy = self.policies[str(policy_id)]
        material = "\x00".join((
            "memoryseal-sealed-policy-v1",
            policy.base_commitment,
            policy.issuer_commitment,
            policy.origin_commitment,
            str(policy.issuer_count),
            str(policy.origin_count),
        ))
        policy.fingerprint = _h("_keccak_text")(material)
        policy.sealed = True
        return policy.fingerprint

    def register_evidence(
        self,
        policy_id,
        stable_record_id,
        version,
        source_url,
        publisher_origin,
        sha256_digest,
        issued_at,
        expires_at,
    ):
        policy_id = str(policy_id)
        stable_record_id = str(stable_record_id)
        version_i = int(version)
        evidence_id = _h("_derive_evidence_id")(
            policy_id,
            stable_record_id,
            version_i,
        )
        issuer_hex = _address_hex(self.vm.sender)
        self.evidence[evidence_id] = _EvidenceState(
            policy_id=policy_id,
            stable_record_id=stable_record_id,
            version=version_i,
            issuer_hex=issuer_hex,
            source_url=str(source_url),
            publisher_origin=str(publisher_origin),
            sha256_digest=str(sha256_digest),
            issued_at=int(issued_at),
            expires_at=int(expires_at),
        )
        self.latest_versions[(policy_id, stable_record_id)] = version_i
        return evidence_id

    def get_policy_wire(self, policy_id):
        policy = self.policies.get(str(policy_id))
        if policy is None:
            return []
        return [
            policy.owner_hex,
            policy.slug,
            str(policy.version),
            "1" if policy.sealed else "0",
            str(policy.min_evidence_records),
            str(policy.min_distinct_issuers),
            str(policy.min_distinct_origins),
            str(policy.max_evidence_age_seconds),
            str(policy.min_remaining_validity_seconds),
            str(policy.max_claim_lifetime_seconds),
            str(policy.max_evidence_records),
            str(policy.max_content_bytes),
            policy.fingerprint,
        ]

    def get_evidence_wire(self, evidence_id):
        record = self.evidence.get(str(evidence_id))
        if record is None:
            return []
        latest = self.latest_versions.get(
            (record.policy_id, record.stable_record_id),
            0,
        )
        return [
            record.policy_id,
            record.stable_record_id,
            str(record.version),
            record.issuer_hex,
            record.source_url,
            record.publisher_origin,
            record.sha256_digest,
            str(record.issued_at),
            str(record.expires_at),
            str(int(latest)),
        ]


class _RegistryHandle:
    def __init__(self, model):
        self._model = model

    def view(self):
        return self._model


class _ComposedFacade:
    _REGISTRY_METHODS = {
        "get_owner",
        "create_policy",
        "add_policy_issuer",
        "add_policy_origin",
        "seal_policy",
        "register_evidence",
    }

    def __init__(self, main, model):
        self._main = main
        self._model = model

    def __getattr__(self, name):
        if name in self._REGISTRY_METHODS:
            return getattr(self._model, name)
        return getattr(self._main, name)


def _normalize_registry_address(value):
    return _address_hex(value).lower()


def deploy_composed_contract(
    direct_vm,
    direct_deploy,
    now_iso,
):
    direct_vm.check_pickling = True

    main = direct_deploy(
        MAIN_PATH,
        REGISTRY_ADDRESS,
        sdk_version=SDK_VERSION,
    )

    from gltest.direct import create_address

    owner = create_address("default_sender")
    direct_vm.sender = owner
    direct_vm.warp(now_iso)

    model = CanonicalRegistryWireModel(
        direct_vm,
        owner,
    )

    try:
        instance = object.__getattribute__(
            main,
            "_instance",
        )
    except Exception:
        instance = main

    import sys
    module = sys.modules[type(instance).__module__]
    gl_object = module.__dict__.get("gl")
    if gl_object is None:
        raise RuntimeError("canonical Main module gl object missing")

    original_get_contract_at = getattr(
        gl_object,
        "get_contract_at",
        None,
    )
    if original_get_contract_at is None:
        raise RuntimeError("canonical Main gl.get_contract_at unavailable")

    def get_contract_at(address):
        actual = _normalize_registry_address(address)
        if actual != REGISTRY_ADDRESS.lower():
            raise RuntimeError(
                "unexpected registry address: " + actual
            )
        return _RegistryHandle(model)

    setattr(
        gl_object,
        "get_contract_at",
        get_contract_at,
    )

    bound = main.get_registry()
    if str(bound).lower() != REGISTRY_ADDRESS.lower():
        raise RuntimeError(
            "canonical Main registry binding mismatch: "
            + str(bound)
        )

    return _ComposedFacade(main, model), owner
