/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
  },
  
  // 启用压缩
  compress: true,
  
  // 优化图片
  images: {
    domains: ['localhost'],
    formats: ['image/webp', 'image/avif'],
  },
  
  // 自定义头部配置
  async headers() {
    return [
      {
        // 为 API 路由添加缓存头
        source: '/api/marketplace/exams',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=300, stale-while-revalidate=600',
          },
          {
            key: 'CDN-Cache-Control',
            value: 'public, max-age=300',
          },
        ],
      },
      {
        source: '/api/teacher/analytics',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=180, stale-while-revalidate=300',
          },
          {
            key: 'CDN-Cache-Control',
            value: 'public, max-age=180',
          },
        ],
      },
      {
        source: '/api/teacher/students',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=600, stale-while-revalidate=1200',
          },
          {
            key: 'CDN-Cache-Control',
            value: 'public, max-age=600',
          },
        ],
      },
      {
        source: '/api/student/exams',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=120, stale-while-revalidate=240',
          },
          {
            key: 'CDN-Cache-Control',
            value: 'public, max-age=120',
          },
        ],
      },
      {
        // 为静态资源添加长期缓存
        source: '/_next/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // 为页面添加基础缓存
        source: '/((?!api|_next/static|_next/image|favicon.ico).*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=60, stale-while-revalidate=300',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ];
  },
  
  // 重写规则（如果需要）
  async rewrites() {
    return [
      // 可以在这里添加 API 重写规则
    ];
  },
  
  // 环境变量
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
  
  // 优化构建
  swcMinify: true,
  
  // 启用 React 严格模式
  reactStrictMode: true,
  
  // 输出配置
  output: 'standalone',
  
  // 性能优化
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // 优化包大小
    if (!dev && !isServer) {
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          default: {
            minChunks: 2,
            priority: -20,
            reuseExistingChunk: true,
          },
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            priority: -10,
            chunks: 'all',
          },
        },
      };
    }
    
    return config;
  },
};

module.exports = nextConfig;