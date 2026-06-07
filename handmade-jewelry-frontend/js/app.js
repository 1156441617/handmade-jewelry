// ============================================
// 手作饰品电商 - 主JavaScript文件 (连接后端API)
// ============================================

// 是否使用后端API (false=调用后端API, true=使用本地mock)
const USE_MOCK_DATA = false;

// 本地mock数据(后端不可用时降级)
const mockCategories = [
    { id: '1', name: '戒指', icon: '💍', slug: 'rings' },
    { id: '2', name: '耳环', icon: '✨', slug: 'earrings' },
    { id: '3', name: '项链', icon: '📿', slug: 'necklaces' },
    { id: '4', name: '手链', icon: '⌚', slug: 'bracelets' },
    { id: '5', name: '礼盒套装', icon: '🎁', slug: 'gift-sets' }
];

const mockProducts = [
    { id: '1', name: '月光石编织戒指', price: 168, originalPrice: null, image: '💍', rating: 4.9, reviews: 128, description: '天然月光石 · 925银线 · 可调节', badges: ['new'], gradient: 'linear-gradient(135deg, #f5e6d3 0%, #e8d4c0 100%)' },
    { id: '2', name: '淡水珍珠耳环', price: 128, originalPrice: 258, image: '✨', rating: 4.8, reviews: 256, description: 'AAA级珍珠 · 14K包金 · 附证书', badges: ['hot'], gradient: 'linear-gradient(135deg, #ffeaa7 0%, #fab1a0 100%)' },
    { id: '3', name: '水晶能量项链', price: 298, originalPrice: null, image: '📿', rating: 4.9, reviews: 89, description: '天然紫水晶 · 纯银吊坠 · 开光', badges: ['limited'], gradient: 'linear-gradient(135deg, #dfe6e9 0%, #b2bec3 100%)' },
    { id: '4', name: '玫瑰金编织手链', price: 188, originalPrice: null, image: '⌚', rating: 4.7, reviews: 167, description: '进口线材 · 手工编织 · 可刻字', badges: ['new', 'hot'], gradient: 'linear-gradient(135deg, #fdcbf1 0%, #e6dee9 100%)' },
    { id: '5', name: '蓝宝石吊坠项链', price: 358, originalPrice: 498, image: '💎', rating: 5.0, reviews: 45, description: '天然蓝宝石 · 18K金 · 限量版', badges: ['limited'], gradient: 'linear-gradient(135deg, #a29bfe 0%, #6c5ce7 100%)' },
    { id: '6', name: '复古银饰戒指套装', price: 228, originalPrice: null, image: '💍', rating: 4.6, reviews: 203, description: '925银 · 三件套 · 复古设计', badges: ['hot'], gradient: 'linear-gradient(135deg, #dcdde1 0%, #95afc0 100%)' },
    { id: '7', name: '樱花粉晶耳环', price: 158, originalPrice: null, image: '🌸', rating: 4.8, reviews: 142, description: '粉水晶 · 玫瑰金 · 甜美风格', badges: ['new'], gradient: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)' },
    { id: '8', name: '黑曜石守护手链', price: 198, originalPrice: 268, image: '🖤', rating: 4.9, reviews: 98, description: '天然黑曜石 · 辟邪保平安', badges: ['hot'], gradient: 'linear-gradient(135deg, #434343 0%, #000000 100%)' }
];

// ============================================
// 页面加载完成后执行
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    initPage();
    bindEvents();
    loadData();
});

// ============================================
// 初始化页面
// ============================================
function initPage() {
    updateCartBadge();
    updateAuthUI();
}

// ============================================
// 绑定事件
// ============================================
function bindEvents() {
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', toggleMobileMenu);
    }
    
    const filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            filterBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            filterProducts(this.dataset.filter);
        });
    });
    
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', loadMoreProducts);
    }
    
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        let searchDebounceTimer = null;
        searchInput.addEventListener('input', function() {
            clearTimeout(searchDebounceTimer);
            const value = this.value;
            searchDebounceTimer = setTimeout(() => searchProducts(value), 300);
        });
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                clearTimeout(searchDebounceTimer);
                searchProducts(this.value);
            }
        });
    }
    
    const modalClose = document.getElementById('modalClose');
    const authModal = document.getElementById('authModal');
    if (modalClose && authModal) {
        modalClose.addEventListener('click', () => authModal.classList.remove('show'));
        authModal.addEventListener('click', function(e) {
            if (e.target === this) this.classList.remove('show');
        });
    }
    
    const authTabs = document.querySelectorAll('.auth-tab');
    authTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            switchAuthTab(this.dataset.tab);
        });
    });
    
    const loginForm = document.getElementById('loginForm');
    if (loginForm) loginForm.addEventListener('submit', handleLogin);
    
    const registerForm = document.getElementById('registerForm');
    if (registerForm) registerForm.addEventListener('submit', handleRegister);
}

