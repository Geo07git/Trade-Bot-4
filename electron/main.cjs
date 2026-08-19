const { app, BrowserWindow, Menu, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');
try { require('dotenv').config(); } catch (e) {}

let mainWindow = null;
let serverProcess = null;
const PORT = 3000;
const APP_URL = `http://localhost:${PORT}`;

// Check if local express server is responding
function checkServerReady(url, maxRetries = 30, interval = 500) {
  return new Promise((resolve) => {
    let retries = 0;
    const check = () => {
      http.get(url, (res) => {
        if (res.statusCode >= 200 && res.statusCode < 500) {
          resolve(true);
        } else if (retries < maxRetries) {
          retries++;
          setTimeout(check, interval);
        } else {
          resolve(false);
        }
      }).on('error', () => {
        if (retries < maxRetries) {
          retries++;
          setTimeout(check, interval);
        } else {
          resolve(false);
        }
      });
    };
    check();
  });
}

// Start Express background server if not already running
async function ensureServerRunning() {
  const isUp = await checkServerReady(`${APP_URL}/api/bot/state`, 2, 200);
  if (isUp) {
    console.log('[Electron] Express server already running on port 3000.');
    return true;
  }

  console.log('[Electron] Starting Express server process...');
  const isDev = process.env.NODE_ENV !== 'production' && !app.isPackaged;

  if (isDev) {
    // In dev, run tsx server.ts
    serverProcess = spawn('npx', ['tsx', 'server.ts'], {
      cwd: process.cwd(),
      env: { ...process.env, PORT: '3000' },
      shell: true,
      stdio: 'inherit'
    });
  } else {
    // In production package, directly require server.cjs in main process
    try {
      process.env.NODE_ENV = 'production';
      process.env.PORT = '3000';
      const serverPath = path.join(app.getAppPath(), 'dist', 'server.cjs');
      console.log('[Electron] Loading server module from:', serverPath);
      require(serverPath);
    } catch (err) {
      console.error('[Electron] Error loading server.cjs:', err);
    }
  }

  const ready = await checkServerReady(`${APP_URL}/api/bot/state`, 40, 500);
  return ready;
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Crypto Trading AI & Grid Bot Desktop',
    backgroundColor: '#09090b',
    icon: fs.existsSync(path.join(__dirname, 'icon.ico')) ? path.join(__dirname, 'icon.ico') : path.join(__dirname, 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false // allow TradingView & Binance external widgets
    }
  });

  mainWindow.loadURL(APP_URL);

  // Handle external links safely in system default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  // Custom application menu
  const menuTemplate = [
    {
      label: 'Fișier',
      submenu: [
        { label: 'Reîncarcă Aplicația', accelerator: 'CmdOrCtrl+R', click: () => mainWindow.reload() },
        { label: 'Comută Fullscreen', accelerator: 'F11', click: () => mainWindow.setFullScreen(!mainWindow.isFullScreen()) },
        { type: 'separator' },
        { label: 'Ieșire', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() }
      ]
    },
    {
      label: 'Unelte AI',
      submenu: [
        {
          label: 'Inspecție DevTools (Developer)',
          accelerator: 'F12',
          click: () => mainWindow.webContents.toggleDevTools()
        },
        {
          label: 'Deschide în Browser-ul Sistemului',
          click: () => shell.openExternal(APP_URL)
        }
      ]
    },
    {
      label: 'Despre',
      submenu: [
        {
          label: 'Despre Crypto AI Desktop Bot',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'G&S Trading Bot v3.0 (Desktop & Mobile)',
              message: 'G&S Trading Bot v3.0 (Desktop & Mobile Edition)',
              detail: 'Aplicație nativă multi-platformă (Web, Electron Desktop Executable, Mobile Android .APK) cu tranzacționare automată AI 24/7, Motor Scalping ML, Smart Grid Bot și monitorizare live de costuri.'
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  await ensureServerRunning();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (serverProcess) {
      serverProcess.kill();
    }
    app.quit();
  }
});
