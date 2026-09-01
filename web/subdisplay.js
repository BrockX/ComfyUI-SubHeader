import { app } from "../../scripts/app.js";

const EXTENSION_NAME = "ComfyUI.SubDisplay";
const NODE_TYPE = "SubDisplay";

const css = document.createElement("link");
css.rel = "stylesheet";
css.href = new URL("./subdisplay.css", import.meta.url).href;
if (!document.querySelector(`link[href="${css.href}"]`)) {
  document.head.appendChild(css);
}

function parseMarkdown(text) {
  if (!text) return "<span style='color:#606875; font-style:italic;'>Waiting for prompt execution...</span>";

  let html = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // Inline styling helper (Bold, Italic, Code)
  const applyInlineFormatting = txt => {
    return txt
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/`(.*?)`/g, "<code>$1</code>");
  };

  const lines = html.split("\n");
  let result = [];
  let inTable = false;

  for (let line of lines) {
    let trimmed = line.trim();

    // 1. Table Handling (Clean markup passing presentation layout directly to CSS rules)
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      if (trimmed.includes("---")) continue; // Skip markdown separator line

      let cells = trimmed
        .split("|")
        .map(c => c.trim())
        .filter((c, i, a) => i > 0 && i < a.length - 1);
      let rowHTML = cells.map(c => `<td>${applyInlineFormatting(c)}</td>`).join("");

      if (!inTable) {
        result.push("<table>");
        inTable = true;
        result.push(`<tr>${rowHTML}</tr>`);
      } else {
        result.push(`<tr>${rowHTML}</tr>`);
      }
      continue;
    } else if (inTable) {
      result.push("</table>");
      inTable = false;
    }

    // 2. Block Elements Handling
    if (line.startsWith("# ")) {
      result.push(`<h1>${line.slice(2)}</h1>`);
    } else if (line.startsWith("## ")) {
      result.push(`<h2>${line.slice(3)}</h2>`);
    } else if (trimmed === "---") {
      // 🚀 NOUVEAU : Séparateur horizontal HTML stylisé
      result.push("<hr style='border: none; border-top: 1px solid rgba(255,255,255,0.08); margin: 8px 0;'>");
    } else if (trimmed.startsWith("&gt;") || trimmed.startsWith(">")) {
      let quoteText = trimmed.startsWith("&gt;") ? trimmed.slice(4).trim() : trimmed.slice(1).trim();
      result.push(
        `<blockquote style='border-left:3px solid #61afef; padding-left:8px; margin:4px 0; color:#abb2bf; font-style:italic;'>${applyInlineFormatting(quoteText)}</blockquote>`,
      );
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      result.push(
        `<ul style='margin:2px 0; padding-left:20px;'><li style='margin-bottom:2px;'>${applyInlineFormatting(trimmed.slice(2))}</li></ul>`,
      );
    } else if (trimmed === "") {
      result.push("<div style='height: 6px;'></div>");
    } else {
      result.push(`<p style='margin: 0 0 4px 0;'>${applyInlineFormatting(line)}</p>`);
    }
  }

  if (inTable) result.push("</table>");
  return result.join("");
}

