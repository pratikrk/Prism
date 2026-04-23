/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@prism/types'],
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
