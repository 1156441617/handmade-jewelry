# 手作珠宝电商平台 - 前端

这是一个纯HTML/CSS/JavaScript实现的电商前端项目,无需任何框架依赖。

## 项目结构

```
handmade-jewelry-frontend/
├── index.html              # 首页 - 商品展示和导航
├── product-detail.html     # 商品详情页
├── cart.html              # 购物车页面
├── profile.html           # 用户中心页面
├── css/
│   └── styles.css         # 全局样式文件
├── js/
│   └── app.js             # 核心交互逻辑
└── images/                # 图片资源目录
```

## 功能特性

### 1. 首页 (index.html)
- ✅ 响应式导航栏(搜索框/购物车/用户中心)
- ✅ Hero展示区域
- ✅ 分类展示(戒指/耳环/项链/手链/礼盒套装)
- ✅ 商品筛选(全部/新品/热销/限量)
- ✅ 商品卡片展示
- ✅ 登录/注册弹窗
- ✅ 特色服务展示

### 2. 商品详情页 (product-detail.html)
- ✅ 商品大图展示(支持缩略图切换)
- ✅ 商品信息(名称/价格/评分/描述)
- ✅ 规格选择
- ✅ 数量选择器
- ✅ 加入购物车/立即购买
- ✅ 收藏功能
- ✅ 用户评价展示
- ✅ 相关推荐商品
- ✅ 服务保障说明

### 3. 购物车页面 (cart.html)
- ✅ 商品列表展示
- ✅ 全选/单选功能
- ✅ 数量修改
- ✅ 商品删除
- ✅ 移入收藏
- ✅ 优惠券应用
- ✅ 订单摘要计算
- ✅ 结算功能
- ✅ 空购物车提示

### 4. 用户中心 (profile.html)
- ✅ 个人信息管理
- ✅ 订单列表(待付款/已付款/已发货/已完成)
- ✅ 收货地址管理
- ✅ 收藏夹
- ✅ 侧边栏导航
- ✅ 退出登录

## 技术特点

### 核心技术
- **HTML5**: 语义化标签,SEO友好
- **CSS3**: 响应式设计,CSS变量,渐变背景,动画效果
- **Vanilla JavaScript**: 无框架依赖,原生DOM操作

### 设计特色
- **响应式布局**: 完美适配桌面端/平板/手机
- **优雅配色**: 金色主题(#c9a876),温暖舒适
- **流畅动画**: 悬停效果/过渡动画/渐变效果
- **组件化思维**: 可复用的UI组件

### 数据管理
- **LocalStorage**: 购物车/收藏夹/用户信息持久化
- **模拟数据**: 内置商品数据,无需后端即可预览

## 快速开始

### 方法1: 直接打开
直接在浏览器中打开 `index.html` 文件即可预览。

### 方法2: 使用本地服务器(推荐)

```bash
# 使用Python
cd d:\电商3\handmade-jewelry-frontend
python -m http.server 8080

# 或使用Node.js
npx http-server -p 8080
```

然后在浏览器访问: `http://localhost:8080`

## 页面路由

| 页面 | URL | 说明 |
|------|-----|------|
| 首页 | `index.html` | 商品展示和导航 |
| 商品详情 | `product-detail.html?id=1` | 查看商品详情 |
| 购物车 | `cart.html` | 管理购物车 |
| 用户中心 | `profile.html` | 个人信息和订单 |

## 主要功能演示

### 购物车操作
```javascript
// 添加到购物车
addToCart(productId);

// 从LocalStorage读取购物车
let cart = JSON.parse(localStorage.getItem('cart') || '[]');
```

### 收藏功能
```javascript
// 切换收藏
toggleWishlist(productId);

// 检查收藏状态
const wishlist = JSON.parse(localStorage.getItem('wishlist') || '[]');
```

### 用户认证
```javascript
// 保存用户信息
localStorage.setItem('user', JSON.stringify(userData));

// 检查登录状态
const user = JSON.parse(localStorage.getItem('user') || 'null');
```

## 浏览器兼容性

- ✅ Chrome (推荐)
- ✅ Firefox
- ✅ Safari
- ✅ Edge
- ✅ 移动端浏览器

## 后续扩展建议

1. **接入后端API**: 将模拟数据替换为真实的API调用
2. **添加更多页面**: 订单详情页/结算页/搜索页
3. **引入框架**: 可迁移到Vue/React提升开发效率
4. **性能优化**: 图片懒加载/代码分割/PWA支持
5. **SEO优化**: 添加meta标签/结构化数据

## 与后端集成

后端API地址配置在 `js/app.js` 中:

```javascript
const API_BASE_URL = 'http://localhost:3000/api';
```

主要API端点:
- `POST /api/auth/register` - 用户注册
- `POST /api/auth/login` - 用户登录
- `GET /api/products` - 获取商品列表
- `GET /api/products/:id` - 获取商品详情
- `POST /api/orders` - 创建订单
- `GET /api/users/profile` - 获取用户信息

## 开发说明

### 修改商品数据
编辑 `js/app.js` 中的 `mockProducts` 数组:

```javascript
const mockProducts = [
  {
    id: '1',
    name: '商品名称',
    price: 168,
    image: '💍',
    rating: 4.9,
    // ...
  }
];
```

### 修改主题色
编辑 `css/styles.css` 中的CSS变量:

```css
:root {
  --primary-color: #c9a876;  /* 主色调 */
  --bg-light: #faf8f5;       /* 浅色背景 */
}
```

## License

MIT

---

**注意**: 这是一个前端演示项目,所有数据存储在浏览器LocalStorage中,刷新页面后数据会保留,但清除浏览器缓存后数据会丢失。
