📝 Real-time Collaboration Editor (Notion Clone MVP)
 : Next.js, Tiptap, Hocuspocus를 활용한 실시간 협업 에디터 프로젝트입니다.
   사용자들이 동시에 문서를 편집할 수 있으며, 작성된 내용은 **Supabase(PostgreSQL)**에 바이너리 형태로 영구 저장됩니다.



🚨 The Critical Issue: 5시간의 디버깅 사투 (Version Mismatch)
    이 프로젝트를 진행하며 가장 치명적이었고 해결하기 힘들었던 기술적 이슈를 공유합니다.



🛑 문제 상황 (Symptoms)
    실시간 동기화 기능을 구현하던 중, WebSocket 연결은 성공했으나 데이터 동기화(Sync)만 되지 않는 기현상이 발생했습니다.

    WS 연결 성공: 브라우저 네트워크 탭에서는 WebSocket Status 101(Switching Protocols)이 뜨며 정상 연결된 것처럼 보임.

    침묵하는 서버: 서버 쪽 onConnect, onLoadDocument 훅이 전혀 트리거되지 않음.

    에러 로그 없음: 콘솔창, 서버 로그 어디에도 빨간색 에러가 뜨지 않음.

    무한 대기: 클라이언트의 Provider 상태가 Synced로 넘어가지 않고 무한 Connecting 상태 유지.



🕵️ 원인 분석 (Root Cause)
@hocuspocus/server와 @hocuspocus/provider 간의 메이저 버전 불일치
Server: v3.4.3 (최신)
Client (Provider): v2.15.3 (구버전)

서버와 클라이언트가 서로 다른 프로토콜 버전을 사용하고 있었으나, WebSocket 핸드셰이크 자체는 표준 프로토콜이라 통과되었습니다. 하지만 그 이후 데이터를 주고받는 과정에서 서로의 메시지를 해석하지 못해 조용히 무시(Silent Failure)되는 상황이었습니다.

✅ 해결 (Solution)
    package.json의 의존성을 정리하고, Client 측 라이브러리 버전을 Server와 동일하게 맞추어 해결했습니다.

    Diff

    // frontend/package.json
    dependencies {
    -  "@hocuspocus/provider": "^2.15.3",
    +  "@hocuspocus/provider": "^3.4.3" 
    }
    
    - Lesson Learned: WebSocket 기반의 라이브러리를 사용할 때는 Server/Client SDK의 버전 호환성(특히 프로토콜 변경 사항)을 가장 먼저 체크해야 함을 뼈저리게 느꼈습니다.

🛠 Tech Stack
    1. Frontend (/views)
        Framework: Next.js 16 (App Router)
        Editor: Tiptap (Headless WYSIWYG)
        Collaboration: @tiptap/extension-collaboration, yjs
        Styling: Tailwind CSS

    2. Backend (/notion)
        Runtime: Node.js (Express + ts-node)
        WebSocket Server: @hocuspocus/server
        Database: PostgreSQL (via Supabase), postgres.js
        Language: TypeScript

✨ Key Features
    1. 실시간 동시 편집 (Real-time Collaboration)
        CRDT(Conflict-free Replicated Data Type) 알고리즘을 사용하는 Y.js를 통해 충돌 없는 실시간 편집을 지원합니다.
        다른 사용자의 커서 위치와 이름이 실시간으로 표시됩니다.

    2. 데이터 영구 저장 (Persistence with Upsert)
        메모리 휘발성을 방지하기 위해 PostgreSQL에 데이터를 저장합니다.
        ON CONFLICT 구문을 활용한 효율적인 Upsert(Update + Insert) 로직을 구현했습니다.

    [TypeScript]
    // server.ts - Database Extension
    store: async ({ documentName, state }) => {
    await sql`
        INSERT INTO documents (name, data)
        VALUES (${documentName}, ${state})
        ON CONFLICT (name) -- 이미 존재하는 문서라면?
        DO UPDATE SET data = ${state} -- 내용만 업데이트
    `
    console.log(`[DB Save] ${documentName}`)
    },

    3. Tiptap 에디터 최적화
        - SSR 이슈 방지: Next.js 환경에서 useEffect와 useState를 활용해 클라이언트 사이드에서만 Provider와 Editor가 로드되도록 처리했습니다.
        - 커스텀 커서 스타일링: CSS 모듈을 통해 협업 시 상대방의 커서가 자연스럽게 보이도록 스타일링했습니다.

🚀 How to Run
    1. Database Setup (Supabase)
        Supabase에서 SQL Editor를 열고 다음 쿼리를 실행합니다.

        [SQL]
        CREATE TABLE documents (
            name text PRIMARY KEY,
            data bytea NOT NULL
        );
    2. Backend Server
    
    [Bash]
    cd notion
    # .env 파일 생성 및 DATABASE_URL 설정 필요
    npm install
    npm run dev
    # Server running at ws://127.0.0.1:4010
    
    3. Frontend Client
    [Bash]
    cd views
    npm install
    npm run dev
    # Visit http://localhost:3000

📸 Screen Logic
    Init: 페이지 로드 시 useEffect에서 HocuspocusProvider가 WebSocket(ws://127.0.0.1:4010)으로 연결을 시도합니다.

    Connect: 연결이 성공하면 Tiptap 에디터가 활성화(provider ? [...] : [])됩니다.

    Sync: DB에 저장된 바이너리 데이터를 받아와 에디터에 뿌려줍니다.

    Edit: 사용자가 타이핑을 멈추면(Debounce), 변경 사항이 서버를 통해 DB에 자동 저장됩니다.