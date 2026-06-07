/**
 * 文心一言 (ERNIE-4.0-Vision) 图片分析 Provider
 * 使用百度千帆大模型平台 API
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const QIANFAN_BASE = 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop';

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

class WenxinProvider {
  constructor() {
    this.accessKey = process.env.QIANFAN_ACCESS_KEY;
    this.secretKey = process.env.QIANFAN_SECRET_KEY;
    this.name = '文心一言';
    this.available = !!(this.accessKey && this.secretKey &&
      this.accessKey !== 'your-baidu-access-key' &&
      this.secretKey !== 'your-baidu-secret-key');
    this._accessToken = null;
    this._tokenExpires = 0;
  }

  /**
   * 获取百度 Access Token（缓存至过期）
   */
  async getAccessToken() {
    if (this._accessToken && Date.now() < this._tokenExpires) {
      return this._accessToken;
    }

    const response = await axios.post(
      'https://aip.baidubce.com/oauth/2.0/token',
      null,
      {
        params: {
          grant_type: 'client_credentials',
          client_id: this.accessKey,
          client_secret: this.secretKey
        },
        timeout: 10000
      }
    );

    this._accessToken = response.data.access_token;
    // 提前 5 分钟过期
    this._tokenExpires = Date.now() + (response.data.expires_in - 300) * 1000;
    return this._accessToken;
  }

  async analyzeImage(imagePath, filename) {
    if (!this.available) {
      throw new Error('文心一言 API Key 未配置');
    }

    const accessToken = await this.getAccessToken();

    // 读取图片并转 Base64
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');

    // ERNIE-4.0-8K-Vision
    const response = await axios.post(
      `${QIANFAN_BASE}/ernie-4.0-8k-vision/access_token`,
      {
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: JEWELRY_ANALYSIS_PROMPT },
              { type: 'image', image: base64Image }
            ]
          }
        ],
        temperature: 0.3,
        max_output_tokens: 1000
      },
      {
        params: { access_token: accessToken },
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
      }
    );

    const content = response.data?.result;
    if (!content) {
      throw new Error('文心一言返回内容为空');
    }

    // 复用 qwen 的 JSON 解析
    const { parseAIResponse } = require('./qwen');
    return parseAIResponse(content);
  }
}

module.exports = { WenxinProvider };
