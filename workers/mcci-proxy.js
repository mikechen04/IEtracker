// tiny cors proxy for github pages -> mcci graphql
// api key lives in worker secret (MCCI_API_KEY), not in the browser

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, User-Agent',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    if (request.method !== 'POST') {
      return new Response('POST only', { status: 405, headers: CORS });
    }

    // worker secret first, else forward header from client (local testing)
    const apiKey =
      env.MCCI_API_KEY || request.headers.get('X-API-Key') || '';

    if (!apiKey) {
      return new Response(
        JSON.stringify({ errors: [{ message: 'missing MCCI API key on proxy' }] }),
        { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
      );
    }

    const upstream = await fetch('https://api.mccisland.net/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
        'User-Agent':
          request.headers.get('User-Agent') || 'ie-flipper/1.0 (personal tool)',
      },
      body: await request.text(),
    });

    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: {
        ...CORS,
        'Content-Type': 'application/json',
      },
    });
  },
};
