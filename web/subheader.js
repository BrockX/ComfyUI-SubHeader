import { app } from "../../scripts/app.js";

/* ============================================================
   CONSTANTS
   ============================================================ */

const EXTENSION_NAME = "ComfyUI.SubHeader";
const NODE_TYPE = "SubHeader";

const ICONS = {
  header: new URL("./src/ico_head.svg", import.meta.url).href,

  line: new URL("./src/ico_line.svg", import.meta.url).href,

  spacing: new URL("./src/ico_space.svg", import.meta.url).href,
};

/* ============================================================
   COLORS
   ============================================================ */

/*
 * The palette is intentionally ordered to match the UI.
 *
 * Header background:
 * NONE | WHITE | LIGHT GREY | DARK GREY
 * PURPLE | BLUE | CYAN | GREEN
 * LIME | YELLOW | ORANGE RED | PINK
 *
 * Header text / line:
 * WHITE | LIGHT GREY | DARK GREY | PURPLE
 * BLUE | CYAN | GREEN | LIME
 * YELLOW | ORANGE RED | PINK | MAGENTA
 */

const COLORS = {
  none: null,

  white: "#f0f3ff",
  lightGrey: "#9eaac2",
  darkGrey: "#272c3c",

  purple: "#9275dd",
  blue: "#538bd3",
  cyan: "#4aafbf",
  green: "#4dad8b",

  lime: "#8fb65e",
  yellow: "#dbb467",
  orangeRed: "#d88161",
  pink: "#d37da9",
  magenta: "#b775d2",
};

/*
 * Display names.
 */

const COLOR_NAMES = {
  none: "NONE",
  white: "WHITE",
  lightGrey: "LIGHT GREY",
  darkGrey: "DARK GREY",

  purple: "PURPLE",
  blue: "BLUE",
  cyan: "CYAN",
  green: "GREEN",

  lime: "LIME",
  yellow: "YELLOW",
  orangeRed: "ORANGE RED",
  pink: "PINK",
  magenta: "MAGENTA",
};

/*
 * Background palette.
 */

const BACKGROUND_COLORS = [
  "none",
  "white",
  "lightGrey",
  "darkGrey",

  "purple",
  "blue",
  "cyan",
  "green",

  "lime",
  "yellow",
  "orangeRed",
  "pink",
];

/*
 * Text / separator palette.
 */

const TEXT_COLORS = ["white", "lightGrey", "darkGrey", "purple", "blue", "cyan", "green", "lime", "yellow", "orangeRed", "pink", "magenta"];

/* ============================================================
   CSS
   ============================================================ */

const css = document.createElement("link");

css.rel = "stylesheet";

css.href = new URL("./subheader.css", import.meta.url).href;

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
   DEFAULT ELEMENTS
   ============================================================ */

function createElement(type) {
  if (type === "header") {
    return {
      type: "header",
      position: 1,

      text: "HEADER",

      textColor: "white",
      backgroundColor: "none",

      alignment: "center",
    };
  }

  if (type === "line") {
    return {
      type: "line",
      position: 1,

      color: "lightGrey",

      thickness: 1,
    };
  }

  return {
    type: "spacing",
    position: 1,

    height: 32,
  };
}

/* ============================================================
   UTILITIES
   ============================================================ */

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createElementDOM(tag, className) {
  const element = document.createElement(tag);

  if (className) {
    element.className = className;
  }

  return element;
}

function getConfiguration(node) {
  const widget = node.widgets?.find(widget => widget.name === "configuration");

  if (!widget) {
    return [];
  }

  try {
    const value = JSON.parse(widget.value || "[]");

    if (!Array.isArray(value)) {
      return [];
    }

    return value;
  } catch {
    return [];
  }
}

function saveConfiguration(node, elements) {
  const widget = node.widgets?.find(widget => widget.name === "configuration");

  if (!widget) {
    return;
  }

  widget.value = JSON.stringify(elements);

  if (typeof widget.callback === "function") {
    widget.callback(widget.value);
  }

  node.setDirtyCanvas(true, true);

  refreshSubgraphs();
}

/* ============================================================
   COLOR HELPERS
   ============================================================ */

function getColor(name, fallback) {
  if (name === "none") {
    return null;
  }

  return COLORS[name] || COLORS[fallback] || COLORS.white;
}

function applyColor(element, property, target) {
  const color = getColor(element[property], "white");

  if (color === null) {
    target.style.background = "transparent";

    target.style.backgroundColor = "transparent";

    return;
  }

  target.style.background = color;
}

/* ============================================================
   COLOR PALETTE
   ============================================================ */

function createColorPalette(selected, colors, callback) {
  const palette = createElementDOM("div", "subheader-color-palette");

  for (const name of colors) {
    const button = createElementDOM("button", "subheader-color-option");

    button.type = "button";

    button.dataset.color = name;

    button.title = COLOR_NAMES[name] || name;

    if (name === "none") {
      button.classList.add("none");
    } else {
      button.style.background = COLORS[name];
    }

    if (name === selected) {
      button.classList.add("selected");
    }

    button.addEventListener("click", () => {
      callback(name);

      for (const child of palette.children) {
        child.classList.toggle("selected", child.dataset.color === name);
      }
    });

    palette.appendChild(button);
  }

  return palette;
}

/* ============================================================
   ICON
   ============================================================ */

function createIcon(type) {
  const image = document.createElement("img");

  image.className = "subheader-type-icon";

  image.src = ICONS[type];

  image.alt = "";

  return image;
}

