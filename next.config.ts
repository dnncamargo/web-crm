import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
  /* lidar com o caminho base e o prefixo do ativo */
  output: 'export',
  distDir: 'dist',
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  assetPrefix: isProd ? '/web-crm/' : '',
  basePath: isProd ? '/web-crm' : '',

};

export default nextConfig;
