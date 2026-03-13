import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { CONVERSIONS, getConversionBySlug, getRelatedConversions } from './seo/conversions';

const upsertMeta = (name, content) => {
  if (!content) return;
  let tag = document.querySelector(`meta[name="${name}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute('name', name);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
};

const upsertProperty = (property, content) => {
  if (!content) return;
  let tag = document.querySelector(`meta[property="${property}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute('property', property);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
};

const upsertLink = (rel, href, hreflang = '') => {
  if (!href) return;
  const selector = hreflang
    ? `link[rel="${rel}"][hreflang="${hreflang}"]`
    : `link[rel="${rel}"]:not([hreflang])`;
  let tag = document.head.querySelector(selector);
  if (!tag) {
    tag = document.createElement('link');
    tag.setAttribute('rel', rel);
    if (hreflang) tag.setAttribute('hreflang', hreflang);
    document.head.appendChild(tag);
  }
  tag.setAttribute('href', href);
};

const upsertJsonLd = (data) => {
  const id = 'seo-jsonld';
  let tag = document.getElementById(id);
  if (!tag) {
    tag = document.createElement('script');
    tag.type = 'application/ld+json';
    tag.id = id;
    document.head.appendChild(tag);
  }
  tag.textContent = JSON.stringify(data);
};

const setDocumentTitle = (value) => {
  if (typeof document !== 'undefined') {
    document.title = value;
  }
};

export default function SeoPage({ slug, onSelectTool, onNavigate, isToolAvailable }) {
  const { t } = useTranslation();
  const conversion = getConversionBySlug(slug);
  const related = conversion ? getRelatedConversions(conversion.category, conversion.slug, 8) : [];
  const toolAvailable = conversion ? (isToolAvailable ? isToolAvailable(conversion.id) : true) : false;

  useEffect(() => {
    if (!conversion) {
      setDocumentTitle(t('seoPage.defaultMetaTitle'));
      upsertMeta('description', t('seoPage.defaultMetaDescription'));
      return;
    }
    const origin = window.location.origin;
    const canonicalUrl = `${origin}/convert/${conversion.slug}`;
    const localeAlternates = ['en', 'es', 'de'];
    const title = t('seoPage.metaTitle', { from: conversion.from, to: conversion.to });
    const desc = t('seoPage.metaDescription', { from: conversion.from, to: conversion.to });
    setDocumentTitle(title);
    upsertMeta('description', desc);
    upsertMeta('robots', 'index,follow,max-image-preview:large');
    upsertProperty('og:title', title);
    upsertProperty('og:description', desc);
    upsertProperty('og:type', 'website');
    upsertProperty('og:url', canonicalUrl);
    upsertLink('canonical', canonicalUrl);
    upsertLink('alternate', canonicalUrl, 'x-default');
    for (const locale of localeAlternates) {
      upsertLink('alternate', `${origin}/${locale}/convert/${conversion.slug}`, locale);
    }
    upsertJsonLd([
      {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: t('seoPage.metaTitle', { from: conversion.from, to: conversion.to }),
        applicationCategory: 'UtilityApplication',
        operatingSystem: 'Web',
        description: desc,
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD'
        }
      },
      {
        '@context': 'https://schema.org',
        '@type': 'HowTo',
        name: t('seoPage.howToTitle', { from: conversion.from, to: conversion.to }),
        step: [
          { '@type': 'HowToStep', name: t('seoPage.howToUpload', { from: conversion.from }) },
          { '@type': 'HowToStep', name: t('seoPage.howToConvert', { to: conversion.to }) },
          { '@type': 'HowToStep', name: t('seoPage.howToDownload') }
        ]
      },
      {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: t('seoPage.faqFreeQuestion', { from: conversion.from, to: conversion.to }),
            acceptedAnswer: {
              '@type': 'Answer',
              text: t('seoPage.faqFreeAnswer')
            }
          },
          {
            '@type': 'Question',
            name: t('seoPage.faqSpeedQuestion'),
            acceptedAnswer: {
              '@type': 'Answer',
              text: t('seoPage.faqSpeedAnswer')
            }
          },
          {
            '@type': 'Question',
            name: t('seoPage.faqSafetyQuestion'),
            acceptedAnswer: {
              '@type': 'Answer',
              text: t('seoPage.faqSafetyAnswer')
            }
          }
        ]
      }
    ]);
  }, [conversion, t]);

  if (!conversion) {
    return (
      <div className="pt-32 pb-20 px-4 max-w-5xl mx-auto">
        <h1 className="text-4xl font-bold mb-4">{t('seoPage.notFoundTitle')}</h1>
        <p className="text-slate-600 mb-6">{t('seoPage.notFoundSubtitle')}</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {CONVERSIONS.slice(0, 12).map((c) => (
            <button
              key={c.slug}
              onClick={() => onNavigate(`/convert/${c.slug}`)}
              className="bg-white border rounded-2xl p-4 text-left hover:shadow-md transition"
            >
              <div className="font-semibold">{c.from} → {c.to}</div>
              <div className="text-xs text-slate-500 mt-1">{t('seoPage.openConverter')}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="pt-32 pb-20 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="mb-10">
          <p className="text-sm uppercase tracking-widest text-slate-500">{t('seoPage.brand')}</p>
          <h1 className="text-5xl font-extrabold mt-2">{t('seoPage.heroTitle', { from: conversion.from, to: conversion.to })}</h1>
          <p className="text-slate-600 text-lg mt-4">
            {t('seoPage.heroSubtitle', { from: conversion.from, to: conversion.to })}
          </p>
          <div className="flex flex-wrap gap-3 mt-6">
            <button
              onClick={() => {
                if (toolAvailable) {
                  onSelectTool(conversion.id);
                  onNavigate('/');
                  return;
                }
                onNavigate('/tools');
              }}
              className="px-6 py-3 rounded-xl bg-slate-900 text-white font-semibold"
            >
              {toolAvailable ? t('seoPage.convertNow') : t('seoPage.browseConverters')}
            </button>
            <button
              onClick={() => onNavigate('/')}
              className="px-6 py-3 rounded-xl border border-slate-200 text-slate-700 font-semibold"
            >
              {t('seoPage.backHome')}
            </button>
          </div>
          {!toolAvailable && (
            <div className="mt-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              {t('seoPage.toolAvailabilityNote')}
            </div>
          )}
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <div className="bg-white border rounded-2xl p-5">
            <div className="font-semibold mb-2">{t('seoPage.howItWorksTitle')}</div>
            <ol className="text-sm text-slate-600 list-decimal pl-5 space-y-1">
              <li>{t('seoPage.stepUpload', { from: conversion.from })}</li>
              <li>{t('seoPage.stepSettings')}</li>
              <li>{t('seoPage.stepDownload', { to: conversion.to })}</li>
            </ol>
          </div>
          <div className="bg-white border rounded-2xl p-5">
            <div className="font-semibold mb-2">{t('seoPage.whyTitle')}</div>
            <ul className="text-sm text-slate-600 list-disc pl-5 space-y-1">
              <li>{t('seoPage.whyItem1')}</li>
              <li>{t('seoPage.whyItem2')}</li>
              <li>{t('seoPage.whyItem3')}</li>
            </ul>
          </div>
          <div className="bg-white border rounded-2xl p-5">
            <div className="font-semibold mb-2">{t('seoPage.supportedFormatsTitle')}</div>
            <div className="text-sm text-slate-600">
              {conversion.from} → {conversion.to}
            </div>
          </div>
        </div>

        <div className="bg-slate-50 border rounded-2xl p-6 mb-12">
          <h2 className="text-2xl font-bold mb-3">{t('seoPage.faqTitle')}</h2>
          <div className="space-y-4 text-sm text-slate-700">
            <div>
              <div className="font-semibold">{t('seoPage.faqCardFreeQuestion')}</div>
              <div>{t('seoPage.faqCardFreeAnswer')}</div>
            </div>
            <div>
              <div className="font-semibold">{t('seoPage.faqCardSpeedQuestion')}</div>
              <div>{t('seoPage.faqCardSpeedAnswer')}</div>
            </div>
            <div>
              <div className="font-semibold">{t('seoPage.faqCardSafetyQuestion')}</div>
              <div>{t('seoPage.faqCardSafetyAnswer')}</div>
            </div>
          </div>
        </div>

        {related.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold mb-4">{t('seoPage.relatedTitle')}</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {related.map((c) => (
                <button
                  key={c.slug}
                  onClick={() => onNavigate(`/convert/${c.slug}`)}
                  className="bg-white border rounded-2xl p-4 text-left hover:shadow-md transition"
                >
                  <div className="font-semibold">{c.from} → {c.to}</div>
                  <div className="text-xs text-slate-500 mt-1">{t('seoPage.openConverter')}</div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
