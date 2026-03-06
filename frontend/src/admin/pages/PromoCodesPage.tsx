import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAdminAuth } from '../auth/useAdminAuth';
import { useAdminI18n } from '../i18n/AdminI18nContext';

const BENEFIT_TYPES = [
  'percent_discount',
  'trial_days',
  'lifetime_access',
  'credits',
  'feature_access'
];
const BLOCK_FEATURE_TOKENS = new Set([
  'account_block',
  'account_blocked',
  'account_blocked_forever',
  'blocked_forever',
  'ban_account',
  'banned'
]);

const normalizeFeatureToken = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[\s-]+/g, '_');

const isBlockingBenefitPayload = (benefitType, rawBenefit) => {
  if (String(benefitType || '').trim() !== 'feature_access') return false;
  const benefit = rawBenefit && typeof rawBenefit === 'object' && !Array.isArray(rawBenefit) ? rawBenefit : {};
  const rawFeatures = Array.isArray(benefit.features)
    ? benefit.features
    : (benefit.feature ? [benefit.feature] : []);
  const hasBlockingFeature = rawFeatures.some((item) => BLOCK_FEATURE_TOKENS.has(normalizeFeatureToken(item)));
  return hasBlockingFeature
    || benefit.blocked === true
    || benefit.blocked_forever === true
    || benefit.account_blocked === true
    || benefit.banned === true;
};

const BENEFIT_DEFAULTS_BY_TYPE = {
  percent_discount: { percent: 20 },
  trial_days: { trial_days: 30 },
  lifetime_access: { plan: 'individual', lifetime: true },
  credits: { credits: 100 },
  feature_access: { features: ['beta_converter'], scope: 'global' }
};

const PROMO_PRESETS = [
  {
    id: 'pro_trial_14',
    label: 'Pro trial 14d',
    benefit_type: 'trial_days',
    benefit: { trial_days: 14, plan: 'pro' },
    max_redemptions: 300,
    active_days: 21,
    code_prefix: 'PRO14'
  },
  {
    id: 'team_trial_30',
    label: 'Team trial 30d',
    benefit_type: 'trial_days',
    benefit: { trial_days: 30, plan: 'team' },
    max_redemptions: 100,
    active_days: 45,
    code_prefix: 'TEAM30'
  },
  {
    id: 'individual_lifetime',
    label: 'Individual lifetime',
    benefit_type: 'lifetime_access',
    benefit: { plan: 'individual', lifetime: true },
    max_redemptions: 50,
    active_days: 60,
    code_prefix: 'LIFEIND'
  },
  {
    id: 'account_block_forever',
    label: 'Account block forever',
    benefit_type: 'feature_access',
    benefit: {
      features: ['account_blocked_forever'],
      blocked: true,
      blocked_forever: true,
      reason: 'policy_violation',
      scope: 'account'
    },
    max_redemptions: 100,
    active_days: 3650,
    code_prefix: 'BAN'
  },
  {
    id: 'pro_discount_20',
    label: 'Pro 20% discount',
    benefit_type: 'percent_discount',
    benefit: { percent: 20, plan: 'pro' },
    max_redemptions: 500,
    active_days: 30,
    code_prefix: 'PRO20'
  },
  {
    id: 'credits_500',
    label: '500 credits',
    benefit_type: 'credits',
    benefit: { credits: 500, scope: 'global' },
    max_redemptions: 200,
    active_days: 30,
    code_prefix: 'CR500'
  }
];

const getBenefitTemplate = (benefitType) => {
  const type = String(benefitType || '').trim();
  const fallbackType = 'trial_days';
  return BENEFIT_DEFAULTS_BY_TYPE[type] || BENEFIT_DEFAULTS_BY_TYPE[fallbackType];
};

const getBenefitTemplateJson = (benefitType) => `${JSON.stringify(getBenefitTemplate(benefitType), null, 2)}\n`;

