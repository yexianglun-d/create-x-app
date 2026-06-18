export const HELP = {
  template: {
    'react-vite-ts': {
      summary: 'React 18 + Vite 5 + TypeScript 5',
      bestFor: '需要构建现代前端 SPA 的团队',
      includes: '热重载、路径别名、严格 TS 配置',
      devCommand: 'npm run dev → http://localhost:5173',
    },
    'node-ts': {
      summary: 'Node.js + TypeScript + tsx 热重载',
      bestFor: '构建 CLI 工具、API 服务、微服务',
      includes: 'ESM 模块、严格 TS、ESLint + Prettier',
      devCommand: 'npm run dev → tsx watch',
    },
    'java-fullstack': {
      summary: 'Spring Boot 3 + React + Vite',
      bestFor: '企业级全栈项目，需要 Java 后端',
      includes: '前端 React 工程 + Spring Boot 搭建指南',
      devCommand: '前端 npm run dev / 后端 mvn spring-boot:run',
    },
  },
  packageManager: {
    npm: 'Node.js 自带，最广泛兼容',
    pnpm: '更快的安装速度，磁盘占用更少',
    yarn: '经典选择，某些 monorepo 场景更成熟',
  },
  features: {
    eslint: '代码质量检查，捕获常见错误和风格问题',
    prettier: '自动格式化代码，团队风格统一',
    husky: 'Git 提交前自动检查，防止不合规代码入库',
    agents: 'AGENTS.md 文件，让 AI 助手理解项目约定',
    'coding-rules': '团队代码规范文档，新人 onboarding 必备',
  },
}

export function getTemplateHelp(templateKey) {
  return HELP.template[templateKey] ?? null
}

export function getPackageManagerHelp(pm) {
  return HELP.packageManager[pm] ?? null
}

export function getFeatureHelp(featureKey) {
  return HELP.features[featureKey] ?? null
}
