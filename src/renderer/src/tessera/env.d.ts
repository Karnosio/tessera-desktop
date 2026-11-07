import type * as React from "react";

import type { TesseraBridge } from "@shared/tessera";

declare global {
  interface Window {
    React: typeof React;
    tessera: TesseraBridge;
  }
}

export {};
