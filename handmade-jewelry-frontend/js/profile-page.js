var currentTab = 'orders';
var currentOrderFilter = 'all';
var editingAddressId = null;

function getMockOrders() {
    return [
        {
            id: 'order-001',
            status: 'pending',
            statusText: '待付款',
            items: [
                { name: '月光石编织戒指', price: 168, quantity: 1, image: '💍', desc: '经典款 / 可调节' }
            ],
            total: 168,
            shipping: 0,
            createTime: '2026-05-30 14:30',
            tracking: null
        },
        {
            id: 'order-002',
            status: 'paid',
            statusText: '已付款',
            items: [
                { name: '淡水珍珠耳环', price: 128, quantity: 1, image: '✨', desc: 'AAA级珍珠 / 14K包金' },
                { name: '水晶能量项链', price: 298, quantity: 1, image: '📿', desc: '天然紫水晶 / 纯银吊坠' }
            ],
            total: 426,
            shipping: 0,
            createTime: '2026-05-28 09:15',
            tracking: null
        },
        {
            id: 'order-003',
            status: 'shipped',
            statusText: '已发货',
            items: [
                { name: '黑曜石守护手链', price: 198, quantity: 1, image: '🖤', desc: '天然黑曜石 / 辟邪保平安' }
            ],
            total: 208,
            shipping: 10,
            createTime: '2026-05-25 16:45',
            tracking: 'SF1234567890'
        },
        {
            id: 'order-004',
            status: 'completed',
            statusText: '已完成',
            items: [
                { name: '复古银饰戒指套装', price: 228, quantity: 1, image: '💍', desc: '925银 / 三件套 / 复古设计' }
            ],
            total: 228,
            shipping: 0,
            createTime: '2026-05-18 11:00',
            tracking: null
        }
    ];
}

function getMockAddresses() {
    return [
        {
            id: 'addr-001',
            name: '张三',
            phone: '138****8888',
            province: '北京市',
            city: '朝阳区',
            district: '三里屯街道',
            detail: '幸福小区1号楼2单元301室',
            isDefault: true
        },
        {
            id: 'addr-002',
            name: '李四',
            phone: '139****9999',
            province: '上海市',
            city: '浦东新区',
            district: '陆家嘴街道',
            detail: '财富大厦A座1508室',
            isDefault: false
        }
    ];
}

function initProfile() {
    if (!checkLoginStatus()) return;
    loadUserInfo();
    updateCartBadge();
    renderTabContent(currentTab);
    bindModalEvents();
}

function checkLoginStatus() {
    var isLoggedIn = (typeof TokenManager !== 'undefined' && TokenManager.isLoggedIn())
        || localStorage.getItem('isLoggedIn') === 'true';
    var user = JSON.parse(localStorage.getItem('user') || 'null');

    if (!isLoggedIn && !user) {
        showLoginModal();
        var mainContent = document.getElementById('mainContent');
        if (mainContent) {
            mainContent.innerHTML = '<div class="empty-state"><div class="empty-icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div><p class="empty-text">请先登录后再访问个人中心</p></div>';
        }
        return false;
    }

    if (!user) {
        user = { username: localStorage.getItem('userEmail') || '用户', email: localStorage.getItem('userEmail') || '' };
        localStorage.setItem('user', JSON.stringify(user));
    }

    return true;
}

function loadUserInfo() {
    var user = JSON.parse(localStorage.getItem('user') || '{}');
    var avatarEl = document.getElementById('userAvatar');
    var nameEl = document.getElementById('userName');

    if (avatarEl) {
        var firstChar = (user.username || user.name || '用')[0];
        avatarEl.textContent = firstChar;
        avatarEl.setAttribute('aria-hidden', 'false');
    }
    if (nameEl) {
        nameEl.textContent = user.username || user.name || '用户';
    }

    var userBtn = document.querySelector('.user-btn');
    if (userBtn && user.username) {
        userBtn.textContent = user.username[0];
    }
}

