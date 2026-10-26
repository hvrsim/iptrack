// One initial document-load event, not SPA page views or sessions. A stable ID
// makes retries and repeated script tags idempotent for the document.
export const collectorScript = `(() => {
  try {
    const current = document.currentScript;
    const projectId = current && current.getAttribute("data-project-id");
    if (!projectId) return;
    const registry = window.__iptrackDocuments || (window.__iptrackDocuments = {});
    if (registry[projectId]) return;
    registry[projectId] = true;
    const payload = JSON.stringify({projectId, eventId: crypto.randomUUID(), timestamp: Date.now()});
    const endpoint = new URL("/events", current.src).toString();
    const send = async (attempt = 0) => {
      try {
        const response = await fetch(endpoint, {
          method: "POST", headers: {"content-type": "application/json"},
          body: payload, keepalive: true, credentials: "omit",
        });
        if (!response.ok && response.status >= 500 && attempt < 2) setTimeout(() => send(attempt + 1), 1000 * (attempt + 1));
        else if (!response.ok) console.warn("IP Track: event rejected (" + response.status + "). Check your project installation diagnostics.");
      } catch { if (attempt < 2) setTimeout(() => send(attempt + 1), 1000 * (attempt + 1)); }
    };
    void send();
  } catch { /* Tracking must not break the host page. */ }
})();`;
