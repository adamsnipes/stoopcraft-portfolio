'use client';

import { useState } from 'react';

export function CopyClaimLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex items-center gap-2 mt-4 pt-4 border-t">
      <input
        readOnly
        value={url}
        className="flex-1 border rounded px-3 py-1.5 text-xs text-gray-600 bg-gray-50 font-mono truncate"
      />
      <button
        type="button"
        onClick={handleCopy}
        className="border rounded px-4 py-1.5 text-sm hover:bg-gray-50 whitespace-nowrap"
      >
        {copied ? 'Copied!' : 'Copy claim link'}
      </button>
    </div>
  );
}
