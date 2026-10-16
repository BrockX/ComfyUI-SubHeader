# ComfyUI SubHeader

A compact suite of **three visual organization nodes** for ComfyUI, with a refreshed dark interface and compatibility paths for both **Nodes 1.0 (LiteGraph)** and **Nodes 2.0 (Vue)**.

**Version 1.1.0** — builds on the original Sub Header / Sub Text / Sub Display nodes. Existing node type names, configuration JSON, colour keys, and workflow values are preserved.

---

## Included Nodes

### Sub Header

<img width="486" height="268" alt="image" src="https://github.com/user-attachments/assets/fed248ab-b958-464a-a442-bf1f3359fe52" />

Visual UI layout element for organizing promoted parameters when a node is collapsed as a subgraph. **Does not affect graph execution.**

- **Headers**: Supports custom text, text/background styling, positioning, and alignments (Left, Center, Right).
- **Lines**: Configurable structural section breaks with adjustable thickness and matching colors.
- **Spaces**: Dynamic padding nodes to space out busy parameters.

### Usage
- Position are relative to your promoted widget.
  (e.g., you have KSampler in a subgraph. Promoted are : seed, steps, cfg, sampler, scheduler, denoise.
  You want a header between cfg and sampler : Pos = 4)

<img width="484" height="286" alt="image" src="https://github.com/user-attachments/assets/c8394f70-114e-4f7f-af7d-fa874f635170" />

<img width="446" height="384" alt="image" src="https://github.com/user-attachments/assets/5db0881c-5068-4b6e-b059-80e8b9fdf19d" />

---

### Sub Text

<img width="471" height="257" alt="image" src="https://github.com/user-attachments/assets/3fa2c0b0-3e73-4194-ad29-7c7d15e3413b" />

A smart markdown template engine node featuring dynamic connection slot loading (`{a}`, `{b}`, `{c}`) alongside auto-scanning environment tags.

- **Zero-Cable Ingestion**: Automatically grabs active parameters from your graph's core nodes without wire clutter.
- **Zero-Cable Ingestion AGAIN!!**: Add a Name, and **Sub Display** will be able to read it!

### Usage
- Enter a unique name
- plug anything, write anything. 
---

### Sub Display

<img width="441" height="228" alt="image" src="https://github.com/user-attachments/assets/deecc743-3169-4ae3-803e-ff39303341fb" />


A remote workspace dashboard card that pulls text outputs out of any `SubText` block by using its unique `NAME` tag.
YES! You can have Sub Text inside a subgraph, and Sub Display outside. And it will (should?) detect it!
Includes custom inline dynamic font sizing adjustments (+1 / -1) directly inside the node panel.

### Usage
- Find the Sub Text in the combo.
- It refresh on prompt/run. Or if you execute the associated Sub Text.

---

## Markdown & Variables Guide

The rendering box supports standard inline Markdown formatting rules (`**bold**`, `*italic*`, `` `code` ``, `> quotes`, and native multi-column `| Markdown | Tables |`).

### Auto-Scanning Presets (No Cables Needed!)

Place these tags anywhere inside a **Sub Text** node to automatically populate your active generation details:

| Variable  | Description                           | Output Format Example        |
| :-------- | :------------------------------------ | :--------------------------- |
| `{gen}`   | Complete plain text parameter summary | Block format checklist       |
| `{genh}`  | Horizontally formatted summary table  | Markdown Table               |
| `{genv}`  | Vertically formatted summary table    | Markdown Table               |
| `{res}`   | Canvas Resolution specs               | `1024 x 1024`                |
| `{model}` | Active Checkpoint layout              | `sdxl_base_v1.0.safetensors` |

### Granular Parameter Tags

- **Sampling Blocks**: `{seed}`, `{steps}`, `{cfg}`, `{sampler}`, `{scheduler}`, `{denoise}`
- **Dimensions**: `{width}`, `{height}`

---

## Installation

1. Clone or copy the `ComfyUI-SubHeader` folder into your installation directory:
   ```bash
   ComfyUI/custom_nodes/
   ```
2. If you are upgrading an older version, replace its existing plugin files (your saved workflows are not stored in this folder). Restart ComfyUI and hard-refresh the browser to load the new JavaScript/CSS.
3. Find your new tools inside the graph context menu search section under:
   ```text
   Subgraph UI -> Sub Header / Sub Text / Sub Display
   ```

---

## Creator's Notes

This started as a personal project to keep busy ComfyUI subgraphs pleasant to use. Feel free to fork it, change it, and improve it.

## Renderer compatibility

- **Nodes 1.0** — decorative headers, dividers, and spacers are still drawn through the original LiteGraph layout hooks.
- **Nodes 2.0** — the external subgraph uses actual non-serializing DOM widgets for decorations. Their *visible DOM rows* are placed among promoted controls; the stored order of ComfyUI's real widget values is not changed.
- **Sub Text / Sub Display** use DOM widgets in both renderers. The display restores the latest cached text when possible.
- Switching between renderers and loading older workflows should preserve the underlying configuration.
