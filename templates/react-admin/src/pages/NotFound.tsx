import { ArrowLeftOutlined } from '@ant-design/icons'
import { Button, Card, Result } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useAppCopy } from '../hooks/useAppCopy'

export default function NotFound() {
  const navigate = useNavigate()
  const { copy } = useAppCopy()

  return (
    <div className="admin-app" style={{ display: 'grid', minHeight: '100vh', placeItems: 'center', padding: 24 }}>
      <Card className="not-found-card" bordered={false}>
        <Result
          status="404"
          title={copy('notFound.title')}
          subTitle={copy('notFound.desc')}
          extra={(
            <Button
              type="primary"
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/', { replace: true })}
            >
              {copy('notFound.action')}
            </Button>
          )}
        />
      </Card>
    </div>
  )
}