app.registerExtension({
  name: EXTENSION_NAME,

  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name !== NODE_TYPE) return;

    const originalExecuted = nodeType.prototype.onExecuted;
    nodeType.prototype.onExecuted = function (message) {
      if (originalExecuted) originalExecuted.apply(this, arguments);

      if (this.__renderBox && message?.text) {
        const textReceived = Array.isArray(message.text) ? message.text[0] : message.text;
        this.__resolvedMarkdownText = String(textReceived || "");
        this.__renderBox.innerHTML = parseMarkdown(this.__resolvedMarkdownText);
        this.setDirtyCanvas(true, true);
        if (app.canvas) app.canvas.setDirty(true, true);
      }
    };

    nodeType.prototype.onResize = function (size) {
      // 🚀 NOUVELLES LIMITES: Largeur mini 360px et Hauteur mini 250px
      const minWidth = 360;
      const minHeight = 250;

      if (size[0] < minWidth) size[0] = minWidth;
      if (size[1] < minHeight) size[1] = minHeight;

      // Application stricte aux dimensions physiques de LiteGraph
      this.size[0] = size[0];
      this.size[1] = size[1];

      // Ajustement dynamique du bloc de texte pour éviter le clipping à 250px
      const configWidget = this.widgets_dom?.find(w => w.name === "SUBDISPLAY_CONFIG_UI");
      if (configWidget && configWidget.element) {
        const textContainer = configWidget.element.querySelector(".subdisplay-ui");
        const elementList = configWidget.element.querySelector(".subheader-element-list");

        if (textContainer) {
          // Récupère la hauteur exacte occupée par les boutons (NAME + Toggle)
          const configHeight = elementList ? elementList.getBoundingClientRect().height : 76;

          // Soustraction chirurgicale pour utiliser tout le reste du nœud sans déborder
          const remainingHeight = this.size[1] - configHeight - 32;

          // On applique la taille restante (minimum 40px à 250px de haut)
          textContainer.style.height = `${Math.max(40, remainingHeight)}px`;
        }
      }

      if (typeof this.setDirtyCanvas === "function") {
        this.setDirtyCanvas(true, true);
      }
    };

    nodeType.prototype.onNodeCreated = function () {
      // 🚀 NETTOYAGE STRICT : On vide tout pour supprimer le slot fantôme invisible
      if (this.inputs) {
        while (this.inputs.length > 0) {
          this.removeInput(0);
        }
      }

      // 🚀 RECRÉATION PROPRE : On n'ajoute que l'unique slot "text" officiel requis
      this.addInput("text", "STRING");

      // 1. ABSOLUTE HIDING OF ALL COMFYUI NATIVE WIDGETS
      if (this.widgets) {
        for (const w of this.widgets) {
          w.hidden = true;
          w.computeSize = () => [0, -4];
        }
      }

      // Retrieve references to the hidden data widgets
      const textWidget = this.widgets?.find(w => w.name === "text");
      const titleWidget = this.widgets?.find(w => w.name === "title");
      const toggleWidget = this.widgets?.find(w => w.name === "display_on_subgraph");

      // Initialize default internal properties
      this.__resolvedTitle = titleWidget ? titleWidget.value : "Sub Display Title";

      // 🚀 MASTER CONTAINER: Unifié via les classes CSS
      const masterContainer = document.createElement("div");
      masterContainer.className = "subdisplay-master-container";

      // 2. CREATION OF THE CONFIGURATION PANEL (SUBHEADER STYLE)
      const configContainer = document.createElement("div");
      configContainer.className = "subheader-ui";

      const elementList = document.createElement("div");
      elementList.className = "subheader-element-list";

      // --- ROW 1 : THE CUSTOM CARD TITLE FIELD ---
      const titleRow = document.createElement("div");
      titleRow.className = "subheader-element-row";

      const titleCard = document.createElement("div");
      titleCard.className = "subheader-element-card";

      const titleLabel = document.createElement("span");
      titleLabel.className = "subheader-position-label";
      titleLabel.innerText = "NAME";

      const titleInput = document.createElement("input");
      titleInput.className = "subheader-inline-name";
      titleInput.type = "text";
      titleInput.value = this.__resolvedTitle;
      titleInput.placeholder = "Enter custom display title...";

      titleInput.addEventListener("mousedown", e => e.stopPropagation());
      titleInput.addEventListener("input", () => {
        this.__resolvedTitle = titleInput.value;
        if (titleWidget) titleWidget.value = titleInput.value;
        if (app.canvas) app.canvas.setDirty(true, true);
      });

      titleCard.appendChild(titleLabel);
      titleCard.appendChild(titleInput);
      titleRow.appendChild(titleCard);
      elementList.appendChild(titleRow);

      // --- ROW 2 : THE CUSTOM CARD ON/OFF TOGGLE SWITCH ---
      const toggleRow = document.createElement("div");
      toggleRow.className = "subheader-element-row";

      const toggleCard = document.createElement("div");
      toggleCard.className = "subheader-element-card";

      const toggleText = document.createElement("span");
      toggleText.className = "subheader-position-text";
      toggleText.innerText = "Display on Subgraph Node";

      const toggleBtn = document.createElement("button");
      toggleBtn.className = "subheader-add-button";

      const updateToggleUI = isActive => {
        toggleBtn.innerText = isActive ? "ACTIVE" : "HIDDEN";
        toggleBtn.style.color = isActive ? "#98c379" : "var(--sh-muted)";
        toggleBtn.style.borderColor = isActive ? "#48563e" : "var(--sh-border)";
        toggleBtn.style.background = isActive ? "#1e261b" : "var(--sh-panel2)";
      };

      const isInitialActive = toggleWidget ? !!toggleWidget.value : true;
      updateToggleUI(isInitialActive);

      toggleBtn.addEventListener("mousedown", e => e.stopPropagation());
      toggleBtn.addEventListener("click", () => {
        if (toggleWidget) {
          toggleWidget.value = !toggleWidget.value;
          updateToggleUI(toggleWidget.value);
          if (app.canvas) app.canvas.setDirty(true, true);
        }
      });

      toggleCard.appendChild(toggleText);
      toggleCard.appendChild(toggleBtn);
      toggleRow.appendChild(toggleCard);
      elementList.appendChild(toggleRow);

      configContainer.appendChild(elementList);

      // 3. THE DEDICATED INTERNAL HTML MARKDOWN RENDER VIEW
      const container = document.createElement("div");
      container.className = "subdisplay-ui";

      const renderBox = document.createElement("div");
      renderBox.className = "subdisplay-render-box";
      renderBox.innerHTML = parseMarkdown("");

      renderBox.addEventListener("mousedown", e => e.stopPropagation());
      renderBox.addEventListener("wheel", e => e.stopPropagation());

      container.appendChild(renderBox);

      // 🚀 COMPACT FIX : On supprime le ResizeObserver automatique qui bloquait la hauteur sous les 400px
      configContainer.appendChild(container);
      this.addDOMWidget("subdisplay_config_ui", "SUBDISPLAY_CONFIG_UI", configContainer, { serialize: false });

      this.__renderBox = renderBox;

      // Taille initiale par défaut au premier draw (360x250)
      this.size = [360, 250];

      // On applique immédiatement le calcul de hauteur initial
      setTimeout(() => {
        if (typeof this.onResize === "function") this.onResize(this.size);
      }, 50);

      return this;
    };

    nodeType.prototype.onRemoved = function () {
      if (this.__subDisplayResizeObserver) this.__subDisplayResizeObserver.disconnect();
    };
  },
});

