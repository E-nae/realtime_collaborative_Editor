# 빌드 단계: TypeScript를 dist/로 컴파일
FROM node:22-slim AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY tsconfig.json server.ts ./
RUN pnpm build

# 실행 단계: 운영용 의존성과 빌드 결과만 담기
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod
COPY --from=build /app/dist ./dist
ENV PORT=10000
EXPOSE 10000
CMD ["node", "dist/server.js"]
