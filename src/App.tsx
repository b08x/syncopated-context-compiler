import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { GraphProvider } from './contexts/GraphContext';
import { ProviderProvider } from './contexts/ProviderContext';
import { AppShell } from './components/layout/AppShell';
import { DashboardView } from './components/dashboard/DashboardView';
import { ImportWizard } from './components/import/ImportWizard';
import { ReviewView } from './components/review/ReviewView';
import { GraphExplorer } from './components/graph/GraphExplorer';
import { TrajectoryCompiler } from './components/trajectory/TrajectoryCompiler';
import { SkillDistiller } from './components/distillation/SkillDistiller';
import { ExportPanel } from './components/export/ExportPanel';
import { SettingsView } from './components/settings/SettingsView';

export default function App() {
  return (
    <ProviderProvider>
      <GraphProvider>
        <BrowserRouter>
          <AppShell>
            <Routes>
              <Route path="/" element={<DashboardView />} />
              <Route path="/import" element={<ImportWizard />} />
              <Route path="/review" element={<ReviewView />} />
              <Route path="/graph" element={<GraphExplorer />} />
              <Route path="/distill" element={
                <div className="h-full overflow-auto">
                  <TrajectoryCompiler />
                  <div className="border-t border-zinc-200 my-8" />
                  <SkillDistiller />
                </div>
              } />
              <Route path="/export" element={<ExportPanel />} />
              <Route path="/settings" element={<SettingsView />} />
            </Routes>
          </AppShell>
        </BrowserRouter>
      </GraphProvider>
    </ProviderProvider>
  );
}
