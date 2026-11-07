import { BrowserWindow, ipcMain, shell } from "electron";
import { join } from "node:path";

import { TESSERA_ADVANCED_OPEN } from "../../shared/tessera";
import { captureRuntimeCrash } from "../appReports";
import { developmentRendererURL } from "../development";
import { resourcePath } from "../resources";
import { titleBarOverlay } from "../titleBarOverlay";
import { updateCheckPromptedPreference } from "../updates";

let advancedWindow: BrowserWindow | null = null;

export function isAdvancedWindow(window: BrowserWindow): boolean {
  return window === advancedWindow;
}

export function hasAdvancedWindow(): boolean {
  return advancedWindow !== null;
}

// «Для опытных» — панель upstream в своём окне: её стили и стили Tessera UI задают одни и те же переменные на :root.
export function registerAdvancedWindow(onClosed: () => void) {
  ipcMain.handle(TESSERA_ADVANCED_OPEN, async () => {
    if (advancedWindow !== null) {
      if (advancedWindow.isMinimized()) {
        advancedWindow.restore();
      }
      advancedWindow.focus();
      return;
    }
    // Как на Android: панель не спрашивает про проверку обновлений на GitHub, проверка остаётся выключенной.
    updateCheckPromptedPreference.set(true);
    const overlay = titleBarOverlay();
    const window = new BrowserWindow({
      width: 1280,
      height: 800,
      minWidth: 721,
      minHeight: 320,
      backgroundColor: overlay?.color,
      titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "hidden",
      trafficLightPosition: process.platform === "darwin" ? { x: 18, y: 19 } : undefined,
      titleBarOverlay: overlay,
      icon: process.platform === "linux" ? resourcePath("icons", "512x512.png") : undefined,
      webPreferences: {
        preload: join(import.meta.dirname, "../preload/index.cjs"),
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
      },
    });
    advancedWindow = window;
    window.webContents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith("https://") || url.startsWith("http://")) {
        void shell.openExternal(url);
      }
      return { action: "deny" };
    });
    window.webContents.on("will-navigate", (event, url) => {
      if (url !== window.webContents.getURL()) {
        event.preventDefault();
      }
    });
    window.webContents.on("render-process-gone", (_event, details) => {
      if (details.reason !== "clean-exit") {
        captureRuntimeCrash(
          "advanced-render-process-gone",
          new Error(`renderer ${details.reason} (exit code ${details.exitCode})`),
        );
      }
    });
    window.on("closed", () => {
      advancedWindow = null;
      onClosed();
    });
    const rendererURL = developmentRendererURL();
    if (rendererURL !== "") {
      await window.loadURL(rendererURL);
    } else {
      await window.loadFile(join(import.meta.dirname, "../renderer/index.html"));
    }
  });
}
