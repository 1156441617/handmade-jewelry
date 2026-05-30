# 快速启动指南

## 第一步: 安装 PostgreSQL 和 Redis

### Windows 安装

**PostgreSQL:**
1. 下载: https://www.postgresql.org/download/windows/
2. 安装时记住设置的密码
3. 默认端口: 5432

**Redis:**
1. 下载: https://github.com/microsoftarchive/redis/releases
2. 解压运行 `redis-server.exe`
3. 默认端口: 6379

### macOS 安装

```bash
# 使用 Homebrew
brew install postgresql redis
brew services start postgresql
brew services start redis
```

### Linux (Ubuntu) 安装

```bash
sudo apt update
sudo apt install postgresql postgresql-contrib redis-server
sudo systemctl start postgresql
sudo systemctl start redis-server
```

## 第二步: 创建数据库

```bash
# 切换到postgres用户
sudo -i -u postgres

# 创建数据库
createdb handmade_jewelry

# 退出
exit
```

## 第三步: 导入数据库Schema

```bash
cd d:/电商3/handmade-jewelry-backend
psql -U postgres -d handmade_jewelry -f database/schema.sql
```

## 第四步: 配置环境变量

复制 `.env.example` 为 `.env`:

```bash
cp .env.example .env
```

编辑 `.env` 文件,至少修改以下配置:

```env
DB_PASSWORD=你的PostgreSQL密码
JWT_SECRET=随机生成的密钥(至少32字符)
JWT_REFRESH_SECRET=另一个随机密钥
```

## 第五步: 安装依赖并启动

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

看到以下输出表示成功:

```
✅ Database connected successfully
✅ Redis connected successfully
🚀 Server is running on port 3000
📡 API Version: v1
🌍 Environment: development
```

## 第六步: 测试API

### 健康检查

```bash
curl http://localhost:3000/api/v1/health
```

应该返回:

```json
{
  "success": true,
  "message": "API is running",
  "timestamp": "2026-05-27T..."
}
```

### 注册用户

```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "test123456",
    "username": "测试用户"
  }'
```

### 登录获取Token

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "test123456"
  }'
```

保存返回的 `accessToken`,后续请求需要使用。

### 获取商品列表

```bash
curl http://localhost:3000/api/v1/products
```

## 常见问题

### 1. 数据库连接失败

**错误**: `database connection failed`

**解决**:
- 检查PostgreSQL是否运行
- 确认 `.env` 中的数据库配置正确
- 验证数据库 `handmade_jewelry` 已创建

### 2. Redis连接失败

**错误**: `Redis connection error`

**解决**:
- 检查Redis是否运行
- Windows: 确保 `redis-server.exe` 正在运行
- macOS/Linux: `brew services list` 查看状态

### 3. 端口被占用

**错误**: `Port 3000 is already in use`

**解决**:
- 修改 `.env` 中的 `PORT` 为其他端口
- 或者关闭占用3000端口的程序

### 4. 依赖安装失败

**错误**: `npm install` 失败

**解决**:
```bash
# 清除缓存
npm cache clean --force

# 删除node_modules重新安装
rm -rf node_modules package-lock.json
npm install
```

## 下一步

1. **添加商品数据**: 使用管理接口或手动插入测试数据
2. **配置支付**: 申请支付宝和微信支付商户号
3. **部署上线**: 参考部署文档
4. **前端对接**: 将前端项目连接到后端API

## 开发工具推荐

- **API测试**: Postman, Insomnia
- **数据库管理**: pgAdmin, DBeaver
- **Redis管理**: Redis Desktop Manager
- **日志查看**: 终端直接查看或使用Winston日志

## 需要帮助?

- 查看 `README.md` 获取完整文档
- 检查 `database/schema.sql` 了解数据库结构
- 查看 `src/controllers/` 了解各模块实现

祝开发顺利! 🎉
