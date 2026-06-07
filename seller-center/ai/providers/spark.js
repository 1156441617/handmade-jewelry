/**
 * 讯飞星火 (Spark-4-Vision) 图片分析 Provider
 * 使用讯飞开放平台 HTTP API
 */

const axios = require('axios');
const fs = require('fs');
const crypto = require('crypto');

const SPARK_BASE = 'https://spark-api-open.xf-yun.com/v1';

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

class SparkProvider {
  constructor() {
    this.appId = process.env.SPARK_APP_ID;
    this.apiKey = process.env.SPARK_API_KEY;
    this.apiSecret = process.env.SPARK_API_SECRET;
    this.name = '讯飞星火';
    this.available = !!(this.appId && this.apiKey && this.apiSecret &&
      this.appId !== 'your-spark-app-id' &&
      this.apiKey !== 'your-spark-api-key' &&
      this.apiSecret !== 'your-spark-api-secret');
  }

  /**
   * 生成讯飞鉴权签名
   */
  generateAuthHeader() {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signatureOrigin = `host: spark-api-open.xf-yun.com\ndate: ${timestamp}\nGET /v1/chat/completions HTTP/1.1`;
    const signatureSha = crypto.createHmac('sha256', this.apiSecret).update(signatureOrigin).digest('base64');
    const authorizationOrigin = `api_key="${this.apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signatureSha}"`;
    const authorization = Buffer.from(authorizationOrigin).toString('base64');

    return {
      'Authorization': authorization,
      'Date': timestamp
    };
  }

  async analyzeImage(imagePath, filename) {
    if (!this.available) {
      throw new Error('讯飞星火 API Key 未配置');
    }

    // 读取图片并转 Base64
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    const ext = filename.toLowerCase().split('.').pop() || 'jpg';
    const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

    const authHeaders = this.generateAuthHeader();

    const response = await axios.post(
      `${SPARK_BASE}/chat/completions`,
      {
        model: '4vPlus',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: JEWELRY_ANALYSIS_PROMPT },
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Image}` } }
            ]
          }
        ],
        temperature: 0.3,
        max_tokens: 1000
      },
      {
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders
        },
        timeout: 30000
      }
    );

    const content = response.data?.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('讯飞星火返回内容为空');
    }

    const { parseAIResponse } = require('./qwen');
    return parseAIResponse(content);
  }
}

module.exports = { SparkProvider };
