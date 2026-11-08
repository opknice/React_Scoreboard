/** Shared bounded OBS call. Keep this module independent of macro execution. */
export function callObsWithTimeout(
  obsRef: any,
  requestType: string,
  requestData: Record<string, unknown> | undefined,
  signal?: AbortSignal,
): Promise<any> {
  if (signal?.aborted) throw new Error('Macro ถูกยกเลิก');
  let timeoutId: number | null = null;
  let handleAbort: (() => void) | null = null;
  const operation = Promise.resolve(obsRef.call(requestType, requestData));
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(`OBS timeout: ${requestType}`)), 5000);
  });
  const aborted = new Promise<never>((_, reject) => {
    handleAbort = () => reject(new Error('Macro ถูกยกเลิก'));
    signal?.addEventListener('abort', handleAbort, { once: true });
  });
  return Promise.race([operation, timeout, aborted]).finally(() => {
    if (timeoutId !== null) window.clearTimeout(timeoutId);
    if (handleAbort) signal?.removeEventListener('abort', handleAbort);
  });
}
