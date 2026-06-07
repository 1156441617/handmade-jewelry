/* ============================================
   匠心手作 卖家中心 — App Logic
   ============================================ */

(function () {
  'use strict';

  // ---- DOM References ----
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const uploadZone = $('#uploadZone');
  const fileInput = $('#fileInput');
  const previewGrid = $('#previewGrid');
  const aiSection = $('#ai-section');
  const confidenceBadge = $('#confidenceBadge');
  const productName = $('#productName');
  const categoryEl = $('#category');
  const materialEl = $('#material');
  const priceEl = $('#price');
  const originalPriceEl = $('#originalPrice');
  const descriptionEl = $('#description');
  const tagsContainer = $('#tagsContainer');
  const tagInput = $('#tagInput');
  const stockEl = $('#stock');
  const publishBtn = $('#publishBtn');
  const deployModal = $('#deployModal');
  const modalClose = $('#modalClose');
  const pipeline = $('#pipeline');
  const pipelineResult = $('#pipelineResult');
  const resultSuccess = $('#resultSuccess');
  const resultFailed = $('#resultFailed');
  const resultErrorMsg = $('#resultErrorMsg');
  const productGrid = $('#productGrid');
  const productEmpty = $('#productEmpty');
  const versionTimeline = $('#versionTimeline');
  const versionEmpty = $('#versionEmpty');
  const envDot = $('#envDot');
  const envText = $('#envText');
  const aiModelBadge = $('#aiModelBadge');
  const celebrateCanvas = $('#celebrateCanvas');

  // ---- State ----
  let uploadedFiles = [];
  let currentTags = [];
  let aiData = null;
  let uploadedImageUrls = [];

  // ---- Initialize ----
  document.addEventListener('DOMContentLoaded', () => {
    initUpload();
    initTags();
    initPublish();
    initModal();
    fetchEnvStatus();
    fetchAIStatus();
    fetchProducts();
    fetchVersions();
  });

  // ============================================
  // Upload
  // ============================================
  function initUpload() {
    uploadZone.addEventListener('click', () => fileInput.click());

    uploadZone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        fileInput.click();
      }
    });

    fileInput.addEventListener('change', (e) => {
      handleFiles(e.target.files);
      fileInput.value = '';
    });

    uploadZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadZone.classList.add('drag-over');
    });

    uploadZone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      uploadZone.classList.remove('drag-over');
    });

    uploadZone.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadZone.classList.remove('drag-over');
      handleFiles(e.dataTransfer.files);
    });
  }

  function handleFiles(fileList) {
    const files = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
    if (files.length === 0) return;

    const remaining = 8 - uploadedFiles.length;
    const toAdd = files.slice(0, remaining);
    if (toAdd.length === 0) {
      showToast('最多上传 8 张图片');
      return;
    }

    toAdd.forEach((file) => {
      uploadedFiles.push(file);
      addPreview(file, uploadedFiles.length - 1);
    });

    analyzeImages();
  }

  function addPreview(file, index) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const item = document.createElement('div');
      item.className = 'preview-item';
      item.setAttribute('role', 'listitem');
      item.innerHTML = `
        <img src="${e.target.result}" alt="预览图片 ${index + 1}">
        <button class="preview-remove" aria-label="移除图片 ${index + 1}" data-index="${index}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      `;
      item.querySelector('.preview-remove').addEventListener('click', (ev) => {
        ev.stopPropagation();
        removePreview(index);
      });
      previewGrid.appendChild(item);
    };
    reader.readAsDataURL(file);
  }

  function removePreview(index) {
    uploadedFiles[index] = null;
    previewGrid.innerHTML = '';
    const remaining = uploadedFiles.filter((f) => f !== null);
    uploadedFiles = remaining;
    remaining.forEach((file, i) => addPreview(file, i));

    if (uploadedFiles.length === 0) {
      aiSection.hidden = true;
      publishBtn.disabled = true;
      uploadedImageUrls = [];
    }
  }

  // ============================================
  // AI Analysis
  // ============================================
  async function analyzeImages() {
    aiSection.hidden = false;
    publishBtn.disabled = true;

    const aiFields = $$('.ai-field');
    aiFields.forEach((f) => f.classList.add('loading'));

    productName.value = '';
    categoryEl.value = '';
    materialEl.value = '';
    priceEl.value = '';
    originalPriceEl.value = '';
    descriptionEl.value = '';
    currentTags = [];
    renderTags();
    confidenceBadge.textContent = '';

    try {
      const formData = new FormData();
      uploadedFiles.forEach((file) => {
        if (file) formData.append('images', file);
      });

      const response = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('分析请求失败');

      const result = await response.json();
      if (result.success && result.data && result.data.length > 0) {
        const analysis = result.data[0].analysis;
        uploadedImageUrls = result.data.map(item => '/uploads/' + item.filename);
        aiData = analysis;

        // 显示 AI 模型状态
        if (result.ai) {
          updateAIModelBadge(result.ai);
        }

        populateAIFields(analysis);
        showToast(result.ai && result.ai.fallbackUsed
          ? 'AI 分析降级为本地模拟，请配置 API Key'
          : 'AI 分析完成，请确认信息后一键发布');
      } else {
        throw new Error(result.message || '分析结果为空');
      }
    } catch (err) {
      console.error('AI 分析失败:', err);
      const mockData = generateMockAI();
      aiData = mockData;
      populateAIFields(mockData);
      showToast('AI 分析失败，已使用模拟数据');
    } finally {
      aiFields.forEach((f) => f.classList.remove('loading'));
      publishBtn.disabled = false;
    }
  }

  function generateMockAI() {
    const categories = ['necklaces', 'rings', 'earrings', 'bracelets', 'pendants', 'accessories'];
    const materials = ['925纯银', '天然珍珠', '14K包金', '天然水晶', '手工编织绳', '琥珀'];
    const names = [
      '月华流苏手工银项链',
      '繁花似锦珍珠耳饰',
      '星辰大海水晶手链',
      '古韵流光琥珀吊坠',
      '云水禅意编织手镯',
    ];
    const tagOptions = [
      '手工制作', '纯银', '天然材质', '原创设计', '轻奢风',
      '复古', '极简', '国风', '送礼佳品', '限量款',
    ];

    const cat = categories[Math.floor(Math.random() * categories.length)];
    const mat = materials[Math.floor(Math.random() * materials.length)];
    const name = names[Math.floor(Math.random() * names.length)];
    const p = (Math.random() * 500 + 100).toFixed(2);
    const op = (parseFloat(p) * (1.2 + Math.random() * 0.5)).toFixed(2);
    const selectedTags = tagOptions.sort(() => 0.5 - Math.random()).slice(0, 3 + Math.floor(Math.random() * 3));
    const confidence = (70 + Math.random() * 25).toFixed(1);

    return {
      name,
      category: cat,
      material: mat,
      price: p,
      originalPrice: op,
      description: `这款${name}采用${mat}精心制作，每一处细节都凝聚匠人之心。独特的设计灵感源自自然之美，将传统工艺与现代审美完美融合。适合日常佩戴，也是送礼的绝佳选择。`,
      tags: selectedTags,
      confidence: parseFloat(confidence),
    };
  }

  function populateAIFields(data) {
    productName.value = data.name || '';
    // 尝试设置 select 值，如果不存在对应 option 则不设置
    const catValue = data.category || '';
    const option = categoryEl.querySelector(`option[value="${catValue}"]`);
    if (option) {
      categoryEl.value = catValue;
    } else {
      categoryEl.value = '';
      console.warn('AI 返回的分类值不在选项中:', catValue);
    }
    materialEl.value = data.material || '';
    priceEl.value = data.price || '';
    originalPriceEl.value = data.originalPrice || '';
    descriptionEl.value = data.description || '';
    currentTags = data.tags || [];
    renderTags();

    if (data.confidence) {
      confidenceBadge.textContent = `置信度 ${data.confidence}%`;
    }
  }

  // ============================================
  // Tags
  // ============================================
  function initTags() {
    tagInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const val = tagInput.value.trim();
        if (val && !currentTags.includes(val)) {
          currentTags.push(val);
          renderTags();
        }
        tagInput.value = '';
      }
    });
  }

  function renderTags() {
    tagsContainer.innerHTML = '';
    currentTags.forEach((tag, i) => {
      const chip = document.createElement('span');
      chip.className = 'tag-chip';
      chip.setAttribute('role', 'listitem');
      chip.innerHTML = `
        ${escapeHTML(tag)}
        <button class="tag-remove" aria-label="移除标签 ${escapeHTML(tag)}" data-index="${i}">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      `;
      chip.querySelector('.tag-remove').addEventListener('click', () => {
        currentTags.splice(i, 1);
        renderTags();
      });
      tagsContainer.appendChild(chip);
    });
  }

  // ============================================
  // Publish
  // ============================================
  function initPublish() {
    publishBtn.addEventListener('click', handlePublish);
  }

  async function handlePublish() {
    const formData = collectFormData();
    if (!formData) return;

    openModal();
    resetPipeline();

    try {
      const response = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error('发布请求失败');

      const data = await response.json();
      if (data.steps && data.steps.length > 0) {
        await runPipelineFromResponse(data.steps);
      } else {
        await runSimulatedPipeline();
      }
    } catch (err) {
      console.error('发布失败:', err);
      await runSimulatedPipeline();
    }
  }

  function collectFormData() {
    const name = productName.value.trim();
    if (!name) {
      showToast('请填写商品名称');
      productName.focus();
      return null;
    }

    const cat = categoryEl.value;
    if (!cat) {
      showToast('请选择商品分类');
      categoryEl.focus();
      return null;
    }

    const p = parseFloat(priceEl.value);
    if (!p || p <= 0) {
      showToast('请填写有效的售价');
      priceEl.focus();
      return null;
    }

    return {
      name,
      category: cat,
      material: materialEl.value.trim(),
      price: p,
      originalPrice: parseFloat(originalPriceEl.value) || 0,
      description: descriptionEl.value.trim(),
      tags: [...currentTags],
      stock: parseInt(stockEl.value, 10) || 0,
      images: uploadedImageUrls.length > 0 ? uploadedImageUrls : [],
      image: uploadedImageUrls.length > 0 ? uploadedImageUrls[0] : '',
    };
  }

  // ============================================
  // Deploy Pipeline
  // ============================================
  const STEP_STATUS_TEXT = {
    pending: '等待中',
    running: '进行中...',
    success: '完成',
    failed: '失败',
    warning: '警告',
  };

  function resetPipeline() {
    const steps = $$('.pipeline-step');
    steps.forEach((step) => {
      step.dataset.status = 'pending';
      step.querySelector('.step-status').textContent = STEP_STATUS_TEXT.pending;
    });
    pipelineResult.hidden = true;
    resultSuccess.hidden = true;
    resultFailed.hidden = true;
  }

  async function runSimulatedPipeline() {
    const steps = $$('.pipeline-step');
    for (let i = 0; i < steps.length; i++) {
      await setStepStatus(steps[i], 'running');
      await delay(800 + Math.random() * 1200);
      const success = Math.random() > 0.05;
      await setStepStatus(steps[i], success ? 'success' : 'failed');
      if (!success) {
        showPipelineResult(false, '步骤失败，请重试');
        return;
      }
    }
    showPipelineResult(true);
  }

  async function runPipelineFromResponse(pipelineData) {
    const steps = $$('.pipeline-step');
    for (let i = 0; i < steps.length; i++) {
      const stepInfo = pipelineData[i] || {};
      await setStepStatus(steps[i], 'running');
      await delay(500 + Math.random() * 500);
      // warning 也视为成功（部分异常但继续）
      const status = stepInfo.status === 'failed' ? 'failed' : (stepInfo.status === 'warning' ? 'warning' : 'success');
      await setStepStatus(steps[i], status);
      if (status === 'failed') {
        showPipelineResult(false, stepInfo.message || '步骤失败');
        return;
      }
    }
    showPipelineResult(true);
  }

  function setStepStatus(stepEl, status) {
    stepEl.dataset.status = status;
    stepEl.querySelector('.step-status').textContent = STEP_STATUS_TEXT[status] || status;
    return Promise.resolve();
  }

  function showPipelineResult(success, errorMsg) {
    pipelineResult.hidden = false;
    if (success) {
      resultSuccess.hidden = false;
      resultFailed.hidden = true;
      celebrate();
      // 立即刷新商品列表和版本历史
      fetchProducts();
      fetchVersions();
    } else {
      resultSuccess.hidden = true;
      resultFailed.hidden = false;
      resultErrorMsg.textContent = errorMsg || '请检查数据后重试';
      // 即使失败也刷新（可能部分数据已保存）
      fetchProducts();
      fetchVersions();
    }
  }

  // ============================================
  // Modal
  // ============================================
  function initModal() {
    modalClose.addEventListener('click', closeModal);

    deployModal.addEventListener('click', (e) => {
      if (e.target === deployModal) closeModal();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !deployModal.hidden) closeModal();
    });
  }

  function openModal() {
    deployModal.hidden = false;
    document.body.style.overflow = 'hidden';
    modalClose.focus();
  }

  function closeModal() {
    deployModal.hidden = true;
    document.body.style.overflow = '';
  }

  // ============================================
  // Environment Status
  // ============================================
  async function fetchEnvStatus() {
    try {
      const response = await fetch('/api/env-status');
      if (!response.ok) throw new Error('环境状态请求失败');
      const result = await response.json();
      const mainBackendOnline = result.data && result.data.mainBackend && result.data.mainBackend.status === 'online';
      updateEnvStatus(mainBackendOnline);
    } catch (err) {
      updateEnvStatus(false);
    }
  }

  function updateEnvStatus(online) {
    envDot.className = `env-dot ${online ? 'online' : 'offline'}`;
    envText.textContent = online ? '环境正常' : '环境异常';
  }

  // ============================================
  // AI Model Status
  // ============================================
  async function fetchAIStatus() {
    try {
      const response = await fetch('/api/ai/status');
      if (!response.ok) throw new Error('AI状态请求失败');
      const result = await response.json();
      if (result.data) {
        updateAIModelBadge(result.data);
      }
    } catch (err) {
      console.error('获取AI状态失败:', err);
    }
  }

  function updateAIModelBadge(aiInfo) {
    if (!aiModelBadge) return;

    const isLocal = aiInfo.provider === 'local' || aiInfo.fallbackUsed;
    const name = aiInfo.name || '本地模拟';

    aiModelBadge.textContent = `AI: ${name}`;
    aiModelBadge.className = `ai-model-badge ${isLocal ? 'local' : 'cloud'}`;
    aiModelBadge.title = isLocal
      ? '当前使用本地模拟分析，请在 .env 中配置 AI API Key'
      : `当前使用 ${name} 真实 AI 分析`;

    if (aiInfo.fallbackUsed && aiInfo.lastError) {
      aiModelBadge.title += `\n降级原因: ${aiInfo.lastError}`;
    }
  }

  // ============================================
  // Product List
  // ============================================
  async function fetchProducts() {
    try {
      const response = await fetch('/api/products');
      if (!response.ok) throw new Error('商品列表请求失败');
      const result = await response.json();
      let products = [];
      if (result.data) {
        products = Array.isArray(result.data) ? result.data : (result.data.products || result.data.data || []);
      }
      console.log('获取到商品:', products.length, '件');
      renderProducts(products);
    } catch (err) {
      console.error('获取商品列表失败:', err);
      renderProducts([]);
    }
  }

  function renderProducts(products) {
    const cards = productGrid.querySelectorAll('.product-card');
    cards.forEach((c) => c.remove());

    if (!products || products.length === 0) {
      productEmpty.style.display = '';
      return;
    }

    productEmpty.style.display = 'none';

    const categoryMap = {
      necklaces: '项链', rings: '戒指', earrings: '耳饰',
      bracelets: '手链/手镯', brooch: '胸针', pendants: '吊坠',
      anklets: '脚链', accessories: '配饰', 'hair-accessory': '发饰',
      other: '其他',
      necklace: '项链', ring: '戒指', earring: '耳饰', bracelet: '手链/手镯',
    };

    products.forEach((product) => {
      const card = document.createElement('div');
      card.className = 'product-card';
      card.setAttribute('role', 'listitem');

      const tagsHTML = (product.tags || [])
        .map((t) => `<span class="product-card-tag">${escapeHTML(t)}</span>`)
        .join('');

      let imgSrc = product.image || (product.images && product.images[0]) || '';
      if (imgSrc && imgSrc.startsWith('/uploads/')) {
        imgSrc = window.location.origin + imgSrc;
      }
      if (!imgSrc) {
        imgSrc = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3Crect fill='%231A1816' width='400' height='300'/%3E%3Ctext fill='%2378716C' font-size='16' x='50%25' y='50%25' text-anchor='middle' dy='.3em'%3E暂无图片%3C/text%3E%3C/svg%3E";
      }

      const priceDisplay = typeof product.price === 'number' ? product.price.toFixed(2) : (product.price || '0.00');
      const origPriceDisplay = product.originalPrice ? (typeof product.originalPrice === 'number' ? product.originalPrice.toFixed(2) : product.originalPrice) : '';

      card.innerHTML = `
        <img class="product-card-image" src="${escapeHTML(imgSrc)}" alt="${escapeHTML(product.name)}"
             onerror="this.src=&quot;data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3Crect fill='%231A1816' width='400' height='300'/%3E%3Ctext fill='%2378716C' font-size='16' x='50%25' y='50%25' text-anchor='middle' dy='.3em'%3E加载失败%3C/text%3E%3C/svg%3E&quot;">
        <div class="product-card-body">
          <div class="product-card-name">${escapeHTML(product.name)}</div>
          <div class="product-card-meta">
            <span class="product-card-price">¥${priceDisplay}</span>
            ${origPriceDisplay ? `<span class="product-card-original-price">¥${origPriceDisplay}</span>` : ''}
            <span class="product-card-category">${categoryMap[product.category] || product.category || '未分类'}</span>
          </div>
          ${tagsHTML ? `<div class="product-card-tags">${tagsHTML}</div>` : ''}
        </div>
      `;
      productGrid.appendChild(card);
    });
  }

  // ============================================
  // Version History
  // ============================================
  async function fetchVersions() {
    try {
      const response = await fetch('/api/versions');
      if (!response.ok) throw new Error('版本历史请求失败');
      const result = await response.json();
      renderVersions(result.data || []);
    } catch (err) {
      renderVersions([]);
    }
  }

  function renderVersions(versions) {
    const items = versionTimeline.querySelectorAll('.version-item');
    items.forEach((i) => i.remove());

    if (!versions || versions.length === 0) {
      versionEmpty.style.display = '';
      return;
    }

    versionEmpty.style.display = 'none';

    versions.forEach((v) => {
      const item = document.createElement('div');
      item.className = 'version-item';
      item.setAttribute('role', 'listitem');

      const isOk = v.status !== 'failed';
      const statusClass = isOk ? 'success' : 'failed';
      const statusText = isOk ? '成功' : '失败';

      item.innerHTML = `
        <div class="version-item-header">
          <span class="version-name">${escapeHTML(v.productName || v.name || v.version)}</span>
          <span class="version-badge ${statusClass}">${statusText}</span>
        </div>
        <span class="version-time">${formatTime(v.timestamp)}</span>
        ${v.version ? `<span class="version-detail">${escapeHTML(v.version)}</span>` : ''}
      `;
      versionTimeline.appendChild(item);
    });
  }

  // ============================================
  // Celebrate Animation
  // ============================================
  function celebrate() {
    const canvas = celebrateCanvas;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = [];
    const colors = ['#CA8A04', '#EAB308', '#F5F0E8', '#22C55E', '#92610A', '#FFD700'];

    for (let i = 0; i < 80; i++) {
      particles.push({
        x: canvas.width / 2 + (Math.random() - 0.5) * 200,
        y: canvas.height / 2,
        vx: (Math.random() - 0.5) * 12,
        vy: -Math.random() * 14 - 4,
        size: Math.random() * 6 + 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10,
        shape: Math.random() > 0.5 ? 'rect' : 'circle',
      });
    }

    let frame = 0;
    const maxFrames = 120;

    function animate() {
      frame++;
      if (frame > maxFrames) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((p) => {
        p.x += p.vx;
        p.vy += 0.3;
        p.y += p.vy;
        p.alpha = Math.max(0, 1 - frame / maxFrames);
        p.rotation += p.rotationSpeed;

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;

        if (p.shape === 'rect') {
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      });

      requestAnimationFrame(animate);
    }

    animate();
  }

  // ============================================
  // Utilities
  // ============================================
  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function formatTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  function showToast(message) {
    const toast = document.createElement('div');
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'polite');
    toast.style.cssText = `
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      padding: 12px 24px;
      background: rgba(26, 24, 22, 0.9);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(202, 138, 4, 0.2);
      border-radius: 8px;
      color: #F5F0E8;
      font-family: 'Montserrat', sans-serif;
      font-size: 14px;
      z-index: 10000;
      box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    `;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }
})();
