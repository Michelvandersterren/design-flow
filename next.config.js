/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', '@notionhq/client'],
  },
};

module.exports = nextConfig;
