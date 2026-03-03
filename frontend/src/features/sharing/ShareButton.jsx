import React from 'react';

const SHARE_EXPIRY_OPTIONS = [
  { value: 'one_hour', label: '1h' },
  { value: 'one_day', label: '24h' },
  { value: 'seven_days', label: '7d' },
  { value: 'thirty_days', label: '30d' },
  { value: 'never', label: 'Never' }
];

export default function ShareButton({
  onShare,
  onCreateLink,
  disabled = false,
  expiryPreset = 'seven_days',
  onExpiryPresetChange
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={onShare}
        disabled={disabled}
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
      >
        Share
      </button>
      <button
        type="button"
        onClick={() => onCreateLink?.(expiryPreset)}
        disabled={disabled}
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
      >
        Public link
      </button>
      {typeof onExpiryPresetChange === 'function' && (
        <select
          value={expiryPreset}
          onChange={(event) => onExpiryPresetChange(event.target.value)}
          disabled={disabled}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 disabled:opacity-60"
          aria-label="Public link expiration"
        >
          {SHARE_EXPIRY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              Expire {option.label}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
