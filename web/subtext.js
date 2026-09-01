import { app } from "../../scripts/app.js";

const EXTENSION_NAME = "ComfyUI.SubText";
const NODE_TYPE = "SubText";

/* ============================================================
   CSS
   ============================================================ */

const css = document.createElement("link");
css.rel = "stylesheet";
css.href = new URL("./subtext.css", import.meta.url).href;

if (!document.querySelector(`link[href="${css.href}"]`)) {
  document.head.appendChild(css);
}

/* ============================================================
   MARKDOWN HELP
   ============================================================ */

function showMarkdownHelp() {
  const existing = document.getElementById("subtext-custom-overlay");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "subtext-custom-overlay";

  const modal = document.createElement("div");
  modal.id = "subtext-custom-modal";
  modal.addEventListener("mousedown", e => e.stopPropagation());

  const header = document.createElement("div");
  header.className = "modal-header";

  const titleElement = document.createElement("div");
  titleElement.className = "modal-title";
  titleElement.textContent = "Markdown & Presets Guide";

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "modal-close";
  closeBtn.textContent = "×";

  header.appendChild(titleElement);
  header.appendChild(closeBtn);
  modal.appendChild(header);

  const body = document.createElement("div");
  body.className = "modal-body";

  body.innerHTML = `
    <h3>Usage & Presets Guide</h3>
    <ul>
      <li><strong>{a}, {b}, {c}...</strong> : Connected input slots</li>
    </ul>

    <h4 style="color: #7ddd78; margin-top: 12px; font-size: 11px;">Markdown Syntax</h4>
    <ul style="color: #7ddd78; padding-left: 18px; margin: 4px 0;">
      <li><strong># Title</strong> : Section header</li>
      <li><strong>## Subtitle</strong> : Subsection header</li>
      <li><strong>**text**</strong> : Bold text</li>
      <li><strong>*text*</strong> : Italic text</li>
      <li><strong>\`code\`</strong> : Monospace inline block</li>
      <li><strong>&gt; text</strong> : Blockquote frame</li>
      <li><strong>- or * text</strong> : Bulletpoint listing</li>
      <li><strong>---</strong> : Horizontal line separator</li>
    </ul>

    <p style="font-size:11px; color:#abb2bf; margin:10px 0 0 0; font-style:italic;">
      The tags below auto-scan the inner nodes of this subgraph. No cables required!
    </p>

    <h4 style="color: #c678dd; margin-top: 12px; font-size: 11px;">Presets</h4>
    <ul style="color: #c678dd; padding-left: 18px; margin: 4px 0;">
      <li><strong>{gen}</strong> : Complete textual setup block</li>
      <li><strong>{genh}</strong> : Horizontally aligned parameters table</li>
      <li><strong>{genv}</strong> : Vertically aligned parameters table</li>
      <li><strong>{res}</strong> : Resolution dimensions (W x H)</li>
    </ul>

    <p style="font-size:11px; color:#abb2bf; margin:10px 0 0 0; font-style:italic;">
      Those blocks are automatically generated from KSampler, and will (should?) always reflect the current values of your graph.
    </p>

    <h4 style="color: #e5c07b; margin-top: 12px; font-size: 11px;">Generation (KSampler)</h4>
    <ul style="color: #e5c07b; padding-left: 18px; margin: 4px 0;">
      <li><strong>{seed}</strong> : Random seed value</li>
      <li><strong>{steps}</strong> : Total sampling steps</li>
      <li><strong>{cfg}</strong> : Classifier Free Guidance</li>
      <li><strong>{sampler}</strong> : Sampler algorithm name</li>
      <li><strong>{scheduler}</strong> : Scheduler type</li>
      <li><strong>{denoise}</strong> : Denoise strength</li>
    </ul>

    <h4 style="color: #98c379; margin-top: 12px; font-size: 11px;">Dimensions (Latent / Image)</h4>
    <ul style="color: #98c379; padding-left: 18px; margin: 4px 0;">
      <li><strong>{width}</strong> : Width in pixels</li>
      <li><strong>{height}</strong> : Height in pixels</li>
    </ul>

    <h4 style="color: #61afef; margin-top: 12px; font-size: 11px;">Models & Files (Loaders)</h4>
    <ul style="color: #61afef; padding-left: 18px; margin: 4px 0;">
      <li><strong>{model}</strong> : Active Checkpoint file</li>
    </ul>
  `;

  modal.appendChild(body);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const destroyPopup = () => overlay.remove();

  closeBtn.addEventListener("click", destroyPopup);

  overlay.addEventListener("mousedown", e => {
    if (e.target === overlay) {
      destroyPopup();
    }
  });
}

/* ============================================================
   UNIQUE NAME
   ============================================================ */

