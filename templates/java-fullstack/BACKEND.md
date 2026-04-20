# Spring Boot 后端搭建指南

## 一、环境要求

- Java 21
- Maven 3.9+
- 推荐 IDE：IntelliJ IDEA Ultimate 或 Community

## 二、创建 Spring Boot 项目

访问 [start.spring.io](https://start.spring.io/)，建议使用以下配置：

- Project: Maven
- Language: Java
- Spring Boot: 3.x
- Packaging: Jar
- Java: 21

推荐依赖：

- Spring Web
- Spring Data JPA
- Lombok
- Validation
- Spring Security

## 三、推荐目录结构

```text
src/main/java/com/example/app/
├── config/
├── controller/
├── service/
├── repository/
├── model/
│   ├── entity/
│   └── dto/
└── exception/
```

建议分层职责：

- `controller`：只负责请求入参和响应结构
- `service`：处理业务编排
- `repository`：处理持久化访问
- `model/entity`：数据库实体
- `model/dto`：接口输入输出模型
- `config`：安全、CORS、序列化等全局配置

前端工程位于 `frontend/` 目录，仓库根目录主要用于承载文档、Git Hooks 和后端相关说明。

## 四、CORS 配置

前端默认运行在 `http://localhost:5173`，推荐添加如下配置：

```java
@Configuration
public class WebCorsConfig implements WebMvcConfigurer {

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
            .allowedOrigins("http://localhost:5173")
            .allowedMethods("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS")
            .allowCredentials(true);
    }
}
```

## 五、连接前端

在 `frontend/vite.config.ts` 中为开发环境增加代理：

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
```

## 六、环境变量

建议在 `src/main/resources/application.yml` 中使用占位符管理数据库和 JWT 配置：

```yaml
spring:
  datasource:
    url: ${DB_URL:jdbc:postgresql://localhost:5432/app_db}
    username: ${DB_USERNAME:app_user}
    password: ${DB_PASSWORD:app_password}
  jpa:
    hibernate:
      ddl-auto: update
    open-in-view: false

security:
  jwt:
    secret: ${JWT_SECRET:please-change-this-secret}
    expire-seconds: ${JWT_EXPIRE_SECONDS:7200}
```

## 七、开发建议

- 将所有 API 统一收口在 `/api` 前缀下，便于前端代理与网关治理
- 先从健康检查、认证和一个核心资源的 CRUD 开始，避免启动期工程过大
- 按环境拆分配置：本地、测试、生产分别维护
