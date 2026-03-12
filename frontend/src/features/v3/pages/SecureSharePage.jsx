import React from 'react';
import { QrCode, ShieldCheck, Wifi } from 'lucide-react';
import MegaDrop from '../components/MegaDrop.jsx';
import WorkspaceModuleShell from '../components/WorkspaceModuleShell.jsx';

export default function SecureSharePage({ preparedFile = null, onPreparedFileConsumed = null }) {
  return (
    <WorkspaceModuleShell
      eyebrow="MegaDrop / Direct Share"
      title="Beam files directly between devices."
      description="Create a room, hand off a QR or 6-digit code, and move media over a direct WebRTC channel without parking the file on the server."
      badges={['WebRTC P2P', 'QR handoff', '64 KB chunk stream']}
      metrics={[
        { label: 'Transfer', value: 'P2P', icon: Wifi, note: 'Direct device channel' },
        { label: 'Privacy', value: 'Local', icon: ShieldCheck, note: 'No file relay storage' },
        { label: 'Invite', value: 'QR', icon: QrCode, note: 'Second-device onboarding' }
      ]}
      asideCards={[
        {
          eyebrow: 'How it feels',
          title: 'AirDrop for any device',
          copy: 'Laptop to Android, desktop to iPhone, browser to browser. The room is just the handshake; the file goes device to device.',
          icon: Wifi
        },
        {
          eyebrow: 'Prepared asset',
          title: preparedFile ? preparedFile.name : 'Ready for next output',
          copy: preparedFile
            ? 'A freshly prepared file was pushed into MegaDrop from the conversion flow and is ready to share.'
            : 'As soon as a conversion finishes, MegaConvert can hand the result into this module automatically.',
          icon: QrCode
        }
      ]}
    >
      <MegaDrop initialFile={preparedFile} onInitialFileConsumed={onPreparedFileConsumed} />
    </WorkspaceModuleShell>
  );
}
