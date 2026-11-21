{{flutter_js}}
{{flutter_build_config}}

// Sanjia IRN Zero-VPN CanvasKit config: load CanvasKit WASM/JS from local /canvaskit/
// instead of gstatic.com CDN so web/PWA boots reliably behind domestic networks.
_flutter.loader.load({
  config: {
    canvasKitBaseUrl: '/canvaskit/',
  },
  serviceWorkerSettings: {
    serviceWorkerVersion: {{flutter_service_worker_version}},
  },
});
