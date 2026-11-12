import { randomBytes } from 'crypto';

/**
 * Generate a URL-safe slug from a business name.
 * Appends a random 8-char hex suffix to prevent enumeration attacks.
 * Example: "John's Barber Shop" → "johns-barber-shop-a3f9b2c1"
 */
export function generateSlug(businessName: string): string {
  let base = businessName
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')   // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

  if (!base) base = 'business';

  const suffix = randomBytes(4).toString('hex');
  return `${base}-${suffix}`;
}
