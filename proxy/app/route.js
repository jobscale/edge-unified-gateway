const logger = console;
import { Readable } from 'stream';

const style = `<style>
:root {
  color-scheme: dark light;
}
body {
  display: grid;
  justify-content: center;
  align-items: center;
  height: 100vh;
  margin: 0;
  font-family: Arial, sans-serif;
}
</style>`;
const title = '<title>Special ECO System</title>';

export const httpProxy = async (req, res) => {
  logger.info('Proxying HTTP request to', req.url);
  const headers = { ...req.headers };
  const hopByHop = [
    'connection', 'proxy-connection', 'keep-alive', 'transfer-encoding',
    'upgrade', 'te', 'trailer', 'host',
  ];
  for (const h of hopByHop) { delete headers[h]; }
  const { method } = req;
  const body = ['GET', 'HEAD'].includes(method) ? undefined : req;
  const upstream = await fetch(req.url, {
    method, headers, body, redirect: 'manual',
  });
  const upstreamStream = Readable.from(upstream.body);
  upstreamStream.on('error', e => {
    logger.error('Upstream stream error', e);
    res.destroy();
  });
  res.on('error', e => {
    logger.error('Client stream error', e);
  });
  // 上流レスポンスのヘッダをコピー
  upstream.headers.forEach((value, key) => {
    if (['transfer-encoding', 'connection'].includes(key)) return;
    res.setHeader(key, value);
  });
  res.writeHead(upstream.status);
  // ボディをそのまま pipe
  upstreamStream.pipe(res);
};

export const router = (req, res) => {
  // HTTP プロキシ
  if (req.url.startsWith('http://')) {
    httpProxy(req, res).catch(() => {
      res.writeHead(502);
      res.end('Bad Gateway');
    });
    return;
  }

  if (req.url === '/' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`${style}${title}<main><h1>Special ECO System</h1></main>`);
  } else if (['/health'].includes(req.url) && ['GET', 'POST'].includes(req.method)) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify('Healthy'));
  } else if (['GET', 'PUT', 'DELETE', 'HEAD', 'OPTIONS', 'PATCH'].includes(req.method)) {
    res.writeHead(405, {
      'Content-Type': 'text/html',
      'X-Method': req.method,
    });
    res.end(`${style}${title}<main><h1>Method Not Allowed</h1></main>`);
  } else {
    res.writeHead(407, {
      'Content-Type': 'application/json',
      'X-Method': req.method,
      'Proxy-Authenticate': 'Ocean Authorizer realm="connect"',
    });
    res.end(JSON.stringify({
      code: 407, message: 'Proxy Authentication Required', method: req.method,
    }));
  }
};