/* ============================================================
   ENGINE PART 1 : CLEAN LAYOUT CONFIGURATION (ON/OFF)
   ============================================================ */
const patchedPrototypes = new WeakSet();
const EX_HEADER_HEIGHT = 28; // Allocated space for the separator and title

function getSubDisplayInternalData(subgraphNode) {
  const graph = subgraphNode.subgraph;
  if (!graph || !graph._nodes) return null;

  const subDisplayNode = graph._nodes.find(node => node && node.type === "SubDisplay");
  if (!subDisplayNode) return null;

  // 1. Gestion de l'interrupteur ON/OFF
  const toggleWidget = subDisplayNode.widgets?.find(w => w.name === "display_on_subgraph");
  if (toggleWidget && toggleWidget.value === false) return null;

  // 2. 🚀 FIX FIRST DRAW TITLE: Extraction robuste avec fallback strict du titre par défaut
  let title = "Sub Display Title";
  const titleWidget = subDisplayNode.widgets?.find(w => w.name === "title");

  if (titleWidget && titleWidget.value) {
    title = titleWidget.value;
  } else if (subDisplayNode.widgets_values && Array.isArray(subDisplayNode.widgets_values)) {
    // Si la page vient d'être rechargée, on vérifie l'index de sauvegarde du titre
    if (subDisplayNode.widgets_values[1] !== undefined && subDisplayNode.widgets_values[1] !== "") {
      title = subDisplayNode.widgets_values[1];
    }
  } else if (subDisplayNode.widgets && Array.isArray(subDisplayNode.widgets)) {
    // Fallback ultime : va chercher la valeur par défaut définie directement dans le widget d'origine
    const defaultTitleWidget = subDisplayNode.widgets.find(w => w.name === "title");
    if (defaultTitleWidget && defaultTitleWidget.value) {
      title = defaultTitleWidget.value;
    }
  }

  // 3. Extraction de la chaîne de texte Markdown
  const text = subDisplayNode.__resolvedMarkdownText || "";

  return { title: title, text: text };
}

