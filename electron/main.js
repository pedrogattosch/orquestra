// Processo principal do aplicativo: inicia o servidor dos terminais, abre a janela e cuida da bandeja.
// Fechar a janela só a esconde; os agentes continuam rodando até a pessoa sair pelo menu "Sair".

const path = require('path');
const { app, BrowserWindow, Tray, Menu, dialog, ipcMain, nativeImage } = require('electron');
const { start } = require('../server');

const ICON = path.join(__dirname, '..', 'build', 'icon.png');

if (!app.requestSingleInstanceLock()) {
  app.quit(); // já existe um Orquestra rodando: ele mostra a janela (evento second-instance)
} else {
  let win = null;
  let tray = null;
  let server = null;
  let quitting = false;

  app.setAppUserModelId('dev.orquestra.app'); // necessário para notificações no Windows

  function showWindow() {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  }

  function createWindow() {
    win = new BrowserWindow({
      width: 1400,
      height: 900,
      title: 'Orquestra',
      icon: ICON,
      backgroundColor: '#0e0f13',
      autoHideMenuBar: true,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        backgroundThrottling: false, // a janela escondida continua recebendo a saída e avisando
      },
    });
    win.loadURL(server.url);
    win.on('close', (e) => {
      if (quitting) return;
      e.preventDefault();
      win.hide();
    });
  }

  function createTray() {
    tray = new Tray(nativeImage.createFromPath(ICON).resize({ width: 24, height: 24 }));
    tray.setToolTip('Orquestra');
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Abrir Orquestra', click: showWindow },
      { type: 'separator' },
      { label: 'Sair', click: confirmQuit },
    ]));
    tray.on('click', showWindow);
  }

  let asking = false;
  async function confirmQuit() {
    if (asking) return;
    asking = true;
    const n = server ? server.liveCount() : 0;
    const { response } = await dialog.showMessageBox(win && win.isVisible() ? win : undefined, {
      type: 'question',
      buttons: ['Sair', 'Cancelar'],
      defaultId: 1,
      cancelId: 1,
      title: 'Sair do Orquestra',
      message: 'Sair do Orquestra?',
      detail: (n ? `${n === 1 ? '1 terminal aberto será encerrado' : `${n} terminais abertos serão encerrados`}. ` : '')
        + 'As sessões e o layout ficam salvos para a próxima vez.',
    });
    asking = false;
    if (response !== 0) return;
    quitting = true;
    if (server) server.shutdown();
    app.quit();
  }

  app.on('second-instance', showWindow);
  app.on('before-quit', (e) => {
    if (quitting) return;
    e.preventDefault();
    confirmQuit();
  });
  app.on('window-all-closed', () => {}); // continua rodando em segundo plano

  ipcMain.handle('pick-folder', async (_e, startDir) => {
    const r = await dialog.showOpenDialog(win, { properties: ['openDirectory'], defaultPath: startDir || undefined });
    return r.canceled ? null : r.filePaths[0];
  });
  ipcMain.handle('show', showWindow);
  ipcMain.handle('quit', confirmQuit);

  app.whenReady().then(async () => {
    try {
      server = await start({
        dataDir: app.getPath('userData'),
        binDir: app.isPackaged ? path.join(process.resourcesPath, 'bin') : path.join(__dirname, '..', 'bin'),
        nodePath: process.execPath,
      });
    } catch (err) {
      dialog.showErrorBox('Orquestra', `Não consegui iniciar: ${err.message}`);
      quitting = true;
      app.quit();
      return;
    }
    createWindow();
    createTray();
  });
}
