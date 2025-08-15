import io from 'socket.io-client';
import config from '../config';

let socket = null;
let nativeWs = null;
let subscribers = [];

// 连接到Socket.IO服务器
export const connectSocket = ({ onConnect, onDisconnect, onError }) => {
  // 从配置中获取Socket.IO URL
  const socketUrl = config.SOCKET_URL || 'http://localhost:5001';
  
  // 创建Socket.IO连接
  socket = io(socketUrl);
  
  // 设置事件监听器
  socket.on('connect', () => {
    console.log('已连接到Socket.IO服务器:', socketUrl);
    if (onConnect) onConnect();
  });
  
  socket.on('disconnect', () => {
    console.log('与Socket.IO服务器断开连接');
    if (onDisconnect) onDisconnect();
  });
  
  socket.on('connect_error', (error) => {
    console.error('Socket.IO连接错误:', error);
    if (onError) onError(error);
  });
  
  return socket;
};

// 断开Socket.IO连接
export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

// 订阅地震数据
export const subscribeToEarthquakeData = (callback) => {
  if (!socket) {
    console.error('Socket.IO未连接，无法订阅数据');
    return;
  }
  
  // 添加到订阅者列表
  subscribers.push(callback);
  
  // 设置数据监听器
  socket.on('earthquake-data', (data) => {
    console.log('收到Socket.IO地震数据:', data);
    
    // 确保数据始终有正确格式的振幅值
    let processedData = { ...data };
    
    // 如果振幅是字符串，尝试转换为数字
    if (typeof data.amplitude === 'string') {
      try {
        // 尝试转换为数字
        const numValue = parseFloat(data.amplitude);
        if (!isNaN(numValue)) {
          processedData.amplitude = numValue;
        }
      } catch (error) {
        console.warn('无法将振幅转换为数字:', data.amplitude);
        // 保持原始值
      }
    }
    
    // 通知所有订阅者
    subscribers.forEach(cb => cb(processedData));
  });
};

// 取消订阅地震数据
export const unsubscribeFromEarthquakeData = () => {
  if (socket) {
    socket.off('earthquake-data');
  }
  subscribers = [];
};

