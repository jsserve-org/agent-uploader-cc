/**
 * File-type allowlist matching. A key's `allowedTypes` is a comma-separated list
 * of patterns, each either:
 *   - an extension:        ".apk"  or  "apk"
 *   - a full MIME type:    "application/zip"
 *   - a MIME wildcard:     "image/*"
 * An empty/null list means "allow anything".
 */

export function parseAllowedTypes(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isTypeAllowed(
  filename: string,
  contentType: string,
  patterns: string[],
): boolean {
  if (patterns.length === 0) return true;

  const name = filename.toLowerCase();
  const mime = contentType.toLowerCase().split(";")[0].trim();
  const ext = name.includes(".") ? name.slice(name.lastIndexOf(".")) : "";

  return patterns.some((p) => {
    if (p.includes("/")) {
      // MIME pattern, possibly with a trailing wildcard.
      if (p.endsWith("/*")) return mime.startsWith(p.slice(0, -1));
      return mime === p;
    }
    // Extension pattern, with or without a leading dot.
    const want = p.startsWith(".") ? p : `.${p}`;
    return ext === want;
  });
}