/* ============================================================
   DELETE BUTTON
   ============================================================ */

function createInlineDeleteButton(node, elements, index) {
  const button = createElementDOM("button", "subheader-delete-button");

  button.type = "button";

  button.textContent = "❌";

  button.title = "Delete";

  button.addEventListener("click", event => {
    event.stopPropagation();

    elements.splice(index, 1);

    saveConfiguration(node, elements);

    rebuildUI(node);
  });

  return button;
}

/* ============================================================
   POSITION INPUT
   ============================================================ */

function createPositionInput(element, node, elements) {
  const wrapper = createElementDOM("div", "subheader-position");

  const input = document.createElement("input");

  input.type = "number";

  input.min = "1";

  input.step = "1";

  input.value = Math.max(1, Number(element.position || 1));

  input.addEventListener("change", () => {
    element.position = Math.max(1, parseInt(input.value) || 1);

    input.value = element.position;

    saveConfiguration(node, elements);
  });

  wrapper.appendChild(input);

  return wrapper;
}

/* ============================================================
   SETTINGS BUTTON
   ============================================================ */

function createSettingsButton(node, element, elements, index) {
  const button = createElementDOM("button", "subheader-settings-button");

  button.type = "button";

  button.textContent = "⚙";

  button.title = "Settings";

  button.addEventListener("click", event => {
    event.stopPropagation();

    openSettings(node, element, elements, index);
  });

  return button;
}

/* ============================================================
   DRAG HANDLE
   ============================================================ */

function createDragHandle(node, element, elements, index) {
  const handle = createElementDOM("div", "subheader-drag-handle");

  handle.textContent = "⋮⋮";

  handle.title = "Drag to reorder";

  handle.draggable = true;

  handle.addEventListener("dragstart", event => {
    event.stopPropagation();

    const row = handle.closest(".subheader-element-row");

    if (!row) {
      return;
    }

    row.classList.add("dragging");

    node.__subHeaderDragIndex = index;

    event.dataTransfer.effectAllowed = "move";

    event.dataTransfer.setData("text/plain", String(index));
  });

  handle.addEventListener("dragend", () => {
    const row = handle.closest(".subheader-element-row");

    row?.classList.remove("dragging");

    node.__subHeaderDragIndex = null;

    node.__subHeaderDragOverIndex = null;

    node.__subHeaderContainer?.querySelectorAll(".subheader-element-row").forEach(item => item.classList.remove("drag-over"));
  });

  return handle;
}

/* ============================================================
   DRAG / DROP ROW
   ============================================================ */

function makeRowDraggable(row, node, elements, index) {
  row.addEventListener("dragover", event => {
    event.preventDefault();

    if (node.__subHeaderDragIndex === null || node.__subHeaderDragIndex === undefined) {
      return;
    }

    if (node.__subHeaderDragIndex === index) {
      return;
    }

    node.__subHeaderDragOverIndex = index;

    row.classList.add("drag-over");

    event.dataTransfer.dropEffect = "move";
  });

  row.addEventListener("dragleave", event => {
    if (!row.contains(event.relatedTarget)) {
      row.classList.remove("drag-over");
    }
  });

  row.addEventListener("drop", event => {
    event.preventDefault();

    const from = node.__subHeaderDragIndex;

    const to = index;

    if (from === null || from === undefined || from === to) {
      return;
    }

    const moved = elements.splice(from, 1)[0];

    elements.splice(to, 0, moved);

    saveConfiguration(node, elements);

    node.__subHeaderDragIndex = null;

    node.__subHeaderDragOverIndex = null;

    rebuildUI(node);
  });
}

/* ============================================================
   HEADER CARD
   ============================================================ */

function createHeaderCard(node, element, elements, index) {
  const row = createElementDOM("div", "subheader-element-row");

  row.appendChild(createDragHandle(node, element, elements, index));

  const card = createElementDOM("div", "subheader-element-card");

  const left = createElementDOM("div", "subheader-card-left");

  left.appendChild(createIcon("header"));

  left.appendChild(createSettingsButton(node, element, elements, index));

  const name = document.createElement("input");

  name.type = "text";

  name.className = "subheader-inline-name";

  name.value = element.text || "HEADER";

  name.placeholder = "Header name";

  name.addEventListener("input", () => {
    element.text = name.value;

    saveConfiguration(node, elements);
  });

  card.appendChild(left);

  const spacingLabel = createElementDOM("span", "subheader-spacing-label");

  spacingLabel.textContent = "Header";

  card.appendChild(spacingLabel);

  card.appendChild(name);

  const positionLabel = createElementDOM("span", "subheader-position-label");

  positionLabel.textContent = "POS";

  card.appendChild(positionLabel);

  card.appendChild(createPositionInput(element, node, elements));

  row.appendChild(card);

  row.appendChild(createInlineDeleteButton(node, elements, index));

  makeRowDraggable(row, node, elements, index);

  return row;
}

/* ============================================================
   LINE CARD
   ============================================================ */

function createLineCard(node, element, elements, index) {
  const row = createElementDOM("div", "subheader-element-row");

  row.appendChild(createDragHandle(node, element, elements, index));

  const card = createElementDOM("div", "subheader-element-card");

  const left = createElementDOM("div", "subheader-card-left");

  left.appendChild(createIcon("line"));

  left.appendChild(createSettingsButton(node, element, elements, index));

  card.appendChild(left);

  const spacingLabel = createElementDOM("span", "subheader-spacing-label");

  const control = createElementDOM("div", "subheader-spacing-control");

  spacingLabel.textContent = "Line";

  card.appendChild(spacingLabel);

  card.appendChild(control);

  const positionLabel = createElementDOM("span", "subheader-position-label");

  positionLabel.textContent = "POS";

  card.appendChild(positionLabel);

  card.appendChild(createPositionInput(element, node, elements));

  row.appendChild(card);

  row.appendChild(createInlineDeleteButton(node, elements, index));

  makeRowDraggable(row, node, elements, index);

  return row;
}

