# 从 Prisma 到 Mongoose 迁移指南

本项目已经开始从 Prisma + SQLite 迁移到 Mongoose + MongoDB。以下是完成迁移所需的步骤。

## 已完成的工作

✅ 安装了 Mongoose 和相关类型定义  
✅ 创建了 MongoDB 连接配置 (`lib/mongodb.ts`)  
✅ 创建了所有 Mongoose 数据模型：
- `lib/models/User.ts`
- `lib/models/Question.ts`
- `lib/models/Exam.ts`
- `lib/models/ExamResult.ts`
- `lib/models/Appeal.ts`
- `lib/models/index.ts` (统一导出)

✅ 更新了环境变量配置 (`.env.example`)  
✅ 移除了 Prisma 依赖和相关文件  
✅ 更新了所有 API 路由 - 全部完成！

### 认证相关
- `app/api/auth/register/route.ts` - 用户注册
- `app/api/auth/login/route.ts` - 用户登录
- `app/api/auth/me/route.ts` - 获取用户信息

### 教师功能
- `app/api/teacher/questions/route.ts` - 教师题目管理
- `app/api/teacher/questions/[id]/route.ts` - 教师题目详情
- `app/api/teacher/exams/route.ts` - 教师考试管理
- `app/api/teacher/exams/[id]/route.ts` - 教师考试详情
- `app/api/teacher/exams/[id]/results/route.ts` - 教师考试成绩查看
- `app/api/teacher/exams/[id]/grade/route.ts` - 教师考试自动判分
- `app/api/teacher/exams/[id]/publish/route.ts` - 教师考试成绩发布

### 学生功能
- `app/api/student/exams/route.ts` - 学生考试列表
- `app/api/student/exam/[id]/route.ts` - 学生考试详情
- `app/api/student/exam/[id]/start/route.ts` - 学生开始考试
- `app/api/student/exam/[id]/save/route.ts` - 学生保存答案
- `app/api/student/exam/[id]/submit/route.ts` - 学生提交考试
- `app/api/student/exam/[id]/result/route.ts` - 学生查看考试结果
- `app/api/student/exam/[id]/tab-switch/route.ts` - 学生标签页切换记录

✅ 创建了环境配置示例文件 (`.env.local.example`)  
✅ 开发服务器已成功启动并运行

## 迁移完成状态

🎉 **所有 API 路由迁移已完成！**

从 Prisma 到 Mongoose 的数据库迁移工作已经全部完成，包括：
- 15 个 API 路由全部迁移完成
- 所有数据库操作已从 Prisma 语法转换为 Mongoose 语法
- 认证系统已更新为使用 JWT token 和 cookies
- 数据模型关系已正确配置

## 部署和使用指南

### 1. 环境配置

创建 `.env.local` 文件并配置 MongoDB 连接：

```env
# 本地 MongoDB
DATABASE_URL="mongodb://localhost:27017/exam-system"

# 或者使用 MongoDB Atlas
# DATABASE_URL="mongodb+srv://username:password@cluster.mongodb.net/exam-system"

# JWT 密钥
JWT_SECRET="your-super-secret-jwt-key"

# NextAuth 配置
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-nextauth-secret"
```

### 2. 安装和启动 MongoDB

**选项 A: 本地安装 MongoDB**
```bash
# macOS (使用 Homebrew)
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb/brew/mongodb-community

# 或者使用 Docker
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

**选项 B: 使用 MongoDB Atlas (推荐)**
1. 访问 [MongoDB Atlas](https://www.mongodb.com/atlas)
2. 创建免费集群
3. 获取连接字符串并更新 `.env.local`

### 3. 验证迁移结果

所有 API 路由已成功迁移到 Mongoose：

#### 教师相关 API ✅
- `app/api/teacher/exams/[id]/results/route.ts` - 考试结果管理
- `app/api/teacher/exams/[id]/grade/route.ts` - 考试评分
- `app/api/teacher/exams/[id]/publish/route.ts` - 发布考试

#### 学生相关 API ✅
- `app/api/student/exam/[id]/route.ts` - 学生考试详情
- `app/api/student/exam/[id]/start/route.ts` - 开始考试
- `app/api/student/exam/[id]/submit/route.ts` - 提交考试
- `app/api/student/exam/[id]/result/route.ts` - 考试结果
- `app/api/student/exam/[id]/save/route.ts` - 保存答案
- `app/api/student/exam/[id]/tab-switch/route.ts` - 标签切换记录

> **完成**: 所有 API 路由已从 `prisma.model.method()` 成功转换为对应的 Mongoose 语法。

### 4. 迁移模式对比

#### Prisma vs Mongoose 语法对比

**查询单个记录：**
```typescript
// Prisma
const user = await prisma.user.findUnique({ where: { email } })

// Mongoose
const user = await User.findOne({ email })
```

**查询多个记录：**
```typescript
// Prisma
const questions = await prisma.question.findMany({
  where: { createdBy: userId },
  orderBy: { createdAt: 'desc' }
})

// Mongoose
const questions = await Question.find({ createdBy: userId })
  .sort({ createdAt: -1 })
```

**创建记录：**
```typescript
// Prisma
const user = await prisma.user.create({
  data: { email, password, name, campus, role }
})

// Mongoose
const user = await User.create({
  email, password, name, campus, role
})
```

**关联查询：**
```typescript
// Prisma
const exam = await prisma.exam.findUnique({
  where: { id },
  include: { creator: true, examQuestions: { include: { question: true } } }
})

// Mongoose
const exam = await Exam.findById(id)
  .populate('createdBy', 'name email')
  .populate('questions.questionId')
```

### 5. 数据模型差异

#### 主要变化：
1. **ID 字段**：Prisma 的 `cuid()` 改为 MongoDB 的 `ObjectId`
2. **关系处理**：Mongoose 使用 `populate()` 而不是 `include`
3. **嵌入文档**：考试题目现在作为嵌入文档存储在 Exam 模型中
4. **索引**：在 Mongoose 中需要手动定义唯一索引

### 6. 测试迁移

1. 启动开发服务器：
   ```bash
   npm run dev
   ```

2. 测试基本功能：
   - 用户注册/登录
   - 创建题目
   - 创建考试
   - 参加考试
   - 查看结果

### 7. 数据迁移（如果有现有数据）

如果你有现有的 SQLite 数据需要迁移到 MongoDB，需要：

1. 导出 SQLite 数据
2. 转换数据格式（特别是 ID 字段）
3. 导入到 MongoDB

### 8. 部署注意事项

- 确保生产环境的 MongoDB 连接字符串正确
- 更新部署脚本，移除 Prisma 相关命令
- 确保 MongoDB 数据库的网络访问权限正确配置

## 迁移优势

1. **更好的文档数据库支持**：MongoDB 天然支持嵌入文档和复杂数据结构
2. **更灵活的 Schema**：可以更容易地处理动态字段
3. **更好的扩展性**：MongoDB 在水平扩展方面表现更好
4. **JSON 原生支持**：直接存储和查询 JSON 数据

## 注意事项

1. **事务支持**：MongoDB 的事务支持与关系型数据库不同
2. **关系查询**：需要使用 `populate()` 来处理关联数据
3. **数据一致性**：需要在应用层面处理更多的数据一致性逻辑
4. **学习曲线**：团队需要熟悉 Mongoose 和 MongoDB 的特性

完成以上步骤后，项目将完全迁移到 MongoDB + Mongoose 架构。