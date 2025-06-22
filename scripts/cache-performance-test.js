#!/usr/bin/env node

// API 缓存性能测试脚本
// 用于测试 Cloudflare 缓存配置的效果

const https = require('https');
const http = require('http');
const { performance } = require('perf_hooks');

// 配置
const CONFIG = {
  baseUrl: process.env.TEST_BASE_URL || 'http://localhost:3000',
  testDuration: 60000, // 测试持续时间（毫秒）
  concurrency: 10, // 并发请求数
  endpoints: [
    '/api/marketplace/exams',
    '/api/teacher/analytics',
    '/api/teacher/students',
    '/api/student/exams',
    '/api/teacher/questions',
    '/api/teacher/exams'
  ]
};

// 测试结果统计
class TestStats {
  constructor() {
    this.requests = 0;
    this.responses = 0;
    this.errors = 0;
    this.totalTime = 0;
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.responseTimes = [];
    this.cacheStatuses = {};
  }
  
  addResponse(responseTime, cacheStatus) {
    this.responses++;
    this.totalTime += responseTime;
    this.responseTimes.push(responseTime);
    
    if (cacheStatus) {
      this.cacheStatuses[cacheStatus] = (this.cacheStatuses[cacheStatus] || 0) + 1;
      
      if (cacheStatus === 'HIT') {
        this.cacheHits++;
      } else {
        this.cacheMisses++;
      }
    }
  }
  
  addError() {
    this.errors++;
  }
  
  getStats() {
    const avgResponseTime = this.responses > 0 ? this.totalTime / this.responses : 0;
    const cacheHitRate = (this.cacheHits + this.cacheMisses) > 0 ? 
      (this.cacheHits / (this.cacheHits + this.cacheMisses)) * 100 : 0;
    
    // 计算百分位数
    const sortedTimes = this.responseTimes.sort((a, b) => a - b);
    const p50 = sortedTimes[Math.floor(sortedTimes.length * 0.5)] || 0;
    const p95 = sortedTimes[Math.floor(sortedTimes.length * 0.95)] || 0;
    const p99 = sortedTimes[Math.floor(sortedTimes.length * 0.99)] || 0;
    
    return {
      totalRequests: this.requests,
      successfulResponses: this.responses,
      errors: this.errors,
      avgResponseTime: Math.round(avgResponseTime),
      p50ResponseTime: Math.round(p50),
      p95ResponseTime: Math.round(p95),
      p99ResponseTime: Math.round(p99),
      cacheHitRate: Math.round(cacheHitRate * 100) / 100,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      cacheStatuses: this.cacheStatuses
    };
  }
}

// HTTP 请求函数
function makeRequest(url) {
  return new Promise((resolve) => {
    const startTime = performance.now();
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;
    
    const req = client.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const endTime = performance.now();
        const responseTime = endTime - startTime;
        const cacheStatus = res.headers['cf-cache-status'] || res.headers['x-cache-status'];
        
        resolve({
          success: true,
          responseTime,
          cacheStatus,
          statusCode: res.statusCode,
          contentLength: data.length
        });
      });
    });
    
    req.on('error', (error) => {
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      resolve({
        success: false,
        responseTime,
        error: error.message
      });
    });
    
    req.setTimeout(10000, () => {
      req.destroy();
      resolve({
        success: false,
        responseTime: 10000,
        error: 'Timeout'
      });
    });
  });
}

