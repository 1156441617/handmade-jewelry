-- ============================================
-- 手作饰品电商数据库 Schema
-- PostgreSQL 14+
-- ============================================

-- 启用UUID扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- 1. 用户系统
-- ============================================

-- 用户表
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    username VARCHAR(100),
    avatar_url TEXT,
    gender VARCHAR(10) CHECK (gender IN ('male', 'female', 'other')),
    birthday DATE,
    
    -- 地址信息
    province VARCHAR(50),
    city VARCHAR(50),
    district VARCHAR(50),
    address_detail TEXT,
    
    -- 会员等级
    membership_level VARCHAR(20) DEFAULT 'regular' CHECK (membership_level IN ('regular', 'silver', 'gold', 'platinum')),
    points INTEGER DEFAULT 0,
    
    -- 状态
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    last_login_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- 用户索引
CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_phone ON users(phone) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_membership ON users(membership_level) WHERE deleted_at IS NULL;

-- 用户会话表
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(500) NOT NULL,
    refresh_token VARCHAR(500),
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_sessions_user ON user_sessions(user_id);
CREATE INDEX idx_sessions_token ON user_sessions(token);
CREATE INDEX idx_sessions_expires ON user_sessions(expires_at);

-- ============================================
-- 2. 商品系统
-- ============================================

-- 商品分类表
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    parent_id UUID REFERENCES categories(id),
    icon_url TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_categories_slug ON categories(slug);
CREATE INDEX idx_categories_parent ON categories(parent_id);

-- 商品表
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    detail_html TEXT,
    
    -- 分类和品牌
    category_id UUID NOT NULL REFERENCES categories(id),
    brand VARCHAR(100),
    
    -- 价格
    price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
    original_price DECIMAL(10,2) CHECK (original_price >= price),
    cost_price DECIMAL(10,2) CHECK (cost_price >= 0),
    
    -- 库存
    stock_quantity INTEGER DEFAULT 0 CHECK (stock_quantity >= 0),
    low_stock_threshold INTEGER DEFAULT 10,
    
    -- 规格
    material VARCHAR(200),
    color VARCHAR(50),
    size VARCHAR(50),
    weight_grams DECIMAL(8,2),
    dimensions JSONB, -- {length: 10, width: 5, height: 2}
    
    -- 图片和媒体
    main_image_url TEXT NOT NULL,
    image_urls TEXT[], -- 多张图片URL数组
    video_url TEXT,
    
    -- SEO
    meta_title VARCHAR(255),
    meta_description TEXT,
    meta_keywords TEXT[],
    
    -- 销售数据
    sales_count INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    favorite_count INTEGER DEFAULT 0,
    
    -- 评分
    rating_average DECIMAL(3,2) DEFAULT 0.00 CHECK (rating_average >= 0 AND rating_average <= 5),
    review_count INTEGER DEFAULT 0,
    
    -- 标签和特性
    tags TEXT[],
    features JSONB, -- {handmade: true, customizable: true, gift_wrap: true}
    
    -- 状态
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'active', 'inactive', 'sold_out')),
    is_featured BOOLEAN DEFAULT false,
    is_new_arrival BOOLEAN DEFAULT false,
    is_limited_edition BOOLEAN DEFAULT false,
    
    -- 多平台同步
    platform_data JSONB, -- {douyin: {id: xxx}, xiaohongshu: {id: xxx}, taobao: {id: xxx}}
    
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- 商品索引
CREATE INDEX idx_products_sku ON products(sku) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_slug ON products(slug) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_category ON products(category_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_status ON products(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_price ON products(price) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_featured ON products(is_featured) WHERE deleted_at IS NULL AND status = 'active';
CREATE INDEX idx_products_tags ON products USING gin(tags);

-- 商品规格变体表
CREATE TABLE product_variants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sku VARCHAR(50) UNIQUE NOT NULL,
    
    -- 规格属性
    attributes JSONB NOT NULL, -- {color: '金色', size: '均码'}
    
    -- 价格和库存
    price DECIMAL(10,2) CHECK (price >= 0),
    stock_quantity INTEGER DEFAULT 0 CHECK (stock_quantity >= 0),
    
    -- 图片
    image_url TEXT,
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_variants_product ON product_variants(product_id);
CREATE INDEX idx_variants_sku ON product_variants(sku);

-- 商品收藏表
CREATE TABLE product_favorites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, product_id)
);

