# 🎉 超简单部署攻略（30分钟上线）

## 准备工作

你需要3个账号：
- [ ] GitHub账号（免费）
- [ ] Railway账号（免费）
- [ ] Vercel账号（免费）

---

## 第1步：上传代码到GitHub (10分钟)

### 如果你是小白这样做：

1. 去 https://github.com/new
2. 登录或注册账号
3. 创建仓库名：`handmade-jewelry`
4. 选择 Public/Private 都可以
5. 不要点 "Initialize this repository"
6. 点击 "Create repository"

6. 在你的电脑上，在项目文件夹右键 → 按住Shift + 右键 → 选择 "在此处打开PowerShell窗口"

7. 输入（一行一行输，按回车）：
```bash
git init
git add .
git commit -m "我的手作珠宝商城"
git branch -M main
git remote add origin https://github.com/你的GitHub用户名/handmade-jewelry.git
git push -u origin main
```

（注意：把"你的GitHub用户名"要替换成你自己的！）

---

## 第2步：部署后端 (10分钟)

1. 去 https://railway.app
2. 用GitHub登录
3. 点击 "New Project"
4. 选择 "Deploy from GitHub repo"
5. 选择你的仓库
6. 点击 "Deploy Now"
7. 等进度条走完，点 "Variables" 或 "Settings" → "Variables"
8. 点 "New Variable"，添加：
```
NODE_ENV = production
PORT = 3001
JWT_SECRET = 随便编一个很长的密码，比如：abc123def456ghi789
JWT_REFRESH_SECRET = 再随便编另一个很长的密码
```
9. 复制Railway给你的URL！比如：`https://xxx.up.railway.app

---

## 第3步：改前端 (5分钟)

1. 打开你电脑上的 `d:\开发\电商3\handmade-jewelry-frontend\js\api.js
2. 把第5行改成：
```javascript
const API_BASE_URL = 'https://你的railway地址/api/v1';
```
3. 保存

4. 在PowerShell再输入：
```bash
git add .
git commit -m "更新API地址"
git push
```

---

## 第4步：部署前端 (5分钟)

1. 去 https://vercel.com
2. GitHub登录
3. 点击 "New Project"
4. 选你的仓库
5. "Root Directory" 选 `handmade-jewelry-frontend`
6. 点击 "Deploy"

---

## 完成！🎊

Vercel会给你一个链接，比如：`https://你的项目名.vercel.app

把这个链接发给别人，他们就能用了！

---

记住：免费版够用了！

如果需要更多功能再升级！
