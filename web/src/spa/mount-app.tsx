import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { DesktopSimulatorApp } from './DesktopSimulatorApp';
import { preloadRouteForPathname } from './router';
import { ensureCatalogSynced, readSwrCatalogPacks } from './swr-cache';

const rootEl = document.getElementById('mockza-spa-root');

if (rootEl) {
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '/app/home';
  // Start bootstrap + active route chunk in parallel before first React mount so the
  // static HTML app shell stays visible until the real workspace can render in 1 frame.
  const bootstrapPromise = import('@/composition/bootstrap');
  const routeChunkPromise = preloadRouteForPathname(pathname);

  void Promise.all([bootstrapPromise, routeChunkPromise]).then(([bootstrapMod]) => {
    const deps = bootstrapMod.createAppDependencies();
    if (
      (pathname.startsWith('/app/practice') || pathname === '/app/home' || pathname === '/app' || pathname === '/app/') &&
      readSwrCatalogPacks(deps.catalog, deps.edition).length === 0
    ) {
      void ensureCatalogSynced(deps.catalog, deps.edition);
    }
    createRoot(rootEl).render(
      <StrictMode>
        <DesktopSimulatorApp dependencies={deps} />
      </StrictMode>,
    );
  });
}
