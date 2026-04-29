chrome.runtime.onInstalled.addListener(() => {
  chrome.action.setBadgeText({ text: 'ON' })
  chrome.action.setBadgeBackgroundColor({ color: '#2563eb' })
})
