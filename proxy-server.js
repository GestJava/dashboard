/* ============================================
   CORS / X-Frame-Options Bypass Proxy Server
   ============================================
   
   Lightweight Node.js proxy that strips X-Frame-Options
   and Content-Security-Policy headers from responses,
   allowing any website to be embedded in an iframe.

   Usage:
     1. Run: node proxy-server.js
     2. Access: http://localhost:3001/proxy?url=https://target-site.com
     3. Use the proxied URL as the iframe src in the dashboard

   WARNING: This proxy is for internal/local use only.
   Do NOT expose it to the public internet.
   ============================================ */

const http = require('http');
const https = require('https');
const url = require('url');

const PORT = 3001;
const HOST = '0.0.0.0';

function proxyRequest(targetUrl, res) {
  const parsed = url.parse(targetUrl);
  const protocol = parsed.protocol === 'https:' ? https : http;

  const options = {
    hostname: parsed.hostname,
    port: parsed.port,
    path: parsed.path,
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'identity'
    },
    timeout: 15000
  };

  const proxyReq = protocol.request(options, (proxyRes) => {
    // Clone headers but strip X-Frame-Options and CSP
    const headers = { ...proxyRes.headers };
    const headersToRemove = [
      'x-frame-options',
      'content-security-policy',
      'content-security-policy-report-only',
      'x-content-type-options'
    ];
    headersToRemove.forEach(h => {
      delete headers[h];
      // Also try capitalized versions
      Object.keys(headers).forEach(key => {
        if (key.toLowerCase() === h) delete headers[key];
      });
    });

    // Add CORS headers
    headers['Access-Control-Allow-Origin'] = '*';
    headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = '*';
    
    // Remove content-encoding to avoid decompression issues
    delete headers['content-encoding'];

    // Handle redirects
    if ([301, 302, 303, 307, 308].includes(proxyRes.statusCode)) {
      const location = proxyRes.headers.location;
      if (location) {
        const absoluteUrl = location.startsWith('http')
          ? location
          : `${parsed.protocol}//${parsed.hostname}${location}`;
        res.writeHead(302, { 'Location': `/proxy?url=${encodeURIComponent(absoluteUrl)}` });
        res.end();
        return;
      }
    }

    res.writeHead(proxyRes.statusCode, headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error(`[Proxy Error] ${err.message}`);
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end(`Proxy error: ${err.message}`);
  });

  proxyReq.on('timeout', () => {
    proxyReq.destroy();
    res.writeHead(504, { 'Content-Type': 'text/plain' });
    res.end('Proxy timeout');
  });

  proxyReq.end();
}

const server = http.createServer((req, res) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': '*'
    });
    res.end();
    return;
  }

  const parsed = url.parse(req.url, true);

  // Health check
  if (parsed.pathname === '/' || parsed.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'running',
      service: 'Command Center Proxy',
      port: PORT,
      usage: 'GET /proxy?url=https://target-site.com'
    }));
    return;
  }

  // Proxy endpoint
  if (parsed.pathname === '/proxy') {
    const targetUrl = parsed.query.url;
    if (!targetUrl) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Missing "url" query parameter. Usage: /proxy?url=https://example.com');
      return;
    }

    try {
      const decoded = decodeURIComponent(targetUrl);
      console.log(`[Proxy] ${decoded}`);
      proxyRequest(decoded, res);
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end(`Invalid URL: ${err.message}`);
    }
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found. Use /proxy?url=TARGET_URL');
});

server.listen(PORT, HOST, () => {
  console.log(`\n🛡️  Command Center Proxy Server`);
  console.log(`   Running on http://localhost:${PORT}`);
  console.log(`   Usage: http://localhost:${PORT}/proxy?url=https://target-site.com\n`);
});
