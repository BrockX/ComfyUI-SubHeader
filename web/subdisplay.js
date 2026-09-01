import { app } from "../../scripts/app.js";

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

/* ============================================================
   MARKDOWN
   ============================================================ */

function parseMarkdown(text) {
  if (!text) {
    return "<span style='color:#606875; font-style:italic;'>Waiting for prompt execution...</span>";
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
        const headerCellsHTML = headerRow.map(cell => `<td>${applyInlineFormatting(cell)}</td>`).join("");
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

  if (!target || !app.graph) {
    return null;
  }

  const nodes = collectSubTextNodes(app.graph);

  for (const node of nodes) {
    if (getSubTextUniqueName(node) === target) {
      return node;
    }
  }

  return null;
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

    nodeType.prototype.onNodeCreated = function () {
      /* REMOVE PHYSICAL INPUTS */

      if (this.inputs) {
        while (this.inputs.length > 0) {
          this.removeInput(0);
        }
      }

      /* HIDE NATIVE WIDGETS */

      if (this.widgets) {
        for (const widget of this.widgets) {
          widget.hidden = true;
          widget.computeSize = () => [0, -4];
        }
      }

      const uniqueNameWidget = this.widgets?.find(w => w && w.name === "unique_name");

      this.__resolvedUniqueName = String(uniqueNameWidget?.value ?? "").trim();

      this.properties = this.properties || {};

      /* MASTER CONTAINER */

      const masterContainer = document.createElement("div");

      masterContainer.className = "subdisplay-master-container";

      const configContainer = document.createElement("div");

      configContainer.className = "subheader-ui";

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

        const subTextNodes = collectSubTextNodes(app.graph);

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

        if (names.includes(previousValue)) {
          selector.value = previousValue;
        } else {
          selector.value = "";
        }

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
      this.properties.__subdisplayFontSize = this.properties.__subdisplayFontSize || 11;

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
           SUBTEXT EXECUTION RESULTS
           ====================================================== */

      this.__subtextExecutedHandler = event => {
        const name = String(event.detail?.name ?? "").trim();

        if (!name || name !== this.__resolvedUniqueName) {
          return;
        }

        renderText(String(event.detail?.text ?? ""));
      };

      window.addEventListener("subtext-executed", this.__subtextExecutedHandler);

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

      this.size = [360, 250];

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

      const configWidget = this.widgets_dom?.find(w => w.name === "SUBDISPLAY_CONFIG_UI");

      if (configWidget?.element) {
        const textContainer = configWidget.element.querySelector(".subdisplay-ui");

        const elementList = configWidget.element.querySelector(".subheader-element-list");

        if (textContainer) {
          const configHeight = elementList ? elementList.getBoundingClientRect().height : 46;

          const remainingHeight = this.size[1] - configHeight - 32;

          textContainer.style.height = `${Math.max(40, remainingHeight)}px`;
        }
      }

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

      const uniqueNameWidget = this.widgets?.find(w => w && w.name === "unique_name");
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

      if (!message) return;
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

      if (originalRemoved) {
        originalRemoved.apply(this, arguments);
      }
    };
  },
});
