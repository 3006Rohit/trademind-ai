export default async function handler(req, res) {
  const { url } = req;
  // Extract the path after /api/yahoo/
  const path = url.replace(/^\/api\/yahoo\/?/, '');
  const targetUrl = `https://query1.finance.yahoo.com/${path}`;

  try {
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
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
    console.error('Yahoo proxy error:', error);
    res.status(500).json({ error: 'Failed to fetch from Yahoo Finance' });
  }
}
