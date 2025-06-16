# 异步代码评测系统

## 概述

异步代码评测系统是为了解决Vercel等云平台的函数执行时间限制而设计的解决方案。通过将长时间的代码评测任务放入队列中异步处理，避免了因超时导致的评测失败问题。

## 系统架构

### 核心组件

1. **EvaluationTask 模型** (`/lib/models/EvaluationTask.ts`)
   - 存储评测任务的状态和进度信息
   - 支持任务状态跟踪：pending、processing、completed、failed
   - 记录评测进度和结果

2. **EvaluationQueue 队列管理器** (`/lib/evaluationQueue.ts`)
   - 单例模式的队列处理器
   - 自动处理待评测任务
   - 集成原有的CodeJudgeClient评测逻辑

3. **API 接口**
   - `/api/teacher/exams/[id]/evaluate-async` - 启动异步评测
   - `/api/teacher/evaluation-tasks/[taskId]` - 查询任务状态
   - `/api/teacher/evaluation-tasks` - 获取任务列表

4. **前端组件**
   - `AsyncEvaluationProgress` - 评测进度显示组件
   - `/teacher/evaluation-tasks` - 任务管理页面

## 使用流程

### 1. 启动异步评测

在考试详情页面，如果考试包含编程题，会显示"异步代码评测"卡片：

```typescript
// 启动评测
POST /api/teacher/exams/{examId}/evaluate-async

// 响应
{
  "success": true,
  "taskId": "task_id_here",
  "message": "评测任务已添加到队列，请稍后查看结果",
  "totalQuestions": 3
}
```

### 2. 监控评测进度

系统会自动轮询任务状态，实时显示评测进度：

```typescript
// 查询任务状态
GET /api/teacher/evaluation-tasks/{taskId}

// 响应
{
  "taskId": "task_id_here",
  "examId": "exam_id_here",
  "status": "processing",
  "progress": {
    "total": 3,
    "completed": 1,
    "current": "算法题1",
    "percentage": 33
  },
  "createdAt": "2024-01-01T10:00:00Z",
  "updatedAt": "2024-01-01T10:05:00Z"
}
```

### 3. 查看评测结果

评测完成后，可以在任务管理页面查看详细结果：

```typescript
// 完成状态的响应
{
  "status": "completed",
  "results": [
    {
      "questionId": "q1",
      "questionTitle": "算法题1",
      "totalSubmissions": 25,
      "results": [
        {
          "submissionId": "s1",
          "userId": "u1",
          "status": "completed",
          "score": 85,
          "details": {
            "totalTests": 10,
            "passedTests": 8
          }
        }
      ]
    }
  ]
}
```

## 技术特性

### 1. 队列处理机制

- **自动调度**：每5秒检查一次待处理任务
- **单任务处理**：确保同时只处理一个任务，避免资源冲突
- **进度跟踪**：实时更新任务进度和当前处理状态
- **错误处理**：自动捕获和记录评测过程中的错误

### 2. 超时控制

```typescript
// 代码执行超时设置
const timeout = 50000 // 50秒，符合Vercel限制

// 健康检查超时
const healthCheckTimeout = 15000 // 15秒
```

### 3. 状态管理

- **pending**: 任务已创建，等待处理
- **processing**: 正在处理中
- **completed**: 处理完成
- **failed**: 处理失败

### 4. 进度计算

```typescript
const progressPercentage = task.progress.total > 0 
  ? Math.round((task.progress.completed / task.progress.total) * 100)
  : 0
```

## 部署配置

### 环境变量

```bash
# 自建代码评测服务配置
SELF_HOSTED_JUDGE_URL=http://localhost:3001
SELF_HOSTED_JUDGE_API_KEY=your_api_key_here

# 数据库配置
MONGODB_URI=mongodb://localhost:27017/exam_system
```

### 数据库索引

系统会自动创建以下索引以优化查询性能：

```javascript
// 复合索引
{ examId: 1, teacherId: 1 } // 唯一索引
{ status: 1, createdAt: 1 }

// 单字段索引
{ examId: 1 }
{ teacherId: 1 }
{ status: 1 }
{ createdAt: 1 }
```

## 监控和维护

### 1. 任务清理

建议定期清理已完成的旧任务：

```javascript
// 清理30天前的已完成任务
db.evaluationtasks.deleteMany({
  status: { $in: ['completed', 'failed'] },
  createdAt: { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
})
```

### 2. 性能监控

- 监控队列长度和处理时间
- 跟踪失败任务的错误原因
- 监控代码评测服务的健康状态

### 3. 错误处理

系统会自动处理以下错误情况：

- 代码评测服务不可用
- 网络超时
- 代码编译错误
- 运行时错误

## 扩展功能

### 1. 批量评测

可以扩展支持多个考试的批量评测：

```typescript
// 批量启动评测
POST /api/teacher/exams/batch-evaluate
{
  "examIds": ["exam1", "exam2", "exam3"]
}
```

### 2. 优先级队列

可以为紧急任务设置更高的优先级：

```typescript
interface EvaluationTask {
  priority: 'low' | 'normal' | 'high'
  // ...
}
```

### 3. 分布式处理

对于大规模部署，可以考虑使用Redis或RabbitMQ实现分布式队列。

## 故障排除

### 常见问题

1. **任务卡在processing状态**
   - 检查代码评测服务是否正常运行
   - 查看任务的错误日志
   - 手动重置任务状态

2. **评测结果不准确**
   - 检查测试用例是否正确
   - 验证代码评测服务的配置
   - 查看详细的评测日志

3. **队列处理缓慢**
   - 检查数据库连接性能
   - 优化代码评测服务的响应时间
   - 考虑增加并发处理能力

### 调试命令

```bash
# 查看当前队列状态
curl -X GET "http://localhost:3000/api/teacher/evaluation-tasks" \
  -H "Cookie: token=your_token"

# 查看特定任务状态
curl -X GET "http://localhost:3000/api/teacher/evaluation-tasks/{taskId}" \
  -H "Cookie: token=your_token"
```

## 总结

异步代码评测系统有效解决了云平台函数执行时间限制的问题，提供了：

- ✅ 可靠的长时间任务处理
- ✅ 实时的进度跟踪
- ✅ 完善的错误处理
- ✅ 用户友好的界面
- ✅ 可扩展的架构设计

通过这个系统，教师可以放心地对包含复杂编程题的考试进行自动评测，而不用担心超时问题。