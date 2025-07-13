/**
 * @author Miguelki
 * @license CC-BY-NC 4.0 - https://creativecommons.org/licenses/by-nc/4.0
 */

const nodeFetch = require("node-fetch");
const { machineIdSync } = require("node-machine-id");
const { app } = require("electron");
const os = require("os");
const path = require("path");
const fs = require("fs");

class Localization {
    constructor() {
        this.currentLanguage = 'es-ES'; // Fallback por defecto
        this.translations = {};
        this.githubRepo = 'https://raw.githubusercontent.com/miguelkix30/MCLauncher-Langs/main';
        this.cacheDirectory = null;
        this.initialized = false;
        this.fallbackLanguage = 'es-ES';
        this.mutationObserver = null;
        this.availableLanguages = null;
        this.needsInitialSetup = false; // Flag para indicar si se necesita configuración inicial
    }

    /**
     * Inicializa el sistema de localización
     * @param {Object} database - Instancia de la base de datos
     */
    async initialize(database) {
        if (this.initialized) return;

        try {
            this.db = database;
            
            // Configurar directorio de caché
            this.setupCacheDirectory();
            
            // Cargar idiomas disponibles
            await this.loadAvailableLanguages();
            
            // Obtener idioma de la configuración del cliente
            const configClient = await this.db.readData('configClient');
            let selectedLanguage = null;
            
            if (configClient && configClient.language) {
                selectedLanguage = configClient.language;
                console.log(`Idioma configurado encontrado: ${selectedLanguage}`);
                
                // Verificar si el idioma configurado está disponible
                if (!this.isLanguageAvailable(selectedLanguage)) {
                    console.warn(`Idioma configurado ${selectedLanguage} no está disponible, se requiere configuración inicial`);
                    this.needsInitialSetup = true;
                    selectedLanguage = this.fallbackLanguage;
                }
            } else {
                console.log('No se encontró configuración de idioma, se requiere configuración inicial');
                this.needsInitialSetup = true;
                selectedLanguage = this.fallbackLanguage;
            }

            // Establecer idioma actual
            this.currentLanguage = selectedLanguage;
            
            // Cargar traducciones
            await this.loadTranslations(this.currentLanguage);
            
            this.initialized = true;
            console.log(`Sistema de localización inicializado con idioma: ${this.currentLanguage}`);
            
            if (this.needsInitialSetup) {
                console.log('🔧 Se requiere configuración inicial del idioma');
            }
            
            // Aplicar traducciones después de un breve delay para asegurar que el DOM esté listo
            setTimeout(() => {
                this.applyTranslations();
                // Iniciar observador de mutaciones para traducciones automáticas
                this.startMutationObserver();
            }, 100);
            
        } catch (error) {
            console.error('Error inicializando sistema de localización:', error);
            // Cargar traducciones de fallback
            await this.loadFallbackTranslations();
            this.needsInitialSetup = true;
            this.initialized = true;
        }
    }

    /**
     * Configura el directorio de caché para las traducciones
     */
    setupCacheDirectory() {
        try {
            const appDataPath = app ? app.getPath('appData') : os.homedir();
            this.cacheDirectory = path.join(appDataPath, 'MiguelkiNetwork', 'MCLauncher', 'locales');
            
            if (!fs.existsSync(this.cacheDirectory)) {
                fs.mkdirSync(this.cacheDirectory, { recursive: true });
                console.log(`Directorio de caché creado: ${this.cacheDirectory}`);
            }
        } catch (error) {
            console.error('Error configurando directorio de caché:', error);
            this.cacheDirectory = null;
        }
    }

