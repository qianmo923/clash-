export default {
  async fetch(request, env, ctx) {
    // ================= 核心配置区域 =================

    // 1. 默认主服务器地址（当没有匹配到路由表时，默认走这个服）
    // ⚠️ 注意：结尾千万不要有空格！
    const default_upstream = '你的默认服务器地址.com'; 
    const default_port = '443';                 
    const default_protocol = 'https';

    // 2. 多服扩展路由表（一拖多核心玩法）
    // 格式："你的反代子域名": { domain: "目标服真实域名", port: "端口", protocol: "协议" }
    const routeMap = {
     // "你的反代子域名": { domain: "目标服真实域名", port: "443", protocol: "https" },
      //"你的反代子域名": { domain: "目标服真实域名", port: "443", protocol: "https" },
      //"你的反代子域名": { domain: "目标服真实域名", port: "443", protocol: "https" }
    };
    // ===========================================================

    const url = new URL(request.url);
    const worker_domain = url.host;

    // 动态路由匹配
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
    const bad_agents = ['python', 'curl', 'wget', 'scrapy'];
    if (bad_agents.some(agent => userAgent.toLowerCase().includes(agent))) {
      return new Response("403 Forbidden: Bot detected", { status: 403 });
    }

    // -----------------------------------------------------------
    // 2. 拦截 robots.txt
    // -----------------------------------------------------------
    if (url.pathname === '/robots.txt') {
      return new Response("User-agent: *\nDisallow: /", {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=86400' }
      });
    }

    // -----------------------------------------------------------
    // 3. 地区检测：【精准拦截日本 IP】
    // -----------------------------------------------------------
    if (country === 'JP') {
      const geoHtml = `
      <!DOCTYPE html>
      <html lang="zh-CN">
      <head><meta charset="UTF-8"><title>403 Access Denied</title></head>
      <body style="display:flex;justify-content:center;align-items:center;height:100vh;background:#f5f6f7;font-family:sans-serif;text-align:center;">
        <div style="background:white;padding:2rem;border-radius:12px;box-shadow:0 10px 25px rgba(0,0,0,0.05);max-width:400px;border-top:5px solid #ff4757;">
          <h1 style="color:#2d3436;font-size:1.5rem;">🚫 访问被拒绝</h1>
          <p style="color:#636e72;">出于安全策略，本节点禁止日本 (JP) 地区的 IP 访问。</p>
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
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=3600' }
      });
    }

    // -----------------------------------------------------------
    // 4. 路径检测：仅允许 /emby 开头 (防网页端滥用)
    // -----------------------------------------------------------
    /*
    if (!url.pathname.startsWith('/emby')) {
      const guideHtml = `
      <!DOCTYPE html>
      <html lang="zh-CN">
      <head><meta charset="UTF-8"><title>Emby Gateway</title></head>
      <body style="display:flex;justify-content:center;align-items:center;height:100vh;background:linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);font-family:sans-serif;">
        <div style="background:rgba(255,255,255,0.95);padding:2.5rem;border-radius:16px;text-align:center;box-shadow:0 10px 30px rgba(0,0,0,0.1);max-width:420px;">
          <div style="font-size:3rem;margin-bottom:1rem;">🚀</div>
          <h1 style="color:#0984e3;margin:0 0 0.5rem 0;">Emby 专属反代网关</h1>
          <p style="color:#636e72;margin:0 0 1.2rem 0;">客户端请务必在地址末尾加上 /emby 使用。</p>
          <div style="background:#f1f2f6;padding:1rem;border-radius:8px;text-align:left;font-family:monospace;">
            <div>Client IP: ${clientIP}</div>
            <div>Location: ${country}</div>
            <div>Status: <span style="color:#00b894">● Online</span></div>
          </div>
        </div>
      </body>
      </html>`;
      return new Response(guideHtml, {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=3600' }
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
*/
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
    
    // 【智能工牌分发】只有当目标服是 EMOS 时，才发送这两个头部
    if (upstream_domain === 'emos.best') {
    //  new_headers.set('EMOS-PROXY-ID', '你的ID'); 
    //  new_headers.set('EMOS-PROXY-NAME', '@你的称号');
    }

    // 未来如果你有其他服也需要专属 Header，也可以照猫画虎写在这里
    // if (upstream_domain === '别的服.com') {
    //   new_headers.set('OTHER-HEADER', '12345'); 
    // }

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
          const dummyResponse = new Response('throttled', { headers: { 'Cache-Control': 'max-age=3' } });
          ctx.waitUntil(cache.put(lockKey, dummyResponse));
          if (response.status >= 400) return new Response(null, { status: 204 });
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
          const dummyResponse = new Response('throttled', { headers: { 'Cache-Control': 'max-age=3' } });
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