// 原生WebSocket相关功能
export const connectNativeWebSocket = ({ onConnect, onDisconnect, onError, onEarthquakeData }) => {
  // 从配置中获取WebSocket URL
  const wsUrl = (config.SOCKET_URL || 'http://localhost:5001').replace(/^http/, 'ws') + '/ws';
  
  console.log('尝试连接到原生WebSocket服务器:', wsUrl);
  
  try {
    // 创建原生WebSocket连接
    nativeWs = new WebSocket(wsUrl);
    
    // 设置事件监听器
    nativeWs.onopen = () => {
      console.log('已连接到原生WebSocket服务器');
      if (onConnect) onConnect();
    };
    
    nativeWs.onclose = () => {
      console.log('与原生WebSocket服务器断开连接');
      if (onDisconnect) onDisconnect();
    };
    
    nativeWs.onerror = (error) => {
      console.error('原生WebSocket连接错误:', error);
      if (onError) onError(error);
    };
    
    nativeWs.onmessage = (event) => {
      try {
        // 首先检查是否是JSON对象
        if (event.data.startsWith('{') || event.data.startsWith('[')) {
          try {
        const data = JSON.parse(event.data);
            console.log('收到原生WebSocket JSON消息:', data);
        
        // 处理地震数据
        if (data.type === 'earthquake-data' && data.payload) {
          console.log('收到原生WebSocket地震数据:', data.payload);
          
          // 处理数据格式
          let processedData = { ...data.payload };
          
          // 如果振幅是字符串，尝试转换为数字
          if (typeof processedData.amplitude === 'string') {
            try {
              // 尝试转换为数字
              const numValue = parseFloat(processedData.amplitude);
              if (!isNaN(numValue)) {
                processedData.amplitude = numValue;
              }
            } catch (error) {
              console.warn('无法将振幅转换为数字:', processedData.amplitude);
              // 保持原始值
            }
          }
          
          if (onEarthquakeData) onEarthquakeData(processedData);
            }
          } catch (parseError) {
            console.error('解析JSON消息失败:', parseError);
          }
        } 
        // 检查是否为逗号分隔的数据点
        else if (event.data.includes(',')) {
          console.log('收到逗号分隔的多数据点:', event.data);
          
          // 解析数据，检查是否有元数据前缀
          let dataPoints;
          let metadata = {};
          let parsedMessage = event.data;
          
          // 检查是否包含元数据格式 (T30H21V100,...)
          if (event.data.match(/^T\d+H\d+V\d+,/)) {
            // 解析元数据部分
            const metaPart = event.data.split(',')[0];
            // 提取温度、湿度和电量信息
            const temperatureMatch = metaPart.match(/T(\d+)/);
            const humidityMatch = metaPart.match(/H(\d+)/);
            const voltageMatch = metaPart.match(/V(\d+)/);
            
            if (temperatureMatch) metadata.temperature = parseInt(temperatureMatch[1]);
            if (humidityMatch) metadata.humidity = parseInt(humidityMatch[1]);
            if (voltageMatch) metadata.voltage = parseInt(voltageMatch[1]);
            
            // 去除元数据部分，得到剩余部分
            parsedMessage = event.data.substring(event.data.indexOf(',') + 1);
            console.log('提取元数据后的消息:', parsedMessage);
          }
          
          // 检查是否包含X标记的波形数据
          if (parsedMessage.startsWith('X')) {
            // 检查是否还有Y和Z标记的数据
            let secondWaveform = null;
            let thirdWaveform = null;
            let firstWaveformPoints = [];
            
            // 检查是否包含Z波形数据
            if (parsedMessage.includes(',Z')) {
              // 数据包含X、Y和Z三种波形
              const parts = parsedMessage.split(',Z');
              // 再分离X和Y部分
              const xyParts = parts[0].split(',Y');
              
              // 处理X部分（去掉X标记）
              firstWaveformPoints = xyParts[0].substring(1).split(',').map(point => point.trim()).filter(point => point.length > 0);
              
              // 处理Y部分
              secondWaveform = xyParts[1].split(',').map(point => point.trim()).filter(point => point.length > 0);
              
              // 处理Z部分
              thirdWaveform = parts[1].split(',').map(point => point.trim()).filter(point => point.length > 0);
              
              metadata.dataType = 'triple-waveform'; // 标记为三波形数据
              metadata.secondWaveform = true; // 标记存在第二个波形
              metadata.thirdWaveform = true; // 标记存在第三个波形
              
              console.log(`解析出三波形数据，X波形${firstWaveformPoints.length}个点，Y波形${secondWaveform.length}个点，Z波形${thirdWaveform.length}个点，元数据:`, metadata);
            }
            else if (parsedMessage.includes(',Y')) {
              // 分离X和Y两组数据
              const parts = parsedMessage.split(',Y');
              // 处理X部分（去掉X标记）
              firstWaveformPoints = parts[0].substring(1).split(',').map(point => point.trim()).filter(point => point.length > 0);
              // 处理Y部分
              secondWaveform = parts[1].split(',').map(point => point.trim()).filter(point => point.length > 0);
              
              metadata.dataType = 'dual-waveform'; // 标记为双波形数据
              metadata.secondWaveform = true; // 标记存在第二个波形
              
              console.log(`解析出双波形数据，X波形${firstWaveformPoints.length}个点，Y波形${secondWaveform.length}个点，元数据:`, metadata);
            } else {
              // 只有X波形数据
              dataPoints = parsedMessage.substring(1).split(',').map(point => point.trim()).filter(point => point.length > 0);
              metadata.dataType = 'waveform'; // 标记为波形数据
              console.log(`解析出波形数据，共${dataPoints.length}个数据点，元数据:`, metadata);
            }
            
            // 当前时间，将作为批次时间戳的基准
            const currentTime = new Date();
            
            // 构建X数据点对象数组（第一组波形）
            const xDataPoints = firstWaveformPoints.map((point, index) => {
              // 尝试解析数值
              const amplitude = parseFloat(point);
              if (isNaN(amplitude)) {
                console.warn(`无法解析数据点 "${point}" 为数字`);
                return null;
              }
              
              // 考虑到数据是按批次收集和发送的，使索引反向计算时间
              // 这样第一个数据点会是最早的，最后一个是最新的
              const pointTime = new Date(currentTime.getTime() - (firstWaveformPoints.length - 1 - index) * 10);
              
              return {
                amplitude: amplitude,
                timestamp: pointTime,
                metadata: {
                  source: 'external',
                  raw: true,
                  batchIndex: index,
                  batchSize: firstWaveformPoints.length,
                  waveformType: 'X', // 标记为X波形
                  ...metadata // 添加解析的元数据
                }
              };
            }).filter(point => point !== null); // 过滤掉无法解析的点
            
            // 合并所有数据点
            let allProcessedPoints = [...xDataPoints];
            
            // 如果有Y波形数据，构建Y数据点对象数组
            if (secondWaveform) {
              const yDataPoints = secondWaveform.map((point, index) => {
                // 尝试解析数值
                const amplitude = parseFloat(point);
                if (isNaN(amplitude)) {
                  console.warn(`无法解析Y数据点 "${point}" 为数字`);
                  return null;
                }
                
                // 使用与X波形相同的时间起点，确保同步
                const pointTime = new Date(currentTime.getTime() - (secondWaveform.length - 1 - index) * 10);
                
                return {
                  amplitude: amplitude,
                  timestamp: pointTime,
                  metadata: {
                    source: 'external',
                    raw: true,
                    batchIndex: index,
                    batchSize: secondWaveform.length,
                    waveformType: 'Y', // 标记为Y波形
                    ...metadata // 添加解析的元数据
                  }
                };
              }).filter(point => point !== null);
              
              // 合并Y数据点
              allProcessedPoints = [...allProcessedPoints, ...yDataPoints];
            }
            
            // 如果有Z波形数据，构建Z数据点对象数组
            if (thirdWaveform) {
              const zDataPoints = thirdWaveform.map((point, index) => {
                // 尝试解析数值
                const amplitude = parseFloat(point);
                if (isNaN(amplitude)) {
                  console.warn(`无法解析Z数据点 "${point}" 为数字`);
                  return null;
                }
                
                // 使用与X波形相同的时间起点，确保同步
                const pointTime = new Date(currentTime.getTime() - (thirdWaveform.length - 1 - index) * 10);
                
                return {
                  amplitude: amplitude,
                  timestamp: pointTime,
                  metadata: {
                    source: 'external',
                    raw: true,
                    batchIndex: index,
                    batchSize: thirdWaveform.length,
                    waveformType: 'Z', // 标记为Z波形
                    ...metadata // 添加解析的元数据
                  }
                };
              }).filter(point => point !== null);
              
              // 合并Z数据点
              allProcessedPoints = [...allProcessedPoints, ...zDataPoints];
            }
            
            // 将整个批次数据点发送给回调
            if (onEarthquakeData && allProcessedPoints.length > 0) {
              onEarthquakeData(allProcessedPoints);
            }
          } else {
            // 常规格式，无特殊标记
            dataPoints = parsedMessage.split(',').map(point => point.trim()).filter(point => point.length > 0);
            console.log(`解析出${dataPoints.length}个数据点`);
            
            // 当前时间，将作为批次时间戳的基准
            const currentTime = new Date();
            
            // 构建数据点对象数组
            const processedDataPoints = dataPoints.map((point, index) => {
              // 尝试解析数值
              const amplitude = parseFloat(point);
              if (isNaN(amplitude)) {
                console.warn(`无法解析数据点 "${point}" 为数字`);
                return null;
              }
              
              // 考虑到数据是按批次收集和发送的，使索引反向计算时间
              // 这样第一个数据点会是最早的，最后一个是最新的
              const pointTime = new Date(currentTime.getTime() - (dataPoints.length - 1 - index) * 10);
              
              return {
                amplitude: amplitude,
                timestamp: pointTime,
                metadata: {
                  source: 'external',
                  raw: true,
                  batchIndex: index,
                  batchSize: dataPoints.length,
                  ...metadata // 添加解析的元数据
                }
              };
            }).filter(point => point !== null); // 过滤掉无法解析的点
            
            // 将整个批次数据点发送给回调
            if (onEarthquakeData && processedDataPoints.length > 0) {
              onEarthquakeData(processedDataPoints);
            }
          }
        }
        // 处理单个数值或字符串
        else {
          console.log('收到原生WebSocket原始消息:', event.data);
          
          // 尝试转换为数字
          const amplitude = parseFloat(event.data);
          if (!isNaN(amplitude)) {
            const data = {
              amplitude: amplitude,
              timestamp: new Date(),
              metadata: {
                source: 'external',
                raw: true
              }
            };
            
            if (onEarthquakeData) onEarthquakeData(data);
          } else {
            console.warn('收到无法解析为数字的WebSocket消息:', event.data);
          }
        }
      } catch (error) {
        console.error('处理WebSocket消息出错:', error);
      }
    };
    
    return nativeWs;
  } catch (error) {
    console.error('创建WebSocket连接失败:', error);
    if (onError) onError(error);
    return null;
  }
};

