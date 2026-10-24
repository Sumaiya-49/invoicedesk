// Talks to the AI providers. Both use the OpenAI-style "chat completions" format,
// so the same code works for Groq and Gemini; only the URL, key and model change.
// If the first provider fails (limit reached, down, slow), the next one is tried.

const PROVIDERS = [
  {
    name: 'Groq',
    url: () => process.env.GROQ_URL || 'https://api.groq.com/openai/v1/chat/completions',
    key: () => process.env.GROQ_API_KEY,
    model: () => process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
    extra: { reasoning_effort: 'low' }, // fewer "thinking" tokens = faster and stays inside free limits
  },
  {
    name: 'Gemini',
    url: () => process.env.GEMINI_URL || 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    key: () => process.env.GEMINI_API_KEY,
    model: () => process.env.GEMINI_MODEL || 'gemini-flash-lite-latest',
    extra: {},
  },
];

export class AIUnavailableError extends Error {}

export const configuredProviders = () => PROVIDERS.filter((p) => p.key()).map((p) => p.name);

const TIMEOUT_MS = 20000;

/** Sends the conversation + tool list to the first provider that answers. Returns { message, provider }. */
export async function chatCompletion(messages, tools) {
  const providers = PROVIDERS.filter((p) => p.key());
  if (!providers.length) throw new AIUnavailableError('No AI provider key is configured');

  const problems = [];
  for (const p of providers) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(p.url(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${p.key()}` },
        body: JSON.stringify({
          model: p.model(),
          messages,
          tools: tools.length ? tools : undefined,
          tool_choice: tools.length ? 'auto' : undefined,
          temperature: 0.2,
          max_completion_tokens: 1200,
          ...p.extra,
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = await res.text();
        problems.push(`${p.name} ${res.status}: ${body.slice(0, 200)}`);
        continue; // e.g. 429 = free limit reached -> try the next provider
      }
      const json = await res.json();
      const message = json.choices?.[0]?.message;
      if (!message) { problems.push(`${p.name}: empty response`); continue; }
      return { message, provider: p.name };
    } catch (err) {
      problems.push(`${p.name}: ${err.name === 'AbortError' ? 'timed out' : err.message}`);
    } finally {
      clearTimeout(timer);
    }
  }
  console.warn('AI providers failed:', problems.join(' | '));
  throw new AIUnavailableError('All AI providers failed');
}
