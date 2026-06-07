const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();
const { getAIProvider } = require('./ai/provider');
const analyzer = require('./ai/analyzer');

const app = express();
const PORT = 3002;
const MAIN_BACKEND_URL = 'http://localhost:3001';

// 确保必要目录存在
const dirs = ['public', 'uploads', 'data'];
dirs.forEach(dir => {
  const dirPath = path.join(__dirname, dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
});

// 版本历史文件路径
const VERSIONS_FILE = path.join(__dirname, 'data', 'versions.json');

// 初始化版本历史文件
if (!fs.existsSync(VERSIONS_FILE)) {
  fs.writeFileSync(VERSIONS_FILE, JSON.stringify([], null, 2), 'utf-8');
}

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 配置 multer 存储
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, 'uploads'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${uuidv4()}${ext}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB 限制
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('仅支持图片文件（jpeg, jpg, png, gif, webp）'));
    }
  }
});

// ==================== API 路由 ====================

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: '卖家中心',
    port: PORT,
    timestamp: new Date().toISOString()
  });
});

// AI 状态查询
app.get('/api/ai/status', (req, res) => {
  const aiProvider = getAIProvider();
  res.json({
    success: true,
    data: aiProvider.getStatus()
  });
});

// AI Provider 列表
app.get('/api/ai/providers', (req, res) => {
  const aiProvider = getAIProvider();
  res.json({
    success: true,
    data: aiProvider.listProviders()
  });
});

// AI 分析接口
app.post('/api/analyze', upload.array('images', 5), async (req, res) => {
  try {
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, message: '请上传至少一张图片' });
    }

    const aiProvider = getAIProvider();
    const results = [];

    for (const file of files) {
      const fileInfo = {
        filename: file.filename,
        originalname: file.originalname,
        path: file.path,
        size: file.size,
        mimetype: file.mimetype
      };

      const analysis = await aiProvider.analyzeImage(fileInfo);
      results.push({
        filename: file.filename,
        originalname: file.originalname,
        analysis
      });
    }

    const status = aiProvider.getStatus();

    res.json({
      success: true,
      message: '图片分析完成',
      data: results,
      ai: {
        provider: status.provider,
        name: status.name,
        fallbackUsed: status.fallbackUsed,
        available: status.available
      }
    });
  } catch (error) {
    console.error('AI分析错误:', error.message);
    res.status(500).json({ success: false, message: '图片分析失败', error: error.message });
  }
});

// 一键发布接口
app.post('/api/publish', async (req, res) => {
  const productData = req.body;
  const steps = [];
  let product = null;

  // 步骤1：验证商品数据
  const step1 = { step: 1, name: '数据验证', status: 'running' };
  steps.push(step1);

  const requiredFields = ['name', 'price', 'category'];
  const missingFields = requiredFields.filter(field => !productData[field]);

  if (missingFields.length > 0) {
    step1.status = 'failed';
    step1.message = `缺少必填字段: ${missingFields.join(', ')}`;
    return res.json({ success: false, message: '发布失败', steps });
  }

  step1.status = 'success';
  step1.message = '商品数据验证通过';

  // 步骤2：自动打包
  const step2 = { step: 2, name: '自动打包', status: 'running' };
  steps.push(step2);

  try {
    product = {
      id: uuidv4(),
      name: productData.name,
      price: productData.price,
      originalPrice: productData.originalPrice || 0,
      category: productData.category,
      material: productData.material || '',
      type: productData.type || '',
      description: productData.description || '',
      tags: productData.tags || [],
      stock: productData.stock || 0,
      images: productData.images || [],
      image: productData.image || (productData.images && productData.images[0]) || '',
      sku: productData.sku || analyzer.generateSKU(productData.category),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'active'
    };

    step2.status = 'success';
    step2.message = '商品记录创建成功';
  } catch (error) {
    step2.status = 'failed';
    step2.message = `打包失败: ${error.message}`;
    return res.json({ success: false, message: '发布失败', steps });
  }

  // 步骤3：版本控制
  const step3 = { step: 3, name: '版本控制', status: 'running' };
  steps.push(step3);

  try {
    let versions = [];
    try {
      versions = JSON.parse(fs.readFileSync(VERSIONS_FILE, 'utf-8'));
    } catch (e) {
      versions = [];
    }

    const versionRecord = {
      versionId: uuidv4(),
      productId: product.id,
      productName: product.name,
      data: { ...product },
      version: `v${versions.length + 1}`,
      timestamp: new Date().toISOString()
    };

    versions.push(versionRecord);
    fs.writeFileSync(VERSIONS_FILE, JSON.stringify(versions, null, 2), 'utf-8');

    step3.status = 'success';
    step3.message = `版本快照已保存 (${versionRecord.version})`;
  } catch (error) {
    step3.status = 'failed';
    step3.message = `版本保存失败: ${error.message}`;
    return res.json({ success: false, message: '发布失败', steps });
  }

  // 步骤4：环境检测
  const step4 = { step: 4, name: '环境检测', status: 'running' };
  steps.push(step4);

  let backendHealthy = false;
  try {
    const healthRes = await axios.get(`${MAIN_BACKEND_URL}/api/v1/health`, { timeout: 5000 });
    backendHealthy = healthRes.status === 200;
  } catch (e) {
    backendHealthy = false;
  }

  if (!backendHealthy) {
    step4.status = 'warning';
    step4.message = '主后端服务不可用，商品将保存为待部署状态';
  } else {
    step4.status = 'success';
    step4.message = '主后端服务运行正常';
  }

  // 步骤5：部署
  const step5 = { step: 5, name: '部署发布', status: 'running' };
  steps.push(step5);

  if (backendHealthy) {
    try {
      const deployRes = await axios.post(`${MAIN_BACKEND_URL}/api/v1/products/seller-publish`, product, {
        timeout: 10000,
        headers: { 'Content-Type': 'application/json' }
      });

      product.status = 'published';
      step5.status = 'success';
      step5.message = '商品已成功发布到主后端';
    } catch (error) {
      product.status = 'pending_deploy';
      step5.status = 'warning';
      step5.message = `部署到主后端失败，已保存为待部署: ${error.message}`;
      saveProductLocally(product);
    }
  } else {
    product.status = 'pending_deploy';
    step5.status = 'warning';
    step5.message = '主后端不可用，商品已保存为待部署状态';
    saveProductLocally(product);
  }

  const hasFailure = steps.some(s => s.status === 'failed');
  const hasWarning = steps.some(s => s.status === 'warning');

  res.json({
    success: !hasFailure,
    message: hasFailure ? '发布失败' : (hasWarning ? '发布完成（部分步骤异常）' : '发布成功'),
    steps,
    product
  });
});

