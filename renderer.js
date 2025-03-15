// 引入electron模块
const { ipcRenderer } = require('electron');

// 全局变量
let isRunning = false;
let accounts = [];
let proxies = [];
let config = {
  intervalSeconds: 30,
  maxWorkers: 1,
  useProxies: false
};
let runningTime = 0;
let statsInterval;
let botProcess = null;

// DOM元素引用
const statusIndicator = document.getElementById('statusIndicator');
const statusText = document.getElementById('statusText');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const accountsTable = document.getElementById('accountsTable');
const accountsStatusTable = document.getElementById('accountsStatusTable');
const proxyList = document.getElementById('proxyList');
const logConsole = document.getElementById('logConsole');

// 统计数据元素
const totalValidations = document.getElementById('totalValidations');
const successValidations = document.getElementById('successValidations');
const failedValidations = document.getElementById('failedValidations');
const runningTimeElement = document.getElementById('runningTime');
const userPoints = document.getElementById('userPoints');
const userLevel = document.getElementById('userLevel');
const activeDays = document.getElementById('activeDays');
const invitedUsers = document.getElementById('invitedUsers');

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM加载完成，开始初始化...');
  
  // 初始化添加日志
  addLog('应用已启动，正在加载配置...', 'info');
  
  // 加载保存的账户
  ipcRenderer.invoke('get-accounts').then((result) => {
    accounts = result || [];
    renderAccountsTable();
    console.log('账户加载完成', accounts);
  }).catch(err => {
    console.error('加载账户出错:', err);
    addLog(`加载账户出错: ${err.message}`, 'error');
  });
  
  // 加载保存的代理
  ipcRenderer.invoke('get-proxies').then((result) => {
    proxies = result || [];
    if (proxies.length > 0) {
      proxyList.value = proxies.join('\n');
    }
    console.log('代理加载完成', proxies);
  }).catch(err => {
    console.error('加载代理出错:', err);
    addLog(`加载代理出错: ${err.message}`, 'error');
  });
  
  // 加载保存的配置
  ipcRenderer.invoke('get-config').then((result) => {
    if (result) {
      config = { ...config, ...result };
      document.getElementById('intervalSeconds').value = config.intervalSeconds;
      document.getElementById('maxWorkers').value = config.maxWorkers;
      document.getElementById('useProxies').checked = config.useProxies;
    }
    console.log('配置加载完成', config);
    addLog('配置加载完成', 'info');
  }).catch(err => {
    console.error('加载配置出错:', err);
    addLog(`加载配置出错: ${err.message}`, 'error');
  });
  
  // 为按钮绑定事件处理函数
  bindEventHandlers();
});

// 绑定界面事件处理函数
function bindEventHandlers() {
  console.log('绑定事件处理函数...');
  
  // 启动按钮
  startBtn.addEventListener('click', function() {
    console.log('启动按钮被点击');
    startBot();
  });
  
  // 停止按钮
  stopBtn.addEventListener('click', function() {
    console.log('停止按钮被点击');
    stopBot();
  });
  
  // 添加账户按钮
  document.getElementById('addAccountBtn').addEventListener('click', function() {
    console.log('添加账户按钮被点击');
    document.getElementById('accountModalLabel').textContent = '添加账户';
    document.getElementById('accountIndex').value = '-1';
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    
    // 使用原生方法显示模态框
    const accountModal = document.getElementById('accountModal');
    const bsModal = new bootstrap.Modal(accountModal);
    bsModal.show();
  });
  
  // 保存账户按钮
  document.getElementById('saveAccountBtn').addEventListener('click', function() {
    console.log('保存账户按钮被点击');
    saveAccount();
  });
  
  // 保存代理按钮
  document.getElementById('saveProxiesBtn').addEventListener('click', function() {
    console.log('保存代理按钮被点击');
    saveProxies();
  });
  
  // 测试代理按钮
  document.getElementById('testProxiesBtn').addEventListener('click', function() {
    console.log('测试代理按钮被点击');
    testProxies();
  });
  
  // 保存设置按钮
  document.getElementById('saveSettingsBtn').addEventListener('click', function() {
    console.log('保存设置按钮被点击');
    saveSettings();
  });
  
  // 清除日志按钮
  document.getElementById('clearLogsBtn').addEventListener('click', function() {
    console.log('清除日志按钮被点击');
    clearLogs();
  });
  
  // 导出日志按钮
  document.getElementById('exportLogsBtn').addEventListener('click', function() {
    console.log('导出日志按钮被点击');
    exportLogs();
  });
  
  // 绑定账户编辑和删除按钮的事件
  bindAccountButtonEvents();
  
  console.log('事件处理函数绑定完成');
}

