import Anthropic from '@anthropic-ai/sdk';
import {
  regeneratedCopySchema,
  sanitizeRegeneratedCopy,
  type RegeneratedCopy,
} from './schema';
import { getNicheProfile, type Niche } from './generate';

const anthropic = new Anthropic();

// ============================================================================
// Tone-hint regeneration
//
// Called from the admin dashboard when the operator (or a client on a call)
// asks for a different copy direction without changing palette/fonts/style.
// LLM rewrites only hero / about / services. Theme is locked. ~$0.02/call.
// ============================================================================

export type RegenerateCopyInput = {
  business_name: string;
  niche: Niche;
  city: string;
  state: string;
  industry_label?: string | null; // for niche='other'
  // The current site state — passed so the LLM can see what it's rewriting
  // and the user can ask for things like "keep the headline" or "shorten about".
  current: RegeneratedCopy;
  // Locked theme info — surfaced in the prompt so voice matches the visual style.
  current_style: string;
  // Free-form operator/client guidance.
  tone_hint: string;
};

export async function regenerateCopy(input: RegenerateCopyInput): Promise<RegeneratedCopy> {
  const profile = getNicheProfile(input.niche);
  const industryDisplay =
    input.niche === 'other' && input.industry_label
      ? input.industry_label.toLowerCase()
      : input.niche.replace('_', ' ');

  const systemPrompt = `You are rewriting landing-page copy for an existing local business website. The site's visual style is LOCKED — your only job is the words.

Output MUST be valid JSON matching this exact structure — no other text, no markdown fences:
{
  "hero": {
    "headline": "...",
    "headline_emphasis": "...",
    "subheadline": "...",
    "cta_text": "..."
  },
  "about": { "title": "...", "body": "..." },
  "services": [ { "name": "...", "description": "...", "price": "..." } ]
}

═══ LOCKED CONTEXT (do not change) ═══

The site is a ${industryDisplay} in ${input.city}, ${input.state} called "${input.business_name}".
The visual style is "${input.current_style}". Your copy voice MUST match this style.

═══ NICHE COPY DIRECTION ═══
${profile.copy}

═══ COPY VOICE ═══

Headlines — short, declarative, specific. Ideal: 4–8 words.
  GOOD: "Sharp Cuts in Bed-Stuy" / "Detailing That Stops Traffic"
  BAD: "Welcome to Our Shop" / "Quality You Can Trust"

headline_emphasis — for editorial/luxe styles, pick ONE word from the headline that the template will italicize. The word must literally appear in the headline. For bold/premium-dark/service-tech styles, OMIT the field entirely (do not include the key — never use empty string "").

Subheadlines — one concrete reason a customer would care. Not a tagline.

About body — write like the business owner talking, not a marketing department. Short sentences. Concrete over abstract.

Service descriptions — tell what's included, not how great it is.

CTA text — action verbs only. HARD MAX 20 characters including spaces.

═══ HARD CONSTRAINTS ═══
- NO HTML tags. Plain text only.
- NO URLs, email addresses, or phone numbers.
- hero.headline: 5–80 characters
- hero.headline_emphasis: 2–30 chars AND must literally appear in hero.headline (or omit)
- hero.subheadline: 10–160 characters
- hero.cta_text: 2–20 characters
- about.body: 50–800 characters. No fake testimonials.
- 2–8 services, each name ≤50 chars, description ≤200 chars, price ≤40 chars
- Keep the SAME number of services as the current site (${input.current.services.length}) unless the operator's request explicitly says otherwise.
- NO superlatives: "best", "finest", "premier", "#1", "top-rated"
- NO unverifiable claims: years in business, number of customers, awards
- NO "welcome to" / "we pride ourselves" / "your trusted partner"`;

  const userPrompt = `Current copy:
${JSON.stringify(input.current, null, 2)}

Operator request:
"""
${input.tone_hint.trim()}
"""

Rewrite the copy to address that request. Keep what works; only change what the request asks you to. Output ONLY the JSON object.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('regenerateCopy: no text in response');
  }

  const raw = textBlock.text
    .trim()
    .replace(/^```(?:json)?\n?/, '')
    .replace(/\n?```$/, '')
    .trim();

  const parsed: unknown = JSON.parse(raw);
  const validated = regeneratedCopySchema.parse(parsed);
  return sanitizeRegeneratedCopy(validated);
}
