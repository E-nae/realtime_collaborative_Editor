# Real-time Collaboration Editor

> Tiptap과 Yjs, Hocuspocus를 사용해 여러 사용자가 같은 문서를 동시에 편집할 수 있는 에디터입니다.
> 편집 내용은 Yjs 문서 상태 그대로 바이너리로 직렬화해 PostgreSQL(Supabase)에 저장합니다.

**Live Demo** — https://project1.enaeble.co.kr

---

## Tech Stack

### Frontend (`/views`)

| Tech | Usage |
| :--- | :--- |
| **Next.js (App Router)** | 프론트엔드 프레임워크 |
| **Tiptap** | Headless WYSIWYG 에디터 |
| **Yjs / @tiptap/extension-collaboration** | CRDT 기반 동시 편집 |
| **@hocuspocus/provider** | WebSocket 클라이언트 |
| **Tailwind CSS** | 스타일링 |

### Backend (저장소 루트)

| Tech | Usage |
| :--- | :--- |
| **Node.js / TypeScript (tsx)** | 서버 |
| **@hocuspocus/server** | Yjs 문서 동기화 WebSocket 서버 |
| **postgres.js / Supabase** | PostgreSQL 연동 및 문서 저장 |

---

## 왜 CRDT인가

여러 사람이 같은 문서를 동시에 고치면 "누구 편집이 먼저인가"를 정해야 합니다. 이걸 푸는 방식이 크게 두 가지입니다.

- **OT (Operational Transformation)** — 편집 연산을 서로의 연산 기준으로 변환해서 적용합니다. 보통 중앙 서버가 순서를 정리해주는 역할을 합니다.
- **CRDT (Conflict-free Replicated Data Type)** — 각자 로컬에서 편집하고 나중에 합쳐도 같은 결과로 수렴하도록 자료구조 자체를 설계합니다. 순서를 중재하는 주체가 없어도 됩니다.

Yjs는 CRDT 구현체입니다. 이 프로젝트에서는 서버가 편집 순서를 판정하지 않고 **문서 상태를 중계하고 저장하는 역할만** 합니다. 충돌 해소 로직을 직접 짜지 않아도 되는 대신, 문서 상태를 사람이 읽을 수 있는 형태가 아니라 바이너리로 다루게 된다는 특성이 따라옵니다. 저장 방식이 `bytea`인 이유도 이것입니다.

---

## 겪은 문제와 해결

### 연결은 되는데 동기화만 되지 않던 문제

이 프로젝트에서 가장 오래 붙잡았던 문제입니다.

**증상**

- 브라우저 네트워크 탭에서 WebSocket이 `101 Switching Protocols`로 정상 연결됨
- 그런데 서버의 `onConnect`, `onLoadDocument` 훅이 한 번도 호출되지 않음
- 클라이언트·서버 어느 쪽에도 에러 로그가 남지 않음
- Provider 상태가 `Synced`로 넘어가지 않고 `Connecting`에 머무름

**원인을 좁힌 과정**

에러가 없다는 점이 오히려 단서였습니다. 핸드셰이크는 성공했는데 그 이후 서버 훅이 하나도 불리지 않는다는 건, 연결 자체의 문제가 아니라 **연결된 뒤 주고받는 메시지를 해석하지 못하는 단계의 문제**라는 뜻이었습니다. 그래서 방화벽이나 URL, CORS 같은 연결 계층이 아니라 프로토콜 계층을 의심했고, 서버와 클라이언트 패키지 버전을 대조했습니다.

**원인**

`@hocuspocus/server`와 `@hocuspocus/provider`의 메이저 버전이 달랐습니다. 서버는 v3, 클라이언트는 v2였습니다.

WebSocket 핸드셰이크는 표준 프로토콜이라 라이브러리 버전과 무관하게 통과합니다. 문제는 그다음입니다. 연결 위에서 주고받는 메시지 형식은 각 라이브러리가 정한 것이라, 버전이 다르면 서로의 메시지를 해석하지 못합니다. 그런데 이 경우 **에러를 던지는 대신 조용히 무시**하기 때문에, 겉으로는 연결된 채로 아무 일도 일어나지 않는 상태가 됩니다.

**해결**

클라이언트 쪽 `@hocuspocus/provider`를 서버와 같은 메이저 버전으로 맞췄습니다.

**남은 교훈**

에러가 없다는 것이 정상이라는 뜻은 아닙니다. 이 문제는 실패가 조용히 일어나서 어렵기도 했지만, 반대로 "어디까지 성공했고 어디부터 아무 일도 안 일어나는가"를 나눠 보면 범위가 빠르게 좁혀지는 문제이기도 했습니다. 그리고 WebSocket처럼 서버·클라이언트 SDK가 짝을 이루는 라이브러리는 버전 호환성을 먼저 확인하는 게 맞다는 걸 알게 됐습니다.

