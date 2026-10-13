const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  dbQuery: (operation, table, payload) => ipcRenderer.invoke('db-query', { operation, table, payload }),
  authLogin: (email, password) => ipcRenderer.invoke('auth-login', { email, password })
});
