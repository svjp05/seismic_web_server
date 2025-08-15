/**
 * 串口通信服务
 * 提供与单片机通信的功能
 */

// 处理浏览器兼容性
const serialSupported = () => {
  return 'serial' in navigator;
};

// 读取编码器 - 用于解析串口数据
// 使用 'utf-8' 作为默认编码，但设置 fatal: false 以处理无效字符
const textDecoder = new TextDecoder('utf-8', { fatal: false, ignoreBOM: true });

const serialService = {
  port: null,
  reader: null,
  readLoopPromise: null,
  dataCallback: null,
  errorCallback: null,
  keepReading: false,

  /**
   * 检查是否支持Web Serial API
   */
  isSupported() {
    return serialSupported();
  },

  /**
   * 获取可用的串口列表
   * @returns {Promise<Array>} 串口列表
   */
  async getAvailablePorts() {
    if (!this.isSupported()) {
      console.warn('浏览器不支持Web Serial API');
      return [];
    }

    try {
      const ports = await navigator.serial.getPorts();
      return ports.map((port, index) => ({
        portId: `port_${index}`,
        portName: `串口 ${index + 1}`,
        port: port
      }));
    } catch (error) {
      console.error('获取串口列表失败:', error);
      return [];
    }
  },

  /**
   * 请求选择串口设备
   * @returns {Promise<{success: boolean, port: SerialPort|null, error: string|null}>}
   */
  async requestPort() {
    if (!this.isSupported()) {
      return { success: false, port: null, error: '浏览器不支持Web Serial API' };
    }

    try {
      const port = await navigator.serial.requestPort();
      this.port = port;
      return { success: true, port, error: null };
    } catch (error) {
      console.error('选择串口失败:', error);
      return { success: false, port: null, error: error.message || '选择串口失败' };
    }
  },

  /**
   * 打开串口连接
   * @param {SerialPort} port 串口对象
   * @param {Object} options 串口配置，如波特率等
   * @returns {Promise<{success: boolean, error: string|null}>}
   */
  async openPort(port, options = { baudRate: 115200 }) {
    try {
      this.port = port;
      
      // 默认串口配置，禁用流控制以避免RTS/DTR信号问题
      const defaultOptions = {
        baudRate: 115200,
        dataBits: 8,
        stopBits: 1,
        parity: 'none',
        flowControl: 'none'  // 禁用流控制，避免RTS/DTR被自动控制
      };
      
      // 合并用户配置和默认配置
      const finalOptions = { ...defaultOptions, ...options };
      
      await port.open(finalOptions);
      
      // 打开串口后，根据用户配置设置RTS和DTR信号状态
      if (port.setSignals) {
        try {
          const rtsState = options.rtsState !== undefined ? options.rtsState : true;
          const dtrState = options.dtrState !== undefined ? options.dtrState : true;
          
          await port.setSignals({
            dataTerminalReady: dtrState,  // DTR信号状态
            requestToSend: rtsState       // RTS信号状态
          });
          
          console.log(`已设置信号状态 - RTS: ${rtsState ? '高电平' : '低电平'}, DTR: ${dtrState ? '高电平' : '低电平'}`);
        } catch (signalError) {
          console.warn('设置信号状态失败，但串口已打开:', signalError);
        }
      }
      
      return { success: true, error: null };
    } catch (error) {
      console.error('打开串口失败:', error);
      return { success: false, error: error.message || '打开串口失败' };
    }
  },

  /**
   * 关闭串口连接
   * @returns {Promise<{success: boolean, error: string|null}>}
   */
  async closePort() {
    if (!this.port) {
      return { success: false, error: '没有打开的串口' };
    }

    try {
      this.keepReading = false;
      
      // 等待读取循环结束
      if (this.readLoopPromise) {
        await this.readLoopPromise;
      }
      
      // 关闭读取器
      if (this.reader) {
        await this.reader.cancel();
        this.reader = null;
      }

      // 关闭串口
      await this.port.close();
      this.port = null;
      return { success: true, error: null };
    } catch (error) {
      console.error('关闭串口失败:', error);
      return { success: false, error: error.message || '关闭串口失败' };
    }
  },

  /**
   * 开始读取串口数据
   * @param {Function} dataCallback 数据回调函数
   * @param {Function} errorCallback 错误回调函数
   * @returns {Promise<{success: boolean, error: string|null}>}
   */
  async startReading(dataCallback, errorCallback) {
    if (!this.port) {
      return { success: false, error: '没有打开的串口' };
    }

    // 保存回调函数
    this.dataCallback = dataCallback;
    this.errorCallback = errorCallback;
    this.keepReading = true;

    try {
      // 获取读取器
      const reader = this.port.readable.getReader();
      this.reader = reader;

      // 开始读取循环
      this.readLoopPromise = this._readLoop(reader);
      return { success: true, error: null };
    } catch (error) {
      console.error('开始读取失败:', error);
      return { success: false, error: error.message || '开始读取失败' };
    }
  },

  /**
   * 读取循环
   * @param {ReadableStreamDefaultReader} reader 读取器
   * @returns {Promise<void>}
   * @private
   */
  async _readLoop(reader) {
    try {
      while (this.keepReading) {
        const { value, done } = await reader.read();
        
        if (done) {
          // 读取已完成
          break;
        }
        
        if (value) {
          // 解码并回调数据
          // 解码数据，处理可能的编码问题
                let text = textDecoder.decode(value);
                
                // 处理可能的乱码字符，替换无效的UTF-8字符
                text = text.replace(/\uFFFD/g, '?'); // 替换替换字符
                
                // 过滤掉一些常见的控制字符，但保留换行符和回车符
                text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
          
          if (this.dataCallback) {
            this.dataCallback(text);
          }
        }
      }
    } catch (error) {
      console.error('读取循环异常:', error);
      if (this.errorCallback) {
        this.errorCallback(error.message || '读取错误');
      }
    } finally {
      // 释放读取器
      reader.releaseLock();
    }
  },

  /**
   * 发送数据到串口
   * @param {string} data 要发送的数据
   * @returns {Promise<{success: boolean, error: string|null}>}
   */
  async sendData(data) {
    if (!this.port) {
      return { success: false, error: '没有打开的串口' };
    }

    try {
      // 获取写入器
      const writer = this.port.writable.getWriter();

      // 编码数据
      const encoder = new TextEncoder();
      const dataArray = encoder.encode(data);

      // 写入数据
      await writer.write(dataArray);

      // 释放写入器
      writer.releaseLock();

      return { success: true, error: null };
    } catch (error) {
      console.error('发送数据失败:', error);
      return { success: false, error: error.message || '发送数据失败' };
    }
  },

  /**
   * 设置串口信号状态 (RTS/DTR)
   * @param {Object} signals 信号配置 {rts: boolean, dtr: boolean}
   * @returns {Promise<{success: boolean, error: string|null}>}
   */
  async setSignalStates(signals) {
    if (!this.port) {
      return { success: false, error: '没有打开的串口' };
    }

    if (!this.port.setSignals) {
      return { success: false, error: '当前浏览器或串口设备不支持信号控制' };
    }

    try {
      const signalConfig = {};
      
      if (signals.rts !== undefined) {
        signalConfig.requestToSend = signals.rts;
      }
      
      if (signals.dtr !== undefined) {
        signalConfig.dataTerminalReady = signals.dtr;
      }

      await this.port.setSignals(signalConfig);
      
      console.log('信号状态已更新:', {
        RTS: signals.rts !== undefined ? (signals.rts ? '高电平' : '低电平') : '未改变',
        DTR: signals.dtr !== undefined ? (signals.dtr ? '高电平' : '低电平') : '未改变'
      });
      
      return { success: true, error: null };
    } catch (error) {
      console.error('设置信号状态失败:', error);
      return { success: false, error: error.message || '设置信号状态失败' };
    }
  },

  /**
   * 获取当前串口信号状态
   * @returns {Promise<{success: boolean, signals: Object|null, error: string|null}>}
   */
  async getSignalStates() {
    if (!this.port) {
      return { success: false, signals: null, error: '没有打开的串口' };
    }

    if (!this.port.getSignals) {
      return { success: false, signals: null, error: '当前浏览器或串口设备不支持信号状态查询' };
    }

    try {
      const signals = await this.port.getSignals();
      return { 
        success: true, 
        signals: {
          rts: signals.requestToSend,
          dtr: signals.dataTerminalReady,
          cts: signals.clearToSend,
          dsr: signals.dataSetReady,
          dcd: signals.dataCarrierDetect,
          ri: signals.ringIndicator
        }, 
        error: null 
      };
    } catch (error) {
      console.error('获取信号状态失败:', error);
      return { success: false, signals: null, error: error.message || '获取信号状态失败' };
    }
  }
};

export default serialService;