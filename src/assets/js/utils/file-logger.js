const fs = require('fs');
const path = require('path');
const os = require('os');

class FileLogger {
    constructor(logDir) {
        this.logDir = logDir;
        this.currentLogFile = null;
        this.latestLogFile = null;
        this.maxLogSize = 10 * 1024 * 1024; // 10MB por archivo
        this.maxLogFiles = 15; // Máximo 15 archivos de log (mayor para preservar más historial)
        
        this.ensureLogDirectory();
        this.handlePreviousLatestLog();
        this.initCurrentLogFile();
        this.cleanupOldLogs();
    }

    ensureLogDirectory() {
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }

    handlePreviousLatestLog() {
        const latestLogPath = path.join(this.logDir, 'launcher-latest.log');
        
        if (fs.existsSync(latestLogPath)) {
            try {
                const stats = fs.statSync(latestLogPath);
                const lastModified = stats.mtime;
                
                // Crear nombre con fecha y hora de la última modificación
                const dateStr = lastModified.toISOString().split('T')[0]; // YYYY-MM-DD
                const timeStr = lastModified.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
                
                const archivedName = `launcher-${dateStr}-${timeStr}.log`;
                const archivedPath = path.join(this.logDir, archivedName);
                
                // Verificar que el archivo tiene contenido antes de archivarlo
                if (stats.size > 0) {
                    // Renombrar el archivo anterior
                    fs.renameSync(latestLogPath, archivedPath);
                    console.log(`Archivo de log anterior archivado como: ${archivedName}`);
                } else {
                    // Eliminar archivo vacío
                    fs.unlinkSync(latestLogPath);
                    console.log('Archivo launcher-latest.log vacío eliminado');
                }
                
            } catch (error) {
                console.error('Error manejando el archivo launcher-latest.log anterior:', error);
                // Si hay error, eliminamos el archivo para empezar limpio
                try {
                    fs.unlinkSync(latestLogPath);
                } catch (unlinkError) {
                    console.error('Error eliminando archivo launcher-latest.log corrupto:', unlinkError);
                }
            }
        }
    }

    initCurrentLogFile() {
        // Crear el archivo launcher-latest.log
        this.latestLogFile = path.join(this.logDir, 'launcher-latest.log');
        this.currentLogFile = this.latestLogFile;
        
        const now = new Date();
        
        // Escribir cabecera del archivo
        const header = [
            `# Miguelki Network MC Launcher - Log File`,
            `# Fecha de inicio: ${now.toLocaleString()}`,
            `# Plataforma: ${os.platform()} ${os.arch()}`,
            `# Node.js: ${process.version}`,
            `# Directorio de trabajo: ${process.cwd()}`,
            ``,
            ``
        ].join('\n');
        
        fs.writeFileSync(this.currentLogFile, header);
    }

    log(level, message, ...args) {
        try {
            const timestamp = new Date().toISOString();
            const processedArgs = args.map(arg => {
                if (typeof arg === 'string') {
                    return arg;
                } else if (arg instanceof Error) {
                    return arg.stack || arg.message;
                } else if (typeof arg === 'object') {
                    try {
                        return JSON.stringify(arg, null, 2);
                    } catch {
                        return '[Object]';
                    }
                } else {
                    return String(arg);
                }
            });

            const fullMessage = [message, ...processedArgs].join(' ');
            const logLine = `[${timestamp}] [${level.toUpperCase()}] ${fullMessage}\n`;
            
            // Verificar tamaño del archivo antes de escribir
            this.checkLogRotation();
            
            // Escribir al archivo
            fs.appendFileSync(this.currentLogFile, logLine);
            
        } catch (error) {
            console.error('Error writing to log file:', error);
        }
    }

    checkLogRotation() {
        if (!fs.existsSync(this.currentLogFile)) {
            return;
        }

        const stats = fs.statSync(this.currentLogFile);
        if (stats.size >= this.maxLogSize) {
            this.rotateLog();
        }
    }

    rotateLog() {
        // Solo rotar si el archivo actual no es el launcher-latest.log
        // En este caso, mantener siempre el launcher-latest.log como archivo actual
        if (this.currentLogFile === this.latestLogFile) {
            // Archivar el archivo actual
            const now = new Date();
            const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
            const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
            
            const archivedName = `launcher-${dateStr}-${timeStr}.log`;
            const archivedPath = path.join(this.logDir, archivedName);
            
            try {
                // Copiar el contenido al archivo archivado
                fs.copyFileSync(this.currentLogFile, archivedPath);
                
                // Limpiar el archivo actual para empezar de nuevo
                const header = [
                    `# Miguelki Network MC Launcher - Log File (Rotated)`,
                    `# Fecha de rotación: ${now.toLocaleString()}`,
                    `# Archivo anterior archivado como: ${archivedName}`,
                    ``,
                    ``
                ].join('\n');
                
                fs.writeFileSync(this.currentLogFile, header);
                
                console.log(`Log rotado: archivo archivado como ${archivedName}`);
                
            } catch (error) {
                console.error('Error durante la rotación de logs:', error);
            }
        }
        
        // Limpiar archivos antiguos
        this.cleanupOldLogs();
    }

    cleanupOldLogs() {
        try {
            const files = fs.readdirSync(this.logDir)
                .filter(file => file.startsWith('launcher-') && file.endsWith('.log') && file !== 'launcher-latest.log')
                .map(file => ({
                    name: file,
                    path: path.join(this.logDir, file),
                    stats: fs.statSync(path.join(this.logDir, file))
                }))
                .sort((a, b) => b.stats.mtime - a.stats.mtime); // Ordenar por fecha de modificación (más reciente primero)

            // Eliminar archivos que excedan el límite (excluyendo launcher-latest.log)
            if (files.length > this.maxLogFiles) {
                const filesToDelete = files.slice(this.maxLogFiles);
                filesToDelete.forEach(file => {
                    try {
                        fs.unlinkSync(file.path);
                        console.log(`Archivo de log antiguo eliminado: ${file.name}`);
                    } catch (error) {
                        console.error(`Error eliminando archivo de log ${file.name}:`, error);
                    }
                });
            }
        } catch (error) {
            console.error('Error during log cleanup:', error);
        }
    }

    getLogFiles() {
        try {
            return fs.readdirSync(this.logDir)
                .filter(file => file.startsWith('launcher-') && file.endsWith('.log'))
                .map(file => ({
                    name: file,
                    path: path.join(this.logDir, file),
                    size: fs.statSync(path.join(this.logDir, file)).size,
                    modified: fs.statSync(path.join(this.logDir, file)).mtime
                }))
                .sort((a, b) => b.modified - a.modified);
        } catch (error) {
            console.error('Error getting log files:', error);
            return [];
        }
    }

    getCurrentLogFile() {
        return this.currentLogFile;
    }

    readLogFile(filename) {
        try {
            const filePath = path.join(this.logDir, filename);
            return fs.readFileSync(filePath, 'utf8');
        } catch (error) {
            console.error(`Error reading log file ${filename}:`, error);
            return null;
        }
    }
}

module.exports = FileLogger;
