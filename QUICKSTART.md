# 手作珠宝电商平台 - 快速启动指南

## 🚀 5分钟快速预览

### 前端预览(无需配置)

**Windows用户**:
1. 打开 `handmade-jewelry-frontend` 文件夹
2. 双击 `start.bat` 文件
3. 浏览器会自动打开 http://localhost:8080

**或者手动启动**:
```bash
# 方法1: 使用Python
cd handmade-jewelry-frontend
python -m http.server 8080

# 方法2: 使用Node.js
cd handmade-jewelry-frontend
npx http-server -p 8080

# 方法3: 直接打开
双击 index.html 文件
```

访问地址: http://localhost:8080

---

## 📋 完整部署步骤

### 一、后端部署

#### 1. 环境准备

确保已安装以下软件:
- ✅ Node.js 18+ ([下载](https://nodejs.org/))
- ✅ PostgreSQL 14+ ([下载](https://www.postgresql.org/download/))
- ✅ Redis 6+ ([下载](https://redis.io/download/))

验证安装:
```bash
node --version    # 应显示 v18.x.x 或更高
psql --version    # 应显示 psql (PostgreSQL) 14.x.x
redis-server --version  # 应显示 v=6.x.x 或更高
```

#### 2. 数据库初始化

```bash
# 1. 登录PostgreSQL
psql -U postgres

# 2. 创建数据库
CREATE DATABASE jewelry_db;

# 3. 启用UUID扩展
\c jewelry_db
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

# 4. 导入Schema
\i d:/电商3/handmade-jewelry-backend/database/schema.sql

# 5. 退出
\q
```

#### 3. Redis启动

```bash
# Windows(如果安装了Redis)
redis-server

# Linux/Mac
redis-server --daemonize yes
```

#### 4. 后端配置

```bash
# 进入后端目录
cd handmade-jewelry-backend

# 安装依赖
npm install

# 复制环境变量模板
copy .env.example .env   # Windows
cp .env.example .env     # Mac/Linux

# 编辑 .env 文件,修改以下配置:
```

编辑 `.env` 文件:
```env
# 数据库配置
DB_HOST=localhost
DB_PORT=5432
DB_NAME=jewelry_db
DB_USER=postgres
DB_PASSWORD=你的PostgreSQL密码

# Redis配置
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT密钥(必须修改!)
JWT_SECRET=your_super_secret_key_change_this
JWT_REFRESH_SECRET=your_refresh_secret_change_this

# 其他配置保持默认即可
```

#### 5. 启动后端服务

```bash
# 开发模式(推荐,支持热重载)
npm run dev

# 或生产模式
npm start
```

看到以下输出表示成功:
```
🚀 Server running on port 3000
📊 Environment: development
🔗 Database: Connected
💾 Redis: Connected
```

访问API文档: http://localhost:3000/api/health

---

### 二、前端部署

#### 1. 简单预览(推荐新手)

```bash
# 进入前端目录
cd handmade-jewelry-frontend

# Windows用户
双击 start.bat

# 或使用Python
python -m http.server 8080

# 或使用Node.js
npx http-server -p 8080
```

访问: http://localhost:8080

#### 2. 连接后端API

编辑 `js/app.js`,修改API地址:

```javascript
// 将这行
const API_BASE_URL = 'http://localhost:3000/api';

// 确认后端服务正在运行
// 如果后端在其他端口,修改为对应端口
```

---

## ✅ 功能测试清单

### 前端功能测试

#### 首页测试
- [ ] 访问首页 http://localhost:8080
- [ ] 浏览商品列表
- [ ] 点击分类筛选
- [ ] 搜索商品
- [ ] 添加商品到购物车
- [ ] 收藏商品
- [ ] 点击商品卡片跳转到详情页

#### 商品详情页测试
- [ ] 查看商品图片和信息
- [ ] 切换缩略图
- [ ] 选择款式
- [ ] 修改数量
- [ ] 添加到购物车
- [ ] 立即购买(跳转购物车)
- [ ] 收藏/取消收藏
- [ ] 查看用户评价
- [ ] 查看相关推荐

#### 购物车测试
- [ ] 查看购物车商品
- [ ] 全选/取消全选
- [ ] 修改商品数量
- [ ] 删除商品
- [ ] 移入收藏
- [ ] 应用优惠券(测试码: SAVE20, SAVE50)
- [ ] 查看订单摘要
- [ ] 点击结算按钮

#### 用户中心测试
- [ ] 查看个人信息
- [ ] 编辑个人资料
- [ ] 查看订单列表
- [ ] 切换订单标签
- [ ] 查看收货地址
- [ ] 查看收藏夹
- [ ] 退出登录

### 后端API测试

使用Postman或curl测试API:

#### 1. 健康检查
```bash
curl http://localhost:3000/api/health
```

预期响应:
```json
{
  "status": "ok",
  "timestamp": "2026-05-27T10:00:00.000Z"
}
```

#### 2. 用户注册
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "Test@123456"
  }'
```

#### 3. 用户登录
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "Test@123456"
  }'
```

保存返回的token用于后续请求。

#### 4. 获取商品列表
```bash
curl http://localhost:3000/api/products?page=1&limit=10
```

#### 5. 获取商品详情
```bash
curl http://localhost:3000/api/products/1
```

---

## 🔧 常见问题

### Q1: 后端启动失败,提示数据库连接错误

**解决方案**:
1. 确认PostgreSQL服务已启动
2. 检查 `.env` 文件中的数据库配置是否正确
3. 确认数据库 `jewelry_db` 已创建
4. 检查数据库用户权限

```bash
# 检查PostgreSQL状态
pg_ctl status

# 启动PostgreSQL(Windows)
net start postgresql-x64-14

# 启动PostgreSQL(Linux)
sudo systemctl start postgresql
```

### Q2: Redis连接失败

**解决方案**:
1. 确认Redis服务已启动
2. 检查 `.env` 文件中的Redis配置

```bash
# 测试Redis连接
redis-cli ping
# 应返回 PONG
```

### Q3: 前端页面空白

**解决方案**:
1. 打开浏览器开发者工具(F12)
2. 查看Console是否有错误
3. 确认HTTP服务器正常启动
4. 检查文件路径是否正确

### Q4: 跨域错误(CORS)

**解决方案**:
后端已配置CORS,确保:
1. 后端服务正常运行
2. 前端请求的URL正确
3. 浏览器没有禁用Cookie

### Q5: 端口被占用

**解决方案**:
```bash
# 查看端口占用(Windows)
netstat -ano | findstr :3000

# 查看端口占用(Linux/Mac)
lsof -i :3000

# 修改端口
# 后端: 编辑 .env 文件,修改 PORT=3001
# 前端: 启动时指定其他端口,如 python -m http.server 8081
```

---

## 📱 移动端测试

### 在手机上访问

1. 确保手机和电脑在同一WiFi网络
2. 查看电脑IP地址:
   ```bash
   # Windows
   ipconfig
   
   # Mac/Linux
   ifconfig
   ```
3. 在手机浏览器输入: `http://电脑IP:8080`
   - 例如: `http://192.168.1.100:8080`

---

## 🎯 下一步建议

### 对于初学者
1. ✅ 先体验前端页面,熟悉功能
2. ✅ 阅读 `frontend/README.md` 了解前端结构
3. ✅ 修改CSS样式,尝试改变主题色
4. ✅ 修改模拟数据,添加自己的商品

### 对于开发者
1. ✅ 研究后端API设计
2. ✅ 查看数据库Schema设计
3. ✅ 理解JWT认证流程
4. ✅ 学习Redis缓存策略
5. ✅ 接入真实支付接口

### 对于商家
1. ✅ 定制商品信息
2. ✅ 上传真实产品图片
3. ✅ 配置支付接口
4. ✅ 部署到云服务器
5. ✅ 绑定域名

---

## 📚 相关文档

- [后端详细文档](handmade-jewelry-backend/README.md)
- [前端详细文档](handmade-jewelry-frontend/README.md)
- [完整技术架构](FULLSTACK_SUMMARY.md)
- [AI功能说明](handmade-jewelry-backend/AI_FEATURES.md)

---

## 💡 技术支持

遇到问题?
1. 查看本文档的"常见问题"部分
2. 阅读各项目的README文档
3. 检查浏览器控制台错误信息
4. 查看后端日志输出

---

**祝使用愉快!** 🎉
