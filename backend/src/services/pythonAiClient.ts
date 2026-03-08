/**
 * Optional integration with the Python AI service (ai/ folder).
 * When AI_SERVICE_URL is set, the backend can forward chat to the Python service.
 * Falls back to the built-in Node chatbot if the service is unavailable.
 */

const AI_SERVICE_URL = (process.env.AI_SERVICE_URL || '').replace(/\/$/, '');

export function isPythonAiEnabled(): boolean {
  return AI_SERVICE_URL.length > 0;
}

/**
 * Call the Python AI service /chat?q=... and return the answer as reply text.
 * Returns null if the service is disabled, unreachable, or errors.
 */
export async function chatViaPythonAi(message: string): Promise<string | null> {
  if (!AI_SERVICE_URL) return null;
  try {
    const url = `${AI_SERVICE_URL}/chat?q=${encodeURIComponent(message)}`;
    const res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const data = (await res.json()) as { answer?: string };
    return typeof data.answer === 'string' ? data.answer : null;
  } catch {
    return null;
  }
}