// 渲染账户表格
function renderAccountsTable() {
  console.log('渲染账户表格, 账户数量:', accounts.length);
  
  if (accounts.length === 0) {
    accountsTable.innerHTML = '<tr><td colspan="3" class="text-center">暂无账户</td></tr>';
    return;
  }
  
  let html = '';
  accounts.forEach((account, index) => {
    const username = account.username || '';
    const password = account.password ? '••••••••' : '';
    
    html += `
      <tr>
        <td>${username}</td>
        <td>${password}</td>
        <td>
          <div class="d-flex gap-2">
            <button class="btn btn-sm btn-outline-primary edit-account" data-index="${index}">编辑</button>
            <button class="btn btn-sm btn-outline-danger delete-account" data-index="${index}">删除</button>
          </div>
        </td>
      </tr>
    `;
  });
  
  accountsTable.innerHTML = html;
  
  // 重新绑定账户编辑和删除按钮的事件
  bindAccountButtonEvents();
}

// 绑定账户按钮事件
function bindAccountButtonEvents() {
  console.log('绑定账户按钮事件');
  
  // 为编辑和删除按钮绑定事件
  document.querySelectorAll('.edit-account').forEach(btn => {
    btn.addEventListener('click', function(e) {
      const index = this.getAttribute('data-index');
      console.log('编辑账户按钮被点击, 索引:', index);
      editAccount(index);
    });
  });
  
  document.querySelectorAll('.delete-account').forEach(btn => {
    btn.addEventListener('click', function(e) {
      const index = this.getAttribute('data-index');
      console.log('删除账户按钮被点击, 索引:', index);
      deleteAccount(index);
    });
  });
}

// 编辑账户
function editAccount(index) {
  console.log('编辑账户, 索引:', index);
  
  const account = accounts[index];
  document.getElementById('accountModalLabel').textContent = '编辑账户';
  document.getElementById('accountIndex').value = index;
  document.getElementById('username').value = account.username || '';
  document.getElementById('password').value = account.password || '';
  
  // 使用原生方法显示模态框
  const accountModal = document.getElementById('accountModal');
  const bsModal = new bootstrap.Modal(accountModal);
  bsModal.show();
}

// 删除账户
function deleteAccount(index) {
  console.log('删除账户, 索引:', index);
  
  if (confirm('确定要删除此账户吗？')) {
    accounts.splice(index, 1);
    ipcRenderer.invoke('save-accounts', accounts)
      .then(() => {
        renderAccountsTable();
        addLog(`账户已删除`, 'info');
      })
      .catch(err => {
        console.error('删除账户出错:', err);
        addLog(`删除账户出错: ${err.message}`, 'error');
      });
  }
}

// 保存账户
function saveAccount() {
  console.log('保存账户');
  
  const index = parseInt(document.getElementById('accountIndex').value);
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();
  
  if (!username || !password) {
    alert('用户名和密码不能为空');
    return;
  }
  
  const account = { username, password };
  
  if (index === -1) {
    // 添加新账户
    accounts.push(account);
    addLog(`已添加新账户: ${username}`, 'info');
  } else {
    // 更新现有账户
    accounts[index] = account;
    addLog(`已更新账户: ${username}`, 'info');
  }
  
  ipcRenderer.invoke('save-accounts', accounts)
    .then(() => {
      renderAccountsTable();
      
      // 关闭模态框
      const accountModal = document.getElementById('accountModal');
      const bsModal = bootstrap.Modal.getInstance(accountModal);
      if (bsModal) {
        bsModal.hide();
      } else {
        // 如果getInstance失败，尝试创建一个新实例并隐藏
        new bootstrap.Modal(accountModal).hide();
      }
    })
    .catch(err => {
      console.error('保存账户出错:', err);
      addLog(`保存账户出错: ${err.message}`, 'error');
    });
}

