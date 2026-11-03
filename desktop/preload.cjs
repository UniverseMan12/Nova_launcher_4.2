const { contextBridge, ipcRenderer } = require('electron');
const invoke = async (name, ...args) => {
  const result = await ipcRenderer.invoke('launcher:' + name, ...args);
  if (!result.ok) throw new Error(result.error);
  return result.value;
};
contextBridge.exposeInMainWorld('launcher', {
  acknowledgeChanges: () => invoke('acknowledgeChanges'),
  initial: () => invoke('initial'), browse: () => invoke('browse'),
  downloadGame: () => invoke('downloadGame'),
  start: (action, options) => invoke('start', action, options), stop: () => invoke('stop'),
  copyInvite: address => invoke('copyInvite', address),
  saveSettings: options => invoke('saveSettings', options),
  link: key => invoke('link', key), logs: () => invoke('logs'),
  minimize: () => invoke('minimize'), close: () => invoke('close'),
  updateCheck: () => invoke('updateCheck'), updateDownload: () => invoke('updateDownload'),
  updateCancel: () => invoke('updateCancel'), updateInstall: () => invoke('updateInstall'),
  updatePreference: value => invoke('updatePreference',value),
  subscribeUpdate: callback => { const handler=(_event,state)=>callback(state);ipcRenderer.on('launcher:update',handler);return ()=>ipcRenderer.removeListener('launcher:update',handler); },
  subscribe: callback => { const handler = (_event, state) => callback(state); ipcRenderer.on('launcher:state', handler); return () => ipcRenderer.removeListener('launcher:state', handler); }
});