// 断开原生WebSocket连接
export const disconnectNativeWebSocket = () => {
  if (nativeWs) {
    nativeWs.close();
    nativeWs = null;
  }
};

// 发送地震数据到服务器（Socket.IO）
export const sendEarthquakeData = (data) => {
  if (!socket) {
    console.error('Socket.IO未连接，无法发送数据');
    return false;
  }
  
  socket.emit('earthquake-data', data);
  return true;
};

// 发送地震数据到服务器（原生WebSocket）
export const sendNativeEarthquakeData = (data) => {
  if (!nativeWs || nativeWs.readyState !== WebSocket.OPEN) {
    console.error('原生WebSocket未连接，无法发送数据');
    return false;
  }
  
  // 构建消息
  const message = {
    type: 'earthquake-data',
    payload: data
  };
  
  // 发送JSON数据
  nativeWs.send(JSON.stringify(message));
  return true;
};

// 发送纯文本振幅数据到服务器（原生WebSocket）
export const sendRawAmplitude = (amplitude) => {
  if (!nativeWs || nativeWs.readyState !== WebSocket.OPEN) {
    console.error('原生WebSocket未连接，无法发送数据');
    return false;
  }
  
  // 直接发送原始字符串
  nativeWs.send(amplitude.toString());
  return true;
};