/* ============================================================
   SPACING CARD
   ============================================================ */

function createSpacingCard(node, element, elements, index) {
  const row = createElementDOM("div", "subheader-element-row");

  row.appendChild(createDragHandle(node, element, elements, index));

  const card = createElementDOM("div", "subheader-element-card");

  card.classList.add("subheader-spacing-card");

  const left = createElementDOM("div", "subheader-card-left");

  left.appendChild(createIcon("spacing"));

  card.appendChild(left);

  const spacingLabel = createElementDOM("span", "subheader-spacing-label");

  spacingLabel.textContent = "Spacing";

  card.appendChild(spacingLabel);

  const control = createElementDOM("div", "subheader-spacing-control");

  const slider = document.createElement("input");

  slider.type = "range";

  slider.min = "10";

  slider.max = "50";

  slider.step = "1";

  slider.value = Math.max(10, Math.min(50, Number(element.height ?? 32)));

  slider.className = "subheader-spacing-range";

  const value = createElementDOM("span", "subheader-spacing-value");

  value.textContent = `${slider.value}px`;

  slider.addEventListener("input", () => {
    element.height = Math.max(10, Math.min(50, parseInt(slider.value) || 32));

    value.textContent = `${element.height}px`;

    saveConfiguration(node, elements);

    refreshSubgraphs();
  });

  control.appendChild(slider);

  control.appendChild(value);

  card.appendChild(control);

  const positionLabel = createElementDOM("span", "subheader-position-label");

  positionLabel.textContent = "POS";

  card.appendChild(positionLabel);

  card.appendChild(createPositionInput(element, node, elements));

  row.appendChild(card);

  row.appendChild(createInlineDeleteButton(node, elements, index));

  makeRowDraggable(row, node, elements, index);

  return row;
}

/* ============================================================
   ELEMENT CARD DISPATCH
   ============================================================ */

function createElementCard(node, element, elements, index) {
  /*
   * Backwards compatibility.
   */

  if (element.type === "separator") {
    element.type = "line";
  }

  /*
   * Migrate old color defaults.
   */

  if (element.type === "header") {
    if (!element.textColor) {
      element.textColor = "white";
    }

    if (element.backgroundColor === undefined) {
      element.backgroundColor = "none";
    }

    return createHeaderCard(node, element, elements, index);
  }

  if (element.type === "line") {
    if (!element.color) {
      element.color = "lightGrey";
    }

    return createLineCard(node, element, elements, index);
  }

  return createSpacingCard(node, element, elements, index);
}

/* ============================================================
   MAIN UI
   ============================================================ */

function rebuildUI(node) {
  const container = node.__subHeaderContainer;

  if (!container) {
    return;
  }

  container.replaceChildren();

  const elements = getConfiguration(node);
  const intro = createElementDOM("div", "sh-intro");
  const introLeft = createElementDOM("div", "sh-intro-left");
  const eyebrow = createElementDOM("div", "sh-eyebrow");
  eyebrow.textContent = "SUBGRAPH UI";
  const heading = createElementDOM("div", "sh-intro-heading");
  heading.textContent = "Layout builder";
  introLeft.append(eyebrow, heading);
  const count = createElementDOM("span", "sh-element-count");
  count.textContent = `${elements.length} element${elements.length === 1 ? "" : "s"}`;
  intro.append(introLeft, count);
  container.appendChild(intro);

  /*
   * ELEMENT LIST
   */

  const list = createElementDOM("div", "subheader-element-list");

  for (let i = 0; i < elements.length; i++) {
    list.appendChild(createElementCard(node, elements[i], elements, i));
  }

  container.appendChild(list);

  /*
   * ADD LABEL
   */

  const addLabel = createElementDOM("div", "subheader-add-label");

  addLabel.textContent = "ADD";

  container.appendChild(addLabel);

  /*
   * ADD BUTTONS
   */

  const addButtons = createElementDOM("div", "subheader-add-buttons");

  addButtons.appendChild(createAddButton(node, "header", "HEADER"));

  addButtons.appendChild(createAddButton(node, "line", "LINE"));

  addButtons.appendChild(createAddButton(node, "spacing", "SPACE"));

  container.appendChild(addButtons);
  const hint = createElementDOM("p", "sh-position-hint");
  hint.textContent = "Position 1 = before the first promoted control.";
  container.appendChild(hint);

  // Recalculate ONLY the editor's intrinsic height when its contents change.
  // Nodes 2.0 can allocate extra space during a manual node resize. That
  // allocated space must never become the editor's new requested height.
  updateEditorIntrinsicHeight(node, true);
}

/* ============================================================
   INTRINSIC EDITOR SIZING
   ============================================================ */

