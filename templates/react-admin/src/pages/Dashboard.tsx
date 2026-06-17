import {
  Button,
  Card,
  Col,
  Empty,
  Input,
  List,
  Progress,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
} from 'antd'
import { useMemo, useState } from 'react'
import { useAppCopy } from '../hooks/useAppCopy'
import { useAuthStore } from '../stores/auth'

interface CustomerRecord {
  key: string
  name: string
  owner: string
  stage: string
  priority: '高' | '中' | '低'
  nextAction: string
  dueAt: string
}

interface TicketRecord {
  key: string
  title: string
  customer: string
  status: string
}

const customerRecords: CustomerRecord[] = [
  {
    key: '1',
    name: '华东渠道续约',
    owner: '林夏',
    stage: '合同确认',
    priority: '高',
    nextAction: '补齐采购审批附件',
    dueAt: '今天 17:00',
  },
  {
    key: '2',
    name: '新门店上线支持',
    owner: '周南',
    stage: '方案沟通',
    priority: '中',
    nextAction: '发送开店物料清单',
    dueAt: '明天 10:30',
  },
  {
    key: '3',
    name: '季度培训排期',
    owner: '许岚',
    stage: '待排期',
    priority: '低',
    nextAction: '确认一线主管名单',
    dueAt: '周五',
  },
]

const ticketRecords: TicketRecord[] = [
  { key: 's-1', title: '设备巡检反馈', customer: '杭州旗舰店', status: '待派单' },
  { key: 's-2', title: '合同开票咨询', customer: '华南渠道', status: '财务确认中' },
  { key: 's-3', title: '物料补发申请', customer: '成都新店', status: '仓储处理中' },
]

const approvalItems = [
  '审批华东渠道合同补充协议',
  '确认新门店上线物料预算',
  '复核本周高优工单处理结果',
]

function getPriorityColor(priority: CustomerRecord['priority']) {
  if (priority === '高') {
    return 'red'
  }

  if (priority === '中') {
    return 'gold'
  }

  return 'green'
}

export default function Dashboard() {
  const { copy } = useAppCopy()
  const user = useAuthStore((state) => state.user)
  const [ownerFilter, setOwnerFilter] = useState('全部')
  const [keyword, setKeyword] = useState('')

  const filteredCustomers = useMemo(() => {
    const normalizedKeyword = keyword.trim()

    return customerRecords.filter((record) => {
      const matchesOwner = ownerFilter === '全部' || record.owner === ownerFilter
      const matchesKeyword = !normalizedKeyword
        || record.name.includes(normalizedKeyword)
        || record.nextAction.includes(normalizedKeyword)

      return matchesOwner && matchesKeyword
    })
  }, [keyword, ownerFilter])

  return (
    <div className="dashboard-grid">
      <section className="dashboard-header">
        <div>
          <h2>{copy('dashboard.title')}</h2>
          <p>{copy('dashboard.desc')}</p>
        </div>
        <Space wrap>
          <Tag color="blue" bordered={false}>负责人：{user?.name ?? '未登录'}</Tag>
          <Tag color="green" bordered={false}>今日需处理 {customerRecords.length + ticketRecords.length} 项</Tag>
        </Space>
      </section>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card bordered={false}>
            <Statistic title="待跟进客户" value={customerRecords.length} suffix="个" />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card bordered={false}>
            <Statistic title="待处理工单" value={ticketRecords.length} suffix="个" />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card bordered={false}>
            <Statistic title="本周完成率" value={72} suffix="%" />
            <Progress percent={72} showInfo={false} strokeColor="#2563eb" />
          </Card>
        </Col>
      </Row>

      <Card bordered={false} title="客户跟进">
        <div className="table-toolbar">
          <Select
            value={ownerFilter}
            style={{ width: 160 }}
            onChange={setOwnerFilter}
            options={['全部', '林夏', '周南', '许岚'].map((owner) => ({
              label: owner,
              value: owner,
            }))}
          />
          <Input.Search
            allowClear
            placeholder="搜索客户或下一步动作"
            style={{ maxWidth: 320 }}
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
        </div>
        <Table<CustomerRecord>
          pagination={false}
          rowKey="key"
          locale={{ emptyText: <Empty description="暂无匹配客户" /> }}
          dataSource={filteredCustomers}
          columns={[
            {
              title: '客户事项',
              dataIndex: 'name',
            },
            {
              title: '阶段',
              dataIndex: 'stage',
              render: (stage: string) => <Tag color="blue">{stage}</Tag>,
            },
            {
              title: '负责人',
              dataIndex: 'owner',
            },
            {
              title: '优先级',
              dataIndex: 'priority',
              render: (priority: CustomerRecord['priority']) => (
                <Tag color={getPriorityColor(priority)}>{priority}</Tag>
              ),
            },
            {
              title: '下一步动作',
              dataIndex: 'nextAction',
            },
            {
              title: '截止时间',
              dataIndex: 'dueAt',
            },
          ]}
        />
      </Card>

      <div className="dashboard-bottom-grid">
        <Card bordered={false} title="服务工单">
          <List
            dataSource={ticketRecords}
            renderItem={(ticket) => (
              <List.Item
                actions={[
                  <Button key="assign" type="link">处理</Button>,
                ]}
              >
                <List.Item.Meta
                  title={ticket.title}
                  description={`${ticket.customer} · ${ticket.status}`}
                />
              </List.Item>
            )}
          />
        </Card>

        <Card bordered={false} title="审批任务">
          <List
            dataSource={approvalItems}
            renderItem={(item) => (
              <List.Item>
                <Space direction="vertical" size={2}>
                  <strong>{item}</strong>
                  <span className="muted-text">建议今日完成确认</span>
                </Space>
              </List.Item>
            )}
          />
        </Card>
      </div>
    </div>
  )
}
