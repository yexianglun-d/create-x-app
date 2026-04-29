import { useState } from 'react'

interface HighlightResponse {
  message: string
}

function queryActiveTabId() {
  return new Promise<number>((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const errorMessage = chrome.runtime.lastError?.message

      if (errorMessage) {
        reject(new Error(errorMessage))
        return
      }

      const activeTabId = tabs[0]?.id

      if (typeof activeTabId !== 'number') {
        reject(new Error('未找到当前活动标签页'))
        return
      }

      resolve(activeTabId)
    })
  })
}

function sendHighlightRequest(tabId: number) {
  return new Promise<HighlightResponse>((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, { type: 'highlight-page-title' }, (response) => {
      const errorMessage = chrome.runtime.lastError?.message

      if (errorMessage) {
        reject(new Error(errorMessage))
        return
      }

      resolve(response as HighlightResponse)
    })
  })
}

export default function Popup() {
  const [feedback, setFeedback] = useState('点击按钮，向当前页面发送消息。')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleHighlightTitle() {
    setIsSubmitting(true)

    try {
      const activeTabId = await queryActiveTabId()
      const response = await sendHighlightRequest(activeTabId)

      setFeedback(response.message)
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : '消息发送失败')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main
      style={{
        width: 360,
        minHeight: 340,
        padding: 20,
        boxSizing: 'border-box',
        color: '#e2e8f0',
        fontFamily: '"SF Pro Display", "PingFang SC", "Segoe UI", sans-serif',
        background:
          'radial-gradient(circle at top left, rgba(56, 189, 248, 0.22), transparent 32%), linear-gradient(180deg, #0f172a 0%, #111827 100%)',
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          padding: '6px 10px',
          borderRadius: 999,
          background: 'rgba(14, 165, 233, 0.14)',
          color: '#7dd3fc',
          fontSize: 12,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        create-x-app / chrome-ext
      </span>

      <h1 style={{ margin: '16px 0 10px', color: '#f8fafc', fontSize: 28 }}>
        页面标题高亮器
      </h1>
      <p style={{ margin: 0, color: 'rgba(226, 232, 240, 0.78)', lineHeight: 1.7 }}>
        这个 popup 会向当前标签页发送消息，由 content script 高亮页面标题，并把处理结果返回给你。
      </p>

      <button
        type="button"
        disabled={isSubmitting}
        onClick={() => {
          void handleHighlightTitle()
        }}
        style={{
          width: '100%',
          marginTop: 20,
          padding: '14px 16px',
          border: 'none',
          borderRadius: 16,
          background: isSubmitting
            ? 'rgba(37, 99, 235, 0.42)'
            : 'linear-gradient(135deg, #2563eb 0%, #0f766e 100%)',
          color: '#ffffff',
          fontSize: 15,
          fontWeight: 600,
          cursor: isSubmitting ? 'progress' : 'pointer',
        }}
      >
        {isSubmitting ? '发送中...' : '高亮当前页面标题'}
      </button>

      <section
        style={{
          marginTop: 18,
          border: '1px solid rgba(148, 163, 184, 0.14)',
          borderRadius: 18,
          padding: 16,
          background: 'rgba(15, 23, 42, 0.78)',
        }}
      >
        <p style={{ margin: '0 0 8px', color: '#94a3b8', fontSize: 12 }}>返回结果</p>
        <p style={{ margin: 0, color: '#f8fafc', lineHeight: 1.7 }}>{feedback}</p>
      </section>
    </main>
  )
}