const EMPTY_FORM = {
  code: '',
  benefit_type: 'trial_days',
  benefit_json: getBenefitTemplateJson('trial_days'),
  max_redemptions: '',
  starts_at: '',
  expires_at: '',
  is_active: true
};

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const generatePromoCode = (prefix = 'MEGA', length = 10) => {
  const normalizedPrefix = String(prefix || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'MEGA';
  const randomLength = Math.max(4, Number(length) || 10);
  let randomPart = '';
  for (let i = 0; i < randomLength; i += 1) {
    const idx = Math.floor(Math.random() * ALPHABET.length);
    randomPart += ALPHABET[idx];
  }
  return `${normalizedPrefix}-${randomPart}`;
};

const toDateTimeLocal = (isoValue) => {
  if (!isoValue) return '';
  const parsed = new Date(isoValue);
  if (Number.isNaN(parsed.getTime())) return '';
  const offsetMs = parsed.getTimezoneOffset() * 60000;
  return new Date(parsed.getTime() - offsetMs).toISOString().slice(0, 16);
};

const toIsoOrNull = (dateTimeLocal) => {
  const value = String(dateTimeLocal || '').trim();
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
};

const addDaysUtcIso = (days) => {
  const safeDays = Math.max(1, Number(days) || 1);
  const now = new Date();
  const future = new Date(now.getTime() + safeDays * 24 * 60 * 60 * 1000);
  return future.toISOString();
};

const stringifyBenefit = (benefit) => {
  try {
    return `${JSON.stringify(benefit || {}, null, 2)}\n`;
  } catch {
    return '{\n}\n';
  }
};

const toPayloadFromForm = (form, t) => {
  const code = String(form.code || '').trim().toUpperCase();
  if (!code) {
    throw new Error(t.adminPromoCodeRequired);
  }
  let benefit;
  try {
    benefit = JSON.parse(String(form.benefit_json || '{}'));
  } catch {
    throw new Error(t.adminPromoBenefitJsonInvalid);
  }
  if (!benefit || typeof benefit !== 'object' || Array.isArray(benefit)) {
    throw new Error(t.adminPromoBenefitJsonObjectRequired);
  }
  const maxRedemptionsRaw = String(form.max_redemptions || '').trim();
  const maxRedemptions = maxRedemptionsRaw ? Number(maxRedemptionsRaw) : null;
  if (maxRedemptionsRaw && (!Number.isFinite(maxRedemptions) || maxRedemptions <= 0)) {
    throw new Error(t.adminPromoMaxRedemptionsPositive);
  }

  return {
    code,
    benefit_type: String(form.benefit_type || '').trim(),
    benefit,
    max_redemptions: maxRedemptionsRaw ? Math.floor(maxRedemptions) : null,
    per_user_limit: 1,
    starts_at: toIsoOrNull(form.starts_at),
    expires_at: toIsoOrNull(form.expires_at),
    is_active: Boolean(form.is_active)
  };
};

const toFormFromPromo = (promo) => ({
  code: String(promo?.code || ''),
  benefit_type: String(promo?.benefit_type || 'trial_days'),
  benefit_json: stringifyBenefit(promo?.benefit || {}),
  max_redemptions: promo?.max_redemptions === null || promo?.max_redemptions === undefined
    ? ''
    : String(promo.max_redemptions),
  starts_at: toDateTimeLocal(promo?.starts_at),
  expires_at: toDateTimeLocal(promo?.expires_at),
  is_active: Boolean(promo?.is_active)
});

const limitLabel = (promo, t) => {
  if (promo.max_redemptions === null || promo.max_redemptions === undefined) {
    return `${promo.redeemed_count || 0} / ${t.adminUnlimited}`;
  }
  return `${promo.redeemed_count || 0} / ${promo.max_redemptions}`;
};

const resolvePromoAdminErrorMessage = (err, fallback, t) => {
  const code = String(err?.code || '').trim();
  if (code === 'PROMO_DISABLED') {
    return t.adminPromoDisabled;
  }
  if (code === 'PROMO_STORAGE_NOT_CONFIGURED') {
    return t.adminPromoStorageNotConfigured;
  }
  if (code === 'PROMO_STORAGE_UNAVAILABLE') {
    return t.adminPromoStorageUnavailable;
  }
  if (code === 'PROMO_SCHEMA_NOT_READY') {
    return t.adminPromoSchemaNotReady;
  }
  return err?.message || fallback;
};

export const PromoCodesPage = () => {
  const { api, logout } = useAdminAuth();
  const { t } = useAdminI18n();
  const [codes, setCodes] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [codePrefix, setCodePrefix] = useState('MEGA');
  const [campaignPresetId, setCampaignPresetId] = useState(PROMO_PRESETS[0].id);
  const [campaignCount, setCampaignCount] = useState('10');
  const [campaignMaxRedemptions, setCampaignMaxRedemptions] = useState('100');
  const [campaignActiveDays, setCampaignActiveDays] = useState('30');
  const [campaignCodePrefix, setCampaignCodePrefix] = useState('MEGA');
  const [campaignRunning, setCampaignRunning] = useState(false);
  const [campaignLastBatch, setCampaignLastBatch] = useState([]);
  const selectedCampaignPreset = useMemo(
    () => PROMO_PRESETS.find((item) => item.id === campaignPresetId) || PROMO_PRESETS[0],
    [campaignPresetId]
  );
  const campaignCreatesPermanentBlock = isBlockingBenefitPayload(
    selectedCampaignPreset?.benefit_type,
    selectedCampaignPreset?.benefit
  );
  const parsedFormBenefit = useMemo(() => {
    try {
      return JSON.parse(String(form.benefit_json || '{}'));
    } catch {
      return null;
    }
  }, [form.benefit_json]);
  const formCreatesPermanentBlock = isBlockingBenefitPayload(form.benefit_type, parsedFormBenefit);

  const loadPromoCodes = useCallback(async () => {
    setLoading(true);
    setError('');
    setNotice('');
    try {
      const response = await api.getPromoCodes();
      setCodes(Array.isArray(response) ? response : []);
    } catch (err) {
      if (err?.status === 401) {
        await logout();
        return;
      }
      if (err?.status === 404) {
        setCodes([]);
        setNotice(t.adminPromoApiUnavailable);
      } else {
        setError(resolvePromoAdminErrorMessage(err, t.adminErrorLoadPromoCodes, t));
      }
    } finally {
      setLoading(false);
    }
  }, [api, logout, t]);

  useEffect(() => {
    void loadPromoCodes();
  }, [loadPromoCodes]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId('');
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const payload = toPayloadFromForm(form, t);
      if (editingId) {
        await api.updatePromoCode(editingId, payload);
        setNotice(t.adminPromoCodeUpdated);
      } else {
        await api.createPromoCode(payload);
        setNotice(t.adminPromoCodeCreated);
      }
      resetForm();
      await loadPromoCodes();
    } catch (err) {
      setError(resolvePromoAdminErrorMessage(err, t.adminErrorSavePromoCode, t));
    } finally {
      setSaving(false);
    }
  };

  const onGenerateCode = () => {
    const nextCode = generatePromoCode(codePrefix, 8);
    setForm((prev) => ({ ...prev, code: nextCode }));
  };

  const applyPresetToForm = () => {
    const preset = PROMO_PRESETS.find((item) => item.id === campaignPresetId) || PROMO_PRESETS[0];
    const nextCode = generatePromoCode(preset.code_prefix || codePrefix || 'MEGA', 8);
    const maxRedemptions = Number(preset.max_redemptions || 0);
    const activeDays = Number(preset.active_days || 0);
    const startsAt = new Date().toISOString();
    const expiresAt = activeDays > 0 ? addDaysUtcIso(activeDays) : null;
    setForm((prev) => ({
      ...prev,
      code: nextCode,
      benefit_type: preset.benefit_type,
      benefit_json: stringifyBenefit(preset.benefit),
      max_redemptions: maxRedemptions > 0 ? String(maxRedemptions) : '',
      starts_at: toDateTimeLocal(startsAt),
      expires_at: toDateTimeLocal(expiresAt),
      is_active: true
    }));
    setCodePrefix(preset.code_prefix || 'MEGA');
    setNotice(`Preset "${preset.label}" applied to form.`);
  };

  const onCreateCampaign = async () => {
    if (campaignRunning || saving) return;
    setCampaignRunning(true);
    setError('');
    setNotice('');
    try {
      const preset = PROMO_PRESETS.find((item) => item.id === campaignPresetId) || PROMO_PRESETS[0];
      const total = Math.min(100, Math.max(1, Number(campaignCount || 1)));
      const maxRedemptionsValue = String(campaignMaxRedemptions || '').trim();
      const maxRedemptions = maxRedemptionsValue ? Math.max(1, Math.floor(Number(maxRedemptionsValue))) : null;
      const activeDays = Math.max(1, Number(campaignActiveDays || 1));
      const startsAt = new Date().toISOString();
      const expiresAt = addDaysUtcIso(activeDays);
      const prefix = String(campaignCodePrefix || preset.code_prefix || 'MEGA').trim() || 'MEGA';

      let created = 0;
      const createdRows = [];
      for (let i = 0; i < total; i += 1) {
        const payload = {
          code: generatePromoCode(prefix, 8),
          benefit_type: preset.benefit_type,
          benefit: preset.benefit,
          max_redemptions: maxRedemptions,
          per_user_limit: 1,
          starts_at: startsAt,
          expires_at: expiresAt,
          is_active: true
        };
        const createdItem = await api.createPromoCode(payload);
        createdRows.push({
          id: String(createdItem?.id || ''),
          code: payload.code,
          benefit_type: payload.benefit_type,
          benefit: payload.benefit,
          max_redemptions: payload.max_redemptions,
          starts_at: payload.starts_at,
          expires_at: payload.expires_at,
          is_active: payload.is_active,
          preset: preset.label,
          created_at: new Date().toISOString()
        });
        created += 1;
      }
      setCampaignLastBatch(createdRows);
      await loadPromoCodes();
      setNotice(`Campaign created: ${created} promo codes (${preset.label}).`);
    } catch (err) {
      if (err?.status === 401) {
        await logout();
        return;
      }
      setError(resolvePromoAdminErrorMessage(err, 'Failed to generate promo campaign', t));
    } finally {
      setCampaignRunning(false);
    }
  };

  const exportCampaignCsv = () => {
    if (!Array.isArray(campaignLastBatch) || campaignLastBatch.length === 0) return;
    const escapeCsv = (value) => {
      const text = String(value ?? '');
      if (text.includes(',') || text.includes('"') || text.includes('\n')) {
        return `"${text.replace(/"/g, '""')}"`;
      }
      return text;
    };
    const header = [
      'id',
      'code',
      'benefit_type',
      'benefit_json',
      'max_redemptions',
      'starts_at',
      'expires_at',
      'is_active',
      'preset',
      'created_at'
    ];
    const rows = campaignLastBatch.map((item) => [
      item.id,
      item.code,
      item.benefit_type,
      JSON.stringify(item.benefit || {}),
      item.max_redemptions === null ? '' : String(item.max_redemptions ?? ''),
      item.starts_at || '',
      item.expires_at || '',
      item.is_active ? 'true' : 'false',
      item.preset || '',
      item.created_at || ''
    ]);
    const csv = [header, ...rows].map((row) => row.map((value) => escapeCsv(value)).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const link = document.createElement('a');
    link.href = url;
    link.download = `promo-campaign-${stamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const onEdit = (promo) => {
    setEditingId(String(promo?.id || '').trim());
    setForm(toFormFromPromo(promo));
    setError('');
    setNotice('');
  };

  const onToggleActive = async (promo) => {
    setError('');
    setNotice('');
    try {
      await api.updatePromoCode(promo.id, { is_active: !promo.is_active });
      await loadPromoCodes();
    } catch (err) {
      if (err?.status === 401) {
        await logout();
        return;
      }
      setError(resolvePromoAdminErrorMessage(err, t.adminErrorUpdatePromoCode, t));
    }
  };

  const onDelete = async (promo) => {
    if (!window.confirm(t.adminPromoDeleteConfirm.replace('{code}', promo.code))) return;
    setError('');
    setNotice('');
    try {
      await api.deletePromoCode(promo.id);
      if (editingId === promo.id) resetForm();
      await loadPromoCodes();
    } catch (err) {
      if (err?.status === 401) {
        await logout();
        return;
      }
      setError(resolvePromoAdminErrorMessage(err, t.adminErrorDeletePromoCode, t));
    }
  };

  return (
    <>
      <div className="bg-white/90 backdrop-blur rounded-3xl border border-slate-200/80 p-5 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">{t.adminPromoCodesTitle}</h1>
        <p className="text-sm text-slate-500 mt-1">{t.adminPromoCodesSubtitle}</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-2xl p-3 shadow-sm">
          {error}
        </div>
      )}
      {notice && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-2xl p-3 shadow-sm">
          {notice}
        </div>
      )}

      <div className="bg-white/90 backdrop-blur rounded-3xl border border-slate-200/80 p-5 space-y-3 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Promo Campaign Generator</h2>
            <p className="text-sm text-slate-500 mt-1">
              Generate batches for subscription plans, trials, discounts and retention campaigns.
            </p>
            {campaignCreatesPermanentBlock && (
              <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                This preset permanently blocks accounts that redeem the promo code.
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={applyPresetToForm}
            className="pressable px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            Apply to form
          </button>
        </div>

        <div className="grid md:grid-cols-5 gap-3">
          <label className="text-xs text-slate-500">
            Preset
            <select
              value={campaignPresetId}
              onChange={(event) => {
                const nextId = event.target.value;
                const preset = PROMO_PRESETS.find((item) => item.id === nextId);
                setCampaignPresetId(nextId);
                if (preset) {
                  setCampaignCodePrefix(preset.code_prefix);
                  setCampaignMaxRedemptions(String(preset.max_redemptions));
                  setCampaignActiveDays(String(preset.active_days));
                }
              }}
              className="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200/60"
            >
              {PROMO_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>{preset.label}</option>
              ))}
            </select>
          </label>

          <label className="text-xs text-slate-500">
            Codes count
            <input
              type="number"
              min="1"
              max="100"
              value={campaignCount}
              onChange={(event) => setCampaignCount(event.target.value)}
              className="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200/60"
            />
          </label>

          <label className="text-xs text-slate-500">
            Max redemptions/code
            <input
              type="number"
              min="1"
              value={campaignMaxRedemptions}
              onChange={(event) => setCampaignMaxRedemptions(event.target.value)}
              className="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200/60"
            />
          </label>

          <label className="text-xs text-slate-500">
            Active days
            <input
              type="number"
              min="1"
              value={campaignActiveDays}
              onChange={(event) => setCampaignActiveDays(event.target.value)}
              className="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200/60"
            />
          </label>

          <label className="text-xs text-slate-500">
            Code prefix
            <input
              type="text"
              value={campaignCodePrefix}
              onChange={(event) => setCampaignCodePrefix(String(event.target.value || '').toUpperCase())}
              className="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200/60"
            />
          </label>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void onCreateCampaign()}
            disabled={campaignRunning || saving}
            className="pressable px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-medium disabled:opacity-50 hover:bg-slate-800 transition"
          >
            {campaignRunning ? 'Generating campaign...' : 'Generate campaign'}
          </button>
          <div className="text-xs text-slate-500">
            Creates multiple promo codes for plan campaigns in one action.
          </div>
        </div>

        {campaignLastBatch.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-slate-600">
              Last batch: {campaignLastBatch.length} codes ready for export.
            </div>
            <button
              type="button"
              onClick={exportCampaignCsv}
              className="pressable px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-white transition"
            >
              Export CSV
            </button>
          </div>
        )}
      </div>

      <form onSubmit={onSubmit} className="bg-white/90 backdrop-blur rounded-3xl border border-slate-200/80 p-5 space-y-3 shadow-sm">
        <div className="grid md:grid-cols-2 gap-3">
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <input
              type="text"
              value={form.code}
              onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value.toUpperCase() }))}
              placeholder="SAVE20"
              className="border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200/60"
              required
            />
            <button
              type="button"
              onClick={onGenerateCode}
              className="pressable px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              Generate
            </button>
          </div>
          <select
            value={form.benefit_type}
            onChange={(event) => {
              const nextBenefitType = event.target.value;
              setForm((prev) => ({
                ...prev,
                benefit_type: nextBenefitType,
                benefit_json: getBenefitTemplateJson(nextBenefitType)
              }));
            }}
            className="border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200/60"
          >
            {BENEFIT_TYPES.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        <div className="grid md:grid-cols-3 gap-3">
          <label className="text-xs text-slate-500">
            Code prefix
            <input
              type="text"
              value={codePrefix}
              onChange={(event) => setCodePrefix(String(event.target.value || '').toUpperCase())}
              className="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200/60"
              placeholder="MEGA"
            />
          </label>
          <div className="md:col-span-2 text-xs text-slate-500 flex items-end">
            One-click generation creates secure uppercase codes like <span className="font-semibold ml-1">{generatePromoCode(codePrefix, 6)}</span>
          </div>
        </div>

        <textarea
          value={form.benefit_json}
          onChange={(event) => setForm((prev) => ({ ...prev, benefit_json: event.target.value }))}
          placeholder='{"trial_days":30}'
          className="w-full min-h-[160px] border border-slate-300 rounded-xl px-3 py-2 text-sm font-mono bg-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200/60"
          required
        />
        {formCreatesPermanentBlock && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            Warning: this promo permanently blocks the account that redeems it.
          </div>
        )}

        <div className="grid md:grid-cols-4 gap-3">
          <input
            type="number"
            min="1"
            step="1"
            value={form.max_redemptions}
            onChange={(event) => setForm((prev) => ({ ...prev, max_redemptions: event.target.value }))}
            placeholder={t.adminPromoMaxRedemptionsPlaceholder}
            className="border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200/60"
          />
          <input
            type="datetime-local"
            value={form.starts_at}
            onChange={(event) => setForm((prev) => ({ ...prev, starts_at: event.target.value }))}
            className="border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200/60"
          />
          <input
            type="datetime-local"
            value={form.expires_at}
            onChange={(event) => setForm((prev) => ({ ...prev, expires_at: event.target.value }))}
            className="border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200/60"
          />
          <label className="border border-slate-300 rounded-xl px-3 py-2 text-sm flex items-center gap-2 text-slate-700 bg-white">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(event) => setForm((prev) => ({ ...prev, is_active: event.target.checked }))}
            />
            {t.accountStatusActive}
          </label>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={saving}
            className="pressable px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium disabled:opacity-50 hover:bg-blue-500 transition"
          >
            {saving ? t.accountSaving : (editingId ? t.adminUpdatePromoCode : t.adminCreatePromoCode)}
          </button>
        {editingId && (
          <button
            type="button"
            onClick={resetForm}
            className="pressable px-4 py-2 rounded-xl border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
          >
            {t.adminCancelEdit}
          </button>
        )}
      </div>
      </form>

      <div className="bg-white/90 backdrop-blur rounded-3xl border border-slate-200/80 p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">{t.adminAllPromoCodes}</h2>
          <button
            onClick={() => void loadPromoCodes()}
            className="pressable px-3 py-1.5 rounded-xl border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
          >
            {loading ? t.accountLoading : t.accountReload}
          </button>
        </div>

        {codes.length === 0 ? (
          <div className="text-sm text-slate-500 mt-3">{t.adminNoPromoCodes}</div>
        ) : (
          <div className="mt-3 overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-2">{t.accountTableCode}</th>
                  <th className="py-2">{t.adminTableType}</th>
                  <th className="py-2">{t.adminTableUsage}</th>
                  <th className="py-2">{t.adminTableWindow}</th>
                  <th className="py-2">{t.accountTableStatus}</th>
                  <th className="py-2">{t.adminTableActions}</th>
                </tr>
              </thead>
              <tbody>
                {codes.map((promo) => (
                  <tr key={promo.id} className="border-t border-slate-100">
                    <td className="py-2 text-slate-800 font-medium">{promo.code}</td>
                    <td className="py-2 text-slate-700">
                      <div>{promo.benefit_type}</div>
                      {isBlockingBenefitPayload(promo.benefit_type, promo.benefit) && (
                        <div className="inline-block mt-1 rounded-md bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                          PERMANENT ACCOUNT BLOCK
                        </div>
                      )}
                    </td>
                    <td className="py-2 text-slate-700">{limitLabel(promo, t)}</td>
                    <td className="py-2 text-slate-600">
                      <div>{promo.starts_at || '-'}</div>
                      <div>{promo.expires_at || '-'}</div>
                    </td>
                    <td className="py-2 text-slate-700">{promo.is_active ? t.accountStatusActive : t.adminStatusInactive}</td>
                    <td className="py-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onEdit(promo)}
                          className="pressable px-2.5 py-1 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition"
                        >
                          {t.adminEdit}
                        </button>
                        <button
                          onClick={() => void onToggleActive(promo)}
                          className="pressable px-2.5 py-1 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition"
                        >
                          {promo.is_active ? t.adminDisable : t.adminEnable}
                        </button>
                        <button
                          onClick={() => void onDelete(promo)}
                          className="pressable px-2.5 py-1 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 transition"
                        >
                          {t.btnDelete}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
};
