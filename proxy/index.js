import http from 'http';
import https from 'https';
import fs from 'fs';
import { swallow, proxyConnect } from './app/index.js';
import { router } from './app/route.js';

const JEST_TEST = Object.keys(process.env).filter(v => v.toLowerCase().match('jest')).length;
const BIND = process.env.BIND || '0.0.0.0';
const PORT = Number.parseInt(process.env.PORT, 10) || 3128;
const SPORT = Number.parseInt(process.env.SPORT, 10) || 3443;

const logger = new Proxy(console, {
  get(target, property) {
    return (...args) => target[property](`[${property.toUpperCase()}]`.padEnd(8, ' '), ...args);
  },
});

const httpServer = (port, bind = '127.0.0.1') => {
  const server = http.createServer();
  server.on('connection', socket => socket.on('error', swallow));
  server.on('connect', proxyConnect);
  server.on('request', router);
  server.listen(port, bind, () => {
    logger.info(`HTTP CONNECT proxy running on ${bind}:${port}`);
  });
};

const httpsServer = (port, bind = '127.0.0.1') => {
  // skip https if not exists tls file
  if (!fs.existsSync('jsx.jp/privkey.pem')) return;
  const server = https.createServer({
    cert: fs.readFileSync('jsx.jp/fullchain.pem'),
    key: fs.readFileSync('jsx.jp/privkey.pem'),
    ALPNProtocols: ['http/1.1'],
  });
  server.on('connection', socket => socket.on('error', swallow));
  server.on('connect', proxyConnect);
  server.on('request', router);
  server.listen(port, bind, () => {
    logger.info(`HTTPS CONNECT proxy running on ${bind}:${port}`);
  });
};

const main = async () => {
  if (JEST_TEST) return;
  httpServer(PORT, BIND);
  httpsServer(SPORT, BIND);
};

export default main();
