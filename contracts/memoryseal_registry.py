# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from dataclasses import dataclass;from datetime import datetime,timezone;import hashlib;import json;from genlayer import*;import re
def _q(c,m):
	if c:raise gl.vm.UserError(m)
_e=16;_f=16;_b=8;_j=3600;_i=90*24*60*60;_d=60;_c=30*24*60*60;_n=3600;_m=30*24*60*60;_p=1024;_o=262144
@allow_storage
@dataclass
class Policy:policy_id:str;owner:Address;slug:str;version:u64;sealed:bool;min_evidence_records:u32;min_distinct_issuers:u32;min_distinct_origins:u32;max_evidence_age_seconds:u64;min_remaining_validity_seconds:u64;max_claim_lifetime_seconds:u64;max_evidence_records:u32;max_content_bytes:u32;issuer_count:u32;origin_count:u32;last_issuer:str;last_origin:str;base_commitment:str;issuer_commitment:str;origin_commitment:str;fingerprint:str;created_at:u64;sealed_at:u64
@allow_storage
@dataclass
class EvidenceRecord:evidence_id:str;policy_id:str;stable_record_id:str;version:u64;issuer:Address;source_url:str;publisher_origin:str;sha256_digest:str;issued_at:u64;expires_at:u64;registered_at:u64
def _now_seconds()->u64:a=int(datetime.now(timezone.utc).timestamp());_q(a<0,'INVALID_TRANSACTION_TIME');return u64(a)
def _keccak_text(a:str)->str:return Keccak256(a.encode('utf-8')).hexdigest()
def _pair_key(a:str,b:str)->str:return f"{len(a)}:{a}{len(b)}:{b}"
def _require_token(c:str,d:str,e:int)->None:_q(c=='',f"{d}_EMPTY");_q(len(c)>e,f"{d}_TOO_LONG");_q(re.fullmatch('[-a-z0-9._:]+',c)is None,f"{d}_INVALID_CHARACTER")
def _require_visible_ascii(c:str,d:str,e:int)->None:_q(c=='',f"{d}_EMPTY");_q(len(c)>e,f"{d}_TOO_LONG");_q(re.fullmatch('[!-~]+',c)is None,f"{d}_INVALID_CHARACTER")
def _validate_https_origin(e:str)->None:_require_visible_ascii(e,'ORIGIN',253);c='https://';_q(not e.startswith(c),'ORIGIN_NOT_HTTPS');a=e[len(c):];_q(a=='','ORIGIN_EMPTY_HOST');_q(a!=a.lower()or'/'in a or'?'in a or'#'in a or'@'in a or':'in a,'ORIGIN_NOT_CANONICAL');_q('.'not in a or a[0]in'.-'or a[-1]in'.-'or'..'in a or re.fullmatch('[a-z0-9.-]+',a)is None,'ORIGIN_INVALID_HOST')
def _validate_source_url(e:str,f:str)->None:_require_visible_ascii(e,'SOURCE_URL',2048);_q(not e.startswith('https://'),'SOURCE_URL_NOT_HTTPS');_q(not(e==f or e.startswith((f+'/',f+'?',f+'#'))),'SOURCE_ORIGIN_MISMATCH')
def _validate_sha256_digest(c:str)->None:_q(re.fullmatch('[0-9a-f]{64}',c)is None,'INVALID_SHA256')
def _derive_policy_id(b:str,c:str,d:u64)->str:a='\x00'.join(('memoryseal-policy-id-v1',b,c,str(int(d))));return _keccak_text(a)
def _derive_evidence_id(b:str,c:str,d:u64)->str:a='\x00'.join(('memoryseal-evidence-id-v1',b,c,str(int(d))));return _keccak_text(a)
def _fresh(g:int,f:int,p:int,a:int,b:int,z:str)->str:
	if g>p:return z
	if p-g>a:return'EVIDENCE_TOO_OLD'
	if f<=p:return'EVIDENCE_EXPIRED'
	if f-p<b:return'INSUFFICIENT_REMAINING_VALIDITY'
	return''
