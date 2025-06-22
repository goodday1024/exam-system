# Cloudflare Worker 配置指南 - KV 优化版

## 概述

这是一个使用 Cloudflare KV 存储优化的 Worker，为考试系统 API 提供多层缓存加速。通过 KV + Edge Cache 的双重缓存策略，显著提升动态页面加载速度，同时确保数据一致性。

## 主要特性

1. **多层缓存架构**：KV 存储（最快） → Edge Cache → 源服务器
2. **智能缓存策略**：根据 API 类型自动调整缓存时间
3. **实时数据保护**：敏感和实时 API 使用短缓存或不缓存
4. **Stale-While-Revalidate**：过期数据先返回，后台异步更新
5. **自动缓存清理**：数据更新时自动清理相关缓存，确保数据一致性
6. **完整的错误处理**：多重降级机制确保服务可用性
7. **安全头添加**：自动添加安全相关的 HTTP 头
8. **缓存管理功能**：支持缓存清理和预热

## 配置步骤

### 1. 创建 KV 命名空间

首先需要创建 Cloudflare KV 存储命名空间：

#### 使用 Wrangler CLI（推荐）

```bash
# 安装 Wrangler
npm install -g wrangler

# 登录 Cloudflare
wrangler auth login

# 创建 KV 命名空间
wrangler kv:namespace create "EXAM_CACHE"
wrangler kv:namespace create "EXAM_CACHE" --preview
```

#### 使用 Cloudflare Dashboard

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 "Workers & Pages" → "KV"
3. 点击 "Create a namespace"
4. 命名空间名称：`EXAM_CACHE`
5. 记录生成的命名空间 ID

### 2. 修改后端服务器地址

在 `cloudflare-worker.js` 文件的第 3 行，将 `ORIGIN_SERVER` 修改为你的实际后端服务器地址：

```javascript
const ORIGIN_SERVER = 'https://your-actual-backend.com';
```

### 3. 配置 wrangler.toml

创建 `wrangler.toml` 配置文件：

```toml
name = "exam-system-cache"
main = "cloudflare-worker.js"
compatibility_date = "2024-01-01"

# KV 命名空间绑定
[[kv_namespaces]]
binding = "KV_STATIC"
id = "your-kv-namespace-id"  # 替换为实际的 KV 命名空间 ID
preview_id = "your-preview-kv-namespace-id"  # 替换为预览环境的 KV 命名空间 ID

# 环境变量（可选）
[vars]
ORIGIN_SERVER = "https://your-actual-backend.com"
CACHE_PURGE_TOKEN = "your-secure-cache-purge-token"  # 缓存清理授权 token
```

### 4. 部署到 Cloudflare Workers

#### 方法一：使用 Wrangler CLI（推荐）

```bash
# 部署到生产环境
wrangler deploy

# 部署到预览环境
wrangler deploy --env preview
```

#### 方法二：使用 Cloudflare Dashboard

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 "Workers & Pages" 部分
3. 点击 "Create application" → "Create Worker"
4. 复制 `cloudflare-worker.js` 的内容到编辑器
5. 在 "Settings" → "Variables" 中添加环境变量：
   - `ORIGIN_SERVER`: 你的后端服务器地址
   - `CACHE_PURGE_TOKEN`: 缓存清理授权 token（建议使用强密码）
6. 在 "Settings" → "KV Namespace Bindings" 中添加 KV 绑定：
   - Variable name: `KV_STATIC`
   - KV namespace: 选择之前创建的命名空间
7. 点击 "Save and Deploy"
3. 点击 "Create application" > "Create Worker"
4. 将 `cloudflare-worker.js` 的内容复制到编辑器中
5. 修改 `ORIGIN_SERVER` 为你的后端地址
6. 点击 "Save and Deploy"

### 3. 后端环境变量配置

为了启用自动缓存清理功能，需要在后端项目中配置以下环境变量：

```bash
# .env.local 文件
CLOUDFLARE_WORKER_URL=https://your-worker.your-subdomain.workers.dev
CACHE_PURGE_TOKEN=your-secure-cache-purge-token
```

**重要说明：**
- `CLOUDFLARE_WORKER_URL`: 你的 Cloudflare Worker 的完整 URL
- `CACHE_PURGE_TOKEN`: 必须与 Worker 中配置的 token 一致
- 如果不配置这些变量，缓存清理功能将被跳过，不会影响正常功能

### 4. 配置自定义域名（可选）