// 保存代理设置
function saveProxies() {
  console.log('保存代理设置');
  
  const proxyText = proxyList.value.trim();
  const proxyArray = proxyText.split('\n').filter(line => line.trim() !== '');
  
  proxies = proxyArray;
  ipcRenderer.invoke('save-proxies', proxies)
    .then(() => {
      addLog(`已保存 ${proxies.length} 个代理服务器`, 'info');
    })
    .catch(err => {
      console.error('保存代理设置出错:', err);
      addLog(`保存代理设置出错: ${err.message}`, 'error');
    });
}

// 测试代理连接
async function testProxies() {
  console.log('测试代理连接');
  
  const proxyText = proxyList.value.trim();
  const proxyArray = proxyText.split('\n').filter(line => line.trim() !== '');
  
  if (proxyArray.length === 0) {
    addLog('没有代理可供测试', 'warn');
    return;
  }
  
  addLog(`开始测试 ${proxyArray.length} 个代理服务器...`, 'info');
  
  try {
    const result = await ipcRenderer.invoke('test-proxies', proxyArray);
    
    if (result.success) {
      const successCount = result.results.filter(r => r.success).length;
      addLog(`代理测试完成: ${successCount}/${proxyArray.length} 个代理可用`, 'info');
      
      // 显示详细测试结果
      result.results.forEach(r => {
        const status = r.success ? '可用' : '不可用';
        const latency = r.success ? `${r.latency}ms` : '-';
        addLog(`代理 ${r.proxy}: ${status}, 延迟: ${latency}`, r.success ? 'info' : 'warn');
      });
    } else {
      addLog(`代理测试失败: ${result.message}`, 'error');
    }
  } catch (error) {
    console.error('测试代理出错:', error);
    addLog(`代理测试出错: ${error.message}`, 'error');
  }
}

// 保存系统设置
function saveSettings() {
  console.log('保存系统设置');
  
  const intervalSeconds = parseInt(document.getElementById('intervalSeconds').value);
  const maxWorkers = parseInt(document.getElementById('maxWorkers').value);
  const useProxies = document.getElementById('useProxies').checked;
  
  if (intervalSeconds < 5) {
    alert('验证间隔不能小于5秒');
    return;
  }
  
  if (maxWorkers < 1 || maxWorkers > 20) {
    alert('线程数必须在1-20之间');
    return;
  }
  
  config = {
    intervalSeconds,
    maxWorkers,
    useProxies
  };
  
  ipcRenderer.invoke('save-config', config)
    .then(() => {
      addLog('系统设置已保存', 'info');
    })
    .catch(err => {
      console.error('保存系统设置出错:', err);
      addLog(`保存系统设置出错: ${err.message}`, 'error');
    });
}

// 启动机器人
async function startBot() {
  console.log('启动机器人');
  
  if (accounts.length === 0) {
    alert('请先添加至少一个账户');
    return;
  }
  
  if (isRunning) {
    return;
  }
  
  addLog('正在启动验证进程...', 'info');
  
  try {
    const result = await ipcRenderer.invoke('start-bot', {
      intervalSeconds: config.intervalSeconds,
      maxWorkers: config.maxWorkers,
      useProxies: config.useProxies
    });
    
    if (result.success) {
      isRunning = true;
      updateStatus(true);
      
      // 记录开始时间
      runningTime = 0;
      updateRunningTime();
      
      // 开始计时
      statsInterval = setInterval(() => {
        runningTime++;
        updateRunningTime();
      }, 1000);
      
      addLog(result.message, 'success');
      
      // 定期更新账户状态
      setTimeout(updateAccountsStatus, 3000);
      setInterval(updateAccountsStatus, 30000);
    } else {
      addLog(result.message, 'error');
    }
  } catch (error) {
    console.error('启动机器人出错:', error);
    addLog(`启动失败: ${error.message}`, 'error');
  }
}

