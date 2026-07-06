import { Readable } from 'stream';
import { jest } from '@jest/globals';

// dynamic import
const { httpProxy, router } = await import('../../proxy/app/route.js');

// ---- ヘルパー ----
// テストで必要な最小限のヘルパーのみ

// =============================================================
describe('router（ユニットテスト）', () => {
  it('GET / はウェルカムページを返す', () => {
    const req = { url: '/', method: 'GET', headers: {} };
    const res = {
      writeHead: jest.fn(),
      end: jest.fn(),
    };

    router(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'text/html' });
    expect(res.end).toHaveBeenCalledWith(expect.stringContaining('Special ECO System'));
  });

  it('GET /health はヘルスチェック 200 を返す', () => {
    const req = { url: '/health', method: 'GET', headers: {} };
    const res = {
      writeHead: jest.fn(),
      end: jest.fn(),
    };

    router(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'application/json' });
    expect(res.end).toHaveBeenCalledWith(JSON.stringify('Healthy'));
  });

  it('POST /health はヘルスチェック 200 を返す', () => {
    const req = { url: '/health', method: 'POST', headers: {} };
    const res = {
      writeHead: jest.fn(),
      end: jest.fn(),
    };

    router(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'application/json' });
    expect(res.end).toHaveBeenCalledWith(JSON.stringify('Healthy'));
  });

  it('許可されていないメソッドは 405 を返す', () => {
    const req = { url: '/api', method: 'GET', headers: {} };
    const res = {
      writeHead: jest.fn(),
      end: jest.fn(),
    };

    router(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(
      405,
      expect.objectContaining({
        'Content-Type': 'text/html',
        'X-Method': 'GET',
      }),
    );
    expect(res.end).toHaveBeenCalledWith(expect.stringContaining('Method Not Allowed'));
  });

  it('プロキシ認証が必要なメソッドは 407 を返す', () => {
    const req = { url: '/api', method: 'POST', headers: {} };
    const res = {
      writeHead: jest.fn(),
      end: jest.fn(),
    };

    router(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(
      407,
      expect.objectContaining({
        'Content-Type': 'application/json',
        'X-Method': 'POST',
        'Proxy-Authenticate': 'Ocean Authorizer realm="connect"',
      }),
    );
    expect(res.end).toHaveBeenCalledWith(expect.stringContaining('407'));
  });
});