1. 在 Worker 设置中点击 "Triggers"
2. 添加自定义域名或路由
3. 例如：`api.yourdomain.com/*`

## 缓存配置

### 多层缓存策略

新版本使用 **KV + Edge Cache** 双重缓存架构：

1. **KV 存储**：超快访问，较长 TTL
2. **Edge Cache**：快速访问，中等 TTL  
3. **源服务器**：最新数据，按需获取

### 当前缓存策略

```javascript
const CACHE_CONFIG = {
  '/api/marketplace/exams': { 
    ttl: 600,           // Edge Cache: 10分钟
    kvTtl: 1800,        // KV 存储: 30分钟
    staleWhileRevalidate: 900 
  },
  '/api/marketplace/categories': { 
    ttl: 1200,          // Edge Cache: 20分钟
    kvTtl: 3600,        // KV 存储: 1小时
    staleWhileRevalidate: 1800 
  },
  '/api/student/exams': { 
    ttl: 300,           // Edge Cache: 5分钟
    kvTtl: 900,         // KV 存储: 15分钟
    staleWhileRevalidate: 600 
  },
  '/api/teacher/analytics': { 
    ttl: 240,           // Edge Cache: 4分钟
    kvTtl: 720,         // KV 存储: 12分钟
    staleWhileRevalidate: 480 
  }
};
```

### 实时数据路径（短缓存）

```javascript
const REALTIME_PATHS = [
  '/api/student/exam/current',  // 当前考试状态
  '/api/teacher/exam/live',     // 实时考试监控
  '/api/notifications'          // 通知消息
];
```

### 不缓存的敏感路径

```javascript
const NO_CACHE_PATHS = [
  '/api/auth/',           // 认证相关
  '/api/student/submit',  // 学生提交答案
  '/api/student/answer',  // 学生答题
  '/api/teacher/create',  // 教师创建
  '/api/teacher/update',  // 教师更新
  '/api/teacher/delete',  // 教师删除
  '/api/teacher/grade'    // 教师评分
];
```

### 自定义缓存配置

你可以根据需要修改缓存配置：

- `ttl`：Edge Cache 生存时间（秒）
- `kvTtl`：KV 存储生存时间（秒，通常是 ttl 的 2-3 倍）
- `staleWhileRevalidate`：过期后仍可使用的时间（秒）

### 缓存层级说明

1. **KV 层**：最快，适合相对静态的数据
2. **Edge 层**：快速，适合动态但不频繁变化的数据
3. **实时层**：短缓存，适合需要准实时更新的数据

## 监控和调试

### 缓存状态头

Worker 会在响应中添加以下头部，帮助你了解缓存状态：

- `CF-Cache-Status`：
  - `KV-HIT`：KV 缓存命中
  - `KV-STALE`：KV 过期数据
  - `EDGE-HIT`：Edge 缓存命中
  - `EDGE-STALE`：Edge 过期数据
  - `MISS`：缓存未命中
  - `BYPASS`：跳过缓存
  - `REVALIDATED`：缓存已更新
  - `ERROR`：发生错误

- `Cache-Age`：缓存年龄（秒）
- `Cache-Layer`：缓存层级（KV/Edge/Origin）

### 查看日志

在 Cloudflare Dashboard 中：
1. 进入你的 Worker
2. 点击 "Logs" 标签
3. 查看实时日志和错误信息

## 性能优化建议

### 1. 合理设置缓存时间

- **静态数据**（如分类、题库）：
  - Edge Cache: 20-60 分钟
  - KV 存储: 1-4 小时
  
- **半静态数据**（如考试列表）：
  - Edge Cache: 5-15 分钟
  - KV 存储: 30-60 分钟
  
- **动态数据**（如用户状态）：
  - Edge Cache: 1-5 分钟
  - KV 存储: 5-15 分钟
  
- **实时数据**（如考试进行中）：
  - Edge Cache: 30-60 秒
  - KV 存储: 1-2 分钟

### 2. 监控缓存性能

- **KV 命中率目标**：60% 以上
- **Edge 命中率目标**：80% 以上
- **总体命中率目标**：90% 以上
- 通过 `Cache-Layer` 头部分析缓存层级分布

### 3. 自动缓存清理功能

系统在以下操作后会自动清理相关缓存：

**考试相关操作：**
- 创建考试：清理市场页面、学生考试列表、教师仪表板缓存
- 更新考试：清理考试详情、市场页面、相关列表缓存
- 删除考试：清理所有相关缓存
- 发布考试：清理市场页面和考试状态缓存

