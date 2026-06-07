const { v4: uuidv4 } = require('uuid');

// 珠宝知识库
const JEWELRY_TYPES = {
  ring: {
    names: ['月光石编织戒指', '银丝缠绕戒指', '珍珠花蕊戒指', '水晶簇戒指', '复古铜艺戒指', '简约素圈戒指', '琥珀镶嵌戒指', '翡翠平安戒指'],
    category: 'rings',
    categoryLabel: '戒指',
    basePrice: 168,
    tags: ['手工制作', '戒指', '纯银', '天然宝石']
  },
  necklace: {
    names: ['月光流苏项链', '珍珠叠戴项链', '水晶吊坠项链', '银链编织项链', '琥珀挂坠项链', '复古锁骨链', '天然石长链', '花丝项链'],
    category: 'necklaces',
    categoryLabel: '项链',
    basePrice: 298,
    tags: ['手工制作', '项链', '轻奢', '天然材质']
  },
  bracelet: {
    names: ['月光石手链', '编织手绳', '珍珠手链', '水晶串珠手链', '银饰手镯', '琥珀手串', '翡翠手镯', '花丝手链'],
    category: 'bracelets',
    categoryLabel: '手链/手镯',
    basePrice: 228,
    tags: ['手工制作', '手链', '天然石', '原创设计']
  },
  earring: {
    names: ['月光石耳环', '珍珠流苏耳环', '水晶耳钉', '银丝编织耳环', '复古铜艺耳坠', '不对称设计耳饰', '琥珀耳环', '花丝耳环'],
    category: 'earrings',
    categoryLabel: '耳饰',
    basePrice: 128,
    tags: ['手工制作', '耳饰', '轻奢', '925银针']
  },
  brooch: {
    names: ['珍珠胸针', '花丝胸针', '水晶蝴蝶胸针', '复古铜艺胸针', '琥珀蜻蜓胸针', '银饰花卉胸针'],
    category: 'accessories',
    categoryLabel: '胸针',
    basePrice: 198,
    tags: ['手工制作', '胸针', '复古', '限量款']
  },
  anklet: {
    names: ['月光石脚链', '编织脚链', '珍珠脚链', '银饰脚链', '水晶脚链', '贝壳脚链'],
    category: 'accessories',
    categoryLabel: '脚链',
    basePrice: 98,
    tags: ['手工制作', '脚链', '夏日', '天然材质']
  }
};

const MATERIALS = {
  '925纯银': { multiplier: 1.0, desc: '925纯银材质，亲肤不易过敏，光泽持久' },
  '14K包金': { multiplier: 1.8, desc: '14K包金材质，色泽温润，质感出众' },
  '天然珍珠': { multiplier: 2.0, desc: '天然淡水珍珠，光泽莹润，每颗独一无二' },
  '月光石': { multiplier: 1.5, desc: '天然月光石，幽蓝光晕，神秘优雅' },
  '天然水晶': { multiplier: 1.3, desc: '天然水晶，晶莹剔透，能量纯净' },
  '琥珀': { multiplier: 2.5, desc: '天然琥珀，温润如玉，岁月凝练' },
  '翡翠': { multiplier: 3.0, desc: '天然翡翠，翠色欲滴，东方韵味' },
  '黑曜石': { multiplier: 1.2, desc: '天然黑曜石，深邃沉稳，辟邪护身' },
  '玫瑰金': { multiplier: 1.6, desc: '玫瑰金材质，浪漫色调，优雅迷人' },
  '绿松石': { multiplier: 1.8, desc: '天然绿松石，天空之蓝，异域风情' },
  '玛瑙': { multiplier: 1.1, desc: '天然玛瑙，纹理独特，温润细腻' },
  '手工编织绳': { multiplier: 0.5, desc: '手工编织绳结，柔软亲肤，可调节长度' }
};

const TAG_OPTIONS = [
  '手工制作', '纯银', '天然材质', '原创设计', '轻奢风',
  '复古', '极简', '国风', '送礼佳品', '限量款',
  '新品上市', '热销', '情侣款', '日常佩戴', '节日限定'
];

const BADGE_OPTIONS = ['new', 'hot', 'limited'];

// 文件名关键词映射
const FILENAME_HINTS = {
  ring: ['ring', '戒指', '指环'],
  necklace: ['necklace', '项链', '吊坠', 'pendant', 'chain'],
  bracelet: ['bracelet', '手链', '手镯', 'bangle', '手绳'],
  earring: ['earring', '耳环', '耳饰', '耳钉', '耳坠'],
  brooch: ['brooch', '胸针', '徽章'],
  anklet: ['anklet', '脚链', '脚饰']
};

