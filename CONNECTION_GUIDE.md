# 前后端连接指南

## ✅ 当前状态

- **后端**: 运行在 http://localhost:3001
- **前端**: 配置为使用模拟数据(可切换到后端API)
- **管理页面**: 可直接打开使用

---

## 🔗 连接方式

### 方式一: 使用模拟数据(推荐,功能完整)

前端默认使用内置的模拟数据,无需后端即可运行所有功能。

**优点**:
- ✅ 功能完整,响应快速
- ✅ 无需启动后端服务
- ✅ 数据稳定,不会出错

**启动方式**:
```bash
cd d:\电商3\handmade-jewelry-frontend
双击 start.bat
```

访问: http://localhost:8080

---

### 方式二: 连接后端API

如果需要测试后端接口,可以切换到API模式。

**步骤**:

1. **确保后端正在运行**
   ```bash
   # 检查后端状态
   curl http://localhost:3001/api/v1/health
   ```

2. **修改前端配置**
   
   编辑文件: `js/app.js`
   
   将第7行改为:
   ```javascript
   const USE_MOCK_DATA = false;  // 使用后端API
   ```

3. **重启前端**
   ```bash
   cd d:\电商3\handmade-jewelry-frontend
   python -m http.server 8080
   ```

4. **访问前端**
   http://localhost:8080

---

## 📊 当前可用的API接口

### 健康检查
```
GET http://localhost:3001/api/v1/health
```

### 根路径
```
GET http://localhost:3001/
```

### 其他接口
由于使用无数据库模式,大部分数据接口返回空或错误。
如需完整功能,建议使用前端的模拟数据模式。

---

## 🎯 推荐用法

**日常使用/演示**:
- 前端使用模拟数据(USE_MOCK_DATA = true)
- 后端保持运行用于API测试
- 管理页面用于查看系统状态

**开发测试**:
- 安装PostgreSQL和Redis
- 修改 `.env`: `NO_DB_MODE=false`
- 导入数据库schema
- 前端切换到API模式(USE_MOCK_DATA = false)

---

## 🔧 故障排查

### 问题1: 前端无法访问后端

**检查**:
```bash
# 1. 后端是否运行
curl http://localhost:3001/api/v1/health

# 2. 端口是否正确
# 后端应该是 3001
# 前端配置应该是 http://localhost:3001/api/v1
```

### 问题2: API返回错误

**原因**: 无数据库模式下,数据接口不可用

**解决**: 
- 使用前端模拟数据(推荐)
- 或安装完整数据库环境

---

## 📱 快速启动命令

### 只启动前端(最简单)
```bash
cd d:\电商3\handmade-jewelry-frontend
双击 start.bat
```
访问: http://localhost:8080

### 启动后端+管理页面
```bash
# 后端已在运行
# 直接打开管理页面
双击 d:\电商3\handmade-jewelry-backend\admin\index.html
```

### 同时运行前后端
```bash
# 终端1: 后端(已运行)
cd d:\电商3\handmade-jewelry-backend
npm run dev

# 终端2: 前端
cd d:\电商3\handmade-jewelry-frontend
python -m http.server 8080
```

---

## ✨ 总结

**最佳实践**:
1. 前端使用模拟数据 - 功能完整流畅
2. 后端保持运行 - 用于API学习和测试  
3. 管理页面随时可用 - 监控系统状态

这样您可以同时拥有:
- ✅ 完整的电商用户体验
- ✅ 真实的后端API环境
- ✅ 便捷的管理工具
