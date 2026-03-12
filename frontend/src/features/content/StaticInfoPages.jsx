import React from 'react';

export default function StaticInfoPages({
  page,
  t,
  faqItems,
  navigate,
  formatUiDate,
  legalLastUpdated,
  legalWebsite,
  legalContactEmail,
  ui: UI
}) {
  const contactLink = (
    <a href={`mailto:${legalContactEmail}`} className="text-blue-700 hover:underline">
      {legalContactEmail}
    </a>
  );
  void UI;

  switch (page) {
    case 'faq':
      return (
        <UI.Page title={t.pageFaqTitle} subtitle={t.pageFaqSubtitle}>
          <div className="grid md:grid-cols-2 gap-6">
            {faqItems.map((item) => (
              <UI.PageCard key={item.q}>
                <div className="font-semibold">{item.q}</div>
                <div className="text-sm text-slate-600 mt-2">{item.a}</div>
              </UI.PageCard>
            ))}
          </div>
        </UI.Page>
      );

    case 'privacy':
      return (
        <UI.Page title={t.pagePrivacyTitle} subtitle={t.pagePrivacySubtitle}>
          <div className="space-y-6">
            <UI.PageCard className="space-y-3">
              <div className="text-sm text-slate-500">
                <span className="font-semibold">{t.legalLastUpdatedLabel}</span> {formatUiDate(legalLastUpdated)}
              </div>
              <p className="text-sm text-slate-600">{t.privacyIntroText}</p>
              <p className="text-sm text-slate-600">
                <span className="font-semibold">{t.legalWebsiteLabel}</span>{' '}
                <a href={legalWebsite} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline">
                  {legalWebsite}
                </a>
              </p>
              <p className="text-sm text-slate-600">
                <span className="font-semibold">{t.legalContactLabel}</span>{' '}
                {contactLink}
              </p>
            </UI.PageCard>

            <UI.LegalSectionCard title={t.privacySection1Title}>
              <p className="text-sm text-slate-600">{t.privacySection1Desc}</p>
            </UI.LegalSectionCard>
            <UI.LegalSectionCard title={t.privacySection2Title}>
              <p className="text-sm text-slate-600">{t.privacySection2Desc}</p>
            </UI.LegalSectionCard>
            <UI.LegalSectionCard title={t.privacySection3Title}>
              <p className="text-sm text-slate-600">{t.privacySection3Desc}</p>
            </UI.LegalSectionCard>
            <UI.LegalSectionCard title={t.privacySection4Title}>
              <p className="text-sm text-slate-600">{t.privacySection4Desc}</p>
            </UI.LegalSectionCard>
          </div>
        </UI.Page>
      );

    case 'terms':
      return (
        <UI.Page title={t.pageTermsTitle} subtitle={t.pageTermsSubtitle}>
          <div className="space-y-6">
            <UI.PageCard className="space-y-3">
              <div className="text-sm text-slate-500">
                <span className="font-semibold">{t.legalLastUpdatedLabel}</span> {formatUiDate(legalLastUpdated)}
              </div>
              <p className="text-sm text-slate-600">{t.termsIntroText}</p>
            </UI.PageCard>

            <UI.LegalSectionCard title={t.termsSection1Title}>
              <p className="text-sm text-slate-600">{t.termsSection1Desc}</p>
            </UI.LegalSectionCard>
            <UI.LegalSectionCard title={t.termsSection2Title}>
              <p className="text-sm text-slate-600">{t.termsSection2Desc}</p>
            </UI.LegalSectionCard>
            <UI.LegalSectionCard title={t.termsSection3Title}>
              <p className="text-sm text-slate-600">{t.termsSection3Desc}</p>
            </UI.LegalSectionCard>

            <UI.LegalSectionCard title={t.contactGeneralTitle}>
              <p className="text-sm text-slate-600">
                <span className="font-semibold">{t.legalContactLabel}</span>{' '}
                {contactLink}
              </p>
            </UI.LegalSectionCard>
          </div>
        </UI.Page>
      );

    case 'cookie-policy':
      return (
        <UI.Page title={t.pageCookiesTitle} subtitle={t.pageCookiesSubtitle}>
          <div className="space-y-6">
            <UI.PageCard className="space-y-3">
              <div className="text-sm text-slate-500">
                <span className="font-semibold">{t.legalLastUpdatedLabel}</span> {formatUiDate(legalLastUpdated)}
              </div>
              <p className="text-sm text-slate-600">{t.legalSection4Desc}</p>
              <p className="text-sm text-slate-600">{t.cookieText}</p>
            </UI.PageCard>
            <UI.LegalSectionCard title={t.contactGeneralTitle}>
              <p className="text-sm text-slate-600">
                <span className="font-semibold">{t.legalContactLabel}</span>{' '}
                {contactLink}
              </p>
            </UI.LegalSectionCard>
          </div>
        </UI.Page>
      );

    case 'disclaimer':
      return (
        <UI.Page title={t.pageDisclaimerTitle} subtitle={t.pageDisclaimerSubtitle}>
          <div className="space-y-6">
            <UI.LegalSectionCard title={t.pageDisclaimerTitle}>
              <p className="text-sm text-slate-600">{t.disclaimerBody}</p>
            </UI.LegalSectionCard>
          </div>
        </UI.Page>
      );

    case 'legal':
      return (
        <UI.Page title={t.pageLegalTitle} subtitle={t.pageLegalSubtitle}>
          <div className="space-y-6">
            <UI.PageCard className="space-y-3">
              <div className="text-sm text-slate-500">
                <span className="font-semibold">{t.legalLastUpdatedLabel}</span> {formatUiDate(legalLastUpdated)}
              </div>
              <p className="text-sm text-slate-600">{t.legalResourcesIntro}</p>
            </UI.PageCard>

            <div className="grid md:grid-cols-2 gap-6">
              <UI.PageCard className="space-y-3">
                <h3 className="font-semibold text-slate-900">{t.privacySection1Title}</h3>
                <p className="text-sm text-slate-600">{t.privacySection1Desc}</p>
                <UI.Button variant="secondary" onClick={() => navigate('/privacy')}>{t.navPrivacy}</UI.Button>
              </UI.PageCard>
              <UI.PageCard className="space-y-3">
                <h3 className="font-semibold text-slate-900">{t.termsSection1Title}</h3>
                <p className="text-sm text-slate-600">{t.termsSection1Desc}</p>
                <UI.Button variant="secondary" onClick={() => navigate('/terms')}>{t.navTerms}</UI.Button>
              </UI.PageCard>
              <UI.PageCard className="space-y-3">
                <h3 className="font-semibold text-slate-900">{t.legalSection4Title}</h3>
                <p className="text-sm text-slate-600">{t.legalSection4Desc}</p>
                <UI.Button variant="secondary" onClick={() => navigate('/cookie-policy')}>{t.navCookies}</UI.Button>
              </UI.PageCard>
              <UI.PageCard className="space-y-3">
                <h3 className="font-semibold text-slate-900">{t.pageDisclaimerTitle}</h3>
                <p className="text-sm text-slate-600">{t.pageDisclaimerSubtitle}</p>
                <UI.Button variant="secondary" onClick={() => navigate('/disclaimer')}>{t.navDisclaimer}</UI.Button>
              </UI.PageCard>
            </div>

            <UI.LegalSectionCard title={t.legalDataDeletionTitle}>
              <p className="text-sm text-slate-600">
                {t.legalDataDeletionBody}{' '}
                {contactLink}
              </p>
            </UI.LegalSectionCard>
          </div>
        </UI.Page>
      );

    case 'about':
      return (
        <UI.Page title={t.pageAboutTitle} subtitle={t.pageAboutSubtitle}>
          <div className="grid md:grid-cols-2 gap-6">
            <UI.PageCard>
              <div className="font-semibold mb-2">{t.aboutSection1Title}</div>
              <div className="text-sm text-slate-600">{t.aboutSection1Desc}</div>
            </UI.PageCard>
            <UI.PageCard>
              <div className="font-semibold mb-2">{t.aboutSection2Title}</div>
              <div className="text-sm text-slate-600">{t.aboutSection2Desc}</div>
            </UI.PageCard>
            <UI.PageCard>
              <div className="font-semibold mb-2">{t.aboutSection3Title}</div>
              <div className="text-sm text-slate-600">{t.aboutSection3Desc}</div>
            </UI.PageCard>
            <UI.PageCard>
              <div className="font-semibold mb-2">{t.aboutSection4Title}</div>
              <div className="text-sm text-slate-600">{t.aboutSection4Desc}</div>
            </UI.PageCard>
          </div>
        </UI.Page>
      );

    case 'contact':
      return (
        <UI.Page title={t.pageContactTitle} subtitle={t.pageContactSubtitle}>
          <div className="grid md:grid-cols-2 gap-6">
            <UI.LegalSectionCard title={t.contactGeneralTitle}>
              <p className="text-sm text-slate-600">{t.contactGeneralIntro}</p>
              <p className="text-sm text-slate-600">
                <span className="font-semibold">{t.legalContactLabel}</span>{' '}
                {contactLink}
              </p>
              <p className="text-sm text-slate-600">{t.contactResponseTime}</p>
            </UI.LegalSectionCard>

            <UI.LegalSectionCard title={t.contactPrivacyChecklistTitle}>
              <p className="text-sm text-slate-600">{t.contactPrivacyChecklistIntro}</p>
              <UI.LegalList
                items={[
                  t.contactPrivacyChecklistItem1,
                  t.contactPrivacyChecklistItem2,
                  t.contactPrivacyChecklistItem3
                ]}
              />
              <p className="text-sm text-slate-600">{t.contactThanks}</p>
            </UI.LegalSectionCard>
          </div>
        </UI.Page>
      );

    case 'mission':
      return (
        <UI.Page title="Mission" subtitle="Build the most secure and intelligent file workspace on the web.">
          <div className="grid md:grid-cols-2 gap-6">
            <UI.PageCard>
              <div className="font-semibold mb-2">What we build</div>
              <div className="text-sm text-slate-600">Conversion, automation, observability and trust in one platform.</div>
            </UI.PageCard>
            <UI.PageCard>
              <div className="font-semibold mb-2">How we build</div>
              <div className="text-sm text-slate-600">Reliability-first architecture with transparent status and explainable AI.</div>
            </UI.PageCard>
          </div>
        </UI.Page>
      );

    case 'careers':
      return (
        <UI.Page title="Careers" subtitle="Join the team building enterprise-grade file infrastructure.">
          <UI.PageCard>
            <div className="text-sm text-slate-600">Open roles: Product Engineer, Platform Engineer, Security Engineer.</div>
            <div className="mt-3 text-sm text-slate-600">Send portfolio and CV to {contactLink}.</div>
          </UI.PageCard>
        </UI.Page>
      );

    case 'press':
      return (
        <UI.Page title="Press Kit" subtitle="Brand assets, product screenshots, and company facts for media.">
          <div className="grid md:grid-cols-2 gap-6">
            <UI.PageCard>
              <div className="font-semibold mb-2">Assets</div>
              <div className="text-sm text-slate-600">Logos, screenshots, and product overview available on request.</div>
            </UI.PageCard>
            <UI.PageCard>
              <div className="font-semibold mb-2">Media Contact</div>
              <div className="text-sm text-slate-600">{contactLink}</div>
            </UI.PageCard>
          </div>
        </UI.Page>
      );

    case 'resources':
      return (
        <UI.Page title="Resources" subtitle="Documentation, guides, roadmap and security materials.">
          <div className="grid md:grid-cols-2 gap-6">
            {[
              { title: 'API Docs', path: '/api' },
              { title: 'Developer Portal', path: '/developer-portal' },
              { title: 'Roadmap', path: '/roadmap' },
              { title: 'Changelog', path: '/changelog' },
              { title: 'Status', path: '/status' },
              { title: 'Security Whitepaper', path: '/security-whitepaper' },
              { title: 'Bug Bounty', path: '/bug-bounty' },
              { title: 'Help Center', path: '/faq' }
            ].map((item) => (
              <UI.PageCard key={item.title}>
                <div className="font-semibold">{item.title}</div>
                <UI.Button className="mt-3" variant="secondary" onClick={() => navigate(item.path)}>Open</UI.Button>
              </UI.PageCard>
            ))}
          </div>
        </UI.Page>
      );

    case 'bug-bounty':
      return (
        <UI.Page title="Bug Bounty" subtitle="Responsible disclosure process for security researchers.">
          <UI.PageCard>
            <div className="text-sm text-slate-600">Report vulnerabilities to {contactLink}. Include reproduction steps, impact and proof of concept.</div>
          </UI.PageCard>
        </UI.Page>
      );

    case 'security-whitepaper':
      return (
        <UI.Page title="Security Whitepaper" subtitle="Processing model, encryption and retention controls.">
          <UI.PageCard>
            <div className="text-sm text-slate-600">Request PDF whitepaper from security team. Includes architecture, controls, and incident process.</div>
            <UI.Button className="mt-3" onClick={() => navigate('/contact')}>Request whitepaper</UI.Button>
          </UI.PageCard>
        </UI.Page>
      );

    default:
      return null;
  }
}
