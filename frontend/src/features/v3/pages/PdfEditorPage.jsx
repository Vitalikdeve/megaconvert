import React from 'react';
import { FileStack, Layers, ShieldCheck } from 'lucide-react';
import PdfEditorTool from '../../tools/PdfEditorTool.jsx';
import WorkspaceModuleShell from '../components/WorkspaceModuleShell.jsx';

export default function PdfEditorPage() {
  return (
    <WorkspaceModuleShell
      eyebrow="PDF / Assembly"
      title="Compose polished PDF packs in one visual lane."
      description="Drop multiple PDFs, inspect their first pages, reorder your bundle mentally and merge them into a single export without leaving the browser."
      badges={['pdf-lib', 'Preview first page', 'Local merge']}
      metrics={[
        { label: 'Engine', value: 'pdf-lib', icon: FileStack, note: 'Client-side merge' },
        { label: 'Preview', value: 'Live', icon: Layers, note: 'First-page cards' },
        { label: 'Privacy', value: 'Local', icon: ShieldCheck, note: 'No upload required' }
      ]}
      asideCards={[
        {
          eyebrow: 'Batch mindset',
          title: 'Build document stacks visually',
          copy: 'This module is tuned for fast “merge and export” workflows instead of generic file management.',
          icon: Layers
        },
        {
          eyebrow: 'Why it matters',
          title: 'Local PDF confidence',
          copy: 'Sensitive reports, invoices and scans can be assembled in the browser without routing them through a remote processing queue.',
          icon: ShieldCheck
        }
      ]}
    >
      <PdfEditorTool />
    </WorkspaceModuleShell>
  );
}
