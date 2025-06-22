// Cloudflare Worker for API caching with KV optimization
// 配置你的后端服务器地址
const ORIGIN_SERVER = 'https://exam.mymarkdown.fun';

// KV 缓存配置 - 使用更长的 TTL 因为 KV 访问更快
const CACHE_CONFIG = {
  '/api/marketplace/exams': { ttl: 600, kvTtl: 1800, staleWhileRevalidate: 900 },
  '/api/marketplace/categories': { ttl: 1200, kvTtl: 3600, staleWhileRevalidate: 1800 },
  '/api/student/exams': { ttl: 300, kvTtl: 900, staleWhileRevalidate: 600 },
  '/api/teacher/analytics': { ttl: 240, kvTtl: 720, staleWhileRevalidate: 480 },
  '/api/student/profile': { ttl: 180, kvTtl: 600, staleWhileRevalidate: 360 },
  '/api/teacher/dashboard': { ttl: 120, kvTtl: 360, staleWhileRevalidate: 240 }
};

// 不缓存的敏感路径
const NO_CACHE_PATHS = [
  '/api/auth/',
  '/api/student/submit',
  '/api/teacher/create',
  '/api/teacher/update',
  '/api/teacher/delete',
  '/api/student/answer',
  '/api/teacher/grade'
];

// 需要实时数据的路径（使用较短的缓存时间）
const REALTIME_PATHS = [
  '/api/student/exam/current',
  '/api/teacher/exam/live',
  '/api/notifications'
];

// 获取缓存配置
function getCacheConfig(pathname) {
  // 检查是否为实时路径
  for (const path of REALTIME_PATHS) {
    if (pathname.startsWith(path)) {
      return { ttl: 30, kvTtl: 60, staleWhileRevalidate: 60 };
    }
  }
  
  // 检查配置的路径
  for (const [path, config] of Object.entries(CACHE_CONFIG)) {
    if (pathname.startsWith(path)) {
      return config;
    }
  }
  
  // 默认配置
  return { ttl: 60, kvTtl: 180, staleWhileRevalidate: 120 };
}

// 检查是否为实时路径
function isRealtimePath(pathname) {
  return REALTIME_PATHS.some(path => pathname.startsWith(path));
}

// 检查是否应该缓存
function shouldCache(method, pathname) {
  if (method !== 'GET') return false;
  
  for (const path of NO_CACHE_PATHS) {
    if (pathname.startsWith(path)) {
      return false;
    }
  }
  
  return true;
}

// 生成缓存键
function generateCacheKey(pathname, search) {
  return `cache:${pathname}${search || ''}`;
}

// 生成 KV 键
function generateKVKey(pathname, search) {
  const key = `kv:${pathname}${search || ''}`;
  // KV 键长度限制为 512 字节，需要处理过长的键
  if (key.length > 500) {
    const hash = btoa(key).substring(0, 50);
    return `kv:${pathname.split('/').slice(0, 3).join('/')}:${hash}`;
  }
  return key;
}

// 从 KV 获取缓存数据
async function getFromKV(env, kvKey) {
  try {
    if (!env.KV_STATIC) return null;
    
    const cached = await env.KV_STATIC.get(kvKey, { type: 'json' });
    if (!cached) return null;
    
    const now = Date.now();
    const age = (now - cached.timestamp) / 1000;
    
    return {
      data: cached.data,
      headers: cached.headers || {},
      timestamp: cached.timestamp,
      age: age
    };
  } catch (error) {
    console.error('KV get error:', error);
    return null;
  }
}

// 存储数据到 KV
async function putToKV(env, kvKey, data, headers, ttl) {
  try {
    if (!env.KV_STATIC) return;
    
    const cacheData = {
      data: data,
      headers: headers,
      timestamp: Date.now()
    };
    
    await env.KV_STATIC.put(kvKey, JSON.stringify(cacheData), {
      expirationTtl: ttl
    });
  } catch (error) {
    console.error('KV put error:', error);
  }
}

// 添加安全头
function addSecurityHeaders(response) {
  const newResponse = new Response(response.body, response);
  newResponse.headers.set('X-Content-Type-Options', 'nosniff');
  newResponse.headers.set('X-Frame-Options', 'DENY');
  newResponse.headers.set('X-XSS-Protection', '1; mode=block');
  return newResponse;
}

