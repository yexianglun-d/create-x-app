import {
  LockOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Button, Form, Input, Typography } from 'antd'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAppCopy } from '../hooks/useAppCopy'
import { useAuthStore } from '../stores/auth'
import type { LoginFormValues, UserProfile } from '../types'

const loginBenefits = [
  '客户跟进按阶段沉淀',
  '服务工单按优先级处理',
  '审批任务集中收口',
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
      id: 'u-ops-lead',
      name: values.username || '运营负责人',
      email: 'ops@example.com',
      role: '运营负责人',
    }

    setSession('local-ops-session', user)
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

      <section className="login-panel">
        <div className="login-panel-head">
          <Typography.Title level={3}>{copy('login.cardTitle')}</Typography.Title>
          <Typography.Paragraph type="secondary">
            本地开发可使用任意账号密码登录，后续接入真实认证服务即可替换。
          </Typography.Paragraph>
        </div>

        <Form<LoginFormValues>
          layout="vertical"
          onFinish={handleFinish}
          initialValues={{
            username: 'ops',
            password: '123456',
          }}
        >
          <Form.Item
            label="账号"
            name="username"
            rules={[{ required: true, message: '请输入账号' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="请输入账号" />
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
      </section>
    </div>
  )
}
