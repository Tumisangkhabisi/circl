// Environment-specific settings. Swap this file per environment (dev / staging / prod).
// Never put secrets here: it is served to every visitor.
window.CIRCL_CONFIG = {
  apiBase: '/api/v1',      // same-origin is recommended (cookies + CSRF just work). Absolute URL allowed if CORS is configured.
  timeoutMs: 15000,
  pageSize: 10,
  maxText: 500,
  maxUploadMB: 10,
  notifPollMs: 60000
};
