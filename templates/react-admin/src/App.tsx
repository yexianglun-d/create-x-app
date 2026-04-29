import { App as AntApp, ConfigProvider, theme } from 'antd'
import { AppRouter } from './router'

export default function App() {
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: '#2563eb',
          colorInfo: '#2563eb',
          borderRadius: 16,
          fontFamily: '"SF Pro Display", "PingFang SC", "Segoe UI", sans-serif',
        },
      }}
    >
      <AntApp>
        <AppRouter />
      </AntApp>
    </ConfigProvider>
  )
}
