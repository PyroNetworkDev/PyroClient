const { BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const pkg = require('../../../../package.json');

class ConsoleWindow {
    constructor() {
        this.window = null;
        this.isVisible = false;
    }

    init() {
        this.window = new BrowserWindow({
            title: `${pkg.productname} - Consola`,
            width: 1000,
            height: 700,
            minWidth: 800,
            minHeight: 600,
            icon: path.join(__dirname, '../../../assets/images/icon.ico'),
            webPreferences: {
                contextIsolation: false,
                nodeIntegration: true,
                enableRemoteModule: true,
                webSecurity: false
            },
            autoHideMenuBar: true,
            show: false,
            resizable: true,
            frame: true,
            backgroundColor: '#1e1e1e'
        });

        this.window.loadFile(path.join(__dirname, '../../../console.html'));

        // Configurar eventos
        this.window.on('closed', () => {
            this.window = null;
            this.isVisible = false;
        });

        this.window.on('close', (event) => {
            if (this.window) {
                event.preventDefault();
                this.hide();
            }
        });

        return this.window;
    }

    show() {
        if (this.window) {
            this.window.show();
            this.window.focus();
            this.isVisible = true;
        }
    }

    hide() {
        if (this.window) {
            this.window.hide();
            this.isVisible = false;
        }
    }

    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    destroy() {
        if (this.window) {
            // Limpiar solo los listeners IPC que esta ventana maneja específicamente
            // Los handlers globales (get-hwid, save-file) se manejan desde app.js
            
            this.window.destroy();
            this.window = null;
            this.isVisible = false;
        }
    }

    isReady() {
        return this.window && !this.window.isDestroyed();
    }

    sendLog(logData) {
        if (this.isReady()) {
            this.window.webContents.send('add-log', logData);
        }
    }

    clearLogs() {
        if (this.isReady()) {
            this.window.webContents.send('clear-logs');
        }
    }

    sendSystemInfo(info) {
        if (this.isReady()) {
            this.window.webContents.send('system-info', info);
        }
    }

    async getLogs() {
        if (this.isReady()) {
            try {
                const logs = await this.window.webContents.executeJavaScript(`
                    (function() {
                        if (window.consoleManager && typeof window.consoleManager.getLogsAsString === 'function') {
                            const logs = window.consoleManager.getLogsAsString();
                            console.log('Logs extraídos por getLogsAsString:', logs ? logs.length : 'null');
                            return logs;
                        } else if (window.consoleManager && window.consoleManager.logs && window.consoleManager.logs.length > 0) {
                            console.log('Usando método de fallback para extraer logs');
                            return window.consoleManager.logs.map(log => 
                                '[' + log.timestamp.toISOString() + '] [' + log.level.toUpperCase() + '] ' + (log.identifier ? '[' + log.identifier + '] ' : '') + log.message
                            ).join('\\n');
                        } else {
                            console.log('ConsoleManager no disponible o sin logs');
                            const status = window.consoleManager ? window.consoleManager.getConsoleStatus() : null;
                            console.log('Estado de la consola:', status);
                            return null;
                        }
                    })()
                `);
                return logs;
            } catch (error) {
                console.error('Error obteniendo logs desde ConsoleWindow:', error);
                return null;
            }
        }
        return null;
    }
}

module.exports = ConsoleWindow;
