# 完整版安装指南 - PostgreSQL + Redis

## 📋 完整环境要求

要运行完整版后端(带真实数据库),需要安装:
1. **Node.js** (已安装 ✅)
2. **PostgreSQL** (数据库)
3. **Redis** (缓存)

---

## 🗄️ 第一步: 安装 PostgreSQL

### Windows 安装步骤

#### 1. 下载安装包
访问: https://www.postgresql.org/download/windows/

或直接下载:
- PostgreSQL 16: https://get.enterprisedb.com/postgresql/postgresql-16.1-1-windows-x64.exe

#### 2. 运行安装程序
- 选择安装目录 (默认: `C:\Program Files\PostgreSQL\16`)
- 选择组件: 全选
- 设置数据目录
- **设置密码**: 记住这个密码 (例如: `postgres123`)
- 端口: 5432 (默认)
- 区域设置: Default locale

#### 3. 验证安装
```bash
# 打开命令提示符
psql --version
# 应显示: psql (PostgreSQL) 16.x.x
```

---

## 💾 第二步: 安装 Redis

### Windows 安装选项

#### 选项1: 使用 WSL2 (推荐)
```bash
# 在WSL2中安装
sudo apt update
sudo apt install redis-server
redis-server --version
```

#### 选项2: 使用 Chocolatey
```bash
# 以管理员身份运行PowerShell
choco install redis-64
```

#### 选项3: 使用 Memurai (Redis兼容)
下载: https://www.memurai.com/get-memurai

#### 选项4: 使用 Docker (最简单)
```bash
docker run -d -p 6379:6379 --name redis redis:latest
```

---

## 🔧 第三步: 配置数据库

### 1. 创建数据库

```bash
# 登录PostgreSQL
psql -U postgres

# 输入密码后,执行以下SQL:
CREATE DATABASE handmade_jewelry;
\c handmade_jewelry
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
\q
```

### 2. 导入Schema

```bash
# 进入后端目录
cd d:\电商3\handmade-jewelry-backend

# 导入数据库结构
psql -U postgres -d handmade_jewelry -f database/schema.sql
```

### 3. 验证导入
```bash
psql -U postgres -d handmade_jewelry
\dt  # 查看所有表
SELECT COUNT(*) FROM products;  # 查看商品数量
\q
```

---

## ⚙️ 第四步: 修改后端配置

### 编辑 `.env` 文件

```bash
cd d:\电商3\handmade-jewelry-backend
notepad .env
```

修改以下内容:

```env
# 关闭无数据库模式
NO_DB_MODE=false

# 数据库配置
DB_HOST=localhost
DB_PORT=5432
DB_NAME=handmade_jewelry
DB_USER=postgres
DB_PASSWORD=你的PostgreSQL密码  # ← 改成你设置的密码
DB_POOL_MIN=2
DB_POOL_MAX=10

# Redis配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# JWT密钥(生产环境请修改)
JWT_SECRET=your_super_secret_jwt_key_2026
JWT_REFRESH_SECRET=your_refresh_secret_key_2026
```

---

## 🚀 第五步: 启动完整服务

### 1. 启动 Redis (如果使用Docker)
```bash
docker start redis
```

### 2. 启动后端
```bash
cd d:\电商3\handmade-jewelry-backend
npm run dev
```

应该看到:
```
✅ Database connected successfully
✅ Redis is ready
🚀 Server is running on port 3001
```

### 3. 测试API
```bash
curl http://localhost:3001/api/v1/health
```

---

## 📦 第六步: 添加测试数据 (可选)

创建一个种子脚本 `database/seed.js`:

```javascript
const { query } = require('../src/config/database');

async function seed() {
  try {
    // 插入测试商品
    await query(`
      INSERT INTO products (sku, name, price, stock_quantity, main_image_url, status)
      VALUES 
        ('TEST001', '月光石编织戒指', 168.00, 50, 'https://example.com/ring.jpg', 'active'),
        ('TEST002', '珍珠吊坠项链', 288.00, 30, 'https://example.com/necklace.jpg', 'active'),
        ('TEST003', '水晶耳环', 198.00, 40, 'https://example.com/earrings.jpg', 'active')
      ON CONFLICT (sku) DO NOTHING;
    `);
    
    console.log('✅ 测试数据插入成功');
  } catch (error) {
    console.error('❌ 插入失败:', error);
  } finally {
    process.exit();
  }
}

seed();
```

运行:
```bash
node database/seed.js
```

---

## 🎯 第七步: 前端连接后端

编辑 `handmade-jewelry-frontend/js/app.js`:

```javascript
// 修改第7行
const USE_MOCK_DATA = false;  // 使用真实后端API
```

---

## ✅ 验证完整环境

### 检查清单

- [ ] PostgreSQL 已安装并运行
- [ ] Redis 已安装并运行  
- [ ] 数据库 `handmade_jewelry` 已创建
- [ ] Schema 已导入 (20张表)
- [ ] `.env` 配置正确
- [ ] 后端启动无错误
- [ ] API健康检查通过
- [ ] 前端可以访问后端

### 测试命令

```bash
# 1. 检查PostgreSQL
psql -U postgres -l | findstr handmade_jewelry

# 2. 检查Redis
redis-cli ping
# 应返回: PONG

# 3. 检查后端
curl http://localhost:3001/api/v1/health

# 4. 检查商品API
curl http://localhost:3001/api/v1/products
```

---

## 🐛 常见问题

### Q1: PostgreSQL连接失败

**解决**:
```bash
# 检查服务是否运行
# Windows: 打开"服务",查找 "postgresql-x64-16"

# 重启服务
net stop postgresql-x64-16
net start postgresql-x64-16
```

### Q2: Redis连接失败

**解决**:
```bash
# 检查Redis是否运行
redis-cli ping

# 如果未安装,使用Docker
docker run -d -p 6379:6379 redis
```

### Q3: 端口被占用

**解决**:
```bash
# 查看端口占用
netstat -ano | findstr :5432  # PostgreSQL
netstat -ano | findstr :6379  # Redis

# 修改 .env 中的端口号
```

---

## 📊 性能对比

| 项目 | 无数据库模式 | 完整版 |
|------|------------|--------|
| 启动速度 | ⚡ 快 | 🐢 较慢 |
| 数据持久化 | ❌ 否 | ✅ 是 |
| API功能 | ⚠️ 部分 | ✅ 完整 |
| 性能 | 🚀 快(内存) | ⚡ 中等 |
| 适用场景 | 开发/演示 | 生产环境 |

---

## 🎓 学习建议

**初学者**:
1. 先用无数据库模式熟悉代码
2. 学习SQL基础
3. 再尝试安装完整环境

**开发者**:
1. 直接安装完整版
2. 研究数据库设计
3. 优化查询性能

---

## 📞 需要帮助?

如果安装过程中遇到问题:
1. 查看各软件的官方文档
2. 检查错误日志
3. 确认防火墙设置
4. 验证端口未被占用

---

**祝您安装顺利!** 🎉
