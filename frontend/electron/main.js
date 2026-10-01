const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// Config path for persisting desktop settings
const configPath = path.join(app.getPath('userData'), 'inventory_app_config.json');

function loadConfig() {
  try {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
  } catch (err) {
    console.error('Failed to read config:', err);
  }
  return {
    serverUrl: 'http://localhost:8000',
  };
}

function saveConfig(config) {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save config:', err);
  }
}

let appConfig = loadConfig();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 720,
    title: 'GoodWan Inventory & Warehouse Management System',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
    backgroundColor: '#020617',
    show: false,
  });

  // Set CSP headers
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' http://localhost:8000 http://127.0.0.1:8000; " +
          "script-src 'self' 'unsafe-inline'; " +
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
          "font-src 'self' https://fonts.gstatic.com; " +
          "connect-src 'self' http://localhost:8000 http://127.0.0.1:8000; " +
          "img-src 'self' data: blob:;"
        ],
      },
    });
  });

  if (process.env.ELECTRON_START_URL) {
    mainWindow.loadURL(process.env.ELECTRON_START_URL);
  } else if (isDev && process.env.VITE_DEV === 'true') {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC Handlers
ipcMain.handle('app:version', () => app.getVersion());

ipcMain.handle('config:get-server-url', () => {
  return appConfig.serverUrl || 'http://localhost:8000';
});

ipcMain.handle('config:set-server-url', (_event, newUrl) => {
  if (typeof newUrl === 'string' && newUrl.trim()) {
    appConfig.serverUrl = newUrl.trim();
    saveConfig(appConfig);
    return { success: true, serverUrl: appConfig.serverUrl };
  }
  return { success: false, error: 'Invalid URL' };
});

ipcMain.handle('app:check-backend', async () => {
  const url = `${appConfig.serverUrl || 'http://localhost:8000'}/api/health`;
  try {
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      return { connected: true, data };
    }
    return { connected: false, status: res.status };
  } catch (err) {
    return { connected: false, error: err.message };
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