// 本地保存待部署商品
function saveProductLocally(product) {
  const pendingFile = path.join(__dirname, 'data', 'pending-products.json');
  let pending = [];
  try {
    pending = JSON.parse(fs.readFileSync(pendingFile, 'utf-8'));
  } catch (e) {
    pending = [];
  }
  pending.push(product);
  fs.writeFileSync(pendingFile, JSON.stringify(pending, null, 2), 'utf-8');
}

// 版本历史接口
app.get('/api/versions', (req, res) => {
  try {
    const versions = JSON.parse(fs.readFileSync(VERSIONS_FILE, 'utf-8'));
    res.json({ success: true, data: versions });
  } catch (error) {
    console.error('读取版本历史失败:', error.message);
    res.json({ success: true, data: [] });
  }
});

// 环境状态接口
app.get('/api/env-status', async (req, res) => {
  let mainBackendStatus = 'offline';
  let mainBackendInfo = null;

  try {
    const healthRes = await axios.get(`${MAIN_BACKEND_URL}/api/v1/health`, { timeout: 5000 });
    mainBackendStatus = 'online';
    mainBackendInfo = healthRes.data;
  } catch (e) {
    mainBackendStatus = 'offline';
  }

  res.json({
    success: true,
    data: {
      sellerCenter: {
        status: 'online',
        port: PORT,
        timestamp: new Date().toISOString()
      },
      mainBackend: {
        status: mainBackendStatus,
        url: MAIN_BACKEND_URL,
        info: mainBackendInfo
      }
    }
  });
});

// 商品列表接口
app.get('/api/products', async (req, res) => {
  let products = [];

  // 尝试从主后端获取
  try {
    const response = await axios.get(`${MAIN_BACKEND_URL}/api/v1/products`, { timeout: 10000 });
    const data = response.data;
    if (Array.isArray(data)) {
      products = data;
    } else if (data && data.data) {
      products = Array.isArray(data.data) ? data.data : (data.data.products || []);
    } else if (data && data.products) {
      products = data.products;
    }
  } catch (error) {
    console.log('主后端不可用，使用本地数据');
  }

  // 合并本地待部署商品
  const pendingFile = path.join(__dirname, 'data', 'pending-products.json');
  try {
    const localProducts = JSON.parse(fs.readFileSync(pendingFile, 'utf-8'));
    products = [...localProducts, ...products];
  } catch (e) {
    // 无本地商品
  }

  res.json({
    success: true,
    data: products
  });
});

// multer 错误处理
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, message: '文件大小超过限制（最大10MB）' });
    }
    return res.status(400).json({ success: false, message: `上传错误: ${err.message}` });
  }
  if (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
  next();
});

// 启动服务器
app.listen(PORT, () => {
  console.log('===========================================');
  console.log(`  匠心手作卖家中心服务已启动`);
  console.log(`  地址: http://localhost:${PORT}`);
  console.log(`  端口: ${PORT}`);
  console.log(`  主后端: ${MAIN_BACKEND_URL}`);
  console.log('===========================================');
});