function updateEditorIntrinsicHeight(node, expandNode = false) {
  const container = node.__subHeaderContainer;
  if (!container) return;

  // .subheader-ui is content-sized (height:auto; flex:none). scrollHeight
  // therefore describes the actual controls, not the enclosing node height.
  const measured = Math.ceil(Number(container.scrollHeight) || 0);
  if (measured > 0) {
    const contentHeight = Math.max(120, measured);
    node.__subHeaderContentHeight = contentHeight;
    // Include a little room for the node title and its widget margins.
    node.__subHeaderMinHeight = Math.max(180, contentHeight + 36);
  }

  if (!expandNode || !node.size) return;

  const minWidth = 360;
  const minHeight = node.__subHeaderMinHeight || 180;
  const width = Math.max(minWidth, Number(node.size[0]) || minWidth);
  const height = Math.max(minHeight, Number(node.size[1]) || 180);
  if (width !== node.size[0] || height > node.size[1]) {
    node.setSize?.([width, height]);
    node.setDirtyCanvas?.(true, true);
  }
}

/* ============================================================
   ADD BUTTON
   ============================================================ */

function createAddButton(node, type, labelText) {
  const button = createElementDOM("button", "subheader-add-button");

  button.type = "button";

  button.appendChild(createIcon(type));

  const label = document.createElement("span");

  label.textContent = labelText;

  button.appendChild(label);

  button.addEventListener("click", event => {
    event.stopPropagation();

    const elements = getConfiguration(node);

    const element = createElement(type);

    /*
     * New elements get the next
     * available position.
     */

    if (elements.length) {
      const highest = Math.max(...elements.map(item => Number(item.position ?? 1)));

      element.position = highest + 1;
    }

    elements.push(element);

    saveConfiguration(node, elements);

    rebuildUI(node);
  });

  return button;
}

/* ============================================================
   SETTINGS MODAL
   ============================================================ */

let activeModal = null;

function closeSettings() {
  if (!activeModal) {
    return;
  }

  activeModal.remove();

  activeModal = null;
}

function createModal() {
  closeSettings();

  const overlay = createElementDOM("div", "subheader-modal-overlay");

  const modal = createElementDOM("div", "subheader-modal");

  overlay.appendChild(modal);

  document.body.appendChild(overlay);

  activeModal = overlay;

  overlay.addEventListener("mousedown", event => {
    if (event.target === overlay) {
      closeSettings();
    }
  });

  return modal;
}

/* ============================================================
   MODAL HEADER
   ============================================================ */

function createModalHeader(modal, title) {
  const header = createElementDOM("div", "subheader-modal-header");

  const titleElement = createElementDOM("div", "subheader-modal-title");

  titleElement.textContent = title;

  header.appendChild(titleElement);

  const close = createElementDOM("button", "subheader-modal-close");

  close.type = "button";

  close.textContent = "×";

  close.addEventListener("click", closeSettings);

  header.appendChild(close);

  modal.appendChild(header);
}

/* ============================================================
   MODAL FIELD
   ============================================================ */

function createModalField(modal, name, control) {
  const field = createElementDOM("div", "subheader-modal-field");

  const fieldLabel = createElementDOM("label", "subheader-modal-label");

  fieldLabel.textContent = name;

  field.appendChild(fieldLabel);

  field.appendChild(control);

  modal.appendChild(field);

  return field;
}

/* ============================================================
   PREVIEW
   ============================================================ */

function createHeaderPreview(element) {
  const preview = createElementDOM("div", "subheader-preview");

  const content = createElementDOM("div", "subheader-preview-header");

  content.textContent = element.text || "HEADER";

  const background = getColor(element.backgroundColor, "purple");

  if (background === null) {
    content.style.background = "transparent";
  } else {
    content.style.background = background;
  }

  content.style.color = getColor(element.textColor, "white") || COLORS.white;

  content.style.fontWeight = "700";

  const alignment = element.alignment || "center";

  content.style.textAlign = alignment;

  preview.appendChild(content);

  return preview;
}

function createLinePreview(element) {
  const preview = createElementDOM("div", "subheader-preview");

  const line = createElementDOM("div", "subheader-preview-line");

  line.style.background = getColor(element.color, "lightGrey");

  line.style.height = `${Math.max(1, Number(element.thickness ?? 1))}px`;

  preview.appendChild(line);

  return preview;
}

/* ============================================================
   HEADER SETTINGS
   ============================================================ */