**题目相关操作：**
- 创建题目：清理题目列表、教师仪表板缓存
- 更新题目：清理题目详情和列表缓存
- 删除题目：清理相关题目缓存

**缓存清理流程：**
1. 后端 API 操作完成后调用 `invalidateCache` 函数
2. 函数向 Cloudflare Worker 发送 POST 请求到 `/__purge_cache` 端点
3. Worker 验证授权 token 后执行缓存清理
4. 同时清理 KV 存储和 Edge Cache 中的相关数据

### 手动缓存管理

除了自动清理，系统还提供手动缓存管理功能：

```javascript
// 清理特定模式的缓存
await purgeCache(['/marketplace', '/student'], env);

// 清理特定路径的缓存
await purgeCacheByPath('/api/marketplace/exams', env);

// 预热重要缓存
await warmupCache([
  'https://your-domain.com/api/marketplace/categories',
  'https://your-domain.com/api/marketplace/exams'
], env);
```

### 4. KV 存储优化

- **键长度控制**：避免超长键名，系统会自动截断
- **数据大小**：单个值建议不超过 25MB
- **访问模式**：KV 适合读多写少的场景
- **地理分布**：KV 数据会自动复制到全球边缘节点

## 故障排除

### 常见问题

1. **KV 存储无法访问**：
   - 检查 `wrangler.toml` 中的 KV 绑定配置
   - 确认 KV 命名空间 ID 正确
   - 验证 Worker 中的 `env.EXAM_CACHE` 是否可用

2. **Worker 无法访问后端**：
   - 检查 `ORIGIN_SERVER` 配置是否正确
   - 确保后端服务器可以从 Cloudflare 访问
   - 检查防火墙和安全组设置

3. **缓存不生效**：
   - 检查请求方法是否为 GET
   - 确认路径不在 `NO_CACHE_PATHS` 中
   - 查看 `Cache-Layer` 头部确认缓存层级

4. **KV 写入失败**：
   - 检查数据大小是否超过限制（25MB）
   - 确认键名长度合理（< 512 字节）
   - 查看 Worker 日志中的错误信息

5. **缓存数据不一致**：
   - 使用 `purgeCacheByPath` 清理特定缓存
   - 检查 `staleWhileRevalidate` 配置
   - 确认实时路径配置正确

### 测试命令

```bash
# 测试缓存状态和层级
curl -I https://your-worker-domain.com/api/marketplace/exams

# 查看详细缓存信息
curl -H "Accept: application/json" -v https://your-worker-domain.com/api/marketplace/exams

# 测试不同 API 端点的缓存行为
curl -I https://your-worker-domain.com/api/student/exams
curl -I https://your-worker-domain.com/api/teacher/analytics

# 测试实时路径（应该有短缓存）
curl -I https://your-worker-domain.com/api/student/exam/current
```

### KV 存储调试

```bash
# 使用 Wrangler 查看 KV 数据
wrangler kv:key list --binding EXAM_CACHE

# 查看特定键的值
wrangler kv:key get "kv:/api/marketplace/exams" --binding EXAM_CACHE

# 删除特定键
wrangler kv:key delete "kv:/api/marketplace/exams" --binding EXAM_CACHE
```

## 安全特性

新版本 Worker 自动添加以下安全头部：

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`

这些头部有助于防止常见的 Web 安全攻击。

## 替代方案

如果你不想使用 Cloudflare Worker，也可以考虑以下替代方案：

### 1. Next.js 内置缓存

在 API 路由中添加缓存头：

```javascript
// app/api/marketplace/exams/route.js
export async function GET() {
  const data = await fetchExams();
  
  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300, s-maxage=300'
    }
  });
}
```

### 2. Cloudflare 页面规则

在 Cloudflare Dashboard 中设置页面规则：

1. 进入 "Rules" > "Page Rules"
2. 添加规则：`yourdomain.com/api/marketplace/*`
3. 设置："Cache Level" = "Cache Everything"
4. 设置："Edge Cache TTL" = "5 minutes"

### 3. CDN 缓存配置

如果使用其他 CDN，可以配置类似的缓存规则。

---

这个重写的 Worker 更加稳定和可靠，应该能够解决之前遇到的 URL 错误问题。如果还有问题，请检查 Cloudflare Dashboard 中的日志获取更多信息。