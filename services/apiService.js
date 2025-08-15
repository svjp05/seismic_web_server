import axios from 'axios';
import config from '../config';

const API_URL = config.API_URL;

// 获取历史数据
export const getHistoricalData = async (startDate, endDate, waveformType = null, limit = null) => {
  try {
    console.log(`获取历史数据: 起始=${startDate}, 结束=${endDate}${waveformType ? `, 波形类型=${waveformType}` : ''}${limit ? `, 限制=${limit}` : ''}`);
    
    // 验证日期格式
    if (!startDate || !endDate || isNaN(new Date(startDate).getTime()) || isNaN(new Date(endDate).getTime())) {
      throw new Error('无效的日期格式');
    }
    
    const params = { startDate, endDate };
    
    // 只有当waveformType存在且不为空字符串时才添加到参数中
    if (waveformType && waveformType !== '') {
      params.waveformType = waveformType;
    }
    
    // 只有当limit存在时才添加到参数中
    if (limit !== null) {
      params.limit = limit;
    }
    
    const response = await axios.get(`${API_URL}/api/earthquake-data/historical`, { params });
    return response.data;
  } catch (error) {
    console.error('获取历史数据API错误:', error);
    // 提供更详细的错误信息
    if (error.response) {
      // 服务器返回了错误状态码
      console.error('服务器错误状态码:', error.response.status);
      console.error('服务器错误详情:', error.response.data);
      const serverMessage = error.response.data?.error?.message;
      if (serverMessage) {
        throw new Error(`服务器错误: ${serverMessage}`);
      } else if (error.response.status === 500) {
        throw new Error(`服务器内部错误 (500)，请联系管理员。错误ID: ${new Date().getTime()}`);
      }
    }
    // 网络错误或其他错误
    if (error.message) {
      throw new Error(`请求失败: ${error.message}`);
    } else {
      throw new Error('未知错误，请稍后重试');
    }
  }
};

// 获取特定波形类型的历史数据
export const getWaveformHistoricalData = async (waveformType, startDate, endDate, limit = null) => {
  try {
    if (!['X', 'Y', 'Z'].includes(waveformType)) {
      throw new Error('无效的波形类型，必须是 X、Y 或 Z');
    }
    
    console.log(`获取${waveformType}波形历史数据: 起始=${startDate}, 结束=${endDate}${limit ? `, 限制=${limit}` : ''}`);
    
    // 验证日期格式
    if (!startDate || !endDate || isNaN(new Date(startDate).getTime()) || isNaN(new Date(endDate).getTime())) {
      throw new Error('无效的日期格式');
    }
    
    const params = { startDate, endDate };
    
    // 只有当limit存在时才添加到参数中
    if (limit !== null) {
      params.limit = limit;
    }
    
    const response = await axios.get(`${API_URL}/api/earthquake-data/historical/${waveformType}`, { params });
    return response.data;
  } catch (error) {
    console.error(`获取${waveformType}波形历史数据API错误:`, error);
    // 提供更详细的错误信息
    if (error.response) {
      // 服务器返回了错误状态码
      console.error('服务器错误状态码:', error.response.status);
      console.error('服务器错误详情:', error.response.data);
      const serverMessage = error.response.data?.error?.message;
      if (serverMessage) {
        throw new Error(`服务器错误: ${serverMessage}`);
      } else if (error.response.status === 500) {
        throw new Error(`服务器内部错误 (500)，请联系管理员。错误ID: ${new Date().getTime()}`);
      }
    }
    // 网络错误或其他错误
    if (error.message) {
      throw new Error(`请求失败: ${error.message}`);
    } else {
      throw new Error('未知错误，请稍后重试');
    }
  }
};

// 获取最新数据
export const getLatestData = async (limit = 100) => {
  try {
    console.log(`获取最新数据: limit=${limit}`);
    const response = await axios.get(`${API_URL}/api/earthquake-data/latest`, {
      params: { limit }
    });
    return response.data;
  } catch (error) {
    console.error('获取最新数据API错误:', error);
    throw error;
  }
};

// 发送地震数据
export const sendEarthquakeData = async (data) => {
  try {
    const response = await axios.post(`${API_URL}/api/earthquake-data`, data);
    return response.data;
  } catch (error) {
    console.error('发送地震数据API错误:', error);
    throw error;
  }
};

