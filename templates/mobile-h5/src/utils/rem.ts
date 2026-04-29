const DESIGN_WIDTH = 375
const BASE_FONT_SIZE = 37.5
const MAX_WIDTH = 540

/**
 * 根据屏幕宽度动态设置根字体大小，保证移动端 H5 在 375 设计稿基准下按 rem 缩放。
 */
export function setupRem() {
  const updateRootFontSize = () => {
    const viewportWidth = Math.min(window.innerWidth, MAX_WIDTH)
    const nextFontSize = viewportWidth / (DESIGN_WIDTH / BASE_FONT_SIZE)

    document.documentElement.style.fontSize = `${nextFontSize}px`
  }

  updateRootFontSize()
  window.addEventListener('resize', updateRootFontSize)
}
