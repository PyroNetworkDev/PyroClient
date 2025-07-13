const { ipcRenderer } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

class ConsoleManager {
    constructor() {
        this.autoScroll = true;
        this.loggerContent = null;
        this.scrollToBottomBtn = null;
        this.hwid = '';
        this.initialized = false;
        this.logs = [];
        
        // Optimización para muchos logs seguidos
        this.logQueue = [];
        this.processingQueue = false;
        this.lastLogTime = 0;
        this.rapidLogThreshold = 100; // ms entre logs para considerar "rápidos"
        this.rapidLogCount = 0;
        this.skipAnimations = false;
        this.batchSize = 50; // Procesar logs en lotes de 50
        this.maxQueueSize = 1000; // Máximo logs en cola antes de empezar a descartar antiguos
        
        // Esperar a que el DOM esté cargado
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    async init() {
        if (this.initialized) return;
        
        this.loggerContent = document.getElementById('logger-content');
        this.scrollToBottomBtn = document.getElementById('scroll-to-bottom-btn');
        
        // Configurar eventos de la interfaz
        this.setupEventListeners();
        
        // Configurar listeners de IPC
        this.setupIpcListeners();
        
        // Inicializar información del sistema
        await this.initSystemInfo();
        
        // Configurar el icono inicial del auto-scroll
        this.updateAutoScrollIcon();
        
        // Solicitar colores dinámicos del launcher principal
        try {
            ipcRenderer.send('request-dynamic-colors');
        } catch (error) {
            console.warn('Error solicitando colores dinámicos:', error);
        }
        
        // Solicitar configuración del servidor para ocultar/mostrar botones
        try {
            ipcRenderer.send('request-server-config');
            
            // Timeout para asegurar que el botón se mantenga oculto si no llega la configuración
            setTimeout(() => {
                const patchToolkitBtn = document.getElementById('patch-toolkit-btn');
                if (patchToolkitBtn && patchToolkitBtn.style.display !== 'inline-block') {
                    // Si después de 3 segundos el botón no está visible, asegurar que esté oculto
                    patchToolkitBtn.style.display = 'none';
                    this.addLog('warn', '[Console] Timeout esperando configuración del servidor, manteniendo Toolkit de parches oculto', null, 'Console');
                }
            }, 3000);
        } catch (error) {
            console.warn('Error solicitando configuración del servidor:', error);
            // Asegurar que el botón esté oculto si hay error
            const patchToolkitBtn = document.getElementById('patch-toolkit-btn');
            if (patchToolkitBtn) {
                patchToolkitBtn.style.display = 'none';
            }
        }
        
        this.initialized = true;
        this.addLog('info', 'Consola inicializada correctamente', null, 'Console');
    }

    setupEventListeners() {
        // Botón limpiar logs
        const clearBtn = document.getElementById('clear-logs-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearLogs());
        }

        // Botón exportar logs
        const exportBtn = document.getElementById('export-logs-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportLogs());
        }

        // Botón toggle auto-scroll
        const autoScrollBtn = document.getElementById('toggle-autoscroll-btn');
        if (autoScrollBtn) {
            autoScrollBtn.addEventListener('click', () => this.toggleAutoScroll());
        }

        // Botón scroll al final
        if (this.scrollToBottomBtn) {
            this.scrollToBottomBtn.addEventListener('click', () => this.scrollToBottom());
        }

        // Copiar HWID
        const copyHwidBtn = document.getElementById('copy-hwid-btn');
        if (copyHwidBtn) {
            copyHwidBtn.addEventListener('click', () => this.copyHwid());
        }

        // Reportar problema
        const reportBtn = document.getElementById('report-issue-btn');
        if (reportBtn) {
            reportBtn.addEventListener('click', () => {
                this.reportIssue();
            ipcRenderer.send('console-window-close');
            });

        }

        // Patch toolkit
        const patchBtn = document.getElementById('patch-toolkit-btn');
        if (patchBtn) {
            patchBtn.addEventListener('click', () => {
                this.openPatchToolkit();
            ipcRenderer.send('console-window-close');
            });
        }

        // Manejar scroll para mostrar/ocultar botón de scroll al final
        if (this.loggerContent) {
            this.loggerContent.addEventListener('scroll', () => this.handleScroll());
        }

        // Atajos de teclado
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey) {
                switch (e.key) {
                    case 'l':
                    case 'L':
                        e.preventDefault();
                        this.clearLogs();
                        break;
                    case 's':
                    case 'S':
                        e.preventDefault();
                        this.exportLogs();
                        break;
                }
            }
        });
    }

    setupIpcListeners() {
        // Recibir logs desde la ventana principal
        ipcRenderer.on('add-log', (event, logData) => {
            this.addLogFromData(logData);
        });

        // Limpiar logs
        ipcRenderer.on('clear-logs', () => {
            this.clearLogs();
        });

        // Recibir información del sistema
        ipcRenderer.on('system-info', (event, info) => {
            if (info.hwid) {
                this.hwid = info.hwid;
                this.updateHwidDisplay();
            }
        });

        // Aplicar colores dinámicos
        ipcRenderer.on('apply-dynamic-colors', (event, colors) => {
            this.applyDynamicColors(colors);
        });

        // Aplicar configuración del servidor
        ipcRenderer.on('apply-server-config', (event, config) => {
            this.applyServerConfig(config);
        });
    }

    async initSystemInfo() {
        try {
            // Solicitar HWID a la ventana principal
            const hwid = await ipcRenderer.invoke('get-hwid');
            if (hwid) {
                this.hwid = hwid;
                this.updateHwidDisplay();
            }
        } catch (error) {
            console.error('Error obteniendo información del sistema:', error);
        }

        // Mostrar información de versión
        const versionInfo = document.getElementById('console-version-info');
        if (versionInfo) {
            try {
                const versionData = await ipcRenderer.invoke('get-version-info');
                let versionText = `v${versionData.version}${versionData.sub_version ? `-${versionData.sub_version}` : ''}`;
                
                // Verificar si es el launcher original
                const isOriginalLauncher = await this.checkIfOriginalLauncher();
                
                // Agregar información de versión base solo si no es el launcher original
                if (!isOriginalLauncher && versionData.baseVersionInfo) {
                    const baseInfo = versionData.baseVersionInfo;
                    if (baseInfo.isUndetermined) {
                        versionText += ` (Base desconocida)`;
                    } else if (!baseInfo.isOfficial) {
                        versionText += ` (Base v${baseInfo.version})`;
                    }
                }
                
                versionInfo.textContent = versionText;
            } catch (error) {
                console.error('Error cargando información de versión:', error);
                versionInfo.textContent = 'v?.?.?';
            }
        }
    }

    addLogFromData(logData) {
        const { type, args, timestamp, identifier } = logData;
        let message = args.join(' ');
        
        // Evitar duplicación de etiquetas [Identifier]
        if (identifier) {
            const identifierTag = `[${identifier}]`;
            // Remover el tag del identifier del mensaje si aparece al principio
            if (message.startsWith(identifierTag)) {
                message = message.substring(identifierTag.length).trim();
            }
            // También verificar con espacio después del tag
            else if (message.startsWith(identifierTag + ' ')) {
                message = message.substring(identifierTag.length + 1).trim();
            }
        }
        
        this.addLog(type, message, timestamp, identifier);
    }

    addLog(level, message, timestamp = null, identifier = null) {
        if (!this.loggerContent) return;

        const now = Date.now();
        const timeSinceLastLog = now - this.lastLogTime;
        
        // Detectar logs rápidos consecutivos
        if (timeSinceLastLog < this.rapidLogThreshold) {
            this.rapidLogCount++;
            if (this.rapidLogCount > 5) { // Reducir umbral para activar más rápidamente
                this.skipAnimations = true;
            }
        } else {
            this.rapidLogCount = 0;
            this.skipAnimations = false;
        }
        
        this.lastLogTime = now;

        const logEntry = {
            level: level || 'info',
            message: message || '',
            timestamp: timestamp || new Date(),
            identifier: identifier
        };

        // Gestión de cola de logs para evitar sobrecarga
        this.logQueue.push(logEntry);
        
        // Limitar el tamaño de la cola para evitar problemas de memoria
        if (this.logQueue.length > this.maxQueueSize) {
            // Eliminar los logs más antiguos
            this.logQueue = this.logQueue.slice(-this.maxQueueSize);
            console.warn(`Cola de logs recortada a ${this.maxQueueSize} entradas para evitar sobrecarga de memoria`);
        }
        
        if (!this.processingQueue) {
            this.processLogQueue();
        }
    }

    async processLogQueue() {
        this.processingQueue = true;
        
        while (this.logQueue.length > 0) {
            // Procesar en lotes para mejorar rendimiento
            const batchSize = this.skipAnimations ? this.batchSize : 1;
            const currentBatch = this.logQueue.splice(0, batchSize);
            
            // Crear fragmento de documento para inserción eficiente
            const fragment = document.createDocumentFragment();
            
            for (const logEntry of currentBatch) {
                this.logs.push(logEntry);
                const logElement = this.createLogElement(logEntry);
                fragment.appendChild(logElement);
            }
            
            // Insertar todo el fragmento de una vez
            this.loggerContent.appendChild(fragment);

            // Solo hacer scroll y actualizar botón si no estamos en modo rápido
            if (!this.skipAnimations) {
                // Auto-scroll si está habilitado
                if (this.autoScroll) {
                    this.scrollToBottom();
                }
                
                // Actualizar botón de scroll
                this.updateScrollButton();
                
                // Pequeño delay para no sobrecargar el DOM
                await new Promise(resolve => setTimeout(resolve, 1));
            } else {
                // En modo rápido, yield al event loop ocasionalmente
                if (currentBatch.length >= this.batchSize) {
                    await new Promise(resolve => setTimeout(resolve, 0));
                }
            }
        }
        
        // Si saltamos animaciones, hacer un scroll final y actualización
        if (this.skipAnimations) {
            if (this.autoScroll) {
                this.scrollToBottom();
            }
            this.updateScrollButton();
        }
        
        this.processingQueue = false;
    }

    createLogElement(logEntry) {
        const logDiv = document.createElement('div');
        logDiv.className = `log-entry ${logEntry.level}`;

        const timestamp = document.createElement('span');
        timestamp.className = 'log-timestamp';
        timestamp.textContent = `[${logEntry.timestamp.toLocaleTimeString()}]`;

        const level = document.createElement('span');
        level.className = 'log-level';
        level.textContent = `[${logEntry.level.toUpperCase()}]`;

        const message = document.createElement('span');
        message.className = 'log-message';
        
        // Formatear mensaje con identificador si está disponible
        if (logEntry.identifier && !logEntry.message.includes(`[${logEntry.identifier}]`)) {
            message.textContent = `[${logEntry.identifier}] ${logEntry.message}`;
        } else {
            message.textContent = logEntry.message;
        }

        logDiv.appendChild(timestamp);
        logDiv.appendChild(level);
        logDiv.appendChild(message);

        // Aplicar animación solo si no estamos saltando animaciones
        if (!this.skipAnimations) {
            logDiv.style.animation = 'fadeIn 0.2s ease-in';
        }

        return logDiv;
    }

    clearLogs() {
        if (this.loggerContent) {
            this.loggerContent.innerHTML = '';
        }
        this.logs = [];
        this.addLog('info', '[Console] Logs limpiados');
    }

    async exportLogs() {
        try {
            const logsText = this.logs.map(log => 
                `[${log.timestamp.toISOString()}] [${log.level.toUpperCase()}] ${log.message}`
            ).join('\n');

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `console-export-${timestamp}.log`;

            // Usar el API de Electron para guardar el archivo
            const result = await ipcRenderer.invoke('save-file', {
                filename: filename,
                content: logsText,
                filters: [
                    { name: 'Log Files', extensions: ['log'] },
                    { name: 'Text Files', extensions: ['txt'] },
                    { name: 'All Files', extensions: ['*'] }
                ]
            });

            if (result.success) {
                this.addLog('info', `[Console] Logs exportados a: ${result.path}`);
            }
        } catch (error) {
            console.error('Error exportando logs:', error);
            this.addLog('error', `[Console] Error exportando logs: ${error.message}`);
        }
    }

    toggleAutoScroll() {
        this.autoScroll = !this.autoScroll;
        const btn = document.getElementById('toggle-autoscroll-btn');
        if (btn) {
            const icon = btn.querySelector('i');
            if (icon) {
                // Cuando auto-scroll está ACTIVO, mostrar icono de PAUSA
                // Cuando auto-scroll está INACTIVO, mostrar icono de FLECHAS para activar
                icon.className = this.autoScroll ? 
                    'fa-solid fa-pause' : 
                    'fa-solid fa-play';
            }
            btn.title = this.autoScroll ? 
                'Pausar auto-scroll' : 
                'Activar auto-scroll';
        }
        
        this.addLog('info', `[Console] Auto-scroll ${this.autoScroll ? 'activado' : 'desactivado'}`);
        
        if (this.autoScroll) {
            this.scrollToBottom();
        }
    }

    scrollToBottom() {
        if (this.loggerContent) {
            this.loggerContent.scrollTop = this.loggerContent.scrollHeight;
        }
    }

    handleScroll() {
        if (!this.loggerContent || !this.scrollToBottomBtn) return;

        const isAtBottom = this.loggerContent.scrollTop + this.loggerContent.clientHeight >= 
                          this.loggerContent.scrollHeight - 5;

        if (isAtBottom) {
            this.scrollToBottomBtn.classList.remove('show');
        } else {
            this.scrollToBottomBtn.classList.add('show');
        }
    }

    updateScrollButton() {
        if (!this.loggerContent || !this.scrollToBottomBtn) return;

        setTimeout(() => {
            this.handleScroll();
        }, 100);
    }

    updateAutoScrollIcon() {
        const btn = document.getElementById('toggle-autoscroll-btn');
        if (btn) {
            const icon = btn.querySelector('i');
            if (icon) {
                // Cuando auto-scroll está ACTIVADO: mostrar icono de pausa (para pausarlo)
                // Cuando auto-scroll está DESACTIVADO: mostrar icono de flechas (para activarlo)
                icon.className = this.autoScroll ? 
                    'fa-solid fa-pause' : 
                    'fa-solid fa-play';
            }
            btn.title = this.autoScroll ? 
                'Pausar auto-scroll' : 
                'Activar auto-scroll';
        }
    }

    updateHwidDisplay() {
        const hwidElement = document.getElementById('console-hwid');
        if (hwidElement && this.hwid) {
            hwidElement.textContent = this.hwid;
        }
    }

    copyHwid() {
        if (this.hwid) {
            navigator.clipboard.writeText(this.hwid).then(() => {
                this.addLog('info', '[Console] ID de soporte copiado al portapapeles');
            }).catch(error => {
                console.error('Error copiando HWID:', error);
                this.addLog('error', '[Console] Error copiando ID de soporte');
            });
        }
    }

    reportIssue() {
        this.addLog('info', '[Console] Abriendo herramienta de reporte de problemas...');
        ipcRenderer.send('report-issue');
    }

    openPatchToolkit() {
        this.addLog('info', '[Console] Abriendo toolkit de parches...');
        ipcRenderer.send('open-patch-toolkit');
    }

    async checkIfOriginalLauncher() {
        try {
            // Verificar si existe el archivo package.json y leer la información del repositorio
            const versionData = await ipcRenderer.invoke('get-version-info');
            
            // Verificar si el repositorio coincide con el original
            if (versionData.repository && versionData.repository.url) {
                const repoUrl = versionData.repository.url.toLowerCase();
                const originalRepo = 'https://github.com/miguelkix30/miguelkinetworkmclauncher';
                
                // Normalizar URLs para comparación
                const normalizedRepoUrl = repoUrl
                    .replace('git+', '')
                    .replace('.git', '')
                    .replace('http://', 'https://');
                
                return normalizedRepoUrl.includes('github.com/miguelkix30/miguelkinetworkmclauncher');
            }
            
            return false;
        } catch (error) {
            console.warn('Error verificando launcher original:', error);
            return false;
        }
    }

    applyDynamicColors(colors) {
        if (!colors || typeof colors !== 'object') {
            console.warn('[Console] No se recibieron colores válidos para aplicar');
            return;
        }

        const root = document.documentElement;
        let appliedCount = 0;
        
        // Aplicar las variables CSS dinámicas
        Object.keys(colors).forEach(property => {
            const value = colors[property];
            if (value) {
                root.style.setProperty(`--${property}`, value);
                appliedCount++;
            }
        });

        if (appliedCount > 0) {
            this.addLog('info', `${appliedCount} colores dinámicos aplicados correctamente`, null, 'Console');
        } else {
            this.addLog('warn', 'No se aplicaron colores dinámicos - valores inválidos', null, 'Console');
        }
    }

    applyServerConfig(config) {
        console.log('[Console] Aplicando configuración del servidor:', config);
        
        // Manejar visibilidad del botón de Toolkit de parches
        const patchToolkitBtn = document.getElementById('patch-toolkit-btn');
        if (patchToolkitBtn) {
            let shouldShow = false;
            
            if (config && config.patchToolkit !== undefined) {
                shouldShow = config.patchToolkit === true;
                this.addLog('info', `[Console] Toolkit de parches ${shouldShow ? 'habilitado' : 'deshabilitado'} por configuración del servidor`, null, 'Console');
            } else {
                // Si no hay configuración o no se especifica patchToolkit, mantener oculto por seguridad
                this.addLog('warn', '[Console] Configuración de Toolkit de parches no especificada, manteniendo oculto', null, 'Console');
            }
            
            patchToolkitBtn.style.display = shouldShow ? 'inline-block' : 'none';
            console.log(`[Console] Botón Toolkit de parches: ${shouldShow ? 'visible' : 'oculto'}`);
        } else {
            console.warn('[Console] Botón patch-toolkit-btn no encontrado en el DOM');
        }
        
        // Aquí se pueden agregar más configuraciones del servidor en el futuro
    }

    // Método para obtener logs como string (para reportes)
    getLogsAsString() {
        if (!this.logs || this.logs.length === 0) {
            return null;
        }

        return this.logs.map(log => 
            `[${log.timestamp.toISOString()}] [${log.level.toUpperCase()}] ${log.identifier ? '[' + log.identifier + '] ' : ''}${log.message}`
        ).join('\n');
    }

    // Método para obtener información de estado de la consola
    getConsoleStatus() {
        return {
            initialized: this.initialized,
            logCount: this.logs ? this.logs.length : 0,
            queueSize: this.logQueue ? this.logQueue.length : 0,
            autoScroll: this.autoScroll,
            hwid: this.hwid
        };
    }
}

// Inicializar el manager de consola
const consoleManager = new ConsoleManager();

// Exponer el consoleManager en el objeto window para acceso desde el proceso principal
window.consoleManager = consoleManager;
