import { put, type PutBlobResult } from "@vercel/blob";

/**
 * Vercel Blob `put()` can hang if the network or API stalls. Pass a bounded
 * `abortSignal` so ingest fails fast instead of running until the function hits
 * `maxDuration` (~300s) and returns 504.
 *
 * @see https://vercel.com/docs/storage/vercel-blob/using-blob-sdk
 */
function blobPutTimeoutMs(): number {
  const raw = Number(process.env.BLOB_PUT_TIMEOUT_MS ?? 120_000);
  if (!Number.isFinite(raw)) return 120_000;
  return Math.min(Math.max(raw, 10_000), 240_000);
}

export async function putBlob(
  pathname: string,
  body: Parameters<typeof put>[1],
  options: Parameters<typeof put>[2]
): Promise<PutBlobResult> {
  const ms = blobPutTimeoutMs();
  const timeoutSignal = AbortSignal.timeout(ms);
  const upstream = options.abortSignal;
  const anyFn = (
    AbortSignal as unknown as { any?: (signals: AbortSignal[]) => AbortSignal }
  ).any;
  const abortSignal =
    upstream && typeof anyFn === "function"
      ? anyFn([timeoutSignal, upstream])
      : timeoutSignal;

  return put(pathname, body, { ...options, abortSignal });
}
