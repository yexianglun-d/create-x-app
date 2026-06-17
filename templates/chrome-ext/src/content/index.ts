interface CapturePageMessage {
  type: 'capture-page-context'
}

interface PageContext {
  title: string
  url: string
  selection: string
  capturedAt: string
}

function buildPageContext(): PageContext {
  return {
    title: document.title || '未命名页面',
    url: window.location.href,
    selection: window.getSelection()?.toString().trim() ?? '',
    capturedAt: new Date().toISOString(),
  }
}

chrome.runtime.onMessage.addListener((message: CapturePageMessage, _sender, sendResponse) => {
  if (message.type !== 'capture-page-context') {
    return undefined
  }

  sendResponse(buildPageContext())
  return true
})