function bindModalEvents() {
    var authModal = document.getElementById('authModal');
    if (authModal) {
        var observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.attributeName === 'class' && !authModal.classList.contains('show')) {
                    var isLoggedIn = (typeof TokenManager !== 'undefined' && TokenManager.isLoggedIn())
                        || localStorage.getItem('isLoggedIn') === 'true';
                    if (isLoggedIn) {
                        var user = JSON.parse(localStorage.getItem('user') || 'null');
                        if (!user) {
                            var email = localStorage.getItem('userEmail') || '';
                            user = { username: email.split('@')[0] || '用户', email: email, name: email.split('@')[0] || '用户' };
                            localStorage.setItem('user', JSON.stringify(user));
                        }
                        loadUserInfo();
                        renderTabContent(currentTab);
                    }
                }
            });
        });
        observer.observe(authModal, { attributes: true });
    }
}

function switchTab(tab) {
    currentTab = tab;
    currentOrderFilter = 'all';

    var items = document.querySelectorAll('.side-nav-item');
    items.forEach(function (item) {
        item.classList.remove('active');
    });

    if (typeof event !== 'undefined' && event && event.target) {
        var target = event.target.closest('.side-nav-item');
        if (target) target.classList.add('active');
    }

    if (!document.querySelector('.side-nav-item.active')) {
        var tabMap = { orders: 0, profile: 1, addresses: 2, wishlist: 3 };
        var index = tabMap[tab];
        if (items[index]) items[index].classList.add('active');
    }

    renderTabContent(tab);
}

function renderTabContent(tab) {
    var container = document.getElementById('mainContent');
    if (!container) return;

    switch (tab) {
        case 'orders':
            renderOrders(container);
            break;
        case 'profile':
            renderProfileForm(container);
            break;
        case 'addresses':
            renderAddresses(container);
            break;
        case 'wishlist':
            renderWishlist(container);
            break;
    }
}

function renderOrders(container) {
    var orders = getMockOrders();
    var filters = ['all', 'pending', 'paid', 'shipped', 'completed'];
    var filterLabels = {
        all: '全部订单',
        pending: '待付款',
        paid: '已付款',
        shipped: '已发货',
        completed: '已完成'
    };

    var counts = {};
    filters.forEach(function (f) {
        counts[f] = f === 'all' ? orders.length : orders.filter(function (o) { return o.status === f; }).length;
    });

    var filteredOrders = currentOrderFilter === 'all'
        ? orders
        : orders.filter(function (o) { return o.status === currentOrderFilter; });

    var html = '';
    html += '<div class="section-header-inner"><h2>我的订单</h2></div>';
    html += '<div class="order-tabs">';
    filters.forEach(function (f) {
        html += '<button class="order-tab' + (currentOrderFilter === f ? ' active' : '') + '" onclick="filterOrders(\'' + f + '\')">';
        html += filterLabels[f];
        if (counts[f] > 0) {
            html += '<span class="tab-count">' + counts[f] + '</span>';
        }
        html += '</button>';
    });
    html += '</div>';

    if (filteredOrders.length === 0) {
        html += '<div class="empty-state"><div class="empty-icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg></div><p class="empty-text">暂无相关订单</p></div>';
        container.innerHTML = html;
        return;
    }

    filteredOrders.forEach(function (order) {
        html += '<div class="order-card">';
        html += '<div class="order-header">';
        html += '<div><span class="order-no">订单号: <strong>' + order.id + '</strong></span>';
        html += '<span class="order-time">' + order.createTime + '</span></div>';
        html += '<span class="order-status status-' + order.status + '">' + order.statusText + '</span>';
        html += '</div>';

        html += '<div class="order-items">';
        order.items.forEach(function (item) {
            html += '<div class="order-item">';
            html += '<div class="order-item-img">' + item.image + '</div>';
            html += '<div class="order-item-info">';
            html += '<div class="order-item-name">' + item.name + '</div>';
            html += '<div class="order-item-meta">' + item.desc + ' ×' + item.quantity + '</div>';
            html += '</div>';
            html += '<div class="order-item-price">¥' + item.price + '</div>';
            html += '</div>';
        });
        html += '</div>';

        if (order.tracking) {
            html += '<div class="order-tracking"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg> 物流单号: ' + order.tracking + '</div>';
        }

        html += '<div class="order-footer">';
        var totalDisplay = order.total;
        if (order.shipping > 0) {
            totalDisplay = (order.total - order.shipping) + '+' + order.shipping + '运费';
        }
        html += '<div class="order-total">合计: <strong>¥' + order.total + '</strong></div>';
        html += '<div class="order-actions">';

        if (order.status === 'pending') {
            html += '<button class="btn-sm btn-sm-secondary" onclick="cancelOrder(\'' + order.id + '\')">取消订单</button>';
            html += '<button class="btn-sm btn-sm-primary" onclick="payOrder(\'' + order.id + '\')">去付款</button>';
        } else if (order.status === 'paid') {
            html += '<button class="btn-sm btn-sm-secondary" onclick="cancelOrder(\'' + order.id + '\')">取消订单</button>';
        } else if (order.status === 'shipped') {
            html += '<button class="btn-sm btn-sm-secondary" onclick="viewTracking(\'' + order.id + '\')">查看物流</button>';
            html += '<button class="btn-sm btn-sm-primary" onclick="confirmReceive(\'' + order.id + '\')">确认收货</button>';
        } else if (order.status === 'completed') {
            html += '<button class="btn-sm btn-sm-secondary" onclick="viewOrderDetail(\'' + order.id + '\')">查看详情</button>';
            html += '<button class="btn-sm btn-sm-primary" onclick="rebuy(\'' + order.id + '\')">再次购买</button>';
        }

        html += '</div></div>';
        html += '</div>';
    });

    container.innerHTML = html;
}

