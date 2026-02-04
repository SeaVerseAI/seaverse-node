/**
 * 轻量本地测试服务器：
 * - 静态托管仓库文件（用于打开 test.html）
 * - 提供同源代理 `/_proxy`，解决浏览器直连 seaverse 域名的 CORS 限制
 *
 * 用法：
 *   node dev-server.mjs
 * 然后访问：
 *   http://localhost:4173/test.html
 *
 * 安全说明：
 * - 仅用于本地开发测试
 * - 代理目标做了简单 allowlist（只允许 seaverse.ai / seaverse.dev 及 localhost）
 */
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { URL } from 'node:url';
import zlib from 'node:zlib';
import { promisify } from 'node:util';

const gzipAsync = promisify(zlib.gzip);

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');
const ROOT_DIR = __dirname;

const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || '127.0.0.1';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

function isAllowedProxyTarget(rawUrl) {
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;

    const host = u.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1') return true;
    if (host.endsWith('.seaverse.ai') || host === 'seaverse.ai') return true;
    if (host.endsWith('.seaverse.dev') || host === 'seaverse.dev') return true;
    return false;
  } catch {
    return false;
  }
}

function sendJson(res, code, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

async function handleProxy(req, res, urlObj) {
  // 支持 OPTIONS（方便一些工具/扩展）
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': '*',
    });
    res.end();
    return;
  }

  const target = urlObj.searchParams.get('url');
  if (!target) {
    sendJson(res, 400, { error: 'missing url' });
    return;
  }
  if (!isAllowedProxyTarget(target)) {
    sendJson(res, 403, { error: 'target not allowed' });
    return;
  }

  // 读取请求体（浏览器侧 SDK 一般传 string/JSON，体积不大）
  const chunks = [];
  for await (const c of req) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
  const body = chunks.length ? Buffer.concat(chunks) : undefined;

  // 复制 header：只保留必要的头，过滤掉可能导致 431 错误的大 header
  const headers = new Headers();
  // 白名单：只转发这些 header
  const allowedHeaders = new Set([
    'authorization',
    'content-type',
    'accept',
    'prefer',  // PostgREST 使用
  ]);
  
  // 调试日志：显示原始请求头
  let totalHeaderSize = 0;
  console.log('[proxy] 原始请求头:');
  for (const [k, v] of Object.entries(req.headers)) {
    if (!v) continue;
    const size = k.length + String(v).length;
    totalHeaderSize += size;
    console.log(`  ${k}: ${String(v).slice(0, 50)}${String(v).length > 50 ? '...' : ''} (${size} bytes)`);
  }
  console.log(`[proxy] 总请求头大小: ${totalHeaderSize} bytes`);
  
  for (const [k, v] of Object.entries(req.headers)) {
    if (!v) continue;
    const key = k.toLowerCase();
    if (!allowedHeaders.has(key)) continue;
    if (Array.isArray(v)) headers.set(k, v.join(','));
    else headers.set(k, v);
  }
  
  // 显示过滤后的请求头
  let filteredSize = 0;
  console.log('[proxy] 过滤后的请求头:');
  headers.forEach((v, k) => {
    const size = k.length + v.length;
    filteredSize += size;
    console.log(`  ${k}: ${v.slice(0, 50)}${v.length > 50 ? '...' : ''}`);
  });
  console.log(`[proxy] 过滤后大小: ${filteredSize} bytes`);

  let upstreamResp;
  try {
    upstreamResp = await fetch(target, {
      method: req.method || 'GET',
      headers,
      body,
      redirect: 'manual',
    });
  } catch (e) {
    sendJson(res, 502, { error: 'upstream fetch failed', message: e instanceof Error ? e.message : String(e) });
    return;
  }

  // 回写状态 + headers（移除一些 hop-by-hop）
  const outHeaders = {
    'Access-Control-Allow-Origin': '*',
  };
  upstreamResp.headers.forEach((value, key) => {
    const k = key.toLowerCase();
    if (k === 'content-encoding') return; // 交给 node 处理
    if (k === 'transfer-encoding') return;
    if (k === 'connection') return;
    outHeaders[key] = value;
  });

  res.writeHead(upstreamResp.status, outHeaders);

  // 直接流式转发响应体
  if (upstreamResp.body) {
    const nodeStream = Readable.fromWeb(upstreamResp.body);
    await pipeline(nodeStream, res);
  } else {
    res.end();
  }
}

function safeResolvePath(pathname) {
  const decoded = decodeURIComponent(pathname);
  const clean = decoded.split('?')[0].split('#')[0];
  const normalized = normalize(clean).replace(/^(\.\.(\/|\\|$))+/, '');
  return join(ROOT_DIR, normalized);
}

async function serveStatic(req, res, urlObj) {
  let pathname = urlObj.pathname;
  if (pathname === '/') pathname = '/test.html';

  const filePath = safeResolvePath(pathname);
  if (!filePath.startsWith(ROOT_DIR)) {
    sendJson(res, 403, { error: 'forbidden' });
    return;
  }

  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    sendJson(res, 404, { error: 'not found' });
    return;
  }

  const ext = extname(filePath).toLowerCase();
  const contentType = MIME[ext] || 'application/octet-stream';

  // 简单缓存策略：本地开发禁缓存，避免 dist 更新不生效
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', contentType);

  // 对文本类资源做 gzip（可选）
  const acceptEncoding = String(req.headers['accept-encoding'] || '');
  const shouldGzip =
    acceptEncoding.includes('gzip') &&
    (ext === '.html' || ext === '.js' || ext === '.mjs' || ext === '.css' || ext === '.json' || ext === '.map');

  if (!shouldGzip) {
    createReadStream(filePath).pipe(res);
    return;
  }

  const raw = await readFile(filePath);
  const gz = await gzipAsync(raw);
  res.setHeader('Content-Encoding', 'gzip');
  res.setHeader('Content-Length', gz.length);
  res.end(gz);
}

const server = http.createServer(async (req, res) => {
  try {
    const urlObj = new URL(req.url || '/', `http://${req.headers.host || `${HOST}:${PORT}`}`);

    if (urlObj.pathname === '/_proxy') {
      await handleProxy(req, res, urlObj);
      return;
    }

    await serveStatic(req, res, urlObj);
  } catch (e) {
    sendJson(res, 500, { error: 'server error', message: e instanceof Error ? e.message : String(e) });
  }
});

server.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`[dev-server] listening on http://${HOST}:${PORT}`);
  console.log(`[dev-server] open: http://${HOST}:${PORT}/test.html`);
});

