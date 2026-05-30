# 🚀 一键部署指南（小白版）

## 第一步：注册账号

1. **注册GitHub账号
   - 访问：https://github.com
   - 点击右上角 "Sign up"
   - 按提示填写邮箱、密码、用户名

2. **注册Railway账号
   - 访问：https://railway.app
   - 点击 "Start New Project"
   - 用GitHub账号登录（点击 "Continue with GitHub"

3. **注册Vercel账号
   - 访问：https://vercel.com
   - 点击 "Sign Up"
   - 用GitHub账号登录

---

## 第二步：把代码上传到GitHub

### 方法A：使用命令行（推荐）

1. 在项目文件夹空白处，右键选择 "在终端中打开" 或 "Git Bash Here"

2. 输入以下命令（一行一行输入）：
```bash
git init
git add .
git commit -m "我的手作珠宝网站"
```

3. 去GitHub创建一个新仓库：
   - 登录GitHub，点击右上角 "+" → "New repository"
   - Repository name: `handmade-jewelry`
   - 点击 "Create repository"

4. 回到终端，继续输入（替换 `你的用户名` 为你的GitHub用户名）：
```bash
git remote add origin https://github.com/你的用户名/handmade-jewelry.git
git branch -M main
git push -u origin main
```

### 方法B：使用GitHub Desktop（更简单）

1. 下载安装：https://desktop.github.com
2. 打开GitHub Desktop，点击 "File" → "Add Local Repository"
3. 选择你的 `d:\开发\电商3` 文件夹
4. 点击 "Publish repository"
5. 填写仓库名称，点击 "Publish"

---

## 第三步：部署后端到Railway

1. 登录 https://railway.app
2. 点击 "New Project" → "Deploy from GitHub repo"
3. 点击 "Configure GitHub App" 或选择你的仓库
4. 选择你的 `handmade-jewelry` 仓库
5. 点击 "Deploy Now"
6. 等一会，部署成功后！

**重要：配置环境变量
7. 在Railway项目页面，点击 "Variables" 或 "Settings" → "Variables"
8. 添加以下变量：
```
NODE_ENV=production
PORT=3001
JWT_SECRET=你自己编一个长密码，比如：my-very-secure-jwt-key-123456789
JWT_REFRESH_SECRET=再编一个不一样的长密码
```

9. Railway会给你一个网址，复制下来！比如：`https://你的项目名.up.railway.app

---

## 第四步：修改前端API地址

1. 在你的电脑上，打开文件：`handmade-jewelry-frontend/js/api.js`
2. 找到第5行，改成你的Railway网址：
```javascript
const API_BASE_URL = 'https://你的-railway-地址.up.railway.app/api/v1';
```
3. 保存文件

4. 提交到GitHub：
```bash
git add .
git commit -m "修改API地址"
git push
```

---

## 第五步：部署前端到Vercel

1. 登录 https://vercel.com
2. 点击 "New Project"
3. 选择你的 `handmade-jewelry` 仓库
4. 在配置里，把 "Root Directory" 改成：`handmade-jewelry-frontend`
5. 点击 "Deploy"
6. 等几分钟，部署成功！

---

## 完成！🎉

你的网站上线了！Vercel会给你一个网址，比如：`https://你的项目名.vercel.app

把这个网址发给朋友，他们就能用了！

---

## 常见问题

**问：网站刷新后数据没了？**
答：因为我们现在用的是内存数据库（NO_DB_MODE），需要配置真实数据库。看项目里的database/schema.sql导入数据。

**问：怎么配置真实数据库？**
答：在Railway里点击 "New" → "Database" → "PostgreSQL"，Railway会自动给你数据库地址，然后修改后端的环境变量。