// =============================================================
describe('httpProxy（ユニットテスト - fetch モック）', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET リクエストを上流に転送し、レスポンスを返す', async () => {
    // fetch をモック
    const mockResponseBody = Readable.from(['{"test": "data"}']);
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      headers: new Map([['content-type', 'application/json']]),
      body: mockResponseBody,
    });

    // request オブジェクトを作成
    const req = {
      url: 'http://example.com/api',
      method: 'GET',
      headers: { 'user-agent': 'test' },
    };

    // response オブジェクトを作成（Writable ストリームとしての実装）
    const res = {
      setHeader: jest.fn(),
      writeHead: jest.fn(),
      destroy: jest.fn(),
      end: jest.fn(),
      on: jest.fn(),
      once: jest.fn(),
      write: jest.fn(() => true),
      pipe: jest.fn(function(source) {
        // source ストリームをしっかり消費する
        source.on('data', (chunk) => {
          this.write(chunk);
        });
        source.on('end', () => {
          this.end();
        });
        source.on('error', (err) => {
          this.destroy(err);
        });
        return this;
      }),
    };

    // httpProxy を実行
    httpProxy(req, res).catch(() => {
      // エラーは無視（ストリーム処理の非同期エラー）
    });

    // httpProxy の非同期完了とストリーム処理のタイミングを待つ
    await new Promise((resolve) => {
      setTimeout(() => {
        resolve();
      }, 50);
    });

    // fetch が正しく呼ばれたか確認
    expect(global.fetch).toHaveBeenCalledWith(
      'http://example.com/api',
      expect.objectContaining({
        method: 'GET',
        headers: { 'user-agent': 'test' },
        redirect: 'manual',
      }),
    );

    // レスポンスのヘッダが設定されたか確認
    expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
    expect(res.writeHead).toHaveBeenCalledWith(200);
  });

  it('POST リクエストでボディを転送', async () => {
    const mockResponseBody = Readable.from(['OK']);
    global.fetch = jest.fn().mockResolvedValue({
      status: 201,
      headers: new Map(),
      body: mockResponseBody,
    });

    // POST リクエスト + ボディ
    const reqBody = Readable.from(['{"key": "value"}']);
    const req = {
      url: 'http://example.com/api',
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      [Symbol.iterator]: () => reqBody[Symbol.iterator](),
    };
    Object.assign(req, reqBody);

    const res = {
      setHeader: jest.fn(),
      writeHead: jest.fn(),
      destroy: jest.fn(),
      end: jest.fn(),
      write: jest.fn(() => true),
      on: jest.fn(),
      once: jest.fn(),
      pipe: jest.fn(function(source) {
        source.on('data', (chunk) => {
          this.write(chunk);
        });
        source.on('end', () => {
          this.end();
        });
        source.on('error', (err) => {
          this.destroy(err);
        });
        return this;
      }),
    };

    await new Promise((resolve) => {
      httpProxy(req, res).then(resolve).catch(resolve);
    });

    // fetch が呼ばれ、body が req である確認
    expect(global.fetch).toHaveBeenCalledWith(
      'http://example.com/api',
      expect.objectContaining({
        method: 'POST',
        body: expect.any(Object),
      }),
    );
    expect(res.writeHead).toHaveBeenCalledWith(201);
  });

  it('req.headers に x-remote-address を追加して上流に転送', async () => {
    const mockResponseBody = Readable.from(['']);
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      headers: new Map([['content-type', 'text/plain']]),
      body: mockResponseBody,
    });

    const req = {
      url: 'http://example.com',
      method: 'GET',
      headers: {
        'user-agent': 'test',
      },
      socket: {
        remoteAddress: '203.0.113.10',
      },
    };

    const res = {
      setHeader: jest.fn(),
      writeHead: jest.fn(),
      destroy: jest.fn(),
      end: jest.fn(),
      write: jest.fn(() => true),
      on: jest.fn(),
      once: jest.fn(),
      pipe: jest.fn(function(source) {
        source.on('data', (chunk) => {
          this.write(chunk);
        });
        source.on('end', () => {
          this.end();
        });
        source.on('error', (err) => {
          this.destroy(err);
        });
        return this;
      }),
    };

    await new Promise((resolve) => {
      httpProxy(req, res).then(resolve).catch(resolve);
    });

    const callArgs = global.fetch.mock.calls[0][1];
    expect(req.headers).toHaveProperty('x-remote-address', '203.0.113.10');
    expect(callArgs.headers).toHaveProperty('x-remote-address', '203.0.113.10');
  });

  it('hop-by-hop ヘッダを削除', async () => {
    const mockResponseBody = Readable.from(['']);
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      headers: new Map([['content-type', 'text/plain']]),
      body: mockResponseBody,
    });

    const req = {
      url: 'http://example.com',
      method: 'GET',
      headers: {
        'user-agent': 'test',
        connection: 'keep-alive', // hop-by-hop（削除される）
        'keep-alive': '100', // hop-by-hop（削除される）
      },
    };

    const res = {
      setHeader: jest.fn(),
      writeHead: jest.fn(),
      destroy: jest.fn(),
      end: jest.fn(),
      write: jest.fn(() => true),
      on: jest.fn(),
      once: jest.fn(),
      pipe: jest.fn(function(source) {
        source.on('data', (chunk) => {
          this.write(chunk);
        });
        source.on('end', () => {
          this.end();
        });
        source.on('error', (err) => {
          this.destroy(err);
        });
        return this;
      }),
    };

    await new Promise((resolve) => {
      httpProxy(req, res).then(resolve).catch(resolve);
    });

    // fetch に渡されたヘッダから hop-by-hop が削除されている確認
    const callArgs = global.fetch.mock.calls[0][1];
    expect(callArgs.headers).not.toHaveProperty('connection');
    expect(callArgs.headers).not.toHaveProperty('keep-alive');
    expect(callArgs.headers).toHaveProperty('user-agent', 'test');
  });

  it('レスポンスの hop-by-hop ヘッダも削除', async () => {
    const mockResponseBody = Readable.from(['']);
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      headers: new Map([
        ['content-type', 'text/plain'],
        ['transfer-encoding', 'chunked'], // hop-by-hop
        ['connection', 'close'], // hop-by-hop
      ]),
      body: mockResponseBody,
    });

    const req = {
      url: 'http://example.com',
      method: 'GET',
      headers: {},
    };

    const res = {
      setHeader: jest.fn(),
      writeHead: jest.fn(),
      destroy: jest.fn(),
      end: jest.fn(),
      write: jest.fn(() => true),
      on: jest.fn(),
      once: jest.fn(),
      pipe: jest.fn(function(source) {
        source.on('data', (chunk) => {
          this.write(chunk);
        });
        source.on('end', () => {
          this.end();
        });
        source.on('error', (err) => {
          this.destroy(err);
        });
        return this;
      }),
    };

    await new Promise((resolve) => {
      httpProxy(req, res).then(resolve).catch(resolve);
    });

    // setHeader が呼ばれたヘッダを確認（hop-by-hop は含まない）
    expect(res.setHeader).toHaveBeenCalledWith('content-type', 'text/plain');
    expect(res.setHeader).not.toHaveBeenCalledWith(
      expect.stringContaining('transfer-encoding'),
      expect.anything(),
    );
    expect(res.setHeader).not.toHaveBeenCalledWith(
      expect.stringContaining('connection'),
      expect.anything(),
    );
  });
});
