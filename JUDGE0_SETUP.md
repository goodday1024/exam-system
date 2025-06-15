# Judge0 API 配置指南

本项目使用 Judge0 API 来支持 C++ 代码的在线编译和执行，特别是在 Vercel 等无服务器环境中。

## 获取 Judge0 API Key

1. 访问 [RapidAPI Judge0 CE](https://rapidapi.com/judge0-official/api/judge0-ce)
2. 注册或登录 RapidAPI 账户
3. 订阅 Judge0 CE API（有免费套餐）
4. 复制你的 API Key

## 配置环境变量

1. 复制 `.env.example` 为 `.env.local`
2. 在 `.env.local` 中设置你的 API Key：
   ```
   JUDGE0_API_KEY="your-actual-rapidapi-key"
   ```

## Judge0 免费套餐限制

- 每月 50 次免费调用
- 每次调用最多 5 秒 CPU 时间
- 128MB 内存限制

## 支持的语言

- JavaScript (Node.js)
- C++ (GCC 9.2.0)

## 在 Vercel 部署时的配置

在 Vercel 项目设置中添加环境变量：
- 变量名：`JUDGE0_API_KEY`
- 值：你的 RapidAPI Key

## 故障排除

如果遇到 "Judge0 API 错误" 或 "Judge0 API 调用失败"，请检查：

1. API Key 是否正确设置
2. 是否已订阅 Judge0 CE API
3. 是否超出了免费套餐的调用限制
4. 网络连接是否正常

## 本地开发 vs 生产环境

- **本地开发**：JavaScript 代码使用本地 Node.js 执行，C++ 代码使用 Judge0 API
- **生产环境（Vercel）**：所有代码都使用 Judge0 API 执行

这样确保了在无服务器环境中也能正常执行 C++ 代码。