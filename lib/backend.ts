// Calls the FastAPI backend (Render) from the server, adding the secret API key.
// The key lives only in server environment variables and is never sent to the browser.

export interface BackendResult {
  status: number;
  data: any;
}

export async function callBackend(path: string, body: unknown): Promise<BackendResult> {
  const base = process.env.BACKEND_URL?.replace(/\/+$/, '');
  const key = process.env.DASHBOARD_API_KEY;
  if (!base || !key) {
    return { status: 500, data: { error: 'Server is missing BACKEND_URL or DASHBOARD_API_KEY' } };
  }

  const controller = new AbortController();
  // Render free instances can take about a minute to wake up, so allow for that.
  const timer = setTimeout(() => controller.abort(), 60_000);
  try {
    const res = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': key },
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: 'no-store',
    });
    const text = await res.text();
    let parsed: any = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
    if (!res.ok) {
      const detail = parsed?.detail;
      const message =
        typeof detail === 'string'
          ? detail
          : Array.isArray(detail)
            ? detail.map((d: any) => d?.msg).filter(Boolean).join('; ')
            : text.slice(0, 300) || `Backend error ${res.status}`;
      return { status: res.status, data: { error: message } };
    }
    return { status: res.status, data: parsed ?? {} };
  } catch (e) {
    const aborted = e instanceof Error && e.name === 'AbortError';
    return { status: 502, data: { error: aborted ? 'The backend took too long to respond' : 'Could not reach the backend' } };
  } finally {
    clearTimeout(timer);
  }
}
