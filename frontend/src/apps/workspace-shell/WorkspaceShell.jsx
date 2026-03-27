import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Temporary placeholders for workspace screens.
const DashboardView = () => <div className="p-6">Dashboard (WIP)</div>;
const ChatView = () => <div className="p-6">Messages (WIP)</div>;

export default function WorkspaceShell() {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#0b1020] text-white">
      <div className="hidden w-[340px] shrink-0 border-r border-white/10 bg-white/5 lg:block">
        <div className="p-4 text-sm text-white/50">Sidebar Placeholder</div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center border-b border-white/10 bg-white/5 px-4 py-3">
          <div className="text-sm text-white/50">Topbar Placeholder</div>
        </header>

        <main className="min-h-0 flex-1 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.05),transparent_40%)]">
          <Routes>
            <Route path="/" element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<DashboardView />} />
            <Route path="messages" element={<ChatView />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