CREATE INDEX idx_favorites_user ON product_favorites(user_id);
CREATE INDEX idx_favorites_product ON product_favorites(product_id);

-- ============================================
-- 3. 购物车
-- ============================================

CREATE TABLE cart_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES product_variants(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    selected BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, product_id, variant_id)
);

CREATE INDEX idx_cart_user ON cart_items(user_id);
CREATE INDEX idx_cart_product ON cart_items(product_id);

-- ============================================
-- 4. 订单系统
-- ============================================

-- 订单表
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number VARCHAR(50) UNIQUE NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id),
    
    -- 收货信息
    shipping_name VARCHAR(100) NOT NULL,
    shipping_phone VARCHAR(20) NOT NULL,
    shipping_province VARCHAR(50) NOT NULL,
    shipping_city VARCHAR(50) NOT NULL,
    shipping_district VARCHAR(50) NOT NULL,
    shipping_address TEXT NOT NULL,
    
    -- 金额
    subtotal DECIMAL(12,2) NOT NULL CHECK (subtotal >= 0),
    shipping_fee DECIMAL(10,2) DEFAULT 0 CHECK (shipping_fee >= 0),
    discount_amount DECIMAL(10,2) DEFAULT 0 CHECK (discount_amount >= 0),
    tax_amount DECIMAL(10,2) DEFAULT 0 CHECK (tax_amount >= 0),
    total_amount DECIMAL(12,2) NOT NULL CHECK (total_amount >= 0),
    
    -- 优惠券
    coupon_id UUID,
    coupon_code VARCHAR(50),
    
    -- 支付信息
    payment_method VARCHAR(50) CHECK (payment_method IN ('alipay', 'wechat', 'credit_card', 'bank_transfer')),
    payment_status VARCHAR(30) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded', 'partial_refunded')),
    paid_at TIMESTAMP WITH TIME ZONE,
    transaction_id VARCHAR(255),
    
    -- 物流信息
    shipping_method VARCHAR(50),
    tracking_number VARCHAR(100),
    shipped_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    
    -- 订单状态
    status VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned')),
    
    -- 备注
    customer_note TEXT,
    admin_note TEXT,
    
    -- 取消/退款原因
    cancellation_reason TEXT,
    refund_reason TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    cancelled_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_number ON orders(order_number);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_payment ON orders(payment_status);
CREATE INDEX idx_orders_created ON orders(created_at DESC);

-- 订单商品表
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    variant_id UUID REFERENCES product_variants(id),
    
    product_name VARCHAR(255) NOT NULL,
    product_sku VARCHAR(50) NOT NULL,
    product_image TEXT,
    
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(10,2) NOT NULL CHECK (unit_price >= 0),
    subtotal DECIMAL(12,2) NOT NULL CHECK (subtotal >= 0),
    
    -- 退款信息
    refund_quantity INTEGER DEFAULT 0,
    refund_amount DECIMAL(10,2) DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);

-- ============================================
-- 5. 评价系统
-- ============================================

CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id),
    user_id UUID NOT NULL REFERENCES users(id),
    product_id UUID NOT NULL REFERENCES products(id),
    
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    title VARCHAR(255),
    content TEXT,
    
    -- 图片/视频
    images TEXT[],
    video_url TEXT,
    
    -- 商家回复
    merchant_reply TEXT,
    replied_at TIMESTAMP WITH TIME ZONE,
    
    -- 有用性
    helpful_count INTEGER DEFAULT 0,
    
    is_verified_purchase BOOLEAN DEFAULT true,
    is_visible BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_reviews_product ON reviews(product_id);
CREATE INDEX idx_reviews_user ON reviews(user_id);
CREATE INDEX idx_reviews_order ON reviews(order_id);
CREATE INDEX idx_reviews_rating ON reviews(rating);

-- ============================================
-- 6. 营销系统
-- ============================================

-- 优惠券表
CREATE TABLE coupons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    
    -- 优惠类型
    discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('percentage', 'fixed', 'free_shipping')),
    discount_value DECIMAL(10,2) NOT NULL CHECK (discount_value >= 0),
    
    -- 使用条件
    min_order_amount DECIMAL(10,2) DEFAULT 0,
    max_discount_amount DECIMAL(10,2),
    
    -- 有效期
    valid_from TIMESTAMP WITH TIME ZONE NOT NULL,
    valid_until TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- 限制
    usage_limit INTEGER,
    usage_count INTEGER DEFAULT 0,
    per_user_limit INTEGER DEFAULT 1,
    
    -- 适用范围
    applicable_categories UUID[],
    applicable_products UUID[],
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_coupons_code ON coupons(code);
CREATE INDEX idx_coupons_active ON coupons(is_active) WHERE is_active = true;

