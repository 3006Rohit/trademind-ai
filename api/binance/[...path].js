export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  // Extract everything after /api/binance/ (including query string)
  const fullUrl = req.url || '';
  const stripped = fullUrl.replace(/^\/api\/binance\/?/, '');
  const targetUrl = `https://api.binance.com/${stripped}`;

  console.log('[Binance Proxy] Forwarding to:', targetUrl);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const data = await response.text();

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=30');

    return res.status(response.status).send(data);
  } catch (error) {
    console.error('[Binance Proxy] Error:', error.message || error);
    return res.status(502).json({ error: 'Binance proxy failed', details: error.message });
  }
}
