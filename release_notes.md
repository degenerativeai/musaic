# Release Notes v1.1 - The "Nano Banana" Update

**Summary**
This release shifts the default generation engine to Google's Nano Banana Pro for enhanced speed and fidelity, while also delivering a complete overhaul of the project documentation and branding.

## ⚡ Core Changes
*   **Default Provider Update**: Switched default image generator to **Google (Nano Banana Pro)**.
*   **Nano Banana Pro Integration**: Explicitly labeled and configured the UI to reflect the Pro model tier.
*   **Security Hardening**: Audited and secured API key handling in the frontend.

## 📚 Documentation & Branding
*   **Architectural Overhaul**: rewritten `README.md` with "VisionStruct", "Silent Face Protocol", and "Vacuum Compiler" terminology.
*   **Visual Logic**: Added ASCII-style architectural diagrams to explain the compilation flow.
*   **Branding**: Updated visual identity and repository metadata.

## 🛠️ Fixes
*   **File Locking**: Resolved Windows file locking issues during documentation updates.
*   **Dependencies**: Cleaned up dev dependencies and build scripts.

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
