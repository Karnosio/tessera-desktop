export const TESSERA_ADVANCED_OPEN = "tessera:advanced-open";
export const TESSERA_CLIPBOARD_READ = "tessera:clipboard-read";

export interface TesseraBridge {
  openAdvanced(): Promise<void>;
  readClipboardText(): Promise<string>;
}
