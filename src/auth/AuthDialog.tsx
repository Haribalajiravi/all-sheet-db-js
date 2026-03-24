/**
 * OAuth Client ID dialog — shadcn-style modal (Tailwind).
 */

import * as React from 'react';
import { useEffect, useId, useRef, useState } from 'react';
import { AuthCredentials } from '../types';

export interface AuthDialogProps {
  serviceName: string;
  onAuthenticate: (credentials: AuthCredentials) => Promise<void>;
  onCancel: () => void;
  requiredFields?: string[];
  /** `dark` matches slate expense demo; `light` for light pages */
  variant?: 'light' | 'dark';
  title?: string;
  description?: string;
  submitLabel?: string;
}

export const AuthDialog: React.FC<AuthDialogProps> = ({
  serviceName,
  onAuthenticate,
  onCancel,
  requiredFields = ['clientId'],
  variant = 'light',
  title,
  description,
  submitLabel = 'Continue',
}) => {
  const [credentials, setCredentials] = useState<AuthCredentials>({
    clientId: '',
    clientSecret: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  useEffect(() => {
    panelRef.current?.querySelector<HTMLInputElement>('input')?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await onAuthenticate(credentials);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setCredentials(prev => ({ ...prev, [field]: value }));
  };

  const isDark = variant === 'dark';
  const shell = isDark ? 'bg-slate-950/80 backdrop-blur-sm' : 'bg-black/50 backdrop-blur-[2px]';
  const card = isDark
    ? 'bg-slate-900 border border-slate-700 text-slate-100 shadow-2xl shadow-black/40'
    : 'bg-white border border-slate-200 text-slate-900 shadow-xl';
  const labelCls = isDark ? 'text-slate-400' : 'text-slate-600';
  const inputCls = isDark
    ? 'bg-slate-950 border-slate-700 text-slate-100 placeholder:text-slate-600 focus:ring-blue-500'
    : 'bg-white border-slate-300 text-slate-900 focus:ring-blue-500';
  const btnGhost = isDark
    ? 'bg-slate-800 text-slate-200 border-slate-600 hover:bg-slate-700'
    : 'bg-slate-100 text-slate-800 border-slate-200 hover:bg-slate-200';
  const btnPrimary =
    'bg-blue-600 text-white border-transparent hover:bg-blue-500 disabled:opacity-50';

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center p-4 ${shell}`}
      role="presentation"
      onClick={e => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        className={`relative w-full max-w-md rounded-xl border p-6 ${card}`}
      >
        <div className="mb-1 text-xs font-medium uppercase tracking-wide text-blue-500/90">
          {serviceName}
        </div>
        <h2 id={titleId} className="text-lg font-semibold leading-tight">
          {title ?? 'Sign in'}
        </h2>
        {description && (
          <p
            id={descId}
            className={`mt-2 text-sm leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}
          >
            {description}
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {requiredFields.includes('clientId') && (
            <div>
              <label htmlFor="clientId" className={`mb-1.5 block text-sm font-medium ${labelCls}`}>
                OAuth Web Client ID
              </label>
              <input
                id="clientId"
                type="text"
                autoComplete="off"
                spellCheck={false}
                value={credentials.clientId || ''}
                onChange={e => handleChange('clientId', e.target.value)}
                className={`w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2 ${inputCls}`}
                placeholder="xxxx.apps.googleusercontent.com"
                required
              />
            </div>
          )}

          {requiredFields.includes('clientSecret') && (
            <div>
              <label
                htmlFor="clientSecret"
                className={`mb-1.5 block text-sm font-medium ${labelCls}`}
              >
                Client Secret
              </label>
              <input
                id="clientSecret"
                type="password"
                value={credentials.clientSecret || ''}
                onChange={e => handleChange('clientSecret', e.target.value)}
                className={`w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2 ${inputCls}`}
              />
            </div>
          )}

          {error && (
            <div
              className={
                isDark
                  ? 'rounded-lg border border-rose-900/60 bg-rose-950/50 px-3 py-2 text-sm text-rose-200'
                  : 'rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800'
              }
            >
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onCancel}
              className={`rounded-lg border px-4 py-2 text-sm font-medium ${btnGhost}`}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`rounded-lg px-4 py-2 text-sm font-medium ${btnPrimary}`}
              disabled={loading}
            >
              {loading ? 'Please wait…' : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
