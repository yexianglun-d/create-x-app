chrome.runtime.onInstalled.addListener(() => {
  chrome.action.setBadgeText({ text: 'NEW' })
  chrome.action.setBadgeBackgroundColor({ color: '#2563eb' })
})