-- 用户优惠券
CREATE TABLE user_coupons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    coupon_id UUID NOT NULL REFERENCES coupons(id),
    
    status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'used', 'expired', 'disabled')),
    
    obtained_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    used_at TIMESTAMP WITH TIME ZONE,
    order_id UUID REFERENCES orders(id),
    
    UNIQUE(user_id, coupon_id)
);

CREATE INDEX idx_user_coupons_user ON user_coupons(user_id);
CREATE INDEX idx_user_coupons_status ON user_coupons(status);

-- ============================================
-- 7. AI推荐系统
-- ============================================

-- 用户行为追踪
CREATE TABLE user_behaviors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    session_id VARCHAR(100),
    
    -- 行为类型
    action VARCHAR(50) NOT NULL CHECK (action IN ('view', 'click', 'add_to_cart', 'favorite', 'purchase', 'search', 'share')),
    
    -- 相关对象
    product_id UUID REFERENCES products(id),
    category_id UUID REFERENCES categories(id),
    search_query TEXT,
    
    -- 上下文
    page_url TEXT,
    referrer_url TEXT,
    device_type VARCHAR(20),
    ip_address INET,
    
    -- 元数据
    metadata JSONB,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_behaviors_user ON user_behaviors(user_id);
CREATE INDEX idx_behaviors_session ON user_behaviors(session_id);
CREATE INDEX idx_behaviors_action ON user_behaviors(action);
CREATE INDEX idx_behaviors_product ON user_behaviors(product_id);
CREATE INDEX idx_behaviors_created ON user_behaviors(created_at DESC);

-- 推荐结果缓存
CREATE TABLE recommendations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- 推荐类型
    recommendation_type VARCHAR(50) NOT NULL CHECK (recommendation_type IN ('personalized', 'similar', 'trending', 'new_arrivals', 'for_you')),
    
    -- 推荐商品ID列表
    product_ids UUID[] NOT NULL,
    
    -- 算法元数据
    algorithm_version VARCHAR(50),
    confidence_scores DECIMAL(5,4)[],
    
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_recommendations_user ON recommendations(user_id);
CREATE INDEX idx_recommendations_type ON recommendations(recommendation_type);
CREATE INDEX idx_recommendations_expires ON recommendations(expires_at);

-- ============================================
-- 8. 多平台同步
-- ============================================

-- 平台集成配置
CREATE TABLE platform_integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    platform VARCHAR(50) NOT NULL CHECK (platform IN ('douyin', 'xiaohongshu', 'taobao', 'wechat')),
    
    -- API凭证
    app_id VARCHAR(255) NOT NULL,
    app_secret VARCHAR(255) NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMP WITH TIME ZONE,
    
    -- 店铺信息
    shop_id VARCHAR(100),
    shop_name VARCHAR(200),
    
    -- 同步设置
    auto_sync_enabled BOOLEAN DEFAULT false,
    sync_interval_minutes INTEGER DEFAULT 60,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_platforms_name ON platform_integrations(platform);

-- 平台商品映射
CREATE TABLE platform_product_mappings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL CHECK (platform IN ('douyin', 'xiaohongshu', 'taobao', 'wechat')),
    
    platform_product_id VARCHAR(255) NOT NULL,
    platform_product_url TEXT,
    
    -- 同步状态
    sync_status VARCHAR(30) DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'failed', 'needs_update')),
    last_sync_at TIMESTAMP WITH TIME ZONE,
    sync_error TEXT,
    
    -- 平台特定数据
    platform_data JSONB,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(product_id, platform)
);

CREATE INDEX idx_mappings_product ON platform_product_mappings(product_id);
CREATE INDEX idx_mappings_platform ON platform_product_mappings(platform);
CREATE INDEX idx_mappings_status ON platform_product_mappings(sync_status);

-- ============================================
-- 9. 内容管理系统
-- ============================================

