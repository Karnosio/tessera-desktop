import { contextBridge, ipcRenderer } from "electron";

import {
  TESSERA_ADVANCED_OPEN,
  TESSERA_AUTO_CALL,
  TESSERA_AUTO_CHANGED,
  TESSERA_CLIPBOARD_READ,
  TESSERA_CONVERT,
  TESSERA_CONVERTED,
  TESSERA_MARK_CONVERTED,
  TESSERA_SUBSCRIPTION,
} from "../shared/tessera";
import type { AutoState, TesseraBridge } from "../shared/tessera";

export function exposeTessera() {
  const bridge: TesseraBridge = {
    openAdvanced: () => ipcRenderer.invoke(TESSERA_ADVANCED_OPEN),
    readClipboardText: () => ipcRenderer.invoke(TESSERA_CLIPBOARD_READ),
    convert: (text) => ipcRenderer.invoke(TESSERA_CONVERT, text),
    subscription: (url) => ipcRenderer.invoke(TESSERA_SUBSCRIPTION, url),
    convertedProfiles: () => ipcRenderer.invoke(TESSERA_CONVERTED),
    markConverted: (id) => ipcRenderer.invoke(TESSERA_MARK_CONVERTED, id),
    auto: {
      state: () => ipcRenderer.invoke(TESSERA_AUTO_CALL, "state"),
      onChanged: (listener) => {
        const handler = (_event: Electron.IpcRendererEvent, state: AutoState) => listener(state);
        ipcRenderer.on(TESSERA_AUTO_CHANGED, handler);
        return () => ipcRenderer.off(TESSERA_AUTO_CHANGED, handler);
      },
      setCriterion: (criterion) => ipcRenderer.invoke(TESSERA_AUTO_CALL, "setCriterion", criterion),
      select: (choices, manual) => ipcRenderer.invoke(TESSERA_AUTO_CALL, "select", choices, manual),
      measure: (tags) => ipcRenderer.invoke(TESSERA_AUTO_CALL, "measure", tags),
      stopMeasuring: () => ipcRenderer.invoke(TESSERA_AUTO_CALL, "stopMeasuring"),
      forgetFailed: (tags) => ipcRenderer.invoke(TESSERA_AUTO_CALL, "forgetFailed", tags),
    },
  };
  contextBridge.exposeInMainWorld("tessera", bridge);
}
