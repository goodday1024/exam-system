// Cloudflare Worker 脚本用于API缓存优化
// 部署到 Cloudflare Workers 以加速 API 请求

const CACHE_CONFIG = {
  // API 路由缓存配置
  '/api/marketplace/exams': { ttl: 300, staleWhileRevalidate: 600 },
  '/api/teacher/analytics': { ttl: 180, staleWhileRevalidate: 300 },
  '/api/teacher/students': { ttl: 600, staleWhileRevalidate: 1200 },
  '/api/student/exams': { ttl: 120, staleWhileRevalidate: 240 },
  '/api/teacher/questions': { ttl: 300, staleWhileRevalidate: 600 },
  '/api/teacher/exams': { ttl: 180, staleWhileRevalidate: 360 }
};

// 不缓存的路径（包含敏感操作）
const NO_CACHE_PATHS = [
  '/api/auth/',
  '/api/student/exam/',
  '/api/teacher/exams/[id]/grade',
  '/api/teacher/exams/[id]/publish',
  '/api/marketplace/exams/[id]/import',
  '/api/marketplace/exams/[id]/rate'
];

// 生成缓存键
function generateCacheKey(request) {
  const url = new URL(request.url);
  const cacheKey = `${url.pathname}${url.search}`;
  return cacheKey;
}

// 检查是否应该缓存
function shouldCache(pathname, method) {
  // 只缓存 GET 请求
  if (method !== 'GET') return false;
  
  // 检查是否在不缓存列表中
  for (const path of NO_CACHE_PATHS) {
    if (pathname.includes(path.replace('[id]', ''))) {
      return false;
    }
  }
  
  // 检查是否有缓存配置
  return Object.keys(CACHE_CONFIG).some(path => pathname.startsWith(path));
}

// 获取缓存配置
function getCacheConfig(pathname) {
  for (const [path, config] of Object.entries(CACHE_CONFIG)) {
    if (pathname.startsWith(path)) {
      return config;
    }
  }
  return { ttl: 60, staleWhileRevalidate: 120 }; // 默认配置
}

// 主处理函数
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const method = request.method;
    const pathname = url.pathname;
    
    // 如果不是 API 请求，直接转发
    if (!pathname.startsWith('/api/')) {
      return fetch(request);
    }
    
    // 检查是否应该缓存
    if (!shouldCache(pathname, method)) {
      const response = await fetch(request);
      // 为不缓存的响应添加安全头
      const newResponse = new Response(response.body, response);
      newResponse.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      newResponse.headers.set('X-Content-Type-Options', 'nosniff');
      newResponse.headers.set('X-Frame-Options', 'DENY');
      return newResponse;
    }
    
    // 生成缓存键
    const cacheKey = generateCacheKey(request);
    const cache = caches.default;
    
    // 尝试从缓存获取
    let cachedResponse = await cache.match(cacheKey);
    
    if (cachedResponse) {
      // 检查缓存是否过期但仍在 stale-while-revalidate 期间
      const cacheDate = new Date(cachedResponse.headers.get('Date'));
      const config = getCacheConfig(pathname);
      const age = (Date.now() - cacheDate.getTime()) / 1000;
      
      if (age > config.ttl && age < config.ttl + config.staleWhileRevalidate) {
        // 异步更新缓存
        ctx.waitUntil(updateCache(request, cacheKey, cache));
      }
      
      // 添加缓存状态头
      const response = new Response(cachedResponse.body, cachedResponse);
      response.headers.set('CF-Cache-Status', 'HIT');
      response.headers.set('X-Cache-Age', Math.floor(age).toString());
      return response;
    }
    
    // 缓存未命中，获取新响应
    const response = await fetch(request);
    
    // 只缓存成功的响应
    if (response.ok && response.status === 200) {
      const config = getCacheConfig(pathname);
      
      // 克隆响应以避免消费原始响应体
      const responseToCache = response.clone();
      
      // 设置缓存头
      responseToCache.headers.set('Cache-Control', `public, max-age=${config.ttl}, s-maxage=${config.ttl}, stale-while-revalidate=${config.staleWhileRevalidate}`);
      responseToCache.headers.set('CF-Cache-Status', 'MISS');
      responseToCache.headers.set('Vary', 'Accept-Encoding');
      
      // 异步缓存响应
      ctx.waitUntil(cache.put(cacheKey, responseToCache));
    }
    
    return response;
  }
};

// 异步更新缓存
async function updateCache(request, cacheKey, cache) {
  try {
    const response = await fetch(request);
    if (response.ok && response.status === 200) {
      const url = new URL(request.url);
      const config = getCacheConfig(url.pathname);
      
      const responseToCache = response.clone();
      responseToCache.headers.set('Cache-Control', `public, max-age=${config.ttl}, s-maxage=${config.ttl}, stale-while-revalidate=${config.staleWhileRevalidate}`);
      responseToCache.headers.set('CF-Cache-Status', 'REVALIDATED');
      responseToCache.headers.set('Vary', 'Accept-Encoding');
      
      await cache.put(cacheKey, responseToCache);
    }
  } catch (error) {
    console.error('Cache update failed:', error);
  }
}

// 缓存清理函数（可通过特殊端点触发）
export async function purgeCache(patterns) {
  const cache = caches.default;
  const keys = await cache.keys();
  
  for (const key of keys) {
    const url = new URL(key.url);
    for (const pattern of patterns) {
      if (url.pathname.includes(pattern)) {
        await cache.delete(key);
        break;
      }
    }
  }
}