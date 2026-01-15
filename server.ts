import 'dotenv/config'
import { Server } from '@hocuspocus/server'
import { Database } from '@hocuspocus/extension-database'
import postgres from 'postgres'

const PORT = Number(process.env.PORT) || 10000
const sql = postgres(process.env.DATABASE_URL as string)

const server = new Server({
  port: PORT,

  /* 인증 (JWT) */
  // async onAuthenticate({ token }) {
  //   if (!token) {
  //     throw new Error('No token')
  //   }

  //   // 예시 (실제론 jwt.verify)
  //   return {
  //     userId: token,
  //     name: `user-${token.slice(0, 4)}`,
  //     color: '#' + Math.floor(Math.random() * 16777215).toString(16),
  //   }
  // },

  /* 🟢 연결 */
  async onConnect({ documentName, socketId, context }) {
    console.log(
      `🟢 connected | doc=${documentName} | socket=${socketId} | user=${context?.userId}`,
    )
  },

  /* 🔴 종료 */
  async onDisconnect({ documentName, socketId, context }) {
    console.log(
      `🔴 disconnected | doc=${documentName} | socket=${socketId} | user=${context?.userId}`,
    )
  },

  extensions: [
    new Database({
      fetch: async ({ documentName }) => {
        const result = await sql`
          SELECT data FROM documents WHERE name = ${documentName}
        `
        return result.length ? result[0].data : null
      },

      store: async ({ documentName, state }) => {
        await sql`
          INSERT INTO documents (name, data)
          VALUES (${documentName}, ${state})
          ON CONFLICT (name)
          DO UPDATE SET data = ${state}
        `
      },
    }),
  ],
})

server.listen().then(() => {
  console.log('🚀 Hocuspocus server running')
})
