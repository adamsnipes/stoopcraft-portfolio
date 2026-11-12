import { describe, expect, it } from 'vitest';
import { injectClaimBanner } from '../../apps/web/lib/static-sites/claim-banner';

const ID = '0b5f1c3e-1d2a-4c8e-9f00-123456789abc';
const page = '<html><body><h1>Site</h1></body></html>';

describe('static-site claim banner per brand', () => {
  it('keeps the StoopCraft banner and pay link for StoopCraft clients', () => {
    const html = injectClaimBanner(page, ID, 'https://stoopcraft.com');
    expect(html).toContain(`href="https://stoopcraft.com/pay/${ID}"`);
    expect(html).toContain('Claim this site');
  });
  it('gives Stupid Cheap Websites clients their own banner and pay page, with no StoopCraft link', () => {
    const html = injectClaimBanner(page, ID, 'https://stoopcraft.com', 'stupid-cheap-websites');
    expect(html).toMatch(new RegExp(`href="[^"]*/pay/${ID}"`));
    expect(html).toContain('Launch it for $40/month');
    expect(html.toLowerCase()).not.toContain('stoopcraft');
  });
});
