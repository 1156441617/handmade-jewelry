let wishlist = [];
let selectedItems = new Set();

function initWishlist() {
    loadWishlist();
    renderWishlist();
    updateCartBadge();
}

function loadWishlist() {
    const wishlistIds = JSON.parse(localStorage.getItem('wishlist') || '[]');
    wishlist = mockProducts.filter(p => wishlistIds.includes(p.id));
}

function renderWishlist() {
    const container = document.getElementById('wishlistContent');
    
    if (wishlist.length === 0) {
        renderEmpty(container);
        return;
    }

    renderWithItems(container);
}

function renderEmpty(container) {
    container.innerHTML = `
        <div class="empty-wishlist">
            <div class="empty-icon" aria-hidden="true"><svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg></div>
            <h2 class="empty-title">收藏夹是空的</h2>
            <p class="empty-text">快去发现心仪的宝贝吧!</p>
            <button class="shop-btn" onclick="window.location.href='index.html'">去逛逛</button>
        </div>
    `;
    document.getElementById('wishlistSubtitle').textContent = '您还没有收藏任何商品';
}

function renderWithItems(container) {
    container.innerHTML = `
        <div class="wishlist-stats">
            <div class="stat-item">
                <div class="stat-number">${wishlist.length}</div>
                <div class="stat-label">收藏商品</div>
            </div>
            <div class="stat-item">
                <div class="stat-number">${wishlist.filter(p => p.price < 200).length}</div>
                <div class="stat-label">200元以下</div>
            </div>
            <div class="stat-item">
                <div class="stat-number">${wishlist.filter(p => p.badges && p.badges.includes('new')).length}</div>
                <div class="stat-label">新品</div>
            </div>
        </div>

        <div class="wishlist-toolbar">
            <div class="toolbar-left">
                <button class="select-all-btn" onclick="toggleSelectAll()">全选</button>
                <span class="selected-count">已选择 ${selectedItems.size} 件</span>
            </div>
            <div class="toolbar-right">
                <button class="btn-action btn-delete" onclick="removeSelected()">删除选中</button>
                <button class="btn-action btn-cart" onclick="addSelectedToCart()">加入购物车</button>
            </div>
        </div>

        <div class="wishlist-grid">
            ${wishlist.map((product, index) => `
                <div class="wishlist-card ${selectedItems.has(index) ? 'selected' : ''}" data-index="${index}">
                    <div class="card-checkbox ${selectedItems.has(index) ? 'checked' : ''}" 
                         onclick="toggleSelect(${index})"></div>
                    <div class="card-image" onclick="viewProduct('${product.id}')">${product.image}</div>
                    <div class="card-info">
                        <div class="card-name" onclick="viewProduct('${product.id}')">${product.name}</div>
                        <div class="card-price">¥${product.price}</div>
                        <div class="card-actions">
                            <button class="card-btn card-btn-cart" onclick="addToCartFromWishlist('${product.id}')">
                                加入购物车
                            </button>
                            <button class="card-btn card-btn-remove" onclick="removeFromWishlist(${index})">
                                移除
                            </button>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;

    document.getElementById('wishlistSubtitle').textContent = `您收藏了 ${wishlist.length} 件商品`;
}

function toggleSelect(index) {
    if (selectedItems.has(index)) {
        selectedItems.delete(index);
    } else {
        selectedItems.add(index);
    }
    renderWishlist();
}

function toggleSelectAll() {
    if (selectedItems.size === wishlist.length) {
        selectedItems.clear();
    } else {
        wishlist.forEach((_, index) => selectedItems.add(index));
    }
    renderWishlist();
}

function removeSelected() {
    if (selectedItems.size === 0) {
        showNotification('请先选择要删除的商品');
        return;
    }

    if (confirm(`确定要删除选中的 ${selectedItems.size} 件商品吗?`)) {
        const indices = Array.from(selectedItems).sort((a, b) => b - a);
        indices.forEach(index => {
            const productId = wishlist[index].id;
            let wishlistIds = JSON.parse(localStorage.getItem('wishlist') || '[]');
            wishlistIds = wishlistIds.filter(id => id !== productId);
            localStorage.setItem('wishlist', JSON.stringify(wishlistIds));
        });

        selectedItems.clear();
        loadWishlist();
        renderWishlist();
        showNotification('已删除选中商品');
    }
}

function addSelectedToCart() {
    if (selectedItems.size === 0) {
        showNotification('请先选择要添加的商品');
        return;
    }

    let cart = JSON.parse(localStorage.getItem('cart') || '[]');
    
    selectedItems.forEach(index => {
        const product = wishlist[index];
        const existingIndex = cart.findIndex(item => item.id === product.id);
        
        if (existingIndex >= 0) {
            cart[existingIndex].quantity += 1;
        } else {
            cart.push({
                id: product.id,
                name: product.name,
                price: product.price,
                image: product.image,
                quantity: 1
            });
        }
    });

    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartBadge();
    showNotification(`已将 ${selectedItems.size} 件商品加入购物车`);
    selectedItems.clear();
    renderWishlist();
}

function addToCartFromWishlist(productId) {
    const product = wishlist.find(p => p.id === productId);
    if (!product) return;

    let cart = JSON.parse(localStorage.getItem('cart') || '[]');
    const existingIndex = cart.findIndex(item => item.id === productId);

    if (existingIndex >= 0) {
        cart[existingIndex].quantity += 1;
    } else {
        cart.push({
            id: product.id,
            name: product.name,
            price: product.price,
            image: product.image,
            quantity: 1
        });
    }

    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartBadge();
    showNotification('已添加到购物车');
}

function removeFromWishlist(index) {
    const product = wishlist[index];
    let wishlistIds = JSON.parse(localStorage.getItem('wishlist') || '[]');
    wishlistIds = wishlistIds.filter(id => id !== product.id);
    localStorage.setItem('wishlist', JSON.stringify(wishlistIds));

    loadWishlist();
    renderWishlist();
    showNotification('已从收藏夹移除');
}

function viewProduct(productId) {
    window.location.href = `product-detail.html?id=${productId}`;
}

function performSearch() {
    const keyword = document.getElementById('searchInput').value.trim();
    if (keyword) {
        window.location.href = `search.html?q=${encodeURIComponent(keyword)}`;
    }
}

document.addEventListener('DOMContentLoaded', initWishlist);
