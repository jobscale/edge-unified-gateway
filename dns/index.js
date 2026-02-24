import net from 'net';
import dgram from 'dgram';
import { Nameserver } from './app/index.js';

const JEST_TEST = Object.keys(process.env).filter(v => v.toLowerCase().match('jest')).length;
const BIND = process.env.BIND || '0.0.0.0';
const PORT = Number.parseInt(process.env.PORT, 10) || 53;

const logger = new Proxy(console, {
  get(target, property) {
    return (...args) => target[property](`[dns ${property.toUpperCase()}]`.padEnd(8, ' '), ...args);
  },
});

const tcpServer = async (port, bind = '127.0.0.1') => {
  const transport = 'tcp';
  const parser = await new Nameserver().createServer({ transport });
  const tcpReceiver = async (buffer, socket) => {
    const length = buffer.readUInt16BE(0);
    const msg = buffer.slice(2, 2 + length);
    const response = await parser.parseDNS(msg)
    .catch(e => logger.warn(e.message));
    if (response) {
      const lengthBuf = Buffer.alloc(2);
      lengthBuf.writeUInt16BE(response.length);
      socket.write(Buffer.concat([lengthBuf, response]));
    }
    socket.end();
  };
  const tcpConnecter = socket => {
    socket.on('data', buffer => {
      tcpReceiver(buffer, socket)
      .catch(e => logger.warn(e.message));
    });
    socket.on('error', e => logger.error(`TCP socket error: ${e.message}`));
  };
  const server = net.createServer(tcpConnecter);
  server.listen(port, bind, () => {
    logger.info(`DNS server listening on ${bind}:${port} ${transport}`);
  });
};

const udpServer = async (port, bind = '127.0.0.1') => {
  const transport = 'udp';
  const parser = await new Nameserver().createServer({ transport });
  const server = dgram.createSocket('udp4');
  const udpReceiver = async (msg, rinfo) => {
    const response = await parser.parseDNS(msg)
    .catch(e => logger.warn(e.message));
    if (response) {
      server.send(response, 0, response.length, rinfo.port, rinfo.address);
    }
  };
  server.on('message', (msg, rinfo) => {
    udpReceiver(msg, rinfo)
    .catch(e => logger.warn(e.message));
  });
  server.bind(port, bind, () => {
    logger.info(`DNS server listening on ${bind}:${port} ${transport}`);
  });
};

const main = async () => {
  if (JEST_TEST) return;
  tcpServer(PORT, BIND);
  udpServer(PORT, BIND);
};

export default main();
