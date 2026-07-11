import fs from 'fs';

const logger = new Proxy(console, {
  get(target, prop) {
    return target[prop];
  },
});

const main = async () => {
  const json = fs.readFileSync('db/sakura-dns.json', 'utf8');
  const dns = JSON.parse(json);
  const filteredData = dns.filter(item => {
    if (item.Name === '*' || item.Name === 'in' || item.Name.endsWith('.in')) return false;
    if (item.Name === 'us' || item.Name === 'os') return false;
    if (item.RData === 'jobscale.github.io.') return false;
    if (item.RData.startsWith('172.16.6.')) return false;
    logger.debug(JSON.stringify({ Name: item.Name, RData: item.RData }));
    return true;
  }).map(item => ({ ...item, TTL: 122 }));
  fs.writeFileSync('db/jsx.jp.json', `${JSON.stringify(filteredData, null, 2)}\n`, 'utf8');
};

main().catch(logger.error);
