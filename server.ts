import 'dotenv/config'
import { Server } from '@hocuspocus/server'
import { Database } from '@hocuspocus/extension-database'
import postgres from 'postgres'

/** postgres 사용을 위해 supabase 이용 */
const sql = postgres(process.env.DATABASE_URL as string);

const server = new Server({
  port: 4010,

  extensions: [
    new Database({
      fetch: async ({ documentName }) => {
        const result = await sql`
          SELECT data FROM documents WHERE name = ${documentName}
        `

        if (result.length > 0) {
          console.log(`[DB Load] ${documentName}`)
          return result[0].data
        }

        console.log(`[New Doc] ${documentName}`)
        return null
      },

      store: async ({ documentName, state }) => {
        await sql`
          INSERT INTO documents (name, data)
          VALUES (${documentName}, ${state})
          ON CONFLICT (name)
          DO UPDATE SET data = ${state}
        `
        console.log(`[DB Save] ${documentName}`)
      },
    }),
  ],
})

server.listen().then(() => {
  console.log('🚀 Hocuspocus server running at ws://127.0.0.1:4010')
})
