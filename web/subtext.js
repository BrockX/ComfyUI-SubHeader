import { app } from "../../scripts/app.js";

const EXTENSION_NAME = "ComfyUI.SubText";
const NODE_TYPE = "SubText";

/* ============================================================
   CSS STYLESHEET REGISTRATION
   ============================================================ */
const css = document.createElement("link");
css.rel = "stylesheet";
css.href = new URL("./subtext.css", import.meta.url).href;
if (!document.querySelector(`link[href="${css.href}"]`)) {
  document.head.appendChild(css);
}

/* ============================================================
   MARKDOWN DOCUMENTATION GUIDE (CLEAN STYLESHEET BASED)
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
    
    <h4 style="color: #c678dd; margin-top: 12px; font-size: 11px;"> Presets</h4>
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

  const destroyPopup = () => {
    overlay.remove();
  };

  closeBtn.addEventListener("click", destroyPopup);

  overlay.addEventListener("mousedown", e => {
    if (e.target === overlay) {
      destroyPopup();
    }
  });
}

/* ============================================================
   CORE NETWORK INTERCEPTION HANDSHAKE (STABLE VERSION)
   ============================================================ */
const textTemplateBackup = {};

app.registerExtension({
  name: EXTENSION_NAME,
  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name !== NODE_TYPE) return;

    const originalGraphToPrompt = app.graphToPrompt;
    app.graphToPrompt = async function () {
      const p = await originalGraphToPrompt.apply(this, arguments);
      const sessionMemory = {};

      if (app.graph && app.graph._nodes) {
        for (const node of app.graph._nodes) {
          if (!node) continue;
          const type = node.type || node.comfyClass;
          if (!type) continue;

          const typeLower = type.toLowerCase();
          const nodeTitle = (node.title || node.properties?.NodeName || "").toLowerCase();

          // Skip detailer/upscale utilities to isolate the main generation cycle
          if (
            typeLower.includes("detailer") ||
            nodeTitle.includes("detailer") ||
            typeLower.includes("face") ||
            nodeTitle.includes("face") ||
            typeLower.includes("impact") ||
            typeLower.includes("upscale")
          ) {
            continue;
          }

          const getWidgetValue = targetNames => {
            const names = Array.isArray(targetNames) ? targetNames : [targetNames];
            if (node.widgets && Array.isArray(node.widgets)) {
              for (const name of names) {
                const found = node.widgets.find(w => w && w.name === name);
                if (found && found.value !== undefined) return found.value;
              }
            }
            if (node.properties) {
              for (const name of names) {
                if (node.properties[name] !== undefined) return node.properties[name];
              }
            }
            return undefined;
          };

          // 1. Capture Main Sampler Data
          if (typeLower.includes("sampler")) {
            const seed = getWidgetValue(["seed", "noise_seed"]);
            const steps = getWidgetValue("steps");
            const cfg = getWidgetValue("cfg");
            const sampler = getWidgetValue(["sampler_name", "sampler"]);
            const scheduler = getWidgetValue("scheduler");
            const denoise = getWidgetValue("denoise");

            if (seed !== undefined && seed !== null) sessionMemory["seed"] = String(seed);
            if (steps !== undefined && steps !== null) sessionMemory["steps"] = String(steps);
            if (cfg !== undefined && cfg !== null) sessionMemory["cfg"] = String(cfg);
            if (sampler !== undefined && sampler !== null) sessionMemory["sampler"] = String(sampler);
            if (scheduler !== undefined && scheduler !== null) sessionMemory["scheduler"] = String(scheduler);
            if (denoise !== undefined && denoise !== null) sessionMemory["denoise"] = String(denoise);
          }

          // 2. Capture Main Resolution Data
          if (
            typeLower.includes("latent") ||
            typeLower.includes("image") ||
            typeLower.includes("resolution") ||
            typeLower.includes("size")
          ) {
            const width = getWidgetValue(["width", "upscale_width", "target_width"]);
            const height = getWidgetValue(["height", "upscale_height", "target_height"]);

            if (width !== undefined && width !== null) sessionMemory["width"] = String(width);
            if (height !== undefined && height !== null) sessionMemory["height"] = String(height);
          }

          // 3. Capture Main Checkpoint Model Data
          if (typeLower.includes("loader") || typeLower.includes("model")) {
            const model = getWidgetValue(["ckpt_name", "model_name", "model"]);
            if (model !== undefined && model !== null) sessionMemory["model"] = String(model);
          }
        }
      }

      // Execute stable search-and-replace using live canvas lookups
      if (p && p.output) {
        // 🚀 CREATE COMPOUND SHORTCUTS USING EXTRACTED SESSION MEMORY
        const modelClean =
          sessionMemory["model"] && (sessionMemory["model"].includes("/") || sessionMemory["model"].includes("\\"))
            ? sessionMemory["model"].split("/").pop().split("\\").pop()
            : sessionMemory["model"] || "{model}";

        if (sessionMemory["width"] && sessionMemory["height"]) {
          sessionMemory["res"] = `Resolution : ${sessionMemory["width"]} x ${sessionMemory["height"]}`;
        }

        // Master shortcut config
        const seedVal = sessionMemory["seed"] || "{seed}";
        const stepsVal = sessionMemory["steps"] || "{steps}";
        const cfgVal = sessionMemory["cfg"] || "{cfg}";
        const samplerVal = sessionMemory["sampler"] || "{sampler}";
        const schedulerVal = sessionMemory["scheduler"] || "{scheduler}";
        const denoiseVal = sessionMemory["denoise"] || "{denoise}";

        // Existing {gen} layout block
        sessionMemory["gen"] = `Model : ${modelClean}
        Seed : ${seedVal}
        Steps : ${stepsVal}
        CFG : ${cfgVal}
        Sampler : ${samplerVal}
        Scheduler : ${schedulerVal}
        Denoise : ${denoiseVal}`;

        // 📊 NEW: {genh} Horizontal Layout (2 Columns table)
        sessionMemory["genh"] = `| Parameter | Value |
        | :---: | :---: |
        | Seed | ${seedVal} |
        | Steps | ${stepsVal} |
        | CFG | ${cfgVal} |
        | Sampler | ${samplerVal} |
        | Scheduler | ${schedulerVal} |
        | Denoise | ${denoiseVal} |`;

        // 📊 NEW: {genv} Vertical Layout (6 Columns table)
        sessionMemory["genv"] = `| Seed | Steps | CFG | Sampler | Scheduler | Denoise |
        | :---: | :---: | :---: | :---: | :---: | :---: |
        | ${seedVal} | ${stepsVal} | ${cfgVal} | ${samplerVal} | ${schedulerVal} | ${denoiseVal} |`;

        for (const id in p.output) {
          if (p.output[id].class_type === NODE_TYPE) {
            // Get the live visual node layout from the active browser canvas view
            const visualNode = app.graph.getNodeById(id);
            const textWidget = visualNode?.widgets?.find(w => w.name === "text");

            // ALWAYS start processing from what is currently typed on the screen right now
            let workingText = textWidget ? textWidget.value : p.output[id].inputs["text"] || "";

            for (const key in sessionMemory) {
              let val = sessionMemory[key];
              if (val === undefined || val === null || val === "") continue;

              if (key === "model" && typeof val === "string" && (val.includes("/") || val.includes("\\"))) {
                val = val.split("/").pop().split("\\").pop();
              }

              const placeholder = `{${key}}`;
              workingText = workingText.split(placeholder).join(val);
            }

            // ONLY overwrite the temporary payload going to the server, keeping your layout template safe
            p.output[id].inputs["text"] = workingText;
          }
        }
      }
      return p;
    };

    /* --------------------------------------------------------
       EXECUTION RESULT CATCHER
       -------------------------------------------------------- */
    const originalExecuted = nodeType.prototype.onExecuted;
    nodeType.prototype.onExecuted = function (message) {
      if (originalExecuted) originalExecuted.apply(this, arguments);
      if (message && message.string) {
        this.output_value = [message.string];
      }
    };

    /* --------------------------------------------------------
       DYNAMIC INPUT SLOTS AUTOMATION MANAGER
       -------------------------------------------------------- */
    nodeType.prototype.onConnectionsChange = function (type, index, connected) {
      if (type !== 1) return;
      const alphabet = "abcdefghijklmnopqrstuvwxyz";
      if (!this.inputs) return;

      if (this.inputs.length > 0) this.inputs.name = "a";
      let lastConnectedIndex = -1;
      for (let i = 0; i < this.inputs.length; i++) {
        const input = this.inputs[i];
        if (input && input.link != null) lastConnectedIndex = i;
      }

      const requiredInputCount = lastConnectedIndex + 2;
      if (requiredInputCount > this.inputs.length && this.inputs.length < alphabet.length) {
        this.addInput(alphabet[this.inputs.length], "*");
      }

      while (this.inputs.length > 1) {
        const lastEmpty = !this.inputs[this.inputs.length - 1] || this.inputs[this.inputs.length - 1].link == null;
        const prevEmpty = !this.inputs[this.inputs.length - 2] || this.inputs[this.inputs.length - 2].link == null;
        if (lastEmpty && prevEmpty) this.removeInput(this.inputs.length - 1);
        else break;
      }

      for (let i = 0; i < this.inputs.length; i++) {
        if (this.inputs[i]) this.inputs[i].name = alphabet[i];
      }

      if (this.inputs.length > 0 && this.inputs[this.inputs.length - 1].link != null && this.inputs.length < alphabet.length) {
        this.addInput(alphabet[this.inputs.length], "*");
      }
      if (this.graph) this.graph.setDirtyCanvas(true, true);
    };

    /* --------------------------------------------------------
       NODE CREATION INITIALIZER
       -------------------------------------------------------- */
    const originalCreated = nodeType.prototype.onNodeCreated;
    nodeType.prototype.onNodeCreated = function () {
      if (originalCreated) originalCreated.apply(this, arguments);
      while (this.inputs && this.inputs.length > 1) this.removeInput(this.inputs.length - 1);
      if (!this.inputs || this.inputs.length === 0) this.addInput("a", "*");

      this.addWidget("button", "Help ?", null, () => showMarkdownHelp());
      if (this.computeSize && this.setSize) {
        const size = this.computeSize();
        this.setSize([size, size]);
      }
      return this;
    };
  },
});
