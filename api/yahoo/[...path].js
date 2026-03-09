export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  // Extract everything after /api/yahoo/ (including query string)
  const fullUrl = req.url || '';
  const stripped = fullUrl.replace(/^\/api\/yahoo\/?/, '');
  const targetUrl = `https://query1.finance.yahoo.com/${stripped}`;

  console.log('[Yahoo Proxy] Forwarding to:', targetUrl);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const data = await response.text();

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');

    return res.status(response.status).send(data);
  } catch (error) {
    console.error('[Yahoo Proxy] Error:', error.message || error);
    return res.status(502).json({ error: 'Yahoo Finance proxy failed', details: error.message });
  }
}