    /**
     * Carga la lista de idiomas disponibles desde GitHub
     */
    async loadAvailableLanguages() {
        try {
            // Intentar cargar desde archivos locales primero (para desarrollo)
            const localPath = path.join(process.cwd(), '..', 'MCLauncher-Langs', 'languages.json');
            if (fs.existsSync(localPath)) {
                const localData = fs.readFileSync(localPath, 'utf8');
                this.availableLanguages = JSON.parse(localData);
                console.log('Idiomas disponibles cargados desde archivo local:', Object.keys(this.availableLanguages));
                return;
            }
            
            // Si no hay archivo local, cargar desde GitHub
            const response = await nodeFetch(`${this.githubRepo}/languages.json`, {
                headers: {
                    'User-Agent': 'MiguelkiNetworkMCLauncher'
                }
            });
            
            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }
            
            this.availableLanguages = await response.json();
            
        } catch (error) {
            console.error('Error cargando idiomas disponibles:', error);
            // Fallback con idiomas básicos
            this.availableLanguages = {
                'es-ES': { name: 'Spanish', nativeName: 'Español' },
                'en-EN': { name: 'English', nativeName: 'English' }
            };
            console.log('Usando fallback de idiomas disponibles');
        }
    }

    /**
     * Verifica si un idioma está disponible
     * @param {string} languageCode - Código del idioma
     * @returns {boolean}
     */
    isLanguageAvailable(languageCode) {
        return this.availableLanguages && this.availableLanguages[languageCode];
    }

    /**
     * Busca un idioma derivado disponible cuando el idioma exacto no está disponible
     * @param {string} languageCode - Código del idioma
     * @returns {string|null} Código del idioma derivado encontrado o null
     */
    findAvailableLanguageVariant(languageCode) {
        if (!languageCode || !this.availableLanguages) return null;
        
        // Si el idioma exacto está disponible, devolverlo
        if (this.availableLanguages[languageCode]) {
            return languageCode;
        }
        
        // Extraer la parte base del idioma (ej: 'es' de 'es-ES')
        const baseLanguage = languageCode.split(/[-_]/)[0];
        
        // Buscar variantes del mismo idioma base
        const availableKeys = Object.keys(this.availableLanguages);
        
        // Primero buscar variantes exactas del idioma base
        for (const availableCode of availableKeys) {
            if (availableCode.startsWith(baseLanguage + '-') || availableCode.startsWith(baseLanguage + '_')) {
                console.log(`Idioma derivado encontrado: ${availableCode} para ${languageCode}`);
                return availableCode;
            }
        }
        
        // Si no se encuentra variante, buscar el idioma base solo
        if (this.availableLanguages[baseLanguage]) {
            console.log(`Idioma base encontrado: ${baseLanguage} para ${languageCode}`);
            return baseLanguage;
        }
        
        // Si es un idioma no latino, probar mapeos comunes
        const commonMappings = {
            'zh': 'zh-CN',
            'zh-CN': 'zh-TW',
            'zh-TW': 'zh-CN',
            'ja': 'en-EN', // Japonés -> Inglés como fallback
            'ko': 'en-EN', // Coreano -> Inglés como fallback
            'ar': 'en-EN', // Árabe -> Inglés como fallback
            'ru': 'en-EN', // Ruso -> Inglés como fallback
            'hi': 'en-EN', // Hindi -> Inglés como fallback
        };
        
        if (commonMappings[baseLanguage] && this.availableLanguages[commonMappings[baseLanguage]]) {
            console.log(`Mapeo alternativo encontrado: ${commonMappings[baseLanguage]} para ${languageCode}`);
            return commonMappings[baseLanguage];
        }
        
        // Como último recurso, probar inglés
        if (this.availableLanguages['en-EN']) {
            console.log(`Usando inglés como fallback para ${languageCode}`);
            return 'en-EN';
        }
        
        return null;
    }

    /**
     * Carga las traducciones para un idioma específico
     * @param {string} languageCode - Código del idioma
     */
    async loadTranslations(languageCode) {
        try {
            // Intentar cargar desde archivos locales primero (para desarrollo)
            const localTranslations = await this.loadFromLocal(languageCode);
            if (localTranslations) {
                this.translations[languageCode] = localTranslations;
                console.log(`Traducciones cargadas desde archivos locales para ${languageCode}`);
                return;
            }
            
            // Intentar cargar desde caché
            const cachedTranslations = await this.loadFromCache(languageCode);
            if (cachedTranslations) {
                this.translations[languageCode] = cachedTranslations;
                console.log(`Traducciones cargadas desde caché para ${languageCode}`);
                
                // Cargar desde GitHub en segundo plano para actualizar caché
                this.loadFromGitHub(languageCode).catch(error => {
                    console.warn(`Error actualizando caché para ${languageCode}:`, error);
                });
                
                return;
            }
            
            // Si no hay caché, cargar desde GitHub
            await this.loadFromGitHub(languageCode);
            
        } catch (error) {
            console.error(`Error cargando traducciones para ${languageCode}:`, error);
            
            // Si es el idioma fallback y falló, usar traducciones hardcodeadas
            if (languageCode === this.fallbackLanguage) {
                await this.loadFallbackTranslations();
            }
        }
    }

    /**
     * Carga traducciones desde archivos locales (para desarrollo)
     * @param {string} languageCode - Código del idioma
     * @returns {Object|null} Traducciones o null si no existe el archivo
     */
    async loadFromLocal(languageCode) {
        try {
            // Buscar archivo local en varias ubicaciones posibles
            const possiblePaths = [
                path.join(process.cwd(), 'MCLauncher-Langs', 'locales', `${languageCode}.json`),
                path.join(process.cwd(), '..', 'MCLauncher-Langs', 'locales', `${languageCode}.json`),
                path.join('v:', 'MCLauncher-Langs', 'locales', `${languageCode}.json`),
                path.join(__dirname, '..', '..', '..', '..', '..', 'MCLauncher-Langs', 'locales', `${languageCode}.json`)
            ];
            
            for (const filePath of possiblePaths) {
                if (fs.existsSync(filePath)) {
                    const data = fs.readFileSync(filePath, 'utf8');
                    const translations = JSON.parse(data);
                    console.log(`Traducciones cargadas desde archivo local: ${filePath}`);
                    return translations;
                }
            }
            
            return null;
            
        } catch (error) {
            console.error(`Error cargando desde archivo local para ${languageCode}:`, error);
            return null;
        }
    }

    /**
     * Carga traducciones desde GitHub
     * @param {string} languageCode - Código del idioma
     */
    async loadFromGitHub(languageCode) {
        try {
            const response = await nodeFetch(`${this.githubRepo}/locales/${languageCode}.json`, {
                headers: {
                    'User-Agent': 'MiguelkiNetworkMCLauncher'
                }
            });
            
            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }
            
            const translations = await response.json();
            this.translations[languageCode] = translations;
            
            // Guardar en caché
            await this.saveToCache(languageCode, translations);
            
            console.log(`Traducciones cargadas desde GitHub para ${languageCode}`);
            
        } catch (error) {
            console.error(`Error cargando desde GitHub para ${languageCode}:`, error);
            throw error;
        }
    }

    /**
     * Carga traducciones desde el caché local
     * @param {string} languageCode - Código del idioma
     * @returns {Object|null} Traducciones o null si no existe caché
     */
    async loadFromCache(languageCode) {
        if (!this.cacheDirectory) return null;
        
        try {
            const cacheFile = path.join(this.cacheDirectory, `${languageCode}.json`);
            
            if (!fs.existsSync(cacheFile)) {
                return null;
            }
            
            // Verificar si el caché no es demasiado antiguo (24 horas)
            const stats = fs.statSync(cacheFile);
            const cacheAge = Date.now() - stats.mtime.getTime();
            const maxAge = 24 * 60 * 60 * 1000; // 24 horas en milisegundos
            
            if (cacheAge > maxAge) {
                console.log(`Caché expirado para ${languageCode}, se recargará desde GitHub`);
                return null;
            }
            
            const translations = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
            return translations;
            
        } catch (error) {
            console.error(`Error cargando desde caché para ${languageCode}:`, error);
            return null;
        }
    }

    /**
     * Guarda traducciones en el caché local
     * @param {string} languageCode - Código del idioma
     * @param {Object} translations - Traducciones a guardar
     */
    async saveToCache(languageCode, translations) {
        if (!this.cacheDirectory) return;
        
        try {
            const cacheFile = path.join(this.cacheDirectory, `${languageCode}.json`);
            fs.writeFileSync(cacheFile, JSON.stringify(translations, null, 2), 'utf8');
            
        } catch (error) {
            console.error(`Error guardando caché para ${languageCode}:`, error);
        }
    }

    /**
     * Carga traducciones básicas de fallback
     */
    async loadFallbackTranslations() {
        console.log('Cargando traducciones de fallback básicas');
        
        // Traducciones básicas en español como fallback
        this.translations[this.fallbackLanguage] = {
            launcher: {
                title: "Miguelki Network MC Launcher",
                loading: "Cargando...",
                starting: "Iniciando Launcher...",
                error: "Error",
                success: "Éxito",
                warning: "Advertencia",
                info: "Información"
            },
            panels: {
                home: "Inicio",
                settings: "Ajustes",
                login: "Iniciar Sesión",
                mods: "Mods",
                skins: "Skins"
            },
            buttons: {
                accept: "Aceptar",
                cancel: "Cancelar",
                ok: "OK",
                close: "Cerrar",
                back: "Volver",
                next: "Siguiente",
                previous: "Anterior",
                finish: "Finalizar"
            },
            messages: {
                welcome: "Bienvenido",
                goodbye: "Adiós",
                connecting: "Conectando...",
                connected: "Conectado",
                disconnected: "Desconectado",
                failed: "Falló",
                completed: "Completado"
            },
            setup: {
                welcome_title: "Configuración Inicial de Miguelki Network MC Launcher",
                welcome_message: "¡Bienvenido! Vamos a configurar algunos parámetros para optimizar tu experiencia.",
                step_1_language: "Selección de Idioma",
                language_info: "Selecciona tu idioma preferido. Esta configuración se puede cambiar más tarde en los ajustes del launcher.",
                step_2_performance: "Modo de Rendimiento",
                performance_info: "Activa esta opción para mejorar el rendimiento en equipos con recursos limitados.",
                enable_performance_mode: "Activar modo de rendimiento",
                performance_note: "Esta opción desactiva los fondos de video animados y las transiciones visuales para reducir el consumo de recursos.",
                step_3_ram: "Configuración de Memoria RAM",
                total_ram: "RAM Total: ",
                minimum_ram: "RAM Mínima:",
                maximum_ram: "RAM Máxima:",
                step_4_behavior: "Comportamiento del Launcher",
                close_launcher: "Cerrar el launcher después de iniciar el juego (Recomendado)",
                keep_launcher_open: "Mantener abierto el launcher",
                close_all: "Cerrar el juego al cerrar el launcher"
            }
        };
    }

    /**
     * Guarda el idioma seleccionado en la configuración
     * @param {string} languageCode - Código del idioma
     * @param {boolean} createIfNotExists - Si debe crear configClient si no existe (por defecto false)
     */
    async saveLanguageToConfig(languageCode, createIfNotExists = false) {
        try {
            if (!this.db) return;
            
            let configClient = await this.db.readData('configClient');
            
            if (!configClient) {
                if (createIfNotExists) {
                    configClient = {
                        language: languageCode
                    };
                    await this.db.createData('configClient', configClient);
                    console.log(`Idioma ${languageCode} guardado en nueva configuración`);
                } else {
                    console.log(`ConfigClient no existe, saltando guardado de idioma durante inicialización`);
                    return;
                }
            } else {
                configClient.language = languageCode;
                await this.db.updateData('configClient', configClient);
                console.log(`Idioma ${languageCode} actualizado en configuración existente`);
            }
            
        } catch (error) {
            console.error('Error guardando idioma en configuración:', error);
        }
    }

    /**
     * Cambia el idioma actual
     * @param {string} languageCode - Código del nuevo idioma
     */
    async changeLanguage(languageCode) {
        try {
            let targetLanguage = languageCode;
            
            // Si es automático, requerir configuración inicial
            if (languageCode === 'auto') {
                console.warn('Idioma configurado como automático, se requiere configuración manual');
                this.needsInitialSetup = true;
                targetLanguage = this.fallbackLanguage;
            }
            
            // Verificar que el idioma no sea undefined o null
            if (!targetLanguage) {
                console.warn(`Idioma ${languageCode} resultó en undefined, usando fallback`);
                targetLanguage = this.fallbackLanguage;
            }
            
            if (!this.isLanguageAvailable(targetLanguage)) {
                throw new Error(`Idioma ${targetLanguage} no disponible`);
            }
            
            // Cargar traducciones si no están cargadas
            if (!this.translations[targetLanguage]) {
                await this.loadTranslations(targetLanguage);
            }
            
            this.currentLanguage = targetLanguage;
            
            console.log(`Idioma cambiado a: ${targetLanguage}`);
            
            // Aplicar traducciones a la interfaz
            this.applyTranslations();
            
        } catch (error) {
            console.error(`Error cambiando idioma a ${languageCode}:`, error);
            throw error;
        }
    }

    /**
     * Obtiene una traducción por su clave
     * @param {string} key - Clave de la traducción (ej: 'launcher.title')
     * @param {Object} params - Parámetros para reemplazar en la traducción
     * @returns {string} Traducción o la clave si no se encuentra
     */
    t(key, params = {}) {
        try {
            const keys = key.split('.');
            let translation = this.translations[this.currentLanguage];
            
            if (!translation) {
                // Intentar con idioma fallback
                translation = this.translations[this.fallbackLanguage];
                if (!translation) {
                    return key;
                }
            }
            
            // Navegar por las claves anidadas
            for (const k of keys) {
                if (translation && typeof translation === 'object' && translation[k] !== undefined) {
                    translation = translation[k];
                } else {
                    // Si no se encuentra, intentar con fallback
                    let fallbackTranslation = this.translations[this.fallbackLanguage];
                    if (fallbackTranslation) {
                        for (const fk of keys) {
                            if (fallbackTranslation && typeof fallbackTranslation === 'object' && fallbackTranslation[fk] !== undefined) {
                                fallbackTranslation = fallbackTranslation[fk];
                            } else {
                                return key;
                            }
                        }
                        translation = fallbackTranslation;
                    } else {
                        return key;
                    }
                    break;
                }
            }
            
            if (typeof translation !== 'string') {
                return key;
            }
            
            // Reemplazar parámetros
            let result = translation;
            for (const [param, value] of Object.entries(params)) {
                result = result.replace(new RegExp(`\\{${param}\\}`, 'g'), value);
            }
            
            return result;
            
        } catch (error) {
            console.error(`Error obteniendo traducción para ${key}:`, error);
            return key;
        }
    }

    /**
     * Detecta si una cadena contiene HTML
     * @param {string} str - Cadena a verificar
     * @returns {boolean} True si contiene HTML, false si no
     */
    containsHTML(str) {
        try {
            if (!str || typeof str !== 'string') return false;
            
            // Patrones comunes de HTML
            const htmlPatterns = [
                /<[^>]+>/,           // Etiquetas HTML básicas
                /&[a-zA-Z]+;/,       // Entidades HTML
                /&#\d+;/,            // Entidades numéricas
                /&lt;|&gt;|&amp;/    // Entidades comunes
            ];
            
            return htmlPatterns.some(pattern => pattern.test(str));
            
        } catch (error) {
            console.error('Error detectando HTML:', error);
            return false;
        }
    }

    /**
     * Aplica las traducciones a todos los elementos con atributos de traducción
     */
    applyTranslations() {
        try {
            // Aplicar traducciones a elementos con atributo data-translate
            const elements = document.querySelectorAll('[data-translate]');
            elements.forEach(element => {
                const key = element.getAttribute('data-translate');
                const translation = this.t(key);
                
                if (element.tagName === 'INPUT' && (element.type === 'button' || element.type === 'submit')) {
                    element.value = translation;
                } else if (element.tagName === 'INPUT' && element.type === 'text') {
                    element.placeholder = translation;
                } else {
                    // Detectar si la traducción contiene HTML
                    if (this.containsHTML(translation)) {
                        element.innerHTML = translation;
                    } else {
                        element.textContent = translation;
                    }
                }
            });
            
            // Aplicar traducciones a elementos con atributo data-translate-title
            const titleElements = document.querySelectorAll('[data-translate-title]');
            titleElements.forEach(element => {
                const key = element.getAttribute('data-translate-title');
                const translation = this.t(key);
                element.title = translation;
            });
            
            // Aplicar traducciones a elementos con atributo data-translate-placeholder
            const placeholderElements = document.querySelectorAll('[data-translate-placeholder]');
            placeholderElements.forEach(element => {
                const key = element.getAttribute('data-translate-placeholder');
                const translation = this.t(key);
                element.placeholder = translation;
            });
            
            console.log('Traducciones aplicadas a la interfaz');
            
        } catch (error) {
            console.error('Error aplicando traducciones:', error);
        }
    }

    /**
     * Aplica traducciones a un elemento específico y sus descendientes
     * @param {HTMLElement} element - Elemento raíz donde aplicar traducciones
     */
    applyTranslationsToElement(element) {
        try {
            if (!element) return;
            
            // Aplicar traducciones a elementos con atributo data-translate
            const elements = element.querySelectorAll('[data-translate]');
            elements.forEach(el => {
                const key = el.getAttribute('data-translate');
                const translation = this.t(key);
                
                if (el.tagName === 'INPUT' && (el.type === 'button' || el.type === 'submit')) {
                    el.value = translation;
                } else if (el.tagName === 'INPUT' && el.type === 'text') {
                    el.placeholder = translation;
                } else {
                    // Detectar si la traducción contiene HTML
                    if (this.containsHTML(translation)) {
                        el.innerHTML = translation;
                    } else {
                        el.textContent = translation;
                    }
                }
            });
            
            // Aplicar traducciones a elementos con atributo data-translate-title
            const titleElements = element.querySelectorAll('[data-translate-title]');
            titleElements.forEach(el => {
                const key = el.getAttribute('data-translate-title');
                const translation = this.t(key);
                el.title = translation;
            });
            
            // Aplicar traducciones a elementos con atributo data-translate-placeholder
            const placeholderElements = element.querySelectorAll('[data-translate-placeholder]');
            placeholderElements.forEach(el => {
                const key = el.getAttribute('data-translate-placeholder');
                const translation = this.t(key);
                el.placeholder = translation;
            });
            
            console.log(`Traducciones aplicadas al elemento ${element.tagName}`);
            
        } catch (error) {
            console.error('Error aplicando traducciones al elemento:', error);
        }
    }

    /**
     * Aplica traducciones de manera forzosa (útil para asegurar que se apliquen correctamente)
     */
    forceApplyTranslations() {
        try {
            // Aplicar inmediatamente
            this.applyTranslations();
            
            // Esperar un poco para que el DOM se estabilice y aplicar nuevamente
            setTimeout(() => {
                this.applyTranslations();
            }, 50);
            
            // Aplicar nuevamente después de un tiempo mayor para asegurar que todas las traducciones se apliquen
            setTimeout(() => {
                this.applyTranslations();
                
                // Para la configuración inicial, aplicar traducciones específicamente al modal de setup
                const setupModal = document.querySelector('.setup-modal');
                if (setupModal && setupModal.style.display !== 'none') {
                    this.applyTranslationsToElement(setupModal);
                }
                
            }, 200);
            
        } catch (error) {
            console.error('Error en aplicación forzosa de traducciones:', error);
        }
    }

    /**
     * Inicia el observador de mutaciones para aplicar traducciones automáticamente
     */
    startMutationObserver() {
        try {
            if (this.mutationObserver) {
                this.mutationObserver.disconnect();
            }
            
            this.mutationObserver = new MutationObserver((mutations) => {
                let needsTranslation = false;
                
                mutations.forEach((mutation) => {
                    if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                        mutation.addedNodes.forEach((node) => {
                            if (node.nodeType === Node.ELEMENT_NODE) {
                                // Verificar si el elemento o sus descendientes tienen atributos de traducción
                                if (node.hasAttribute && node.hasAttribute('data-translate') || 
                                    node.querySelector && node.querySelector('[data-translate]')) {
                                    needsTranslation = true;
                                }
                            }
                        });
                    }
                });
                
                if (needsTranslation) {
                    // Aplicar traducciones con un pequeño retraso para que el DOM se estabilice
                    setTimeout(() => {
                        this.applyTranslations();
                    }, 50);
                }
            });
            
            // Observar cambios en todo el documento
            this.mutationObserver.observe(document.body, {
                childList: true,
                subtree: true
            });
            
            console.log('Observador de mutaciones iniciado para traducciones automáticas');
            
        } catch (error) {
            console.error('Error iniciando observador de mutaciones:', error);
        }
    }

    /**
     * Obtiene los idiomas disponibles
     * @returns {Object} Objeto con los idiomas disponibles
     */
    getAvailableLanguages() {
        return this.availableLanguages || {};
    }

    /**
     * Obtiene el idioma actual
     * @returns {string} Código del idioma actual
     */
    getCurrentLanguage() {
        return this.currentLanguage;
    }



    /**
     * Detiene el observador de mutaciones
     */
    stopMutationObserver() {
        try {
            if (this.mutationObserver) {
                this.mutationObserver.disconnect();
                this.mutationObserver = null;
                console.log('Observador de mutaciones detenido');
            }
        } catch (error) {
            console.error('Error deteniendo observador de mutaciones:', error);
        }
    }

    /**
     * Verifica si se necesita configuración inicial del idioma
     * @returns {boolean} True si se necesita configuración inicial
     */
    needsInitialLanguageSetup() {
        return this.needsInitialSetup;
    }

    /**
     * Marca que ya no se necesita configuración inicial
     */
    clearInitialSetupFlag() {
        this.needsInitialSetup = false;
        console.log('Flag de configuración inicial limpiado');
    }
}

// Crear instancia global
const localization = new Localization();

export default localization;
