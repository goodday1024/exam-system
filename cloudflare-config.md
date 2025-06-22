# Cloudflare 缓存优化配置指南

## 概述

本文档详细说明如何配置 Cloudflare 来优化考试系统的 API 响应速度和缓存策略。

## 1. Cloudflare Workers 部署

### 步骤 1: 创建 Worker

1. 登录 Cloudflare 控制台
2. 进入 "Workers & Pages" 部分
3. 点击 "Create application"
4. 选择 "Create Worker"
5. 将 `cloudflare-worker.js` 的内容复制到编辑器中
6. 点击 "Save and Deploy"

### 步骤 2: 配置路由

1. 在 Worker 详情页面，点击 "Triggers" 标签
2. 添加自定义域名路由：`your-domain.com/api/*`
3. 确保路由优先级高于其他规则

## 2. 页面规则配置

在 Cloudflare 控制台的 "Rules" > "Page Rules" 中添加以下规则：

### 规则 1: API 缓存优化
```
URL: your-domain.com/api/marketplace/exams*
设置:
- Cache Level: Cache Everything
- Edge Cache TTL: 5 minutes
- Browser Cache TTL: 5 minutes
```

### 规则 2: 分析数据缓存
```
URL: your-domain.com/api/teacher/analytics*
设置:
- Cache Level: Cache Everything
- Edge Cache TTL: 3 minutes
- Browser Cache TTL: 3 minutes
```

### 规则 3: 学生管理缓存
```
URL: your-domain.com/api/teacher/students*
设置:
- Cache Level: Cache Everything
- Edge Cache TTL: 10 minutes
- Browser Cache TTL: 10 minutes
```

### 规则 4: 学生考试列表缓存
```
URL: your-domain.com/api/student/exams*
设置:
- Cache Level: Cache Everything
- Edge Cache TTL: 2 minutes
- Browser Cache TTL: 2 minutes
```

### 规则 5: 静态资源长期缓存
```
URL: your-domain.com/_next/static/*
设置:
- Cache Level: Cache Everything
- Edge Cache TTL: 1 year
- Browser Cache TTL: 1 year
```

### 规则 6: 敏感 API 不缓存
```
URL: your-domain.com/api/auth/*
设置:
- Cache Level: Bypass
```

```
URL: your-domain.com/api/*/submit*
设置:
- Cache Level: Bypass
```

```
URL: your-domain.com/api/*/grade*
设置:
- Cache Level: Bypass
```

## 3. 缓存设置优化

### 3.1 缓存级别设置

在 "Caching" > "Configuration" 中：

- **Caching Level**: Standard
- **Browser Cache TTL**: Respect Existing Headers
- **Always Online**: On
- **Development Mode**: Off（生产环境）

### 3.2 自定义缓存键

在 "Caching" > "Cache Keys" 中：

- 启用 "Custom Cache Key"
- 包含查询字符串参数：`page`, `limit`, `category`, `difficulty`, `search`, `sortBy`, `sortOrder`
- 忽略其他查询参数

## 4. 性能优化设置

### 4.1 速度优化

在 "Speed" > "Optimization" 中启用：

- **Auto Minify**: HTML, CSS, JavaScript
- **Brotli**: On
- **Early Hints**: On
- **HTTP/2**: On
- **HTTP/3 (with QUIC)**: On
- **0-RTT Connection Resumption**: On

### 4.2 图片优化

在 "Speed" > "Optimization" 中启用：

- **Polish**: Lossy
- **WebP**: On
- **AVIF**: On

## 5. 安全设置

### 5.1 安全头部

在 "Security" > "Headers" 中配置：

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

### 5.2 防火墙规则

在 "Security" > "WAF" 中添加：

1. **速率限制规则**：
   - 路径：`/api/*`
   - 限制：每分钟 100 请求
   - 动作：Challenge

2. **地理位置过滤**（可选）：
   - 允许特定国家/地区访问
   - 阻止可疑地区

## 6. 监控和分析

### 6.1 缓存分析

在 "Analytics & Logs" > "Caching" 中监控：

- 缓存命中率
- 带宽节省
- 响应时间改善

### 6.2 性能监控

在 "Analytics & Logs" > "Performance" 中查看：

- 页面加载时间
- Core Web Vitals
- 用户体验指标

## 7. 缓存清理策略

### 7.1 自动清理

使用 Cloudflare API 在数据更新时清理相关缓存：

```javascript
// 清理特定 API 缓存
const purgeCache = async (patterns) => {
  const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/purge_cache`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      files: patterns
    })
  });
  return response.json();
};

// 使用示例
await purgeCache([
  'https://your-domain.com/api/marketplace/exams',
  'https://your-domain.com/api/teacher/analytics'
]);
```

### 7.2 手动清理

在 Cloudflare 控制台的 "Caching" > "Configuration" 中：

- **Purge Everything**: 清理所有缓存
- **Custom Purge**: 清理特定 URL 或标签

## 8. 测试和验证

### 8.1 缓存测试

使用以下命令测试缓存状态：

```bash
# 检查缓存头
curl -I https://your-domain.com/api/marketplace/exams

# 查看 CF-Cache-Status
curl -H "Accept: application/json" https://your-domain.com/api/marketplace/exams
```

### 8.2 性能测试

使用工具测试性能改善：

- **GTmetrix**: 页面加载速度
- **WebPageTest**: 详细性能分析
- **Lighthouse**: Core Web Vitals

## 9. 故障排除

### 9.1 常见问题

1. **缓存未命中**：
   - 检查缓存规则配置
   - 验证 Cache-Control 头部
   - 确认 Worker 路由正确

2. **数据不更新**：
   - 检查 TTL 设置
   - 手动清理缓存
   - 验证 stale-while-revalidate 逻辑

3. **认证问题**：
   - 确保敏感 API 不被缓存
   - 检查 Cookie 处理
   - 验证用户权限

### 9.2 调试工具

- **Cloudflare Analytics**: 查看缓存性能
- **Browser DevTools**: 检查网络请求
- **Worker Logs**: 调试 Worker 逻辑

## 10. 最佳实践

1. **渐进式部署**：先在测试环境验证配置
2. **监控指标**：持续监控缓存命中率和性能
3. **定期优化**：根据使用模式调整缓存策略
4. **安全优先**：确保敏感数据不被缓存
5. **用户体验**：平衡缓存时间和数据新鲜度

## 预期效果

正确配置后，您应该看到：

- **API 响应时间**：减少 50-80%
- **服务器负载**：降低 60-90%
- **带宽使用**：节省 40-70%
- **用户体验**：页面加载速度提升 2-5 倍
- **缓存命中率**：达到 80-95%

通过这些优化，考试系统的性能将得到显著提升，用户体验也会大幅改善。