export default {
  async fetch(request, env, ctx) {
    try {
      // 解析请求URL
      const requestUrl = new URL(request.url)
      const pathname = requestUrl.pathname
      const search = requestUrl.search
      const method = request.method
      
      // 处理缓存清理请求
      if (pathname === '/__purge_cache' && method === 'POST') {
        return handleCachePurge(request, env)
      };
      
      // 构建转发URL
      const targetUrl = new URL(ORIGIN_SERVER);
      targetUrl.pathname = pathname;
      targetUrl.search = search;
      
      // 创建转发请求
      const forwardRequest = new Request(targetUrl.toString(), {
        method: method,
        headers: request.headers,
        body: request.body
      });
      
      // 如果不是API请求，直接转发
      if (!pathname.startsWith('/api/')) {
        const response = await fetch(forwardRequest);
        return addSecurityHeaders(response);
      }
      
      // 如果不应该缓存，直接转发并添加安全头
      if (!shouldCache(method, pathname)) {
        const response = await fetch(forwardRequest);
        const secureResponse = addSecurityHeaders(response);
        secureResponse.headers.set('CF-Cache-Status', 'BYPASS');
        return secureResponse;
      }
      
      // 多层缓存逻辑：KV -> Edge Cache -> Origin
      const cacheKey = generateCacheKey(pathname, search);
      const kvKey = generateKVKey(pathname, search);
      const cache = caches.default;
      const config = getCacheConfig(pathname);
      
      // 第一层：尝试从 KV 获取（最快）
      const kvCached = await getFromKV(env, kvKey);
      if (kvCached && kvCached.age < config.kvTtl) {
        const response = new Response(kvCached.data, {
          headers: {
            ...kvCached.headers,
            'CF-Cache-Status': kvCached.age > config.ttl ? 'KV-STALE' : 'KV-HIT',
            'Cache-Age': Math.floor(kvCached.age).toString(),
            'Cache-Layer': 'KV'
          }
        });
        
        // 如果 KV 数据过期但仍在 stale-while-revalidate 期间，异步更新
        if (kvCached.age > config.ttl && kvCached.age < config.kvTtl) {
          ctx.waitUntil(updateAllCaches(forwardRequest, cacheKey, kvKey, cache, env, pathname));
        }
        
        return addSecurityHeaders(response);
      }
      
      // 第二层：尝试从 Edge Cache 获取
      let cachedResponse = await cache.match(cacheKey);
      
      if (cachedResponse) {
        const cacheDate = new Date(cachedResponse.headers.get('Date') || Date.now());
        const age = (Date.now() - cacheDate.getTime()) / 1000;
        
        // 如果 Edge Cache 有效，同时异步更新 KV
        if (age < config.ttl + config.staleWhileRevalidate) {
          const responseText = await cachedResponse.text();
          const responseHeaders = Object.fromEntries(cachedResponse.headers.entries());
          
          // 异步更新 KV
          ctx.waitUntil(putToKV(env, kvKey, responseText, responseHeaders, config.kvTtl));
          
          const response = new Response(responseText, {
            headers: {
              ...responseHeaders,
              'CF-Cache-Status': age > config.ttl ? 'EDGE-STALE' : 'EDGE-HIT',
              'Cache-Age': Math.floor(age).toString(),
              'Cache-Layer': 'Edge'
            }
          });
          
          // 如果过期但仍在 stale-while-revalidate 期间，异步更新所有缓存
          if (age > config.ttl) {
            ctx.waitUntil(updateAllCaches(forwardRequest, cacheKey, kvKey, cache, env, pathname));
          }
          
          return addSecurityHeaders(response);
        }
      }
      
      // 第三层：从源服务器获取新响应
      const response = await fetch(forwardRequest);
      
      if (response.ok && response.status === 200) {
        const responseText = await response.text();
        const responseHeaders = Object.fromEntries(response.headers.entries());
        
        // 添加缓存控制头
        responseHeaders['Cache-Control'] = `public, max-age=${config.ttl}, s-maxage=${config.ttl}, stale-while-revalidate=${config.staleWhileRevalidate}`;
        responseHeaders['CF-Cache-Status'] = 'MISS';
        responseHeaders['Vary'] = 'Accept-Encoding';
        responseHeaders['Date'] = new Date().toUTCString();
        responseHeaders['Cache-Layer'] = 'Origin';
        
        // 创建响应对象
        const finalResponse = new Response(responseText, {
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders
        });
        
        // 异步存储到所有缓存层
        ctx.waitUntil(Promise.all([
          // 存储到 Edge Cache
          cache.put(cacheKey, finalResponse.clone()),
          // 存储到 KV（如果不是实时路径）
          !isRealtimePath(pathname) ? putToKV(env, kvKey, responseText, responseHeaders, config.kvTtl) : Promise.resolve()
        ]));
        
        return addSecurityHeaders(finalResponse);
      }
      
      // 非 200 响应，不缓存但添加状态头
      const finalResponse = new Response(response.body, response);
      finalResponse.headers.set('CF-Cache-Status', 'MISS');
      finalResponse.headers.set('Cache-Layer', 'Origin');
      return addSecurityHeaders(finalResponse);
      
    } catch (error) {
      console.error('Worker error:', error);
      
      // 发生错误时，尝试直接转发请求
      try {
        const requestUrl = new URL(request.url);
        const targetUrl = new URL(ORIGIN_SERVER);
        targetUrl.pathname = requestUrl.pathname;
        targetUrl.search = requestUrl.search;
        
        const forwardRequest = new Request(targetUrl.toString(), {
          method: request.method,
          headers: request.headers,
          body: request.body
        });
        
        const response = await fetch(forwardRequest);
        const errorResponse = addSecurityHeaders(response);
        errorResponse.headers.set('CF-Cache-Status', 'ERROR');
        return errorResponse;
      } catch (fallbackError) {
        console.error('Fallback error:', fallbackError);
        return new Response('Service Unavailable', { 
          status: 503,
          headers: {
            'Content-Type': 'text/plain',
            'CF-Cache-Status': 'ERROR'
          }
        });
      }
    }
  }
};

