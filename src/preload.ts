import { contextBridge, ipcRenderer } from 'electron'
import type { Row } from './triage.ts'

export type RunUpdate = { rows: Row[] } | { index: number; row: Row } | { usage: string }

export type TriageApi = {
  openReport: (saved: boolean) => Promise<string | undefined>
  context: (index: number) => Promise<string | undefined>
  onTheme: (listener: () => void) => void
  openRoot: () => Promise<string | undefined>
  models: () => Promise<string[]>
  start: (model: string, concurrency: number, maxLevel: number) => Promise<void>
  stop: () => void
  onUpdate: (listener: (update: RunUpdate) => void) => void
  save: (format: 'csv' | 'json') => Promise<void>
}

contextBridge.exposeInMainWorld('triage', {
  openReport: saved => ipcRenderer.invoke('open-report', saved),
  context: index => ipcRenderer.invoke('context', index),
  onTheme: listener => { ipcRenderer.on('toggle-theme', () => listener()) },
  openRoot: () => ipcRenderer.invoke('open-root'),
  models: () => ipcRenderer.invoke('models'),
  start: (model, concurrency, maxLevel) => ipcRenderer.invoke('start', model, concurrency, maxLevel),
  stop: () => ipcRenderer.send('stop'),
  onUpdate: listener => {
    ipcRenderer.on('update', (_event, update: RunUpdate) => listener(update))
  },
  save: format => ipcRenderer.invoke('save', format),
} satisfies TriageApi)
