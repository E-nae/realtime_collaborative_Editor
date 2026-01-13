import { Server } from '@hocuspocus/server';
import { Database } from '@hocuspocus/extension-database';
import { Redis } from '@hocuspocus/extension-redis';
import { writeFile, readFile } from 'fs/promises';

const server = new Server({
  port: 4000,
  address: 'localhost',
  extensions: [
    new Database({
        // 💡 핵심: 변경사항이 생길 때마다 DB에 저장 (Debounce 적용됨)
        store: async ({ documentName, state }) => {
          console.log(`Saving ${documentName} to disk...`);
          // 실제 프로덕션: await db.query('INSERT INTO docs ...', [state])
          // Y.js의 state는 Uint8Array 바이너리 형식입니다.
          await writeFile(`./data/${documentName}.bin`, state);
        },
        // 💡 핵심: 초기 로딩 시 DB에서 데이터 불러오기
        fetch: async ({ documentName }) => {
          try {
            console.log(`Loading ${documentName}...`);
            const data = await readFile(`./data/${documentName}.bin`);
            return data;
          } catch (e) {
            return null; // 파일이 없으면 새 문서 시작
          }
        },
      }),
    // 💡 핵심: Redis 확장 연결
    new Redis({
      // Redis 서버 주소 (실제로는 환경변수로 관리)
      host: process.env.REDIS_HOST || 'localhost', 
      port: 6379,
      // 모든 Hocuspocus 서버가 동일한 식별자를 사용해야 서로 인식함
      identifier: 'hocuspocus-cluster',
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