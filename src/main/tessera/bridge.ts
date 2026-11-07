import { clipboard, ipcMain } from "electron";

import { TESSERA_CLIPBOARD_READ } from "../../shared/tessera";
import { registerAdvancedWindow } from "./advancedWindow";

// Буфер читает основной процесс: в окне Slate navigator.clipboard запрещён политикой разрешений upstream.
export function registerTessera(onAdvancedWindowClosed: () => void) {
  registerAdvancedWindow(onAdvancedWindowClosed);
  ipcMain.handle(TESSERA_CLIPBOARD_READ, () => clipboard.readText());
}
