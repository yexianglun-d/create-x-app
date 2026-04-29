import {
  ApiOutlined,
  ArrowUpOutlined,
  CheckCircleOutlined,
  FireOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import {
  Button,
  Card,
  Col,
  List,
  Row,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd'
import { fetchCurrentUser } from '../api/user'
import { useAppCopy } from '../hooks/useAppCopy'
import { useRequest } from '../hooks/useRequest'
import { useAuthStore } from '../stores/auth'

const summaryCards = [
  {
    key: 'orders',
    label: '今日订单',
    value: '18,426',
    footnote: '较昨日 +12.4%',
    icon: <FireOutlined />,
  },
  {
    key: 'users',
    label: '活跃用户',
    value: '4,238',
    footnote: '新客转化率 18.6%',
    icon: <TeamOutlined />,
  },
  {
    key: 'stability',
    label: '服务稳定性',
    value: '99.96%',
    footnote: '近 24 小时无阻断故障',
    icon: <CheckCircleOutlined />,
  },
]

const todoItems = [
  '把菜单权限接到真实角色数据',
  '为业务模块拆分独立路由分组',
  '将 API client 接入真实服务域名和 Token 刷新策略',
]

const approvalRows = [
  {
    key: '1',
    module: '活动审批',
    owner: '市场运营',
    status: '待处理',
    priority: '高',
  },
  {
    key: '2',
    module: '退款复核',
    owner: '客服团队',
    status: '处理中',
    priority: '中',
  },
  {
    key: '3',
    module: '角色变更',
    owner: '平台管理',
    status: '已通过',
    priority: '低',
  },
]

export default function Dashboard() {
  const { copy } = useAppCopy()
  const user = useAuthStore((state) => state.user)
  const currentUserRequest = useRequest(fetchCurrentUser)

  return (
    <div className="dashboard-grid">
      <Card className="dashboard-hero" bordered={false}>
        <Space direction="vertical" size={18}>
          <Tag color="cyan" bordered={false}>Admin Shell Ready</Tag>
          <div>
            <h2 className="dashboard-hero-title">{copy('dashboard.heroTitle')}</h2>
            <p className="dashboard-hero-desc">{copy('dashboard.heroDesc')}</p>
          </div>
          <Space size={12} wrap>
            <Tag color="blue" bordered={false}>当前用户：{user?.name ?? '未登录'}</Tag>
            <Tag color="geekblue" bordered={false}>角色：{user?.role ?? '管理员'}</Tag>
            <Tag color="green" bordered={false}>
              <ArrowUpOutlined /> 发布节奏平稳
            </Tag>
          </Space>
        </Space>
      </Card>

      <div className="dashboard-summary-grid">
        {summaryCards.map((summaryCard) => (
          <Card key={summaryCard.key} className="dashboard-card" bordered={false}>
            <div className="dashboard-kpi">
              <div>
                <p className="dashboard-kpi-label">{summaryCard.label}</p>
                <p className="dashboard-kpi-value">{summaryCard.value}</p>
                <p className="dashboard-kpi-footnote">{summaryCard.footnote}</p>
              </div>
              <div className="dashboard-kpi-icon">{summaryCard.icon}</div>
            </div>
          </Card>
        ))}
      </div>

      <div className="dashboard-main-grid">
        <Card
          className="dashboard-table"
          title="待办与审批流"
          extra={<Tag color="processing" bordered={false}>实时同步</Tag>}
          bordered={false}
        >
          <Table
            pagination={false}
            rowKey="key"
            dataSource={approvalRows}
            columns={[
              {
                title: '模块',
                dataIndex: 'module',
              },
              {
                title: '负责人',
                dataIndex: 'owner',
              },
              {
                title: '状态',
                dataIndex: 'status',
                render: (status: string) => {
                  const color = status === '待处理'
                    ? 'orange'
                    : status === '处理中'
                      ? 'blue'
                      : 'green'

                  return <Tag color={color}>{status}</Tag>
                },
              },
              {
                title: '优先级',
                dataIndex: 'priority',
                render: (priority: string) => {
                  const color = priority === '高'
                    ? 'red'
                    : priority === '中'
                      ? 'gold'
                      : 'default'

                  return <Tag color={color}>{priority}</Tag>
                },
              },
            ]}
          />
        </Card>

        <div className="dashboard-side-stack">
          <Card
            className="dashboard-side-card"
            title={copy('dashboard.requestTitle')}
            bordered={false}
            extra={<ApiOutlined />}
          >
            <Typography.Paragraph type="secondary">
              {copy('dashboard.requestDesc')}
            </Typography.Paragraph>
            <Button
              type="primary"
              loading={currentUserRequest.loading}
              onClick={() => {
                void currentUserRequest.execute()
              }}
            >
              {copy('dashboard.requestAction')}
            </Button>

            <div className="dashboard-request-result">
              {currentUserRequest.data
                ? JSON.stringify(currentUserRequest.data, null, 2)
                : currentUserRequest.error ?? copy('dashboard.requestEmpty')}
            </div>
          </Card>

          <Card className="dashboard-side-card" title="落地建议" bordered={false}>
            <List
              dataSource={todoItems}
              renderItem={(item) => (
                <List.Item>
                  <Typography.Text>{item}</Typography.Text>
                </List.Item>
              )}
            />
          </Card>

          <Card className="dashboard-side-card" title="团队节奏" bordered={false}>
            <Row gutter={[12, 12]}>
              <Col span={12}>
                <Statistic title="待审批" value={18} />
              </Col>
              <Col span={12}>
                <Statistic title="本周发布" value={7} />
              </Col>
            </Row>
          </Card>
        </div>
      </div>
    </div>
  )
}