function createUniqueNameWidget(node, sourceWidget) {
  const wrapper = document.createElement("div");
  wrapper.className = "subtext-unique-name-row";

  const label = document.createElement("span");
  label.className = "subtext-unique-name-label";
  label.textContent = "NAME";

  const input = document.createElement("input");
  input.type = "text";
  input.className = "subtext-inline-name";
  input.placeholder = "Input name (e.g. PromptInfo)";
  input.value = sourceWidget?.value ?? "";

  const syncValue = () => {
    const value = input.value;

    if (sourceWidget) {
      sourceWidget.value = value;

      if (sourceWidget.callback) {
        sourceWidget.callback(value);
      }
    }

    node.__subtextUniqueName = value;

    node.graph?.setDirtyCanvas(true, true);

    window.dispatchEvent(
      new CustomEvent("subtext-name-changed", {
        detail: {
          node,
          name: value,
        },
      }),
    );
  };

  input.addEventListener("input", syncValue);
  input.addEventListener("change", syncValue);

  for (const event of ["mousedown", "pointerdown", "click"]) {
    input.addEventListener(event, e => e.stopPropagation());
  }

  wrapper.appendChild(label);
  wrapper.appendChild(input);

  node.__subtextNameInput = input;

  return wrapper;
}

/* ============================================================
   GRAPH HELPERS
   ============================================================ */

function getNodeType(node) {
  return node?.type || node?.comfyClass || "";
}

function collectGraphNodes(graph, results = [], visited = new Set()) {
  if (!graph || visited.has(graph)) {
    return results;
  }

  visited.add(graph);

  for (const node of graph._nodes || []) {
    if (!node) continue;

    results.push(node);

    if (node.subgraph) {
      collectGraphNodes(node.subgraph, results, visited);
    }
  }

  return results;
}

/* ============================================================
   EXTENSION
   ============================================================ */

