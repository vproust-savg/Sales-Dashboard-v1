// FILE: client/src/utils/clipboard.ts
// PURPOSE: Copy text to clipboard with iframe-safe fallback
// USED BY: CopyableId.tsx
// EXPORTS: copyToClipboard

// WHY: navigator.clipboard.writeText() requires the iframe to have
// allow="clipboard-write" permission. In the Airtable Omni iframe,
// we don't control this attribute, so the Clipboard API silently fails.
// The execCommand fallback is deprecated but works in all major browsers
// and doesn't require iframe permissions.

export async function copyToClipboard(text: string): Promise<boolean> {
  // WHY: Try modern Clipboard API first (works outside iframes or with permission)
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fall through to execCommand fallback
  }

  // WHY: Fallback for Airtable iframe — no permission needed
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    // WHY: Position offscreen to avoid visual flash
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  } catch {
    return false;
  }
}
