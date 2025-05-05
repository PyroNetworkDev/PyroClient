/**
 * @author Luuxis
 * @license CC-BY-NC 4.0 - https://creativecommons.org/licenses/by-nc/4.0
 */

"use strict";
const { app, BrowserWindow, Menu } = require("electron");
const path = require("path");
const pkg = require(path.join(`${app.getAppPath()}/package.json`));
const os = require("os");
let dev = process.env.DEV_TOOL === 'open';
let updateWindow = undefined;

function getWindow() {
    return updateWindow;
}

function destroyWindow() {
    if (!updateWindow) return;
    updateWindow.close();
    updateWindow = undefined;
}

function createWindow() {
    destroyWindow();

    let imageUrl = `${pkg.url}launcher/images-launcher`;
    let backupImagePath = './src/assets/images/background/updatebg.jpg'; // Path to backup image

    updateWindow = new BrowserWindow({
        title: "Pyro Client",
        width: 400,
        height: 500,
        resizable: false,
        icon: `./src/assets/images/icon.${os.platform() === "win32" ? "ico" : "png"}`,
        frame: false,
        show: false,
        webPreferences: {
            contextIsolation: false,
            nodeIntegration: true
        },
    });
    Menu.setApplicationMenu(null);
    updateWindow.setMenuBarVisibility(false);
    updateWindow.loadFile(path.join(`${app.getAppPath()}/src/index.html`));
    updateWindow.webContents.executeJavaScript(`
            var img = new Image();
            img.onload = function() {
                document.body.style.backgroundImage = 'url("${imageUrl}")';
            };
            img.onerror = function() {
                document.body.style.backgroundImage = '${backupImagePath}';
            };
            img.src = "${imageUrl}";
        `);
    updateWindow.once('ready-to-show', () => {
        if (updateWindow) {
            if (dev) updateWindow.webContents.openDevTools({ mode: 'detach' })
            updateWindow.show();
        }
    });
}

module.exports = {
    getWindow,
    createWindow,
    destroyWindow,
};