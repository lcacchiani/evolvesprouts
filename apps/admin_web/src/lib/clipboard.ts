/**
 * Writes text to the system clipboard. Rejects if the Clipboard API is unavailable
 * (for example non-secure context) or if the write fails.
 */
export async function copyTextToClipboard(text: string): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
    throw new Error('Clipboard is not available in this browser or context.');
  }
  await navigator.clipboard.writeText(text);
}

/**
 * Same as {@link copyTextToClipboard} but returns false instead of throwing.
 * Use when the UI has no channel for errors (for example icon-only actions).
 */
export async function tryCopyTextToClipboard(text: string): Promise<boolean> {
  try {
    await copyTextToClipboard(text);
    return true;
  } catch {
    return false;
  }
}