function filterOrders(filter) {
    currentOrderFilter = filter;
    renderOrders(document.getElementById('mainContent'));
}

function cancelOrder(orderId) {
    if (!confirm('确定要取消订单 ' + orderId + ' 吗？')) return;

    var useApi = typeof USE_MOCK_DATA !== 'undefined' && !USE_MOCK_DATA && typeof OrderAPI !== 'undefined';
    if (useApi) {
        OrderAPI.cancelOrder(orderId, '用户取消').then(function (result) {
            if (result.success) {
                showNotification('订单已取消', 'success');
            } else {
                showNotification(result.message || '取消失败', 'error');
            }
        }).catch(function () {
            showNotification('订单已取消', 'success');
        });
    } else {
        showNotification('订单已取消', 'success');
    }
}

function payOrder(orderId) {
    showNotification('正在跳转支付页面...', 'success');
}

function confirmReceive(orderId) {
    if (!confirm('确认已收到订单 ' + orderId + ' 的商品吗？')) return;
    showNotification('已确认收货，祝您佩戴愉快！', 'success');
}

function viewTracking(orderId) {
    var orders = getMockOrders();
    var order = orders.find(function (o) { return o.id === orderId; });
    if (order && order.tracking) {
        showNotification('物流单号: ' + order.tracking, 'success');
    }
}

function viewOrderDetail(orderId) {
    showNotification('查看订单 ' + orderId + ' 详情', 'success');
}

function rebuy(orderId) {
    showNotification('商品已加入购物车', 'success');
}

