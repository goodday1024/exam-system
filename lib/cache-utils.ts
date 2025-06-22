// 缓存工具函数
// 用于管理 Cloudflare 缓存失效和优化

interface CacheInvalidationConfig {
  zoneId?: string;
  apiToken?: string;
  baseUrl?: string;
}

// 缓存失效模式
const CACHE_PATTERNS = {
  // 考试相关
  EXAMS: [
    '/api/teacher/exams',
    '/api/student/exams',
    '/api/marketplace/exams'
  ],
  
  // 题目相关
  QUESTIONS: [
    '/api/teacher/questions'
  ],
  
  // 学生管理
  STUDENTS: [
    '/api/teacher/students'
  ],
  
  // 分析数据
  ANALYTICS: [
    '/api/teacher/analytics'
  ],
  
  // 商城相关
  MARKETPLACE: [
    '/api/marketplace/exams'
  ]
};

// 缓存失效函数
export async function invalidateCache(
  patterns: string[],
  config?: CacheInvalidationConfig
): Promise<boolean> {
  try {
    // 如果在 Cloudflare Workers 环境中
    if (typeof caches !== 'undefined') {
      // 获取默认缓存实例，使用类型断言避免类型错误
      const cache = (caches as any).default;
      const keys = await cache.keys();
      
      for (const key of keys) {
        const url = new URL(key.url);
        for (const pattern of patterns) {
          if (url.pathname.startsWith(pattern)) {
            await cache.delete(key);
            break;
          }
        }
      }
      return true;
    }
    
    // 如果有 Cloudflare API 配置，使用 API 清理
    if (config?.zoneId && config?.apiToken) {
      const baseUrl = config.baseUrl || process.env.NEXT_PUBLIC_BASE_URL || 'https://localhost:3000';
      const urls = patterns.map(pattern => `${baseUrl}${pattern}`);
      
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${config.zoneId}/purge_cache`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${config.apiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ files: urls })
        }
      );
      
      const result = await response.json();
      return result.success;
    }
    
    console.warn('缓存失效跳过：未配置 Cloudflare 环境');
    return false;
  } catch (error) {
    console.error('缓存失效失败:', error);
    return false;
  }
}

// 预定义的缓存失效函数
export const invalidateExamCache = () => 
  invalidateCache(CACHE_PATTERNS.EXAMS);

export const invalidateQuestionCache = () => 
  invalidateCache(CACHE_PATTERNS.QUESTIONS);

export const invalidateStudentCache = () => 
  invalidateCache(CACHE_PATTERNS.STUDENTS);

export const invalidateAnalyticsCache = () => 
  invalidateCache(CACHE_PATTERNS.ANALYTICS);

export const invalidateMarketplaceCache = () => 
  invalidateCache(CACHE_PATTERNS.MARKETPLACE);

// 智能缓存失效
// 根据操作类型自动选择需要失效的缓存
export async function smartCacheInvalidation(
  operation: 'exam' | 'question' | 'student' | 'marketplace' | 'grade',
  config?: CacheInvalidationConfig
): Promise<void> {
  const patterns: string[] = [];
  
  switch (operation) {
    case 'exam':
      patterns.push(...CACHE_PATTERNS.EXAMS, ...CACHE_PATTERNS.ANALYTICS);
      break;
    case 'question':
      patterns.push(...CACHE_PATTERNS.QUESTIONS, ...CACHE_PATTERNS.ANALYTICS);
      break;
    case 'student':
      patterns.push(...CACHE_PATTERNS.STUDENTS, ...CACHE_PATTERNS.ANALYTICS);
      break;
    case 'marketplace':
      patterns.push(...CACHE_PATTERNS.MARKETPLACE);
      break;
    case 'grade':
      patterns.push(...CACHE_PATTERNS.ANALYTICS);
      break;
  }
  
  if (patterns.length > 0) {
    await invalidateCache(patterns, config);
  }
}

// 缓存预热函数
export async function warmupCache(urls: string[]): Promise<void> {
  try {
    const promises = urls.map(url => 
      fetch(url, { 
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache'
        }
      }).catch(error => {
        console.warn(`缓存预热失败 ${url}:`, error);
      })
    );
    
    await Promise.all(promises);
    console.log(`缓存预热完成，共 ${urls.length} 个 URL`);
  } catch (error) {
    console.error('缓存预热失败:', error);
  }
}

// 获取缓存状态
export async function getCacheStatus(url: string): Promise<{
  cached: boolean;
  age?: number;
  hitStatus?: string;
}> {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    
    return {
      cached: response.headers.has('cf-cache-status'),
      age: response.headers.has('age') ? 
        parseInt(response.headers.get('age') || '0') : undefined,
      hitStatus: response.headers.get('cf-cache-status') || undefined
    };
  } catch (error) {
    console.error('获取缓存状态失败:', error);
    return { cached: false };
  }
}

// 缓存性能监控
export class CacheMonitor {
  private stats = {
    hits: 0,
    misses: 0,
    errors: 0,
    totalRequests: 0
  };
  
  recordHit() {
    this.stats.hits++;
    this.stats.totalRequests++;
  }
  
  recordMiss() {
    this.stats.misses++;
    this.stats.totalRequests++;
  }
  
  recordError() {
    this.stats.errors++;
    this.stats.totalRequests++;
  }
  
  getStats() {
    const hitRate = this.stats.totalRequests > 0 ? 
      (this.stats.hits / this.stats.totalRequests) * 100 : 0;
    
    return {
      ...this.stats,
      hitRate: Math.round(hitRate * 100) / 100
    };
  }
  
  reset() {
    this.stats = {
      hits: 0,
      misses: 0,
      errors: 0,
      totalRequests: 0
    };
  }
}

// 全局缓存监控实例
export const cacheMonitor = new CacheMonitor();

// 缓存配置
export const CACHE_CONFIG = {
  // 短期缓存（2分钟）
  SHORT: 'public, s-maxage=120, stale-while-revalidate=240',
  
  // 中期缓存（5分钟）
  MEDIUM: 'public, s-maxage=300, stale-while-revalidate=600',
  
  // 长期缓存（10分钟）
  LONG: 'public, s-maxage=600, stale-while-revalidate=1200',
  
  // 静态资源缓存（1年）
  STATIC: 'public, max-age=31536000, immutable',
  
  // 不缓存
  NO_CACHE: 'no-cache, no-store, must-revalidate'
};

// 设置响应缓存头的辅助函数
export function setCacheHeaders(
  response: Response, 
  cacheType: keyof typeof CACHE_CONFIG
): Response {
  response.headers.set('Cache-Control', CACHE_CONFIG[cacheType]);
  response.headers.set('Vary', 'Accept-Encoding');
  
  if (cacheType !== 'NO_CACHE') {
    response.headers.set('CDN-Cache-Control', CACHE_CONFIG[cacheType]);
  }
  
  return response;
}