/**
 * @author MiguelkiNetwork  
 * @license CC-BY-NC 4.0 - https://creativecommons.org/licenses/by-nc/4.0
 * Utilidades para descarga y extracción de Java
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const AdmZip = require('adm-zip');

/**
 * Verifica el hash SHA-256 de un archivo
 */
async function verifyFileHash(filePath, expectedHash) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);
        
        stream.on('error', reject);
        stream.on('data', chunk => hash.update(chunk));
        stream.on('end', () => {
            const actualHash = hash.digest('hex');
            resolve(actualHash.toLowerCase() === expectedHash.toLowerCase());
        });
    });
}

/**
 * Extrae un archivo ZIP usando adm-zip
 */
async function extractZip(archivePath, extractPath) {
    try {
        // Crear directorio de destino si no existe
        if (!fs.existsSync(extractPath)) {
            fs.mkdirSync(extractPath, { recursive: true });
        }
        
        const zip = new AdmZip(archivePath);
        
        // Extraer todos los archivos
        zip.extractAllTo(extractPath, true);
        
        // En sistemas Unix, asegurar que los archivos binarios sean ejecutables
        if (process.platform !== 'win32') {
            const javaExecutables = findFilesRecursive(extractPath, /^java$/);
            javaExecutables.forEach(executable => {
                makeExecutable(executable);
            });
        }
        
        console.log(`✅ Archivo ZIP extraído exitosamente: ${archivePath} -> ${extractPath}`);
    } catch (error) {
        throw new Error(`Failed to extract ZIP file: ${error.message}`);
    }
}

/**
 * Extrae un archivo TAR.GZ usando Node.js
 */
async function extractTarGz(archivePath, extractPath) {
    // Intentar usar tar del sistema
    return new Promise((resolve, reject) => {
        const isWindows = process.platform === 'win32';
        
        if (isWindows) {
            // En Windows, usar tar.exe (disponible desde Windows 10)
            // o intentar con 7-Zip
            const tar = spawn('tar', ['-xzf', archivePath, '-C', extractPath]);
            
            tar.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    // Si tar falla en Windows, intentar con 7-Zip o método alternativo
                    console.warn(`tar command failed with code ${code}, trying alternative extraction...`);
                    extractTarGzNodeJs(archivePath, extractPath)
                        .then(resolve)
                        .catch(reject);
                }
            });
            
            tar.on('error', (error) => {
                // Si tar no está disponible, intentar con alternativa Node.js pura
                console.warn(`tar command not available: ${error.message}, trying alternative extraction...`);
                extractTarGzNodeJs(archivePath, extractPath)
                    .then(resolve)
                    .catch(reject);
            });
        } else {
            // En Unix/Linux/Mac, usar tar
            const tar = spawn('tar', ['-xzf', archivePath, '-C', extractPath]);
            
            tar.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`tar extraction failed with code ${code}`));
                }
            });
            
            tar.on('error', (error) => {
                reject(error);
            });
        }
    });
}

/**
 * Extracción de TAR.GZ usando solo Node.js (fallback)
 */
async function extractTarGzNodeJs(archivePath, extractPath) {
    try {
        const zlib = require('zlib');
        
        // Para Windows, usar mensaje de error más claro
        if (process.platform === 'win32') {
            throw new Error(`TAR.GZ extraction not fully supported on Windows. Please use ZIP format instead or install Windows Subsystem for Linux (WSL).<br><br>El archivo ${archivePath} es un formato TAR.GZ que requiere herramientas adicionales en Windows.<br><br>Soluciones:<br>- Instalar 7-Zip y agregar al PATH del sistema<br>- Usar Windows Subsystem for Linux (WSL)<br>- El launcher intentará descargar versión ZIP si está disponible<br>`);
        } else {
            // En Unix/Linux/Mac, usar tar del sistema
            return new Promise((resolve, reject) => {
                const tar = spawn('tar', ['-xzf', archivePath, '-C', extractPath]);
                
                tar.on('close', (code) => {
                    if (code === 0) {
                        resolve();
                    } else {
                        reject(new Error(`tar extraction failed with code ${code}`));
                    }
                });
                
                tar.on('error', (error) => {
                    reject(error);
                });
            });
        }
    } catch (error) {
        throw new Error(`Failed to extract TAR.GZ: ${error.message}`);
    }
}

/**
 * Extrae usando PowerShell en Windows
 */
async function extractWithPowerShell(archivePath, extractPath) {
    return new Promise((resolve, reject) => {
        // Primero intentar descomprimir con gzip, luego extraer tar
        const tempTarPath = archivePath.replace('.tar.gz', '.tar').replace('.tgz', '.tar');
        
        // Comando PowerShell para descomprimir gzip
        const decompressCmd = `
            $input = [System.IO.File]::OpenRead('${archivePath}')
            $output = [System.IO.File]::Create('${tempTarPath}')
            $gzip = New-Object System.IO.Compression.GzipStream($input, [System.IO.Compression.CompressionMode]::Decompress)
            $gzip.CopyTo($output)
            $gzip.Close()
            $output.Close()
            $input.Close()
        `;
        
        const powershell = spawn('powershell', ['-Command', decompressCmd]);
        
        powershell.on('close', (code) => {
            if (code === 0) {
                // Ahora extraer el archivo TAR usando tar (si está disponible) o método alternativo
                extractTarFile(tempTarPath, extractPath)
                    .then(() => {
                        // Limpiar archivo temporal
                        try {
                            fs.unlinkSync(tempTarPath);
                        } catch (e) {}
                        resolve();
                    })
                    .catch(reject);
            } else {
                reject(new Error(`PowerShell decompression failed with code ${code}`));
            }
        });
        
        powershell.on('error', reject);
    });
}

