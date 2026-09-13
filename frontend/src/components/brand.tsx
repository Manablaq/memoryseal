import Link from "next/link";

export function SealGlyph({ compact = false }: { compact?: boolean }) {
  return (
    <span className={compact ? "seal-glyph seal-glyph--compact" : "seal-glyph"}>
      <svg viewBox="0 0 56 56" aria-hidden="true">
        <circle cx="28" cy="28" r="21" />
        <path d="M18 28.5 24.5 35 39 20.5" />
        <path d="M28 4.5v6M28 45.5v6M4.5 28h6M45.5 28h6" />
      </svg>
    </span>
  );
}

export function Brand({ href = "/" }: { href?: string }) {
  return (
    <Link className="brand" href={href} aria-label="MemorySeal home">
      <SealGlyph compact />
      <span className="brand-wordmark">
        Memory<span>Seal</span>
      </span>
    </Link>
  );
}

export function ArrowIcon() {
  return (
    <svg className="inline-icon" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M4 10h11M11 6l4 4-4 4" />
    </svg>
  );
}

export function ExternalIcon() {
  return (
    <svg className="inline-icon" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M8 5h7v7M15 5l-9 9M14 11v4H5V6h4" />
    </svg>
  );
}

export function RefreshIcon() {
  return (
    <svg className="inline-icon" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M15.3 7A6 6 0 1 0 16 11M15.3 7V3.8M15.3 7h-3.2" />
    </svg>
  );
}

export function SearchIcon() {
  return (
    <svg className="inline-icon" viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="8.5" cy="8.5" r="4.5" />
      <path d="m12 12 4 4" />
    </svg>
  );
}
