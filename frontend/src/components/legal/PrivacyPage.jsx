import React from 'react';
import LegalPageLayout from './LegalPageLayout.jsx';

export default function PrivacyPage() {
  return (
    <LegalPageLayout
      title="Privacy Policy"
      updatedAt="March 13, 2026"
    >
      <p>
        This Privacy Policy explains how MegaConvert handles information when you use our
        website, browser-based conversion tools, account features, and related workflows.
      </p>

      <h2>Information We Collect</h2>
      <p>
        We may collect account details you provide directly, such as name, email address,
        login activity, support requests, and product interaction metadata. Depending on
        the feature, we may also process technical signals such as browser type, device
        diagnostics, referral source, or event analytics.
      </p>

      <h2>Local-First Processing</h2>
      <p>
        Many MegaConvert experiences are designed to run locally in your browser using
        WASM and on-device AI. When a workflow runs fully client-side, your source files
        may never be uploaded to our servers. Where server-side endpoints are involved,
        only the minimum information needed to provide the feature should be transmitted.
      </p>

      <h2>How We Use Information</h2>
      <ul>
        <li>To authenticate users and secure accounts.</li>
        <li>To deliver requested tools and workflows.</li>
        <li>To prevent fraud, abuse, and policy violations.</li>
        <li>To improve reliability, performance, and product quality.</li>
        <li>To comply with legal, regulatory, and sanctions obligations.</li>
      </ul>

      <h2>Cookies and Local Storage</h2>
      <p>
        MegaConvert may use cookies, browser storage, and similar mechanisms to preserve
        sessions, remember language preferences, restore local workflow state, and improve
        the overall product experience.
      </p>

      <h2>Sharing</h2>
      <p>
        We do not sell your personal information. We may share information with service
        providers, infrastructure partners, or legal authorities where necessary to operate
        the service, protect rights and safety, investigate abuse, or comply with law.
      </p>

      <h2>Retention</h2>
      <p>
        We retain information only for as long as reasonably necessary to operate the
        service, maintain security, satisfy legal obligations, resolve disputes, and enforce
        our agreements.
      </p>

      <h2>Security</h2>
      <p>
        We use reasonable technical and organizational measures designed to protect the
        information we process. No method of storage or transmission is completely secure,
        so we cannot guarantee absolute security.
      </p>

      <h2>Your Choices</h2>
      <p>
        You may be able to update account information, control browser storage, disable
        certain permissions, or stop using the service at any time. Depending on your
        jurisdiction, you may also have additional statutory privacy rights.
      </p>

      <h2>International Compliance</h2>
      <p>
        We may process information as needed to comply with export controls, sanctions,
        anti-fraud screening, and regional access restrictions that apply to MegaConvert.
      </p>

      <h2>Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. If we make material changes,
        we may revise the date above and provide additional notice where appropriate.
      </p>

      <h2>Contact</h2>
      <p>
        If you have privacy questions, please contact us through the support or contact
        channels available within MegaConvert.
      </p>
    </LegalPageLayout>
  );
}
