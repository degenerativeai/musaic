# Cross-Platform Development Guide

Musaic is built on **Electron**, which requires specific handling when moving between operating systems (e.g., macOS to Windows). This guide outlines the best practices to avoid binary incompatibilities and version conflicts.

## 🔄 The "Sync-Then-Build" Protocol

When switching computers, always follow this order of operations:

### 1. Leaving a Machine (e.g., Mac)
1.  **Commit Everything**: Ensure your working directory is clean.
2.  **Push**: `git push origin main`
3.  **Do Not Tag**: Only create git tags/releases on the machine where you intend to build the final production artifact for that specific platform (unless you are using CI/CD).

### 2. Arriving at a Machine (e.g., Windows)
1.  **Pull First**: 
    ```bash
    git pull
    ```
2.  **Rebuild Native Dependencies**: 
    Node modules often compile C++ bindings specific to the OS (Mac ARM64 vs Windows x64). You must rebuild them.
    ```bash
    # This automatically rebuilds native modules for the current OS
    npm install
    ```
    *If you encounter weird errors, nuke the modules and reinstall:*
    ```bash
    rm -rf node_modules
    npm install
    ```
3.  **Dev vs Build**:
    - **Dev**: `npm run dev` (Starts Vite + Electron)
    - **Production Build**: `npm run electron:build` (This produces the `.exe` or `.dmg`)

## ⚠️ Common Pitfalls

### Version Mismatches
If you bumped the version to `1.2.0` on Mac but didn't push, and then started working on Windows on `1.1.5`, you will have a conflict.
*   **Fix**: Always pull before changing `package.json`.

### "Module Not Found" / Binary Errors
If you see errors about `@parcel/watcher`, `esbuild`, or `sharp` after switching OS:
*   **Fix**: Run `npm install` to force a rebuild of the platform-specific binaries.

### Icon/Asset Paths
Windows and Mac handle file paths differently.
*   **Always** import assets in React code:
    ```typescript
    // ✅ Correct
    import logo from './assets/logo.png';
    <img src={logo} />
    
    // ❌ Risk of breaking (Absolute paths)
    <img src="/logo.png" />
    ```
