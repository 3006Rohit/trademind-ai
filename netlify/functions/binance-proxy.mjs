export default async (req, context) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  // Extract the path after /api/binance/
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api\/binance\/?/, '');
  const queryString = url.search; // includes the '?'
  const targetUrl = `https://api.binance.com/${path}${queryString}`;

  console.log('[Binance Proxy] Forwarding to:', targetUrl);

  try {
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    const data = await response.text();

    return new Response(data, {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 's-maxage=10, stale-while-revalidate=30',
      },
    });
  } catch (error) {
    console.error('[Binance Proxy] Error:', error.message || error);
    return new Response(
      JSON.stringify({ error: 'Binance proxy failed', details: error.message }),
      {
        status: 502,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      }
    );
  }
};

export const config = {
  path: "/api/binance/*",
};
