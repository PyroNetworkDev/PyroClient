#!/usr/bin/env node

/**
 * Sistema completo de verificación de compatibilidad de loaders y actualización automática del README
 * 
 * Este script combina:
 * - Verificación de compatibilidad de loaders con tomate-loaders
 * - Generación de reporte de compatibilidad
 * - Actualización automática del README.md con los resultados
 * 
 * @author MiguelkiNetwork
 * @license CC-BY-NC 4.0
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Configuración del sistema
const CONFIG = {
    tempDir: path.join(os.tmpdir(), 'minecraft-loader-test'),
    timeout: 30000, // 30 segundos por loader
    reportFile: path.join(__dirname, 'loader-compatibility-report.md'),
    readmeFile: path.join(__dirname, 'README.md'),
    loaders: ['vanilla', 'forge', 'neoforge', 'fabric', 'quilt'],
    versions: [
        // Versiones 1.8
        '1.8', '1.8.1', '1.8.2', '1.8.3', '1.8.4', '1.8.5', '1.8.6', '1.8.7', '1.8.8', '1.8.9',
        // Versiones 1.9
        '1.9', '1.9.1', '1.9.2', '1.9.3', '1.9.4',
        // Versiones 1.10
        '1.10', '1.10.1', '1.10.2',
        // Versiones 1.11
        '1.11', '1.11.1', '1.11.2',
        // Versiones 1.12
        '1.12', '1.12.1', '1.12.2',
        // Versiones 1.13
        '1.13', '1.13.1', '1.13.2',
        // Versiones 1.14
        '1.14', '1.14.1', '1.14.2', '1.14.3', '1.14.4',
        // Versiones 1.15
        '1.15', '1.15.1', '1.15.2',
        // Versiones 1.16
        '1.16', '1.16.1', '1.16.2', '1.16.3', '1.16.4', '1.16.5',
        // Versiones 1.17
        '1.17', '1.17.1',
        // Versiones 1.18
        '1.18', '1.18.1', '1.18.2',
        // Versiones 1.19
        '1.19', '1.19.1', '1.19.2', '1.19.3', '1.19.4',
        // Versiones 1.20
        '1.20', '1.20.1', '1.20.2', '1.20.3', '1.20.4', '1.20.5', '1.20.6',
        // Versiones 1.21
        '1.21', '1.21.1', '1.21.2', '1.21.3', '1.21.4', '1.21.5', '1.21.6', '1.21.7'
    ],
    nonWorkingVersions: [
        '1.8', '1.8.1', '1.8.2', '1.8.3', '1.8.4', '1.8.5', '1.8.6', '1.8.7', '1.8.8', '1.8.9'
    ]
};

class ComprehensiveCompatibilityManager {
    constructor() {
        this.results = {};
        this.summary = {
            total: 0,
            successful: 0,
            failed: 0,
            byLoader: {},
            byVersion: {}
        };
        
        // Inicializar contadores
        CONFIG.loaders.forEach(loader => {
            this.summary.byLoader[loader] = { successful: 0, failed: 0, total: 0 };
        });
        
        CONFIG.versions.forEach(version => {
            this.summary.byVersion[version] = { successful: 0, failed: 0, total: 0 };
        });
    }

    async run() {
        console.log('🔬 Sistema Completo de Verificación de Compatibilidad');
        console.log('=' .repeat(70));
        
        const startTime = Date.now();
        
        try {
            // Paso 1: Verificar dependencias
            await this.checkDependencies();
            
            // Paso 2: Ejecutar verificación de compatibilidad
            await this.runCompatibilityCheck();
            
            // Paso 3: Generar reporte de compatibilidad
            await this.generateCompatibilityReport();
            
            // Paso 4: Actualizar README con los resultados
            await this.updateReadmeWithResults();
            
            // Paso 5: Cleanup
            await this.cleanup();
            
            const endTime = Date.now();
            const duration = ((endTime - startTime) / 1000).toFixed(2);
            
            console.log(`\n🎯 Sistema completado exitosamente en ${duration} segundos`);
            console.log(`📊 Resumen: ${this.summary.successful}/${this.summary.total} pruebas exitosas`);
            console.log(`📄 Reporte generado: ${CONFIG.reportFile}`);
            console.log(`📝 README actualizado: ${CONFIG.readmeFile}`);
            process.exit(0);
            
        } catch (error) {
            console.error('❌ Error durante la verificación:', error.message);
            process.exit(1);
        }
    }

    async checkDependencies() {
        console.log('🔧 Verificando dependencias...');
        
        try {
            require('tomate-loaders');
            console.log('✅ tomate-loaders disponible');
        } catch (error) {
            console.error('❌ tomate-loaders no encontrado');
            console.error('💡 Ejecuta: npm install tomate-loaders');
            throw new Error('Dependencias faltantes');
        }
    }

    async setupTempDirectory() {
        console.log('🔧 Configurando directorio temporal...');
        
        // Limpiar directorio temporal existente
        if (fs.existsSync(CONFIG.tempDir)) {
            await fs.promises.rm(CONFIG.tempDir, { recursive: true, force: true });
        }
        
        // Crear directorio temporal
        await fs.promises.mkdir(CONFIG.tempDir, { recursive: true });
        console.log(`✅ Directorio temporal creado: ${CONFIG.tempDir}`);
    }

    async cleanup() {
        console.log('🧹 Limpiando archivos temporales...');
        try {
            if (fs.existsSync(CONFIG.tempDir)) {
                await fs.promises.rm(CONFIG.tempDir, { recursive: true, force: true });
                console.log('✅ Archivos temporales eliminados');
            }
        } catch (error) {
            console.warn('⚠️ No se pudo limpiar completamente:', error.message);
        }
    }

    async testLoaderVersion(loaderType, gameVersion) {
        const testId = `${loaderType}-${gameVersion}`;
        const rootPath = path.join(CONFIG.tempDir, testId);
        
        try {
            // Crear directorio específico para esta prueba
            await fs.promises.mkdir(rootPath, { recursive: true });
            
            // Crear promesa con timeout
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Timeout')), CONFIG.timeout);
            });
            
            const testPromise = this.getLoaderConfig(loaderType, gameVersion, rootPath);
            
            // Ejecutar con timeout
            const result = await Promise.race([testPromise, timeoutPromise]);
            
            return {
                success: true,
                loader: loaderType,
                version: gameVersion,
                config: result ? 'Config obtenida' : 'Config vacía',
                details: result
            };
            
        } catch (error) {
            return {
                success: false,
                loader: loaderType,
                version: gameVersion,
                error: error.message,
                errorType: this.categorizeError(error)
            };
        } finally {
            // Limpiar directorio específico de la prueba
            try {
                if (fs.existsSync(rootPath)) {
                    await fs.promises.rm(rootPath, { recursive: true, force: true });
                }
            } catch (cleanupError) {
                // Ignorar errores de limpieza
            }
        }
    }

    async getLoaderConfig(loaderType, gameVersion, rootPath) {
        const { vanilla, fabric, forge, quilt, neoforge } = require('tomate-loaders');
        if (CONFIG.nonWorkingVersions.includes(gameVersion)) {
            throw new Error(`Versión ${gameVersion} no soportada por ${loaderType}`);
        }
        switch (loaderType.toLowerCase()) {
            case 'vanilla':
                return await vanilla.getMCLCLaunchConfig({
                    gameVersion: gameVersion,
                    rootPath: rootPath
                });
                
            case 'forge':
                return await forge.getMCLCLaunchConfig({
                    gameVersion: gameVersion,
                    rootPath: rootPath
                });
                
            case 'neoforge':
                const versionNumber = parseFloat(gameVersion.split('.').slice(0, 2).join('.'));
                if (versionNumber >= 1.20) {
                        return await neoforge.getMCLCLaunchConfig({
                            gameVersion: gameVersion,
                            rootPath: rootPath
                        });
                }
                throw new Error('NeoForge not available for this version');
                
            case 'fabric':
                return await fabric.getMCLCLaunchConfig({
                    gameVersion: gameVersion,
                    rootPath: rootPath
                });
                
            case 'quilt':
                return await quilt.getMCLCLaunchConfig({
                    gameVersion: gameVersion,
                    rootPath: rootPath
                });
                
            default:
                throw new Error(`Loader no soportado: ${loaderType}`);
        }
    }

    categorizeError(error) {
        const message = error.message.toLowerCase();
        
        if (message.includes('timeout')) return 'timeout';
        if (message.includes('not found') || message.includes('404')) return 'not-found';
        if (message.includes('network') || message.includes('enotfound')) return 'network';
        if (message.includes('version') || message.includes('unavailable')) return 'version-unavailable';
        if (message.includes('permission') || message.includes('eacces')) return 'permission';
        if (message.includes('neoforge')) return 'neoforge-specific';
        
        return 'unknown';
    }

    async runCompatibilityCheck() {
        console.log('🚀 Iniciando verificación de compatibilidad de loaders...');
        console.log(`📊 Probando ${CONFIG.loaders.length} loaders con ${CONFIG.versions.length} versiones`);
        
        await this.setupTempDirectory();
        
        const totalTests = CONFIG.loaders.length * CONFIG.versions.length;
        let currentTest = 0;
        
        this.summary.total = totalTests;
        
        for (const loaderType of CONFIG.loaders) {
            console.log(`\n🔧 Probando loader: ${loaderType.toUpperCase()}`);
            this.results[loaderType] = {};
            
            for (const gameVersion of CONFIG.versions) {
                currentTest++;
                const progress = `(${currentTest}/${totalTests})`;
                
                process.stdout.write(`  ${progress} Testing ${gameVersion}... `);
                
                const result = await this.testLoaderVersion(loaderType, gameVersion);
                this.results[loaderType][gameVersion] = result;
                
                // Actualizar estadísticas
                this.summary.byLoader[loaderType].total++;
                this.summary.byVersion[gameVersion].total++;
                
                if (result.success) {
                    this.summary.successful++;
                    this.summary.byLoader[loaderType].successful++;
                    this.summary.byVersion[gameVersion].successful++;
                    console.log('✅');
                } else {
                    this.summary.failed++;
                    this.summary.byLoader[loaderType].failed++;
                    this.summary.byVersion[gameVersion].failed++;
                    console.log(`❌ (${result.errorType})`);
                }
            }
        }
        
        console.log('\n🎉 Verificación de compatibilidad completada!');
    }

    generateMarkdownReport() {
        const timestamp = new Date().toISOString();
        const date = new Date().toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        let report = `# Reporte de Compatibilidad de Loaders de Minecraft

**Generado el:** ${date}  
**Versiones probadas:** ${CONFIG.versions.length}  
**Loaders probados:** ${CONFIG.loaders.join(', ')}  
**Total de pruebas:** ${this.summary.total}  

## 📊 Resumen General

- ✅ **Exitosas:** ${this.summary.successful} (${((this.summary.successful / this.summary.total) * 100).toFixed(1)}%)
- ❌ **Fallidas:** ${this.summary.failed} (${((this.summary.failed / this.summary.total) * 100).toFixed(1)}%)

## 🔧 Compatibilidad por Loader

| Loader | Exitosas | Fallidas | Total | Porcentaje |
|--------|----------|----------|-------|------------|
`;

        // Tabla de compatibilidad por loader
        CONFIG.loaders.forEach(loader => {
            const stats = this.summary.byLoader[loader];
            const percentage = ((stats.successful / stats.total) * 100).toFixed(1);
            report += `| ${loader.toUpperCase()} | ${stats.successful} | ${stats.failed} | ${stats.total} | ${percentage}% |\n`;
        });

        report += `\n## 🎮 Compatibilidad por Versión de Minecraft

| Versión | Vanilla | Forge | NeoForge | Fabric | Quilt | Total Compatible |
|---------|---------|-------|----------|--------|-------|------------------|
`;

        // Tabla de compatibilidad por versión
        CONFIG.versions.forEach(version => {
            const row = [`| ${version}`];
            
            CONFIG.loaders.forEach(loader => {
                const result = this.results[loader][version];
                row.push(result.success ? '✅' : '❌');
            });
            
            const compatible = CONFIG.loaders.filter(loader => 
                this.results[loader][version].success
            ).length;
            
            row.push(`${compatible}/${CONFIG.loaders.length}`);
            row.push('|');
            
            report += row.join(' | ') + '\n';
        });

        // Notas técnicas
        report += `\n## 📝 Notas Técnicas\n\n`;
        report += `- **Timeout por prueba**: ${CONFIG.timeout / 1000} segundos\n`;
        report += `- **Timestamp**: ${timestamp}\n`;
   
        return report;
    }

    async generateCompatibilityReport() {
        console.log('📄 Generando reporte de compatibilidad...');
        
        const report = this.generateMarkdownReport();
        
        try {
            await fs.promises.writeFile(CONFIG.reportFile, report, 'utf8');
            console.log(`✅ Reporte guardado en: ${CONFIG.reportFile}`);
        } catch (error) {
            console.error('❌ Error guardando reporte:', error.message);
            
            // Intentar guardar en directorio actual como fallback
            const fallbackFile = path.join(__dirname, `loader-report-${Date.now()}.md`);
            try {
                await fs.promises.writeFile(fallbackFile, report, 'utf8');
                console.log(`✅ Reporte guardado en fallback: ${fallbackFile}`);
            } catch (fallbackError) {
                console.error('❌ Error guardando reporte en fallback:', fallbackError.message);
                throw new Error('No se pudo guardar el reporte');
            }
        }
    }

    extractCompatibilityStats() {
        const stats = {
            totalTests: this.summary.total,
            successfulTests: this.summary.successful,
            failedTests: this.summary.failed,
            successRate: ((this.summary.successful / this.summary.total) * 100).toFixed(1),
            lastUpdated: new Date().toLocaleDateString('es-ES', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            }),
            loaderStats: {}
        };

        // Estadísticas por loader
        CONFIG.loaders.forEach(loader => {
            const loaderData = this.summary.byLoader[loader];
            stats.loaderStats[loader] = {
                name: loader.toUpperCase(),
                successful: loaderData.successful,
                total: loaderData.total,
                percentage: ((loaderData.successful / loaderData.total) * 100).toFixed(1)
            };
        });

        return stats;
    }

    async updateReadmeWithResults() {
        console.log('📝 Actualizando README con resultados...');
        
        try {
            // Verificar que el README existe
            if (!fs.existsSync(CONFIG.readmeFile)) {
                throw new Error('README.md no encontrado');
            }

            // Leer el README actual
            let readmeContent = fs.readFileSync(CONFIG.readmeFile, 'utf8');
            
            // Extraer estadísticas
            const stats = this.extractCompatibilityStats();
            
            // Crear la nueva sección de compatibilidad
            const newCompatibilitySection = this.createCompatibilitySection(stats);
            
            // Buscar y eliminar cualquier sección de compatibilidad existente y contenido después del details
            // Esto incluye tanto el heading como cualquier contenido de tabla que pueda estar fragmentado
            const detailsEndRegex = /<\/details>\s*/;
            const compatibilityStartRegex = /## 🎮 Compatibilidad de Loaders/;
            
            // Encontrar el final del details y eliminar todo después de él
            const detailsMatch = readmeContent.match(detailsEndRegex);
            if (detailsMatch) {
                const detailsEndIndex = detailsMatch.index + detailsMatch[0].length;
                readmeContent = readmeContent.substring(0, detailsEndIndex);
                console.log('🔄 Contenido después de </details> eliminado');
            }
            
            // También eliminar cualquier sección de compatibilidad que pueda existir antes del details
            if (compatibilityStartRegex.test(readmeContent)) {
                readmeContent = readmeContent.replace(/## 🎮 Compatibilidad de Loaders[\s\S]*$/, '');
                console.log('🔄 Sección de compatibilidad antes de details eliminada');
            }
            
            // Limpiar líneas vacías múltiples que puedan haber quedado al final
            readmeContent = readmeContent.trim();
            
            // Agregar la nueva sección al final del README
            readmeContent = readmeContent + '\n\n' + newCompatibilitySection;
            
            // Escribir el README actualizado
            await fs.promises.writeFile(CONFIG.readmeFile, readmeContent, 'utf8');
            console.log('✅ README actualizado exitosamente - Sección de compatibilidad agregada al final');
            
        } catch (error) {
            console.error('❌ Error actualizando README:', error.message);
            throw error;
        }
    }

    createCompatibilitySection(stats) {
        // Generar tabla completa de compatibilidad
        let compatibilityTable = `## 🎮 Compatibilidad de Loaders

> **Última actualización:** ${stats.lastUpdated}  
> **Total de pruebas:** ${stats.totalTests} | **Exitosas:** ${stats.successfulTests} (${stats.successRate}%)

### 📊 Resumen por Loader

| Loader | Compatibilidad | Versiones Soportadas |
|--------|----------------|---------------------|
${Object.values(stats.loaderStats).map(loader => 
    `| **${loader.name}** | ${loader.percentage}% | ${loader.successful}/${loader.total} |`
).join('\n')}

### 🎮 Tabla Completa de Compatibilidad por Versión

| Versión | Vanilla | Forge | NeoForge | Fabric | Quilt | Total Compatible |
|---------|---------|-------|----------|--------|-------|------------------|
`;

        // Generar cada fila de la tabla
        CONFIG.versions.forEach(version => {
            const row = [`| ${version}`];
            
            CONFIG.loaders.forEach(loader => {
                const result = this.results[loader][version];
                row.push(result.success ? '✅' : '❌');
            });
            
            const compatible = CONFIG.loaders.filter(loader => 
                this.results[loader][version].success
            ).length;
            
            row.push(`${compatible}/${CONFIG.loaders.length}`);
            row.push('|');
            
            compatibilityTable += row.join(' | ') + '\n';
        });

        compatibilityTable += `

### 🔗 Enlaces Útiles

- [📄 Reporte Completo de Compatibilidad](loader-compatibility-report.md)

---`;

        return compatibilityTable;
    }
}

// Ejecutar el sistema completo si se llama directamente
if (require.main === module) {
    const manager = new ComprehensiveCompatibilityManager();
    manager.run().catch(error => {
        console.error('❌ Error fatal:', error);
        process.exit(1);
    });
}

module.exports = ComprehensiveCompatibilityManager;
