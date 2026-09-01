# ComfyUI Subgraph UI Tools

A minimalist suite of custom nodes designed to organize, format, and display metadata directly within your ComfyUI subgraphs and workspace canvas.

---

## Included Nodes

### Sub Header

Visual UI layout element for organizing promoted parameters when a node is collapsed as a subgraph. **Does not affect graph execution.**

- **Headers**: Supports custom text, text/background styling, positioning, and alignments (Left, Center, Right).
- **Lines**: Configurable structural section breaks with adjustable thickness and matching colors.
- **Spaces**: Dynamic padding nodes to space out busy parameters.

### Sub Text

A smart markdown template engine node featuring dynamic connection slot loading (`{a}`, `{b}`, `{c}`) alongside auto-scanning environment tags.

- **Zero-Cable Ingestion**: Automatically grabs active parameters from your graph's core nodes without wire clutter.
- **Zero-Cable Ingestion AGAIN!!**: Add a Name, and **Sub Display** will be able to read it!

### Sub Display

A remote workspace dashboard card that pulls text outputs out of any `SubText` block by using its unique `NAME` tag.
Includes custom inline dynamic font sizing adjustments (+1 / -1) directly inside the node panel.

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
2. Restart ComfyUI.
3. Find your new tools inside the graph context menu search section under:
   ```text
   Subgraph UI -> Sub Header / Sub Text / Sub Display
   ```

---

## Creator's Notes

** SUBHEADER IS NOT NODE 2.0 COMPATIBLE **
I wanted to, then I saw the documentation and thought "meh, I'm not there yet".

It was made as a personal project as I'm apparently a clean freak. I wanted my Subgraph organize with headers and all... then it grew into this.
You will probably find some issues with it, and if you do, please feel free to share. I'm not certain I will fix them though, cause I'm lazy.

Build with alongside an LLM. I made my best to comment and organize it so I could understand all.