app.registerExtension({
  name: EXTENSION_NAME,

  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name !== NODE_TYPE) return;

    /* ========================================================
       GRAPH TO PROMPT
       ======================================================== */

    if (!app.__subtextGraphToPromptPatched) {
      const originalGraphToPrompt = app.graphToPrompt;

      app.graphToPrompt = async function () {
        const p = await originalGraphToPrompt.apply(this, arguments);
        const sessionMemory = {};

        const allNodes = collectGraphNodes(app.graph);

        for (const node of allNodes) {
          if (!node) continue;

          const type = getNodeType(node);

          if (!type) continue;

          const typeLower = type.toLowerCase();
          const nodeTitle = (node.title || node.properties?.NodeName || "").toLowerCase();

          if (
            typeLower.includes("detailer") ||
            nodeTitle.includes("detailer") ||
            typeLower.includes("face") ||
            nodeTitle.includes("face") ||
            typeLower.includes("impact") ||
            nodeTitle.includes("impact") ||
            typeLower.includes("upscale") ||
            nodeTitle.includes("upscale")
          ) {
            continue;
          }

          const getWidgetValue = targetNames => {
            const names = Array.isArray(targetNames) ? targetNames : [targetNames];

            if (node.widgets && Array.isArray(node.widgets)) {
              for (const name of names) {
                const found = node.widgets.find(w => w && w.name === name);

                if (found && found.value !== undefined && found.value !== null) {
                  return found.value;
                }
              }
            }

            if (node.properties) {
              for (const name of names) {
                if (node.properties[name] !== undefined) {
                  return node.properties[name];
                }
              }
            }

            return undefined;
          };

          /* SAMPLER */

          if (typeLower.includes("sampler")) {
            const seed = getWidgetValue(["seed", "noise_seed"]);
            const steps = getWidgetValue("steps");
            const cfg = getWidgetValue("cfg");
            const sampler = getWidgetValue(["sampler_name", "sampler"]);
            const scheduler = getWidgetValue("scheduler");
            const denoise = getWidgetValue("denoise");

            if (seed !== undefined && seed !== null) {
              sessionMemory.seed = String(seed);
            }

            if (steps !== undefined && steps !== null) {
              sessionMemory.steps = String(steps);
            }

            if (cfg !== undefined && cfg !== null) {
              sessionMemory.cfg = String(cfg);
            }

            if (sampler !== undefined && sampler !== null) {
              sessionMemory.sampler = String(sampler);
            }

            if (scheduler !== undefined && scheduler !== null) {
              sessionMemory.scheduler = String(scheduler);
            }

            if (denoise !== undefined && denoise !== null) {
              sessionMemory.denoise = String(denoise);
            }
          }

          /* RESOLUTION */

          if (
            typeLower.includes("latent") ||
            typeLower.includes("image") ||
            typeLower.includes("resolution") ||
            typeLower.includes("size")
          ) {
            const width = getWidgetValue(["width", "upscale_width", "target_width"]);

            const height = getWidgetValue(["height", "upscale_height", "target_height"]);

            if (width !== undefined && width !== null) {
              sessionMemory.width = String(width);
            }

            if (height !== undefined && height !== null) {
              sessionMemory.height = String(height);
            }
          }

          /* MODEL */

          if (typeLower.includes("loader") || typeLower.includes("model")) {
            const model = getWidgetValue(["ckpt_name", "model_name", "model"]);

            if (model !== undefined && model !== null) {
              sessionMemory.model = String(model);
            }
          }
        }

        /* PRESETS */

        const modelClean =
          sessionMemory.model && (sessionMemory.model.includes("/") || sessionMemory.model.includes("\\"))
            ? sessionMemory.model.split("/").pop().split("\\").pop()
            : sessionMemory.model || "{model}";

        if (sessionMemory.width && sessionMemory.height) {
          sessionMemory.res = `${sessionMemory.width} x ${sessionMemory.height}`;
        }

        const seedVal = sessionMemory.seed || "{seed}";
        const stepsVal = sessionMemory.steps || "{steps}";
        const cfgVal = sessionMemory.cfg || "{cfg}";
        const samplerVal = sessionMemory.sampler || "{sampler}";
        const schedulerVal = sessionMemory.scheduler || "{scheduler}";
        const denoiseVal = sessionMemory.denoise || "{denoise}";

        sessionMemory.gen = `Model : ${modelClean}
Seed : ${seedVal}
Steps : ${stepsVal}
CFG : ${cfgVal}
Sampler : ${samplerVal}
Scheduler : ${schedulerVal}
Denoise : ${denoiseVal}`;

        sessionMemory.genh = `| Parameter | Value |
| :---: | :---: |
| Seed | ${seedVal} |
| Steps | ${stepsVal} |
| CFG | ${cfgVal} |
| Sampler | ${samplerVal} |
| Scheduler | ${schedulerVal} |
| Denoise | ${denoiseVal} |\n`;

        sessionMemory.genv = `| Seed | Steps | CFG | Sampler | Scheduler | Denoise |
| :---: | :---: | :---: | :---: | :---: | :---: |
| ${seedVal} | ${stepsVal} | ${cfgVal} | ${samplerVal} | ${schedulerVal} | ${denoiseVal} |\n`;

        /* RESOLVE AUTOMATIC TAGS ONLY */

        if (p?.output) {
          for (const id in p.output) {
            const outputNode = p.output[id];

            if (!outputNode || outputNode.class_type !== NODE_TYPE) {
              continue;
            }

            let workingText = String(outputNode.inputs?.text ?? "");

            for (const key in sessionMemory) {
              let value = sessionMemory[key];

              if (value === undefined || value === null || value === "") {
                continue;
              }

              if (key === "model" && typeof value === "string" && (value.includes("/") || value.includes("\\"))) {
                value = value.split("/").pop().split("\\").pop();
              }

              workingText = workingText.split(`{${key}}`).join(String(value));
            }

            outputNode.inputs.text = workingText;
          }
        }

        return p;
      };

      app.__subtextGraphToPromptPatched = true;
    }

    /* ========================================================
       EXECUTION RESULT
       ======================================================== */

    const originalExecuted = nodeType.prototype.onExecuted;

    nodeType.prototype.onExecuted = function (message) {
      if (originalExecuted) {
        originalExecuted.apply(this, arguments);
      }

      if (!message) return;

      const text = Array.isArray(message.text) ? message.text[0] : message.text;

      if (text === undefined || text === null) {
        return;
      }

      const uniqueNameWidget = this.widgets?.find(w => w && w.name === "unique_name");

      const name = String(uniqueNameWidget?.value ?? "").trim();

      const resolvedText = String(text);

      this.output_value = [resolvedText];

      window.dispatchEvent(
        new CustomEvent("subtext-executed", {
          detail: {
            node: this,
            name,
            text: resolvedText,
          },
        }),
      );
    };

    /* ========================================================
       DYNAMIC INPUTS
       ======================================================== */

    nodeType.prototype.onConnectionsChange = function (type, index, connected) {
      if (type !== 1) return;

      const alphabet = "abcdefghijklmnopqrstuvwxyz";

      if (!this.inputs) return;

      let lastConnectedIndex = -1;

      for (let i = 0; i < this.inputs.length; i++) {
        const input = this.inputs[i];

        if (input && input.link != null) {
          lastConnectedIndex = i;
        }
      }

      const requiredInputCount = lastConnectedIndex + 2;

      if (requiredInputCount > this.inputs.length && this.inputs.length < alphabet.length) {
        this.addInput(alphabet[this.inputs.length], "*");
      }

      while (this.inputs.length > 1) {
        const lastEmpty = !this.inputs[this.inputs.length - 1] || this.inputs[this.inputs.length - 1].link == null;

        const prevEmpty = !this.inputs[this.inputs.length - 2] || this.inputs[this.inputs.length - 2].link == null;

        if (lastEmpty && prevEmpty) {
          this.removeInput(this.inputs.length - 1);
        } else {
          break;
        }
      }

      for (let i = 0; i < this.inputs.length; i++) {
        if (this.inputs[i]) {
          this.inputs[i].name = alphabet[i];
        }
      }

      if (this.inputs.length > 0 && this.inputs[this.inputs.length - 1].link != null && this.inputs.length < alphabet.length) {
        this.addInput(alphabet[this.inputs.length], "*");
      }

      if (this.graph) {
        this.graph.setDirtyCanvas(true, true);
      }
    };

    /* ========================================================
       NODE CREATED
       ======================================================== */

    const originalCreated = nodeType.prototype.onNodeCreated;

    nodeType.prototype.onNodeCreated = function () {
      if (originalCreated) {
        originalCreated.apply(this, arguments);
      }

      /* DYNAMIC INPUTS INITIAL SANITIZATION */
      while (this.inputs && this.inputs.length > 1) {
        this.removeInput(this.inputs.length - 1);
      }

      if (!this.inputs || this.inputs.length === 0) {
        this.addInput("a", "*");
      }

      /* UNIQUE NAME CUSTOM INTERFACE SETUP */
      const uniqueNameWidget = this.widgets?.find(w => w && w.name === "unique_name");

      if (uniqueNameWidget) {
        // 1. Hide the ugly default text input bar
        uniqueNameWidget.hidden = true;
        uniqueNameWidget.computeSize = () => [0, -4];

        // 2. Generate your beautiful stylized row element
        const domElement = createUniqueNameWidget(this, uniqueNameWidget);

        // 3. Mount it cleanly to the canvas framework
        const domWidget = this.addDOMWidget("unique_name_display", "SUBTEXT_UNIQUE_NAME", domElement, {
          serialize: false,
        });

        if (domWidget) {
          domWidget.serialize = false;
          domWidget.computeSize = () => [0, 36];
          domWidget.minHeight = 36;

          if (domWidget.element) {
            domWidget.element.style.height = "36px";
            domWidget.element.style.minHeight = "36px";
            domWidget.element.style.maxHeight = "36px";
            domWidget.element.style.flex = "none";
          }

          /*
           * 🚀 CRITICAL COMPATIBILITY FIX:
           * Do NOT touch or reorder 'this.widgets'. Leave it in its native index tracking layout.
           * Instead, we use ComfyUI's layout renderer to force our custom DOM element
           * to render visually at the absolute top of the stack.
           */
          const originalGetLayoutWidgets = this.getLayoutWidgets;
          this.getLayoutWidgets = function () {
            const widgets = originalGetLayoutWidgets ? originalGetLayoutWidgets.call(this) : [...this.widgets];
            const idx = widgets.indexOf(domWidget);
            if (idx !== -1) {
              widgets.splice(idx, 1);
              widgets.unshift(domWidget); // Visually reposition at top safely per render frame
            }
            return widgets;
          };

          this.__subtextUniqueNameWidget = uniqueNameWidget;
        }
      }

      /* HELP MANUAL CONTROLLER BUTTON */
      this.addWidget("button", "Help ?", null, () => showMarkdownHelp());

      /* SIZE MANAGEMENT RE-INJECT */
      if (this.computeSize && this.setSize) {
        const size = this.computeSize();
        this.setSize(size);
      }

      return this;
    };

    /* ========================================================
       WORKFLOW RESTORE
       ======================================================== */

    const originalConfigure = nodeType.prototype.configure;

    nodeType.prototype.configure = function (info) {
      if (originalConfigure) {
        originalConfigure.apply(this, arguments);
      }

      const uniqueNameWidget = this.widgets?.find(w => w && w.name === "unique_name");

      if (uniqueNameWidget && this.__subtextNameInput) {
        this.__subtextNameInput.value = uniqueNameWidget.value ?? "";

        this.__subtextUniqueName = uniqueNameWidget.value ?? "";
      }

      if (this.__subtextUniqueNameWidget) {
        this.__subtextUniqueNameWidget.value = uniqueNameWidget?.value ?? "";
      }

      if (this.graph) {
        this.graph.setDirtyCanvas(true, true);
      }

      setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent("subtext-name-changed", {
            detail: {
              node: this,
              name: uniqueNameWidget?.value ?? "",
            },
          }),
        );
      }, 0);
    };
  },
});
