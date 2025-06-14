# 编程考试系统

一个基于 Next.js 的在线编程考试系统，支持教师出题和学生答题，具备完整的考试管理功能。

## 功能特性

### 教师功能
- 用户注册和登录
- 题目管理（选择题、判断题、编程题）
- 考试创建和管理
- 自动判分系统
- 成绩查看和导出
- 成绩发布管理

### 学生功能
- 用户注册和登录
- 查看可参加的考试
- 在线答题
- 防作弊监控（标签页切换检测）
- 查看考试成绩和详细解析

### 系统特性
- 响应式设计，支持多设备访问
- 实时答案保存
- 考试时间控制
- 防作弊机制
- 数据安全保护

## 技术栈

- **前端**: Next.js 14, React 18, TypeScript, Tailwind CSS
- **后端**: Next.js API Routes
- **数据库**: MongoDB + Mongoose ODM
- **认证**: JWT + HTTP-only Cookies
- **UI组件**: Headless UI, React Hot Toast
- **编辑器**: React Markdown Editor
- **代码高亮**: React Syntax Highlighter

## 安装和运行

### 环境要求
- Node.js 18.0 或更高版本
- MongoDB 6.0+
- npm 或 yarn 包管理器

### 1. 克隆项目
```bash
git clone <repository-url>
cd 考试系统
```

### 2. 安装依赖
```bash
npm install
# 或
yarn install
```

### 3. 环境配置
创建 `.env.local` 文件并配置以下环境变量：

```env
# MongoDB 数据库连接
MONGODB_URI="mongodb://localhost:27017/exam_system"
# 或使用 MongoDB Atlas:
# MONGODB_URI="mongodb+srv://username:password@cluster.mongodb.net/exam_system"

# JWT 密钥
JWT_SECRET="your-super-secret-jwt-key-here"

# Next.js 配置
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-nextauth-secret-here"
```

### 4. 启动开发服务器
```bash
npm run dev
# 或
yarn dev
```

访问 [http://localhost:3000](http://localhost:3000) 查看应用。

## 项目结构

```
考试系统/
├── app/                    # Next.js 13+ App Router
│   ├── api/               # API 路由
│   │   ├── auth/          # 认证相关 API
│   │   ├── teacher/       # 教师功能 API
│   │   └── student/       # 学生功能 API
│   ├── teacher/           # 教师页面
│   ├── student/           # 学生页面
│   ├── globals.css        # 全局样式
│   ├── layout.tsx         # 根布局
│   └── page.tsx           # 首页（登录/注册）
├── lib/                   # 工具库
│   ├── mongodb.ts         # MongoDB 数据库连接
│   ├── models/            # Mongoose 数据模型
│   └── jwt.ts             # JWT 工具
├── public/                # 静态资源
└── 配置文件...
```

## 使用说明

### 教师使用流程
1. 注册教师账号（注册时选择角色）
2. 登录系统进入教师控制台
3. 创建题目（支持选择题、判断题、编程题）
4. 创建考试并选择题目
5. 发布考试供学生参加
6. 考试结束后进行自动判分
7. 发布成绩供学生查看

### 学生使用流程
1. 注册学生账号
2. 登录系统进入学生控制台
3. 查看可参加的考试列表
4. 点击开始考试进入答题界面
5. 完成答题并提交
6. 等待成绩发布后查看结果

## 部署

### Vercel 部署（推荐）
1. 将代码推送到 GitHub
2. 在 Vercel 中导入项目
3. 配置环境变量
4. 部署完成

### 其他平台部署
```bash
# 构建生产版本
npm run build

# 启动生产服务器
npm start
```

## 数据库模式

系统包含以下主要数据表：
- `User`: 用户信息（教师/学生）
- `Question`: 题目信息
- `Exam`: 考试信息
- `ExamQuestion`: 考试题目关联
- `ExamResult`: 考试结果
- `Appeal`: 申诉记录（预留）

## 安全特性

- JWT 认证机制
- HTTP-only Cookies
- 密码加密存储
- 防 XSS 攻击
- 防作弊监控
- 权限控制

## 开发说明

### 添加新功能
1. 在 `prisma/schema.prisma` 中更新数据模型
2. 运行 `npx prisma db push` 更新数据库
3. 创建相应的 API 路由
4. 实现前端页面和组件

### 代码规范
- 使用 TypeScript 进行类型检查
- 遵循 ESLint 规则
- 使用 Prettier 格式化代码
- 组件和函数使用描述性命名

## 常见问题

### Q: 数据库连接失败
A: 检查 `.env.local` 中的 `DATABASE_URL` 是否正确，确保 PostgreSQL 服务正在运行。

### Q: JWT 验证失败
A: 确保 `.env.local` 中设置了 `JWT_SECRET` 环境变量。

### Q: 页面样式异常
A: 确保 Tailwind CSS 正确安装，运行 `npm run dev` 重新启动开发服务器。

## 贡献

欢迎提交 Issue 和 Pull Request 来改进这个项目。

## 许可证

MIT License