function calculateDynamicBoxHeight(text) {
  if (!text) return 40;
  const lines = text.split("\n");
  let height = 20;
  for (const line of lines) {
    if (line.trim().startsWith("|"))
      height += 22; // Larger line height for table cells
    else height += 16;
  }
  return Math.max(40, Math.min(400, height)); // Raised cap constraint to fit custom content arrays safely
}

function createVisualLayoutItem(subgraphNode, data) {
  // Total height = 0 if hidden by the ON/OFF button, otherwise (Header + Content)
  let totalHeight = 0;
  if (data) {
    totalHeight = EX_HEADER_HEIGHT + calculateDynamicBoxHeight(data.text);
  }

  return {
    __subDisplayVisual: true,
    __subDisplayNode: subgraphNode,
    name: `__subdisplay_layout_${subgraphNode.id}_${Math.random()}`,
    canvasOnly: true,
    hidden: data === null,
    y: 0,
    computedHeight: totalHeight,
    computeSize() {
      return [0, totalHeight];
    },
  };
}

/* ============================================================
   ENGINE PART 2 : VECTORIAL MARKDOWN DRAWING WITH AUTO-WRAP
   ============================================================ */

// 🧠 MOTEUR DE RETOUR À LA LIGNE INTÉGRÉ POUR LE CANVAS
function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, boxBottom, styleApplier) {
  const words = text.split(" ");
  let currentLine = "";
  let lineY = y;

  for (let n = 0; n < words.length; n++) {
    let testLine = currentLine + words[n] + " ";
    ctx.save();
    if (styleApplier) styleApplier(ctx, testLine.trim());
    let metrics = ctx.measureText(testLine.trim());
    ctx.restore();

    if (metrics.width > maxWidth && n > 0) {
      if (lineY + lineHeight <= boxBottom) {
        ctx.save();
        let cleanLine = currentLine.trim();
        if (styleApplier) cleanLine = styleApplier(ctx, cleanLine);
        ctx.fillText(cleanLine, x, lineY);
        ctx.restore();
      }
      currentLine = words[n] + " ";
      lineY += lineHeight;
    } else {
      currentLine = testLine;
    }
  }

  if (lineY + lineHeight <= boxBottom && currentLine.trim().length > 0) {
    ctx.save();
    let cleanLine = currentLine.trim();
    if (styleApplier) cleanLine = styleApplier(ctx, cleanLine);
    ctx.fillText(cleanLine, x, lineY);
    ctx.restore();
    lineY += lineHeight;
  }
  return lineY;
}

