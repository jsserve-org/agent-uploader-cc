// APK detection + metadata extraction. app-info-parser reads the file from disk
// and decodes the binary AndroidManifest/resources to pull package, version,
// label, and icon. It's CommonJS, so we require() it lazily inside the parser.

export const APK_CONTENT_TYPE = "application/vnd.android.package-archive";

export function looksLikeApk(filename: string, contentType: string): boolean {
  const name = filename.toLowerCase();
  const mime = contentType.toLowerCase();
  return (
    name.endsWith(".apk") ||
    mime === APK_CONTENT_TYPE ||
    mime === "application/vnd.android.package-archive"
  );
}

export type ApkMetadata = {
  appPackage: string | null;
  appLabel: string | null;
  appVersionName: string | null;
  appVersionCode: number | null;
  appIcon: string | null; // data: URL
};

// Keep icons out of the row when they're unexpectedly large.
const MAX_ICON_CHARS = 300_000;

function pickLabel(result: Record<string, unknown>): string | null {
  const app = result.application as { label?: unknown } | undefined;
  const raw = app?.label ?? (result as { label?: unknown }).label;
  if (Array.isArray(raw)) return (raw.find(Boolean) as string) ?? null;
  if (typeof raw === "string" && raw) return raw;
  return null;
}

/**
 * Parse APK metadata from a file on disk. Never throws — returns all-nulls on
 * any failure so a non-parseable APK still uploads (just without store detail).
 */
export async function parseApkMetadata(absPath: string): Promise<ApkMetadata> {
  const empty: ApkMetadata = {
    appPackage: null,
    appLabel: null,
    appVersionName: null,
    appVersionCode: null,
    appIcon: null,
  };

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const AppInfoParser = require("app-info-parser");
    const result = (await new AppInfoParser(absPath).parse()) as Record<
      string,
      unknown
    >;

    const versionCodeRaw = result.versionCode;
    const versionCode =
      typeof versionCodeRaw === "number"
        ? versionCodeRaw
        : Number(versionCodeRaw) || null;

    const icon =
      typeof result.icon === "string" && result.icon.startsWith("data:") &&
      result.icon.length <= MAX_ICON_CHARS
        ? result.icon
        : null;

    return {
      appPackage: typeof result.package === "string" ? result.package : null,
      appLabel: pickLabel(result),
      appVersionName:
        typeof result.versionName === "string" ? result.versionName : null,
      appVersionCode: versionCode,
      appIcon: icon,
    };
  } catch (err) {
    console.error("[apk] metadata parse failed:", (err as Error)?.message);
    return empty;
  }
}
