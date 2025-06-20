/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['localhost'],
  },
  env: {
    TZ: 'Asia/Shanghai'
  },
  // 启用边缘运行时优化
  experimental: {
    serverComponentsExternalPackages: ['child_process'],
  },
  // Webpack配置
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        crypto: false,
        fs: false,
        net: false,
        tls: false,
      }
    }
    return config
  },

}

module.exports = nextConfig