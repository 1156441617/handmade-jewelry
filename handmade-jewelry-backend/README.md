# 手作饰品电商后端 API

基于 Node.js + Express + PostgreSQL 的手作饰品电商平台后端系统,支持多平台运营和AI自动化功能。

## 🚀 技术栈

- **运行时**: Node.js 18+
- **框架**: Express.js
- **数据库**: PostgreSQL 14+
- **缓存**: Redis
- **认证**: JWT
- **支付**: 支付宝、微信支付
- **AI集成**: OpenAI API

## 📋 前置要求

- Node.js >= 18.0.0
- PostgreSQL >= 14.0
- Redis >= 6.0

## 🛠️ 安装步骤

### 1. 克隆项目

```bash
cd d:/电商3/handmade-jewelry-backend
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

复制 `.env.example` 为 `.env` 并填写配置:

```bash
cp .env.example .env
```

编辑 `.env` 文件,配置数据库、Redis、支付等信息。

### 4. 初始化数据库

```bash
# 创建数据库
createdb handmade_jewelry

# 执行Schema
psql -d handmade_jewelry -f database/schema.sql
```

### 5. 启动服务

```bash
# 开发模式
npm run dev

# 生产模式
npm start
```

服务将在 `http://localhost:3000` 启动

## 📁 项目结构

```
handmade-jewelry-backend/
├── database/
│   └── schema.sql              # 数据库Schema
├── src/
│   ├── config/
│   │   ├── database.js         # 数据库配置
│   │   └── redis.js            # Redis配置
│   ├── controllers/
│   │   ├── auth.controller.js  # 认证控制器
│   │   ├── product.controller.js # 商品控制器
│   │   └── order.controller.js # 订单控制器
│   ├── middleware/
│   │   └── auth.js             # 认证中间件
│   ├── services/
│   │   └── payment.service.js  # 支付服务
│   ├── routes/
│   │   └── index.js            # 路由定义
│   └── server.js               # 主服务器文件
├── .env.example                # 环境变量示例
├── package.json
└── README.md
```

## 🔑 API 接口

### 认证接口

- `POST /api/v1/auth/register` - 用户注册
- `POST /api/v1/auth/login` - 用户登录
- `GET /api/v1/auth/me` - 获取当前用户信息
- `PUT /api/v1/auth/profile` - 更新用户资料
- `POST /api/v1/auth/change-password` - 修改密码

### 商品接口

- `GET /api/v1/products` - 获取商品列表
- `GET /api/v1/products/:id` - 获取商品详情
- `GET /api/v1/products/categories` - 获取分类列表
- `POST /api/v1/products` - 创建商品(管理员)
- `PUT /api/v1/products/:id` - 更新商品(管理员)
- `DELETE /api/v1/products/:id` - 删除商品(管理员)
- `POST /api/v1/products/:productId/favorite` - 添加收藏
- `GET /api/v1/user/favorites` - 获取收藏列表

### 订单接口

- `POST /api/v1/orders` - 创建订单
- `GET /api/v1/orders` - 获取订单列表
- `GET /api/v1/orders/:id` - 获取订单详情
- `POST /api/v1/orders/:id/cancel` - 取消订单

### 支付接口

- `POST /api/v1/payments/alipay/create` - 创建支付宝订单
- `POST /api/v1/payments/wechat/create` - 创建微信订单
- `POST /api/v1/payments/alipay/notify` - 支付宝回调
- `POST /api/v1/payments/wechat/notify` - 微信回调

## 📝 使用示例

### 用户注册

```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123",
    "username": "张三"
  }'
```

### 用户登录

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'
```

### 获取商品列表

```bash
curl http://localhost:3000/api/v1/products?page=1&pageSize=20
```

### 创建订单

```bash
curl -X POST http://localhost:3000/api/v1/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "items": [
      {
        "product_id": "uuid-here",
        "quantity": 1
      }
    ],
    "shipping_name": "张三",
    "shipping_phone": "13800138000",
    "shipping_province": "浙江省",
    "shipping_city": "杭州市",
    "shipping_district": "西湖区",
    "shipping_address": "某某街道123号"
  }'
```

## 🔐 安全说明

1. **JWT密钥**: 请在生产环境中更换默认的JWT_SECRET
2. **HTTPS**: 生产环境务必启用HTTPS
3. **数据库密码**: 使用强密码并定期更换
4. **API限流**: 已配置请求限流保护
5. **CORS**: 根据实际需求配置允许的域名

## 🧪 测试

```bash
npm test
```

## 📊 数据库管理

### 备份数据库

```bash
pg_dump handmade_jewelry > backup.sql
```

### 恢复数据库

```bash
psql handmade_jewelry < backup.sql
```

## 🚢 部署建议

1. 使用 PM2 进行进程管理
2. 配置 Nginx 反向代理
3. 启用 HTTPS (Let's Encrypt)
4. 配置日志轮转
5. 设置监控告警

## 📞 技术支持

如有问题请提交 Issue 或联系开发团队。

## 📄 许可证

MIT License
