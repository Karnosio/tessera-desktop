import { contextBridge, ipcRenderer } from "electron";

import { TESSERA_ADVANCED_OPEN, TESSERA_CLIPBOARD_READ } from "../shared/tessera";
import type { TesseraBridge } from "../shared/tessera";

export function exposeTessera() {
  const bridge: TesseraBridge = {
    openAdvanced: () => ipcRenderer.invoke(TESSERA_ADVANCED_OPEN),
    readClipboardText: () => ipcRenderer.invoke(TESSERA_CLIPBOARD_READ),
  };
  contextBridge.exposeInMainWorld("tessera", bridge);
}
