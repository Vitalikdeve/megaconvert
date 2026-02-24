import React, { useCallback, useEffect, useState } from 'react';
import { useAdminAuth } from '../auth/useAdminAuth';
import { useAdminI18n } from '../i18n/AdminI18nContext';

const BENEFIT_TYPES = [
  'percent_discount',
  'trial_days',
  'lifetime_access',
  'credits',
  'feature_access'
];

const BENEFIT_DEFAULTS_BY_TYPE = {
  percent_discount: { percent: 20 },
  trial_days: { trial_days: 30 },
  lifetime_access: { plan: 'individual', lifetime: true },
  credits: { credits: 100 },
  feature_access: { features: ['beta_converter'], scope: 'global' }
};

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
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <h1 className="text-2xl font-semibold text-slate-900">{t.adminPromoCodesTitle}</h1>
        <p className="text-sm text-slate-500 mt-1">{t.adminPromoCodesSubtitle}</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-3">
          {error}
        </div>
      )}
      {notice && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-xl p-3">
          {notice}
        </div>
      )}

      <form onSubmit={onSubmit} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
        <div className="grid md:grid-cols-2 gap-3">
          <input
            type="text"
            value={form.code}
            onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value.toUpperCase() }))}
            placeholder="SAVE20"
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
            required
          />
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
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
          >
            {BENEFIT_TYPES.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        <textarea
          value={form.benefit_json}
          onChange={(event) => setForm((prev) => ({ ...prev, benefit_json: event.target.value }))}
          placeholder='{"trial_days":30}'
          className="w-full min-h-[160px] border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono"
          required
        />

        <div className="grid md:grid-cols-4 gap-3">
          <input
            type="number"
            min="1"
            step="1"
            value={form.max_redemptions}
            onChange={(event) => setForm((prev) => ({ ...prev, max_redemptions: event.target.value }))}
            placeholder={t.adminPromoMaxRedemptionsPlaceholder}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
          <input
            type="datetime-local"
            value={form.starts_at}
            onChange={(event) => setForm((prev) => ({ ...prev, starts_at: event.target.value }))}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
          <input
            type="datetime-local"
            value={form.expires_at}
            onChange={(event) => setForm((prev) => ({ ...prev, expires_at: event.target.value }))}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
          <label className="border border-slate-300 rounded-lg px-3 py-2 text-sm flex items-center gap-2 text-slate-700">
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
          className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium disabled:opacity-50"
        >
          {saving ? t.accountSaving : (editingId ? t.adminUpdatePromoCode : t.adminCreatePromoCode)}
        </button>
        {editingId && (
          <button
            type="button"
            onClick={resetForm}
            className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium hover:bg-slate-50"
          >
            {t.adminCancelEdit}
          </button>
        )}
      </div>
      </form>

      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">{t.adminAllPromoCodes}</h2>
          <button
            onClick={() => void loadPromoCodes()}
            className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm font-medium hover:bg-slate-50"
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
                    <td className="py-2 text-slate-700">{promo.benefit_type}</td>
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
                          className="px-2.5 py-1 rounded border border-slate-300 hover:bg-slate-50"
                        >
                          {t.adminEdit}
                        </button>
                        <button
                          onClick={() => void onToggleActive(promo)}
                          className="px-2.5 py-1 rounded border border-slate-300 hover:bg-slate-50"
                        >
                          {promo.is_active ? t.adminDisable : t.adminEnable}
                        </button>
                        <button
                          onClick={() => void onDelete(promo)}
                          className="px-2.5 py-1 rounded border border-red-200 text-red-700 hover:bg-red-50"
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
