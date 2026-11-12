import type { Metadata } from 'next';
import { KNOWN_NICHES } from '@/lib/content-gen/generate';
import { GenerateForm } from './GenerateForm';

export const metadata: Metadata = { title: 'Generate' };

export default function AdminGeneratePage() {
  const niches = [...KNOWN_NICHES, 'other'] as const;
  return (
    <div className="max-w-xl mx-auto">
      <header className="mb-5 sm:mb-8">
        <h1 className="font-display text-2xl sm:text-3xl font-light tracking-tight">Generate</h1>
        <p className="text-sm text-ink-700 mt-1">
          Search a business on Google, then generate a site on the fly.
        </p>
      </header>
      <GenerateForm niches={niches as readonly string[]} />
    </div>
  );
}
