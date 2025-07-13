/**
 * @author Luuxis
 * @license CC-BY-NC 4.0 - https://creativecommons.org/licenses/by-nc/4.0
 */

const { app, BrowserWindow, Menu, screen } = require("electron");
const path = require("path");
const os = require("os");
const pkg = require("../../../../package.json");
const proportionWidth = 1280 / 1920;
const proportionHeight = 795 / 1080;
let dev = process.env.DEV_TOOL === 'open';
let mainWindow = undefined;
let windowWidth, windowHeight;

function getWindow() {
    return mainWindow;
}

function destroyWindow() {
    if (!mainWindow) return;
    app.quit();
    mainWindow = undefined;
}

function createWindow() {
    destroyWindow();
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    if (width <= 1280 && height <= 720) {
        windowWidth = Math.floor(width * proportionWidth);
        windowHeight = Math.floor(height * proportionHeight);
    } else {
        windowWidth = 1280;
        windowHeight = 795;
    }
    mainWindow = new BrowserWindow({
        title: pkg.productname,
        width: windowWidth,
        height: windowHeight,
        minWidth: 980,
        minHeight: 500,
        resizable: false,
        maximizable: false,
        icon: `./src/assets/images/icon.${os.platform() === "win32" ? "ico" : "png"}`,
        frame: false,
        show: false,
        webPreferences: {
            contextIsolation: false,
            nodeIntegration: true
        },
    });
    Menu.setApplicationMenu(null);
    
    mainWindow.on('close', async (event) => {
        event.preventDefault();
        
        try {
            if (!mainWindow.isDestroyed()) {
                mainWindow.webContents.send('process-cleanup-queue');
                
                setTimeout(() => {
                    try {
                        if (!mainWindow.isDestroyed()) {
                            app.exit(0);
                        }
                    } catch (error) {
                        app.exit(1);
                    }
                }, 1000);
            }
        } catch (error) {
            app.exit(1);
        }
    });
    
    mainWindow.setMenuBarVisibility(false);
    mainWindow.loadFile(path.join(`${app.getAppPath()}/src/launcher.html`));
    mainWindow.once('ready-to-show', () => {
        if (mainWindow) {
            if (dev) mainWindow.webContents.openDevTools({ mode: 'detach' })
            mainWindow.show()
        }
    });
}

module.exports = {
    getWindow,
    createWindow,
    destroyWindow,
};