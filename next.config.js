/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    outputFileTracingIncludes: {
      '/api/*': ['./assets/**/*'],
    },
  },
};

module.exports = nextConfig;
