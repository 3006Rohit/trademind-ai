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

  // Extract the path after /api/yahoo/
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api\/yahoo\/?/, '');
  const queryString = url.search; // includes the '?'
  const targetUrl = `https://query1.finance.yahoo.com/${path}${queryString}`;

  console.log('[Yahoo Proxy] Forwarding to:', targetUrl);

  try {
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    const data = await response.text();

    return new Response(data, {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 's-maxage=30, stale-while-revalidate=60',
      },
    });
  } catch (error) {
    console.error('[Yahoo Proxy] Error:', error.message || error);
    return new Response(
      JSON.stringify({ error: 'Yahoo Finance proxy failed', details: error.message }),
      {
        status: 502,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      }
    );
  }
};

export const config = {
  path: "/api/yahoo/*",
};