function openHeaderSettings(node, element, elements, index) {
  const modal = createModal();

  createModalHeader(modal, "Header Settings");

  /*
   * Preview
   */

  const previewLabel = createElementDOM("div", "subheader-preview-label");

  previewLabel.textContent = "PREVIEW";

  modal.appendChild(previewLabel);

  const preview = createHeaderPreview(element);

  modal.appendChild(preview);

  /*
   * Name
   */

  const name = document.createElement("input");

  name.type = "text";

  name.className = "subheader-modal-input";

  name.value = element.text || "";

  name.addEventListener("input", () => {
    element.text = name.value;

    preview.querySelector(".subheader-preview-header").textContent = name.value || "HEADER";

    saveConfiguration(node, elements);

    const cards = node.__subHeaderContainer?.querySelectorAll(".subheader-inline-name");

    const card = cards?.[index];

    if (card) {
      card.value = name.value;
    }
  });

  createModalField(modal, "NAME", name);

  /*
   * Position
   */

  const position = document.createElement("input");

  position.type = "number";

  position.min = "1";

  position.step = "1";

  position.value = element.position ?? 1;

  position.className = "subheader-modal-number";

  position.addEventListener("change", () => {
    element.position = Math.max(1, parseInt(position.value) || 1);

    position.value = element.position;

    saveConfiguration(node, elements);

    rebuildUI(node);
  });

  createModalField(modal, "POSITION", position);

  /*
   * Alignment
   */

  const alignment = document.createElement("select");

  alignment.className = "subheader-modal-select";

  for (const value of ["left", "center", "right"]) {
    const option = document.createElement("option");

    option.value = value;

    option.textContent = value === "center" ? "Centered" : value.charAt(0).toUpperCase() + value.slice(1);

    option.selected = (element.alignment || "center") === value;

    alignment.appendChild(option);
  }

  alignment.addEventListener("change", () => {
    element.alignment = alignment.value;

    preview.querySelector(".subheader-preview-header").style.textAlign = alignment.value;

    saveConfiguration(node, elements);
  });

  createModalField(modal, "ALIGNMENT", alignment);

  /*
   * Background
   */

  const backgroundPalette = createColorPalette(
    element.backgroundColor ?? "none",

    BACKGROUND_COLORS,

    color => {
      element.backgroundColor = color;

      const previewHeader = preview.querySelector(".subheader-preview-header");

      const background = getColor(color, "purple");

      previewHeader.style.background = background ?? "transparent";

      saveConfiguration(node, elements);
    },
  );

  createModalField(modal, "BACKGROUND", backgroundPalette);

  /*
   * Text color
   */

  const textPalette = createColorPalette(
    element.textColor ?? "white",

    TEXT_COLORS,

    color => {
      element.textColor = color;

      const previewHeader = preview.querySelector(".subheader-preview-header");

      previewHeader.style.color = getColor(color, "white") || COLORS.white;

      saveConfiguration(node, elements);
    },
  );

  createModalField(modal, "TEXT COLOR", textPalette);
}

/* ============================================================
   LINE SETTINGS
   ============================================================ */

function openLineSettings(node, element, elements, index) {
  const modal = createModal();

  createModalHeader(modal, "Line Settings");

  /*
   * Preview
   */

  const previewLabel = createElementDOM("div", "subheader-preview-label");

  previewLabel.textContent = "PREVIEW";

  modal.appendChild(previewLabel);

  const preview = createLinePreview(element);

  modal.appendChild(preview);

  /*
   * Position
   */

  const position = document.createElement("input");

  position.type = "number";

  position.min = "1";

  position.step = "1";

  position.value = element.position ?? 1;

  position.className = "subheader-modal-number";

  position.addEventListener("change", () => {
    element.position = Math.max(1, parseInt(position.value) || 1);

    position.value = element.position;

    saveConfiguration(node, elements);

    rebuildUI(node);
  });

  createModalField(modal, "POSITION", position);

  /*
   * Thickness
   */

  const thicknessWrapper = createElementDOM("div", "subheader-range-wrapper");

  const thicknessValue = createElementDOM("span", "subheader-range-value");

  thicknessValue.textContent = `${element.thickness ?? 1}px`;

  const thickness = document.createElement("input");

  thickness.type = "range";

  thickness.min = "1";

  thickness.max = "10";

  thickness.step = "1";

  thickness.value = element.thickness ?? 1;

  thickness.className = "subheader-range";

  thickness.addEventListener("input", () => {
    element.thickness = parseInt(thickness.value);

    thicknessValue.textContent = `${element.thickness}px`;

    preview.querySelector(".subheader-preview-line").style.height = `${element.thickness}px`;

    saveConfiguration(node, elements);

    refreshSubgraphs();
  });

  thicknessWrapper.appendChild(thickness);

  thicknessWrapper.appendChild(thicknessValue);

  createModalField(modal, "THICKNESS", thicknessWrapper);

  /*
   * Color
   */

  const palette = createColorPalette(
    element.color ?? "lightGrey",

    TEXT_COLORS,

    color => {
      element.color = color;

      preview.querySelector(".subheader-preview-line").style.background = getColor(color, "lightGrey");

      saveConfiguration(node, elements);
    },
  );

  createModalField(modal, "COLOR", palette);
}

/* ============================================================
   SETTINGS DISPATCH
   ============================================================ */

function openSettings(node, element, elements, index) {
  if (element.type === "header") {
    openHeaderSettings(node, element, elements, index);

    return;
  }

  if (element.type === "line" || element.type === "separator") {
    openLineSettings(node, element, elements, index);
  }
}

/* ============================================================
   CREATE CUSTOM UI
   ============================================================ */

function createCustomUI(node) {
  /*
   * Prevent duplicate UI when ComfyUI
   * reconstructs the node.
   */
  if (node.__subHeaderContainer) {
    rebuildUI(node);
    return;
  }

  const widget = node.widgets?.find(item => item.name === "configuration");
  if (widget) {
    widget.hidden = true;
    widget.computeSize = () => [0, -4];
  }

  const container = createElementDOM("div", "subheader-ui");
  node.__subHeaderContainer = container;

  node.__subHeaderWidget = node.addDOMWidget?.("subheader_ui", "SUBHEADER_UI", container, {
    serialize: false,
    // Report a stable, content-only size. Never read node.size or the
    // layout-stretched DOM widget height in these callbacks: Nodes 2.0 uses
    // them during every drag/resize pass and can otherwise grow indefinitely.
    getMinHeight: () => Math.max(120, node.__subHeaderContentHeight || 120),
    getHeight: () => `${Math.max(120, node.__subHeaderContentHeight || 120)}px`,
  });

  // Keep the cached intrinsic size current when actual editor content wraps
  // or changes, but do not treat manual node resizing as a content change.
  const resizeObserver = new ResizeObserver(() => {
    const contentHeight = Math.ceil(Number(container.scrollHeight) || 0);
    if (contentHeight > 0 && Math.abs(contentHeight - (node.__subHeaderContentHeight || 0)) > 1) {
      updateEditorIntrinsicHeight(node, true);
    }
  });
  resizeObserver.observe(container);
  node.__subHeaderResizeObserver = resizeObserver;

  rebuildUI(node);
}