// 获取分析数据（尝试使用真实API，失败时使用模拟数据）
export const getAnalysisData = async (startDate, endDate, analysisType = 'frequency') => {
  try {
    console.log(`获取分析数据: 起始=${startDate}, 结束=${endDate}, 类型=${analysisType}`);

    // 尝试从后端API获取真实分析数据
    try {
      const response = await axios.get(`${API_URL}/api/analysis/data`, {
        params: { startDate, endDate, analysisType }
      });
      console.log(`从API获取分析数据: ${response.data.length}条`);
      return response.data;
    } catch (apiError) {
      console.warn('后端分析API不可用，使用模拟数据:', apiError.message);

      // 备用方案：创建模拟分析数据
      const count = 20;
      const data = Array.from({ length: count }, (_, i) => {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i * Math.ceil((new Date(endDate) - new Date(startDate)) / (count * 24 * 60 * 60 * 1000)));

        let value;

        if (analysisType === 'frequency') {
          value = Math.random() * 5 + 1; // 1-6Hz
        } else if (analysisType === 'amplitude') {
          value = Math.random() * 8 + 1; // 1-9
        } else if (analysisType === 'risk') {
          value = Math.random() * 100; // 0-100%
        }

        return {
          date: date.toISOString(),
          value: parseFloat(value.toFixed(2)),
          type: analysisType
        };
      });

      console.log(`生成模拟分析数据: ${data.length}条`);
      return data;
    }
  } catch (error) {
    console.error('获取分析数据API错误:', error);
    throw error;
  }
};

// 获取统计数据
export const getStatistics = async (period = 'day') => {
  try {
    console.log(`获取统计数据: period=${period}`);
    // 暂时使用模拟数据，因为后端接口尚未实现
    // 创建随机统计数据
    const currentDate = new Date();
    let data;
    
    if (period === 'day') {
      // 过去24小时的数据
      data = Array.from({ length: 24 }, (_, i) => {
        const hour = new Date(currentDate);
        hour.setHours(hour.getHours() - 23 + i);
        return {
          time: hour.toISOString(),
          count: Math.floor(Math.random() * 50),
          avgAmplitude: parseFloat((Math.random() * 5 + 1).toFixed(2)),
          maxAmplitude: parseFloat((Math.random() * 3 + 5).toFixed(2))
        };
      });
    } else if (period === 'week') {
      // 过去7天的数据
      data = Array.from({ length: 7 }, (_, i) => {
        const day = new Date(currentDate);
        day.setDate(day.getDate() - 6 + i);
        return {
          time: day.toISOString(),
          count: Math.floor(Math.random() * 200 + 50),
          avgAmplitude: parseFloat((Math.random() * 4 + 2).toFixed(2)),
          maxAmplitude: parseFloat((Math.random() * 4 + 6).toFixed(2))
        };
      });
    } else {
      // 过去30天的数据
      data = Array.from({ length: 30 }, (_, i) => {
        const day = new Date(currentDate);
        day.setDate(day.getDate() - 29 + i);
        return {
          time: day.toISOString(),
          count: Math.floor(Math.random() * 500 + 100),
          avgAmplitude: parseFloat((Math.random() * 3 + 3).toFixed(2)),
          maxAmplitude: parseFloat((Math.random() * 5 + 7).toFixed(2))
        };
      });
    }
    
    console.log(`生成统计数据: ${data.length}条`);
    return data;
  } catch (error) {
    console.error('获取统计数据API错误:', error);
    throw error;
  }
};

// 生成测试数据
export const generateTestData = async (count, days) => {
  try {
    console.log(`生成测试数据: count=${count}, days=${days}`);
    const response = await axios.post(`${API_URL}/api/generate-test-data`, {
      count, days
    });
    return response.data;
  } catch (error) {
    console.error('生成测试数据API错误:', error);
    throw error;
  }
};

// 获取数据生成器状态
export const getGeneratorStatus = async () => {
  try {
    const response = await axios.get(`${API_URL}/api/generator/status`);
    return response.data;
  } catch (error) {
    console.error('获取生成器状态API错误:', error);
    throw error;
  }
};

// 控制数据生成器
export const controlGenerator = async (action) => {
  try {
    const endpoint = action === 'start' ? 'start' : 'stop';
    const response = await axios.post(`${API_URL}/api/generator/${endpoint}`);
    return response.data;
  } catch (error) {
    console.error(`${action}生成器API错误:`, error);
    throw error;
  }
};

const apiService = {
  getHistoricalData,
  getWaveformHistoricalData,
  getLatestData,
  sendEarthquakeData,
  getAnalysisData,
  getStatistics,
  generateTestData,
  getGeneratorStatus,
  controlGenerator
};

export default apiService;