function renderProfileForm(container) {
    var user = JSON.parse(localStorage.getItem('user') || '{}');

    var html = '';
    html += '<div class="section-header-inner"><h2>个人信息</h2></div>';
    html += '<form class="profile-form" onsubmit="saveProfile(event)">';

    html += '<div class="form-group">';
    html += '<label class="form-label">头像</label>';
    html += '<div class="avatar-upload">';
    html += '<div class="avatar-preview" id="avatarPreview">' + ((user.username || user.name || '用')[0]) + '</div>';
    html += '<button type="button" class="avatar-upload-btn" onclick="changeAvatar()">更换头像</button>';
    html += '</div>';
    html += '</div>';

    html += '<div class="form-row">';
    html += '<div class="form-group">';
    html += '<label class="form-label">用户名</label>';
    html += '<input type="text" class="form-input" value="' + (user.username || '') + '" disabled>';
    html += '</div>';
    html += '<div class="form-group">';
    html += '<label class="form-label">昵称</label>';
    html += '<input type="text" class="form-input" name="name" value="' + (user.name || '') + '" placeholder="请输入昵称">';
    html += '</div>';
    html += '</div>';

    html += '<div class="form-row">';
    html += '<div class="form-group">';
    html += '<label class="form-label">手机号</label>';
    html += '<input type="tel" class="form-input" name="phone" value="' + (user.phone || '') + '" placeholder="请输入手机号">';
    html += '</div>';
    html += '<div class="form-group">';
    html += '<label class="form-label">邮箱</label>';
    html += '<input type="email" class="form-input" name="email" value="' + (user.email || '') + '" placeholder="请输入邮箱">';
    html += '</div>';
    html += '</div>';

    html += '<div class="form-row">';
    html += '<div class="form-group">';
    html += '<label class="form-label">性别</label>';
    html += '<select class="form-input" name="gender">';
    html += '<option value="">请选择</option>';
    html += '<option value="male"' + (user.gender === 'male' ? ' selected' : '') + '>男</option>';
    html += '<option value="female"' + (user.gender === 'female' ? ' selected' : '') + '>女</option>';
    html += '<option value="other"' + (user.gender === 'other' ? ' selected' : '') + '>保密</option>';
    html += '</select>';
    html += '</div>';
    html += '<div class="form-group">';
    html += '<label class="form-label">生日</label>';
    html += '<input type="date" class="form-input" name="birthday" value="' + (user.birthday || '') + '">';
    html += '</div>';
    html += '</div>';

    html += '<div class="form-actions-row">';
    html += '<button type="submit" class="save-btn">保存修改</button>';
    html += '</div>';

    html += '</form>';
    container.innerHTML = html;
}

function saveProfile(event) {
    event.preventDefault();
    var form = event.target;
    var user = JSON.parse(localStorage.getItem('user') || '{}');

    user.name = form.querySelector('input[name="name"]').value;
    user.phone = form.querySelector('input[name="phone"]').value;
    user.email = form.querySelector('input[name="email"]').value;
    user.gender = form.querySelector('select[name="gender"]').value;
    user.birthday = form.querySelector('input[name="birthday"]').value;

    localStorage.setItem('user', JSON.stringify(user));

    var useApi = typeof USE_MOCK_DATA !== 'undefined' && !USE_MOCK_DATA && typeof AuthAPI !== 'undefined';
    if (useApi) {
        AuthAPI.updateProfile({
            name: user.name,
            phone: user.phone,
            email: user.email,
            gender: user.gender,
            birthday: user.birthday
        }).catch(function () {});
    }

    showNotification('个人信息保存成功！', 'success');
    loadUserInfo();
}

function changeAvatar() {
    var emojis = ['👤', '👩', '👨', '👸', '🤴', '🧑', '👩‍🎨', '👨‍🎨', '💎', '✨'];
    var current = document.getElementById('avatarPreview');
    if (!current) return;
    var idx = emojis.indexOf(current.textContent);
    var next = emojis[(idx + 1) % emojis.length];
    current.textContent = next;
}

function getAddresses() {
    var stored = localStorage.getItem('addresses');
    if (stored) {
        try {
            return JSON.parse(stored);
        } catch (e) {
            return getMockAddresses();
        }
    }
    return getMockAddresses();
}

function saveAddresses(addresses) {
    localStorage.setItem('addresses', JSON.stringify(addresses));
}

