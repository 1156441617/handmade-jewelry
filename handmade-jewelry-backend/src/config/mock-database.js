const { mockData } = require('../services/mock.service');

const mockUsers = [
  {
    id: 'admin-001',
    email: 'admin@handmade.com',
    username: '管理员',
    password_hash: '$2a$10$mock_hash_admin',
    avatar_url: null,
    is_active: true,
    role: 'admin',
    membership_level: 'gold',
    points: 1000,
    is_verified: true,
    created_at: '2026-01-01T00:00:00Z',
    last_login_at: new Date().toISOString(),
  },
  {
    id: 'user-001',
    email: 'test@example.com',
    username: '测试用户',
    password_hash: '$2a$10$mock_hash_user',
    avatar_url: null,
    is_active: true,
    role: 'customer',
    membership_level: 'silver',
    points: 500,
    is_verified: true,
    created_at: '2026-03-01T00:00:00Z',
    last_login_at: new Date().toISOString(),
  }
];

let mockOrders = [
  {
    id: 'order-001', order_number: 'ORD20260531000001', user_id: 'user-001',
    status: 'pending', payment_method: null, payment_status: 'pending',
    subtotal: 168.00, shipping_fee: 0, discount_amount: 0, total_amount: 168.00,
    items: [
      { product_id: '1', product_name: '月光石编织戒指', product_image: '💍', quantity: 1, unit_price: 168.00, subtotal: 168.00 }
    ],
    shipping_name: '测试用户', shipping_phone: '13800138000', shipping_address: '北京市朝阳区测试地址',
    created_at: new Date(Date.now() - 3600000).toISOString()
  },
  {
    id: 'order-002', order_number: 'ORD20260530000002', user_id: 'user-001',
    status: 'paid', payment_method: 'alipay', payment_status: 'paid',
    subtotal: 486.00, shipping_fee: 0, discount_amount: 0, total_amount: 486.00,
    items: [
      { product_id: '2', product_name: '淡水珍珠耳环', product_image: '✨', quantity: 1, unit_price: 128.00, subtotal: 128.00 },
      { product_id: '3', product_name: '水晶能量项链', product_image: '📿', quantity: 1, unit_price: 298.00, subtotal: 298.00 }
    ],
    shipping_name: '测试用户', shipping_phone: '13800138000', shipping_address: '北京市朝阳区测试地址',
    created_at: new Date(Date.now() - 86400000).toISOString()
  },
  {
    id: 'order-003', order_number: 'ORD20260528000003', user_id: 'user-001',
    status: 'shipped', payment_method: 'wechat', payment_status: 'paid',
    subtotal: 198.00, shipping_fee: 10.00, discount_amount: 0, total_amount: 208.00,
    items: [
      { product_id: '8', product_name: '黑曜石守护手链', product_image: '🖤', quantity: 1, unit_price: 198.00, subtotal: 198.00 }
    ],
    shipping_name: '测试用户', shipping_phone: '13800138000', shipping_address: '北京市朝阳区测试地址',
    created_at: new Date(Date.now() - 259200000).toISOString(),
    tracking_number: 'SF1234567890'
  },
  {
    id: 'order-004', order_number: 'ORD20260520000004', user_id: 'user-001',
    status: 'completed', payment_method: 'alipay', payment_status: 'paid',
    subtotal: 228.00, shipping_fee: 0, discount_amount: 0, total_amount: 228.00,
    items: [
      { product_id: '6', product_name: '复古银饰戒指套装', product_image: '💍', quantity: 1, unit_price: 228.00, subtotal: 228.00 }
    ],
    shipping_name: '测试用户', shipping_phone: '13800138000', shipping_address: '北京市朝阳区测试地址',
    created_at: new Date(Date.now() - 864000000).toISOString()
  }
];
let mockSessions = [];
let mockBehaviors = [];
let mockFavorites = [
  { user_id: 'user-001', product_id: '1', created_at: new Date().toISOString() },
  { user_id: 'user-001', product_id: '5', created_at: new Date().toISOString() },
  { user_id: 'user-001', product_id: '7', created_at: new Date().toISOString() }
];
let mockRecommendations = [];
let mockGeneratedContent = [];
let mockPlatformMappings = [];
let mockPlatformConfigs = [];