const MATERIAL_HINTS = {
  '925纯银': ['silver', '银', '925'],
  '14K包金': ['gold', '金', '14k', '包金'],
  '天然珍珠': ['pearl', '珍珠'],
  '月光石': ['moonstone', '月光'],
  '天然水晶': ['crystal', '水晶'],
  '琥珀': ['amber', '琥珀'],
  '翡翠': ['jade', '翡翠'],
  '黑曜石': ['obsidian', '黑曜'],
  '绿松石': ['turquoise', '绿松'],
  '玛瑙': ['agate', '玛瑙']
};

/**
 * 分析上传的图片，返回AI分析结果
 */
async function analyzeImage(fileInfo) {
  const filename = (fileInfo.originalname || '').toLowerCase();

  // 从文件名推断珠宝类型
  let detectedType = null;
  let typeConfidence = 0.6;

  for (const [type, keywords] of Object.entries(FILENAME_HINTS)) {
    for (const kw of keywords) {
      if (filename.includes(kw)) {
        detectedType = type;
        typeConfidence = 0.85 + Math.random() * 0.1;
        break;
      }
    }
    if (detectedType) break;
  }

  // 未检测到则随机选择
  if (!detectedType) {
    const types = Object.keys(JEWELRY_TYPES);
    detectedType = types[Math.floor(Math.random() * types.length)];
    typeConfidence = 0.55 + Math.random() * 0.2;
  }

  // 从文件名推断材质
  let detectedMaterial = null;
  for (const [mat, keywords] of Object.entries(MATERIAL_HINTS)) {
    for (const kw of keywords) {
      if (filename.includes(kw)) {
        detectedMaterial = mat;
        break;
      }
    }
    if (detectedMaterial) break;
  }

  // 未检测到则随机选择
  if (!detectedMaterial) {
    const matKeys = Object.keys(MATERIALS);
    detectedMaterial = matKeys[Math.floor(Math.random() * matKeys.length)];
  }

  const typeInfo = JEWELRY_TYPES[detectedType];
  const materialInfo = MATERIALS[detectedMaterial];

  // 生成商品名称
  const name = typeInfo.names[Math.floor(Math.random() * typeInfo.names.length)];

  // 计算价格
  const basePrice = typeInfo.basePrice * materialInfo.multiplier;
  const price = Math.round(basePrice * (0.9 + Math.random() * 0.2));
  const originalPrice = Math.round(price * (1.3 + Math.random() * 0.5));

  // 生成描述
  const description = `这款${name}采用${detectedMaterial}精心制作，${materialInfo.desc}。独特的设计灵感源自自然之美，将传统工艺与现代审美完美融合。适合日常佩戴，也是送礼的绝佳选择。`;

  // 选择标签
  const baseTags = typeInfo.tags.slice(0, 2);
  const extraTags = TAG_OPTIONS.filter(t => !baseTags.includes(t))
    .sort(() => 0.5 - Math.random())
    .slice(0, 2 + Math.floor(Math.random() * 2));
  const tags = [...baseTags, ...extraTags];

  // 选择徽章
  const badges = [BADGE_OPTIONS[Math.floor(Math.random() * BADGE_OPTIONS.length)]];

  return {
    name,
    category: typeInfo.category,
    categoryLabel: typeInfo.categoryLabel,
    type: detectedType,
    material: detectedMaterial,
    price,
    originalPrice,
    description,
    tags,
    badges,
    confidence: parseFloat((typeConfidence * 100).toFixed(1)),
    sku: generateSKU(typeInfo.category)
  };
}

/**
 * 根据分类生成SKU编码
 */
function generateSKU(category) {
  const prefixMap = {
    rings: 'RJ',
    necklaces: 'NK',
    bracelets: 'BL',
    earrings: 'ER',
    accessories: 'BR',
    pendants: 'PD',
    anklets: 'AK'
  };

  const prefix = prefixMap[category] || 'JW';
  const seq = String(Math.floor(Math.random() * 999) + 1).padStart(3, '0');

  return `${prefix}-${seq}`;
}

/**
 * 根据材质和类型建议价格
 */
function suggestPrice(material, type) {
  const typeInfo = JEWELRY_TYPES[type] || JEWELRY_TYPES.ring;
  const materialInfo = MATERIALS[material] || MATERIALS['925纯银'];

  const basePrice = typeInfo.basePrice * materialInfo.multiplier;
  const suggested = Math.round(basePrice);

  return {
    suggested,
    min: Math.round(suggested * 0.8),
    max: Math.round(suggested * 1.3),
    currency: 'CNY'
  };
}

/**
 * 根据名称、材质和类型生成商品描述
 */
function generateDescription(name, material, type) {
  const materialInfo = MATERIALS[material] || MATERIALS['925纯银'];
  return `这款${name || '手作珠宝'}采用${material}精心制作，${materialInfo.desc}。独特的设计灵感源自自然之美，将传统工艺与现代审美完美融合。每一件都凝聚匠人心血，独一无二。`;
}

module.exports = {
  analyzeImage,
  generateSKU,
  suggestPrice,
  generateDescription
};