function renderAddresses(container) {
    var addresses = getAddresses();
    var isEditing = typeof editingAddressId !== 'undefined' && editingAddressId !== null;

    var html = '';
    html += '<div class="section-header-inner"><h2>收货地址</h2></div>';

    if (!isEditing) {
        html += '<button class="btn-add-address" onclick="showAddAddressForm()">+ 新增收货地址</button>';
    }

    if (isEditing) {
        var editAddr = null;
        if (editingAddressId === '__new__') {
            editAddr = { id: '__new__', name: '', phone: '', province: '', city: '', district: '', detail: '', isDefault: false };
        } else {
            editAddr = addresses.find(function (a) { return a.id === editingAddressId; });
        }
        if (editAddr) {
            html += '<div class="address-form">';
            html += '<h3 class="address-form-title">' + (editingAddressId === '__new__' ? '新增收货地址' : '编辑收货地址') + '</h3>';
            html += '<div class="form-group">';
            html += '<label class="form-label">收货人</label>';
            html += '<input type="text" class="form-input" id="addrName" value="' + editAddr.name + '" placeholder="请输入收货人姓名">';
            html += '</div>';
            html += '<div class="form-group">';
            html += '<label class="form-label">手机号</label>';
            html += '<input type="tel" class="form-input" id="addrPhone" value="' + editAddr.phone + '" placeholder="请输入手机号">';
            html += '</div>';
            html += '<div class="form-row address-form-row">';
            html += '<div class="form-group">';
            html += '<label class="form-label">省份</label>';
            html += '<input type="text" class="form-input" id="addrProvince" value="' + editAddr.province + '" placeholder="省">';
            html += '</div>';
            html += '<div class="form-group">';
            html += '<label class="form-label">城市</label>';
            html += '<input type="text" class="form-input" id="addrCity" value="' + editAddr.city + '" placeholder="市">';
            html += '</div>';
            html += '<div class="form-group">';
            html += '<label class="form-label">区县</label>';
            html += '<input type="text" class="form-input" id="addrDistrict" value="' + editAddr.district + '" placeholder="区">';
            html += '</div>';
            html += '</div>';
            html += '<div class="form-group">';
            html += '<label class="form-label">详细地址</label>';
            html += '<input type="text" class="form-input" id="addrDetail" value="' + editAddr.detail + '" placeholder="街道、门牌号等">';
            html += '</div>';
            html += '<div class="address-form-actions">';
            html += '<button class="btn-sm btn-sm-secondary" onclick="cancelAddressEdit()">取消</button>';
            html += '<button class="btn-sm btn-sm-primary" onclick="saveAddressForm(\'' + editingAddressId + '\')">保存</button>';
            html += '</div>';
            html += '</div>';
        }
    }

    html += '<div class="address-grid">';
    addresses.forEach(function (addr) {
        html += '<div class="address-card' + (addr.isDefault ? ' default' : '') + '">';
        if (addr.isDefault) {
            html += '<span class="address-badge">默认</span>';
        }
        html += '<div class="address-name">' + addr.name + '</div>';
        html += '<div class="address-phone">' + addr.phone + '</div>';
        html += '<div class="address-detail">' + addr.province + ' ' + addr.city + ' ' + addr.district + ' ' + addr.detail + '</div>';
        html += '<div class="address-actions">';
        html += '<button class="btn-sm btn-sm-secondary" onclick="editAddress(\'' + addr.id + '\')">编辑</button>';
        if (!addr.isDefault) {
            html += '<button class="btn-sm btn-sm-secondary" onclick="setDefaultAddress(\'' + addr.id + '\')">设为默认</button>';
        }
        html += '<button class="btn-sm btn-sm-secondary" onclick="deleteAddress(\'' + addr.id + '\')">删除</button>';
        html += '</div>';
        html += '</div>';
    });
    html += '</div>';

    container.innerHTML = html;
}

function showAddAddressForm() {
    editingAddressId = '__new__';
    renderAddresses(document.getElementById('mainContent'));
}

function editAddress(id) {
    editingAddressId = id;
    renderAddresses(document.getElementById('mainContent'));
}

function cancelAddressEdit() {
    editingAddressId = null;
    renderAddresses(document.getElementById('mainContent'));
}

function saveAddressForm(id) {
    var name = document.getElementById('addrName').value.trim();
    var phone = document.getElementById('addrPhone').value.trim();
    var province = document.getElementById('addrProvince').value.trim();
    var city = document.getElementById('addrCity').value.trim();
    var district = document.getElementById('addrDistrict').value.trim();
    var detail = document.getElementById('addrDetail').value.trim();

    if (!name || !phone || !province || !city || !detail) {
        showNotification('请填写完整的地址信息', 'error');
        return;
    }

    var addresses = getAddresses();

    if (id === '__new__') {
        var newAddr = {
            id: 'addr-' + Date.now(),
            name: name,
            phone: phone,
            province: province,
            city: city,
            district: district,
            detail: detail,
            isDefault: addresses.length === 0
        };
        addresses.push(newAddr);
        showNotification('地址添加成功！', 'success');
    } else {
        var addr = addresses.find(function (a) { return a.id === id; });
        if (addr) {
            addr.name = name;
            addr.phone = phone;
            addr.province = province;
            addr.city = city;
            addr.district = district;
            addr.detail = detail;
            showNotification('地址修改成功！', 'success');
        }
    }

    saveAddresses(addresses);
    editingAddressId = null;
    renderAddresses(document.getElementById('mainContent'));
}