---

### 문서 저장

Hocuspocus의 저장 훅에서 Yjs 문서 상태를 그대로 저장합니다. 같은 문서가 계속 갱신되므로 `INSERT`와 `UPDATE`를 나누지 않고 `ON CONFLICT`로 처리했습니다.

```ts
// server.ts
store: async ({ documentName, state }) => {
  await sql`
    INSERT INTO documents (name, data)
    VALUES (${documentName}, ${state})
    ON CONFLICT (name)
    DO UPDATE SET data = ${state}
  `;
},
```

### SSR 환경에서의 에디터 초기화

Tiptap 에디터와 Hocuspocus Provider는 브라우저 API에 의존하므로 서버에서 실행되면 안 됩니다. `useEffect` 안에서 Provider를 만들고, Provider가 준비되기 전에는 에디터를 렌더링하지 않도록 처리했습니다.

---

## 알려진 한계

동시 편집 동작과 영속화를 직접 구현해보는 것이 목적이라, 아래는 다루지 않았습니다.

- **인증이 없습니다.** 문서 이름만 알면 누구나 접속해 편집할 수 있습니다. 실제 서비스라면 Hocuspocus의 `onAuthenticate`에서 토큰을 검증해야 합니다.
- **문서 목록이나 권한 개념이 없습니다.** 여러 문서를 만들고 관리하는 기능은 범위 밖입니다.
- **오프라인 편집을 다루지 않았습니다.** Yjs는 오프라인 편집 후 재접속 시 병합이 가능하지만, 로컬 영속화(IndexedDB)는 붙이지 않았습니다.
- **동시 접속 규모를 검증하지 않았습니다.** 여러 탭으로 확인하는 수준까지만 테스트했습니다.
- **테스트 코드가 없습니다.**

---

## 프로젝트 구조

저장소 루트가 서버이고, 프론트엔드는 `views/` 안에 있습니다.

```
.
├── server.ts     # 서버 진입점 — Hocuspocus 설정 및 문서 저장 로직
└── views/        # Next.js 프론트엔드
```

---

## Getting Started

### 1. 데이터베이스

Supabase SQL Editor에서 테이블을 생성합니다.

```sql
CREATE TABLE documents (
  name text PRIMARY KEY,
  data bytea NOT NULL
);
```

### 2. 서버

저장소 루트에 `.env` 파일을 만들고 `DATABASE_URL`을 설정한 뒤 실행합니다.

```bash
pnpm install
pnpm dev
```

`ws://127.0.0.1:10000` 에서 대기합니다. (`PORT` 환경변수로 바꿀 수 있습니다.)

### 3. 프론트엔드

```bash
cd views
pnpm install
pnpm dev
```

`http://localhost:3000` 에서 확인할 수 있습니다.

---

## 배포

- **프론트엔드** — Cloudflare Pages (정적 내보내기)
- **서버** — Fly.io (`Dockerfile`, `fly.toml`)

### 서버 (Fly.io)

처음 한 번만 앱을 만들고 DB 주소를 등록합니다. 앱 이름은 `fly.toml`의 `app` 값과 같아야 합니다.

```bash
fly apps create realtime-collaborative-editor
fly secrets set DATABASE_URL="postgres://..."
```

이후에는 배포 명령만 실행하면 됩니다.

```bash
fly deploy
fly scale count 1
```

- 서버가 멈추면 WebSocket 연결이 끊기므로 `fly.toml`에서 자동 정지를 꺼 두었습니다.
- 서버 간 동기화 장치가 없으므로 머신은 **1대만** 실행해야 합니다. 2대 이상이면 접속자끼리 편집 내용이 공유되지 않습니다.

### 프론트엔드 (Cloudflare Pages)

환경변수 `NEXT_PUBLIC_SERVER`를 `wss://<앱이름>.fly.dev`로 설정한 뒤 다시 빌드합니다. 정적 내보내기라 값이 빌드 시점에 코드에 들어가므로, 주소를 바꾸면 반드시 재배포해야 합니다.

---

## 동작 흐름

1. 페이지가 로드되면 `useEffect`에서 HocuspocusProvider가 WebSocket 연결을 시도합니다.
2. 연결에 성공하면 Provider를 붙인 Tiptap 에디터가 렌더링됩니다.
3. DB에 저장된 바이너리 문서 상태를 불러와 에디터에 반영합니다.
4. 편집이 발생하면 변경분이 서버를 거쳐 다른 접속자에게 전달되고, 입력이 잦아들면 DB에 저장됩니다.
