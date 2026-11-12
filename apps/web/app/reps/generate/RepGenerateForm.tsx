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
  business_name: string;
  site_url: string;
  payment_url: string | null;
  payment_error: string | null;
};

const inputClass =
  'w-full bg-cream-50 border border-ink-900/10 rounded-lg px-3 min-h-[48px] text-base focus:outline-none focus:border-amber-accent transition-colors';
const labelClass = 'block text-xs font-semibold text-ink-700 uppercase tracking-wider mb-1.5';
const cardClass = 'bg-white rounded-2xl border border-ink-900/10 p-4';

export function RepGenerateForm() {
  const [businessName, setBusinessName] = useState('');
  const [address, setAddress] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResult | null>(null);

  const businessInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    businessInputRef.current?.focus();
  }, []);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!businessName.trim()) return;
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
      const res = await fetch('/api/reps/places-search', {
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
    setGenerating(true);
    setGenerateError(null);
    setResult(null);
    try {
      const res = await fetch('/api/reps/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ google_place_id: selectedId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGenerateError(data?.error ?? 'generate_failed');
        return;
      }
      setResult(data);
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'generate_failed');
    } finally {
      setGenerating(false);
    }
  }

  function reset() {
    setBusinessName('');
    setAddress('');
    setCandidates(null);
    setSelectedId(null);
    setSearchError(null);
    setResult(null);
    setGenerateError(null);
    businessInputRef.current?.focus();
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSearch} className={`${cardClass} space-y-3`}>
        <div>
          <label htmlFor="biz" className={labelClass}>Business name</label>
          <input
            id="biz"
            ref={businessInputRef}
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="Lucky's Barbershop"
            className={inputClass}
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
          />
        </div>
        <button
          type="submit"
          disabled={searching || !businessName.trim()}
          className="w-full bg-ink-900 text-cream-50 px-4 min-h-[48px] rounded-lg text-base font-medium hover:bg-ink-800 transition-colors disabled:opacity-50"
        >
          {searching ? 'Searching…' : 'Search Google'}
        </button>
        {searchError && <p className="text-sm text-red-700">Search failed: {searchError}</p>}
      </form>

      {candidates && (
        <div className={cardClass}>
          <h2 className="text-xs font-semibold text-ink-700 uppercase tracking-wider mb-3">
            {candidates.length === 0 ? 'No matches' : `Pick a place (${candidates.length})`}
          </h2>
          {candidates.length === 0 ? (
            <p className="text-sm text-ink-700/70">Try refining the business name or adding an address.</p>
          ) : (
            <div className="space-y-2">
              {candidates.map((c) => {
                const selected = selectedId === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    className={`w-full text-left rounded-xl border px-4 py-3 transition-colors ${
                      selected
                        ? 'border-amber-accent bg-amber-accent/10'
                        : 'border-ink-900/10 hover:bg-cream-50'
                    }`}
                  >
                    <div className="font-medium">{c.displayName || '(no name)'}</div>
                    <div className="text-sm text-ink-700/70 mt-0.5">
                      {c.formattedAddress || <span className="italic">Service-area business</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {selectedId && !result && (
        <div className={cardClass}>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="w-full bg-amber-accent text-ink-900 px-4 min-h-[48px] rounded-lg text-base font-semibold hover:brightness-95 transition-all disabled:opacity-50"
          >
            {generating ? 'Generating… (~30s)' : 'Generate site'}
          </button>
          {generateError && <p className="text-sm text-red-700 mt-2">Generate failed: {generateError}</p>}
        </div>
      )}

      {result && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-4">
          <div>
            <div className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Generated</div>
            <div className="font-medium mt-1">{result.business_name}</div>
          </div>

          <div>
            <div className={labelClass}>Preview / claim link</div>
            <input
              readOnly
              value={result.site_url}
              onFocus={(e) => e.currentTarget.select()}
              className="w-full border border-ink-900/10 rounded-lg px-3 py-2.5 text-xs font-mono bg-white"
            />
            <p className="text-xs text-ink-700/60 mt-1">
              Customer sees their site and the claim wizard. Use this for cold outreach.
            </p>
          </div>

          <div>
            <div className={labelClass}>Direct payment link ($99/mo Starter)</div>
            {result.payment_url ? (
              <input
                readOnly
                value={result.payment_url}
                onFocus={(e) => e.currentTarget.select()}
                className="w-full border border-ink-900/10 rounded-lg px-3 py-2.5 text-xs font-mono bg-white"
              />
            ) : (
              <p className="text-sm text-red-700">
                Stripe link failed ({result.payment_error}). The preview/claim link still works.
              </p>
            )}
            <p className="text-xs text-ink-700/60 mt-1">
              Skips the preview, lands the customer on Stripe Checkout. Use for warm leads who already said yes.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(result.site_url)}
              className="border border-ink-900/10 bg-white rounded-lg min-h-[44px] text-sm font-medium"
            >
              Copy preview link
            </button>
            <button
              type="button"
              onClick={() => result.payment_url && navigator.clipboard.writeText(result.payment_url)}
              disabled={!result.payment_url}
              className="border border-ink-900/10 bg-white rounded-lg min-h-[44px] text-sm font-medium disabled:opacity-50"
            >
              Copy payment link
            </button>
          </div>

          <button
            type="button"
            onClick={reset}
            className="w-full border border-ink-900/10 bg-white rounded-lg min-h-[44px] text-sm font-medium"
          >
            Generate another
          </button>
        </div>
      )}
    </div>
  );
}
