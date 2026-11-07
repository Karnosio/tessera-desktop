import "./reactGlobal";
import "./ui/bundle.js";
import "./ui/tokens.css";
import "./ui/bundle.css";
import "./slate.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { createDesktopHost } from "../host";
import { language } from "./i18n";
import { SlateApp } from "./SlateApp";

document.documentElement.lang = language;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SlateApp host={createDesktopHost()} />
  </StrictMode>,
);