const handleMockQuery = async (text, params) => {
  const sql = text.trim().toLowerCase();

  if (sql.includes('from users') && sql.includes('where email')) {
    const email = params[0];
    const user = mockUsers.find(u => u.email === email);
    return { rows: user ? [user] : [], rowCount: user ? 1 : 0 };
  }

  if (sql.includes('from users') && sql.includes('where id')) {
    const id = params[0];
    const user = mockUsers.find(u => u.id === id);
    return { rows: user ? [user] : [], rowCount: user ? 1 : 0 };
  }

  if (sql.includes('insert into users')) {
    const newUser = {
      id: `user-${Date.now()}`,
      email: params[0],
      password_hash: params[1],
      username: params[2] || null,
      phone: params[3] || null,
      avatar_url: null,
      is_active: true,
      role: 'customer',
      membership_level: 'bronze',
      points: 0,
      is_verified: false,
      created_at: new Date().toISOString(),
      last_login_at: null,
    };
    mockUsers.push(newUser);
    return { rows: [newUser], rowCount: 1 };
  }

  if (sql.includes('update users set last_login')) {
    const id = params[0];
    const user = mockUsers.find(u => u.id === id);
    if (user) user.last_login_at = new Date().toISOString();
    return { rows: [], rowCount: 1 };
  }

  if (sql.includes('update users set username') || sql.includes('update users set password_hash')) {
    const id = params[params.length - 1];
    const user = mockUsers.find(u => u.id === id);
    if (user && sql.includes('password_hash')) user.password_hash = params[0];
    if (user && sql.includes('username')) user.username = params[0];
    return { rows: user ? [user] : [], rowCount: 1 };
  }

  if (sql.includes('insert into user_sessions')) {
    mockSessions.push({
      user_id: params[0],
      token: params[1],
      refresh_token: params[2],
      expires_at: params[3],
    });
    return { rows: [], rowCount: 1 };
  }

  if (sql.includes('from user_sessions') && sql.includes('refresh_token')) {
    const token = params[0];
    const session = mockSessions.find(s => s.refresh_token === token);
    return { rows: session ? [{ user_id: session.user_id }] : [], rowCount: session ? 1 : 0 };
  }

  if (sql.includes('delete from user_sessions') && sql.includes('token')) {
    mockSessions = mockSessions.filter(s => s.token !== params[0]);
    return { rows: [], rowCount: 1 };
  }

  if (sql.includes('delete from user_sessions') && sql.includes('user_id')) {
    mockSessions = mockSessions.filter(s => s.user_id !== params[0]);
    return { rows: [], rowCount: 1 };
  }

  if (sql.includes('insert into products')) {
    const newProduct = {
      id: `p-${Date.now()}`,
      sku: params[0],
      name: params[1],
      slug: params[2],
      description: params[3],
      category: params[4],
      price: parseFloat(params[5]) || 0,
      originalPrice: params[6] ? parseFloat(params[6]) : null,
      stock: parseInt(params[7]) || 0,
      material: params[8] || '',
      mainImage: params[9] || '',
      images: params[10] || [],
      badges: params[11] || [],
      status: params[12] || 'active',
      createdAt: new Date().toISOString(),
      rating: 0,
      reviewCount: 0,
    };
    mockData.products.push(newProduct);
    return {
      rows: [{
        id: newProduct.id,
        sku: newProduct.sku,
        name: newProduct.name,
        slug: newProduct.slug,
        description: newProduct.description,
        category_id: newProduct.category,
        price: newProduct.price,
        original_price: newProduct.originalPrice,
        stock_quantity: newProduct.stock,
        material: newProduct.material,
        main_image_url: newProduct.mainImage,
        image_urls: newProduct.images,
        tags: newProduct.badges,
        status: newProduct.status,
        created_by: params[13] || 'seller-center',
        created_at: newProduct.createdAt,
      }],
      rowCount: 1,
    };
  }

  if (sql.includes('select count(*) from products')) {
    return { rows: [{ count: mockData.products.length.toString() }], rowCount: 1 };
  }

  if (sql.includes('from products') && (sql.includes('where id') || sql.includes('where p.id'))) {
    const id = params[0];
    const product = mockData.products.find(p => p.id === id);
    if (product) {
      return {
        rows: [{
          ...product,
          original_price: product.originalPrice,
          main_image_url: product.mainImage,
          image_urls: product.images,
          rating_average: product.rating,
          review_count: product.reviewCount,
          sales_count: product.reviewCount,
          stock_quantity: product.stock,
          category_id: product.category,
          tags: product.badges || [],
          status: 'active',
          deleted_at: null,
          view_count: 0,
          favorite_count: 0,
          is_featured: product.badges?.includes('hot') || false,
          is_new_arrival: product.badges?.includes('new') || false,
          is_limited_edition: product.badges?.includes('limited') || false,
          created_at: product.createdAt,
        }],
        rowCount: 1,
      };
    }
    return { rows: [], rowCount: 0 };
  }

  if ((sql.includes('from products') || sql.includes('from products p')) && sql.includes('status')) {
    console.log('MOCK: Matched products list query, sql:', sql.substring(0, 100));
    console.log('MOCK: params:', JSON.stringify(params));
    let products = mockData.products.filter(p => p.status === 'active');
    console.log('MOCK: filtered products count:', products.length);

    if (sql.includes('category_id') && params.length > 1) {
      const categorySlug = params.find(p => typeof p === 'string' && isNaN(p) && p !== 'active' && !p.includes('%'));
      console.log('MOCK: category filter, slug:', categorySlug);
      if (categorySlug) {
        products = products.filter(p => p.category === categorySlug);
        console.log('MOCK: after category filter:', products.length);
      }
    }

    if (sql.includes('ilike')) {
      const searchParam = params.find(p => typeof p === 'string' && p.includes('%'));
      console.log('MOCK: search filter, param:', searchParam);
      if (searchParam) {
        const keyword = searchParam.replace(/%/g, '');
        products = products.filter(p =>
          p.name.includes(keyword) || p.description.includes(keyword)
        );
        console.log('MOCK: after search filter:', products.length);
      }
    }

    if (sql.includes('tags')) {
      const tagParam = params.find(p => typeof p === 'string' && !p.includes('%') && p !== 'active');
      console.log('MOCK: tags filter, tagParam:', tagParam, 'sql has tags:', true);
      if (tagParam) {
        products = products.filter(p => p.badges?.includes(tagParam));
        console.log('MOCK: after tags filter:', products.length);
      }
    }

    if (sql.includes('price >=') || sql.includes('price >=')) {
      const minPrice = params.find(p => typeof p === 'number' && p > 0 && p < 10000);
    }

    console.log('MOCK: About to map, products count:', products.length);
    console.log('MOCK: First product sample:', products[0] ? { id: products[0].id, name: products[0].name, status: products[0].status } : 'none');

    const mapped = products.map(p => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      slug: p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      description: p.description,
      price: p.price,
      original_price: p.originalPrice,
      main_image_url: p.mainImage,
      image_urls: p.images,
      rating_average: p.rating,
      review_count: p.reviewCount,
      sales_count: p.reviewCount,
      stock_quantity: p.stock,
      category_id: p.category,
      category_name: p.category,
      category_slug: p.category,
      tags: p.badges || [],
      is_featured: p.badges?.includes('hot') || false,
      is_new_arrival: p.badges?.includes('new') || false,
      is_limited_edition: p.badges?.includes('limited') || false,
      status: 'active',
      deleted_at: null,
      created_at: p.createdAt,
    }));

    let pageSize = 20;
    let start = 0;

    const numericParams = params.map((p, i) => ({ value: p, index: i })).filter(p => typeof p.value === 'number');
    if (numericParams.length >= 2) {
      pageSize = numericParams[numericParams.length - 2].value;
      start = numericParams[numericParams.length - 1].value;
    } else if (numericParams.length === 1) {
      pageSize = numericParams[0].value;
    }

    start = Math.min(start, mapped.length);

    console.log('MOCK: mapped count:', mapped.length, 'pageSize:', pageSize, 'start:', start);
    console.log('MOCK: returning rows:', mapped.slice(start, start + pageSize).length);

    return {
      rows: mapped.slice(start, start + pageSize),
      rowCount: mapped.length,
    };
  }

  if (sql.includes('from categories')) {
    return { rows: mockData.categories, rowCount: mockData.categories.length };
  }

  if (sql.includes('from product_variants')) {
    return { rows: [], rowCount: 0 };
  }

  if (sql.includes('category_id') && sql.includes('rating_average') && !sql.includes('from products where id')) {
    return { rows: mockData.products.slice(0, 4).map(p => ({
      id: p.id, name: p.name, price: p.price,
      main_image_url: p.mainImage, rating_average: p.rating,
    })), rowCount: Math.min(4, mockData.products.length) };
  }

  if (sql.includes('update products set view_count')) {
    return { rows: [], rowCount: 1 };
  }

  if (sql.includes('insert into product_favorites')) {
    mockFavorites.push({ user_id: params[0], product_id: params[1] });
    return { rows: [], rowCount: 1 };
  }

  if (sql.includes('delete from product_favorites')) {
    mockFavorites = mockFavorites.filter(f => !(f.user_id === params[0] && f.product_id === params[1]));
    return { rows: [{ id: '1' }], rowCount: 1 };
  }

  if (sql.includes('from product_favorites') && sql.includes('join products')) {
    const userId = params[0];
    const userFavs = mockFavorites.filter(f => f.user_id === userId);
    const pageSize = parseInt(params[1]) || 20;
    const offset = parseInt(params[2]) || 0;
    const sliced = userFavs.slice(offset, offset + pageSize);
    return {
      rows: sliced.map(f => {
        const p = mockData.products.find(pr => pr.id === f.product_id);
        return p ? {
          id: p.id, name: p.name, slug: p.slug || p.name.toLowerCase().replace(/\s+/g, '-'),
          price: p.price, originalPrice: p.originalPrice, main_image_url: p.mainImage || p.image,
          rating_average: p.rating, favorited_at: f.created_at
        } : null;
      }).filter(Boolean),
      rowCount: userFavs.length,
    };
  }

  if (sql.includes('select count(*) from product_favorites')) {
    const userId = params[0];
    const count = mockFavorites.filter(f => f.user_id === userId).length;
    return { rows: [{ count: count.toString() }], rowCount: 1 };
  }

  if (sql.includes('from orders') && sql.includes('where id') && sql.includes('user_id')) {
    const order = mockOrders.find(o => o.id === params[0] && o.user_id === params[1]);
    return { rows: order ? [order] : [], rowCount: order ? 1 : 0 };
  }

  if (sql.includes('from orders') && sql.includes('user_id') && sql.includes('order by')) {
    const userId = params[0];
    const userOrders = mockOrders.filter(o => o.user_id === userId);
    return { rows: userOrders, rowCount: userOrders.length };
  }

  if (sql.includes('select count(*) from orders')) {
    const userId = params[0];
    const count = mockOrders.filter(o => o.user_id === userId).length;
    return { rows: [{ count: count.toString() }], rowCount: 1 };
  }

  if (sql.includes('from order_items')) {
    const orderId = params[0];
    const order = mockOrders.find(o => o.id === orderId);
    return { rows: order?.items || [], rowCount: order?.items?.length || 0 };
  }

  if (sql.includes('insert into user_behaviors')) {
    mockBehaviors.push({
      user_id: params[0], session_id: params[1], action: params[2],
      product_id: params[3], metadata: params[4], created_at: new Date().toISOString(),
    });
    return { rows: [], rowCount: 1 };
  }

  if (sql.includes('from user_behaviors') && sql.includes('action')) {
    return { rows: [], rowCount: 0 };
  }

  if (sql.includes('insert into ai_generated_content')) {
    return { rows: [], rowCount: 1 };
  }

  if (sql.includes('from platform_product_mappings')) {
    return { rows: [], rowCount: 0 };
  }

  if (sql.includes('from platform_integrations') && sql.includes('order by')) {
    return { rows: [], rowCount: 0 };
  }

  if (sql.includes('insert into platform_integrations')) {
    return { rows: [{ platform: params[0] }], rowCount: 1 };
  }

  if (sql.includes('update platform_integrations')) {
    return { rows: [], rowCount: 1 };
  }

  if (sql.includes('from platform_integrations') && sql.includes('is_active')) {
    return { rows: [], rowCount: 0 };
  }

  if (sql.includes('insert into platform_product_mappings') || sql.includes('update platform_product_mappings')) {
    return { rows: [], rowCount: 1 };
  }

  if (sql.includes('insert into recommendations')) {
    return { rows: [], rowCount: 1 };
  }

  console.log('Mock query fallback for:', sql.substring(0, 120), 'params:', JSON.stringify(params));
  return { rows: [], rowCount: 0 };
};

module.exports = {
  mockUsers,
  mockOrders,
  mockSessions,
  mockBehaviors,
  mockFavorites,
  mockRecommendations,
  mockGeneratedContent,
  mockPlatformMappings,
  mockPlatformConfigs,
  handleMockQuery,
};