-- AI生成内容记录
CREATE TABLE ai_generated_content (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- 关联对象
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    
    -- 内容类型
    content_type VARCHAR(50) NOT NULL CHECK (content_type IN ('product_description', 'social_post', 'video_script', 'seo_meta', 'email_campaign')),
    
    -- 目标平台
    target_platform VARCHAR(50) CHECK (target_platform IN ('douyin', 'xiaohongshu', 'taobao', 'wechat', 'general')),
    
    -- 生成的内容
    title VARCHAR(500),
    content TEXT NOT NULL,
    tags TEXT[],
    
    -- AI元数据
    model_used VARCHAR(100),
    prompt_used TEXT,
    generation_params JSONB,
    
    -- 质量评估
    quality_score DECIMAL(3,2),
    
    -- 使用状态
    status VARCHAR(30) DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'published', 'rejected')),
    approved_by UUID REFERENCES users(id),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ai_content_product ON ai_generated_content(product_id);
CREATE INDEX idx_ai_content_type ON ai_generated_content(content_type);
CREATE INDEX idx_ai_content_status ON ai_generated_content(status);

-- ============================================
-- 10. 数据分析
-- ============================================

-- 每日销售统计
CREATE TABLE daily_sales_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stat_date DATE NOT NULL,
    
    -- 销售数据
    total_orders INTEGER DEFAULT 0,
    total_revenue DECIMAL(12,2) DEFAULT 0,
    total_items_sold INTEGER DEFAULT 0,
    average_order_value DECIMAL(10,2) DEFAULT 0,
    
    -- 用户数据
    new_customers INTEGER DEFAULT 0,
    returning_customers INTEGER DEFAULT 0,
    
    -- 流量数据
    page_views INTEGER DEFAULT 0,
    unique_visitors INTEGER DEFAULT 0,
    conversion_rate DECIMAL(5,4) DEFAULT 0,
    
    -- 按平台统计
    platform_breakdown JSONB, -- {douyin: {orders: 10, revenue: 1000}, ...}
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(stat_date)
);

CREATE INDEX idx_stats_date ON daily_sales_stats(stat_date DESC);

-- ============================================
-- 触发器和函数
-- ============================================

-- 自动更新updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为需要的表添加触发器
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 商品评分自动计算
CREATE OR REPLACE FUNCTION update_product_rating()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE products
    SET 
        rating_average = (
            SELECT COALESCE(AVG(rating), 0)
            FROM reviews
            WHERE product_id = NEW.product_id AND is_visible = true
        ),
        review_count = (
            SELECT COUNT(*)
            FROM reviews
            WHERE product_id = NEW.product_id AND is_visible = true
        )
    WHERE id = NEW.product_id;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_product_rating_after_review
    AFTER INSERT OR UPDATE OR DELETE ON reviews
    FOR EACH ROW EXECUTE FUNCTION update_product_rating();

-- 生成订单号
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
    new_order_number TEXT;
    date_prefix TEXT;
BEGIN
    date_prefix := TO_CHAR(NOW(), 'YYYYMMDD');
    SELECT 'ORD' || date_prefix || LPAD(CAST(COALESCE(MAX(CAST(SUBSTRING(order_number FROM 11) AS INTEGER)), 0) + 1 AS TEXT), 6, '0')
    INTO new_order_number
    FROM orders
    WHERE order_number LIKE 'ORD' || date_prefix || '%';
    
    RETURN new_order_number;
END;
$$ language 'plpgsql';

-- ============================================
-- 初始化数据
-- ============================================

-- 插入默认分类
INSERT INTO categories (name, slug, description, sort_order) VALUES
('戒指', 'rings', '精美手工戒指系列', 1),
('耳环', 'earrings', '独特设计耳环', 2),
('项链', 'necklaces', '优雅项链吊坠', 3),
('手链', 'bracelets', '时尚手链配饰', 4),
('礼盒套装', 'gift-sets', '精美礼品套装', 5)
ON CONFLICT (slug) DO NOTHING;

-- 插入管理员角色（需要配合auth系统）
COMMENT ON TABLE users IS '用户表 - 存储客户和管理员信息';
COMMENT ON TABLE products IS '商品表 - 手作饰品商品信息';
COMMENT ON TABLE orders IS '订单表 - 客户购买订单';
COMMENT ON TABLE reviews IS '评价表 - 商品评价和反馈';
COMMENT ON TABLE coupons IS '优惠券表 - 营销活动优惠券';
COMMENT ON TABLE ai_generated_content IS 'AI内容表 - AI生成的营销内容';
COMMENT ON TABLE platform_product_mappings IS '平台映射表 - 多平台商品同步';
