/**
 * 通义千问 (Qwen-VL) 图片分析 Provider
 * 使用阿里云 DashScope API，OpenAI 兼容格式
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const DASHSCOPE_BASE = 'https://dashscope.aliyuncs.com/compatible-mode/v1';

// 珠宝分析 Prompt
const JEWELRY_ANALYSIS_PROMPT = `你是一位专业的珠宝鉴定师和电商运营专家。请分析这张珠宝/饰品图片，返回严格的 JSON 格式结果。

要求：
1. 仔细观察图片中的珠宝类型、材质、风格
2. 根据图片内容给出合理的商品名称、分类、材质、价格建议
3. 生成适合电商平台的商品描述和标签

返回格式（严格 JSON，不要任何其他文字）：
{
  "name": "商品名称（8-15字，含材质和款式）",
  "category": "分类代码（necklaces/rings/earrings/bracelets/brooch/pendants/anklets/hair-accessory/accessories/other）",
  "categoryLabel": "分类中文名",
  "material": "主要材质",
  "price": 售价（数字，单位元），
  "originalPrice": 原价（数字，比售价高30%-80%），
  "description": "商品描述（50-100字，突出材质、工艺、风格）",
  "tags": ["标签1", "标签2", "标签3", "标签4"],
  "confidence": 置信度（0-100的数字）
}

分类代码对照：
- necklaces=项链, rings=戒指, earrings=耳饰, bracelets=手链/手镯
- brooch=胸针, pendants=吊坠, anklets=脚链
- hair-accessory=发饰, accessories=配饰, other=其他

注意：只返回 JSON，不要 markdown 代码块，不要解释文字。`;

class QwenProvider {
  constructor() {
    this.apiKey = process.env.DASHSCOPE_API_KEY;
    this.model = 'qwen-vl-plus';
    this.name = '通义千问';
    this.available = !!this.apiKey && this.apiKey !== 'sk-your-dashscope-api-key';
  }

  async analyzeImage(imagePath, filename) {
    if (!this.available) {
      throw new Error('通义千问 API Key 未配置');
    }

    // 读取图片并转 Base64
    const imageBuffer = fs.readFileSync(imagePath);
    const ext = path.extname(filename).toLowerCase().replace('.', '') || 'jpg';
    const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    const base64Image = `data:${mimeType};base64,${imageBuffer.toString('base64')}`;

    const response = await axios.post(
      `${DASHSCOPE_BASE}/chat/completions`,
      {
        model: this.model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: base64Image } },
              { type: 'text', text: JEWELRY_ANALYSIS_PROMPT }
            ]
          }
        ],
        temperature: 0.3,
        max_tokens: 1000
      },
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    const content = response.data?.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('通义千问返回内容为空');
    }

    return parseAIResponse(content);
  }
}

/**
 * 解析 AI 返回的 JSON（兼容 markdown 代码块包裹）
 */
function parseAIResponse(content) {
  // 去除 markdown 代码块
  let jsonStr = content.trim();
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  try {
    const data = JSON.parse(jsonStr);

    // 确保必要字段存在
    return {
      name: data.name || '未命名珠宝',
      category: data.category || 'other',
      categoryLabel: data.categoryLabel || '其他',
      material: data.material || '',
      price: Number(data.price) || 0,
      originalPrice: Number(data.originalPrice) || 0,
      description: data.description || '',
      tags: Array.isArray(data.tags) ? data.tags : [],
      confidence: Number(data.confidence) || 80
    };
  } catch (e) {
    throw new Error(`AI 返回格式解析失败: ${e.message}, 原始内容: ${jsonStr.substring(0, 200)}`);
  }
}

module.exports = { QwenProvider, parseAIResponse };
