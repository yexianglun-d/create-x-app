import {
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

interface ProjectRecord {
  key: string
  name: string
  owner: string
  stage: string
  priority: '高' | '中' | '低'
  nextAction: string
  dueAt: string
}

interface TaskRecord {
  key: string
  title: string
  status: string
}

const projectRecords: ProjectRecord[] = [
  {
    key: '1',
    name: '示例项目 A',
    owner: '张三',
    stage: '开发中',
    priority: '高',
    nextAction: '完成核心模块开发',
    dueAt: '本周五',
  },
  {
    key: '2',
    name: '示例项目 B',
    owner: '李四',
    stage: '待评审',
    priority: '中',
    nextAction: '提交技术方案评审',
    dueAt: '下周一',
  },
  {
    key: '3',
    name: '示例项目 C',
    owner: '王五',
    stage: '已规划',
    priority: '低',
    nextAction: '确认需求范围',
    dueAt: '月底',
  },
]

const taskRecords: TaskRecord[] = [
  { key: 't-1', title: '完成技术方案文档', status: '进行中' },
  { key: 't-2', title: '代码审查与合并', status: '待处理' },
  { key: 't-3', title: '部署测试环境', status: '已完成' },
]

const priorityColorMap: Record<string, string> = {
  高: 'red',
  中: 'orange',
  低: 'blue',
}

const statusColorMap: Record<string, string> = {
  待处理: 'default',
  进行中: 'processing',
  已完成: 'success',
}

const projectColumns = [
  { title: '项目', dataIndex: 'name', key: 'name' },
  { title: '负责人', dataIndex: 'owner', key: 'owner', width: 100 },
  { title: '阶段', dataIndex: 'stage', key: 'stage', width: 100 },
  {
    title: '优先级',
    dataIndex: 'priority',
    key: 'priority',
    width: 80,
    render: (priority: string) => (
      <Tag color={priorityColorMap[priority] ?? 'default'}>{priority}</Tag>
    ),
  },
  { title: '下一步', dataIndex: 'nextAction', key: 'nextAction' },
  { title: '截止', dataIndex: 'dueAt', key: 'dueAt', width: 100 },
]

export default function Dashboard() {
  const { copy } = useAppCopy()
  const user = useAuthStore((state) => state.user)

  const [ownerFilter, setOwnerFilter] = useState<string>('')
  const [priorityFilter, setPriorityFilter] = useState<string>('')
  const [keyword, setKeyword] = useState('')

  const owners = useMemo(
    () => [...new Set(projectRecords.map((record) => record.owner))],
    [],
  )

  const filteredProjects = useMemo(() => {
    return projectRecords.filter((record) => {
      if (ownerFilter && record.owner !== ownerFilter) return false
      if (priorityFilter && record.priority !== priorityFilter) return false
      if (keyword && !record.name.includes(keyword)) return false
      return true
    })
  }, [ownerFilter, priorityFilter, keyword])

  return (
    <>
      <section className="dashboard-hero">
        <div>
          <p className="dashboard-label">
            {copy('brand.name')} · {user?.role ?? '管理员'}
          </p>
          <h1 className="dashboard-title">{copy('dashboard.title')}</h1>
          <p className="dashboard-subtitle">{copy('dashboard.desc')}</p>
        </div>
      </section>

      <Row gutter={[16, 16]} className="dashboard-stat-row">
        <Col xs={12} sm={6}>
          <Card bordered={false}>
            <Statistic title="进行中项目" value={2} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false}>
            <Statistic title="待处理任务" value={1} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false}>
            <Statistic title="高优事项" value={1} valueStyle={{ color: '#dc2626' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false}>
            <Statistic title="本周完成率" value={67} suffix="%" />
            <Progress percent={67} size="small" showInfo={false} style={{ marginTop: 8 }} />
          </Card>
        </Col>
      </Row>

      <section className="dashboard-workspace">
        <div className="dashboard-workspace-header">
          <h2>项目跟踪</h2>
          <Space wrap>
            <Input.Search
              allowClear
              placeholder="搜索项目"
              onSearch={setKeyword}
              style={{ width: 180 }}
            />
            <Select
              allowClear
              placeholder="负责人"
              style={{ width: 120 }}
              options={owners.map((owner) => ({ label: owner, value: owner }))}
              onChange={(value) => setOwnerFilter(value ?? '')}
            />
            <Select
              allowClear
              placeholder="优先级"
              style={{ width: 100 }}
              options={[
                { label: '高', value: '高' },
                { label: '中', value: '中' },
                { label: '低', value: '低' },
              ]}
              onChange={(value) => setPriorityFilter(value ?? '')}
            />
          </Space>
        </div>

        {filteredProjects.length > 0 ? (
          <Table
            dataSource={filteredProjects}
            columns={projectColumns}
            rowKey="key"
            pagination={false}
            size="middle"
          />
        ) : (
          <Empty description="没有匹配的项目" />
        )}
      </section>

      <section className="dashboard-workspace">
        <div className="dashboard-workspace-header">
          <h2>待办任务</h2>
        </div>

        <List
          dataSource={taskRecords}
          rowKey="key"
          renderItem={(item) => (
            <List.Item
              extra={<Tag color={statusColorMap[item.status] ?? 'default'}>{item.status}</Tag>}
            >
              <List.Item.Meta title={item.title} />
            </List.Item>
          )}
        />
      </section>
    </>
  )
}