// 运行单个端点测试
async function testEndpoint(endpoint, duration, concurrency) {
  const stats = new TestStats();
  const url = `${CONFIG.baseUrl}${endpoint}`;
  const endTime = Date.now() + duration;
  
  console.log(`\n测试端点: ${endpoint}`);
  console.log(`并发数: ${concurrency}, 持续时间: ${duration/1000}秒`);
  
  const workers = [];
  
  // 创建并发工作者
  for (let i = 0; i < concurrency; i++) {
    workers.push(async () => {
      while (Date.now() < endTime) {
        stats.requests++;
        
        try {
          const result = await makeRequest(url);
          
          if (result.success) {
            stats.addResponse(result.responseTime, result.cacheStatus);
          } else {
            stats.addError();
          }
        } catch (error) {
          stats.addError();
        }
        
        // 短暂延迟避免过度请求
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    });
  }
  
  // 运行所有工作者
  await Promise.all(workers.map(worker => worker()));
  
  return stats.getStats();
}

// 运行完整测试套件
async function runFullTest() {
  console.log('🚀 开始 API 缓存性能测试');
  console.log(`基础 URL: ${CONFIG.baseUrl}`);
  console.log(`测试持续时间: ${CONFIG.testDuration/1000}秒`);
  console.log(`并发数: ${CONFIG.concurrency}`);
  console.log('=' * 50);
  
  const allResults = {};
  
  for (const endpoint of CONFIG.endpoints) {
    try {
      const result = await testEndpoint(endpoint, CONFIG.testDuration, CONFIG.concurrency);
      allResults[endpoint] = result;
      
      // 显示结果
      console.log('\n📊 测试结果:');
      console.log(`  总请求数: ${result.totalRequests}`);
      console.log(`  成功响应: ${result.successfulResponses}`);
      console.log(`  错误数: ${result.errors}`);
      console.log(`  平均响应时间: ${result.avgResponseTime}ms`);
      console.log(`  P50 响应时间: ${result.p50ResponseTime}ms`);
      console.log(`  P95 响应时间: ${result.p95ResponseTime}ms`);
      console.log(`  P99 响应时间: ${result.p99ResponseTime}ms`);
      console.log(`  缓存命中率: ${result.cacheHitRate}%`);
      console.log(`  缓存命中: ${result.cacheHits}`);
      console.log(`  缓存未命中: ${result.cacheMisses}`);
      console.log(`  缓存状态分布:`, result.cacheStatuses);
      
    } catch (error) {
      console.error(`❌ 测试端点 ${endpoint} 失败:`, error.message);
      allResults[endpoint] = { error: error.message };
    }
  }
  
  // 生成汇总报告
  generateSummaryReport(allResults);
}

// 生成汇总报告
function generateSummaryReport(results) {
  console.log('\n' + '=' * 50);
  console.log('📈 汇总报告');
  console.log('=' * 50);
  
  let totalRequests = 0;
  let totalResponses = 0;
  let totalErrors = 0;
  let totalCacheHits = 0;
  let totalCacheMisses = 0;
  let avgResponseTimes = [];
  
  Object.entries(results).forEach(([endpoint, stats]) => {
    if (!stats.error) {
      totalRequests += stats.totalRequests;
      totalResponses += stats.successfulResponses;
      totalErrors += stats.errors;
      totalCacheHits += stats.cacheHits;
      totalCacheMisses += stats.cacheMisses;
      avgResponseTimes.push(stats.avgResponseTime);
    }
  });
  
  const overallAvgResponseTime = avgResponseTimes.length > 0 ? 
    avgResponseTimes.reduce((a, b) => a + b, 0) / avgResponseTimes.length : 0;
  
  const overallCacheHitRate = (totalCacheHits + totalCacheMisses) > 0 ? 
    (totalCacheHits / (totalCacheHits + totalCacheMisses)) * 100 : 0;
  
  console.log(`\n🎯 整体性能指标:`);
  console.log(`  总请求数: ${totalRequests}`);
  console.log(`  成功响应: ${totalResponses}`);
  console.log(`  错误数: ${totalErrors}`);
  console.log(`  成功率: ${totalRequests > 0 ? ((totalResponses / totalRequests) * 100).toFixed(2) : 0}%`);
  console.log(`  平均响应时间: ${Math.round(overallAvgResponseTime)}ms`);
  console.log(`  整体缓存命中率: ${overallCacheHitRate.toFixed(2)}%`);
  
  // 性能评级
  console.log(`\n🏆 性能评级:`);
  if (overallAvgResponseTime < 100) {
    console.log(`  响应时间: 优秀 (< 100ms)`);
  } else if (overallAvgResponseTime < 300) {
    console.log(`  响应时间: 良好 (< 300ms)`);
  } else if (overallAvgResponseTime < 500) {
    console.log(`  响应时间: 一般 (< 500ms)`);
  } else {
    console.log(`  响应时间: 需要优化 (>= 500ms)`);
  }
  
  if (overallCacheHitRate > 80) {
    console.log(`  缓存效率: 优秀 (> 80%)`);
  } else if (overallCacheHitRate > 60) {
    console.log(`  缓存效率: 良好 (> 60%)`);
  } else if (overallCacheHitRate > 40) {
    console.log(`  缓存效率: 一般 (> 40%)`);
  } else {
    console.log(`  缓存效率: 需要优化 (<= 40%)`);
  }
  
  // 建议
  console.log(`\n💡 优化建议:`);
  if (overallAvgResponseTime > 300) {
    console.log(`  - 考虑增加缓存时间或优化数据库查询`);
  }
  if (overallCacheHitRate < 60) {
    console.log(`  - 检查缓存配置，确保 Cloudflare 缓存正常工作`);
  }
  if (totalErrors > totalRequests * 0.01) {
    console.log(`  - 错误率较高，检查服务器稳定性`);
  }
  
  console.log('\n✅ 测试完成!');
}

// 命令行参数处理
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
使用方法: node cache-performance-test.js [选项]

选项:
  --url <url>        设置基础 URL (默认: http://localhost:3000)
  --duration <ms>    设置测试持续时间，毫秒 (默认: 60000)
  --concurrency <n>  设置并发数 (默认: 10)
  --endpoint <path>  只测试指定端点
  --help, -h         显示帮助信息

示例:
  node cache-performance-test.js --url https://your-domain.com --duration 30000
  node cache-performance-test.js --endpoint /api/marketplace/exams
`);
    process.exit(0);
  }
  
  // 解析命令行参数
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i];
    const value = args[i + 1];
    
    switch (flag) {
      case '--url':
        CONFIG.baseUrl = value;
        break;
      case '--duration':
        CONFIG.testDuration = parseInt(value);
        break;
      case '--concurrency':
        CONFIG.concurrency = parseInt(value);
        break;
      case '--endpoint':
        CONFIG.endpoints = [value];
        break;
    }
  }
  
  runFullTest().catch(error => {
    console.error('❌ 测试失败:', error);
    process.exit(1);
  });
}

module.exports = {
  testEndpoint,
  runFullTest,
  TestStats
};