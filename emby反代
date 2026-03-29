export default {
  async fetch(request, env, ctx) {
    // ================= 核心配置区域 =================

    // 1. 默认主服务器（你现在的 Emby 服务器地址）
    // 请在这里填入你当前服务器的回源地址
    const default_upstream = '服务器地址'; // 例如：111.222.33.44 或 ddns.yourdomain.com
    const default_port = '8096';                 // http通常是8096，https通常是443或8920
    const default_protocol = 'https';           // http 或 https

    // 2. 多服扩展路由表（未来备用）
    // 以后有新服务器了，只需在 DNS 里添加子域名，并在这里配置对应关系即可
    const routeMap = {
      // 示例：当访问 s1.yourdomain.com 时，转发给下面这个服
      // "s1.yourdomain.com": { domain: "emby.yourdomain.com", port: "8096", protocol: "http" },
      // 示例：当访问 s2.yourdomain.com 时，转发给下面这个服
      // "s2.yourdomain.com": { domain: "emby.yourdomain.com", port: "8920", protocol: "https" }
    //"emby1.你的域名": { domain: "服务器地址", port: "443", protocol: "https" },
    //"emby2.你的域名": { domain: "服务器地址", port: "443", protocol: "https" },
    //"emby.你的域名": { domain: "服务器地址", port: "443", protocol: "https" },
    };

    // ===========================================================

    const url = new URL(request.url);
    const worker_domain = url.host;

    // 动态路由匹配：如果域名在路由表里，就用路由表的配置，否则用默认配置
    const upstream_config = routeMap[worker_domain] || {
      domain: default_upstream,
      port: default_port,
      protocol: default_protocol
    };

    const upstream_domain = upstream_config.domain;
    const upstream_port = upstream_config.port;
    const upstream_protocol = upstream_config.protocol;

    // 获取客户端信息
    const clientIP = request.headers.get('CF-Connecting-IP') || 'Unknown';
    const country = request.cf ? request.cf.country : 'XX';
    const requestId = request.headers.get('cf-ray') || '-';
    const userAgent = request.headers.get('User-Agent') || '';

    // -----------------------------------------------------------
    // 0. 强制 HTTPS 跳转
    // -----------------------------------------------------------
    if (url.protocol === 'http:') {
      url.protocol = 'https:';
      return Response.redirect(url.href, 301);
    }

    // -----------------------------------------------------------
    // 1. 恶意 User-Agent 快速拦截
    // -----------------------------------------------------------
    const bad_agents = ['python', 'curl', 'wget', 'http-client', 'scrapy', 'java/', 'go-http'];
    if (bad_agents.some(agent => userAgent.toLowerCase().includes(agent))) {
      return new Response("403 Forbidden: Bot detected", { status: 403 });
    }

    // -----------------------------------------------------------
    // 2. 拦截 robots.txt
    // -----------------------------------------------------------
    if (url.pathname === '/robots.txt') {
      return new Response("User-agent: *\nDisallow: /", {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'public, max-age=86400'
        }
      });
    }

    // -----------------------------------------------------------
    // 3. 地区检测：仅允许中国大陆 IP
    // -----------------------------------------------------------
    if (country !== 'CN' && country !== 'XX') {
      const geoHtml = `
      <!DOCTYPE html>
      <html lang="zh-CN">
      <head><meta charset="UTF-8"><title>403 Access Denied</title></head>
      <body style="display:flex;justify-content:center;align-items:center;height:100vh;background:#f5f6f7;font-family:sans-serif;text-align:center;">
        <div style="background:white;padding:2rem;border-radius:12px;box-shadow:0 10px 25px rgba(0,0,0,0.05);max-width:400px;border-top:5px solid #ff4757;">
          <h1 style="color:#2d3436;font-size:1.5rem;">🚫 访问被拒绝</h1>
          <p style="color:#636e72;">本服务仅限中国大陆地区直连访问。</p>
          <div style="background:#f1f2f6;padding:1rem;border-radius:8px;font-family:monospace;text-align:left;font-size:0.9rem;">
            <div>IP: ${clientIP}</div>
            <div>Loc: ${country}</div>
            <div>Ray: ${requestId}</div>
          </div>
        </div>
      </body>
      </html>`;

      return new Response(geoHtml, {
        status: 403,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=3600'
        }
      });
    }

    // -----------------------------------------------------------
    // 4. 路径检测：仅允许 /emby 开头 (完美拦截网页端访问)
    // -----------------------------------------------------------
    if (!url.pathname.startsWith('/emby')) {
      const guideHtml = `
      <!DOCTYPE html>
      <html lang="zh-CN">
      <head><meta charset="UTF-8"><title>Emby Gateway</title></head>
      <body style="display:flex;justify-content:center;align-items:center;height:100vh;background:linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);font-family:sans-serif;">
        <div style="background:rgba(255,255,255,0.95);padding:2.5rem;border-radius:16px;text-align:center;box-shadow:0 10px 30px rgba(0,0,0,0.1);max-width:420px;">
          <div style="font-size:3rem;margin-bottom:1rem;">🚀</div>
          <h1 style="color:#0984e3;margin:0 0 0.5rem 0;">OkEmby 加速网关</h1>
          <p style="color:#636e72;margin:0 0 1.2rem 0;">请在客户端 (Yamby / Fileball / VidHub) 中填写完整 API 地址使用。</p>
          <div style="background:#f1f2f6;padding:1rem;border-radius:8px;text-align:left;font-family:monospace;">
            <div>Client IP: ${clientIP}</div>
            <div>Location: ${country}</div>
            <div>Status: <span style="color:#00b894">● Online</span></div>
            <div>Ray: ${requestId}</div>
          </div>
        </div>
      </body>
      </html>`;

      return new Response(guideHtml, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=3600'
        }
      });
    }

    // -----------------------------------------------------------
    // 5. OPTIONS 预检
    // -----------------------------------------------------------
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': request.headers.get('Access-Control-Request-Headers') || '*',
          'Access-Control-Max-Age': '86400'
        }
      });
    }

    // ===========================================================
    // 6. 播放进度上报节流 (防炸库核心)
    // ===========================================================
    const is_progress_report = url.pathname.includes('/Sessions/Playing/Progress');
    const cache = caches.default;

    const lockKey = new Request(`${url.origin}${url.pathname}|ip=${clientIP}`, { method: 'GET' });

    if (is_progress_report && request.method === 'POST') {
      const cachedResponse = await cache.match(lockKey);
      if (cachedResponse) return new Response(null, { status: 204 });
    }

    // -----------------------------------------------------------
    // 7. 准备回源请求
    // -----------------------------------------------------------
    url.host = upstream_domain;
    url.port = upstream_port;
    url.protocol = upstream_protocol + ':';

    const new_headers = new Headers(request.headers);
    new_headers.set('Host', upstream_domain);

    if (clientIP && clientIP !== 'Unknown') {
      new_headers.set('X-Forwarded-For', clientIP);
      new_headers.set('X-Real-IP', clientIP);
    }

    // WebSocket 透传
    if ((request.headers.get('Upgrade') || '').toLowerCase() === 'websocket') {
      return fetch(new Request(url, { method: request.method, headers: new_headers }));
    }

    // -----------------------------------------------------------
    // 8. 缓存判断逻辑 (仅缓存静态资源)
    // -----------------------------------------------------------
    const cache_extensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.css', '.js', '.woff', '.woff2'];
    const has_static_ext = cache_extensions.some(ext => url.pathname.toLowerCase().endsWith(ext));
    const is_emby_image = /\/emby\/Items\/.*?\/Images\//i.test(url.pathname);
    const is_emby_ping = url.pathname.includes('/System/Ping');

    const is_cacheable_method = (request.method === 'GET' || request.method === 'HEAD');
    const should_cache = (has_static_ext || is_emby_image || is_emby_ping) && is_cacheable_method;

    const staticCacheKey = new Request(request.url, { method: 'GET' });

    let response;
    if (should_cache) {
      response = await cache.match(staticCacheKey);
    }

    // -----------------------------------------------------------
    // 9. 回源
    // -----------------------------------------------------------
    if (!response) {
      const new_request = new Request(url, {
        method: request.method,
        headers: new_headers,
        body: request.body,
        redirect: 'manual'
      });

      try {
        response = await fetch(new_request);

        // Progress 写入 3 秒锁
        if (is_progress_report) {
          const dummyResponse = new Response('throttled', {
            headers: { 'Cache-Control': 'max-age=3' }
          });
          ctx.waitUntil(cache.put(lockKey, dummyResponse));

          if (response.status >= 400) {
            return new Response(null, { status: 204 });
          }
        }

        // 静态资源缓存写入
        if (request.method === 'GET' && should_cache && response.status === 200) {
          const response_to_cache = response.clone();
          const headers = new Headers(response_to_cache.headers);
          headers.set('Cache-Control', 'public, max-age=604800, immutable');

          const cachedResponse = new Response(response_to_cache.body, {
            status: response_to_cache.status,
            statusText: response_to_cache.statusText,
            headers
          });

          ctx.waitUntil(cache.put(staticCacheKey, cachedResponse));
        }
      } catch (err) {
        if (is_progress_report) {
          const dummyResponse = new Response('throttled', {
            headers: { 'Cache-Control': 'max-age=3' }
          });
          ctx.waitUntil(cache.put(lockKey, dummyResponse));
          return new Response(null, { status: 204 });
        }
        return new Response(`Upstream Error: ${err.message}`, { status: 502 });
      }
    }

    // -----------------------------------------------------------
    // 10. 响应处理与流媒体强制防封号保险
    // -----------------------------------------------------------
    const response_headers = new Headers(response.headers);

    // 重写 location
    if (response_headers.has('location')) {
      const location = response_headers.get('location');
      if (location && location.includes(upstream_domain)) {
        response_headers.set('location', location.replace(upstream_domain, worker_domain));
      }
    }

    // 【新增核心机制】识别视频/音频流，强制覆盖 CF 缓存策略，防止域名被封禁
    const is_media_stream = url.pathname.includes('/Videos/') || 
                            url.pathname.includes('/Audio/') || 
                            url.pathname.includes('/PlaybackInfo') ||
                            url.pathname.includes('stream');
                            
    if (is_media_stream) {
      response_headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
      response_headers.delete('ETag'); 
    }

    response_headers.set('Access-Control-Allow-Origin', '*');
    response_headers.set('Access-Control-Expose-Headers', '*');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response_headers
    });
  }
};
