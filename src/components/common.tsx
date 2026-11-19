import type { FC } from 'react';
import { Text } from '@wix/design-system';
import { dashboard } from '@wix/dashboard';
import { BUILD } from '../lib/build-info';
import { SCOPE_FOR_METHOD } from '../lib/wix-ops';

/** Which code is running: the git commit it was built from, and when. */
export const buildLabel = `build ${BUILD.commit} · ${new Date(BUILD.builtAt).toLocaleString('en-GB', {
  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
})}`;

export const BuildStamp: FC = () => (
  <Text size="tiny" secondary>{buildLabel}</Text>
);

/**
 * Readable text for a Wix SDK error. The SDK puts a JSON blob in `message` and reports
 * "UNKNOWN" as the description when the HTTP response has no status text, so dig out
 * the server message, HTTP status, error code and request ID instead.
 */
export function errorText(e: unknown): string {
  if (typeof e === 'string') return e;
  const err = e as any;
  if (!err) return 'Something went wrong';
  let message: string = err.message ?? '';
  try {
    const parsed = JSON.parse(message);
    if (parsed && typeof parsed.message === 'string') message = parsed.message;
  } catch {
    /* plain-text message */
  }
  const app = err.details?.applicationError;
  const status: number | undefined = err.status;
  const noise = (v: unknown) => !v || v === 'UNKNOWN' || String(v) === String(status);
  const code = noise(app?.code) ? '' : app.code;
  const description = noise(app?.description) || app.description === message ? '' : app.description;
  const requestId: string | undefined = err.requestId ?? err.details?.requestId;
  const method: string | undefined = err.wixMethod;

  const main = [noise(message) ? '' : message, description].filter(Boolean).join(': ') || 'Request failed';
  const meta = [method, status && `HTTP ${status}`, code, requestId && `request ${requestId}`].filter(Boolean).join(', ');
  const scope = method ? SCOPE_FOR_METHOD[method] : undefined;
  const hint =
    status === 403 || status === 401
      ? ` The app is missing a permission${scope ? `: ${scope}` : ''}. Add it in the app dashboard (Develop > Permissions), release a new version, then accept the update on the site.`
      : '';
  return `${main}${meta ? ` (${meta})` : ''}.${hint}`;
}

export function toastError(e: unknown, prefix = '') {
  console.error(e);
  dashboard.showToast({ message: `${prefix}${errorText(e)}`, type: 'error' });
}

export function toastOk(message: string) {
  dashboard.showToast({ message, type: 'success' });
}
