# 后端说明

本项目已经包含一个可运行的 Spring Boot 后端，位于 `backend/`。

## 环境要求

- Java 21
- Maven 3.9+

## 启动后端

```bash
cd backend
mvn spring-boot:run
```

后端默认监听 `http://localhost:8080`，前端开发服务会通过 Vite 代理访问 `/api/**`。

## 已包含能力

- `GET /api/health`：健康检查
- `GET /api/customer-actions`：查询客户行动列表
- `POST /api/customer-actions`：创建客户行动
- H2 内存数据库：本地启动即用
- JPA 分层：Controller / Service / Repository / Entity
- Bean Validation：创建接口入参校验
- CORS：默认允许 `http://localhost:5173`

## 推荐扩展顺序

1. 将 H2 切换为 PostgreSQL 或 MySQL。
2. 增加登录认证和操作人信息。
3. 为客户行动增加分页、搜索和状态流转。
4. 将错误响应统一到全局异常处理器。
5. 补充 Controller 层接口测试和 Service 层业务测试。
