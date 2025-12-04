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
