'use client'

import { useEffect, useState } from 'react'
import { HocuspocusProvider } from '@hocuspocus/provider'
import * as Y from 'yjs'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCursor from '@tiptap/extension-collaboration-cursor'

export default function Home() {
  // 1. Provider를 에디터에 넘겨주기 위해 state로 관리
  const [provider, setProvider] = useState<any>(null);
  const [status, setStatus] = useState<'waking' | 'ready' | 'offline'>('waking');

  // 2. 연결 설정 (useEffect)
  useEffect(() => {
    const doc = new Y.Doc()

    const newProvider = new HocuspocusProvider({
      url: process.env.NEXT_PUBLIC_SERVER!, 
      name: 'test',
      document: doc,
      // token: 'user-123',
      
      onStatus: ({ status }) => {
        if (status === 'connecting') setStatus('waking');
        if (status === 'connected') setStatus('ready');
        if (status === 'disconnected') setStatus('offline');
      },
    
      onConnect() {
        console.log('CONNECTED');
        
      },
      onSynced() {
        console.log('SYNCED');
      },
      onClose() {
        console.log('CLOSED');
      }
    })

    setProvider(newProvider);

    // 클린업
    return () => {
      newProvider.destroy();
      doc.destroy();
    }
  }, [])

  // 3. Tiptap 에디터 설정
  const editor = useEditor({
    extensions: [
      //Y.js가 히스토리를 관리하므로 Tiptap의 기본 히스토리는 off 
      StarterKit.configure({ history: false }), 
      
      // Provider가 생성된 후에만 협업 기능을 On.
      ...(provider ? [
        Collaboration.configure({
          document: provider.document, // Provider의 문서를 연결
        }),
        CollaborationCursor.configure({
          provider: provider, // 커서 공유를 위해 provider 전달
          user: { 
            name: 'User ' + Math.floor(Math.random() * 100), 
            color: '#f783ac' 
          }
        })
      ] : [])
    ],
    immediatelyRender: false
  }, [provider]) // provider가 변경(생성)되면 에디터 설정을 다시 읽음

  // 4. 로딩 중 처리
  if (!provider || !editor) {
    return <div className="p-10">🔌 서버 연결 및 에디터 로딩 중...</div>
  };

  return (
    <div className="p-10 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Tiptap 협업 에디터</h1>

      {status !== 'ready' && (
        <div className="mb-4 rounded bg-yellow-100 p-3 text-yellow-800">
          {status === 'waking' && '잠들어 있는 Render 서버를 깨우는 중입니다. 잠시만 기다려주세요'}
          {status === 'offline' && '서버 연결 끊김'}
        </div>
      )}

      {/* 상태 표시 */}
      <div className="mb-4 p-2 bg-gray-100 rounded text-sm font-mono">
        Status: {provider.status} | Synced: {provider.isSynced ? 'YES' : 'NO'}
      </div>

      {/* 진짜 에디터 영역 */}
      <div className="border border-gray-300 rounded-lg p-4 min-h-[300px] shadow-sm">
        <EditorContent editor={editor} />
      </div>

      <style jsx global>{`
        /* 커서 스타일 */
        .collaboration-cursor__caret {
          border-left: 1px solid #0d0d0d;
          border-right: 1px solid #0d0d0d;
          margin-left: -1px;
          margin-right: -1px;
          pointer-events: none;
          position: relative;
          word-break: normal;
        }
        .collaboration-cursor__label {
          border-radius: 3px 3px 3px 0;
          color: #0d0d0d;
          font-size: 12px;
          font-style: normal;
          font-weight: 600;
          left: -1px;
          line-height: normal;
          padding: 0.1rem 0.3rem;
          position: absolute;
          top: -1.4em;
          user-select: none;
          white-space: nowrap;
        }
        /* 기본 에디터 영역 */
        .ProseMirror {
          min-height: 300px;
          padding: 16px;
          border-radius: 8px;
          line-height: 1.6;
        }

        /* 포커스 스타일 제거 */
        .ProseMirror-focused {
          outline: none;
        }

        /* 문단 간격 */
        .ProseMirror p {
          margin: 0.5em 0;
        }

        /* 리스트 정렬 */
        .ProseMirror ul,
        .ProseMirror ol {
          padding-left: 1.5rem;
        }

        /* 코드 블록 */
        .ProseMirror pre {
          background: #0f172a;
          color: #e5e7eb;
          padding: 12px;
          border-radius: 6px;
        }
      `}</style>
    </div>
  )
};