function drawDynamicVisualBox(ctx, visual, width, data) {
  if (!data) return;

  let startY = visual.y;
  ctx.save();

  // 1. DESSINE LA LIGNE DE SÉPARATION SOUS L'EN-TÊTE NATIF
  ctx.strokeStyle = "#59616d";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(8, startY + 2);
  ctx.lineTo(width - 8, startY + 2);
  ctx.stroke();

  // 2. DESSINE L'EN-TÊTE DU TITRE
  ctx.fillStyle = "#808895";
  ctx.font = "700 11px Inter, system-ui, sans-serif";
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.fillText(data.title.toUpperCase(), width / 2, startY + 15);

  // 3. DESSINE LE FOND DE BOÎTE SOMBRE (COPIE DU RENDU INTERNE)
  let boxY = startY + EX_HEADER_HEIGHT + 2;
  let boxHeight = visual.computedHeight - EX_HEADER_HEIGHT - 6;
  let boxBottom = boxY + boxHeight;

  ctx.fillStyle = "#111317";
  ctx.strokeStyle = "#292f38";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(8, boxY, width - 16, boxHeight, 5);
  ctx.fill();
  ctx.stroke();

  // 4. INTERPRÉTEUR TEXTUEL MARKDOWN AVEC RETOUR À LA LIGNE
  ctx.textBaseline = "top";
  ctx.textAlign = "left";

  const lines = (data.text || "Waiting for prompt execution...").split("\n");
  let currentLineY = boxY + 10;
  let isFirstTableRow = true;
  const maxTextWidth = width - 36; // Marge pour empêcher le texte de toucher le bord de la boîte

  // Assistant d'interprétation des styles de police (Gras, Italique, Code)
  const parseInlineCanvasStyle = (ctx, text) => {
    let currentFont = ctx.font;
    if (text.startsWith("**") && text.endsWith("**")) {
      ctx.font = currentFont.replace("400", "700").replace("italic", "").trim();
      return text.slice(2, -2);
    }
    if (text.startsWith("*") && text.endsWith("**") === false && text.endsWith("*")) {
      ctx.font = "italic " + currentFont.replace("italic", "").trim();
      return text.slice(1, -1);
    }
    if (text.startsWith("`") && text.endsWith("`")) {
      ctx.font = "400 11px monospace";
      ctx.fillStyle = "#da7685";
      return text.slice(1, -1);
    }
    return text;
  };

  for (const line of lines) {
    let trimmed = line.trim();
    if (currentLineY + 16 > boxBottom) break; // Arrête d'écrire si on déborde du cadre inférieur

    // A. Rendu horizontal centré des Tableaux Markdown (Demande du projet)
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      if (trimmed.includes("---")) continue;

      let cells = trimmed
        .split("|")
        .map(c => c.trim())
        .filter((c, i, a) => i > 0 && i < a.length - 1);
      let colWidth = (width - 32) / cells.length;

      if (isFirstTableRow) {
        ctx.fillStyle = "#1e222a"; // Fond d'en-tête distinctive calqué sur le CSS
        ctx.fillRect(12, currentLineY - 2, width - 24, 20);
      }

      for (let i = 0; i < cells.length; i++) {
        ctx.save();
        ctx.fillStyle = isFirstTableRow ? "#e5c07b" : "#e7e9ed";
        ctx.font = isFirstTableRow ? "700 11px Inter, sans-serif" : "400 11px Inter, sans-serif";
        ctx.textAlign = "center"; // 🚀 COPIE EXACTE : Texte centré à l'intérieur des cellules !

        let cellText = parseInlineCanvasStyle(ctx, cells[i]);

        // Sécurité anti-débordement de cellule
        let metrics = ctx.measureText(cellText);
        if (metrics.width > colWidth - 8) {
          cellText = cellText.slice(0, Math.floor((colWidth - 12) / 6)) + "...";
        }

        ctx.fillText(cellText, 16 + i * colWidth + colWidth / 2, currentLineY);
        ctx.restore();
      }

      isFirstTableRow = false;
      currentLineY += 22;
      continue;
    }
    isFirstTableRow = true;

    // B. Citation Markdown (Barre latérale bleue + texte grisé italique)
    if (trimmed.startsWith(">")) {
      ctx.fillStyle = "#61afef";
      ctx.fillRect(16, currentLineY, 3, 14);
      ctx.fillStyle = "#abb2bf";
      ctx.font = "italic 400 11px Inter, system-ui, sans-serif";

      currentLineY = drawWrappedText(
        ctx,
        trimmed.slice(1).trim(),
        26,
        currentLineY,
        maxTextWidth - 10,
        16,
        boxBottom,
        parseInlineCanvasStyle,
      );
      continue;
    }

    // C. Listes à puces (Affiche un vrai point d'ancrage • bleu)
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      ctx.fillStyle = "#61afef";
      ctx.font = "400 11px Inter, sans-serif";
      ctx.fillText("•", 16, currentLineY);
      ctx.fillStyle = "#e7e9ed";

      currentLineY = drawWrappedText(
        ctx,
        trimmed.slice(2).trim(),
        26,
        currentLineY,
        maxTextWidth - 10,
        16,
        boxBottom,
        parseInlineCanvasStyle,
      );
      continue;
    }

    // D. Titres # et ## et Séparateurs
    if (line.startsWith("# ")) {
      ctx.fillStyle = "#e5c07b";
      ctx.font = "700 13px Inter, system-ui, sans-serif";
      currentLineY = drawWrappedText(ctx, line.slice(2), 16, currentLineY, maxTextWidth, 20, boxBottom, null);
    } else if (line.startsWith("## ")) {
      ctx.fillStyle = "#61afef";
      ctx.font = "600 12px Inter, system-ui, sans-serif";
      currentLineY = drawWrappedText(ctx, line.slice(3), 16, currentLineY, maxTextWidth, 18, boxBottom, null);
    } else if (trimmed === "---") {
      ctx.save();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(16, currentLineY + 6);
      ctx.lineTo(width - 16, currentLineY + 6);
      ctx.stroke();
      ctx.restore();
      currentLineY += 14;
    } else if (trimmed === "") {
      currentLineY += 8;
    } else {
      ctx.fillStyle = "#e7e9ed";
      ctx.font = "400 11px Inter, system-ui, sans-serif";
      currentLineY = drawWrappedText(ctx, line, 16, currentLineY, maxTextWidth, 16, boxBottom, parseInlineCanvasStyle);
    }
  }

  ctx.restore();
}

