'use client';

import { useState, useRef } from 'react';

export function ContactForm() {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('sending');
    const data = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        setStatus('sent');
        formRef.current?.reset();
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  }

  const inputStyle = {
    borderColor: 'color-mix(in srgb, var(--color-text) 25%, transparent)',
    color: 'var(--color-text)',
  };

  if (status === 'sent') {
    return (
      <div className="flex flex-col justify-center space-y-3">
        <p className="text-2xl font-semibold" style={{ color: 'var(--color-text)' }}>
          Message sent!
        </p>
        <p style={{ color: 'var(--color-text)', opacity: 0.7 }}>
          We&apos;ll be in touch soon.
        </p>
        <button
          onClick={() => setStatus('idle')}
          className="self-start text-sm underline underline-offset-4"
          style={{ color: 'var(--color-accent)' }}
        >
          Send another
        </button>
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label
          className="block text-xs font-semibold uppercase tracking-widest mb-2"
          htmlFor="contact-name"
          style={{ color: 'var(--color-accent)' }}
        >
          Name
        </label>
        <input
          id="contact-name"
          name="name"
          type="text"
          required
          className="w-full border-0 border-b-2 px-0 py-2.5 text-base bg-transparent focus:outline-none transition-colors"
          style={inputStyle}
        />
      </div>
      <div>
        <label
          className="block text-xs font-semibold uppercase tracking-widest mb-2"
          htmlFor="contact-phone"
          style={{ color: 'var(--color-accent)' }}
        >
          Phone
        </label>
        <input
          id="contact-phone"
          name="phone"
          type="tel"
          className="w-full border-0 border-b-2 px-0 py-2.5 text-base bg-transparent focus:outline-none transition-colors"
          style={inputStyle}
        />
      </div>
      <div>
        <label
          className="block text-xs font-semibold uppercase tracking-widest mb-2"
          htmlFor="contact-message"
          style={{ color: 'var(--color-accent)' }}
        >
          Message
        </label>
        <textarea
          id="contact-message"
          name="message"
          rows={4}
          required
          className="w-full border-0 border-b-2 px-0 py-2.5 text-base bg-transparent focus:outline-none resize-none transition-colors"
          style={inputStyle}
        />
      </div>
      {status === 'error' && (
        <p className="text-sm" style={{ color: '#dc2626' }}>
          Something went wrong. Please try again or give us a call.
        </p>
      )}
      <button
        type="submit"
        disabled={status === 'sending'}
        className="px-10 py-4 font-semibold text-base tracking-wide transition-all hover:opacity-90 hover:shadow-lg disabled:opacity-60"
        style={{
          background: 'var(--color-primary)',
          color: '#fff',
          borderRadius: 'var(--radius)',
        }}
      >
        {status === 'sending' ? 'Sending…' : 'Send Message'}
      </button>
    </form>
  );
}
