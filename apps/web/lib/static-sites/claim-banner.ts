import { CHEAP_BRAND, cheapBrandOrigin, isCheapBrandClient } from '@/lib/marketing-brand';

// Injects the pre-sale "claim this site" bar into a served static-site HTML
// document. Static 'live' bundles serve publicly at the bare host (no ?t=
// token — see resolveStaticServe), so this is the only hook point: we splice a
// self-contained bar into the HTML the browser gets.
//
// Static bundles are arbitrary hand-authored pages, each with its own header —
// commonly `position: sticky; top: 0` (varying class/z-index), sometimes a
// second sticky sub-nav, plus a `position: fixed; bottom: 0` mobile CTA. We
// can't know their selectors, so rather than fight them in CSS we:
//   1. render the bar as `position: fixed; top: 0` with a max z-index, and
//   2. run a tiny script that pushes the body down by the bar height and shifts
//      every TOP-anchored fixed/sticky element down by the same amount, so the
//      site's own header pins right below the bar instead of under it.
// Bottom-anchored elements (top:auto) are left alone. The whole thing is
// wrapped in try/catch and a re-entrancy guard so it can never break a client's
// page. Allowed by the static-site CSP (script-src/style-src 'unsafe-inline').

const MARKER = 'data-sc-claim-banner';

// Per-brand look and copy. Stupid Cheap Websites clients get that brand's bar,
// linking to its own pay page on its own domain.
function bannerTheme(brand: string, clientId: string, platformOrigin: string) {
  const id = encodeURIComponent(clientId);
  return isCheapBrandClient(brand)
    ? { href: `${cheapBrandOrigin()}/pay/${id}`, bg: '#171717', ctaBg: '#f5ff3b', ctaColor: '#171717', radius: '4px', text: `This is your free preview. Launch it for $${CHEAP_BRAND.monthly}/month.`, cta: 'Launch my site →' }
    : { href: `${platformOrigin}/pay/${id}`, bg: '#0f172a', ctaBg: '#f59e0b', ctaColor: '#0f172a', radius: '999px', text: '🚀 This is your free preview — claim it to take your site live.', cta: 'Claim this site →' };
}

function bannerMarkup(clientId: string, platformOrigin: string, brand: string): string {
  const t = bannerTheme(brand, clientId, platformOrigin);
  const href = t.href;
  // No user-controlled strings interpolated into the markup — clientId is a
  // DB uuid, platformOrigin a server constant and the theme fixed strings — so
  // no escaping needed.
  return `<style ${MARKER}>
#sc-claim-banner{position:fixed;top:0;left:0;right:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;gap:.75rem;height:44px;padding:0 1rem;background:${t.bg};color:#fff;text-decoration:none;font-family:system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.2;box-shadow:0 1px 4px rgba(0,0,0,.25);box-sizing:border-box}
#sc-claim-banner .sc-cb-text{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500}
#sc-claim-banner .sc-cb-cta{flex-shrink:0;background:${t.ctaBg};color:${t.ctaColor};padding:.35rem .9rem;border-radius:${t.radius};font-weight:600;font-size:13px;white-space:nowrap}
@media print{#sc-claim-banner{display:none}}
</style>
<a id="sc-claim-banner" href="${href}" ${MARKER}>
<span class="sc-cb-text">${t.text}</span>
<span class="sc-cb-cta">${t.cta}</span>
</a>
<script ${MARKER}>
(function(){try{if(window.__scClaimBanner)return;window.__scClaimBanner=1;var run=function(){try{var b=document.getElementById('sc-claim-banner');if(!b||!document.body)return;var h=b.offsetHeight||44;var body=document.body;var cur=parseFloat(getComputedStyle(body).paddingTop)||0;body.style.paddingTop=(cur+h)+'px';try{document.documentElement.style.scrollPaddingTop=h+'px';}catch(e){}var all=body.querySelectorAll('*');for(var i=0;i<all.length;i++){var el=all[i];if(el===b)continue;var cs=getComputedStyle(el);if((cs.position==='fixed'||cs.position==='sticky')&&cs.top!=='auto'){var t=parseFloat(cs.top);if(isNaN(t))t=0;el.style.top=(t+h)+'px';}}}catch(e){}};if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',run);}else{run();}}catch(e){}})();
</script>`;
}

/**
 * Splice the claim bar into an HTML document. Idempotent-ish: if the marker is
 * already present (shouldn't happen — bundles are authored without it) we skip.
 * Injected just before </body> so the DOM the script walks already exists;
 * falls back to appending when there's no body tag.
 */
export function injectClaimBanner(
  html: string,
  clientId: string,
  platformOrigin: string,
  brand = 'stoopcraft',
): string {
  if (html.includes(MARKER)) return html;
  const markup = bannerMarkup(clientId, platformOrigin, brand);
  const idx = html.toLowerCase().lastIndexOf('</body>');
  if (idx === -1) return html + markup;
  return html.slice(0, idx) + markup + html.slice(idx);
}