/* ============================================================
   SUBGRAPH VISUAL ELEMENT
   ============================================================ */

function createVisualLayoutItem(data) {
  const element = data.element;
  let height = 40;

  if (element.type === "spacing") {
    height = Math.max(10, Math.min(50, Number(element.height ?? 32)));
  } else if (element.type === "line" || element.type === "separator") {
    height = 18;
  }

  return {
    __subHeaderVisual: true,
    __subHeaderElement: element,
    __subHeaderNode: data.node,
    name: `__subheader_${data.node.id}_${Math.random()}`,

    // --- NODE 2.0 prep ---
    canvasOnly: true,
    // -------------------------------------

    hidden: false,
    advanced: false,
    computedDisabled: false,
    y: 0,
    computedHeight: height,
    computeSize() {
      return [0, height];
    },
  };
}

/* ============================================================
   FIND SUBHEADER ELEMENTS
   ============================================================ */

function getSubHeaders(subgraphNode) {
  const graph = subgraphNode?.subgraph;

  if (!graph?.nodes) {
    return [];
  }

  return graph.nodes
    .filter(node => node?.type === NODE_TYPE || node?.comfyClass === NODE_TYPE)
    .flatMap(node => {
      return getConfiguration(node).map(element => ({
        element,
        node,
      }));
    });
}

/* ============================================================
   BUILD SUBGRAPH LAYOUT
   ============================================================ */

function buildSubHeaderLayout(subgraphNode, realWidgets) {
  const visuals = getSubHeaders(subgraphNode);

  if (visuals.length === 0) {
    return realWidgets;
  }

  const byPosition = new Map();

  for (const visual of visuals) {
    const position = Math.max(1, Number(visual.element.position ?? 1));

    if (!byPosition.has(position)) {
      byPosition.set(position, []);
    }

    byPosition.get(position).push(visual);
  }

  const result = [];

  /*
   * Position 1:
   * before first parameter.
   */

  if (byPosition.has(1)) {
    for (const visual of byPosition.get(1)) {
      result.push(createVisualLayoutItem(visual));
    }
  }

  /*
   * Parameters and following
   * visual elements.
   */

  for (let i = 0; i < realWidgets.length; i++) {
    result.push(realWidgets[i]);

    const position = i + 2;

    if (byPosition.has(position)) {
      for (const visual of byPosition.get(position)) {
        result.push(createVisualLayoutItem(visual));
      }
    }
  }

  /*
   * Elements after the final
   * parameter.
   */

  for (const [position, group] of byPosition) {
    if (position <= realWidgets.length + 1) {
      continue;
    }

    for (const visual of group) {
      result.push(createVisualLayoutItem(visual));
    }
  }

  return result;
}

/* ============================================================
   DRAW SUBGRAPH ELEMENT
   ============================================================ */

function drawVisual(ctx, visual, width) {
  const element = visual.__subHeaderElement;

  let y = visual.y + 5;
  let height = visual.computedHeight - 5 - 5;

  /*
   * SPACING
   */

  if (element.type === "spacing") {
    return;
  }

  /*
   * LINE
   */

  if (element.type === "line" || element.type === "separator") {
    ctx.save();

    ctx.fillStyle = getColor(element.color, "lightGrey") || COLORS.lightGrey;

    const thickness = Math.max(1, Number(element.thickness ?? 1));

    const lineY = y + height / 2 - thickness / 2;

    ctx.fillRect(8, lineY, width - 16, thickness);

    ctx.restore();

    return;
  }

  /*
   * HEADER
   */

  if (element.type === "header") {
    ctx.save();

    const background = getColor(element.backgroundColor, "none");

    const textColor = getColor(element.textColor, "white") || COLORS.white;

    /*
     * Background.
     *
     * NONE means we simply don't draw
     * a background, leaving the node's
     * own background visible.
     */

    if (background !== null) {
      ctx.fillStyle = background;
      ctx.beginPath();
      ctx.roundRect(6, y + 2, Math.max(10, width - 12), height - 4, 7);
      ctx.fill();
    } else {
      // Discreet accent on transparent headings rather than a plain label.
      ctx.fillStyle = textColor;
      ctx.globalAlpha = 0.75;
      ctx.fillRect(7, y + 7, 3, Math.max(8, height - 14));
      ctx.globalAlpha = 1;
    }

    /*
     * Text.
     */

    ctx.fillStyle = textColor;

    ctx.font = "700 14px Inter, system-ui, sans-serif";

    ctx.textBaseline = "middle";

    const alignment = element.alignment || "center";

    ctx.textAlign = alignment;

    let x;

    if (alignment === "left") {
      x = 12;
    } else if (alignment === "right") {
      x = width - 12;
    } else {
      x = width / 2;
    }

    ctx.fillText(String(element.text ?? ""), x, y + height / 2, Math.max(20, width - 36));

    ctx.restore();
  }
}

/* ============================================================
   PATCH SUBGRAPH NODE
   ============================================================ */

const patchedPrototypes = new WeakSet();