// ============================================
// 加载数据 - 优先从后端API获取
// ============================================
async function loadData() {
    await loadCategories();
    await loadProducts();
    await loadAIRecommendations();
}

// ============================================
// 加载分类
// ============================================
async function loadCategories() {
    const categoryGrid = document.getElementById('categoryGrid');
    if (!categoryGrid) return;
    
    let categories = mockCategories;
    
    if (!USE_MOCK_DATA && typeof ProductAPI !== 'undefined') {
        try {
            const result = await ProductAPI.getCategories();
            if (result.success && result.data) {
                categories = result.data.map(c => ({
                    id: c.id,
                    name: c.name,
                    icon: c.icon_url || getCategoryIcon(c.slug),
                    slug: c.slug,
                }));
            }
        } catch (e) {
            console.warn('Failed to load categories from API, using mock data');
        }
    }
    
    categoryGrid.innerHTML = categories.map(category => `
        <div class="category-card" onclick="filterByCategory('${category.slug}')">
            <div class="category-icon">${category.icon}</div>
            <div class="category-name">${category.name}</div>
        </div>
    `).join('');
}

function getCategoryIcon(slug) {
    const icons = { rings: '💍', earrings: '✨', necklaces: '📿', bracelets: '⌚', 'gift-sets': '🎁' };
    return icons[slug] || '💎';
}

// ============================================
// 加载商品
// ============================================
let allProducts = [];
let productsShownCount = 0;

async function loadProducts(filter = 'all') {
    const productGrid = document.getElementById('productGrid');
    if (!productGrid) return;
    
    let products = [];
    
    if (!USE_MOCK_DATA && typeof ProductAPI !== 'undefined') {
        try {
            const params = {};
            if (filter === 'new') params.tag = 'new';
            else if (filter === 'hot') params.tag = 'hot';
            else if (filter === 'limited') params.tag = 'limited';
            
            const result = await ProductAPI.getProducts(params);
            if (result.success && result.data) {
                products = (result.data.products || result.data).map(p => mapApiProduct(p));
                allProducts = products;
            }
        } catch (e) {
            console.warn('Failed to load products from API, using mock data');
            products = filterMockProducts(filter);
            allProducts = mockProducts;
        }
    } else {
        products = filterMockProducts(filter);
        allProducts = mockProducts;
    }
    
    productGrid.innerHTML = products.map(product => createProductCard(product)).join('');
    productsShownCount = products.length;
}

function mapApiProduct(p) {
    return {
        id: p.id,
        name: p.name,
        price: parseFloat(p.price),
        originalPrice: p.original_price ? parseFloat(p.original_price) : null,
        image: p.main_image_url || '💍',
        rating: p.rating_average || 4.5,
        reviews: p.review_count || 0,
        description: p.description || '',
        badges: [
            ...(p.is_new_arrival ? ['new'] : []),
            ...(p.is_featured ? ['hot'] : []),
            ...(p.is_limited_edition ? ['limited'] : []),
        ],
        gradient: 'linear-gradient(135deg, #f5e6d3 0%, #e8d4c0 100%)',
    };
}

function filterMockProducts(filter) {
    if (filter === 'new') return mockProducts.filter(p => p.badges.includes('new'));
    if (filter === 'hot') return mockProducts.filter(p => p.badges.includes('hot'));
    if (filter === 'limited') return mockProducts.filter(p => p.badges.includes('limited'));
    return mockProducts;
}

// ============================================
// 创建商品卡片HTML
// ============================================
function createProductCard(product) {
    const badgesHtml = (product.badges || []).map(badge => {
        const badgeClass = badge === 'new' ? 'badge-new' : badge === 'hot' ? 'badge-hot' : 'badge-limited';
        const badgeText = badge === 'new' ? '新品' : badge === 'hot' ? '热销' : '限量';
        return `<span class="product-badge ${badgeClass}">${badgeText}</span>`;
    }).join('');
    
    const originalPriceHtml = product.originalPrice ? 
        `<span class="product-original-price">¥${product.originalPrice}</span>` : '';

    const starsHtml = '★'.repeat(Math.floor(product.rating || 4.5));
    
    return `
        <div class="product-card" data-product-id="${product.id}" onclick="goToProductDetail('${product.id}')">
            <div class="product-image">
                <span style="font-size:64px">${product.image}</span>
                ${badgesHtml ? `<div class="product-badges">${badgesHtml}</div>` : ''}
                <button class="product-wishlist" onclick="toggleWishlist(event, '${product.id}')">♡</button>
            </div>
            <div class="product-info">
                <h3 class="product-name">${product.name}</h3>
                <p class="product-desc">${product.description}</p>
                <div class="product-price-row">
                    <span class="product-price">¥${product.price}</span>
                    ${originalPriceHtml}
                </div>
                <div class="product-rating">
                    <span class="product-rating-stars" style="color:var(--gold)">${starsHtml}</span>
                    <span style="color:var(--text-muted); font-size:12px">${product.reviews}条评价</span>
                </div>
                <div class="product-actions">
                    <button class="btn-add-cart" onclick="addToCart(event, '${product.id}')">加入购物车</button>
                </div>
            </div>
        </div>
    `;
}