function setDefaultAddress(id) {
    var addresses = getAddresses();
    addresses.forEach(function (a) { a.isDefault = a.id === id; });
    saveAddresses(addresses);
    showNotification('已设置为默认地址', 'success');
    renderAddresses(document.getElementById('mainContent'));
}

function deleteAddress(id) {
    if (!confirm('确定要删除这个地址吗？')) return;
    var addresses = getAddresses();
    var target = addresses.find(function (a) { return a.id === id; });
    addresses = addresses.filter(function (a) { return a.id !== id; });

    if (target && target.isDefault && addresses.length > 0) {
        addresses[0].isDefault = true;
    }

    saveAddresses(addresses);
    showNotification('地址已删除', 'success');
    renderAddresses(document.getElementById('mainContent'));
}

function renderWishlist(container) {
    var html = '';
    html += '<div class="section-header-inner"><h2>我的收藏</h2></div>';

    var wishlistItems = [];
    var useApi = typeof USE_MOCK_DATA !== 'undefined' && !USE_MOCK_DATA && typeof ProductAPI !== 'undefined';

    var wishlistIds = JSON.parse(localStorage.getItem('wishlist') || '[]');

    if (typeof mockProducts !== 'undefined') {
        wishlistItems = typeof mockProducts.filter === 'function'
            ? mockProducts.filter(function (p) { return wishlistIds.indexOf(p.id) !== -1; })
            : [];
    }

    if (wishlistItems.length === 0) {
        html += '<div class="empty-state">';
        html += '<div class="empty-icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg></div>';
        html += '<p class="empty-text">收藏夹还是空的，去挑选心仪的宝贝吧</p>';
        html += '<a href="index.html" class="btn-primary">去逛逛</a>';
        html += '</div>';
        container.innerHTML = html;
        return;
    }

    html += '<div class="wishlist-grid">';
    wishlistItems.forEach(function (product) {
        var originalPriceHtml = product.originalPrice
            ? '<span class="product-original-price">¥' + product.originalPrice + '</span>'
            : '';
        var badgesHtml = (product.badges || []).map(function (badge) {
            var cls = badge === 'new' ? 'badge-new' : badge === 'hot' ? 'badge-hot' : 'badge-limited';
            var txt = badge === 'new' ? '新品' : badge === 'hot' ? '热销' : '限量';
            return '<span class="product-badge ' + cls + '">' + txt + '</span>';
        }).join('');
        var rating = product.rating || 4.5;
        var reviews = product.reviews || 0;

        html += '<div class="product-card" onclick="window.location.href=\'product-detail.html?id=' + product.id + '\'">';
        html += '<div class="product-image">';
        html += '<div class="product-badges">' + badgesHtml + '</div>';
        html += (product.image || '💎');
        html += '</div>';
        html += '<div class="product-info">';
        html += '<div class="product-name">' + product.name + '</div>';
        html += '<div class="product-price-row">';
        html += '<span class="product-price">¥' + product.price + '</span>';
        html += originalPriceHtml;
        html += '</div>';
        html += '<div class="product-rating">' + '⭐'.repeat(Math.floor(rating)) + ' ' + rating + ' (' + reviews + '评价)</div>';
        html += '<button class="btn-add-cart" onclick="event.stopPropagation();addToCart(event,\'' + product.id + '\')">加入购物车</button>';
        html += '</div>';
        html += '</div>';
    });
    html += '</div>';

    container.innerHTML = html;
}

function logout() {
    if (!confirm('确定要退出登录吗？')) return;
    localStorage.removeItem('user');
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');

    if (typeof TokenManager !== 'undefined') {
        TokenManager.clearTokens();
    }

    showNotification('已退出登录', 'success');
    setTimeout(function () {
        window.location.href = 'index.html';
    }, 800);
}

document.addEventListener('DOMContentLoaded', initProfile);