// 异步更新所有缓存层
async function updateAllCaches(forwardRequest, cacheKey, kvKey, cache, env, pathname) {
  try {
    const response = await fetch(forwardRequest);
    if (response.ok && response.status === 200) {
      const config = getCacheConfig(pathname);
      const responseText = await response.text();
      const responseHeaders = Object.fromEntries(response.headers.entries());
      
      // 添加缓存控制头
      responseHeaders['Cache-Control'] = `public, max-age=${config.ttl}, s-maxage=${config.ttl}, stale-while-revalidate=${config.staleWhileRevalidate}`;
      responseHeaders['CF-Cache-Status'] = 'REVALIDATED';
      responseHeaders['Vary'] = 'Accept-Encoding';
      responseHeaders['Date'] = new Date().toUTCString();
      
      // 创建缓存响应
      const responseToCache = new Response(responseText, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders
      });
      
      // 同时更新两个缓存层
      await Promise.all([
        cache.put(cacheKey, responseToCache.clone()),
        !isRealtimePath(pathname) ? putToKV(env, kvKey, responseText, responseHeaders, config.kvTtl) : Promise.resolve()
      ]);
    }
  } catch (error) {
    console.error('Cache update failed:', error);
  }
}

// 兼容性：保留原有的 updateCache 函数
async function updateCache(forwardRequest, cacheKey, cache, pathname) {
  console.warn('updateCache is deprecated, use updateAllCaches instead');
  return updateAllCaches(forwardRequest, cacheKey, null, cache, null, pathname);
}

// 缓存清理函数 - 支持 KV 和 Edge Cache
export async function purgeCache(patterns, env) {
  const cache = caches.default;
  const promises = [];
  
  // 清理 Edge Cache
  const keys = await cache.keys();
  for (const key of keys) {
    const url = new URL(key.url);
    for (const pattern of patterns) {
      if (url.pathname.includes(pattern)) {
        promises.push(cache.delete(key));
        break;
      }
    }
  }
  
  // 清理 KV Cache（如果可用）
  if (env && env.KV_STATIC) {
    try {
      // KV 不支持批量删除，需要根据模式生成可能的键
      for (const pattern of patterns) {
        // 生成常见的 KV 键模式进行删除
        const commonPaths = [
          `/api${pattern}`,
          `/api/marketplace${pattern}`,
          `/api/student${pattern}`,
          `/api/teacher${pattern}`
        ];
        
        for (const path of commonPaths) {
          const kvKey = generateKVKey(path, '');
          promises.push(env.KV_STATIC.delete(kvKey).catch(() => {})); // 忽略删除错误
        }
      }
    } catch (error) {
      console.error('KV purge error:', error);
    }
  }
  
  await Promise.all(promises);
}

// 按路径清理特定缓存
export async function purgeCacheByPath(pathname, env) {
  const promises = [];
  
  // 清理 Edge Cache
  const cacheKey = generateCacheKey(pathname, '');
  const cache = caches.default;
  promises.push(cache.delete(cacheKey));
  
  // 清理 KV Cache
  if (env && env.KV_STATIC) {
    const kvKey = generateKVKey(pathname, '');
    promises.push(env.KV_STATIC.delete(kvKey).catch(() => {}));
  }
  
  await Promise.all(promises);
}

// 智能缓存预热
export async function warmupCache(urls, env) {
  const promises = [];
  
  for (const url of urls) {
    promises.push(
      fetch(url)
        .then(response => {
          if (response.ok) {
            console.log(`Warmed up: ${url}`);
          }
        })
        .catch(error => {
          console.error(`Warmup failed for ${url}:`, error);
        })
    );
  }
  
  await Promise.all(promises);
}

// 处理缓存清理请求
async function handleCachePurge(request, env) {
  try {
    // 验证授权（简单的 token 验证）
    const authHeader = request.headers.get('Authorization');
    const expectedToken = env.CACHE_PURGE_TOKEN || 'default-token';
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response('Unauthorized', { status: 401 });
    }
    
    const token = authHeader.substring(7);
    if (token !== expectedToken) {
      return new Response('Forbidden', { status: 403 });
    }
    
    // 解析请求体
    const body = await request.json();
    const { paths } = body;
    
    if (!Array.isArray(paths)) {
      return new Response('Invalid request: paths must be an array', { status: 400 });
    }
    
    // 执行缓存清理
    await purgeCache(paths, env);
    
    return new Response(JSON.stringify({
      success: true,
      message: `Successfully purged cache for ${paths.length} paths`,
      paths: paths
    }), {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
  } catch (error) {
    console.error('Cache purge error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Internal server error'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}