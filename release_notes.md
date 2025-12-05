# Release Notes v1.1.1 - Security & Architecture Update

**Summary**
This maintenance release focuses on security hardening and privacy, alongside the transition to the Nano Banana Pro engine.

## 🔒 Security & Privacy
*   **Content Security Policy (CSP)**: Implemented strict CSP in `index.html` to allow only whitelisted API endpoints (Google & Wavespeed).
*   **Data Leak Prevention**: Removed verbose debug logging in the Electron main process to ensure user prompts and API responses are never written to local logs or consoles.
*   **Ephemeral Keys**: Updated documentation to strictly clarify that API keys are client-side only and wiped on session close.

## ⚡ Core Changes
*   **Default Provider Update**: Switched default image generator to **Google (Nano Banana Pro)**.
*   **Nano Banana Pro Integration**: Explicitly labeled and configured the UI to reflect the Pro model tier.

## 📚 Documentation & Branding
*   **Architectural Overhaul**: rewritten `README.md` with "VisionStruct", "Silent Face Protocol", and "Vacuum Compiler" terminology.
*   **Visual Logic**: Added ASCII-style architectural diagrams to explain the compilation flow.
*   **Branding**: Updated visual identity and repository metadata.

## 🛠️ Fixes
*   **File Locking**: Resolved Windows file locking issues.
*   **Dependencies**: Cleaned up dev dependencies.

---

# Release Notes - UGC Refinement & Social Mode

## New Features
*   **Social Media Mode**: Create lifestyle content from scratch (Text-to-Prompt).
    *   Includes custom instruction input and batch size slider (1-10).
*   **VisionStruct Ultra**: Enhanced analysis with forensic-level detail.
    *   **Realism**: Camera physics (bokeh, chromatic aberration), sensor noise, and lighting physics.
    *   **Imperfections**: Detailed skin texture, hair flyaways, and natural flaws.
    *   **Identity Control**: Strict "adult woman" terminology and improved celebrity likeness locking.

## UI Improvements
*   **Unified UGC Layout**:
    *   Radio buttons for "Replicate", "Inject", and "Social" are always visible.
    *   "Replicate" and "Inject" are locked until an image is uploaded.
    *   Upload box clearly labeled "Upload Image to Replicate".
*   **Reset Functionality**: Added a "Reset Prompts" button to clear the session state.
*   **Cleanup**: Removed legacy controls and improved button labels.

## Bug Fixes
*   **Repetition Loop**: Fixed an issue where the AI would generate repetitive, philosophical text in the identity field.
*   **Stability**: Improved JSON parsing and added loading states.

---

# Release Notes v1.1.5 - Final Polish

## 🐛 Bug Fixes
*   **Logo Asset Loading (v1.1.5)**: Fixed the broken logo on the Authentication ("Splash") screen in the Electron build. The logo is now correctly bundled as an asset.
*   **Main Header Logo (v1.1.4)**: Fixed similar logo loading issue in the main application header.
*   **UGC Tab Logic (v1.1.3)**:
    *   Fixed a UI regression where LoRA-specific components (Headshot/Bodyshot upload) were leaking into the UGC tab.
    *   Updated "Replicate" logic to prevent accidental stripping of facial features.
*   **AI Robustness (v1.1.2)**:
    *   **JSON Parsing**: Added aggressive markdown stripping to handle Gemini API responses that wrap JSON in code blocks (```json), fixing the "AI Response Malformed" error.

## 📦 Build
*   **Version**: 1.1.5
*   **Platform**: Windows (x64)
