import {
  LockOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Button, Card, Form, Input, Space, Typography } from 'antd'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAppCopy } from '../hooks/useAppCopy'
import { useAuthStore } from '../stores/auth'
import type { LoginFormValues, UserProfile } from '../types'

const loginMetrics = [
  { key: 'deploy', value: '24/7', label: '运维值守' },
  { key: 'release', value: '7', label: '本周发布' },
  { key: 'alert', value: '0', label: '阻断告警' },
]

export default function Login() {
  const navigate = useNavigate()
  const { copy } = useAppCopy()
  const token = useAuthStore((state) => state.token)
  const setSession = useAuthStore((state) => state.setSession)

  if (token) {
    return <Navigate to="/" replace />
  }

  async function handleFinish(values: LoginFormValues) {
    const demoUser: UserProfile = {
      id: 'u_admin',
      name: values.username || '系统管理员',
      email: 'admin@example.com',
      role: '超级管理员',
    }

    setSession('demo-admin-token', demoUser)
    navigate('/', { replace: true })
  }

  return (
    <div className="login-page">
      <div className="login-shell">
        <section className="login-showcase">
          <span className="login-kicker">
            <SafetyCertificateOutlined />
            {copy('login.kicker')}
          </span>
          <h1 className="login-title">{copy('login.title')}</h1>
          <p className="login-desc">{copy('login.desc')}</p>

          <div className="login-metric-grid">
            {loginMetrics.map((metric) => (
              <div key={metric.key} className="login-metric">
                <p className="login-metric-value">{metric.value}</p>
                <p className="login-metric-label">{metric.label}</p>
              </div>
            ))}
          </div>
        </section>

        <Card className="login-panel" bordered={false}>
          <Space direction="vertical" size={20} style={{ width: '100%' }}>
            <div>
              <Typography.Title level={3} style={{ marginBottom: 8 }}>
                {copy('login.cardTitle')}
              </Typography.Title>
              <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
                默认账号可直接输入任意用户名和密码进入示例后台。
              </Typography.Paragraph>
            </div>

            <Form<LoginFormValues> layout="vertical" onFinish={handleFinish} initialValues={{
              username: 'admin',
              password: '123456',
            }}>
              <Form.Item
                label="用户名"
                name="username"
                rules={[{ required: true, message: '请输入用户名' }]}
              >
                <Input prefix={<UserOutlined />} placeholder="请输入用户名" />
              </Form.Item>

              <Form.Item
                label="密码"
                name="password"
                rules={[{ required: true, message: '请输入密码' }]}
              >
                <Input.Password prefix={<LockOutlined />} placeholder="请输入密码" />
              </Form.Item>

              <Form.Item style={{ marginBottom: 0 }}>
                <Button type="primary" htmlType="submit" block size="large">
                  {copy('login.submit')}
                </Button>
              </Form.Item>
            </Form>
          </Space>
        </Card>
      </div>
    </div>
  )
}
