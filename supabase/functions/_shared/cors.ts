// Shared CORS handling and JSON response helper for the AI edge functions.

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'apikey, authorization, x-client-info, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/** Builds a JSON response carrying the shared CORS headers. */
export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

/** Answers a CORS preflight request. */
export function handleOptions(): Response {
  return new Response(null, { status: 200, headers: CORS_HEADERS });
}
