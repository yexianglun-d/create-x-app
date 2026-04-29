const TITLE_BADGE_ID = '__cxa_title_badge__'

function resolveVisibleTitleElement() {
  const headingElement = document.querySelector('h1')

  if (headingElement) {
    return {
      titleText: headingElement.textContent?.trim() || document.title || '未命名页面',
      highlight() {
        const targetElement = headingElement as HTMLElement

        targetElement.style.transition = 'box-shadow 0.2s ease, outline 0.2s ease'
        targetElement.style.outline = '3px solid #2563eb'
        targetElement.style.boxShadow = '0 0 0 10px rgba(37, 99, 235, 0.16)'
      },
    }
  }

  return {
    titleText: document.title || '未命名页面',
    highlight() {
      const existingBadge = document.getElementById(TITLE_BADGE_ID)

      if (existingBadge) {
        existingBadge.remove()
      }

      const badgeElement = document.createElement('div')

      badgeElement.id = TITLE_BADGE_ID
      badgeElement.textContent = `页面标题：${document.title || '未命名页面'}`
      badgeElement.style.position = 'fixed'
      badgeElement.style.top = '20px'
      badgeElement.style.right = '20px'
      badgeElement.style.zIndex = '2147483647'
      badgeElement.style.padding = '12px 16px'
      badgeElement.style.borderRadius = '999px'
      badgeElement.style.background = 'linear-gradient(135deg, #2563eb 0%, #0f766e 100%)'
      badgeElement.style.color = '#ffffff'
      badgeElement.style.fontFamily = '"SF Pro Display", "PingFang SC", "Segoe UI", sans-serif'
      badgeElement.style.fontSize = '14px'
      badgeElement.style.boxShadow = '0 18px 40px rgba(15, 23, 42, 0.3)'

      document.body.appendChild(badgeElement)
    },
  }
}

/**
 * Content script 负责在页面内执行可视化反馈，popup 只负责发起消息。
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== 'highlight-page-title') {
    return undefined
  }

  const titlePresenter = resolveVisibleTitleElement()

  titlePresenter.highlight()
  sendResponse({
    message: `已高亮：${titlePresenter.titleText}`,
  })

  return true
})
