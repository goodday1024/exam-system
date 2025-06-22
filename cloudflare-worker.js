// Cloudflare Worker for API caching with optimized performance
// 配置你的后端服务器地址
const ORIGIN_SERVER = 'https://exam.mymarkdown.fun';

// 内存缓存配置
const memoryCache = new Map();
const MEMORY_CACHE_SIZE = 100;
const MEMORY_CACHE_TTL = 30; // 30秒内存缓存

// 缓存配置 - 优化后的短缓存时间
const CACHE_CONFIG = {
  '/api/marketplace/exams': { ttl: 30, staleWhileRevalidate: 60 },
  '/api/marketplace/categories': { ttl: 30, staleWhileRevalidate: 60 },
  '/api/student/exams': { ttl: 30, staleWhileRevalidate: 60 },
  '/api/teacher/analytics': { ttl: 30, staleWhileRevalidate: 60 },
  '/api/student/profile': { ttl: 30, staleWhileRevalidate: 60 },
  '/api/teacher/dashboard': { ttl: 30, staleWhileRevalidate: 60 }
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

// 需要实时数据的路径
const REALTIME_PATHS = [
  '/api/student/exam/current',
  '/api/teacher/exam/live',
  '/api/notifications'
];

// 预取模式配置
const PREFETCH_PATTERNS = {
  '/api/marketplace/exams': ['/api/marketplace/categories'],
  '/api/student/exams': ['/api/student/profile'],
  '/api/teacher/dashboard': ['/api/teacher/analytics']
};

// 内存缓存函数
function getFromMemory(key) {
  const cached = memoryCache.get(key);
  if (!cached) return null;
  
  const age = (Date.now() - cached.timestamp) / 1000;
  if (age > MEMORY_CACHE_TTL) {
    memoryCache.delete(key);
    return null;
  }
  
  return {
    data: cached.data,
    headers: cached.headers,
    age: age
  };
}

function putToMemory(key, data, headers) {
  // LRU策略：限制缓存大小
  if (memoryCache.size >= MEMORY_CACHE_SIZE) {
    const firstKey = memoryCache.keys().next().value;
    memoryCache.delete(firstKey);
  }
  
  memoryCache.set(key, {
    data,
    headers,
    timestamp: Date.now()
  });
}

// 获取缓存配置
function getCacheConfig(pathname) {
  // 检查是否为实时路径
  for (const path of REALTIME_PATHS) {
    if (pathname.startsWith(path)) {
      return { ttl: 30, staleWhileRevalidate: 60 };
    }
  }
  
  // 检查配置的路径
  for (const [path, config] of Object.entries(CACHE_CONFIG)) {
    if (pathname.startsWith(path)) {
      return config;
    }
  }
  
  // 默认配置
  return { ttl: 30, staleWhileRevalidate: 60 };
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

// 生成 ETag
function generateETag(content) {
  const hash = btoa(content).substring(0, 16);
  return `"${hash}"`;
}

// 处理条件请求
function handleConditionalRequest(request, cachedResponse) {
  const ifNoneMatch = request.headers.get('If-None-Match');
  const cachedETag = cachedResponse.headers.get('ETag');
  
  if (ifNoneMatch && cachedETag && ifNoneMatch === cachedETag) {
    return new Response(null, {
      status: 304,
      headers: {
        'ETag': cachedETag,
        'Cache-Control': cachedResponse.headers.get('Cache-Control'),
        'CF-Cache-Status': 'NOT-MODIFIED'
      }
    });
  }
  
  return null;
}

// 压缩响应
async function compressResponse(response) {
  const acceptEncoding = response.headers.get('Accept-Encoding') || '';
  
  if (acceptEncoding.includes('gzip')) {
    const stream = new CompressionStream('gzip');
    const compressedStream = response.body.pipeThrough(stream);
    
    return new Response(compressedStream, {
      headers: {
        ...Object.fromEntries(response.headers.entries()),
        'Content-Encoding': 'gzip',
        'Vary': 'Accept-Encoding'
      }
    });
  }
  
  return response;
}

// 智能预取相关资源
async function prefetchRelated(pathname, ctx) {
  const related = PREFETCH_PATTERNS[pathname];
  if (related) {
    ctx.waitUntil(
      Promise.all(related.map(path => 
        fetch(`${ORIGIN_SERVER}${path}`)
          .then(response => {
            if (response.ok) {
              const cacheKey = generateCacheKey(path, '');
              const cache = caches.default;
              return cache.put(cacheKey, response.clone());
            }
          })
          .catch(() => {}) // 忽略预取错误
      ))
    );
  }
}

// 处理API响应优化
async function processApiResponse(response, pathname) {
  if (pathname.includes('/marketplace/exams')) {
    try {
      const data = await response.json();
      
      // 在边缘进行数据过滤和排序
      const processed = data
        .filter(exam => exam.published)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 20); // 只返回前20个
      
      return new Response(JSON.stringify(processed), {
        headers: {
          ...Object.fromEntries(response.headers.entries()),
          'Content-Type': 'application/json'
        }
      });
    } catch (error) {
      // 如果处理失败，返回原始响应
      return response;
    }
  }
  
  return response;
}

// 添加安全头
function addSecurityHeaders(response) {
  const newResponse = new Response(response.body, response);
  newResponse.headers.set('X-Content-Type-Options', 'nosniff');
  newResponse.headers.set('X-Frame-Options', 'DENY');
  newResponse.headers.set('X-XSS-Protection', '1; mode=block');
  newResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  return newResponse;
}

export default {
  async fetch(request, env, ctx) {
    try {
      // 解析请求URL
      const requestUrl = new URL(request.url);
      const pathname = requestUrl.pathname;
      const search = requestUrl.search;
      const method = request.method;
      
      // 处理缓存清理请求
      if (pathname === '/__purge_cache' && method === 'POST') {
        return handleCachePurge(request, env);
      }
      
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
      
      // 如果不应该缓存，直接转发
      if (!shouldCache(method, pathname)) {
        const response = await fetch(forwardRequest);
        const secureResponse = addSecurityHeaders(response);
        secureResponse.headers.set('CF-Cache-Status', 'BYPASS');
        return secureResponse;
      }
      
      // 多层缓存逻辑：Memory -> Edge Cache -> Origin
      const cacheKey = generateCacheKey(pathname, search);
      const cache = caches.default;
      const config = getCacheConfig(pathname);
      
      // 第一层：尝试从内存缓存获取（最快）
      const memoryCached = getFromMemory(cacheKey);
      if (memoryCached) {
        const response = new Response(memoryCached.data, {
          headers: {
            ...memoryCached.headers,
            'CF-Cache-Status': 'MEMORY-HIT',
            'Cache-Age': Math.floor(memoryCached.age).toString(),
            'Cache-Layer': 'Memory'
          }
        });
        
        // 触发预取
        prefetchRelated(pathname, ctx);
        
        return addSecurityHeaders(response);
      }
      
      // 第二层：尝试从 Edge Cache 获取
      let cachedResponse = await cache.match(cacheKey);
      
      // 处理条件请求（ETag）
      if (cachedResponse) {
        const conditionalResponse = handleConditionalRequest(request, cachedResponse);
        if (conditionalResponse) {
          return addSecurityHeaders(conditionalResponse);
        }
      }
      
      if (cachedResponse) {
        const cacheDate = new Date(cachedResponse.headers.get('Date') || Date.now());
        const age = (Date.now() - cacheDate.getTime()) / 1000;
        
        // 如果 Edge Cache 有效
        if (age < config.ttl + config.staleWhileRevalidate) {
          const responseText = await cachedResponse.text();
          const responseHeaders = Object.fromEntries(cachedResponse.headers.entries());
          
          // 异步更新内存缓存
          putToMemory(cacheKey, responseText, responseHeaders);
          
          const response = new Response(responseText, {
            headers: {
              ...responseHeaders,
              'CF-Cache-Status': age > config.ttl ? 'EDGE-STALE' : 'EDGE-HIT',
              'Cache-Age': Math.floor(age).toString(),
              'Cache-Layer': 'Edge'
            }
          });
          
          // 如果过期但仍在 stale-while-revalidate 期间，异步更新
          if (age > config.ttl) {
            ctx.waitUntil(updateCache(forwardRequest, cacheKey, cache, pathname));
          }
          
          // 触发预取
          prefetchRelated(pathname, ctx);
          
          return addSecurityHeaders(response);
        }
      }
      
      // 第三层：从源服务器获取新响应
      const response = await fetch(forwardRequest);
      
      if (response.ok && response.status === 200) {
        let processedResponse = await processApiResponse(response.clone(), pathname);
        const responseText = await processedResponse.text();
        const responseHeaders = Object.fromEntries(processedResponse.headers.entries());
        
        // 生成 ETag
        const etag = generateETag(responseText);
        
        // 添加缓存控制头
        responseHeaders['Cache-Control'] = `public, max-age=${config.ttl}, s-maxage=${config.ttl}, stale-while-revalidate=${config.staleWhileRevalidate}`;
        responseHeaders['CF-Cache-Status'] = 'MISS';
        responseHeaders['Vary'] = 'Accept-Encoding';
        responseHeaders['Date'] = new Date().toUTCString();
        responseHeaders['Cache-Layer'] = 'Origin';
        responseHeaders['ETag'] = etag;
        
        // 创建最终响应
        const finalResponse = new Response(responseText, {
          status: processedResponse.status,
          statusText: processedResponse.statusText,
          headers: responseHeaders
        });
        
        // 异步存储到所有缓存层
        ctx.waitUntil(Promise.all([
          // 存储到 Edge Cache
          cache.put(cacheKey, finalResponse.clone()),
          // 存储到内存缓存
          Promise.resolve(putToMemory(cacheKey, responseText, responseHeaders))
        ]));
        
        // 触发预取
        prefetchRelated(pathname, ctx);
        
        return addSecurityHeaders(finalResponse);
      }
      
      // 非 200 响应，不缓存
      const finalResponse = new Response(response.body, response);
      finalResponse.headers.set('CF-Cache-Status', 'MISS');
      finalResponse.headers.set('Cache-Layer', 'Origin');
      return addSecurityHeaders(finalResponse);
      
    } catch (error) {
      console.error('Worker error:', error);
      
      // 错误处理：尝试直接转发
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

// 异步更新缓存
async function updateCache(forwardRequest, cacheKey, cache, pathname) {
  try {
    const response = await fetch(forwardRequest);
    if (response.ok && response.status === 200) {
      const config = getCacheConfig(pathname);
      let processedResponse = await processApiResponse(response.clone(), pathname);
      const responseText = await processedResponse.text();
      const responseHeaders = Object.fromEntries(processedResponse.headers.entries());
      
      // 生成 ETag
      const etag = generateETag(responseText);
      
      // 添加缓存控制头
      responseHeaders['Cache-Control'] = `public, max-age=${config.ttl}, s-maxage=${config.ttl}, stale-while-revalidate=${config.staleWhileRevalidate}`;
      responseHeaders['CF-Cache-Status'] = 'REVALIDATED';
      responseHeaders['Vary'] = 'Accept-Encoding';
      responseHeaders['Date'] = new Date().toUTCString();
      responseHeaders['ETag'] = etag;
      
      // 创建缓存响应
      const responseToCache = new Response(responseText, {
        status: processedResponse.status,
        statusText: processedResponse.statusText,
        headers: responseHeaders
      });
      
      // 更新缓存
      await cache.put(cacheKey, responseToCache.clone());
      
      // 更新内存缓存
      putToMemory(cacheKey, responseText, responseHeaders);
    }
  } catch (error) {
    console.error('Cache update failed:', error);
  }
}

// 缓存清理函数
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
  
  // 清理内存缓存
  for (const [key, value] of memoryCache.entries()) {
    for (const pattern of patterns) {
      if (key.includes(pattern)) {
        memoryCache.delete(key);
        break;
      }
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
  
  // 清理内存缓存
  memoryCache.delete(cacheKey);
  
  await Promise.all(promises);
}

// 处理缓存清理请求
async function handleCachePurge(request, env) {
  try {
    // 验证授权
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