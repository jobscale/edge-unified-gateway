import { Nameserver } from '../../dns/app/index.js';

describe('Nameserver enter() actual name resolution tests', () => {
  let ns;

  beforeAll(async () => {
    ns = await new Nameserver().createServer({ transport: 'udp' });
  });

  afterAll(async () => {
    ns.terminate();
  });

  ['first check', 'cache check'].forEach(type => {
    describe(`${type} phase`, () => {
      describe('static ip address', () => {
        it('should follow TXT record for version', async () => {
          const result = await ns.enter('version', 'TXT');
          const follow = result.answers.find(a => a.type === 'TXT');
          expect(follow).toBeDefined();
          expect(/^\d+\.\d+\.\d+$/.test(follow.data)).toBe(true);
        });

        it('should resolve internal domain dark.internal with A record', async () => {
          const result = await ns.enter('dark.internal', 'A');
          const answer = result.answers.find(a => a.name === 'dark.internal');
          expect(answer).toBeDefined();
          expect(answer.data).toBe('172.16.6.77');
        });

        it('should resolve root domain jsx.jp with A record', async () => {
          const result = await ns.enter('jsx.jp', 'A');
          const answer = result.answers.find(a => a.name === 'jsx.jp');
          expect(answer).toBeDefined();
          expect(answer.data).toBe('66.241.124.27');
        });

        it('should follow CNAME record for jsx.jp', async () => {
          const result = await ns.enter('cdn.jsx.jp', 'A');
          const cname = result.answers.find(a => a.type === 'CNAME');
          expect(cname).toBeDefined();
          expect(cname.data).toBe('jobscale.github.io');
        });

        it('should resolve MX record for jsx.jp', async () => {
          const result = await ns.enter('jsx.jp', 'MX');
          const mx = result.answers.find(a => a.type === 'MX');
          expect(mx).toBeDefined();
          expect(mx.data.exchange).toMatch(/mx\.jsx\.jp/);
          expect(Number.parseInt(mx.data.preference, 10)).toBeGreaterThan(0);
        });
      });

      describe('static domain check', () => {
        const STATIC_LIST = [
          '_.jsx.jp',
          'proxy.jsx.jp',
          'black.jsx.jp',
          'white.jsx.jp',
          'yellow.jsx.jp',
          'pink.jsx.jp',
          'blue.jsx.jp',
          'green.jsx.jp',
          'dark.jsx.jp',
          'n100.jsx.jp',
          'mac.jsx.jp',
          'shop.jsx.jp',
          'jp.jsx.jp',
          'us.jsx.jp',
          'eu.jsx.jp',
          'ae.jsx.jp',
          'x.jsx.jp',
          'a.jsx.jp',
          'in.jsx.jp',
        ];

        STATIC_LIST.forEach(domain => {
          test(`[static] should resolve ${domain} with A record`, async () => {
            const result = await ns.enter(domain, 'A');
            const answersA = result.answers.filter(a => a.type === 'A');
            expect(answersA.length).toBeGreaterThan(0);
            answersA.forEach(a => {
              expect(typeof a.data).toBe('string');
              expect(/^\d+\.\d+\.\d+\.\d+$/.test(a.data)).toBe(true);
            });
          });
        });
      });

      describe('external domain check', () => {
        const EXTERNAL_LIST = [
          'video-assets.mathtag.com',
          'www.cloudflare.com',
          'cloudflare.com',
          'dns.google.com',
          'www.google.com',
          'www.amazon.com',
          'amazonaws.com',
          'ocn.ne.jp',
          'www.ntt-east.co.jp',
          'www.ntt-west.co.jp',
          'docomo.ne.jp',
          'softbank.jp',
          'au.com',
          'www.jcom.co.jp',
          'nifty.com',
          'plala.or.jp',
          'microsoft.com',
          'office.com',
          'teams.microsoft.com',
          'azure.com',
          'aws.amazon.com',
          'alexa.com',
          'youtube.com',
          'drive.google.com',
          'gmail.com',
          'x.com',
          'twitter.com',
          'discord.com',
          'line.me',
          'chatwork.com',
          'slack.com',
          'instagram.com',
          'zoom.us',
          'mobile.rakuten.co.jp',
          'pay.rakuten.co.jp',
          'rakuten.co.jp',
          'paypay.ne.jp',
          'visa.co.jp',
          'www.mufg.jp',
          'www.nomura.co.jp',
          'playstation.com',
          'roblox.com',
          'steampowered.com',
          'rockstargames.com',
          'minecraft.net',
          'fortnite.com',
          'finalfantasy.com',
          'yahoo.co.jp',
          'atlassian.com',
          'zscaler.com',
          'udemy.com',
        ];

        EXTERNAL_LIST.forEach(domain => {
          test(`[external] should resolve ${domain} with A record`, async () => {
            const result = await ns.enter(domain, 'A');
            const answersA = result.answers.filter(a => a.type === 'A');
            expect(answersA.length).toBeGreaterThan(0);
            answersA.forEach(a => {
              expect(typeof a.data).toBe('string');
              expect(/^\d+\.\d+\.\d+\.\d+$/.test(a.data)).toBe(true);
            });
          });
        });
      });

      describe('deny-regex domain check', () => {
        // deny-regex file contains regex patterns for matching domain names
        // Examples: -ad-, -ads., .ads-, googleads., .yimg.jp, ads.g.doubleclick.net
        // When a domain matches a deny-regex pattern, it should be processed as denyHost
        // denyHost function returns a CNAME record redirecting to GITHUB.IO
        it('should identify domain matching deny-regex pattern -ad- as denyHost candidate', async () => {
          // test-ad-domain.com contains "-ad-" which matches the pattern in deny-regex file
          // The nameserver should invoke denyHost function for this domain
          const result = await ns.enter('test-ad-domain.com', 'A');

          // When denyHost is invoked, it returns a CNAME record from the original domain to GITHUB.IO
          expect(result).toBeDefined();
          expect(result.answers).toBeDefined();

          // Look for CNAME record created by denyHost function
          const cnameFromDenyHost = result.answers.find(answer =>
            answer.type === 'CNAME' &&
            answer.name === 'test-ad-domain.com' &&
            answer.data === 'GITHUB.IO' &&
            answer.ttl === 2592000,
          );

          expect(cnameFromDenyHost).toBeDefined();
        });

        it('should apply denyHost function to domains matching deny-regex patterns', async () => {
          // banner-ads.com contains "-ads." pattern from deny-regex
          const result = await ns.enter('banner-ads.com', 'A');

          expect(result).toBeDefined();
          expect(result.answers).toBeDefined();

          // Should have CNAME from denyHost function
          const denyHostRecord = result.answers.find(a =>
            a.type === 'CNAME' &&
            a.data === 'GITHUB.IO',
          );

          expect(denyHostRecord).toBeDefined();
          expect(denyHostRecord.ttl).toBe(2592000);
        });
      });
    });
  });

  describe('Cache management tests', () => {
    let ns2;

    beforeAll(async () => {
      ns2 = await new Nameserver().createServer({ transport: 'udp' });
    });

    afterAll(async () => {
      ns2.terminate();
    });

    it('should store cache with expires field', async () => {
      const domain = 'www.google.com';
      const type = 'A';
      await ns2.enter(domain, type);

      const cacheKey = `${domain}-${type}`;
      expect(ns2.cache[cacheKey]).toBeDefined();
      expect(ns2.cache[cacheKey].expires).toBeDefined();
      expect(typeof ns2.cache[cacheKey].expires).toBe('number');
    });

    it('should reuse cached entry before expiration', async () => {
      const domain = 'www.amazon.com';
      const type = 'A';

      // First call stores in cache
      const result1 = await ns2.enter(domain, type);
      const cacheKey = `${domain}-${type}`;
      const firstExpires = ns2.cache[cacheKey].expires;

      // Small delay but well before expiration
      await new Promise(resolve => {
        setTimeout(resolve, 100);
      });

      // Second call should reuse cache
      const result2 = await ns2.enter(domain, type);
      const secondExpires = ns2.cache[cacheKey].expires;

      // expires should be same (cache was reused)
      expect(firstExpires).toBe(secondExpires);
      // answers length should match
      expect(result1.answers).toHaveLength(result2.answers.length);
    });

    it('should remove expired cache entries via clean()', async () => {
      const domain = 'www.cloudflare.com';
      const type = 'A';
      const cacheKey = `${domain}-${type}`;

      // Add to cache
      await ns2.enter(domain, type);
      expect(ns2.cache[cacheKey]).toBeDefined();

      // Manually set expires to past time (in seconds)
      ns2.cache[cacheKey].expires = Math.floor(Date.now() / 1000) - 1;

      // Clean should remove it
      ns2.clean();
      expect(ns2.cache[cacheKey]).toBeUndefined();
    });

    it('should keep non-expired cache entries during clean()', async () => {
      const domain = 'microsoft.com';
      const type = 'A';
      const cacheKey = `${domain}-${type}`;

      // Add to cache
      const result = await ns2.enter(domain, type);
      expect(result.answers).toBeDefined();
      expect(result.answers.length).toBeGreaterThan(0);

      const originalExpires = ns2.cache[cacheKey].expires;
      expect(originalExpires).toBeDefined();
      expect(originalExpires).toBeGreaterThan(Math.floor(Date.now() / 1000));

      // Run clean() - should not remove non-expired entries
      ns2.clean();

      // Verify cache still exists and expires value is unchanged
      expect(ns2.cache[cacheKey]).toBeDefined();
      expect(ns2.cache[cacheKey].expires).toBe(originalExpires);
    });

    it('should refetch expired cache on next query', async () => {
      const domain = 'discord.com';
      const type = 'A';
      const cacheKey = `${domain}-${type}`;

      // Initial query
      await ns2.enter(domain, type);
      const firstExpires = ns2.cache[cacheKey].expires;

      // Wait a bit to ensure different second
      await new Promise(resolve => {
        setTimeout(resolve, 1100);
      });

      // Force expiration (in seconds)
      ns2.cache[cacheKey].expires = Math.floor(Date.now() / 1000) - 1;

      // Next query should refetch
      await ns2.enter(domain, type);
      const secondExpires = ns2.cache[cacheKey].expires;

      expect(secondExpires).toBeGreaterThan(firstExpires);
    });

    it('should maintain answers and authorities in cache', async () => {
      const domain = 'youtube.com';
      const type = 'A';
      const cacheKey = `${domain}-${type}`;

      const result = await ns2.enter(domain, type);

      expect(ns2.cache[cacheKey].answers).toBeDefined();
      expect(Array.isArray(ns2.cache[cacheKey].answers)).toBe(true);
      expect(ns2.cache[cacheKey].answers).toEqual(result.answers);
      expect(ns2.cache[cacheKey].authorities).toBeDefined();
    });
  });
});
