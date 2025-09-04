/* global chrome */
import React from "react";
import { createRoot } from "react-dom/client";
import { Panel } from "./panel";

console.log("Email Buddy content script loaded");

function createShadowHost(id: string): HTMLElement {
  let host = document.getElementById(id);
  if (!host) {
    host = document.createElement("div");
    host.id = id;
    host.style.all = "initial" as unknown as string; // ensure isolation for host itself
    document.body.appendChild(host);
  }
  return host;
}

function mountPanel(): () => void {
  const host = createShadowHost("email-buddy-panel-host");
  const shadow = host.attachShadow({ mode: "open" });

  const container = document.createElement("div");
  container.id = "email-buddy-panel-container";
  const style = document.createElement("style");
  style.textContent = `
    :host, * { box-sizing: border-box; }
    .eb-toggle {
      position: fixed; right: 12px; bottom: 16px; z-index: 2147483647;
      background: #1f2937; color: #fff; border: none; border-radius: 20px;
      padding: 8px 10px; cursor: pointer; font: 500 12px system-ui;
      box-shadow: 0 2px 10px rgba(0,0,0,.15);
    }
    .eb-panel {
      position: fixed; top: 0; right: 0; height: 100vh; width: 340px;
      background: #ffffff; color: #111; border-left: 1px solid #e5e7eb;
      z-index: 2147483646; box-shadow: -6px 0 16px rgba(0,0,0,.08);
      display: flex; flex-direction: column;
    }
    .hidden { display: none !important; }
  `;

  const toggle = document.createElement("button");
  toggle.className = "eb-toggle";
  toggle.textContent = "Email Buddy";

  const panelMount = document.createElement("div");
  panelMount.className = "eb-panel hidden";

  shadow.appendChild(style);
  shadow.appendChild(container);
  container.appendChild(toggle);
  container.appendChild(panelMount);

  // Mount React Panel into panelMount
  const root = createRoot(panelMount);
  root.render(<Panel />);

  // Toggle behavior
  toggle.addEventListener("click", () => {
    const hidden = panelMount.classList.toggle("hidden");
    toggle.setAttribute("aria-pressed", String(!hidden));
  });

  // Initial ping to service worker
  try {
    chrome.runtime.sendMessage({ type: "ping" }, (resp) => {
      console.debug("Email Buddy SW ping resp:", resp);
    });
  } catch (e) {
    console.warn("Email Buddy: sendMessage failed", e);
  }

  // Unmount cleanup
  return () => {
    try { root.unmount(); } catch {}
    host.remove();
  };
}

// Ensure document.body is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mountPanel);
} else {
  mountPanel();
}
