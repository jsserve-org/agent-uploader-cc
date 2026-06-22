/**
 * Best-effort upload webhook. POSTs JSON metadata to the key's configured URL
 * after a successful upload. Never throws — a failing webhook must not fail the
 * upload — and is bounded by a short timeout so it can't hang the request.
 */
export type WebhookPayload = {
  event: "upload.created";
  id: string;
  url: string;
  filename: string;
  contentType: string;
  size: number;
  folder: string | null;
  keyLabel: string;
  expiresAt: string;
};

export async function dispatchWebhook(
  webhookUrl: string,
  payload: WebhookPayload,
): Promise<void> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "agent-uploader-webhook/1",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));
  } catch (err) {
    console.error("[webhook] delivery failed:", (err as Error)?.message);
  }
}
