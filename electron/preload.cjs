// Renderer gets a tiny allowlisted bridge instead of full Node (nodeIntegration is OFF).
const { contextBridge, ipcRenderer } = require('electron');

const INVOKE = new Set([
  'chat:get', 'chat:save', 'ollama:chat', 'shell:exec', 'system:info', 'shell:open',
  'tor:status', 'tor:fetch'
]);
const SEND = new Set(['ui:graveyard', 'ui:rodja']);

contextBridge.exposeInMainWorld('fk', {
  invoke: (ch, ...args) => {
    if (!INVOKE.has(ch)) return Promise.reject(new Error(`blocked channel: ${ch}`));
    return ipcRenderer.invoke(ch, ...args);
  },
  send: (ch, ...args) => {
    if (SEND.has(ch)) ipcRenderer.send(ch, ...args);
  }
});