/**
 * Extrae un archivo TAR usando tar del sistema o método alternativo
 */
async function extractTarFile(tarPath, extractPath) {
    return new Promise((resolve, reject) => {
        const tar = spawn('tar', ['-xf', tarPath, '-C', extractPath]);
        
        tar.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`tar extraction failed with code ${code}`));
            }
        });
        
        tar.on('error', (error) => {
            // Si tar no está disponible, rechazar con mensaje informativo
            reject(new Error(`tar command not available: ${error.message}. Please install tar or use ZIP format instead.`));
        });
    });
}

/**
 * Encuentra archivos por patrón de nombre de forma recursiva
 */
function findFilesRecursive(dir, pattern, maxDepth = 5, currentDepth = 0) {
    const results = [];
    
    if (currentDepth >= maxDepth) return results;
    
    try {
        const files = fs.readdirSync(dir);
        
        for (const file of files) {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);
            
            if (stat.isFile() && file.match(pattern)) {
                results.push(filePath);
            } else if (stat.isDirectory()) {
                const subResults = findFilesRecursive(filePath, pattern, maxDepth, currentDepth + 1);
                results.push(...subResults);
            }
        }
    } catch (error) {
        // Ignorar errores de permisos
    }
    
    return results;
}

/**
 * Hace un archivo ejecutable (Unix/Linux/Mac)
 */
function makeExecutable(filePath) {
    if (process.platform === 'win32') {
        return; // No necesario en Windows
    }
    
    try {
        fs.chmodSync(filePath, 0o755);
    } catch (error) {
        console.warn(`Could not make file executable: ${filePath}`, error);
    }
}

/**
 * Obtiene el tamaño de un directorio de forma recursiva
 */
async function getDirectorySize(dirPath) {
    let totalSize = 0;
    
    try {
        const items = await fs.promises.readdir(dirPath);
        
        for (const item of items) {
            const itemPath = path.join(dirPath, item);
            const stats = await fs.promises.stat(itemPath);
            
            if (stats.isDirectory()) {
                totalSize += await getDirectorySize(itemPath);
            } else {
                totalSize += stats.size;
            }
        }
    } catch (error) {
        // Ignorar errores de permisos
    }
    
    return totalSize;
}

/**
 * Limpia un directorio de forma recursiva
 */
async function cleanDirectory(dirPath) {
    try {
        const items = await fs.promises.readdir(dirPath);
        
        for (const item of items) {
            const itemPath = path.join(dirPath, item);
            const stats = await fs.promises.stat(itemPath);
            
            if (stats.isDirectory()) {
                await cleanDirectory(itemPath);
                await fs.promises.rmdir(itemPath);
            } else {
                await fs.promises.unlink(itemPath);
            }
        }
    } catch (error) {
        throw new Error(`Failed to clean directory ${dirPath}: ${error.message}`);
    }
}

/**
 * Crea un backup de un archivo o directorio
 */
async function createBackup(sourcePath, backupPath) {
    try {
        const stats = await fs.promises.stat(sourcePath);
        
        if (stats.isDirectory()) {
            // Crear backup de directorio
            await fs.promises.mkdir(backupPath, { recursive: true });
            const items = await fs.promises.readdir(sourcePath);
            
            for (const item of items) {
                const sourceItem = path.join(sourcePath, item);
                const backupItem = path.join(backupPath, item);
                await createBackup(sourceItem, backupItem);
            }
        } else {
            // Crear backup de archivo
            await fs.promises.mkdir(path.dirname(backupPath), { recursive: true });
            await fs.promises.copyFile(sourcePath, backupPath);
        }
    } catch (error) {
        throw new Error(`Failed to create backup: ${error.message}`);
    }
}

/**
 * Valida que un directorio tiene permisos de escritura
 */
async function validateWritePermissions(dirPath) {
    try {
        // Crear directorio si no existe
        if (!fs.existsSync(dirPath)) {
            await fs.promises.mkdir(dirPath, { recursive: true });
        }
        
        // Intentar crear y eliminar un archivo de prueba
        const testFile = path.join(dirPath, '.write-test');
        await fs.promises.writeFile(testFile, 'test');
        await fs.promises.unlink(testFile);
        
        return true;
    } catch (error) {
        return false;
    }
}

/**
 * Obtiene información del sistema para logs
 */
function getSystemInfo() {
    const os = require('os');
    
    return {
        platform: process.platform,
        arch: process.arch,
        osType: os.type(),
        osRelease: os.release(),
        totalMemory: os.totalmem(),
        freeMemory: os.freemem(),
        nodeVersion: process.version
    };
}

// Exportar las funciones con ES Modules
export {
    verifyFileHash,
    extractZip,
    extractTarGz,
    extractTarGzNodeJs,
    findFilesRecursive,
    makeExecutable,
    getDirectorySize,
    cleanDirectory,
    createBackup,
    validateWritePermissions,
    getSystemInfo
};
