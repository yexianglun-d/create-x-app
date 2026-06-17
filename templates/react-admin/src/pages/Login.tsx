import {
  LockOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Button, Card, Form, Input, Typography } from 'antd'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAppCopy } from '../hooks/useAppCopy'
import { useAuthStore } from '../stores/auth'
import type { LoginFormValues, UserProfile } from '../types'

const loginBenefits = [
  '完整的认证与路由守卫架构',
  'Antd 主题与布局系统',
  '请求封装与错误处理',
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
    const user: UserProfile = {
      id: 'u-admin',
      name: values.username || '管理员',
      email: 'admin@example.com',
      role: '管理员',
    }

    setSession('local-demo-session', user)
    navigate('/', { replace: true })
  }

  return (
    <div className="login-page">
      <section className="login-intro">
        <SafetyCertificateOutlined className="login-icon" />
        <Typography.Title level={1}>{copy('login.title')}</Typography.Title>
        <Typography.Paragraph>{copy('login.desc')}</Typography.Paragraph>
        <ul className="login-benefits">
          {loginBenefits.map((benefit) => (
            <li key={benefit}>{benefit}</li>
          ))}
        </ul>
      </section>

      <Card className="login-card" bordered={false}>
        <Typography.Title level={3} className="login-card-title">
          {copy('login.cardTitle')}
        </Typography.Title>

        <Form layout="vertical" onFinish={handleFinish}>
          <Form.Item
            name="username"
            label="用户名"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="admin" size="large" />
          </Form.Item>

          <Form.Item
            name="password"
            label="密码"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="任意密码即可登录" size="large" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" block size="large">
              {copy('login.submit')}
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}
