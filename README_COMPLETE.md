# 手作珠宝电商平台 - 完整版使用指南

## 🎯 三种运行模式

### 模式1: 前端演示模式 (当前已配置)
**适用**: 快速演示、UI测试、学习前端开发
- ✅ 无需安装数据库
- ✅ 启动最快
- ✅ 功能完整(模拟数据)
- ❌ 数据不持久化

**启动**:
```bash
cd handmade-jewelry-frontend
双击 start.bat
```

---

### 模式2: Docker完整版 (推荐⭐)
**适用**: 完整功能测试、生产部署
- ✅ 一键启动所有服务
- ✅ 数据持久化
- ✅ 环境隔离
- ⚠️ 需要安装Docker

**启动**:
```bash
cd handmade-jewelry-backend
docker-compose up -d
```

访问:
- 后端API: http://localhost:3001
- 管理页面: 打开 admin/index.html
- 前端: 修改 js/app.js,设置 USE_MOCK_DATA = false

---

### 模式3: 手动安装完整版
**适用**: 深入学习、自定义配置
- ✅ 完全控制
- ✅ 适合开发调试
- ❌ 配置较复杂

**步骤**: 查看 `COMPLETE_SETUP.md`

---

## 📦 Docker快速开始

### 1. 安装Docker Desktop

下载: https://www.docker.com/products/docker-desktop/

### 2. 启动所有服务

```bash
cd d:\电商3\handmade-jewelry-backend
docker-compose up -d
```

### 3. 验证服务

```bash
# 检查容器状态
docker-compose ps

# 查看日志
docker-compose logs -f backend
```

### 4. 测试API

```bash
curl http://localhost:3001/api/v1/health
```

### 5. 停止服务

```bash
docker-compose down
```

---

## 🔧 常用Docker命令

```bash
# 启动
docker-compose up -d

# 停止
docker-compose down

# 重启
docker-compose restart

# 查看日志
docker-compose logs -f [service_name]

# 进入容器
docker exec -it jewelry-backend sh

# 重置数据库
docker-compose down -v
docker-compose up -d

# 查看资源使用
docker stats
```

---

## 📊 服务端口映射

| 服务 | 容器端口 | 主机端口 | 说明 |
|------|---------|---------|------|
| PostgreSQL | 5432 | 5432 | 数据库 |
| Redis | 6379 | 6379 | 缓存 |
| Backend API | 3001 | 3001 | 后端服务 |

---

## 🔐 默认凭据

### PostgreSQL
- 用户: `postgres`
- 密码: `postgres123`
- 数据库: `handmade_jewelry`

### 修改密码

编辑 `docker-compose.yml`:
```yaml
environment:
  POSTGRES_PASSWORD: 你的新密码
```

然后重启:
```bash
docker-compose down
docker-compose up -d
```

---

## 💾 数据备份

### 备份数据库

```bash
docker exec jewelry-postgres pg_dump -U postgres handmade_jewelry > backup.sql
```

### 恢复数据库

```bash
cat backup.sql | docker exec -i jewelry-postgres psql -U postgres handmade_jewelry
```

---

## 🚀 生产部署建议

### 1. 修改环境变量

创建 `.env.production`:
```env
POSTGRES_PASSWORD=强密码
JWT_SECRET=随机字符串
NODE_ENV=production
```

### 2. 使用HTTPS

配置Nginx反向代理:
```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;
    
    location /api/ {
        proxy_pass http://localhost:3001;
    }
}
```

### 3. 配置监控

使用Prometheus + Grafana监控性能。

---

## 📝 开发工作流

### 日常开发

```bash
# 1. 启动依赖服务(Docker)
docker-compose up -d postgres redis

# 2. 本地运行后端(方便调试)
cd handmade-jewelry-backend
npm run dev

# 3. 运行前端
cd ../handmade-jewelry-frontend
python -m http.server 8080
```

### 数据库迁移

```bash
# 修改 schema.sql 后
docker-compose down -v
docker-compose up -d
```

---

## 🐛 故障排查

### 问题1: 端口被占用

**错误**: `port is already allocated`

**解决**:
```bash
# 查看占用端口的进程
netstat -ano | findstr :3001

# 或修改 docker-compose.yml 中的端口映射
ports:
  - "3002:3001"  # 改为3002
```

### 问题2: 容器启动失败

**解决**:
```bash
# 查看详细日志
docker-compose logs backend

# 重新构建
docker-compose build --no-cache
docker-compose up -d
```

### 问题3: 数据库连接失败

**检查**:
```bash
# 确认PostgreSQL健康状态
docker-compose ps postgres

# 测试连接
docker exec -it jewelry-postgres psql -U postgres -c "SELECT 1;"
```

---

## 📚 相关文档

- `COMPLETE_SETUP.md` - 手动安装指南
- `CONNECTION_GUIDE.md` - 前后端连接指南  
- `QUICKSTART.md` - 快速开始
- `README.md` - 项目总览

---

## ✨ 总结

**推荐使用Docker模式**:
1. 安装Docker Desktop
2. 运行 `docker-compose up -d`
3. 前端修改配置连接后端
4. 开始使用完整功能!

简单、快速、可靠! 🎉