function patchSubgraphPrototype(subgraphNode) {
  if (!subgraphNode || typeof subgraphNode.isSubgraphNode !== "function" || !subgraphNode.isSubgraphNode()) {
    return false;
  }

  const prototype = Object.getPrototypeOf(subgraphNode);

  if (!prototype) {
    return false;
  }

  if (patchedPrototypes.has(prototype)) {
    return true;
  }

  patchedPrototypes.add(prototype);

  /*
   * LAYOUT
   */

  const originalLayout = prototype.getLayoutWidgets;

  if (typeof originalLayout === "function") {
    prototype.getLayoutWidgets = function () {
      const realWidgets = (originalLayout.call(this) || []).filter(widget => !widget.__subHeaderVueVisual);

      const layout = buildSubHeaderLayout(this, realWidgets);

      this.__subHeaderVisualWidgets = layout.filter(item => item.__subHeaderVisual);

      return layout;
    };
  }

  /*
   * DRAW
   */

  const originalDraw = prototype.drawWidgets;

  if (typeof originalDraw === "function") {
    prototype.drawWidgets = function (ctx, options) {
      originalDraw.call(this, ctx, options);

      const visuals = this.__subHeaderVisualWidgets;

      if (!visuals) {
        return;
      }

      ctx.save();

      for (const visual of visuals) {
        drawVisual(ctx, visual, this.size[0]);
      }

      ctx.restore();
    };
  }

  /*
   * SIZE
   */

  const originalSize = prototype.computeSize;

  if (typeof originalSize === "function") {
    prototype.computeSize = function (out) {
      const size = originalSize.call(this, out);

      const visuals = getSubHeaders(this);

      for (const visual of visuals) {
        const element = visual.element;

        if (element.type === "spacing") {
          size[1] += Math.max(10, Math.min(50, Number(element.height ?? 32))) + 4;
        } else if (element.type === "line" || element.type === "separator") {
          size[1] += 18 + 4;
        } else {
          size[1] += 30 + 4;
        }
      }

      return size;
    };
  }
}

/* ============================================================
   NODES 2.0 — NATIVE DOM WIDGET BRIDGE

   The Vue renderer does not call LiteGraph's drawWidgets() or
   getLayoutWidgets(). We add real, non-serializing DOM widgets to the
   external subgraph node instead. IMPORTANT: do not reorder node.widgets:
   its order is used to restore promoted widget values from workflows.
   Reposition only the rendered Vue DOM rows, never the data model.
   ============================================================ */

function hasVueNodes() {
  return !!document.querySelector(
    '[data-testid="node-widget"], [data-vue-node], .vue-node',
  );
}

function getVisualHeight(element) {
  if (element.type === "spacing") return Math.max(8, Math.min(120, Number(element.height) || 32));
  if (element.type === "line" || element.type === "separator") return 22;
  return 38;
}

function updateVueVisual(widget, visual) {
  const element = visual.element;
  const panel = widget.element;
  if (!panel) return;
  const height = getVisualHeight(element);
  panel.className = `sh-vue-visual sh-vue-${element.type === "separator" ? "line" : element.type}`;
  panel.dataset.shVisual = "1";
  panel.style.minHeight = `${height}px`;
  panel.style.height = `${height}px`;
  panel.dataset.shHeight = String(height);
  const visualSignature = JSON.stringify(element);
  if (widget.__subHeaderVisualSignature === visualSignature) return;
  widget.__subHeaderVisualSignature = visualSignature;
  panel.replaceChildren();

  if (element.type === "header") {
    const label = document.createElement("div");
    label.className = "sh-vue-heading";
    label.textContent = String(element.text || "HEADER");
    label.style.color = getColor(element.textColor, "white") || COLORS.white;
    label.style.backgroundColor = getColor(element.backgroundColor, "none") || "transparent";
    label.style.textAlign = ["left", "right", "center"].includes(element.alignment) ? element.alignment : "center";
    panel.append(label);
  } else if (element.type === "line" || element.type === "separator") {
    const rule = document.createElement("div");
    rule.className = "sh-vue-rule";
    rule.style.backgroundColor = getColor(element.color, "lightGrey") || COLORS.lightGrey;
    rule.style.height = `${Math.max(1, Math.min(12, Number(element.thickness) || 1))}px`;
    panel.append(rule);
  } else {
    panel.classList.add("sh-vue-space");
  }
  widget.__subHeaderVueHeight = height;
  widget.computeSize = () => [0, height];
}

function moveVueRows(subgraphNode, activeWidgets) {
  // WidgetGrid is a Vue component. Its data-testid is the public test
  // selector, and we guard its absence for older/newer frontends.
  const pairs = activeWidgets.map(w => ({
    widget: w,
    row: w.element?.closest?.('[data-testid="node-widget"]'),
  }));
  const available = pairs.filter(pair => pair.row?.parentElement);
  if (!available.length) return;
  const grid = available[0].row.parentElement;
  if (!available.every(pair => pair.row.parentElement === grid)) return;

  // Do not touch native Vue widget components: move only our DOM rows.
  const visualRows = new Set(available.map(pair => pair.row));
  const nativeRows = Array.from(grid.children).filter(child =>
    child.matches?.('[data-testid="node-widget"]') && !visualRows.has(child) &&
    !child.querySelector?.('.sh-vue-visual'));
  const visuals = getSubHeaders(subgraphNode);
  const desired = visuals.map((visual, index) => ({
    row: pairs[index]?.row,
    position: Math.max(1, Math.floor(Number(visual.element.position) || 1)),
  })).filter(item => item.row?.parentElement === grid);

  // insertBefore preserves relative order for headers sharing a position.
  const positions = [...new Set(desired.map(item => item.position))].sort((a, b) => a - b);
  for (const position of positions) {
    const before = nativeRows[position - 1] || null;
    const group = desired.filter(item => item.position === position);
    for (const item of group) {
      if (before && item.row.nextElementSibling === before) continue;
      if (!before && item.row === grid.lastElementChild) continue;
      grid.insertBefore(item.row, before);
    }
  }
}

