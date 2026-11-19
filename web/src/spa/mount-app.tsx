import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { DesktopSimulatorApp } from './DesktopSimulatorApp';

const rootEl = document.getElementById('mockza-spa-root');
if (rootEl) {
  createRoot(rootEl).render(
    <StrictMode>
      <DesktopSimulatorApp />
    </StrictMode>,
  );
}
