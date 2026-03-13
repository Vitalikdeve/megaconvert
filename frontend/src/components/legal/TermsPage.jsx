import React from 'react';
import LegalPageLayout from './LegalPageLayout.jsx';

export default function TermsPage() {
  return (
    <LegalPageLayout
      title="Terms of Service"
      updatedAt="March 13, 2026"
    >
      <p>
        These Terms of Service govern your access to and use of MegaConvert, including
        our local-first file conversion tools, document workflows, AI-assisted features,
        and direct device-to-device handoff experiences.
      </p>

      <h2>Acceptance of Terms</h2>
      <p>
        By accessing or using MegaConvert, you agree to be bound by these Terms. If you
        do not agree, you must not use the service.
      </p>

      <h2>Eligibility and Accounts</h2>
      <p>
        You must use MegaConvert only in compliance with applicable law and only if you
        have legal capacity to enter into these Terms. You are responsible for maintaining
        the confidentiality of your account credentials and for activity occurring under
        your account.
      </p>

      <h2>Permitted Use</h2>
      <p>
        You may use MegaConvert for lawful file processing, document editing, OCR,
        compression, and related workflows. You may not use the service to violate
        intellectual property rights, distribute unlawful content, evade security controls,
        or interfere with the platform or other users.
      </p>

      <h2>Local Processing and Output</h2>
      <p>
        Many MegaConvert features operate locally in the browser using WASM, AI models,
        and device-native capabilities. You remain responsible for the source files you
        process and for verifying the accuracy, legality, and fitness of any generated
        output before relying on it.
      </p>

      <h2>Geographic Restrictions &amp; Compliance</h2>
      <p>
        MegaConvert is not available for use in sanctioned or embargoed regions, or by
        persons ordinarily resident in or using the service from such regions, including
        Russia, China, Iran, North Korea, Syria, and Cuba.
      </p>
      <p>
        For clarity, Belarus is expressly permitted and is not treated as a restricted
        jurisdiction under this policy. We may suspend or terminate access where required
        for sanctions compliance, export controls, anti-abuse obligations, or other legal
        risk management.
      </p>

      <h2>Service Availability</h2>
      <p>
        We may modify, suspend, or discontinue features at any time, including for
        security, maintenance, legal compliance, infrastructure migration, or product
        evolution. We do not guarantee uninterrupted availability.
      </p>

      <h2>Disclaimers</h2>
      <p>
        MegaConvert is provided on an &quot;as is&quot; and &quot;as available&quot; basis.
        To the maximum extent permitted by law, we disclaim warranties of merchantability,
        fitness for a particular purpose, non-infringement, and uninterrupted service.
      </p>

      <h2>Limitation of Liability</h2>
      <p>
        To the fullest extent permitted by law, MegaConvert and its operators will not be
        liable for indirect, incidental, special, consequential, exemplary, or punitive
        damages, or for any loss of data, revenue, profits, or goodwill arising from your
        use of the service.
      </p>

      <h2>Termination</h2>
      <p>
        We may suspend or terminate your access if we believe you violated these Terms,
        created legal or security risk, or used the service in a way that harms the
        platform, our partners, or other users.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these Terms may be directed through the product support channels
        made available in MegaConvert.
      </p>
    </LegalPageLayout>
  );
}
