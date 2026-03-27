import React, { Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

const LegacyApp = React.lazy(() => import('./apps/legacy-app/App.jsx'));
const WorkspaceShell = React.lazy(() => import('./apps/workspace-shell/WorkspaceShell.jsx'));

const GlobalLoader = () => (
  <div className="flex h-screen w-full items-center justify-center bg-[#050816] text-white">
    <div className="animate-pulse text-sm text-white/50">Загрузка рабочего пространства...</div>
  </div>
);

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<GlobalLoader />}>
        <Routes>
          <Route path="/app/*" element={<WorkspaceShell />} />
          <Route path="/*" element={<LegacyApp />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
