"use client";

import { useEffect, useState } from "react";
import { HocuspocusProvider } from "@hocuspocus/provider";
import * as Y from "yjs";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";

type Status = "waking" | "ready" | "offline";
type Peer = { name: string; color: string };

// 커서 색: 흰 글자를 올려도 읽히는 진하기로 고름
const CURSOR_COLORS = ["#E5484D", "#0B7FD9", "#2B9A66", "#E2620F", "#8E4EC6", "#C93C8C"];

const STATUS: Record<Status, { label: string; color: string; detail?: string }> = {
  waking: {
    label: "서버 연결 중",
    color: "var(--wait)",
    detail: "잠들어 있던 서버를 깨우고 있어요. 처음 접속하면 시간이 조금 걸릴 수 있어요.",
  },
  ready: { label: "실시간 동기화 중", color: "var(--ok)" },
  offline: {
    label: "연결 끊김",
    color: "var(--down)",
    detail: "서버와 연결이 끊겼어요. 자동으로 다시 연결하는 중이에요.",
  },
};

function pickMe(): Peer {
  return {
    name: `게스트 ${Math.floor(Math.random() * 90) + 10}`,
    color: CURSOR_COLORS[Math.floor(Math.random() * CURSOR_COLORS.length)],
  };
}

export default function Home() {
  // 1. Provider를 에디터에 넘겨주기 위해 state로 관리
  const [provider, setProvider] = useState<HocuspocusProvider | null>(null);
  const [status, setStatus] = useState<Status>("waking");
  // Math.random은 서버/클라이언트 값이 달라지므로 마운트 후에 정한다
  const [me, setMe] = useState<Peer | null>(null);
  const [peers, setPeers] = useState<Peer[]>([]);

  useEffect(() => setMe(pickMe()), []);

  // 2. 연결 설정
  useEffect(() => {
    const doc = new Y.Doc();

    const newProvider = new HocuspocusProvider({
      url: process.env.NEXT_PUBLIC_SERVER!,
      name: "test",
      document: doc,

      onStatus: ({ status }) => {
        if (status === "connecting") setStatus("waking");
        if (status === "connected") setStatus("ready");
        if (status === "disconnected") setStatus("offline");
      },
      onConnect() {
        console.log("CONNECTED");
      },
      onSynced() {
        console.log("SYNCED");
      },
      onClose() {
        console.log("CLOSED");
      },
    });

    // 지금 접속해 있는 사람들(awareness) 목록
    const awareness = newProvider.awareness;
    const updatePeers = () => {
      if (!awareness) return;
      const list = Array.from(awareness.getStates().values())
        .map((s) => s.user as Peer | undefined)
        .filter((u): u is Peer => !!u?.name);
      setPeers(list);
    };
    awareness?.on("change", updatePeers);

    setProvider(newProvider);

    return () => {
      awareness?.off("change", updatePeers);
      newProvider.destroy();
      doc.destroy();
    };
  }, []);

  // 3. Tiptap 에디터 설정
  const editor = useEditor(
    {
      extensions: [
        // Y.js가 히스토리를 관리하므로 Tiptap의 기본 히스토리는 off
        StarterKit.configure({ history: false }),
        // Provider가 생성된 후에만 협업 기능을 On
        ...(provider && me
          ? [
              Collaboration.configure({ document: provider.document }),
              CollaborationCursor.configure({ provider, user: me }),
            ]
          : []),
      ],
      editorProps: { attributes: { "aria-label": "공유 노트 본문" } },
      immediatelyRender: false,
    },
    [provider, me],
  );

  const loading = !provider || !editor || !me;
  const s = STATUS[status];
  const others = peers.filter((p) => p.name !== me?.name);
  const shown = others.slice(0, 3);

  return (
    <div className="min-h-screen">
      {/* 상단 바 */}
      <header className="sticky top-0 z-10 border-b border-rule bg-bg/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[680px] items-center justify-between gap-4 px-4 sm:px-6">
          <p className="text-[15px] font-semibold tracking-[-0.01em]">공유 노트</p>

          <div className="flex items-center gap-5 text-[13px]">
            <p role="status" aria-live="polite" className="flex items-center gap-2 text-muted">
              <span className="relative flex h-2 w-2">
                {status === "ready" && (
                  <span
                    className="absolute inset-0 rounded-full opacity-40 motion-safe:animate-ping"
                    style={{ background: s.color }}
                  />
                )}
                <span className="relative h-2 w-2 rounded-full" style={{ background: s.color }} />
              </span>
              <span className="hidden sm:inline">{s.label}</span>
            </p>

            {me && (
              <ul className="flex items-center gap-1.5" aria-label="지금 접속한 사람">
                <PeerChip peer={me} me />
                {shown.map((p, i) => (
                  <PeerChip key={p.name + i} peer={p} />
                ))}
                {others.length > shown.length && (
                  <li className="px-1 text-muted" title={others.slice(3).map((p) => p.name).join(", ")}>
                    +{others.length - shown.length}
                  </li>
                )}
              </ul>
            )}
          </div>
        </div>

        {/* 서버를 깨우는 동안만 보이는 진행선 */}
        {status === "waking" && (
          <div className="absolute inset-x-0 -bottom-px h-0.5 overflow-hidden">
            <div className="sweep h-full w-2/5" style={{ background: "var(--wait)" }} />
          </div>
        )}
      </header>

      <main className="mx-auto max-w-[680px] px-4 pb-24 pt-12 sm:px-6 sm:pt-16">
        {s.detail && (
          <p
            className="mb-10 border-l-2 pl-3 text-[14px] leading-relaxed text-muted"
            style={{ borderColor: s.color }}
          >
            {s.detail}
          </p>
        )}

        {loading ? (
          <div className="space-y-3" aria-hidden="true">
            <div className="h-4 w-3/4 rounded bg-subtle" />
            <div className="h-4 w-1/2 rounded bg-subtle" />
            <div className="h-4 w-2/3 rounded bg-subtle" />
          </div>
        ) : (
          <EditorContent editor={editor} />
        )}

        <p className="mt-16 border-t border-rule pt-4 text-[13px] leading-relaxed text-muted">
          이 링크로 들어온 사람은 누구나 같은 문서를 함께 고칠 수 있어요. 줄 앞에 <Kbd>#</Kbd>를
          쓰면 제목, <Kbd>-</Kbd>를 쓰면 목록이 돼요.
        </p>
      </main>
    </div>
  );
}

function PeerChip({ peer, me }: { peer: Peer; me?: boolean }) {
  return (
    <li
      className="flex items-center gap-1.5 rounded-full border border-rule py-0.5 pl-1.5 pr-2.5"
      title={me ? `${peer.name} (나)` : peer.name}
    >
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: peer.color }} />
      <span className="whitespace-nowrap">
        {peer.name}
        {me && <span className="text-muted"> (나)</span>}
      </span>
    </li>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-rule bg-subtle px-1.5 py-px font-[inherit] text-[12px] text-ink">
      {children}
    </kbd>
  );
}
