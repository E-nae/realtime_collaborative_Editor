import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  // Cloudflare Pages에 정적 파일로 배포: `next build` 결과가 views/out 에 생긴다
  output: "export",
};

export default nextConfig;
