
<div align="center">

# 🧬 MUSAIC
### Dataset Architect & Prompt Forge

[![React](https://img.shields.io/badge/React-18-blue?style=flat-square&logo=react)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-Bundler-purple?style=flat-square&logo=vite)](https://vitejs.dev/)
[![Gemini](https://img.shields.io/badge/Gemini-Pro-orange?style=flat-square&logo=google)](https://deepmind.google/technologies/gemini/)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

**Create strict-identity LoRA training datasets in minutes.**  
*Browser-Based • Privacy-First • Forensic Consistency*

[Report Bug](https://github.com/degenerativeai/musaic/issues) · [Request Feature](https://github.com/degenerativeai/musaic/issues)

</div>

---

## ✨ Features

- **Zero Server Setup**: Runs 100% in your browser (or as a local Electron app).
- **VisionStruct™ Analysis**: Forensic-level extraction of subject biometrics using Gemini Vision.
- **Silent Face Protocol**: Prevents "Reference Ignored" bugs by stripping facial text while keeping body descriptions.
- **Vacuum Compiler**: Assembles complex prompts with token-density ordering to prevent bleeding.
- **Direct API**: Talk directly to Google Gemini or Wavespeed. No middleman servers.
- **Auto-Zipping**: Downloads your dataset as a structured ZIP file ready for training.

---

## 🎯 How It Works

Musaic treats prompt generation as a compilation task, not a creative writing one.

```
┌─────────────────────────────────────────────────────────────┐
│                   YOUR BROWSER (CLIENT)                     │
│                                                             │
│   1. Upload Reference (Head/Body)                           │
│   2. VisionStruct™ extracts "Biometric Profile" (JSON)      │
│   3. Vacuum Compiler assembles 100+ unique prompts          │
│      [Framing] + [Action] + [Body_Stack] + [Wardrobe]       │
│                                                             │
│   4. Silent Face Protocol sanitizes prompts                 │
│   5. Generate Images (Batch Async)                          │
│   6. Download as ZIP                                        │
│                                                             │
│   ═══════════════════════════════════════════════════════   │
│                             │                               │
│                             ▼                               │
│                   GOOGLE / WAVESPEED API                    │
│                  (High-Fidelity Generation)                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### Option 1: Web App (Recommended)
1. Clone the repo:
   ```bash
   git clone https://github.com/degenerativeai/musaic.git
   cd musaic
   ```
2. Install & Run:
   ```bash
   npm install
   npm run dev
   ```
3. Open `http://localhost:5173`.

### Option 2: Desktop App (.exe)
Prefer a standalone app? Build the Electron installer:
```bash
npm run electron:build
```
Find the installer in the `release/` folder.

---

## 📦 Output Format

Your download will be a ZIP file containing optimized images for LoRA training:

```
CharacterName_Batch_Date.zip
├── CharacterName_1.png    # "Headshot, dramatic lighting..."
├── CharacterName_2.png    # "Full body, running, red dress..."
├── CharacterName_3.png    # "Close up, makeup details..."
└── ...
```

---

## 🔑 API Key Security
- **No Backend Storage**: Your key is stored ONLY in `sessionStorage`.
- **Ephemeral**: Closing the tab wipes the key.
- **Direct**: The key is sent only to Google/Wavespeed endpoints.

## 💰 Cost
- **Google Gemini**:  Free tier available (Gemini 1.5 Flash).
- **Wavespeed**: Usage-based pricing.

---

<div align="center">
Built with 💜 by Degenerative AI
</div>