function syncVueSubgraph(subgraphNode) {
  if (typeof subgraphNode?.addDOMWidget !== "function") return;
  const enabled = hasVueNodes();
  const visuals = enabled ? getSubHeaders(subgraphNode) : [];
  const widgets = (subgraphNode.__subHeaderVueWidgets ||= []);

  for (let i = 0; i < visuals.length; i++) {
    if (!widgets[i]) {
      const panel = document.createElement("div");
      panel.className = "sh-vue-visual";
      const widget = subgraphNode.addDOMWidget(
        `sh_decorator_${i}`, "SH_DECORATOR", panel,
        { serialize: false, getHeight: () => `${Number(panel.dataset.shHeight) || 38}px`,
          getMinHeight: () => Number(panel.dataset.shHeight) || 38,
          getMaxHeight: () => Number(panel.dataset.shHeight) || 38 },
      );
      if (!widget) continue;
      widget.serialize = false;
      widget.__subHeaderVueVisual = true;
      widgets[i] = widget;
    }
    if (widgets[i]) {
      widgets[i].hidden = false;
      updateVueVisual(widgets[i], visuals[i]);
    }
  }
  for (let i = visuals.length; i < widgets.length; i++) {
    if (widgets[i]) {
      widgets[i].hidden = true;
      if (widgets[i].element) widgets[i].element.style.display = "none";
    }
  }
  for (let i = 0; i < visuals.length; i++) {
    if (widgets[i]?.element) widgets[i].element.style.display = "";
  }
  if (enabled && visuals.length) {
    moveVueRows(subgraphNode, widgets.slice(0, visuals.length));
  }
}

/* ============================================================
   FIND SUBGRAPHS
   ============================================================ */

function findSubgraphs(graph, result = []) {
  if (!graph) {
    return result;
  }

  for (const node of graph._nodes ?? []) {
    if (node && typeof node.isSubgraphNode === "function" && node.isSubgraphNode()) {
      result.push(node);

      if (node.subgraph) {
        findSubgraphs(node.subgraph, result);
      }
    }
  }

  return result;
}

/* ============================================================
   REFRESH SUBGRAPHS
   ============================================================ */

function refreshSubgraphs() {
  const graph = app.rootGraph;

  if (!graph) {
    return;
  }

  const subgraphs = findSubgraphs(graph);

  let needsRedraw = false;
  for (const subgraph of subgraphs) {
    patchSubgraphPrototype(subgraph);
    const signature = JSON.stringify(getSubHeaders(subgraph).map(({element, node}) => [node.id, element]));
    if (signature !== subgraph.__subHeaderLastSignature) {
      subgraph.__subHeaderLastSignature = signature;
      subgraph.setDirtyCanvas?.(true, true);
      needsRedraw = true;
    }
    syncVueSubgraph(subgraph);
  }
  if (needsRedraw) app.canvas?.setDirty?.(true, true);
}

/* ============================================================
   DELAYED INITIALIZATION
   ============================================================ */

/*
 * ComfyUI may create the DOM widget before
 * its configuration widget has been populated
 * from a loaded workflow.
 *
 * These delayed rebuilds make sure an existing
 * Sub Header doesn't initially appear empty.
 */

function scheduleSubHeaderRebuild(node) {
  requestAnimationFrame(() => {
    rebuildUI(node);
    // Demande un rafraîchissement global du canvas après le premier render frame
    app.canvas?.setDirty?.(true, true);
  });
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

    const originalCreated = nodeType.prototype.onNodeCreated;

    nodeType.prototype.onNodeCreated = function () {
      if (originalCreated) originalCreated.apply(this, arguments);

      // This is a display-only node. Avoid overwriting slot arrays directly:
      // the modern frontend tracks them in its link/slot stores.
      const originalComputeSize = this.computeSize;

      this.computeSize = function (...args) {
        const size = originalComputeSize ? originalComputeSize.apply(this, args) : [360, 180];

        return [Math.max(360, size[0]), Math.max(this.__subHeaderMinHeight || 300, size[1])];
      };

      createCustomUI(this);

      scheduleSubHeaderRebuild(this);

      return this;
    };

    // --- Cleaning when Node is deleted ---
    const originalRemoved = nodeType.prototype.onRemoved;
    nodeType.prototype.onRemoved = function () {
      if (this.__subHeaderResizeObserver) {
        this.__subHeaderResizeObserver.disconnect();
        this.__subHeaderResizeObserver = null;
      }
      if (originalRemoved) {
        originalRemoved.apply(this, arguments);
      }
    };

    /*
     * Workflow loading / configuration.
     */

    const originalConfigure = nodeType.prototype.onConfigure;

    nodeType.prototype.onConfigure = function () {
      if (originalConfigure) {
        originalConfigure.apply(this, arguments);
      }

      scheduleSubHeaderRebuild(this);

      refreshSubgraphs();
    };
  },

  async setup() {
    setTimeout(refreshSubgraphs, 500);

    /*
     * ComfyUI can create/rebuild
     * Subgraph nodes dynamically.
     */

    // Detect subgraph promotion changes and renderer switches without
    // forcing a full canvas redraw twice per second.
    setInterval(refreshSubgraphs, 1200);
  },
});