// 发送逗号分隔的多个振幅数据进行测试
export const sendMultipleAmplitudes = (count = 5) => {
  if (!nativeWs || nativeWs.readyState !== WebSocket.OPEN) {
    console.error('原生WebSocket未连接，无法发送数据');
    return false;
  }
  
  // 生成随机数据点
  const dataPoints = [];
  for (let i = 0; i < count; i++) {
    dataPoints.push((Math.random() * 10).toFixed(2));
  }
  
  // 组合成逗号分隔的字符串
  const dataString = dataPoints.join(',');
  console.log(`发送${count}个逗号分隔的数据点:`, dataString);
  
  // 发送数据
  nativeWs.send(dataString);
  return true;
};

// 发送双波形测试数据（X和Y）
export const sendDualWaveformTestData = () => {
  if (!nativeWs || nativeWs.readyState !== WebSocket.OPEN) {
    console.error('原生WebSocket未连接，无法发送数据');
    return false;
  }
  
  // 随机温度、湿度和电压值
  const temperature = Math.floor(Math.random() * 15) + 20; // 20-35度
  const humidity = Math.floor(Math.random() * 40) + 40; // 40-80%
  const voltage = Math.floor(Math.random() * 20) + 75; // 75-95%
  
  // 生成X波形随机数据点
  const xDataPoints = [];
  for (let i = 0; i < 6; i++) {
    xDataPoints.push((Math.random() * 5 + 1).toFixed(2)); // 1.00-6.00范围
  }
  
  // 生成Y波形随机数据点
  const yDataPoints = [];
  for (let i = 0; i < 4; i++) {
    yDataPoints.push((Math.random() * 3 + 0.5).toFixed(2)); // 0.50-3.50范围
  }
  
  // 组合成T/H/V,X...,Y...格式的字符串
  const dataString = `T${temperature}H${humidity}V${voltage},X${xDataPoints.join(',')},Y${yDataPoints.join(',')}`;
  console.log('发送双波形测试数据:', dataString);
  
  // 发送数据
  nativeWs.send(dataString);
  return true;
};

// 发送三波形测试数据（X、Y和Z）
export const sendTripleWaveformTestData = () => {
  if (!nativeWs || nativeWs.readyState !== WebSocket.OPEN) {
    console.error('原生WebSocket未连接，无法发送数据');
    return false;
  }
  
  // 随机温度、湿度和电压值
  const temperature = Math.floor(Math.random() * 15) + 20; // 20-35度
  const humidity = Math.floor(Math.random() * 40) + 40; // 40-80%
  const voltage = Math.floor(Math.random() * 20) + 75; // 75-95%
  
  // 生成X波形随机数据点
  const xDataPoints = [];
  for (let i = 0; i < 6; i++) {
    xDataPoints.push((Math.random() * 5 + 1).toFixed(2)); // 1.00-6.00范围
  }
  
  // 生成Y波形随机数据点
  const yDataPoints = [];
  for (let i = 0; i < 4; i++) {
    yDataPoints.push((Math.random() * 3 + 0.5).toFixed(2)); // 0.50-3.50范围
  }
  
  // 生成Z波形随机数据点
  const zDataPoints = [];
  for (let i = 0; i < 5; i++) {
    zDataPoints.push((Math.random() * 4 + 2).toFixed(2)); // 2.00-6.00范围
  }
  
  // 组合成T/H/V,X...,Y...,Z...格式的字符串
  const dataString = `T${temperature}H${humidity}V${voltage},X${xDataPoints.join(',')},Y${yDataPoints.join(',')},Z${zDataPoints.join(',')}`;
  console.log('发送三波形测试数据:', dataString);
  
  // 发送数据
  nativeWs.send(dataString);
  return true;
};

const socketService = {
  connectSocket,
  subscribeToEarthquakeData,
  unsubscribeFromEarthquakeData,
  disconnectSocket,
  connectNativeWebSocket,
  disconnectNativeWebSocket,
  sendEarthquakeData,
  sendNativeEarthquakeData,
  sendRawAmplitude,
  sendMultipleAmplitudes,
  sendDualWaveformTestData,
  sendTripleWaveformTestData
};

export default socketService; 