class MemorySealRegistry(gl.Contract):
	owner:Address;policies:TreeMap[str,Policy];policy_issuer_allowed:TreeMap[str,bool];policy_origin_allowed:TreeMap[str,bool];latest_evidence_versions:TreeMap[str,u64];lineage_issuers:TreeMap[str,Address];lineage_origins:TreeMap[str,str];evidence_records:TreeMap[str,EvidenceRecord];policy_count:u64;evidence_count:u64
	def __init__(self):self.owner=gl.message.sender_address;self.policy_count=u64(0);self.evidence_count=u64(0)
	def _require_policy(self,a:str)->Policy:_q(a not in self.policies,'POLICY_NOT_FOUND');return self.policies[a]
	def _require_policy_owner(self,a:Policy)->None:_q(gl.message.sender_address!=a.owner,'ONLY_POLICY_OWNER')
	def _require_policy_mutable(self,a:Policy)->None:_q(a.sealed,'POLICY_SEALED')
	@gl.public.view
	def get_owner(self)->str:return self.owner.as_hex
	@gl.public.view
	def get_policy_count(self)->u64:return self.policy_count
	@gl.public.view
	def get_evidence_count(self)->u64:return self.evidence_count
	@gl.public.view
	def derive_policy_id(self,owner_address:str,slug:str,version:u64)->str:b=slug;c=version;_require_token(b,'POLICY_SLUG',64);_q(int(c)<1,'INVALID_POLICY_VERSION');a=Address(owner_address);return _derive_policy_id(a.as_hex,b,c)
	@gl.public.view
	def get_policy(self,policy_id:str)->Policy:return self._require_policy(policy_id)
	@gl.public.view
	def is_policy_issuer(self,policy_id:str,issuer_address:str)->bool:a=Address(issuer_address);b=_pair_key(policy_id,a.as_hex);return self.policy_issuer_allowed.get(b,False)
	@gl.public.view
	def is_policy_origin(self,policy_id:str,origin:str)->bool:a=_pair_key(policy_id,origin);return self.policy_origin_allowed.get(a,False)
	@gl.public.view
	def derive_evidence_id(self,policy_id:str,stable_record_id:str,version:u64)->str:a=stable_record_id;b=version;_require_token(a,'STABLE_RECORD_ID',96);_q(int(b)<1,'INVALID_EVIDENCE_VERSION');return _derive_evidence_id(policy_id,a,b)
	@gl.public.view
	def get_evidence(self,evidence_id:str)->EvidenceRecord:a=evidence_id;_q(a not in self.evidence_records,'EVIDENCE_NOT_FOUND');return self.evidence_records[a]
	@gl.public.view
	def get_latest_evidence_version(self,policy_id:str,stable_record_id:str)->u64:a=_pair_key(policy_id,stable_record_id);return self.latest_evidence_versions.get(a,u64(0))
	@gl.public.write
	def create_policy(self,slug:str,version:u64,min_evidence_records:u32,min_distinct_issuers:u32,min_distinct_origins:u32,max_evidence_age_seconds:u64,min_remaining_validity_seconds:u64,max_claim_lifetime_seconds:u64,max_evidence_records:u32,max_content_bytes:u32)->str:q=slug;r=version;_require_token(q,'POLICY_SLUG',64);i=int(r);_q(i<1,'INVALID_POLICY_VERSION');a=int(min_evidence_records);e=int(min_distinct_issuers);f=int(min_distinct_origins);h=int(max_evidence_records);_q(e<2,'MIN_ISSUERS_BELOW_TWO');_q(f<2,'MIN_ORIGINS_BELOW_TWO');_q(e>_e,'TOO_MANY_REQUIRED_ISSUERS');_q(f>_f,'TOO_MANY_REQUIRED_ORIGINS');_q(a<2,'MIN_EVIDENCE_BELOW_TWO');_q(a<e or a<f,'MIN_EVIDENCE_BELOW_DISTINCTNESS');_q(h<a or h>_b,'INVALID_MAX_EVIDENCE_RECORDS');l=int(max_evidence_age_seconds);_q(l<_j or l>_i,'INVALID_MAX_EVIDENCE_AGE');g=int(min_remaining_validity_seconds);_q(g<_d or g>_c,'INVALID_MIN_REMAINING_VALIDITY');b=int(max_claim_lifetime_seconds);_q(b<_n or b>_m,'INVALID_MAX_CLAIM_LIFETIME');d=int(max_content_bytes);_q(d<_p or d>_o,'INVALID_MAX_CONTENT_BYTES');o=gl.message.sender_address;c=_derive_policy_id(o.as_hex,q,r);_q(c in self.policies,'POLICY_ALREADY_EXISTS');p=_now_seconds();n='\x00'.join(('memoryseal-policy-base-v1',c,o.as_hex,q,str(i),str(a),str(e),str(f),str(l),str(g),str(b),str(h),str(d)));m=_keccak_text(n);j=_keccak_text('memoryseal-policy-issuers-v1'+'\x00'+c);k=_keccak_text('memoryseal-policy-origins-v1'+'\x00'+c);self.policies[c]=Policy(c,o,q,u64(i),False,u32(a),u32(e),u32(f),u64(l),u64(g),u64(b),u32(h),u32(d),u32(0),u32(0),'','',m,j,k,'',p,u64(0));self.policy_count=u64(int(self.policy_count)+1);return c
	def _pm(self,p:str,v:str,o:bool)->None:
		a=self._require_policy(p);self._require_policy_owner(a);self._require_policy_mutable(a)
		if o:_validate_https_origin(v);b=_pair_key(p,v);_q(self.policy_origin_allowed.get(b,False),'DUPLICATE_ORIGIN');_q(a.last_origin!=''and v<=a.last_origin,'ORIGINS_NOT_STRICTLY_SORTED');_q(int(a.origin_count)>=_f,'MAX_POLICY_ORIGINS_REACHED');a.origin_count=u32(int(a.origin_count)+1);a.last_origin=v;a.origin_commitment=_keccak_text(a.origin_commitment+'\x00'+v);self.policy_origin_allowed[b]=True
		else:c=Address(v);v=c.as_hex;_q(v=='0x'+'0'*40,'ZERO_ISSUER');b=_pair_key(p,v);_q(self.policy_issuer_allowed.get(b,False),'DUPLICATE_ISSUER');_q(a.last_issuer!=''and v<=a.last_issuer,'ISSUERS_NOT_STRICTLY_SORTED');_q(int(a.issuer_count)>=_e,'MAX_POLICY_ISSUERS_REACHED');a.issuer_count=u32(int(a.issuer_count)+1);a.last_issuer=v;a.issuer_commitment=_keccak_text(a.issuer_commitment+'\x00'+v);self.policy_issuer_allowed[b]=True
		self.policies[p]=a
	@gl.public.write
	def add_policy_issuer(self,policy_id:str,issuer_address:str)->None:self._pm(policy_id,issuer_address,False)
	@gl.public.write
	def add_policy_origin(self,policy_id:str,origin:str)->None:self._pm(policy_id,origin,True)
	@gl.public.write
	def seal_policy(self,policy_id:str)->str:c=policy_id;a=self._require_policy(c);self._require_policy_owner(a);self._require_policy_mutable(a);_q(int(a.issuer_count)<int(a.min_distinct_issuers),'INSUFFICIENT_POLICY_ISSUERS');_q(int(a.origin_count)<int(a.min_distinct_origins),'INSUFFICIENT_POLICY_ORIGINS');b='\x00'.join(('memoryseal-sealed-policy-v1',a.base_commitment,a.issuer_commitment,a.origin_commitment,str(int(a.issuer_count)),str(int(a.origin_count))));a.fingerprint=_keccak_text(b);a.sealed=True;a.sealed_at=_now_seconds();self.policies[c]=a;return a.fingerprint
	@gl.public.write
	def register_evidence(self,policy_id:str,stable_record_id:str,version:u64,source_url:str,publisher_origin:str,sha256_digest:str,issued_at:u64,expires_at:u64)->str:
		r=policy_id;s=stable_record_id;t=version;u=source_url;v=publisher_origin;w=sha256_digest;l=self._require_policy(r);_q(not l.sealed,'POLICY_NOT_SEALED');_require_token(s,'STABLE_RECORD_ID',96);c=int(t);_q(c<1,'INVALID_EVIDENCE_VERSION');j=gl.message.sender_address;n=_pair_key(r,j.as_hex);_q(not self.policy_issuer_allowed.get(n,False),'ISSUER_NOT_APPROVED');_validate_https_origin(v);o=_pair_key(r,v);_q(not self.policy_origin_allowed.get(o,False),'ORIGIN_NOT_APPROVED');_validate_source_url(u,v);_validate_sha256_digest(w);p=int(_now_seconds());g=int(issued_at);f=int(expires_at);_q(g<=0,'INVALID_ISSUED_AT');_q(f<=g,'INVALID_EVIDENCE_INTERVAL');x=_fresh(g,f,p,int(l.max_evidence_age_seconds),int(l.min_remaining_validity_seconds),'ISSUED_AT_IN_FUTURE');_q(x!='',x);a=_pair_key(r,s);d=int(self.latest_evidence_versions.get(a,u64(0)));_q(c<=d,'VERSION_NOT_INCREASING')
		if d==0:self.lineage_issuers[a]=j;self.lineage_origins[a]=v
		else:_q(self.lineage_issuers[a]!=j,'LINEAGE_ISSUER_MISMATCH');_q(self.lineage_origins[a]!=v,'LINEAGE_ORIGIN_MISMATCH')
		b=_derive_evidence_id(r,s,t);_q(b in self.evidence_records,'EVIDENCE_ALREADY_EXISTS');self.evidence_records[b]=EvidenceRecord(b,r,s,u64(c),j,u,v,w,u64(g),u64(f),u64(p));self.latest_evidence_versions[a]=u64(c);self.evidence_count=u64(int(self.evidence_count)+1);return b
	@gl.public.view
	def get_policy_wire(self,policy_id:str)->list[str]:
		if policy_id not in self.policies:return[]
		a=self.policies[policy_id];return[a.owner.as_hex,a.slug,str(int(a.version)),'1'if a.sealed else'0',str(int(a.min_evidence_records)),str(int(a.min_distinct_issuers)),str(int(a.min_distinct_origins)),str(int(a.max_evidence_age_seconds)),str(int(a.min_remaining_validity_seconds)),str(int(a.max_claim_lifetime_seconds)),str(int(a.max_evidence_records)),str(int(a.max_content_bytes)),a.fingerprint]
	@gl.public.view
	def get_evidence_wire(self,evidence_id:str)->list[str]:
		if evidence_id not in self.evidence_records:return[]
		a=self.evidence_records[evidence_id];b=_pair_key(a.policy_id,a.stable_record_id);c=int(self.latest_evidence_versions.get(b,u64(0)));return[a.policy_id,a.stable_record_id,str(int(a.version)),a.issuer.as_hex,a.source_url,a.publisher_origin,a.sha256_digest,str(int(a.issued_at)),str(int(a.expires_at)),str(c)]
