import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* lidar com o caminho base e o prefixo do ativo */
  output: 'export',
  distDir: 'dist',

  images: {
    unoptimized: true,
  },
};

export default nextConfig;