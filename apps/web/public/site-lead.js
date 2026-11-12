/*
 * Lead capture — shared client snippet for static (uploaded) client
 * sites. Those sites are served from R2 as files only (no API on their own
 * host), so a same-origin POST to /api/contact 405s. This snippet posts the
 * lead cross-origin to the platform API instead. It is HOSTED (not baked into
 * each site) so endpoint/transport changes are made here ONCE and every client
 * site picks them up on next load — no re-uploading individual sites.
 *
 * What it does:
 *   - Derives the API origin from where THIS script was loaded (its <script
 *     src>), so there's no hardcoded domain to keep in sync.
 *   - Sends the visitor's CURRENT host as `site_host`, so the server resolves
 *     the client by slug or custom_domain. This works on the temp domain AND
 *     after the domain is flipped to the client's own — nothing to change.
 *   - Returns a Promise<boolean> (delivered or not) so each page keeps its own
 *     success message / fallback UX.
 *
 * Usage on a client page (load it from the origin of the brand the site was
 * sold under; leads post back to that same origin):
 *   <script src="https://<brand origin>/site-lead.js"></script>
 *   SiteLead.submit({ name: '...', phone: '...', email: '...',
 *                      source: 'contact_form', message: '...' })
 *     .then(function (ok) { ...show success, or fall back to mailto... });
 *
 * This file is public on every brand domain, so it names none of them. It is
 * the brand-neutral copy of /lead-capture.js, which existing sites load under
 * its original global name; keep the two submit() bodies in sync.
 */
(function () {
  var current = document.currentScript;
  var apiBase;
  try {
    // currentScript is null when the script is injected dynamically; fall back
    // to finding our own tag.
    var tag = current || document.querySelector('script[src*="/site-lead.js"]');
    apiBase = new URL(tag.src).origin;
  } catch (e) {
    apiBase = window.location.origin;
  }

  function submit(payload) {
    var body = {};
    for (var k in payload) {
      if (Object.prototype.hasOwnProperty.call(payload, k)) body[k] = payload[k];
    }
    // Dynamic — reflects whatever domain the visitor loaded (temp or custom).
    body.site_host = window.location.host;
    // Honeypot default so the server's spam check passes for real visitors.
    if (!('website' in body)) body.website = '';

    return fetch(apiBase + '/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then(function (r) {
        return r.ok;
      })
      .catch(function () {
        return false;
      });
  }

  window.SiteLead = { submit: submit, apiBase: apiBase };
})();