function patchSubgraphPrototype(subgraphNode) {
  if (!subgraphNode || typeof subgraphNode.isSubgraphNode !== "function" || !subgraphNode.isSubgraphNode()) {
    return false;
  }

  const prototype = Object.getPrototypeOf(subgraphNode);
  if (!prototype || patchedPrototypes.has(prototype)) return true;
  patchedPrototypes.add(prototype);

  // Hook 1 : Allocation de l'espace physique pour le Layout
  const originalLayout = prototype.getLayoutWidgets;
  if (typeof originalLayout === "function") {
    prototype.getLayoutWidgets = function () {
      const realWidgets = originalLayout.call(this) || [];
      const data = getSubDisplayInternalData(this);
      const layout = [...realWidgets];
      layout.push(createVisualLayoutItem(this, data));
      this.__subDisplayVisualWidgets = layout.filter(item => item && item.__subDisplayVisual);
      return layout;
    };
  }

  // Hook 2 : Lancement immédiat du tracé graphique sur le Canvas
  const originalDraw = prototype.drawWidgets;
  if (typeof originalDraw === "function") {
    prototype.drawWidgets = function (ctx, options) {
      originalDraw.call(this, ctx, options);
      const visuals = this.__subDisplayVisualWidgets;
      if (!visuals) return;
      const data = getSubDisplayInternalData(this);

      ctx.save();
      for (const visual of visuals) {
        if (visual && visual.y != null) {
          // Dessine le titre et le texte en pixels natifs sans toucher au HTML
          drawDynamicVisualBox(ctx, visual, this.size[0], data);
        }
      }
      ctx.restore();
    };
  }

  // Hook 3 : Ajustement dynamique de la taille physique du sous-graphe
  const originalSize = prototype.computeSize;
  if (typeof originalSize === "function") {
    prototype.computeSize = function (out) {
      const size = originalSize.call(this, out) || [0, 0];
      const data = getSubDisplayInternalData(this);
      if (data) {
        size[1] += calculateDynamicBoxHeight(data.text) + EX_HEADER_HEIGHT + 4;
      }
      size[0] = Math.max(size[0], 360);
      return size;
    };
  }

  return true;
}

function refreshSubgraphs() {
  if (!app.graph || !app.graph._nodes) return;
  for (const node of app.graph._nodes) {
    if (node && typeof node.isSubgraphNode === "function" && node.isSubgraphNode()) {
      patchSubgraphPrototype(node);
    }
  }
}

setInterval(refreshSubgraphs, 500);
