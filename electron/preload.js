// Funções do aplicativo que a página pode chamar (o resto da página não tem acesso ao Electron).
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('orquestra', {
  pickFolder: (startDir) => ipcRenderer.invoke('pick-folder', startDir),
  show: () => ipcRenderer.invoke('show'),
  quit: () => ipcRenderer.invoke('quit'),
});
