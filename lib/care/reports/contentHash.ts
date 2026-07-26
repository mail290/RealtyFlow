// =====================================================================
// content_hash — sha256 of the finished PDF (hex). If the owner's copy and
// ours share a hash, nobody can claim the document was altered after
// sending. Same bytes → same hash (acceptance criterion 6).
// =====================================================================
// Uses WebCrypto (globalThis.crypto.subtle), available in browsers and
// modern Node.
// =====================================================================

export async function sha256Hex(bytes: ArrayBuffer | Uint8Array): Promise<string> {
  const buf = bytes instanceof Uint8Array
    ? bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
    : bytes;
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return hex(new Uint8Array(digest));
}

/** Stable sha256 over any JSON-serialisable snapshot (for tests / integrity). */
export async function sha256OfJson(value: unknown): Promise<string> {
  const json = stableStringify(value);
  const bytes = new TextEncoder().encode(json);
  return sha256Hex(bytes);
}

function hex(bytes: Uint8Array): string {
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
}

/** Deterministic JSON: object keys sorted recursively. */
export function stableStringify(value: unknown): string {
  return JSON.stringify(sortDeep(value));
}

function sortDeep(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortDeep);
  if (v && typeof v === 'object') {
    const obj = v as Record<string, unknown>;
    return Object.keys(obj)
      .sort()
      .reduce<Record<string, unknown>>((acc, k) => {
        acc[k] = sortDeep(obj[k]);
        return acc;
      }, {});
  }
  return v;
}
