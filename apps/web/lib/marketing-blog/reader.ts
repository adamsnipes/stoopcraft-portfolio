import { createReader } from '@keystatic/core/reader';
import keystaticConfig from '@/keystatic.config';

// Keystatic Reader — server-only. Reads the committed Markdoc files at request
// time (this whole app is force-dynamic for the nonce CSP, so there is no build
// step to read from). `process.cwd()` is apps/web when `next` runs from this
// package; on Vercel the .mdoc files are shipped into the function bundle via
// `outputFileTracingIncludes` in next.config.ts.
//
// This module is inherently server-only — it touches the filesystem via
// process.cwd(). Only import it from server components, route handlers, and
// sitemap.ts, never from a 'use client' component.
export const reader = createReader(process.cwd(), keystaticConfig);
