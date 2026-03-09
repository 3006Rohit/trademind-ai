export default async function handler(req, res) {
  const { url } = req;
  // Extract the path after /api/binance/
  const path = url.replace(/^\/api\/binance\/?/, '');
  const targetUrl = `https://api.binance.com/${path}`;

  try {
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'Accept': 'application/json',
      },
    });

    const data = await response.text();

    // Forward CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'application/json');

    res.status(response.status).send(data);
  } catch (error) {
    console.error('Binance proxy error:', error);
    res.status(500).json({ error: 'Failed to fetch from Binance' });
  }
}