// ============================================
// 跳转商品详情
// ============================================
function goToProductDetail(productId) {
    window.location.href = `product-detail.html?id=${productId}`;
}

// ============================================
// 筛选商品
// ============================================
function filterProducts(filter) {
    loadProducts(filter);
}

// ============================================
// 按分类筛选
// ============================================
function filterByCategory(slug) {
    window.location.href = `search.html?category=${slug}`;
}

// ============================================
// 加载更多商品
// ============================================
function loadMoreProducts() {
    const productGrid = document.getElementById('productGrid');
    if (!productGrid) return;
    
    const batchSize = 4;
    const nextBatch = allProducts.slice(productsShownCount, productsShownCount + batchSize);
    
    if (nextBatch.length === 0) {
        showNotification('没有更多商品了');
        return;
    }
    
    nextBatch.forEach(product => {
        const div = document.createElement('div');
        div.innerHTML = createProductCard(product);
        productGrid.appendChild(div.firstElementChild);
    });
    
    productsShownCount += nextBatch.length;
}

// ============================================
// 搜索商品
// ============================================
async function searchProducts(keyword) {
    if (!keyword.trim()) { loadProducts(); return; }
    
    const productGrid = document.getElementById('productGrid');
    if (!productGrid) return;
    
    let filtered = [];
    
    if (!USE_MOCK_DATA && typeof ProductAPI !== 'undefined') {
        try {
            const result = await ProductAPI.getProducts({ search: keyword });
            if (result.success && result.data) {
                filtered = (result.data.products || result.data).map(p => mapApiProduct(p));
            }
        } catch (e) {
            filtered = mockProducts.filter(p => p.name.includes(keyword) || p.description.includes(keyword));
        }
    } else {
        filtered = mockProducts.filter(p => p.name.includes(keyword) || p.description.includes(keyword));
    }
    
    productGrid.innerHTML = filtered.map(product => createProductCard(product)).join('');
}

// ============================================
// AI智能推荐
// ============================================
async function loadAIRecommendations() {
    const grid = document.getElementById('aiRecommendGrid');
    if (!grid) return;
    
    let products = [];
    
    if (!USE_MOCK_DATA && typeof AIAPI !== 'undefined') {
        try {
            const result = await AIAPI.getPersonalizedRecommendations(4);
            if (result.success && result.data) {
                products = (result.data.products || result.data).map(p => mapApiProduct(p));
            }
        } catch (e) {
            console.warn('AI recommendations failed, using fallback');
        }
    }
    
    if (products.length === 0) {
        // 降级：随机选择4个商品
        const shuffled = [...mockProducts].sort(() => 0.5 - Math.random());
        products = shuffled.slice(0, 4);
    }
    
    grid.innerHTML = products.map(product => createProductCard(product)).join('');
}

// ============================================
// 添加到购物车
// ============================================
function addToCart(event, productId) {
    if (event) { event.stopPropagation(); event.preventDefault(); }
    
    let cart = JSON.parse(localStorage.getItem('cart') || '[]');
    const product = allProducts.find(p => p.id === productId) || mockProducts.find(p => p.id === productId);
    if (!product) return;
    
    const existingItem = cart.find(item => item.id === productId);
    if (existingItem) {
        existingItem.quantity++;
    } else {
        cart.push({ id: productId, name: product.name, price: product.price, image: product.image, quantity: 1 });
    }
    
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartBadge();
    showNotification('已添加到购物车!');
    
    // 追踪用户行为
    if (!USE_MOCK_DATA && typeof AIAPI !== 'undefined' && TokenManager.isLoggedIn()) {
        AIAPI.trackBehavior('add_to_cart', productId).catch(() => {});
    }
}

// ============================================
// 更新购物车徽章
// ============================================
function updateCartBadge() {
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    
    const cartBadge = document.getElementById('cartBadge');
    if (cartBadge) {
        cartBadge.textContent = totalItems;
        cartBadge.style.display = totalItems > 0 ? 'flex' : 'none';
    }
}

