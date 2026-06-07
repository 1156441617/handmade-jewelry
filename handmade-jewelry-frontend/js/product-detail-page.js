let currentProductId = null;
let currentQuantity = 1;
let currentVariant = '经典款';

function getProductIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('id');
}

async function initProductDetail() {
    currentProductId = getProductIdFromUrl();
    
    if (!currentProductId) {
        currentProductId = '1';
    }

    await loadProductDetail(currentProductId);
    loadReviews();
    loadRelatedProducts();
    updateCartBadge();
}

async function loadProductDetail(productId) {
    let product = null;
    
    if (typeof ProductAPI !== 'undefined') {
        try {
            const result = await ProductAPI.getProductById(productId);
            if (result.success && result.data) {
                const p = result.data;
                product = {
                    id: p.id,
                    name: p.name,
                    price: parseFloat(p.price),
                    originalPrice: p.original_price ? parseFloat(p.original_price) : Math.round(parseFloat(p.price) * 1.5),
                    image: p.main_image_url || '💍',
                    badges: [
                        ...(p.is_new_arrival ? ['new'] : []),
                        ...(p.is_featured ? ['hot'] : []),
                        ...(p.is_limited_edition ? ['limited'] : []),
                    ],
                    description: p.description || '',
                };
            }
        } catch (e) {
            console.warn('Failed to load product from API, using mock data');
        }
    }
    
    if (!product) {
        product = mockProducts.find(p => p.id === productId);
    }
    
    if (!product) {
        alert('商品不存在');
        window.location.href = 'index.html';
        return;
    }

    document.getElementById('productTitle').textContent = product.name;
    document.getElementById('currentPrice').textContent = `¥${product.price}`;
    document.getElementById('originalPrice').textContent = product.originalPrice ? `¥${product.originalPrice}` : '';
    document.getElementById('mainImage').textContent = product.image;
    document.getElementById('breadcrumbProduct').textContent = product.name;
    document.title = `${product.name} - 匠心手作`;

    const thumbnails = document.querySelectorAll('.thumbnail');
    thumbnails.forEach((thumb, index) => {
        thumb.textContent = product.image;
    });

    const badgesContainer = document.getElementById('productBadges');
    badgesContainer.innerHTML = '';
    if (product.badges) {
        product.badges.forEach(badge => {
            const badgeEl = document.createElement('span');
            badgeEl.className = `badge badge-${badge}`;
            badgeEl.textContent = badge === 'new' ? '新品' : badge === 'hot' ? '热销' : '限量';
            badgesContainer.appendChild(badgeEl);
        });
    }

    checkWishlistStatus(productId);
    
    if (typeof AIAPI !== 'undefined' && typeof TokenManager !== 'undefined' && TokenManager.isLoggedIn()) {
        AIAPI.trackBehavior('view', productId).catch(() => {});
    }
}

function changeImage(emoji) {
    document.getElementById('mainImage').textContent = emoji;
    
    const thumbnails = document.querySelectorAll('.thumbnail');
    thumbnails.forEach(thumb => {
        thumb.classList.remove('active');
        if (thumb.textContent === emoji) {
            thumb.classList.add('active');
        }
    });
}

function selectVariant(btn) {
    document.querySelectorAll('.variant-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentVariant = btn.textContent;
}

function changeQuantity(delta) {
    const input = document.getElementById('quantityInput');
    let newValue = parseInt(input.value) + delta;
    if (newValue < 1) newValue = 1;
    if (newValue > 99) newValue = 99;
    input.value = newValue;
    currentQuantity = newValue;
}

function addToCartFromDetail() {
    const product = mockProducts.find(p => p.id === currentProductId);
    if (!product) return;

    let cart = JSON.parse(localStorage.getItem('cart') || '[]');
    
    const existingIndex = cart.findIndex(item => 
        item.id === currentProductId && item.variant === currentVariant
    );

    if (existingIndex >= 0) {
        cart[existingIndex].quantity += currentQuantity;
    } else {
        cart.push({
            id: product.id,
            name: product.name,
            price: product.price,
            image: product.image,
            variant: currentVariant,
            quantity: currentQuantity
        });
    }

    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartBadge();
    showNotification(`已将 ${currentQuantity} 件商品加入购物车!`);
}

function buyNow() {
    addToCartFromDetail();
    window.location.href = 'cart.html';
}

function toggleWishlistFromDetail(event) {
    toggleWishlist(event, currentProductId);
    checkWishlistStatus(currentProductId);
}

function checkWishlistStatus(productId) {
    const wishlist = JSON.parse(localStorage.getItem('wishlist') || '[]');
    const btn = document.getElementById('wishlistBtn');
    
    if (wishlist.includes(productId)) {
        btn.classList.add('active');
        btn.textContent = '♥';
    } else {
        btn.classList.remove('active');
        btn.textContent = '♡';
    }
}

function loadReviews() {
    const reviews = [
        {
            id: '1',
            user: '小***8',
            avatar: '👩',
            rating: 5,
            date: '2026-05-20',
            content: '非常漂亮的戒指，做工精致，月光石很有质感，包装也很精美，送人自用都很合适！',
            images: ['💍', '✨'],
            helpful: 28
        },
        {
            id: '2',
            user: '阳***光',
            avatar: '👨',
            rating: 5,
            date: '2026-05-18',
            content: '质量很好，戴着很舒服，大小可以调节，非常满意的一次购物！',
            images: [],
            helpful: 15
        },
        {
            id: '3',
            user: '梦***想',
            avatar: '👩',
            rating: 4,
            date: '2026-05-15',
            content: '整体不错，就是比想象中稍微小一点，但是很漂亮，很喜欢。',
            images: ['💎'],
            helpful: 8
        }
    ];

    const container = document.getElementById('reviewsList');
    container.innerHTML = reviews.map(review => `
        <div class="review-card">
            <div class="review-header">
                <div class="reviewer-info">
                    <div class="reviewer-avatar">${review.avatar}</div>
                    <div>
                        <div class="reviewer-name">${review.user}</div>
                        <div class="stars">${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}</div>
                    </div>
                </div>
                <div class="review-date">${review.date}</div>
            </div>
            <div class="review-content">${review.content}</div>
            ${review.images.length > 0 ? `
                <div class="review-images">
                    ${review.images.map(img => `<div class="review-img">${img}</div>`).join('')}
                </div>
            ` : ''}
            <div class="review-helpful">
                <button class="helpful-btn" onclick="likeReview('${review.id}')">
                    👍 有用 (${review.helpful})
                </button>
            </div>
        </div>
    `).join('');
}

function likeReview(reviewId) {
    showNotification('感谢您的反馈!');
}

async function loadRelatedProducts() {
    let relatedProducts = [];
    
    if (typeof AIAPI !== 'undefined') {
        try {
            const result = await AIAPI.getSimilarProducts(currentProductId, 4);
            if (result.success && result.data) {
                relatedProducts = (result.data.products || result.data).map(p => mapApiProduct(p));
            }
        } catch (e) {}
    }
    
    if (relatedProducts.length === 0) {
        relatedProducts = mockProducts.filter(p => p.id !== currentProductId).slice(0, 4);
    }
    
    const container = document.getElementById('relatedGrid');
    container.innerHTML = relatedProducts.map(product => createProductCard(product)).join('');
}

document.addEventListener('DOMContentLoaded', initProductDetail);

document.getElementById('quantityInput')?.addEventListener('change', function() {
    let value = parseInt(this.value);
    if (value < 1) value = 1;
    if (value > 99) value = 99;
    this.value = value;
    currentQuantity = value;
});
