// 增强AI服务 - 基于OpenAI API的智能分析系统
import axios from 'axios';
import config from '../config';

class EnhancedAIService {
  constructor() {
    this.apiClient = axios.create({
      baseURL: config.API_URL,
      timeout: 60000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // 对话历史管理
    this.conversationHistory = [];
    this.maxHistoryLength = 20;
    
    // 地震学知识库
    this.seismicKnowledge = this.initializeSeismicKnowledge();
    
    // 上下文管理
    this.currentContext = {
      analysisResults: null,
      dateRange: null,
      lastAnalysisType: null
    };
  }

  // 初始化地震学知识库
  initializeSeismicKnowledge() {
    return {
      terminology: {
        'PGA': '峰值地面加速度(Peak Ground Acceleration) - 地震过程中地面加速度的最大值，是评估地震强度的重要指标',
        'PGV': '峰值地面速度(Peak Ground Velocity) - 地震过程中地面速度的最大值，与建筑物损害密切相关',
        'PGD': '峰值地面位移(Peak Ground Displacement) - 地震过程中地面位移的最大值，反映地震的破坏潜力',
        '地震烈度': '描述地震对地表和建筑物影响程度的量度，通常用修正麦卡利烈度表示',
        '主频': '地震波能量最集中的频率，通常反映震源特性和传播路径',
        'Arias强度': '地震动能量的积分指标，反映地震的总能量释放',
        '反应谱': '单自由度系统在地震作用下的最大响应，是抗震设计的重要参数'
      },
      
      analysisGuidelines: {
        'frequency': {
          'low': '0.1-1Hz: 通常与远震、深部构造活动或环境噪声相关',
          'medium': '1-10Hz: 典型的近震频率范围，包含大部分地震能量',
          'high': '10-50Hz: 近距离小震或人为活动，如爆破、交通'
        },
        
        'amplitude': {
          'micro': '<0.1m/s²: 微震级别，通常为背景噪声',
          'small': '0.1-1m/s²: 小震，可能感受到轻微震动',
          'moderate': '1-5m/s²: 中等地震，会造成明显震感',
          'strong': '>5m/s²: 强震，可能造成建筑物损害'
        },
        
        'duration': {
          'short': '<10秒: 通常为人为活动或设备干扰',
          'medium': '10-60秒: 典型的地震持续时间',
          'long': '>60秒: 大震或远震的长周期波'
        }
      }
    };
  }

  // 更新上下文信息
  updateContext(context) {
    this.currentContext = {
      ...this.currentContext,
      ...context
    };
  }

  // 去除Markdown格式
  removeMarkdownFormat(text) {
    if (!text) return text;

    return text
      // 移除标题标记 (# ## ### 等)
      .replace(/^#{1,6}\s+/gm, '')

      // 移除粗体标记 (**text** 或 __text__)
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/__(.*?)__/g, '$1')

      // 移除斜体标记 (*text* 或 _text_)
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/_(.*?)_/g, '$1')

      // 移除代码块标记 (```code```)
      .replace(/```[\s\S]*?```/g, (match) => {
        return match.replace(/```\w*\n?/g, '').replace(/```/g, '');
      })

      // 移除行内代码标记 (`code`)
      .replace(/`(.*?)`/g, '$1')

      // 移除链接标记 [text](url)
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')

      // 移除列表标记 (- * +)
      .replace(/^[\s]*[-\*\+]\s+/gm, '• ')

      // 移除有序列表标记 (1. 2. 等)
      .replace(/^[\s]*\d+\.\s+/gm, '• ')

      // 移除引用标记 (>)
      .replace(/^>\s+/gm, '')

      // 移除水平分割线 (--- 或 ***)
      .replace(/^[-\*]{3,}$/gm, '')

      // 清理多余的空行
      .replace(/\n{3,}/g, '\n\n')

      // 清理首尾空白
      .trim();
  }

  // 获取智能AI响应
  async getIntelligentResponse(prompt, context = {}) {
    try {
      // 更新当前上下文
      this.updateContext(context);

      // 构建增强的提示词，并添加格式要求
      const enhancedPrompt = this.buildEnhancedPrompt(prompt, context) +
        '\n\n请用简洁的纯文本格式回答，不要使用Markdown格式标记。';

      // 优先尝试调用智谱AI API
      try {
        console.log('调用智谱AI API...');
        const response = await this.apiClient.post('/api/ai-analysis/query', {
          prompt: enhancedPrompt,
          context: {
            analysisResults: context.analysisResults,
            predictResults: context.predictResults,
            basicResults: context.basicResults,
            professionalResults: context.professionalResults
          }
        });

        let aiResponse = response.data;

        // 去除Markdown格式
        aiResponse = this.removeMarkdownFormat(aiResponse);

        this.addToHistory('user', prompt);
        this.addToHistory('assistant', aiResponse);

        console.log('智谱AI响应成功');
        return aiResponse;
      } catch (apiError) {
        console.warn('智谱AI API调用失败，使用增强的本地响应', apiError);

        // 如果智谱AI失败，回退到增强的本地响应
        const localResponse = this.getEnhancedLocalResponse(prompt, context);
        this.addToHistory('user', prompt);
        this.addToHistory('assistant', localResponse);

        return localResponse;
      }
    } catch (error) {
      console.error('获取AI响应失败:', error);
      throw new Error('AI服务暂时不可用，请稍后重试');
    }
  }

  // 构建增强的提示词
  buildEnhancedPrompt(prompt, context) {
    let enhancedPrompt = prompt;

    // 添加地震学专业背景
    enhancedPrompt += `\n\n【专业背景】我是地震监测系统的用户，需要专业的地震学解释和建议。`;

    // 添加分析结果上下文
    if (context.analysisResults) {
      enhancedPrompt += `\n\n【当前分析数据】`;

      // 专业分析结果
      if (context.analysisResults.pga) {
        enhancedPrompt += `\n- PGA (峰值地面加速度): ${context.analysisResults.pga.pga} m/s²`;
      }

      if (context.analysisResults.pgv) {
        enhancedPrompt += `\n- PGV (峰值地面速度): ${context.analysisResults.pgv.pgv} m/s`;
      }

      if (context.analysisResults.pgd) {
        enhancedPrompt += `\n- PGD (峰值地面位移): ${context.analysisResults.pgd.pgd} m`;
      }

      if (context.analysisResults.frequency) {
        enhancedPrompt += `\n- 主频: ${context.analysisResults.frequency.dominantFreq} Hz`;
      }

      if (context.analysisResults.intensity) {
        enhancedPrompt += `\n- 地震烈度: ${context.analysisResults.intensity.description}`;
      }

      if (context.analysisResults.duration) {
        enhancedPrompt += `\n- 持续时间: ${context.analysisResults.duration.duration} 秒`;
      }

      if (context.analysisResults.ariasIntensity) {
        enhancedPrompt += `\n- Arias强度: ${context.analysisResults.ariasIntensity}`;
      }
    }

    // 添加基础分析结果
    if (context.basicResults) {
      enhancedPrompt += `\n\n【基础分析结果】`;
      if (context.basicResults.statistics) {
        enhancedPrompt += `\n- 平均幅度: ${context.basicResults.statistics.averageAmplitude} m/s²`;
        enhancedPrompt += `\n- 最大幅度: ${context.basicResults.statistics.maxAmplitude} m/s²`;
        enhancedPrompt += `\n- 数据点数: ${context.basicResults.statistics.dataPointCount}`;
      }
    }

    // 添加专业分析结果
    if (context.professionalResults && context.professionalResults.seismicAnalysis) {
      enhancedPrompt += `\n\n【专业地震学分析】`;
      const seismic = context.professionalResults.seismicAnalysis;

      if (seismic.statistics) {
        enhancedPrompt += `\n- 统计信息: 均值=${seismic.statistics.mean}, 标准差=${seismic.statistics.std}, 最大值=${seismic.statistics.max}`;
      }
    }

    // 添加预测结果上下文
    if (context.predictions) {
      enhancedPrompt += `\n\n【趋势预测结果】`;

      if (context.predictions.nextEvent) {
        enhancedPrompt += `\n- 下一个可能事件: ${context.predictions.nextEvent.type}`;
        enhancedPrompt += `\n- 预测时间: ${context.predictions.nextEvent.prediction}`;
        enhancedPrompt += `\n- 置信度: ${context.predictions.nextEvent.confidence}%`;
        enhancedPrompt += `\n- 发生概率: ${context.predictions.nextEvent.probability}`;
      }

      if (context.predictions.trend) {
        enhancedPrompt += `\n- 趋势分析: ${context.predictions.trend}`;
      }

      if (context.predictions.modelType) {
        enhancedPrompt += `\n- 预测模型: ${context.predictions.modelType.toUpperCase()}`;
      }

      if (context.predictions.confidence) {
        enhancedPrompt += `\n- 整体可信度: ${context.predictions.confidence.overall}%`;
      }
    }

    // 添加时间范围信息
    if (context.dateRange) {
      enhancedPrompt += `\n\n【分析时间范围】${context.dateRange.start} 至 ${context.dateRange.end}`;
    }

    enhancedPrompt += `\n\n请基于以上数据，用专业但易懂的语言回答我的问题。`;

    return enhancedPrompt;
  }

  // 构建对话消息
  buildConversationMessages(prompt) {
    const messages = [
      {
        role: 'system',
        content: `你是一个专业的地震学AI助手，具有以下能力：
1. 解读地震波数据和分析结果
2. 解释专业地震学术语和概念
3. 提供基于科学的分析建议
4. 识别数据中的模式和异常

请用专业但易懂的语言回答问题，并在适当时引用具体的分析数据。`
      }
    ];
    
    // 添加最近的对话历史
    const recentHistory = this.conversationHistory.slice(-6); // 最近3轮对话
    messages.push(...recentHistory);
    
    // 添加当前问题
    messages.push({
      role: 'user',
      content: prompt
    });
    
    return messages;
  }

  // 增强的本地响应
  getEnhancedLocalResponse(prompt, context) {
    const lowercasePrompt = prompt.toLowerCase();
    
    // 检查是否询问专业术语
    for (const [term, definition] of Object.entries(this.seismicKnowledge.terminology)) {
      if (lowercasePrompt.includes(term.toLowerCase())) {
        return `关于${term}：\n\n${definition}\n\n${this.getContextualExplanation(term, context)}`;
      }
    }
    
    // 基于当前分析结果的智能响应
    if (context.analysisResults) {
      return this.generateContextualResponse(prompt, context.analysisResults);
    }
    
    // 通用地震学问题
    return this.getGeneralSeismicResponse(prompt);
  }

  // 获取上下文相关的解释
  getContextualExplanation(term, context) {
    if (!context.analysisResults) return '';
    
    const results = context.analysisResults;
    
    switch (term) {
      case 'PGA':
        if (results.pga) {
          const pga = results.pga.pga;
          let interpretation = '';
          if (pga < 0.1) interpretation = '当前PGA值较低，表示震动强度很小';
          else if (pga < 1) interpretation = '当前PGA值处于中等水平，可能有轻微震感';
          else interpretation = '当前PGA值较高，表示震动强度较大';
          
          return `在您当前的分析中，PGA值为${pga} m/s²。${interpretation}。`;
        }
        break;
        
      case '主频':
        if (results.frequency) {
          const freq = results.frequency.dominantFreq;
          let interpretation = '';
          if (freq < 1) interpretation = '低频信号，可能来自远震或深部活动';
          else if (freq < 10) interpretation = '中频信号，典型的地震频率范围';
          else interpretation = '高频信号，可能来自近距离活动';
          
          return `在您当前的分析中，主频为${freq} Hz。${interpretation}。`;
        }
        break;
    }
    
    return '';
  }

  // 生成基于上下文的响应
  generateContextualResponse(prompt, results) {
    const lowercasePrompt = prompt.toLowerCase();
    
    // 询问当前分析结果
    if (lowercasePrompt.includes('当前') || lowercasePrompt.includes('这次') || lowercasePrompt.includes('分析结果')) {
      return this.summarizeCurrentResults(results);
    }
    
    // 询问风险评估
    if (lowercasePrompt.includes('风险') || lowercasePrompt.includes('危险') || lowercasePrompt.includes('安全')) {
      return this.assessRisk(results);
    }
    
    // 询问建议
    if (lowercasePrompt.includes('建议') || lowercasePrompt.includes('应该') || lowercasePrompt.includes('怎么办')) {
      return this.provideRecommendations(results);
    }
    
    return '请告诉我您想了解分析结果的哪个方面，我可以为您详细解释。';
  }

  // 总结当前分析结果
  summarizeCurrentResults(results) {
    let summary = '基于当前的分析结果：\n\n';
    
    if (results.pga) {
      summary += `🔸 峰值地面加速度(PGA): ${results.pga.pga} m/s²\n`;
    }
    
    if (results.pgv) {
      summary += `🔸 峰值地面速度(PGV): ${results.pgv.pgv} m/s\n`;
    }
    
    if (results.intensity) {
      summary += `🔸 地震烈度: ${results.intensity.description}\n`;
    }
    
    if (results.frequency) {
      summary += `🔸 主频: ${results.frequency.dominantFreq} Hz\n`;
    }
    
    if (results.duration) {
      summary += `🔸 持续时间: ${results.duration.duration} 秒\n`;
    }
    
    summary += '\n这些指标表明' + this.interpretOverallResults(results);
    
    return summary;
  }

  // 解释整体结果
  interpretOverallResults(results) {
    if (results.pga && results.pga.pga > 2) {
      return '检测到较强的地震活动，建议密切关注后续发展。';
    } else if (results.frequency && results.frequency.dominantFreq < 1) {
      return '主要为低频信号，可能与远距离地震活动或深部构造运动相关。';
    } else {
      return '整体活动水平正常，未发现异常的地震信号。';
    }
  }

  // 风险评估
  assessRisk(results) {
    let riskLevel = '低';
    let riskFactors = [];
    
    if (results.pga && results.pga.pga > 1) {
      riskLevel = '中';
      riskFactors.push('PGA值偏高');
    }
    
    if (results.intensity && results.intensity.severity === 'strong') {
      riskLevel = '高';
      riskFactors.push('地震烈度较高');
    }
    
    if (results.duration && results.duration.duration > 30) {
      riskFactors.push('持续时间较长');
    }
    
    let assessment = `当前风险等级：${riskLevel}\n\n`;
    
    if (riskFactors.length > 0) {
      assessment += `风险因素：${riskFactors.join('、')}\n\n`;
    }
    
    assessment += this.getRiskRecommendations(riskLevel);
    
    return assessment;
  }

  // 获取风险建议
  getRiskRecommendations(riskLevel) {
    switch (riskLevel) {
      case '高':
        return '建议：\n• 加强监测频率\n• 检查设备状态\n• 准备应急预案\n• 与相关部门保持联系';
      case '中':
        return '建议：\n• 继续密切监测\n• 检查数据质量\n• 关注后续发展\n• 做好记录工作';
      default:
        return '建议：\n• 保持常规监测\n• 定期数据备份\n• 设备维护检查';
    }
  }

  // 提供专业建议
  provideRecommendations(results) {
    let recommendations = '基于当前分析结果，我建议：\n\n';
    
    recommendations += '📊 **数据分析方面：**\n';
    recommendations += '• 进行更详细的频谱分析\n';
    recommendations += '• 对比历史数据寻找模式\n';
    recommendations += '• 检查数据质量和完整性\n\n';
    
    recommendations += '🔧 **技术改进方面：**\n';
    recommendations += '• 优化采样频率设置\n';
    recommendations += '• 校准传感器设备\n';
    recommendations += '• 增强数据滤波处理\n\n';
    
    recommendations += '📈 **监测策略方面：**\n';
    recommendations += '• 建立自动预警系统\n';
    recommendations += '• 增加多点监测对比\n';
    recommendations += '• 定期生成分析报告';
    
    return recommendations;
  }

  // 通用地震学响应
  getGeneralSeismicResponse(prompt) {
    // 这里可以添加更多通用的地震学问题响应
    return '我是您的地震学AI助手。请告诉我您想了解的具体问题，比如分析结果解读、专业术语解释、或者技术建议等。';
  }

  // 添加到对话历史
  addToHistory(role, content) {
    this.conversationHistory.push({ role, content });
    
    // 保持历史长度限制
    if (this.conversationHistory.length > this.maxHistoryLength) {
      this.conversationHistory = this.conversationHistory.slice(-this.maxHistoryLength);
    }
  }

  // 清空对话历史
  clearHistory() {
    this.conversationHistory = [];
  }

  // 生成智能问题建议
  generateSmartSuggestions(context = {}) {
    const suggestions = [];

    // 基于预测结果生成建议
    if (context.predictions) {
      const predictions = context.predictions;

      if (predictions.nextEvent) {
        suggestions.push(`预测的${predictions.nextEvent.type}可能性有多大？`);
        suggestions.push(`${predictions.nextEvent.confidence}%的置信度意味着什么？`);
      }

      if (predictions.modelType) {
        suggestions.push(`${predictions.modelType.toUpperCase()}模型的预测准确性如何？`);
      }

      suggestions.push('这个趋势预测结果可靠吗？');
      suggestions.push('基于预测结果应该采取什么措施？');
    }

    // 基于当前上下文生成建议
    if (context.analysisResults) {
      const results = context.analysisResults;

      if (results.pga) {
        suggestions.push(`PGA值${results.pga.pga} m/s²意味着什么？`);
      }

      if (results.frequency) {
        suggestions.push(`为什么主频是${results.frequency.dominantFreq} Hz？`);
      }

      if (results.intensity) {
        suggestions.push('这个地震烈度等级有什么影响？');
      }

      suggestions.push('当前分析结果的风险评估如何？');
      suggestions.push('基于这些数据有什么建议？');
    }

    // 如果没有具体数据，提供默认建议
    if (suggestions.length === 0) {
      suggestions.push('PGA/PGV/PGD指标如何解读？');
      suggestions.push('如何判断地震信号的真实性？');
      suggestions.push('什么是地震烈度？');
      suggestions.push('时间序列预测的原理是什么？');
      suggestions.push('如何优化地震监测系统？');
      suggestions.push('地震预警的原理是什么？');
    }

    return suggestions.slice(0, 5); // 返回最多5个建议
  }
}

// 创建单例实例
const enhancedAIService = new EnhancedAIService();

export default enhancedAIService;
