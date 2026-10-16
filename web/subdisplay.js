import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

const EXTENSION_NAME = "ComfyUI.SubDisplay";
const NODE_TYPE = "SubDisplay";

/* ============================================================
   CSS
   ============================================================ */

const css = document.createElement("link");
css.rel = "stylesheet";
css.href = new URL("./subdisplay.css", import.meta.url).href;

if (!document.querySelector(`link[href="${css.href}"]`)) {
  document.head.appendChild(css);
}

// Shared visual tokens for all three nodes (loaded only once).
const modernHref = new URL("./modern.css", import.meta.url).href;
if (!document.querySelector(`link[href="${modernHref}"]`)) {
  const modernStyle = document.createElement("link");
  modernStyle.rel = "stylesheet";
  modernStyle.href = modernHref;
  document.head.appendChild(modernStyle);
}


/* ============================================================
   MARKDOWN
   ============================================================ */

function parseMarkdown(text) {
  if (!text) {
    return "<div class='sh-empty-output'><span class='sh-live-dot'></span><span>Waiting for a Sub Text result…</span></div>";
  }

  const html = String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const applyInlineFormatting = txt => {
    return txt
      .replace(
        /`([^`]+)`/g,
        "<code style='font-family:monospace; background:rgba(255,255,255,0.08); padding:1px 4px; border-radius:3px;'>$1</code>",
      )
      .replace(/\*\*(.+?)\*\*/g, "<strong style='font-weight:700;'>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em style='font-style:italic;'>$1</em>");
  };

  const isTableRow = line => {
    const trimmed = line.trim();
    return trimmed.startsWith("|") && trimmed.endsWith("|");
  };

  const parseTableRow = line => {
    return line
      .trim()
      .slice(1, -1)
      .split("|")
      .map(cell => cell.trim());
  };

  const lines = html.split("\n");
  const result = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    /* ==========================================================
       TABLE PARSER (SEMANTIC STRUCTURE FIX)
       ========================================================== */
    if (isTableRow(line)) {
      const tableRows = [];

      // Safely ingest all rows matching the table syntax structure
      while (i < lines.length && isTableRow(lines[i])) {
        const currentLine = lines[i].trim();

        if (!currentLine.includes("---")) {
          tableRows.push(parseTableRow(currentLine));
        }
        i++;
      }

      if (tableRows.length > 0) {
        let tableHTML = "<table>";

        // 1. Render the structural Header Row safely (Index 0)
        const headerRow = tableRows[0];
        const headerCellsHTML = headerRow.map(cell => `<th scope="col">${applyInlineFormatting(cell)}</th>`).join("");
        tableHTML += `<thead><tr>${headerCellsHTML}</tr></thead>`;

        // 2. Render all remaining Data Rows inside an explicit tbody
        tableHTML += "<tbody>";
        for (let r = 1; r < tableRows.length; r++) {
          const bodyRow = tableRows[r];
          const bodyCellsHTML = bodyRow.map(cell => `<td>${applyInlineFormatting(cell)}</td>`).join("");
          tableHTML += `<tr>${bodyCellsHTML}</tr>`;
        }
        tableHTML += "</tbody>";

        tableHTML += "</table>";
        result.push(tableHTML);
      }

      // We already advanced the line iterator 'i' past the table end block.
      continue;
    }

    /* ==========================================================
       HEADINGS
       ========================================================== */
    if (trimmed.startsWith("## ")) {
      result.push(
        `<div style='font-size:14px; line-height:1.3; margin:7px 0 7px 0; font-weight:700;'>${applyInlineFormatting(
          trimmed.slice(3),
        )}</div>`,
      );
    } else if (trimmed.startsWith("# ")) {
      result.push(
        `<div style='font-size:18px; line-height:1.25; margin:8px 0 10px 0; font-weight:700;'>${applyInlineFormatting(
          trimmed.slice(2),
        )}</div>`,
      );

      /* ==========================================================
       HORIZONTAL RULE
       ========================================================== */
    } else if (trimmed === "---") {
      result.push("<div style='height:1px; background:rgba(255,255,255,0.15); margin:10px 0;'></div>");

      /* ==========================================================
       BLOCKQUOTE
       ========================================================== */
    } else if (trimmed.startsWith("&gt;") || trimmed.startsWith(">")) {
      const quoteText = trimmed.startsWith("&gt;") ? trimmed.slice(4).trim() : trimmed.slice(1).trim();
      result.push(
        `<blockquote style='border-left:3px solid #61afef; padding-left:8px; margin:4px 0; color:#abb2bf; font-style:italic;'>${applyInlineFormatting(
          quoteText,
        )}</blockquote>`,
      );

      /* ==========================================================
       LIST
       ========================================================== */
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      result.push(`<div style='margin:2px 0; padding-left:16px;'>• ${applyInlineFormatting(trimmed.slice(2))}</div>`);

      /* ==========================================================
       EMPTY LINE
       ========================================================== */
    } else if (trimmed === "") {
      result.push("<div style='height:6px;'></div>");

      /* ==========================================================
       NORMAL TEXT
       ========================================================== */
    } else {
      result.push(`<p style='margin:0 0 4px 0;'>${applyInlineFormatting(line)}</p>`);
    }

    i++;
  }

  return result.join("");
}

/* ============================================================
   SUBTEXT HELPERS
   ============================================================ */

function getNodeType(node) {
  return node?.type || node?.comfyClass || "";
}

function getSubTextUniqueName(node) {
  if (!node) return "";

  const widget = node.widgets?.find(w => w && w.name === "unique_name");

  return String(widget?.value ?? "").trim();
}

function getSubTextContent(node) {
  if (!node) return "";

  const widget = node.widgets?.find(w => w && w.name === "text");

  return String(widget?.value ?? "");
}

function getSubTextLastResult(node) {
  if (!node) return "";

  if (node.__subtextLastExecutedText !== undefined && node.__subtextLastExecutedText !== null) {
    return String(node.__subtextLastExecutedText);
  }

  if (node.properties?.__subtextLastExecutedText !== undefined && node.properties?.__subtextLastExecutedText !== null) {
    return String(node.properties.__subtextLastExecutedText);
  }

  return "";
}

/* ============================================================
   RECURSIVE GRAPH SEARCH
   ============================================================ */

function collectSubTextNodes(graph, results = [], visited = new Set()) {
  if (!graph || visited.has(graph)) {
    return results;
  }

  visited.add(graph);

  for (const node of graph._nodes || []) {
    if (!node) continue;

    if (getNodeType(node) === "SubText") {
      results.push(node);
    }

    if (node.subgraph) {
      collectSubTextNodes(node.subgraph, results, visited);
    }
  }

  return results;
}

function findSubTextByName(name) {
  const target = String(name ?? "").trim();

  if (!target || !(app.rootGraph || app.graph)) {
    return null;
  }

  const nodes = collectSubTextNodes(app.rootGraph || app.graph);

  for (const node of nodes) {
    if (getSubTextUniqueName(node) === target) {
      return node;
    }
  }

  return null;
}

/* ============================================================
   NATIVE WIDGET VISIBILITY (Nodes 1.0 + 2.0)
   ============================================================ */

function hideNativeNameWidget(node) {
  const widget = node.widgets?.find(w => w && w.name === "unique_name");
  if (!widget) return null;

  // Keep this STRING widget alive and serializable: it is the backend value
  // selected by our custom dropdown. Hide only its native visual control.
  // Modern Vue nodes use options-based visibility, while older LiteGraph
  // builds rely on widget.hidden / computeSize.
  if (!widget.options) widget.options = {};
  widget.options.hidden = true;
  widget.options.canvasOnly = true;
  widget.options.hideInPanel = true;
  widget.hidden = true;
  widget.computeSize = () => [0, -4];

  // Some older STRING widgets create their own native input element.
  // Do not touch the custom selector DOM widget.
  for (const element of [widget.element, widget.inputEl]) {
    if (element?.style) element.style.display = "none";
  }

  return widget;
}

/* ============================================================
   EXTENSION
   ============================================================ */

app.registerExtension({
  name: EXTENSION_NAME,

  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name !== NODE_TYPE) {
      return;
    }

    /* ========================================================
       NODE CREATED
       ======================================================== */

    const originalCreated = nodeType.prototype.onNodeCreated;
    nodeType.prototype.onNodeCreated = function () {
      originalCreated?.apply(this, arguments);
      // No physical inputs defined by Python; do not manually mutate slot
      // arrays tracked by the modern Vue renderer.

      /* HIDE INTERNAL NAME IN BOTH NODE RENDERERS */

      const uniqueNameWidget = hideNativeNameWidget(this);

      this.__resolvedUniqueName = String(uniqueNameWidget?.value ?? "").trim();

      this.properties = this.properties || {};

      /* MASTER CONTAINER */

      const masterContainer = document.createElement("div");

      masterContainer.className = "subdisplay-master-container";

      const configContainer = document.createElement("div");

      configContainer.className = "subheader-ui subdisplay-config-ui";

      const headerPanel = document.createElement("div");
      headerPanel.className = "sh-intro";
      const headerLabels = document.createElement("div");
      headerLabels.className = "sh-intro-left";
      const eyebrow = document.createElement("div");
      eyebrow.className = "sh-eyebrow";
      eyebrow.textContent = "SUBGRAPH UI";
      const title = document.createElement("div");
      title.className = "sh-intro-heading";
      title.textContent = "Live display";
      headerLabels.append(eyebrow, title);
      const state = document.createElement("span");
      state.className = "sh-element-count";
      state.textContent = "SUB TEXT";
      headerPanel.append(headerLabels, state);
      configContainer.append(headerPanel);

      const elementList = document.createElement("div");

      elementList.className = "subheader-element-list";

      /* SELECTOR */

      const selectorRow = document.createElement("div");

      selectorRow.className = "subheader-element-row";

      const selectorCard = document.createElement("div");

      selectorCard.className = "subheader-element-card";

      const selectorLabel = document.createElement("span");

      selectorLabel.className = "subheader-position-label";

      selectorLabel.innerText = "NAME";

      const selector = document.createElement("select");

      selector.className = "subdisplay-subtext-selector";

      /* ======================================================
           RENDER HELPERS
           ====================================================== */

      const renderText = text => {
        const value = String(text ?? "");

        this.__resolvedMarkdownText = value;

        this.properties = this.properties || {};

        this.properties.__subdisplayLastText = value;

        if (this.__renderBox) {
          this.__renderBox.innerHTML = parseMarkdown(value);
        }

        this.setDirtyCanvas(true, true);

        if (app.canvas) {
          app.canvas.setDirty(true, true);
        }
      };

      /* ======================================================
           REFRESH OPTIONS
           ====================================================== */

      const refreshSubTextOptions = () => {
        if (!selector) {
          return;
        }

        const previousValue = uniqueNameWidget
          ? String(uniqueNameWidget.value ?? "").trim()
          : String(this.__resolvedUniqueName ?? "").trim();

        const subTextNodes = collectSubTextNodes(app.rootGraph || app.graph);

        const names = [];

        for (const node of subTextNodes) {
          const name = getSubTextUniqueName(node);

          if (!name) continue;

          if (!names.includes(name)) {
            names.push(name);
          }
        }

        selector.innerHTML = "";

        const emptyOption = document.createElement("option");

        emptyOption.value = "";
        emptyOption.textContent = "Select SubText...";

        selector.appendChild(emptyOption);

        for (const name of names) {
          const option = document.createElement("option");

          option.value = name;
          option.textContent = name;

          selector.appendChild(option);
        }

        // A restored subgraph can load its nested nodes *after* this DOM widget.
        // Do not silently discard the saved selection in that brief window.
        if (previousValue && !names.includes(previousValue)) {
          const pendingOption = document.createElement("option");
          pendingOption.value = previousValue;
          pendingOption.textContent = previousValue;
          selector.appendChild(pendingOption);
        }
        selector.value = previousValue || "";

        this.__resolvedUniqueName = selector.value;

        resolveSelectedSubText(false);
      };

      /* ======================================================
           RESOLVE SELECTED SUBTEXT
           ====================================================== */

      const resolveSelectedSubText = (allowTemplateFallback = true) => {
        const name = String(selector.value || uniqueNameWidget?.value || this.__resolvedUniqueName || "").trim();

        this.__resolvedUniqueName = name;

        if (!name) {
          renderText("");
          return;
        }

        const subTextNode = findSubTextByName(name);

        if (!subTextNode) {
          return;
        }

        const lastResult = getSubTextLastResult(subTextNode);

        if (lastResult !== "") {
          renderText(lastResult);
          return;
        }

        if (allowTemplateFallback) {
          // FIX: Instead of raw text, pass an empty string
          // This triggers your beautiful "Waiting for prompt execution..." span automatically
          renderText("");
        }
      };

      this.__refreshSubTextOptions = refreshSubTextOptions;

      this.__resolveSelectedSubText = resolveSelectedSubText;

      /* ======================================================
           SELECTOR EVENTS
           ====================================================== */

      selector.addEventListener("mousedown", event => {
        event.stopPropagation();
      });

      selector.addEventListener("click", event => {
        event.stopPropagation();
      });

      selector.addEventListener("change", () => {
        const value = selector.value;

        this.__resolvedUniqueName = value;

        if (uniqueNameWidget) {
          uniqueNameWidget.value = value;

          if (uniqueNameWidget.callback) {
            uniqueNameWidget.callback(value);
          }
        }

        resolveSelectedSubText(true);

        this.setDirtyCanvas(true, true);

        if (app.canvas) {
          app.canvas.setDirty(true, true);
        }
      });

      /* BUILD SELECTOR */

      selectorCard.appendChild(selectorLabel);
      selectorCard.appendChild(selector);
      selectorRow.appendChild(selectorCard);

      /* ======================================================
           FONT SIZE CONTROLLER (NEW FEATURE)
           ====================================================== */
      this.properties = this.properties || {};
      // Fallback to existing saved property, or default to 11px
      this.properties.__subdisplayFontSize = this.properties.__subdisplayFontSize || 12;

      const fontSizeContainer = document.createElement("div");
      fontSizeContainer.style.display = "flex";
      fontSizeContainer.style.alignItems = "center";
      fontSizeContainer.style.gap = "4px";
      fontSizeContainer.style.marginLeft = "8px";

      const btnDecrease = document.createElement("button");
      btnDecrease.innerText = "A-";
      btnDecrease.title = "Decrease Font Size";

      const btnIncrease = document.createElement("button");
      btnIncrease.innerText = "A+";
      btnIncrease.title = "Increase Font Size";

      // Shared styling for the compact buttons
      [btnDecrease, btnIncrease].forEach(btn => {
        btn.style.height = "24px";
        btn.style.padding = "0 8px";
        btn.style.background = "var(--sh-panel, #1e222a)";
        btn.style.border = "1px solid var(--sh-border, #292f38)";
        btn.style.borderRadius = "4px";
        btn.style.color = "var(--sh-text, #e7e9ed)";
        btn.style.fontSize = "10px";
        btn.style.cursor = "pointer";
        btn.style.outline = "none";
        btn.style.transition = "background 0.2s, border-color 0.2s";

        btn.addEventListener("mousedown", e => e.stopPropagation());
        btn.addEventListener("click", e => e.stopPropagation());

        btn.addEventListener("mouseenter", () => {
          btn.style.background = "#2d3139";
          btn.style.borderColor = "var(--sh-border-light, #3f4754)";
        });
        btn.addEventListener("mouseleave", () => {
          btn.style.background = "var(--sh-panel, #1e222a)";
          btn.style.borderColor = "var(--sh-border, #292f38)";
        });
      });

      // Update function
      const updateNodeFontSize = sizeDelta => {
        let currentSize = this.properties.__subdisplayFontSize || 11;
        currentSize += sizeDelta;

        // Failsafe: Don't let text become microscopic or giant
        if (currentSize < 8) currentSize = 8;
        if (currentSize > 24) currentSize = 24;

        this.properties.__subdisplayFontSize = currentSize;

        if (this.__renderBox) {
          this.__renderBox.style.fontSize = `${currentSize}px`;
          // Also dynamically scale line height slightly so dense text doesn't overlap
          this.__renderBox.style.lineHeight = `${1.2 + currentSize * 0.02}`;
        }

        this.setDirtyCanvas(true, true);
      };

      btnDecrease.addEventListener("click", () => updateNodeFontSize(-1));
      btnIncrease.addEventListener("click", () => updateNodeFontSize(1));

      fontSizeContainer.appendChild(btnDecrease);
      fontSizeContainer.appendChild(btnIncrease);
      selectorRow.appendChild(fontSizeContainer); // Attach directly next to NAME dropdown

      elementList.appendChild(selectorRow);
      configContainer.appendChild(elementList);

      /* ======================================================
           MARKDOWN DISPLAY
           ====================================================== */

      const container = document.createElement("div");

      container.className = "subdisplay-ui";

      const renderBox = document.createElement("div");

      renderBox.className = "subdisplay-render-box";

      const storedText = this.properties ? this.properties.__subdisplayLastText : "";

      if (storedText !== undefined && storedText !== null && String(storedText) !== "") {
        this.__resolvedMarkdownText = String(storedText);

        renderBox.innerHTML = parseMarkdown(this.__resolvedMarkdownText);
      } else {
        renderBox.innerHTML = parseMarkdown("");
      }

      renderBox.addEventListener("mousedown", event => {
        event.stopPropagation();
      });

      renderBox.addEventListener("wheel", event => {
        event.stopPropagation();
      });

      container.appendChild(renderBox);

      configContainer.appendChild(container);

      /* DOM WIDGET */

      this.addDOMWidget("subdisplay_config_ui", "SUBDISPLAY_CONFIG_UI", configContainer, {
        serialize: false,
        // A fixed minimum is essential in Nodes 2.0: the header and selector
        // would otherwise consume the widget's entire 200px allowance and
        // collapse the Markdown panel to a line. Never derive this from
        // this.size or DOM measurements (that caused the endless growth).
        getMinHeight: () => 300,
        getHeight: () => "100%",
      });

      this.__renderBox = renderBox;

      this.__subTextSelector = selector;

      /* ======================================================
           SUBTEXT NAME CHANGES
           ====================================================== */

      this.__subtextNameChangedHandler = event => {
        if (!event.detail?.node) {
          return;
        }

        refreshSubTextOptions();
      };

      window.addEventListener("subtext-name-changed", this.__subtextNameChangedHandler);

      /* ======================================================
           SUBTEXT EXECUTION RESULTS — BOTH RENDERERS
           ====================================================== */

      const acceptSubTextResult = (rawName, rawText) => {
        const name = String(rawName ?? "").trim();
        const selectedName = String(selector.value || uniqueNameWidget?.value || this.__resolvedUniqueName || "").trim();
        if (!name || name !== selectedName || rawText === undefined || rawText === null) return;

        const text = String(rawText);
        // Keep the latest executed output available if the user reselects it.
        const source = findSubTextByName(name);
        if (source) {
          source.__subtextLastExecutedText = text;
          source.properties ||= {};
          source.properties.__subtextLastExecutedText = text;
        }
        if (text !== this.__resolvedMarkdownText) renderText(text);
      };

      // Legacy path: SubText.onExecuted dispatches this event.
      this.__subtextExecutedHandler = event => {
        acceptSubTextResult(event.detail?.name, event.detail?.text);
      };
      window.addEventListener("subtext-executed", this.__subtextExecutedHandler);

      // Nodes 2.0 / nested subgraph fallback: the backend's `executed` event
      // carries both text and unique_name in SubText's UI output. Listening
      // directly avoids relying on the inner node's onExecuted callback being
      // resolved to the currently displayed graph layer by ComfyUI.
      this.__subdisplayApiExecutedHandler = event => {
        const output = event.detail?.output;
        if (!output || !Object.prototype.hasOwnProperty.call(output, "text") ||
            !Object.prototype.hasOwnProperty.call(output, "unique_name")) return;
        const name = Array.isArray(output.unique_name) ? output.unique_name[0] : output.unique_name;
        const text = Array.isArray(output.text) ? output.text[0] : output.text;
        acceptSubTextResult(name, text);
      };
      api.addEventListener("executed", this.__subdisplayApiExecutedHandler);

      /* INITIAL DISCOVERY */

      setTimeout(() => {
        refreshSubTextOptions();
      }, 0);

      setTimeout(() => {
        refreshSubTextOptions();
      }, 100);

      setTimeout(() => {
        refreshSubTextOptions();
      }, 300);

      /* INITIAL SIZE */

      // Keep saved workflow dimensions when the node is reconstructed.
      this.size = [Math.max(360, this.size?.[0] || 360), Math.max(250, this.size?.[1] || 250)];

      setTimeout(() => {
        if (typeof this.onResize === "function") {
          this.onResize(this.size);
        }
      }, 50);

      return this;
    };

    /* ========================================================
       RESIZE
       ======================================================== */

    nodeType.prototype.onResize = function (size) {
      const minWidth = 360;
      const minHeight = 250;

      if (size[0] < minWidth) {
        size[0] = minWidth;
      }

      if (size[1] < minHeight) {
        size[1] = minHeight;
      }

      this.size[0] = size[0];
      this.size[1] = size[1];

      // The DOM widget's flex column owns its internal height. Do NOT size the
      // text container from this.size: Vue measures the DOM back into node
      // height, so any extra padding/row height creates a positive feedback
      // loop on every resize. The render box scrolls instead of growing.

      this.setDirtyCanvas(true, true);
    };

    /* ========================================================
       CONFIGURE
       ======================================================== */

    const originalConfigure = nodeType.prototype.configure;

    nodeType.prototype.configure = function (info) {
      if (originalConfigure) {
        originalConfigure.apply(this, arguments);
      }

      this.properties = this.properties || {};

      // Workflow deserialization can refresh the widget state: reapply both
      // the legacy and Vue visibility flags without changing its saved value.
      const uniqueNameWidget = hideNativeNameWidget(this);
      this.__resolvedUniqueName = String(uniqueNameWidget?.value ?? "").trim();

      if (this.properties.__subdisplayLastText !== undefined && this.properties.__subdisplayLastText !== null) {
        this.__resolvedMarkdownText = String(this.properties.__subdisplayLastText);

        if (this.__renderBox) {
          this.__renderBox.innerHTML = parseMarkdown(this.__resolvedMarkdownText);

          /* LOAD SAVED FONT SIZE CONFIGURATION */
          if (this.properties.__subdisplayFontSize) {
            this.__renderBox.style.fontSize = `${this.properties.__subdisplayFontSize}px`;
            this.__renderBox.style.lineHeight = `${1.2 + this.properties.__subdisplayFontSize * 0.02}`;
          }
        }
      }

      setTimeout(() => {
        if (this.__refreshSubTextOptions) {
          this.__refreshSubTextOptions();
        }
      }, 0);
    };

    /* ========================================================
       EXECUTED
       ======================================================== */

    const originalExecuted = nodeType.prototype.onExecuted;

    nodeType.prototype.onExecuted = function (message) {
      if (originalExecuted) {
        originalExecuted.apply(this, arguments);
      }

      // Some frontend versions refresh the SubDisplay node after SubText has
      // run without delivering the inner SubText callback to the visible layer.
      // Reconcile any cached SubText result; incoming API events update live.
      this.__resolveSelectedSubText?.(false);
    };

    /* ========================================================
       REMOVED
       ======================================================== */

    const originalRemoved = nodeType.prototype.onRemoved;

    nodeType.prototype.onRemoved = function () {
      if (this.__subtextNameChangedHandler) {
        window.removeEventListener("subtext-name-changed", this.__subtextNameChangedHandler);
      }

      if (this.__subtextExecutedHandler) {
        window.removeEventListener("subtext-executed", this.__subtextExecutedHandler);
      }
      if (this.__subdisplayApiExecutedHandler) {
        api.removeEventListener("executed", this.__subdisplayApiExecutedHandler);
      }

      if (originalRemoved) {
        originalRemoved.apply(this, arguments);
      }
    };
  },
});
