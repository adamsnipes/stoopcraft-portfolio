'use client';

import { useEffect, useRef, useState } from 'react';

type Candidate = {
  id: string;
  displayName: string;
  formattedAddress: string;
};

type GenerateResult = {
  success: true;
  client_id: string;
  slug: string;
  url: string;
  short_url: string;
  business_name: string;
};

export function GenerateForm({ niches }: { niches: readonly string[] }) {
  const [businessName, setBusinessName] = useState('');
  const [address, setAddress] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [niche, setNiche] = useState<string>('barber');
  const [industryLabel, setIndustryLabel] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [copied, setCopied] = useState(false);

  const businessInputRef = useRef<HTMLInputElement>(null);
  const candidatesRef = useRef<HTMLDivElement>(null);
  const stepThreeRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    businessInputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (candidates && candidates.length > 0) {
      candidatesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [candidates]);

  useEffect(() => {
    if (selectedId) {
      stepThreeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [selectedId]);

  useEffect(() => {
    if (result) {
      resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [result]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!businessName.trim()) return;
    (document.activeElement as HTMLElement | null)?.blur();
    setSearching(true);
    setSearchError(null);
    setCandidates(null);
    setSelectedId(null);
    setResult(null);
    setGenerateError(null);
    try {
      const textQuery = address.trim()
        ? `${businessName.trim()} ${address.trim()}`
        : businessName.trim();
      const res = await fetch('/api/admin/places-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ textQuery, address: address.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSearchError(data?.error ?? 'search_failed');
        return;
      }
      const places: Candidate[] = data.places ?? [];
      setCandidates(places);
      if (places.length === 1) setSelectedId(places[0]!.id);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'search_failed');
    } finally {
      setSearching(false);
    }
  }

  async function handleGenerate() {
    if (!selectedId) return;
    if (niche === 'other' && industryLabel.trim().length < 2) {
      setGenerateError('industry_label required for "other"');
      return;
    }
    (document.activeElement as HTMLElement | null)?.blur();
    setGenerating(true);
    setGenerateError(null);
    setResult(null);
    try {
      const body: Record<string, string> = { google_place_id: selectedId, niche };
      if (niche === 'other') body.industry_label = industryLabel.trim();
      const res = await fetch('/api/admin/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        const detail = data?.error === 'duplicate_place_id'
          ? `Already exists (client ${data.client_id})`
          : data?.error === 'duplicate_phone'
            ? `Phone already on file (client ${data.client_id})`
            : (data?.error ?? 'generate_failed');
        setGenerateError(detail);
        return;
      }
      setResult(data);
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'generate_failed');
    } finally {
      setGenerating(false);
    }
  }

  async function copyUrl(url: string) {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function reset() {
    setBusinessName('');
    setAddress('');
    setCandidates(null);
    setSelectedId(null);
    setSearchError(null);
    setResult(null);
    setGenerateError(null);
    setIndustryLabel('');
    setNiche('barber');
    businessInputRef.current?.focus();
  }

  // base classes — text-base (16px) keeps iOS from auto-zooming on focus,
  // and min-h-[48px] hits the comfortable Apple/Material tap target.
  const inputClass =
    'w-full bg-cream-50 border border-ink-900/10 rounded-lg px-3 min-h-[48px] text-base focus:outline-none focus:border-amber-accent transition-colors';
  const labelClass = 'block text-xs font-semibold text-ink-700 uppercase tracking-wider mb-1.5';
  const cardClass = 'bg-white rounded-2xl border border-ink-900/10 p-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)]';

  return (
    <div className="space-y-4 pb-24 sm:pb-0">
      {/* Step 1 — search */}
      <form onSubmit={handleSearch} className={`${cardClass} space-y-3`}>
        <div>
          <label htmlFor="biz" className={labelClass}>Business name</label>
          <input
            id="biz"
            ref={businessInputRef}
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="Forefeathers"
            className={inputClass}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="words"
            spellCheck={false}
            inputMode="text"
            enterKeyHint="search"
            required
          />
        </div>
        <div>
          <label htmlFor="addr" className={labelClass}>
            Address <span className="text-ink-700/60 font-normal normal-case">(optional)</span>
          </label>
          <input
            id="addr"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Brooklyn, NY"
            className={inputClass}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="words"
            spellCheck={false}
            inputMode="text"
            enterKeyHint="search"
          />
        </div>
        <button
          type="submit"
          disabled={searching || !businessName.trim()}
          className="w-full bg-ink-900 text-cream-50 px-4 min-h-[48px] rounded-lg text-base font-medium active:bg-ink-800 sm:hover:bg-ink-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {searching ? 'Searching…' : 'Search Google'}
        </button>
        {searchError && (
          <p className="text-sm text-red-700">Search failed: {searchError}</p>
        )}
      </form>

      {/* Step 2 — pick a candidate */}
      {candidates && (
        <div ref={candidatesRef} className={cardClass}>
          <h2 className="text-xs font-semibold text-ink-700 uppercase tracking-wider mb-3">
            {candidates.length === 0 ? 'No matches' : `Pick a place (${candidates.length})`}
          </h2>
          {candidates.length === 0 ? (
            <p className="text-sm text-ink-700/70">
              Try refining the business name or adding an address.
            </p>
          ) : (
            <div className="space-y-2">
              {candidates.map((c) => {
                const selected = selectedId === c.id;
                const mapsQuery = encodeURIComponent(c.displayName || c.formattedAddress || c.id);
                const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}&query_place_id=${c.id}`;
                return (
                  <div key={c.id} className="relative">
                    <button
                      type="button"
                      onClick={() => setSelectedId(c.id)}
                      className={`w-full text-left rounded-xl border px-4 py-3.5 transition-colors active:scale-[0.99] ${
                        selected
                          ? 'border-amber-accent bg-amber-accent/10'
                          : 'border-ink-900/10 active:bg-cream-50 sm:hover:border-ink-900/20 sm:hover:bg-cream-50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          aria-hidden
                          className={`mt-1 inline-block w-4 h-4 rounded-full border-2 shrink-0 ${
                            selected
                              ? 'border-amber-accent bg-amber-accent'
                              : 'border-ink-900/20'
                          }`}
                        />
                        <div className="min-w-0 flex-1 pr-24">
                          <div className="font-medium truncate">{c.displayName || '(no name)'}</div>
                          <div className="text-sm text-ink-700/70 mt-0.5 break-words">
                            {c.formattedAddress || <span className="italic">Service area business</span>}
                          </div>
                        </div>
                      </div>
                    </button>
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute top-3 right-3 inline-flex items-center gap-1 text-xs text-ink-700/60 hover:text-ink-900 underline-offset-2 hover:underline"
                    >
                      View on Google
                      <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" aria-hidden>
                        <path d="M6 3h7v7M13 3 6 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </a>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Step 3 — niche + generate */}
      {selectedId && (
        <div ref={stepThreeRef} className={`${cardClass} space-y-3`}>
          <div>
            <label htmlFor="niche" className={labelClass}>Niche</label>
            <select
              id="niche"
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              className={inputClass}
            >
              {niches.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>

          {niche === 'other' && (
            <div>
              <label htmlFor="industry" className={labelClass}>Industry label</label>
              <input
                id="industry"
                value={industryLabel}
                onChange={(e) => setIndustryLabel(e.target.value)}
                placeholder="e.g. piano tuner"
                className={inputClass}
                autoCapitalize="words"
                autoCorrect="off"
                spellCheck={false}
              />
            </div>
          )}

          {/* Inline desktop generate button — on mobile a sticky one shows below. */}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="hidden sm:block w-full bg-amber-accent text-ink-900 px-4 min-h-[48px] rounded-lg text-base font-semibold hover:brightness-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating ? 'Generating… (~30s)' : 'Generate site'}
          </button>
          {generateError && (
            <p className="text-sm text-red-700">Generate failed: {generateError}</p>
          )}
        </div>
      )}

      {/* Result */}
      {result && (
        <div
          ref={resultRef}
          className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-3"
        >
          <div>
            <div className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
              Generated
            </div>
            <div className="font-medium mt-1 break-words">{result.business_name}</div>
            <div className="text-xs font-mono text-ink-700/70 break-all">{result.slug}</div>
          </div>
          <div className="space-y-2">
            <input
              readOnly
              value={result.url}
              onFocus={(e) => e.currentTarget.select()}
              className="w-full border border-ink-900/10 rounded-lg px-3 py-2.5 text-xs font-mono bg-white"
            />
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => copyUrl(result.url)}
                className="border border-ink-900/10 bg-white rounded-lg min-h-[48px] text-sm font-medium active:bg-cream-50"
              >
                {copied ? 'Copied' : 'Copy URL'}
              </button>
              <a
                href={result.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center bg-ink-900 text-cream-50 rounded-lg min-h-[48px] text-sm font-medium active:bg-ink-800"
              >
                Open site
              </a>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <a
                href={`/admin/clients/${result.client_id}`}
                className="flex items-center justify-center border border-ink-900/10 bg-white rounded-lg min-h-[48px] text-sm font-medium active:bg-cream-50"
              >
                Open in admin
              </a>
              <button
                type="button"
                onClick={reset}
                className="border border-ink-900/10 bg-white rounded-lg min-h-[48px] text-sm font-medium active:bg-cream-50"
              >
                Generate another
              </button>
            </div>
          </div>
          <div className="text-xs font-mono text-ink-700/60 break-all">
            Short: {result.short_url}
          </div>
        </div>
      )}

      {/* Mobile sticky CTA — only while step 3 is unlocked and there's no result yet. */}
      {selectedId && !result && (
        <div className="sm:hidden fixed inset-x-0 bottom-0 z-20 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] bg-gradient-to-t from-cream-50 via-cream-50/95 to-cream-50/0">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="w-full bg-amber-accent text-ink-900 px-4 min-h-[52px] rounded-xl text-base font-semibold active:brightness-95 shadow-[0_4px_16px_rgba(0,0,0,0.08)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating ? 'Generating… (~30s)' : 'Generate site'}
          </button>
        </div>
      )}
    </div>
  );
}
