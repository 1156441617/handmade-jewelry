(function() {
    var DEFAULT_CART = [
        { id: '1', name: '月光石编织戒指', price: 168, image: '💍', quantity: 1 },
        { id: '3', name: '水晶能量项链', price: 298, image: '📿', quantity: 1 }
    ];

    function getCart() {
        var cart = JSON.parse(localStorage.getItem('cart') || '[]');
        if (cart.length === 0) {
            cart = DEFAULT_CART;
            localStorage.setItem('cart', JSON.stringify(cart));
        }
        return cart;
    }

    function saveCart(cart) {
        localStorage.setItem('cart', JSON.stringify(cart));
    }

    function loadCart() {
        var cart = getCart();
        var cartContent = document.getElementById('cartContent');
        var emptyCart = document.getElementById('emptyCart');
        var cartCountText = document.getElementById('cartCountText');

        if (cart.length === 0) {
            cartContent.classList.add('hidden');
            emptyCart.classList.remove('hidden');
            if (cartCountText) cartCountText.textContent = '您的购物车中有 0 件商品';
        } else {
            cartContent.classList.remove('hidden');
            emptyCart.classList.add('hidden');
            if (cartCountText) cartCountText.textContent = '您的购物车中有 ' + cart.length + ' 件商品';
            renderCartItems(cart);
            renderSummary(cart);
        }
        updateCartBadge();
    }

    function renderCartItems(items) {
        var container = document.getElementById('cartItemsContainer');
        container.innerHTML = items.map(function(item) {
            return (
                '<div class="cart-item" data-product-id="' + item.id + '">' +
                    '<div class="cart-item-image">' + item.image + '</div>' +
                    '<div class="cart-item-info">' +
                        '<div class="cart-item-name">' + item.name + '</div>' +
                        '<div class="cart-item-price">¥' + item.price.toFixed(0) + '</div>' +
                        '<div class="cart-item-actions">' +
                            '<div class="cart-item-quantity">' +
                                '<button class="qty-btn" onclick="CartPage.updateQuantity(\'' + item.id + '\', -1)">−</button>' +
                                '<input type="number" class="qty-input" value="' + item.quantity + '" min="1" max="99" onchange="CartPage.setQuantity(\'' + item.id + '\', this.value)">' +
                                '<button class="qty-btn" onclick="CartPage.updateQuantity(\'' + item.id + '\', 1)">+</button>' +
                            '</div>' +
                            '<button class="cart-item-remove" onclick="CartPage.removeItem(\'' + item.id + '\')">删除</button>' +
                        '</div>' +
                    '</div>' +
                '</div>'
            );
        }).join('');
    }

    function updateQuantity(productId, delta) {
        var cart = getCart();
        var item = cart.find(function(i) { return i.id === productId; });
        if (!item) return;
        item.quantity += delta;
        if (item.quantity < 1) item.quantity = 1;
        if (item.quantity > 99) item.quantity = 99;
        saveCart(cart);
        loadCart();
    }

    function setQuantity(productId, value) {
        var qty = parseInt(value);
        if (isNaN(qty) || qty < 1) qty = 1;
        if (qty > 99) qty = 99;
        var cart = getCart();
        var item = cart.find(function(i) { return i.id === productId; });
        if (!item) return;
        item.quantity = qty;
        saveCart(cart);
        loadCart();
    }

    function removeItem(productId) {
        var cart = getCart();
        cart = cart.filter(function(i) { return i.id !== productId; });
        saveCart(cart);
        loadCart();
        if (typeof showNotification === 'function') {
            showNotification('已从购物车移除');
        }
    }

    function renderSummary(items) {
        var container = document.getElementById('cartSummary');
        var subtotal = items.reduce(function(sum, item) {
            return sum + item.price * item.quantity;
        }, 0);
        var shipping = subtotal >= 99 ? 0 : 15;
        var total = subtotal + shipping;

        container.innerHTML = (
            '<h3>订单摘要</h3>' +
            '<div class="summary-row">' +
                '<span>商品小计</span>' +
                '<span>¥' + subtotal.toFixed(0) + '</span>' +
            '</div>' +
            '<div class="summary-row' + (shipping === 0 ? ' free' : '') + '">' +
                '<span>运费</span>' +
                '<span>' + (shipping === 0 ? '免运费' : '¥' + shipping.toFixed(0)) + '</span>' +
            '</div>' +
            '<div class="summary-row total">' +
                '<span>合计</span>' +
                '<strong>¥' + total.toFixed(0) + '</strong>' +
            '</div>' +
            '<button class="btn-checkout" onclick="CartPage.checkout()">去结算</button>'
        );
    }

    function checkout() {
        var isLoggedIn = (typeof TokenManager !== 'undefined' && TokenManager.isLoggedIn && TokenManager.isLoggedIn())
            || localStorage.getItem('isLoggedIn') === 'true';

        if (!isLoggedIn) {
            if (typeof showLoginModal === 'function') {
                showLoginModal();
            } else {
                var modal = document.getElementById('authModal');
                if (modal) modal.classList.add('show');
            }
            if (typeof showNotification === 'function') {
                showNotification('请先登录后再结算');
            }
            return;
        }

        var cart = getCart();
        if (cart.length === 0) {
            if (typeof showNotification === 'function') {
                showNotification('购物车是空的');
            }
            return;
        }

        var subtotal = cart.reduce(function(sum, item) {
            return sum + item.price * item.quantity;
        }, 0);
        var shipping = subtotal >= 99 ? 0 : 15;
        var total = subtotal + shipping;

        var addresses = [];
        try {
            addresses = JSON.parse(localStorage.getItem('addresses') || '[]');
        } catch (e) {
            addresses = [];
        }
        var defaultAddress = addresses.find(function(a) { return a.isDefault; }) || addresses[0] || null;

        var orderData = {
            items: cart.map(function(item) {
                return {
                    productId: item.id,
                    name: item.name,
                    price: item.price,
                    quantity: item.quantity
                };
            }),
            address: defaultAddress ? {
                name: defaultAddress.name,
                phone: defaultAddress.phone,
                province: defaultAddress.province,
                city: defaultAddress.city,
                district: defaultAddress.district,
                detail: defaultAddress.detail
            } : {
                name: '',
                phone: '',
                province: '',
                city: '',
                district: '',
                detail: ''
            },
            totalAmount: total,
            shippingFee: shipping,
            remark: ''
        };

        if (typeof OrderAPI !== 'undefined' && typeof OrderAPI.createOrder === 'function') {
            OrderAPI.createOrder(orderData).then(function(result) {
                if (result.success) {
                    localStorage.removeItem('cart');
                    if (typeof showNotification === 'function') {
                        showNotification('订单创建成功！');
                    }
                    loadCart();
                } else {
                    if (typeof showNotification === 'function') {
                        showNotification(result.message || '订单创建失败，请稍后重试');
                    }
                }
            }).catch(function() {
                if (typeof showNotification === 'function') {
                    showNotification('网络错误，请检查后端服务');
                }
            });
        } else {
            localStorage.removeItem('cart');
            if (typeof showNotification === 'function') {
                showNotification('订单已提交！（演示模式）');
            }
            loadCart();
        }
    }

    function updateCartBadge() {
        var cart = getCart();
        var totalItems = cart.reduce(function(sum, item) { return sum + item.quantity; }, 0);
        var badge = document.getElementById('cartBadge');
        if (badge) {
            badge.textContent = totalItems;
            badge.style.display = totalItems > 0 ? 'flex' : 'none';
        }
    }

    window.CartPage = {
        loadCart: loadCart,
        updateQuantity: updateQuantity,
        setQuantity: setQuantity,
        removeItem: removeItem,
        checkout: checkout,
        updateCartBadge: updateCartBadge
    };

    document.addEventListener('DOMContentLoaded', function() {
        loadCart();
    });
})();
