/**
 * AI Provider 适配层
 * 统一接口，多模型切换，自动降级
 */

const { QwenProvider } = require('./providers/qwen');
const { WenxinProvider } = require('./providers/wenxin');
const { SparkProvider } = require('./providers/spark');
const localAnalyzer = require('./analyzer');

const PROVIDERS = {
  qwen: () => new QwenProvider(),
  wenxin: () => new WenxinProvider(),
  spark: () => new SparkProvider()
};

const PROVIDER_NAMES = {
  qwen: '通义千问',
  wenxin: '文心一言',
  spark: '讯飞星火',
  local: '本地模拟'
};

class AIProvider {
  constructor() {
    this.providerName = process.env.AI_PROVIDER || 'local';
    this.provider = null;
    this.fallbackUsed = false;
    this.lastError = null;

    if (this.providerName !== 'local' && PROVIDERS[this.providerName]) {
      this.provider = PROVIDERS[this.providerName]();
      if (!this.provider.available) {
        console.warn(`⚠️  AI Provider "${this.providerName}" 不可用（API Key 未配置），将使用本地模拟`);
        this.provider = null;
        this.fallbackUsed = true;
      }
    }
  }

  /**
   * 分析图片
   * @param {object} fileInfo - { filename, originalname, path, size, mimetype }
   * @returns {Promise<object>} 分析结果
   */
  async analyzeImage(fileInfo) {
    // 有真实 Provider 时优先使用
    if (this.provider) {
      try {
        const result = await this.provider.analyzeImage(fileInfo.path, fileInfo.originalname);
        this.fallbackUsed = false;
        this.lastError = null;
        return result;
      } catch (error) {
        console.error(`❌ ${this.provider.name} 分析失败:`, error.message);
        this.lastError = error.message;
        this.fallbackUsed = true;
        console.log('↩️  降级到本地模拟分析...');
      }
    }

    // 降级到本地模拟
    return localAnalyzer.analyzeImage(fileInfo);
  }

  /**
   * 获取当前 AI 状态信息
   */
  getStatus() {
    if (this.providerName === 'local') {
      return {
        provider: 'local',
        name: '本地模拟',
        available: true,
        fallbackUsed: false
      };
    }

    if (this.provider) {
      return {
        provider: this.providerName,
        name: this.provider.name,
        available: true,
        fallbackUsed: this.fallbackUsed,
        lastError: this.lastError
      };
    }

    return {
      provider: this.providerName,
      name: PROVIDER_NAMES[this.providerName] || this.providerName,
      available: false,
      fallbackUsed: true,
      reason: 'API Key 未配置'
    };
  }

  /**
   * 获取所有可用 Provider 列表
   */
  listProviders() {
    const list = [{ id: 'local', name: '本地模拟', available: true }];

    for (const [id, factory] of Object.entries(PROVIDERS)) {
      const instance = factory();
      list.push({
        id,
        name: instance.name,
        available: instance.available
      });
    }

    return list;
  }
}

// 单例
let instance = null;

function getAIProvider() {
  if (!instance) {
    instance = new AIProvider();
  }
  return instance;
}

module.exports = { AIProvider, getAIProvider };
