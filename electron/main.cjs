const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
    app.quit();
}

let mainWindow;
let splashWindow;

function createSplashWindow() {
    splashWindow = new BrowserWindow({
        width: 500,
        height: 300,
        transparent: true,
        frame: false,
        alwaysOnTop: true,
        icon: path.join(__dirname, 'icon.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
        }
    });

    splashWindow.loadFile(path.join(__dirname, 'splash.html'));
    splashWindow.center();
}

function createWindow() {
    // Create the browser window.
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        show: false, // Don't show until ready
        backgroundColor: '#0f1014', // Match app background
        icon: path.join(__dirname, 'icon.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    });

    // Load the index.html of the app.
    // In development, load from the Vite dev server
    const isDev = !app.isPackaged;
    const startUrl = isDev
        ? 'http://localhost:5175'
        : `file://${path.join(__dirname, '../dist/index.html')}`;

    mainWindow.loadURL(startUrl);

    // Open the DevTools in dev mode
    if (isDev) {
        // mainWindow.webContents.openDevTools();
    }

    // Wait for content to finish loading before showing
    mainWindow.once('ready-to-show', () => {
        if (splashWindow) {
            splashWindow.close();
            splashWindow = null;
        }
        mainWindow.show();
        mainWindow.focus();
    });
}

// IPC Handler for saving images
ipcMain.handle('save-image', async (event, { filename, base64Data, subfolder }) => {
    try {
        const documentsPath = app.getPath('documents');
        // If subfolder provided, append it. Sanitize it slightly to prevent directory traversal up?
        // path.join handles '..' somewhat, but standard usage is just a name.
        const safeSub = (subfolder || '').replace(/[\\/:]/g, '_'); // Replace path separators in the name itself
        const saveDir = subfolder
            ? path.join(documentsPath, 'Musaic', 'Output', safeSub)
            : path.join(documentsPath, 'Musaic', 'Output');

        const fs = require('fs');
        if (!fs.existsSync(saveDir)) {
            fs.mkdirSync(saveDir, { recursive: true });
        }

        const filePath = path.join(saveDir, filename);
        const buffer = Buffer.from(base64Data, 'base64');
        fs.writeFileSync(filePath, buffer);

        return { success: true, path: filePath };
    } catch (error) {
        console.error("Failed to save image:", error);
        return { success: false, error: error.message };
    }
});

// IPC Handler for API Proxy (Bypasses CORS)
ipcMain.handle('api-request', async (event, { url, options }) => {
    try {
        console.log(`Proxying request to: ${url}`);
        const response = await fetch(url, options);

        // We need to consume the body before sending back to renderer
        const text = await response.text();
        let data;
        try {
            data = JSON.parse(text);
            // Log the data keys or a snippet to help debug
            console.log("API Proxy Response Data:", JSON.stringify(data).substring(0, 500) + "...");
        } catch (e) {
            data = text;
            console.log("API Proxy Response Text:", text.substring(0, 500) + "...");
        }

        return {
            ok: response.ok,
            status: response.status,
            statusText: response.statusText,
            data: data
        };
    } catch (error) {
        console.error("API Proxy Error:", error);
        return { ok: false, error: error.message };
    }
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.whenReady().then(() => {
    createSplashWindow();

    // Delay main window creation slightly to show off the splash screen (optional)
    setTimeout(() => {
        createWindow();
    }, 2000);

    app.on('activate', () => {
        // On OS X it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