// ============================================
// 切换收藏
// ============================================
async function toggleWishlist(event, productId) {
    event.stopPropagation();
    
    const btn = event.target;
    const isFavorited = btn.textContent === '♥';
    
    if (!USE_MOCK_DATA && typeof ProductAPI !== 'undefined' && TokenManager.isLoggedIn()) {
        try {
            const result = isFavorited 
                ? await ProductAPI.removeFromFavorites(productId)
                : await ProductAPI.addToFavorites(productId);
            
            if (result.success) {
                btn.textContent = isFavorited ? '♡' : '♥';
                btn.style.color = isFavorited ? 'inherit' : '#ff4757';
                showNotification(isFavorited ? '已取消收藏' : '已添加到收藏');
            }
        } catch (e) {
            showNotification('操作失败', 'error');
        }
    } else {
        btn.textContent = isFavorited ? '♡' : '♥';
        btn.style.color = isFavorited ? 'inherit' : '#ff4757';
        showNotification(isFavorited ? '已取消收藏' : '已添加到收藏');
    }
}

// ============================================
// 切换移动端菜单
// ============================================
function toggleMobileMenu() {
    const navMenu = document.getElementById('navMenu');
    if (navMenu) navMenu.style.display = navMenu.style.display === 'flex' ? 'none' : 'flex';
}

// ============================================
// 切换认证标签
// ============================================
function switchAuthTab(tab) {
    const tabs = document.querySelectorAll('.auth-tab');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    
    tabs.forEach(t => t.classList.remove('active'));
    document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
    
    if (tab === 'login') {
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
    } else {
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
    }
}

// ============================================
// 处理登录 - 调用后端API
// ============================================
async function handleLogin(e) {
    e.preventDefault();
    
    const email = e.target.querySelector('input[type="email"]').value;
    const password = e.target.querySelector('input[type="password"]').value;
    
    if (!USE_MOCK_DATA && typeof AuthAPI !== 'undefined') {
        try {
            const result = await AuthAPI.login(email, password);
            if (result.success) {
                showNotification('登录成功!');
                updateAuthUI();
                const authModal = document.getElementById('authModal');
                if (authModal) authModal.classList.remove('show');
            } else {
                showNotification(result.message || '登录失败', 'error');
            }
        } catch (e) {
            showNotification('登录失败，请检查后端服务', 'error');
        }
    } else {
        // Mock模式
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('userEmail', email);
        showNotification('登录成功!');
        updateAuthUI();
        const authModal = document.getElementById('authModal');
        if (authModal) authModal.classList.remove('show');
    }
}

// ============================================
// 处理注册 - 调用后端API
// ============================================
async function handleRegister(e) {
    e.preventDefault();
    
    const username = e.target.querySelector('input[name="username"]').value;
    const email = e.target.querySelector('input[name="email"]').value;
    const password = e.target.querySelector('input[name="password"]').value;
    const confirmPassword = e.target.querySelector('input[name="confirmPassword"]').value;
    
    if (password !== confirmPassword) {
        showNotification('两次密码不一致!', 'error');
        return;
    }
    
    if (!USE_MOCK_DATA && typeof AuthAPI !== 'undefined') {
        try {
            const result = await AuthAPI.register(email, password, username);
            if (result.success) {
                showNotification('注册成功!');
                updateAuthUI();
                const authModal = document.getElementById('authModal');
                if (authModal) authModal.classList.remove('show');
            } else {
                showNotification(result.message || '注册失败', 'error');
            }
        } catch (e) {
            console.error('Register error:', e);
            showNotification('注册失败，请检查后端服务', 'error');
        }
    } else {
        showNotification('注册成功!请登录');
        switchAuthTab('login');
    }
}

// ============================================
// 更新认证UI
// ============================================
function updateAuthUI() {
    const isLoggedIn = TokenManager.isLoggedIn ? TokenManager.isLoggedIn() : localStorage.getItem('isLoggedIn') === 'true';
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    
    const userBtn = document.querySelector('.user-btn');
    if (userBtn && isLoggedIn && user) {
        userBtn.innerHTML = user.username?.charAt(0)?.toUpperCase() || 'U';
        userBtn.title = user.username || user.email;
    }
}

// ============================================
// 显示登录弹窗
// ============================================
function showLoginModal() {
    const authModal = document.getElementById('authModal');
    if (authModal) authModal.classList.add('show');
}

// ============================================
// 显示通知
// ============================================
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.style.cssText = `
        position: fixed; top: 20px; right: 20px; padding: 1rem 1.5rem;
        background: ${type === 'success' ? '#27ae60' : '#e74c3c'}; color: white;
        border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 3000; animation: slideIn 0.3s ease;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// CSS动画
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn { from { transform: translateX(400px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    @keyframes slideOut { from { transform: translateX(0); opacity: 1; } to { transform: translateX(400px); opacity: 0; } }
`;
document.head.appendChild(style);

console.log('Handmade Jewelry E-Commerce loaded successfully!');
