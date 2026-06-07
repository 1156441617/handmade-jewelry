let cart = [];
let selectedAddress = 0;

function initCheckout() {
    loadCart();
    renderAddresses();
    renderOrderItems();
    calculateTotal();
}

function loadCart() {
    cart = JSON.parse(localStorage.getItem('checkoutCart') || localStorage.getItem('cart') || '[]');
}

function renderAddresses() {
    const container = document.getElementById('addressList');
    let addresses = [];
    try {
        addresses = JSON.parse(localStorage.getItem('addresses') || '[]');
    } catch (e) {
        addresses = [];
    }

    if (addresses.length === 0) {
        container.innerHTML =
            '<div class="address-option selected" onclick="selectAddress(this)" role="radio" aria-checked="true" tabindex="0">' +
                '<div class="address-radio" aria-hidden="true"></div>' +
                '<div class="address-name">暂无收货地址</div>' +
                '<div class="address-detail">请先在"我的"页面添加收货地址</div>' +
            '</div>' +
            '<button class="add-address-btn" onclick="addNewAddress()" aria-label="新增收货地址">+ 新增收货地址</button>';
        return;
    }

    container.innerHTML = addresses.map(function(addr, index) {
        var isSelected = index === 0 || addr.isDefault;
        var fullAddress = (addr.province || '') + (addr.city || '') + (addr.district || '') + (addr.detail || '');
        return (
            '<div class="address-option' + (isSelected ? ' selected' : '') + '" onclick="selectAddress(this)" role="radio" aria-checked="' + isSelected + '" tabindex="0">' +
                '<div class="address-radio" aria-hidden="true"></div>' +
                '<div class="address-name">' + (addr.name || '') + '</div>' +
                '<div class="address-phone">' + (addr.phone || '') + '</div>' +
                '<div class="address-detail">' + fullAddress + '</div>' +
            '</div>'
        );
    }).join('') +
    '<button class="add-address-btn" onclick="addNewAddress()" aria-label="新增收货地址">+ 新增收货地址</button>';
}

function renderOrderItems() {
    const container = document.getElementById('orderItems');

    if (cart.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 40px;">购物车是空的</p>';
        return;
    }

    container.innerHTML = cart.map(item => `
        <div class="order-item" role="listitem">
            <div class="item-image">${item.image}</div>
            <div class="item-info">
                <div class="item-name">${item.name}</div>
                ${item.variant ? `<div class="item-variant">${item.variant}</div>` : ''}
                <div class="item-price-row">
                    <span class="item-price">¥${item.price}</span>
                    <span class="item-quantity">x${item.quantity}</span>
                </div>
            </div>
        </div>
    `).join('');
}

function calculateTotal() {
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const total = subtotal;

    document.getElementById('subtotal').textContent = `¥${subtotal.toFixed(0)}`;
    document.getElementById('totalAmount').textContent = `¥${total.toFixed(0)}`;
}

function selectAddress(element) {
    document.querySelectorAll('.address-option').forEach(el => {
        el.classList.remove('selected');
        el.setAttribute('aria-checked', 'false');
    });
    element.classList.add('selected');
    element.setAttribute('aria-checked', 'true');
}

function selectDelivery(element) {
    document.querySelectorAll('.delivery-option').forEach(el => {
        el.classList.remove('selected');
        el.setAttribute('aria-checked', 'false');
    });
    element.classList.add('selected');
    element.setAttribute('aria-checked', 'true');
}

function selectPayment(element) {
    document.querySelectorAll('.payment-option').forEach(el => {
        el.classList.remove('selected');
        el.setAttribute('aria-checked', 'false');
    });
    element.classList.add('selected');
    element.setAttribute('aria-checked', 'true');
}

function addNewAddress() {
    showNotification('地址管理功能开发中...');
}

async function submitOrder() {
    if (cart.length === 0) {
        showNotification('购物车是空的');
        return;
    }

    const total = document.getElementById('totalAmount').textContent;

    if (!confirm(`确认提交订单?\n应付金额: ${total}`)) return;

    if (typeof OrderAPI !== 'undefined' && typeof TokenManager !== 'undefined' && TokenManager.isLoggedIn()) {
        try {
            const orderData = {
                items: cart.map(item => ({
                    product_id: item.id,
                    quantity: item.quantity,
                })),
                shipping_name: document.querySelector('.address-option.selected .address-name')?.textContent || '默认收货人',
                shipping_phone: document.querySelector('.address-option.selected .address-phone')?.textContent || '13800138000',
                shipping_address: document.querySelector('.address-option.selected .address-detail')?.textContent || '默认地址',
                payment_method: document.querySelector('.payment-option.selected')?.dataset.method || 'alipay',
            };

            const result = await OrderAPI.createOrder(orderData);
            if (result.success) {
                showNotification('订单提交成功!');
                localStorage.removeItem('cart');
                localStorage.removeItem('checkoutCart');
                setTimeout(() => window.location.href = 'profile.html', 1500);
            } else {
                showNotification(result.message || '订单提交失败', 'error');
            }
        } catch (e) {
            showNotification('订单提交失败，请检查后端服务', 'error');
        }
    } else {
        showNotification('订单提交成功!');
        localStorage.removeItem('cart');
        localStorage.removeItem('checkoutCart');
        setTimeout(() => window.location.href = 'profile.html', 1500);
    }
}

document.addEventListener('DOMContentLoaded', initCheckout);
