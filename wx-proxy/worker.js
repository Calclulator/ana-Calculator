// Cloudflare Worker: JMA PDF プロキシ
// デプロイ先: https://dashboard.cloudflare.com → Workers & Pages → Create Worker
// 想定 URL: https://ana-wx-proxy.nomadic-tamuzo00.workers.dev

addEventListener('fetch', function(event) {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
      }
    });
  }

  var url = new URL(request.url);
  var targetUrl = url.searchParams.get('url');
  if (!targetUrl) {
    return new Response('Missing url param', { status: 400 });
  }

  var allowedHosts = [
    'www.jma.go.jp',
    'www.data.jma.go.jp',
    'weather.uwyo.edu',
    'www.dwd.de',
    'www.wpc.ncep.noaa.gov',
    'ocean.weather.gov',
    'www.bom.gov.au',
    'www.amecs.co.jp',
    'www3.metair.go.jp',
    'rucsoundings.noaa.gov',
    'atis.guru'
  ];
  var targetHostname;
  try { targetHostname = new URL(targetUrl).hostname; }
  catch(e) { return new Response('Invalid url', { status: 400 }); }
  if (allowedHosts.indexOf(targetHostname) === -1) {
    return new Response('Forbidden: only allowed domains', { status: 403 });
  }

  try {
    var resp = await fetch(targetUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ANA-Calculator/1.0)' }
    });
    var body = await resp.arrayBuffer();
    return new Response(body, {
      status: resp.status,
      headers: {
        'Content-Type': resp.headers.get('Content-Type') || 'application/pdf',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=300'
      }
    });
  } catch(e) {
    return new Response('Proxy error: ' + e.message, { status: 502 });
  }
}
