import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from 'electron'
import type { PstViewerApi } from '../shared/api'
import type { IpcResult } from '../shared/types'

function on<T>(channel: string, callback: (payload: T) => void): () => void {
  const listener = (_event: IpcRendererEvent, payload: T): void => callback(payload)
  ipcRenderer.on(channel, listener)
  return () => {
    ipcRenderer.removeListener(channel, listener)
  }
}

const invoke = <T>(channel: string, ...args: unknown[]): Promise<IpcResult<T>> => ipcRenderer.invoke(channel, ...args)

/** Bridges the renderer to the main process. Nothing here can modify a PST file. */
const api: PstViewerApi = {
  getAppInfo: () => invoke('app:getInfo'),
  setTheme: (source) => invoke('app:setTheme', source),
  setRemoteImagesAllowed: (allowed) => invoke('app:setRemoteImages', allowed),
  showOpenDialog: (kind = 'file') => invoke('dialog:openPst', kind),
  getPathForFile: (file) => webUtils.getPathForFile(file),

  openPst: (path) => invoke('pst:open', path),
  cancelOpen: () => invoke('pst:cancelOpen'),
  closePst: () => invoke('pst:close'),
  search: (request) => invoke('pst:search', request),
  getPage: (token, offset, limit) => invoke('pst:page', token, offset, limit),
  getMessage: (ref) => invoke('pst:message', ref),
  saveAttachment: (ref, index) => invoke('pst:saveAttachment', ref, index),
  saveAttachments: (ref) => invoke('pst:saveAttachments', ref),
  previewAttachment: (ref, index) => invoke('pst:previewAttachment', ref, index),
  openAttachment: (ref, index) => invoke('pst:openAttachment', ref, index),
  quickLook: (ref, index) => invoke('pst:quickLook', ref, index),
  exportEml: (ref, suggestedName) => invoke('export:eml', ref, suggestedName),
  exportDocument: (document) => invoke('export:document', document),
  printDocument: (document) => invoke('export:print', document),

  listRecentFiles: () => invoke('recent:list'),
  removeRecentFile: (path) => invoke('recent:remove', path),
  clearRecentFiles: () => invoke('recent:clear'),

  openExternal: (url) => invoke('shell:openExternal', url),
  showItemInFolder: (path) => invoke('shell:showItemInFolder', path),

  onProgress: (callback) => on('pst:progress', callback),
  onIndexProgress: (callback) => on('pst:indexProgress', callback),
  onMenuCommand: (callback) => on('menu:command', callback),
  onOpenPath: (callback) => on('app:openPath', callback),
  onAccentColor: (callback) => on('app:accentColor', callback),
  onThemeChange: (callback) => on('app:theme', callback),
  onRecentChanged: (callback) => on('recent:changed', callback),
  onLocaleChange: (callback) => on('app:locale', callback)
}

contextBridge.exposeInMainWorld('pstViewer', api)
