import { app, BrowserWindow, ipcMain, Menu } from 'electron';
import { enable } from '@electron/remote/main/index.js';
import path from 'path';
import { fileURLToPath } from 'url';
import Store from 'electron-store';
import { spawn } from 'child_process';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
const store = new Store();
let botProcess = null;

// 确保accounts.js文件存在
function ensureAccountsFile() {
  const accountsPath = path.join(__dirname, 'accounts.js');
  if (!fs.existsSync(accountsPath)) {
    const defaultContent = `export const accounts = [
  { username: "email1", password: "pass1" },
  { username: "email2", password: "pass2" },
];
`;
    fs.writeFileSync(accountsPath, defaultContent, 'utf8');
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    }
  });

  enable(mainWindow.webContents);
  
  // 移除菜单栏
  Menu.setApplicationMenu(null);
  
  // 注释掉开发者工具
  // mainWindow.webContents.openDevTools();
  
  mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
  ensureAccountsFile();
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// IPC通信处理
ipcMain.handle('get-accounts', () => {
  console.log('主进程: 获取账户');
  return store.get('accounts') || [];
});

ipcMain.handle('save-accounts', (event, accounts) => {
  console.log('主进程: 保存账户', accounts);
  store.set('accounts', accounts);
  
  // 更新accounts.js文件
  try {
    const accountsContent = `export const accounts = ${JSON.stringify(accounts, null, 2)};
`;
    fs.writeFileSync(path.join(__dirname, 'accounts.js'), accountsContent, 'utf8');
  } catch (error) {
    console.error('保存accounts.js文件失败:', error);
  }
  
  return true;
});

ipcMain.handle('get-config', () => {
  console.log('主进程: 获取配置');
  return store.get('config') || {};
});

ipcMain.handle('save-config', (event, config) => {
  console.log('主进程: 保存配置', config);
  store.set('config', config);
  return true;
});

ipcMain.handle('get-proxies', () => {
  console.log('主进程: 获取代理');
  return store.get('proxies') || [];
});

ipcMain.handle('save-proxies', (event, proxies) => {
  console.log('主进程: 保存代理', proxies);
  store.set('proxies', proxies);
  
  // 更新proxies.txt文件
  try {
    fs.writeFileSync(path.join(__dirname, 'proxies.txt'), proxies.join('\n'), 'utf8');
  } catch (error) {
    console.error('保存proxies.txt文件失败:', error);
  }
  
  return true;
});

// 启动验证进程
ipcMain.handle('start-bot', (event, { intervalSeconds, maxWorkers, useProxies }) => {
  console.log('主进程: 启动机器人', { intervalSeconds, maxWorkers, useProxies });
  if (botProcess) {
    return { success: false, message: '验证进程已在运行中' };
  }
  
  try {
    // 创建配置文件
    const configContent = JSON.stringify({
      cognito: {
        region: 'ap-northeast-1',
        clientId: '5msns4n49hmg3dftp2tp1t2iuh',
        userPoolId: 'ap-northeast-1_M22I44OpC'
      },
      stork: {
        intervalSeconds: intervalSeconds || 30
      },
      threads: {
        maxWorkers: maxWorkers || 1
      }
    }, null, 2);
    
    fs.writeFileSync(path.join(__dirname, 'config.json'), configContent, 'utf8');
    
    // 启动子进程
    botProcess = spawn('node', ['index.js'], {
      cwd: __dirname,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    // 监听输出
    botProcess.stdout.on('data', (data) => {
      const message = data.toString().trim();
      mainWindow.webContents.send('log-message', { message, type: 'info' });
      
      // 尝试解析统计数据和用户信息
      parseStatsFromLog(message);
    });
    
    botProcess.stderr.on('data', (data) => {
      const message = data.toString().trim();
      mainWindow.webContents.send('log-message', { message, type: 'error' });
    });
    
    botProcess.on('close', (code) => {
      mainWindow.webContents.send('log-message', {
        message: `验证进程已退出，退出码：${code}`,
        type: code === 0 ? 'info' : 'error'
      });
      
      botProcess = null;
      mainWindow.webContents.send('bot-stopped');
    });
    
    return { success: true, message: '验证进程已启动' };
  } catch (error) {
    console.error('启动验证进程失败:', error);
    return { success: false, message: `启动失败: ${error.message}` };
  }
});

// 停止验证进程
ipcMain.handle('stop-bot', () => {
  console.log('主进程: 停止机器人');
  if (!botProcess) {
    return { success: false, message: '没有正在运行的验证进程' };
  }
  
  try {
    // 在Windows上使用botProcess.kill()可能无法终止子进程的子进程
    // 因此我们使用特定平台的方法来确保完全终止
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', botProcess.pid, '/f', '/t']);
    } else {
      botProcess.kill('SIGTERM');
    }
    
    return { success: true, message: '已发送停止信号' };
  } catch (error) {
    console.error('停止验证进程失败:', error);
    return { success: false, message: `停止失败: ${error.message}` };
  }
});

// 测试代理连接
ipcMain.handle('test-proxies', async (event, proxies) => {
  console.log('主进程: 测试代理', proxies);
  // 这里应该实现实际的代理测试逻辑
  // 为简单起见，我们返回模拟数据
  return {
    success: true,
    results: proxies.map(proxy => ({
      proxy,
      success: Math.random() > 0.3,
      latency: Math.floor(Math.random() * 1000)
    }))
  };
});

// 从日志中解析统计数据
function parseStatsFromLog(logMessage) {
  // 这里实现实际的日志解析逻辑
  // 例如，当发现包含"验证成功"的消息时，更新统计
  
  // 这里只是一个简单的示例
  if (logMessage.includes('验证成功')) {
    const currentStats = store.get('stats') || { totalValidations: 0, successValidations: 0, failedValidations: 0 };
    currentStats.totalValidations++;
    currentStats.successValidations++;
    store.set('stats', currentStats);
    
    mainWindow.webContents.send('update-stats', currentStats);
  } else if (logMessage.includes('验证失败')) {
    const currentStats = store.get('stats') || { totalValidations: 0, successValidations: 0, failedValidations: 0 };
    currentStats.totalValidations++;
    currentStats.failedValidations++;
    store.set('stats', currentStats);
    
    mainWindow.webContents.send('update-stats', currentStats);
  }
  
  // 解析用户信息
  const userInfoMatch = logMessage.match(/用户信息: 积分:(\d+), 等级:(\d+), 活跃天数:(\d+), 邀请人数:(\d+)/);
  if (userInfoMatch) {
    const userInfo = {
      points: userInfoMatch[1],
      level: userInfoMatch[2],
      activeDays: userInfoMatch[3],
      invitedUsers: userInfoMatch[4]
    };
    
    mainWindow.webContents.send('update-user-info', userInfo);
  }
}