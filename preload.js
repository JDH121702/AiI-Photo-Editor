const { contextBridge, ipcRenderer } = require('electron');

console.log('Preload script loaded.');

// Expose specific IPC channels to the renderer process securely
contextBridge.exposeInMainWorld('electronAPI', {
  // Function the renderer can call to send analysis request to main process
  analyzeImage: (data) => ipcRenderer.send('analyze-image-request', data), // Send analysis parameters (subject, style, etc.)
  // Use invoke/handle for actions that need a response (like file dialogs)
  handleSelectTargetImage: () => ipcRenderer.invoke('dialog:selectTargetImage'),
  handleSelectReferenceImage: () => ipcRenderer.invoke('dialog:selectReferenceImage'),

  // Function the renderer can listen on to receive results from main process
  onAnalysisResult: (callback) => ipcRenderer.on('analysis-image-result', (_event, value) => callback(value)),

  // Function the renderer can listen on to receive errors from main process
  onAnalysisError: (callback) => ipcRenderer.on('analysis-image-error', (_event, value) => callback(value))
});

console.log('electronAPI exposed to window.');