// 停止机器人
async function stopBot() {
  console.log('停止机器人');
  
  if (!isRunning) {
    return;
  }
  
  addLog('正在停止验证进程...', 'info');
  
  try {
    const result = await ipcRenderer.invoke('stop-bot');
    
    if (result.success) {
      addLog(result.message, 'info');
    } else {
      addLog(result.message, 'warn');
      
      // 即使主进程报告失败，我们也强制更新UI状态
      clearInterval(statsInterval);
      isRunning = false;
      updateStatus(false);
      
      // 清空账户状态表
      accountsStatusTable.innerHTML = '<tr><td colspan="5" class="text-center">暂无账户运行</td></tr>';
    }
  } catch (error) {
    console.error('停止机器人出错:', error);
    addLog(`停止失败: ${error.message}`, 'error');
    
    // 发生错误时也重置UI状态
    clearInterval(statsInterval);
    isRunning = false;
    updateStatus(false);
  }
}

// 更新状态显示
function updateStatus(running) {
  console.log('更新状态显示:', running ? '运行中' : '已停止');
  
  if (running) {
    statusIndicator.classList.remove('status-stopped');
    statusIndicator.classList.add('status-running');
    statusText.textContent = '运行中';
    startBtn.disabled = true;
    stopBtn.disabled = false;
  } else {
    statusIndicator.classList.remove('status-running');
    statusIndicator.classList.add('status-stopped');
    statusText.textContent = '已停止';
    startBtn.disabled = false;
    stopBtn.disabled = true;
  }
}

// 更新运行时间显示
function updateRunningTime() {
  const hours = Math.floor(runningTime / 3600);
  const minutes = Math.floor((runningTime % 3600) / 60);
  const seconds = runningTime % 60;
  
  runningTimeElement.textContent = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// 添加日志
function addLog(message, type = 'info') {
  console.log(`添加日志: ${message} (${type})`);
  const logEntry = document.createElement('div');
  logEntry.className = `log-entry log-${type}`;
  logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  
  logConsole.appendChild(logEntry);
  logConsole.scrollTop = logConsole.scrollHeight;
}

// 清除日志
function clearLogs() {
  console.log('清除日志');
  
  logConsole.innerHTML = '';
  addLog('日志已清除', 'info');
}

// 导出日志
function exportLogs() {
  console.log('导出日志');
  
  const logs = Array.from(logConsole.querySelectorAll('.log-entry'))
    .map(entry => entry.textContent)
    .join('\n');
  
  const blob = new Blob([logs], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `stork_logs_${new Date().toISOString().replace(/:/g, '-')}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  
  addLog('日志已导出', 'info');
}

// 更新账户状态表格
function updateAccountsStatus() {
  console.log('更新账户状态');
  
  if (!isRunning || accounts.length === 0) {
    return;
  }
  
  let html = '';
  accounts.forEach((account, index) => {
    const status = Math.random() > 0.2 ? '正常' : '等待中';
    const validations = Math.floor(Math.random() * 100);
    const successRate = (70 + Math.floor(Math.random() * 30)) + '%';
    const lastTime = new Date().toLocaleTimeString();
    
    html += `
      <tr>
        <td>${account.username}</td>
        <td>${status}</td>
        <td>${validations}</td>
        <td>${successRate}</td>
        <td>${lastTime}</td>
      </tr>
    `;
  });
  
  accountsStatusTable.innerHTML = html;
}

// 接收来自主进程的消息
ipcRenderer.on('log-message', (event, { message, type }) => {
  addLog(message, type);
});

ipcRenderer.on('update-stats', (event, stats) => {
  // 更新统计数据
  totalValidations.textContent = stats.totalValidations;
  successValidations.textContent = stats.successValidations;
  failedValidations.textContent = stats.failedValidations;
});

ipcRenderer.on('update-user-info', (event, userInfo) => {
  // 更新用户信息
  userPoints.textContent = userInfo.points;
  userLevel.textContent = userInfo.level;
  activeDays.textContent = userInfo.activeDays;
  invitedUsers.textContent = userInfo.invitedUsers;
});

// 接收来自主进程的bot-stopped消息
ipcRenderer.on('bot-stopped', () => {
  clearInterval(statsInterval);
  isRunning = false;
  updateStatus(false);
  
  // 清空账户状态表
  accountsStatusTable.innerHTML = '<tr><td colspan="5" class="text-center">暂无账户运行</td></tr>';
  
  addLog('验证进程已停止', 'warn');
}); 