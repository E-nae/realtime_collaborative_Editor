import { Server } from '@hocuspocus/server';
import { Database } from '@hocuspocus/extension-database';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const server = new Server({
  port: 4000,
  address: '0.0.0.0',
  extensions: [
    new Database({
      store: async ({ documentName, state }) => {
        await redis.set(
          `doc:${documentName}`,
          Buffer.from(state).toString('base64')
        );
      },
      fetch: async ({ documentName }) => {
        const data = await redis.get<string>(`doc:${documentName}`);
        if (!data) return null;

        return Buffer.from(data, 'base64');
      },
    }),
  ],

  // 3. 인증 처리 (보안)
  async onAuthenticate(data) {
    const { token } = data;
    // 실제로는 JWT 검증 로직 수행
    if (token !== 'valid-token') {
      // throw new Error('Not authorized');
    }
    console.log('User authenticated');
  },
});

server.listen();