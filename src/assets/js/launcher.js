/**
 * @author Luuxis
 * @license CC-BY-NC 4.0 - https://creativecommons.org/licenses/by-nc/4.0
 */
// import panel
import Login from "./panels/login.js";
import Home from "./panels/home.js";
import Settings from "./panels/settings.js";
import Mods from "./panels/mods.js";
import Skins from "./panels/skins.js";
import Logger2 from "./loggerprod.js";
import cleanupManager from './utils/cleanup-manager.js';

import {
  logger,
  config,
  changePanel,
  database,
  popup,
  setBackground,
  setVideoSource,
  accountSelect,
  addAccount,
  pkg,
  setUsername,
  getUsername,
  clickableHead,
  setDiscordUsername,
  getDiscordUsername,
  setDiscordPFP,
  showTermsAndConditions,
  setBackgroundMusic,
  setPerformanceMode,
  patchLoader,
  localization
} from "./utils.js";
import {
  getHWID,
  loginMSG,
  quitAPP,
  verificationError,
  sendClientReport,
  checkBaseVersion,
  saveDiscordToken,
  loadDiscordToken,
  deleteDiscordToken,
  migrateDiscordToken
} from "./MKLib.js";
const { Auth } = require("msmc");
const { Authenticator } = require("minecraft-launcher-core");
import AZauth from "./utils/azauth.js";

const { ipcRenderer } = require("electron");
const fs = require("fs");
const os = require("os");
const fetch = require("node-fetch");
let dev = process.env.NODE_ENV === "dev";

class Launcher {
  async init() {
    this.initWindow();

    console.log("Iniciando Launcher...");
    
    await checkBaseVersion();
    
    this.shortcut();
    this.db = new database();
    
    // Consolidar archivos de almacenamiento que puedan estar en múltiples ubicaciones
    console.log("Consolidando archivos de almacenamiento...");
    try {
      await this.db.consolidateStorage();
    } catch (error) {
      console.error("Error al consolidar almacenamiento:", error);
    }
    
    // Migrate accounts to new authentication system
    console.log("Checking for account authentication migration...");
    try {
      await this.db.migrateAccountsToNewAuth();
    } catch (error) {
      console.error("Error migrating accounts to new auth system:", error);
    }
    
    // Verificar la configuración del cliente ANTES de inicializar localización
    const configClient = await this.db.readData("configClient");
    let isFirstRun = !configClient;
    let needsLanguageSetup = false;
    
    // Inicializar sistema de localización
    console.log("Inicializando sistema de localización...");
    try {
      await localization.initialize(this.db);
      
      // Verificar si se necesita configuración inicial basada en el idioma
      needsLanguageSetup = localization.needsInitialLanguageSetup ? localization.needsInitialLanguageSetup() : (localization.needsInitialSetup || false);
      if (needsLanguageSetup) {
        console.log("🔧 Se detectó que se necesita configuración inicial");
      }
    } catch (error) {
      console.error("Error inicializando sistema de localización:", error);
      // Si hay error con localización, también forzar configuración inicial
      needsLanguageSetup = true;
    }
    
    // Consolidar los flags de configuración inicial
    const needsInitialSetup = isFirstRun || needsLanguageSetup;
    
    this.config = await config
      .GetConfig()
      .then((res) => res)
      .catch((err) => err);
    if (await this.config.error) return this.errorConnect();
    await this.loadColors();
    
    console.log(`ConfigClient existe: ${!!configClient}, Primera ejecución: ${isFirstRun}, Necesita config de idioma: ${needsLanguageSetup}`);
    
    if (needsInitialSetup) {
      console.log("Configuración inicial necesaria. Iniciando configuración inicial...");
      
      try {
        await this.showInitialSetup();
        console.log("Configuración inicial completada exitosamente");
        // Limpiar flag de configuración inicial en localization
        localization.clearInitialSetupFlag();
      } catch (error) {
        console.error("Error durante la configuración inicial:", error);
      }
      this.hideLoadingOverlayWithFade();
      
      console.log("Inicializando cleanup manager después de configuración inicial");
      await cleanupManager.initializeWithDatabase(this.db);
    } else {
      // Verificar explícitamente la existencia de la propiedad launcher_config.performance_mode
      // antes de intentar acceder a ella
      const performanceMode = configClient && 
                             configClient.launcher_config && 
                             configClient.launcher_config.performance_mode;
      
      if (performanceMode) {
        console.log("Modo de rendimiento activado");
        document.body.classList.add('performance-mode');
        
        this.applyPerformanceModeOverrides();
        
        setPerformanceMode(true);
      }
      
      console.log("Inicializando cleanup manager con configuración existente");
      await cleanupManager.initializeWithDatabase(this.db);
    }
    this.startLoadingDisplayTimer();
    
    // MEJORA: Inicialización del fondo de video con manejo de errores
    console.log("Inicializando fondo de video...");
    try {
      // Asegurar que cualquier fondo de instancia específica previo sea limpiado al inicio
      localStorage.removeItem('hasInstanceBackground');
      localStorage.setItem('forceBackgroundReset', 'true');
      
      // Inicializar el fondo de video con el video predeterminado
      await setVideoSource();
      await setBackground();
      console.log("Fondo de video inicializado correctamente");
    } catch (error) {
      console.error("Error al inicializar el fondo de video:", error);
      // Intentar usar el fondo estático si el video falla
      try {
        await setBackground();
      } catch (bgError) {
        console.error("Error al establecer el fondo de respaldo:", bgError);
      }
    }
    
    this.initFrame();
    
    if (!isFirstRun) {
      await this.initConfigClient();
    }
    
    this.createPanels(Login, Home, Settings, Mods, Skins);
    let res = await config.GetConfig();
    if ((res.musicBeta || dev) && (!configClient || !configClient.launcher_config.performance_mode)) setBackgroundMusic();
    
    if (res.termsDialog) {
      console.log("Verificando estado de términos y condiciones...");
      
      const currentConfig = await this.db.readData("configClient");
      
      if (!currentConfig || currentConfig.terms_accepted !== true) {
        console.log("Mostrando diálogo de términos y condiciones");
        const accepted = await showTermsAndConditions();
        if (!accepted) {
          console.log("Términos no aceptados, cerrando launcher.");
          quitAPP();
          return;
        }
        
        const verifyConfig = await this.db.readData("configClient");
        if (!verifyConfig || verifyConfig.terms_accepted !== true) {
          console.warn("No se detectó guardado de términos, forzando guardado...");
          
          if (verifyConfig) {
            verifyConfig.terms_accepted = true;
            await this.db.updateData("configClient", verifyConfig);
            console.log("Guardado forzado de términos completado");
          }
        }
      } else {
        console.log("Términos ya aceptados anteriormente, continuando...");
      }
    }

    this.hideLoadingOverlay();
    
    if (res.discordVerification) {
      await this.verifyDiscordAccount();
    } else {
      await this.startLauncher();
    }
  }

  async loadColors() {
    let res = await config.GetConfig();
    
    // Check if theme object exists
    if (!res || !res.theme || typeof res.theme !== 'object') {
      console.warn("No se encontró configuración de tema válida en el servidor, usando valores predeterminados");
      return;
    }
    
    // Define default theme values
    const defaultTheme = {
      'box-button': '#0078bd',
      'box-button-hover': '#053e8a',
      'box-button-hover-2': '#001f47',
      'box-hover': '#202020',
      'box-button-gradient-1': '#00FFFF',
      'box-button-gradient-2': '#0096FF'
    };
    
    // Apply theme properties with fallback to defaults
    const themeProperties = [
      'box-button',
      'box-button-hover', 
      'box-button-hover-2',
      'box-hover',
      'box-button-gradient-1',
      'box-button-gradient-2'
    ];
    
    const appliedColors = {};
    
    themeProperties.forEach(property => {
      const value = res.theme[property] || defaultTheme[property];
      if (value) {
        document.documentElement.style.setProperty(`--${property}`, value);
        appliedColors[property] = value;
      } else {
        console.warn(`No se encontró '${property}' en la configuración del servidor, aplicando valor predeterminado`);
      }
    });

    // Enviar colores a la consola separada con reintentos
    try {
      const sendColorsWithRetry = (colors, retries = 5) => {
        ipcRenderer.send('apply-dynamic-colors', colors);
        
        // Reenviar colores cada 2 segundos por si la consola se inicializa después
        if (retries > 0) {
          setTimeout(() => {
            sendColorsWithRetry(colors, retries - 1);
          }, 2000);
        }
      };
      
      sendColorsWithRetry(appliedColors);
    } catch (error) {
      console.warn('Error enviando colores a la consola:', error);
    }
  }
  
  startLoadingDisplayTimer() {
    
    if (this.loadingDisplayTimer) {
      clearTimeout(this.loadingDisplayTimer);
    }
    
    const loadingOverlay = document.querySelector('.loading-overlay');
    if (loadingOverlay) {
      loadingOverlay.classList.add('active');
      loadingOverlay.style.visibility = 'visible';
      loadingOverlay.style.opacity = '1';
      loadingOverlay.style.display = 'flex';
    }
    
    this.loadingDisplayTimer = setTimeout(() => {
      this.hideLoadingOverlay();
    }, 3000);
  }
  
  forceHideLoadingOverlay() {
    const loadingOverlay = document.querySelector('.loading-overlay');
    if (!loadingOverlay) {
      console.warn("No se encontró elemento loading-overlay");
      return;
    }
    
    console.log("Forzando ocultación de la pantalla de carga");
    
    loadingOverlay.style.transition = 'none';
    loadingOverlay.style.opacity = '0';
    loadingOverlay.style.visibility = 'hidden'; 
    loadingOverlay.style.display = 'none';
    loadingOverlay.classList.remove('active');
  }

  hideLoadingOverlay() {
    const loadingOverlay = document.querySelector('.loading-overlay');
    if (!loadingOverlay) {
      console.warn("No se encontró elemento loading-overlay");
      return;
    }
    
    try {
      // Asegurarse de obtener configClient como Promise y usar await para resolverla
      this.db.readData('configClient')
        .then(configClient => {
          // Verificar si configClient existe y si tiene la estructura correcta
          if (configClient && configClient.launcher_config && configClient.launcher_config.performance_mode) {
            loadingOverlay.style.transition = 'none';
            loadingOverlay.style.opacity = '0';
            loadingOverlay.style.visibility = 'hidden';
            loadingOverlay.classList.remove('active');
          } else {
            // Comportamiento normal si no hay modo rendimiento o no hay configClient
            loadingOverlay.classList.remove('active');
            
            setTimeout(() => {
              loadingOverlay.style.opacity = '0';
              loadingOverlay.style.visibility = 'hidden';
            }, 800);
          }
        })
        .catch(err => {
          // Si hay error al leer configClient, aplicar comportamiento predeterminado
          console.error("Error al leer configClient:", err);
          loadingOverlay.classList.remove('active');
          
          setTimeout(() => {
            loadingOverlay.style.opacity = '0';
            loadingOverlay.style.visibility = 'hidden';
          }, 800);
        });
    } catch (err) {
      console.error("Error al ocultar pantalla de carga:", err);
      // Comportamiento de fallback si hay algún error
      loadingOverlay.style.opacity = '0';
      loadingOverlay.style.visibility = 'hidden';
      loadingOverlay.style.display = 'none';
    }
  }

  async showInitialSetup() {
    console.log("=== INICIO DE showInitialSetup() ===");
    return new Promise(async (resolve) => {
      console.log("Mostrando configuración inicial");
      
      if (this.loadingDisplayTimer) {
        clearTimeout(this.loadingDisplayTimer);
        console.log("Cancelado temporizador de pantalla de carga por configuración inicial");
      }

      const totalMem = Math.trunc(os.totalmem() / 1073741824 * 10) / 10;
      const defaultMaxRam = Math.min(4, Math.trunc((70 * totalMem) / 100));
      const defaultMinRam = Math.min(2, Math.max(1, Math.trunc(defaultMaxRam / 2)));
      
      const loadingOverlay = document.querySelector('.loading-overlay');
      if (loadingOverlay) {
        loadingOverlay.classList.remove('active');
        loadingOverlay.style.visibility = 'hidden';
        loadingOverlay.style.opacity = '0';
        console.log("Loading overlay ocultado para mostrar setup");
      } else {
        console.warn("No se encontró loading overlay");
      }
      
      const setupModal = document.querySelector('.setup-modal');
      console.log("DOM elements found:", {
        setupModal: !!setupModal,
        body: !!document.body,
        panels: !!document.querySelector('.panels')
      });
      
      if (setupModal) {
        setupModal.style.display = 'flex';
        console.log("Setup modal mostrado");
      } else {
        console.error("No se encontró el elemento .setup-modal");
        console.log("HTML body contains:", document.body ? document.body.innerHTML.substring(0, 500) : "No body found");
        resolve(); // Resolver inmediatamente si no se encuentra el modal
        return;
      }
      
      const totalRamElement = document.querySelector('#setup-total-ram');
      if (totalRamElement) {
        totalRamElement.textContent = `${totalMem} GB`;
      } else {
      }
      
      const setupSliderElement = document.querySelector(".setup-memory-slider");
      if (setupSliderElement) {
        setupSliderElement.setAttribute("max", Math.trunc((80 * totalMem) / 100));
      }
      
      class SetupSlider {
        constructor(element, minValue, maxValue) {
          this.element = element;
          this.min = Math.max(0.5, parseFloat(this.element.getAttribute('min')) || 0.5);
          this.max = parseFloat(this.element.getAttribute('max')) || 8;
          this.step = parseFloat(this.element.getAttribute('step')) || 0.5;
          this.normalizeFact = 18;
          
          this.touchLeft = this.element.querySelector('.setup-slider-touch-left');
          this.touchRight = this.element.querySelector('.setup-slider-touch-right');
          this.lineSpan = this.element.querySelector('.setup-slider-line span');
          
          this.callbacks = [];
          
          this.init();
          
          minValue = Math.max(this.min, minValue);
          maxValue = Math.max(minValue + 2, maxValue);
          
          const minRatio = (minValue - this.min) / (this.max - this.min);
          const minPosition = Math.ceil(minRatio * (this.element.offsetWidth - (this.normalizeFact * 2)));
          this.touchLeft.style.left = `${minPosition}px`;
          
          const maxRatio = (maxValue - this.min) / (this.max - this.min);
          const maxPosition = Math.ceil(maxRatio * (this.element.offsetWidth - (this.normalizeFact * 2))) + this.normalizeFact;
          this.touchRight.style.left = `${maxPosition}px`;
          
          this.lineSpan.style.marginLeft = `${minPosition}px`;
          this.lineSpan.style.width = `${maxPosition - minPosition}px`;
          
          this.updateDisplayValues(minValue, maxValue);
        }
        
        init() {
          this.touchLeft.addEventListener('mousedown', this.onStart.bind(this, 'left'));
          this.touchRight.addEventListener('mousedown', this.onStart.bind(this, 'right'));
          
          document.addEventListener('mousemove', this.onMove.bind(this));
          document.addEventListener('mouseup', this.onEnd.bind(this));
        }
        
        onStart(direction, e) {
          e.preventDefault();
          e.stopPropagation();
          this.direction = direction;
          this.startX = e.clientX;
          if (direction === 'left') {
            this.currentX = this.touchLeft.offsetLeft;
          } else {
            this.currentX = this.touchRight.offsetLeft;
          }
          this.active = true;
        }
        
        onMove(e) {
          if (!this.active) return;
          e.preventDefault();
          
          let newX = this.currentX + e.clientX - this.startX;
          newX = Math.max(0, Math.min(newX, this.element.offsetWidth - this.normalizeFact));
          
          if (this.direction === 'left') {
            const minGapInGB = 2;
            const gapRatio = minGapInGB / (this.max - this.min);
            const gapPixels = gapRatio * (this.element.offsetWidth - (this.normalizeFact * 2));
            
            const rightHandlePosition = this.touchRight.offsetLeft;
            newX = Math.min(newX, rightHandlePosition - gapPixels);
            
            this.touchLeft.style.left = `${newX}px`;
            this.lineSpan.style.marginLeft = `${newX}px`;
          } else {
            const minGapInGB = 2;
            const gapRatio = minGapInGB / (this.max - this.min);
            const gapPixels = gapRatio * (this.element.offsetWidth - (this.normalizeFact * 2));
            
            const leftHandlePosition = this.touchLeft.offsetLeft;
            newX = Math.max(newX, leftHandlePosition + gapPixels);
            
            this.touchRight.style.left = `${newX}px`;
          }
          
          this.lineSpan.style.width = `${this.touchRight.offsetLeft - this.touchLeft.offsetLeft}px`;
          
          let minValue = this.getMinValue();
          let maxValue = this.getMaxValue();
          
          if (maxValue - minValue < 2) {
            if (this.direction === 'left') {
              minValue = maxValue - 2;
            } else {
              maxValue = minValue + 2;
            }
          }
          
          this.updateDisplayValues(minValue, maxValue);
          
          this.callbacks.forEach(callback => {
            callback(minValue, maxValue);
          });
        }
        
        onEnd() {
          this.active = false;
        }
        
        setMinValue(minValue) {
          minValue = Math.max(this.min, minValue);
          
          const currentMaxValue = this.getMaxValue();
          if (currentMaxValue && minValue > currentMaxValue) {
            minValue = currentMaxValue;
          }
          
          const ratio = (minValue - this.min) / (this.max - this.min);
          const position = Math.ceil(ratio * (this.element.offsetWidth - (this.normalizeFact * 2)));
          this.touchLeft.style.left = `${position}px`;
          this.lineSpan.style.marginLeft = `${position}px`;
          this.lineSpan.style.width = `${this.touchRight.offsetLeft - position}px`;
          
          const leftSpan = this.touchLeft.querySelector('span');
          leftSpan.setAttribute('value', `${minValue} GB`);
          
          document.querySelector('#setup-ram-min-display').textContent = `${minValue} GB`;
        }
        
        setMaxValue(maxValue) {
          maxValue = Math.min(this.max, maxValue);
          
          const currentMinValue = this.getMinValue();
          if (currentMinValue && maxValue < currentMinValue) {
            maxValue = currentMinValue;
          }
          
          const ratio = (maxValue - this.min) / (this.max - this.min);
          const position = Math.ceil(ratio * (this.element.offsetWidth - (this.normalizeFact * 2))) + this.normalizeFact;
          this.touchRight.style.left = `${position}px`;
          this.lineSpan.style.width = `${position - this.touchLeft.offsetLeft}px`;
          
          const rightSpan = this.touchRight.querySelector('span');
          rightSpan.setAttribute('value', `${maxValue} GB`);
          
          document.querySelector('#setup-ram-max-display').textContent = `${maxValue} GB`;
        }
        
        getMinValue() {
          const ratio = this.touchLeft.offsetLeft / (this.element.offsetWidth - (this.normalizeFact * 2));
          const rawValue = this.min + ratio * (this.max - this.min);
          return Math.max(this.min, Math.round(rawValue / this.step) * this.step);
        }
        
        getMaxValue() {
          const ratio = (this.touchRight.offsetLeft - this.normalizeFact) / (this.element.offsetWidth - (this.normalizeFact * 2));
          const rawValue = this.min + ratio * (this.max - this.min);
          return Math.min(this.max, Math.round(rawValue / this.step) * this.step);
        }
        
        updateDisplayValues(min, max) {
          const leftSpan = this.touchLeft.querySelector('span');
          leftSpan.setAttribute('value', `${min} GB`);
          
          const rightSpan = this.touchRight.querySelector('span');
          rightSpan.setAttribute('value', `${max} GB`);
          
          document.querySelector('#setup-ram-min-display').textContent = `${min} GB`;
          document.querySelector('#setup-ram-max-display').textContent = `${max} GB`;
        }
        
        on(event, callback) {
          if (event === 'change') {
            this.callbacks.push(callback);
          }
        }
      }
      
      setTimeout(() => {
        
        // Re-verificar que setupModal esté disponible
        const setupModalCheck = document.querySelector('.setup-modal');
        if (!setupModalCheck) {
          console.error("SetupModal desapareció después del timeout");
          resolve();
          return;
        }
        
        // Re-verificar setupSliderElement
        const setupSliderElementCheck = document.querySelector(".setup-memory-slider");
        if (!setupSliderElementCheck) {

          resolve();
          return;
        }
        
        const setupSlider = new SetupSlider(setupSliderElementCheck, defaultMinRam, defaultMaxRam);
        
        let currentStep = 0; // Comenzar desde 0 (idioma)
        const totalSteps = 4; // Total de pasos: 0, 1, 2, 3 (4 pasos en total)
        
        const prevBtn = document.querySelector('.setup-prev-btn');
        const nextBtn = document.querySelector('.setup-next-btn');
        const finishBtn = document.querySelector('.setup-finish-btn');
        
        if (!prevBtn || !nextBtn || !finishBtn) {
          console.error("No se encontraron todos los botones del setup:", {
            prevBtn: !!prevBtn,
            nextBtn: !!nextBtn,
            finishBtn: !!finishBtn
          });
          resolve(); // Resolver inmediatamente si faltan botones
          return;
        }
        
        console.log("Todos los botones del setup encontrados correctamente");
        
        const stepIndicators = document.querySelectorAll('.step');
        
        const updateStepUI = (step) => {
          document.querySelectorAll('.setup-section').forEach(section => {
            section.classList.remove('active', 'prev', 'next');
            section.classList.add('next');
          });
          
          let currentSection = document.querySelector(`#setup-step-${step}`);
          if (currentSection) {
            currentSection.classList.remove('prev', 'next');
            currentSection.classList.add('active');
          }
          
          for (let i = 0; i < step; i++) {
            let prevSection = document.querySelector(`#setup-step-${i}`);
            if (prevSection) {
              prevSection.classList.remove('active', 'next');
              prevSection.classList.add('prev');
            }
          }
          
          stepIndicators.forEach(indicator => {
            const indicatorStep = parseInt(indicator.dataset.step);
            indicator.classList.remove('active-step');
            if (indicatorStep === step) {
              indicator.classList.add('active-step');
            }
          });
          
          prevBtn.style.display = step > 0 ? 'block' : 'none';
          nextBtn.style.display = step < (totalSteps - 1) ? 'block' : 'none';
          finishBtn.style.display = step === (totalSteps - 1) ? 'block' : 'none';
        };
        
        updateStepUI(0); // Comenzar en el paso 0 (idioma)
        
        // Configurar selector de idioma
        let selectedLanguage = 'es-ES'; // Usar español como idioma inicial por defecto
        this.selectedSetupLanguage = selectedLanguage; // Guardar en propiedad de clase
        this.setupLanguageSelector(selectedLanguage);
        
        prevBtn.addEventListener('click', () => {
          if (currentStep > 0) {
            currentStep--;
            updateStepUI(currentStep);
          }
        });
        
        nextBtn.addEventListener('click', () => {
          if (currentStep < (totalSteps - 1)) {
            currentStep++;
            updateStepUI(currentStep);
          }
        });
        
        const launcherBehaviorOptions = document.querySelectorAll('.setup-launcher-behavior-option');
        let selectedLauncherBehavior = "close-launcher";
        
        launcherBehaviorOptions.forEach(option => {
          if (option.dataset.value === selectedLauncherBehavior) {
            option.classList.add('selected');
          }
          
          option.addEventListener('click', () => {
            launcherBehaviorOptions.forEach(opt => opt.classList.remove('selected'));
            
            option.classList.add('selected');
            
            selectedLauncherBehavior = option.dataset.value;
          });
        });
        
        const performanceModeToggle = document.querySelector("#setup-performance-mode");
        performanceModeToggle.checked = false;

        
        finishBtn.addEventListener('click', async () => {
          const ramMin = setupSlider.getMinValue();
          const ramMax = setupSlider.getMaxValue();
          const performanceMode = document.querySelector("#setup-performance-mode").checked;
          
          // Obtener idioma seleccionado
          const selectedLanguageOption = document.querySelector('.setup-language-option.selected');
          const selectedLanguageCode = selectedLanguageOption ? 
            selectedLanguageOption.dataset.language : 
            (this.selectedSetupLanguage || 'es-ES');
          
          document.querySelector('.setup-modal').style.display = 'none';
          
          const loadingOverlay = document.querySelector('.loading-overlay');
          loadingOverlay.classList.add('active');
          loadingOverlay.style.visibility = 'visible';
          loadingOverlay.style.opacity = '1';
          loadingOverlay.style.display = 'flex';
          
          await this.db.createData("configClient", {
            account_selected: null,
            instance_selct: null,
            mods_enabled: [],
            music_muted: false,
            terms_accepted: false,
            termsAcceptedDate: null,
            discord_token: null,
            language: selectedLanguageCode,
            java_config: {
              java_path: null,
              java_memory: {
                min: ramMin,
                max: ramMax,
              },
            },
            game_config: {
              screen_size: {
                width: 854,
                height: 480,
              },
            },
            launcher_config: {
              theme: "auto",
              closeLauncher: selectedLauncherBehavior,
              intelEnabledMac: true,
              music_muted: false,
              performance_mode: performanceMode
            },
          });
          
          console.log(`Configuración inicial completada con idioma: ${selectedLanguageCode}`);
          
          // Establecer el idioma definitivamente en el sistema de localización
          try {
            await localization.changeLanguage(selectedLanguageCode);
            console.log(`Idioma establecido definitivamente: ${selectedLanguageCode}`);
          } catch (error) {
            console.error("Error estableciendo idioma final:", error);
          }
          
          if (performanceMode) {
            setPerformanceMode(true);
          }
          resolve();
        });
      }, 500);
    });
  }

  hideLoadingOverlayWithFade() {
    const loadingOverlay = document.querySelector('.loading-overlay');
    if (!loadingOverlay) {
      console.warn("No se encontró elemento loading-overlay");
      return;
    }
    
    try {
      // Asegurarse de obtener configClient como Promise y usar await para resolverla
      this.db.readData('configClient')
        .then(configClient => {
          // Verificar si configClient existe y si tiene la estructura correcta
          if (configClient && configClient.launcher_config && configClient.launcher_config.performance_mode) {
            loadingOverlay.style.transition = 'none';
            loadingOverlay.style.opacity = '0';
            loadingOverlay.style.visibility = 'hidden';
            loadingOverlay.classList.remove('active');
          } else {
            // Comportamiento normal para transiciones suaves
            loadingOverlay.style.transition = 'opacity 0.5s ease, visibility 0.5s ease';
            loadingOverlay.style.opacity = '0';
            
            setTimeout(() => {
              loadingOverlay.style.visibility = 'hidden';
              loadingOverlay.classList.remove('active');
            }, 500);
          }
        })
        .catch(err => {
          // Si hay error al leer configClient, aplicar comportamiento predeterminado
          console.error("Error al leer configClient:", err);
          loadingOverlay.style.transition = 'opacity 0.5s ease, visibility 0.5s ease';
          loadingOverlay.style.opacity = '0';
          
          setTimeout(() => {
            loadingOverlay.style.visibility = 'hidden';
            loadingOverlay.classList.remove('active');
          }, 500);
        });
    } catch (err) {
      console.error("Error al ocultar pantalla de carga con fade:", err);
      // Comportamiento de fallback si hay algún error
      loadingOverlay.style.opacity = '0';
      loadingOverlay.style.visibility = 'hidden';
      loadingOverlay.classList.remove('active');
    }
  }

  async initWindow() {
    // Configurar FileLogger y ConsoleWindow para los loggers
    const fileLogger = {
      log: (level, ...args) => {
        ipcRenderer.send('log-message', {
          level: level,
          args: args,
          timestamp: new Date(),
          identifier: 'Launcher'
        });
      }
    };

    const consoleWindow = {
      isReady: () => true,
      sendLog: (logData) => {
        ipcRenderer.send('log-message', logData);
      }
    };

    window.logger2 = {
      launcher: new Logger2("Launcher", "#FF7F18", fileLogger, consoleWindow),
      minecraft: new Logger2("Minecraft", "#43B581", fileLogger, consoleWindow),
    };

    this.initLogs();

    let hwid = await getHWID();
    
    // Enviar HWID a la consola separada
    ipcRenderer.send('log-message', {
      level: 'info',
      args: [`ID de soporte: ${hwid}`],
      timestamp: new Date(),
      identifier: 'System'
    });

    window.console = window.logger2.launcher;

    window.onerror = (message, source, lineno, colno, error) => {
      console.error(error);
      source = source.replace(`${window.location.origin}/app/`, "");
      let stack = error.stack
        .replace(
          new RegExp(
            `${window.location.origin}/app/`.replace(/\//g, "\\/"),
            "g"
          ),
          ""
        )
        .replace(/\n/g, "<br>")
        .replace(/\x20/g, "&nbsp;");
      new popup().openPopup(
        "Une erreur est survenue",
        `
            <b>Erreur:</b> ${error.message}<br>
            <b>Fichier:</b> ${source}:${lineno}:${colno}<br>
            <b>Stacktrace:</b> ${stack}`,
        "warning",
        {
          value: "Relancer",
          func: () => {
            document.body.classList.add("hide");
            win.reload();
          },
        }
      );
      document.body.classList.remove("hide");
      return true;
    };

    window.onclose = () => {
      localStorage.removeItem("distribution");
    };
    
    ipcRenderer.on('process-cleanup-queue', async () => {
      console.log('Processing cleanup queue before app close...');
      try {
        await cleanupManager.processQueue();
        console.log('Cleanup queue processed successfully');
      } catch (error) {
        console.error('Error processing cleanup queue:', error);
      }
    });
    
    console.info(`Versión del Launcher: ${pkg.version}${pkg.sub_version ? `-${pkg.sub_version}` : ''}`);
    
    const baseVersionInfoElement = document.getElementById('base-version-info');
    
    if (pkg.baseVersionInfo && baseVersionInfoElement) {
      if (pkg.baseVersionInfo.isOfficial) {
        baseVersionInfoElement.textContent = '';
        baseVersionInfoElement.style.display = 'none';
      } else if (pkg.baseVersionInfo.isUndetermined) {
        baseVersionInfoElement.textContent = `(Base desconocida)`;
        baseVersionInfoElement.style.display = 'inline';
      } else {
        baseVersionInfoElement.textContent = `(Base v${pkg.baseVersionInfo.version})`;
        baseVersionInfoElement.style.display = 'inline';
      }
    }
  }

  initLog() {
    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey && e.shiftKey && e.keyCode == 73) || e.keyCode == 123) {
        ipcRenderer.send("main-window-dev-tools-close");
        ipcRenderer.send("main-window-dev-tools");
      }
    });
    new logger(pkg.name, "#7289da");
  }

  shortcut() {
    document.addEventListener("keydown", async (e) => {
      if (e.ctrlKey && e.keyCode == 87) {
          quitAPP();
      }
    });
    window.addEventListener("keydown", async (e) => {
      const { key, altKey } = e;
      if (key === "F4" && altKey) {
        e.preventDefault();
        quitAPP();
      }
    });
  }

  errorConnect() {
    new popup().openPopup({
      title: this.config.error.code,
      content: this.config.error.message,
      color: "red",
      exit: true,
      options: true,
    });
  }

  initFrame() {
    const platform = os.platform() === 'darwin' ? "darwin" : "other";
    
    document.querySelector(`.${platform} .frame`).classList.toggle('hide');
    
    if (platform === "darwin") document.querySelector(".dragbar").classList.toggle("hide");

    const minimizeBtn = document.querySelector(`.${platform} #minimize`);
    const closeBtn = document.querySelector(`.${platform} #close`);

    if (minimizeBtn) {
      minimizeBtn.addEventListener("click", () => {
        ipcRenderer.send("main-window-minimize");
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener("click", async () => {
        quitAPP();
      });
    }
  }

  async initConfigClient() {
    console.log("Verificando existencia de Config Client...");
    let configClient = await this.db.readData("configClient");

    if (!configClient) {
      console.log("No existe configuración. Se utilizará la configuración inicial.");
      return false;
    } else {
      let needsUpdate = false;
      
      if (configClient.terms_accepted === undefined) {
        configClient.terms_accepted = false;
        needsUpdate = true;
      }
      
      // Añadir campo de idioma si no existe
      if (!('language' in configClient)) {
        configClient.language = 'auto';
        needsUpdate = true;
        console.log("Campo 'language' añadido a configClient");
      }
      
      if (needsUpdate) {
        await this.db.updateData("configClient", configClient);
      }
    }
    return true;
  }

  createPanels(...panels) {
    let panelsElem = document.querySelector(".panels");
    for (let panel of panels) {
      console.log(`Iniciando panel ${panel.name}...`);
      let div = document.createElement("div");
      div.classList.add("panel", panel.id);
      div.innerHTML = fs.readFileSync(
        `${__dirname}/panels/${panel.id}.html`,
        "utf8"
      );
      panelsElem.appendChild(div);
      new panel().init(this.config);
    }
  }

  async verifyDiscordAccount() {
    const configClient = await this.db.readData("configClient");
    
    let token = await loadDiscordToken();
    
    if (!token && configClient.discord_token) {
      console.log("Migrando token de Discord del configClient al almacenamiento seguro...");
      await migrateDiscordToken(configClient);
      
      configClient.discord_token = null;
      await this.db.updateData("configClient", configClient);
      
      token = await loadDiscordToken();
    }
    
    let verificationComplete = false;
    
    console.log("Iniciando verificación de Discord...");

    while (!verificationComplete) {
      let isTokenValid = false;
      
      if (token) {
        try {
          isTokenValid = await this.checkTokenValidity(token);
          console.log(`Resultado de validación: ${isTokenValid ? "Válido" : "Inválido"}`);
        } catch (error) {
          console.error("Error al verificar token de Discord:", error);
          isTokenValid = false;
        }
      }

      if (!isTokenValid) {
        token = null;
        let discordDialog = new popup();
        
        const promptTitle = token ? localization.t('verification.discord_authentication_error') : localization.t('verification.discord_verification');
        const promptContent = token 
          ? localization.t('verification.discord_authentication_error_info')
          : localization.t('verification.discord_verification_info');
        
        const dialogResult = await new Promise((resolve) => {
          discordDialog.openDialog({
            title: promptTitle,
            content: promptContent,
            options: true,
            callback: resolve,
          });
        });

        if (dialogResult === "cancel") {
          quitAPP();
          return;
        }
        
        try {
          let connectingPopup = new popup();
          connectingPopup.openPopup({
            title: localization.t('verification.discord_verification'),
            content: localization.t('verification.discord_waiting'),
            color: 'var(--color)'
          });
          
          token = await ipcRenderer.invoke("open-discord-auth");
          console.log("Token recibido desde la ventana de autenticación");
          connectingPopup.closePopup();
          
          if (!token) {
            throw new Error("No se recibió un token válido");
          }
        } catch (error) {
          console.error("Error al obtener el token de Discord:", error);
          
          let errorDialog = new popup();
          const retryResult = await new Promise((resolve) => {
            errorDialog.openDialog({
              title: localization.t('verification.discord_verification_error'),
              content: localization.t('verification.discord_verification_error_info'),
              options: true,
              callback: resolve,
            });
          });
          
          if (retryResult === "cancel") {
            quitAPP();
            return;
          }
          
          continue;
        }
      }
      
      if (token) {
        try {
          console.log("Guardando token de Discord en almacenamiento seguro...");
          const saved = await saveDiscordToken(token);
          if (saved) {
            console.log("Token guardado correctamente en almacenamiento seguro");
          } else {
            console.warn("No se pudo guardar el token en almacenamiento seguro");
          }
        } catch (dbError) {
          console.error("Error al guardar token seguro:", dbError);
        }
      }
      
      let verifyPopup = new popup();
      verifyPopup.openPopup({
        title: localization.t('verification.discord_verifying'),
        content: localization.t('verification.please_wait'),
        color: "var(--color)",
        background: false,
      });
      
      let isMember;
      try {
        let res = await config.GetConfig();
        isMember = (await this.isUserInGuild(token, res.discordServerID)).isInGuild;
        console.log(`Resultado de verificación de membresía: ${isMember ? "Miembro" : "No miembro"}`);
      } catch (error) {
        verifyPopup.closePopup();
        console.error("Error al verificar membresía en el servidor:", error);
        
        let errorDialog = new popup();
        const retryResult = await new Promise((resolve) => {
          errorDialog.openDialog({
            title: localization.t('verification.discord_verification_error'),
            content: localization.t('verification.discord_membership_error_info'),
            options: true,
            callback: resolve,
          });
        });
        
        if (retryResult === "cancel") {
          quitAPP();
          return;
        }
        
        token = null;
        await deleteDiscordToken();
        continue;
      }
      
      verifyPopup.closePopup();

      if (!isMember) {
        //si pkg.discord_url no está vacio o es null mostrar el popup de unirse al servidor
        if (!pkg.discord_url || pkg.discord_url === "") {
        let errorDialog = new popup();
        const retryResult = await new Promise((resolve) => {
          errorDialog.openDialog({
            title: localization.t('verification.discord_verification_error'),
            content: localization.t('verification.discord_membership_missing'),
            options: true,
            callback: resolve,
          });
        });
        if (retryResult === "cancel") {
          quitAPP();
          return;
        } else {
          token = null;
          await deleteDiscordToken();
          continue;
        }
      } else {
        let joinServerDialog = new popup();
        const joinResult = await new Promise((resolve) => {
          joinServerDialog.openDialog({
            title: localization.t('verification.discord_verification_error'),
            content: localization.t('verification.discord_membership_missing_with_invite'),
            options: true,
            callback: resolve,
          });
        });
        
        if (joinResult === "cancel") {
          quitAPP();
          return;
        } else {
          ipcRenderer.send("open-discord-url");
          token = null;
          await deleteDiscordToken();
          continue;
        }
      }
      } else {
        verificationComplete = true;
        
        try {
          const finalCheck = await this.checkTokenValidity(token);
          if (!finalCheck) {
            console.warn("El token se invalidó durante el proceso de verificación, reiniciando...");
            token = null;
            await deleteDiscordToken();
            continue;
          }
        } catch (error) {
          console.error("Error en la verificación final del token:", error);
        }
        
        try {
          console.log("Guardando token final de Discord en almacenamiento seguro...");
          await saveDiscordToken(token);
          console.log("Token final guardado correctamente en almacenamiento seguro");
        } catch (saveError) {
          console.error("Error crítico al guardar token seguro:", saveError);
          
          await new Promise(resolve => setTimeout(resolve, 500));
          try {
            await saveDiscordToken(token);
            console.log("Token guardado en segundo intento");
          } catch (finalError) {
            console.error("Error fatal al persistir token de Discord:", finalError);
          }
        }
        
        await this.startLauncher();
        return;
      }
    }
  }

  async checkTokenValidity(token) {
    if (!token || token == "" || token == null) return false;
    try {
      const response = await fetch("https://discord.com/api/users/@me", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        return true;
      } else {
        return false;
      }
    } catch (error) {
      return false;
    }
  }

  async isUserInGuild(accessToken, guildId) {
    let username;
    let userpfp;
    try {
      const response = await fetch("https://discord.com/api/users/@me/guilds", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch guilds");
      }
      const userResponse = await fetch("https://discord.com/api/users/@me", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      username = "Desconocido";
      userpfp = "https://cdn.discordapp.com/embed/avatars/0.png?size=1024";
      if (!userResponse.ok) {
        throw new Error("Failed to fetch user info");
      } else {
        const user = await userResponse.json();
        username = user.username;
        if (user.avatar === null) {
          userpfp = "https://cdn.discordapp.com/embed/avatars/0.png?size=1024";
        } else {
        userpfp = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}?size=1024`;
        }
      }
      setDiscordPFP(userpfp);
      setDiscordUsername(username);

      const guilds = await response.json();

      const isInGuild = guilds.some((guild) => guild.id === guildId);
      if (!isInGuild) {
        verificationError(username);
      }
      return { isInGuild };
    } catch (error) {
      await verificationError(username);
      console.error("Error al verificar la pertenencia al servidor:", error);
      return { isInGuild: false, error: error.message };
    }
  }

  async startLauncher() {
    let accounts = await this.db.readAllData("accounts");
    let configClient = await this.db.readData("configClient");
    let account_selected = configClient ? configClient.account_selected : null;
    let popupRefresh = new popup();

    if (!configClient) {
        console.log("No se encontró configuración, creando una nueva...");
        await this.initConfigClient();
        configClient = await this.db.readData("configClient");
        if (!configClient) {
            console.error("Error crítico: No se pudo crear la configuración");
            popupRefresh.openPopup({
                title: 'Error crítico',
                content: 'No se pudo crear la configuración del launcher. Por favor, reinicia la aplicación.',
                color: 'red',
                options: true
            });
            return;
        }
        account_selected = null;
    }

    // Ensure accounts is always an array
    if (!Array.isArray(accounts)) {
        if (accounts && typeof accounts === 'object' && accounts.ID) {
            // If a single account object was received, convert to array
            accounts = [accounts];
            console.log("Cuentas convertidas de objeto único a array");
        } else {
            // Initialize as empty array if null, undefined or invalid
            accounts = [];
            console.log("Inicializando array vacío de cuentas");
        }
    }

    console.log(`Cuentas encontradas al inicio: ${accounts.length}`);

    // Limpiar lista de cuentas en la UI antes de comenzar
    const accountsList = document.querySelector('.accounts-list');
    if (accountsList) {
        accountsList.innerHTML = '';
        
        // Asegurar que siempre haya un botón de "Añadir cuenta"
        const addAccountBtn = document.createElement('div');
        addAccountBtn.className = 'account';
        addAccountBtn.id = 'add';
        addAccountBtn.innerHTML = `
            <div class="add-profile">
                <div class="icon-account-add"></div>
            </div>
            <div class="add-text-profile" data-translate="accounts.add_account">${localization.t('accounts.add_account')}</div>
        `;
        
        // Apply button style
        addAccountBtn.style.display = 'flex';
        addAccountBtn.style.flexDirection = 'column';
        addAccountBtn.style.justifyContent = 'center';
        addAccountBtn.style.alignItems = 'center';
        
        // Add to the accounts list
        accountsList.appendChild(addAccountBtn);
        console.log("Botón 'Añadir cuenta' añadido a la interfaz");
    }

    if (accounts && accounts.length > 0) {
        const serverConfig = await config.GetConfig();
        const hwid = await getHWID();
        
        if (serverConfig.protectedUsers && typeof serverConfig.protectedUsers === 'object') {
            let accountsRemoved = 0;
            for (let account of accounts) {
              if (!account || !account.name) continue;
              
              if (serverConfig.protectedUsers[account.name]) {
                const allowedHWIDs = serverConfig.protectedUsers[account.name];
                if (Array.isArray(allowedHWIDs) && !allowedHWIDs.includes(hwid)) {
                    await this.db.deleteData("accounts", account.ID);
                    accountsRemoved++;
                    
                    if (account.ID == account_selected) {
                        configClient.account_selected = null;
                        await this.db.updateData("configClient", configClient);
                        
                        await verificationError(account.name, true);
                        
                        popupRefresh.closePopup();
                        let popupError = new popup();
                            popupError.openPopup({
                                title: localization.t('login.protected_account'),
                                content: localization.t('login.protected_account_info'),
                                color: 'red',
                                options: true,
                            });
                        return;
                    }
                }
              }
            }
        
            if (accountsRemoved > 0) {
                accounts = await this.db.readAllData("accounts");
                if (!accounts || accounts.length === 0) {
                    console.log("No quedan cuentas disponibles después de eliminar las protegidas, redirigiendo a login");
                    configClient.account_selected = null;
                    await this.db.updateData("configClient", configClient);
                    popupRefresh.closePopup();
                    return changePanel("login");
                }
            }
        }
        
        // Filtrar cuentas nulas o inválidas antes de procesarlas
        accounts = accounts.filter(acc => acc && typeof acc === 'object' && acc.ID !== undefined);
        // Si después del filtrado no hay cuentas, redireccionar al login
        if (accounts.length === 0) {
            configClient.account_selected = null;
            await this.db.updateData("configClient", configClient);
            popupRefresh.closePopup();
            return changePanel("login");
        }
        
        let refreshedAccounts = [];
        
        for (let account of accounts) {
            if (!account || !account.ID) {
                console.warn("Se encontró una cuenta inválida en la base de datos, omitiendo...");
                continue;
            }
            
            let account_ID = account.ID;
            if (account.error) {
                await this.db.deleteData("accounts", account_ID);
                continue;
            }
            
            if (!account.meta || !account.meta.type) {
                console.warn(`Cuenta con ID ${account_ID} tiene estructura de meta inválida, omitiendo...`);
                continue;
            }
            
            if (!account.name) {
                console.warn(`Cuenta con ID ${account_ID} no tiene nombre, omitiendo...`);
                await this.db.deleteData("accounts", account_ID);
                continue;
            }
            
            if (account.meta.type === "Xbox" || account.meta.type === "Microsoft") {
              console.log(`Plataforma: ${account.meta.type} | Usuario: ${account.name}`);
                popupRefresh.openPopup({
                  title: localization.t('launcher.connecting'),
                  content: `${localization.t('refresh.platform')}: ${account.meta.type} | ${localization.t('refresh.user')}: ${account.name}`,
                  color: "var(--color)",
                  background: false,
                });
                
                try {
                    // Use new msmc refresh system
                    if (account.refresh_token) {
                        const authManager = new Auth("select_account");
                        const xboxManager = await authManager.refresh(account.refresh_token);
                        const minecraftAuth = await xboxManager.getMinecraft();
                        
                        const refresh_accounts = {
                            access_token: minecraftAuth.mcToken,
                            client_token: null,
                            uuid: minecraftAuth.profile.id,
                            name: minecraftAuth.profile.name,
                            user_properties: "{}",
                            meta: {
                                type: account.meta.type,
                                demo: minecraftAuth.profile.demo || false
                            },
                            refresh_token: xboxManager.save(),
                            profile: minecraftAuth.profile,
                            ID: account_ID
                        };
                        
                        await this.db.updateData("accounts", refresh_accounts, account_ID);
                        refreshedAccounts.push(refresh_accounts);
                        
                        if (account_ID == account_selected) {
                          clickableHead();
                          await setUsername(refresh_accounts.name);
                          await loginMSG();
                        }
                    } else {
                        // Fallback: account needs re-authentication
                        console.warn(`Account ${account.name} missing refresh token, keeping original data`);
                        refreshedAccounts.push(account);
                    }
                } catch (error) {
                    console.error(`Error refreshing Microsoft account ${account.name}:`, error);
                    
                    // Try to handle msmc errors gracefully
                    try {
                        const { wrapError } = require('msmc').assets;
                        const wrappedError = wrapError(error);
                        console.error(`Wrapped error: ${wrappedError.message}`);
                        
                        // If refresh fails, remove the account or mark for re-authentication
                        if (wrappedError.name.includes('auth')) {
                            await this.db.deleteData("accounts", account_ID);
                            if (account_ID == account_selected) {
                                configClient.account_selected = null;
                                await this.db.updateData("configClient", configClient);
                            }
                            console.error(`[Account] ${account.name}: Authentication expired, account removed`);
                            continue;
                        }
                    } catch (wrapErr) {
                        console.warn('Could not wrap msmc error:', wrapErr);
                    }
                    
                    // Keep original account data if refresh fails for other reasons
                    refreshedAccounts.push(account);
                    continue;
                }
            } else if (account.meta.type == "azauth") {
              console.log(`Plataforma: MKNetworkID | Usuario: ${account.name}`);
              popupRefresh.openPopup({
                title: localization.t('launcher.connecting'),
                content: `${localization.t('refresh.platform')}: MKNetworkID | ${localization.t('refresh.user')}: ${account.name}`,
                color: "var(--color)",
                background: false,
              });
              
              const serverConfig = await config.GetConfig();
              if (serverConfig.protectedUsers && typeof serverConfig.protectedUsers === 'object') {
                const hwid = await getHWID();
                
                if (serverConfig.protectedUsers[account.name]) {
                  const allowedHWIDs = serverConfig.protectedUsers[account.name];
                  
                  if (Array.isArray(allowedHWIDs) && !allowedHWIDs.includes(hwid)) {
                    await this.db.deleteData("accounts", account_ID);
                    if (account_ID == account_selected) {
                      configClient.account_selected = null;
                      await this.db.updateData("configClient", configClient);
                    }
                    
                    popupRefresh.closePopup();
                    let popupError = new popup();
                    popupError.openPopup({
                      title: localization.t('login.protected_account'),
                      content: localization.t('login.protected_account_info'),
                      color: 'red',
                      options: true
                    });
                    
                    await verificationError(account.name, true);
                    continue;
                  }
                }
              }
              
              try {
                let AZauthClient = new AZauth(this.config.online);
                let refresh_accounts = await AZauthClient.verify(account.access_token);
                
                // Transform response to match expected format
                const refreshedAccount = {
                  ID: account_ID,
                  name: refresh_accounts.user.name,
                  uuid: refresh_accounts.user.uuid,
                  access_token: account.access_token, // Keep existing token
                  refresh_token: account.refresh_token, // Keep existing token
                  meta: {
                    type: 'azauth',
                    demo: false,
                    ...refresh_accounts.meta
                  },
                  user: refresh_accounts.user
                };
                
                await this.db.updateData("accounts", refreshedAccount, account_ID);
                // Agregar la cuenta actualizada al array de cuentas refrescadas
                refreshedAccounts.push(refreshedAccount);
                
                if (account_ID == account_selected) {
                  // Solo seleccionar la cuenta pero no agregar visualmente aquí
                  clickableHead();
                  await setUsername(account.name);
                  await loginMSG();
                }
              } catch (error) {
                console.error(`[Account] ${account.name}: ${error.message}`);
                
                // Try to refresh the token if verification failed
                if (account.refresh_token) {
                  try {
                    let AZauthClient = new AZauth(this.config.online);
                    let tokenRefresh = await AZauthClient.refresh(account.refresh_token);
                    
                    // Update account with new tokens
                    const refreshedAccount = {
                      ...account,
                      access_token: tokenRefresh.access_token,
                      refresh_token: tokenRefresh.refresh_token
                    };
                    
                    await this.db.updateData("accounts", refreshedAccount, account_ID);
                    refreshedAccounts.push(refreshedAccount);
                    
                    if (account_ID == account_selected) {
                      clickableHead();
                      await setUsername(account.name);
                      await loginMSG();
                    }
                  } catch (refreshError) {
                    console.error(`[Account] ${account.name}: Token refresh failed: ${refreshError.message}`);
                    
                    // Remove account if refresh fails
                    await this.db.deleteData("accounts", account_ID);
                    if (account_ID == account_selected) {
                      configClient.account_selected = null;
                      await this.db.updateData("configClient", configClient);
                    }
                    continue;
                  }
                } else {
                  // Remove account if no refresh token
                  await this.db.deleteData("accounts", account_ID);
                  if (account_ID == account_selected) {
                    configClient.account_selected = null;
                    await this.db.updateData("configClient", configClient);
                  }
                  continue;
                }
              }
            } else if (account.meta.type == "Mojang") {
              console.log(`Plataforma: ${account.meta.type} | Usuario: ${account.name}`);
              popupRefresh.openPopup({
                title: localization.t('launcher.connecting'),
                content: `${localization.t('refresh.platform')}: ${account.meta.type} | ${localization.t('refresh.user')}: ${account.name}`,
                color: "var(--color)",
                background: false,
              });
              
              try {
                if (account.meta.online == false || account.meta.offline) {
                  // Use minecraft-launcher-core for offline accounts
                  let refresh_accounts;
                  
                  // Ensure username is within Minecraft's 16-character limit
                  let validUsername = account.name;
                  if (validUsername && validUsername.length > 16) {
                    validUsername = validUsername.substring(0, 16);
                    console.warn(`Offline account username truncated from "${account.name}" to "${validUsername}" (Minecraft 16-char limit)`);
                  }
                  
                  // Check if getAuth returns a Promise
                  const authResult = Authenticator.getAuth(validUsername);
                  if (authResult && typeof authResult.then === 'function') {
                    refresh_accounts = await authResult;
                  } else {
                    refresh_accounts = authResult;
                  }
                  
                  // Ensure the returned auth object also has the correct username
                  if (refresh_accounts && refresh_accounts.name && refresh_accounts.name.length > 16) {
                    refresh_accounts.name = refresh_accounts.name.substring(0, 16);
                    console.warn(`Auth object name truncated to: ${refresh_accounts.name}`);
                  }
                  
                  // Ensure the account has the required properties
                  if (!refresh_accounts || !refresh_accounts.name) {
                    console.error(`Failed to refresh offline account: ${account.name}`);
                    // Keep the original account if refresh fails, but ensure name is valid
                    const fallbackAccount = { ...account };
                    if (fallbackAccount.name && fallbackAccount.name.length > 16) {
                      fallbackAccount.name = fallbackAccount.name.substring(0, 16);
                    }
                    refreshedAccounts.push(fallbackAccount);
                    continue;
                  }
                  
                  refresh_accounts.ID = account_ID;
                  refresh_accounts.meta = {
                      type: "Mojang",
                      offline: true
                  };
                  
                  // Ensure the final account name is also valid
                  if (refresh_accounts.name && refresh_accounts.name.length > 16) {
                    refresh_accounts.name = refresh_accounts.name.substring(0, 16);
                    console.warn(`Final refresh account name truncated to: ${refresh_accounts.name}`);
                  }
                  
                  refreshedAccounts.push(refresh_accounts);
                  await this.db.updateData("accounts", refresh_accounts, account_ID);
                  
                  if (account_ID == account_selected) {
                    clickableHead();
                    await setUsername(refresh_accounts.name); // Use the validated name
                    await loginMSG();
                  }
                } else {
                  // For online Mojang accounts (legacy)
                  refreshedAccounts.push(account);
                }
              } catch (error) {
                console.error(`Error refreshing Mojang account ${account.name}:`, error);
                // Keep the original account if refresh fails
                refreshedAccounts.push(account);
              }
            } else {
              // For other account types
              refreshedAccounts.push(account);
            }
        }
        
        // Verificar que tengamos cuentas después del refresco
        if (!refreshedAccounts || refreshedAccounts.length === 0) {
            console.log("No quedan cuentas disponibles después del refresco, redirigiendo a login");
            configClient.account_selected = null;
            await this.db.updateData("configClient", configClient);
            popupRefresh.closePopup();
            return changePanel("login");
        }
        
        // Validate all refreshed accounts have valid IDs
        refreshedAccounts = refreshedAccounts.filter(acc => 
            acc && typeof acc === 'object' && acc.ID !== undefined && acc.name
        );
        
        console.log(`Cuentas validadas después de refresco: ${refreshedAccounts.length}`);
        console.log(`IDs después de refresco: ${refreshedAccounts.map(acc => acc.ID).join(', ')}`);
        
        // Ensure account_selected actually exists in the refreshed accounts
        if (account_selected) {
            const accountExists = refreshedAccounts.some(acc => 
                String(acc.ID) === String(account_selected)
            );
            
            if (!accountExists) {
                console.warn(`La cuenta seleccionada ID:${account_selected} ya no existe`);
                if (refreshedAccounts.length > 0) {
                    console.log(`Eligiendo primera cuenta disponible: ${refreshedAccounts[0].name} (ID: ${refreshedAccounts[0].ID})`);
                    account_selected = refreshedAccounts[0].ID;
                    configClient.account_selected = account_selected;
                    await this.db.updateData("configClient", configClient);
                } else {
                    console.log("No hay cuentas disponibles, limpiando selección");
                    account_selected = null;
                    configClient.account_selected = null;
                    await this.db.updateData("configClient", configClient);
                }
            }
        }
        
        // Asegurar que las cuentas actualizadas sean persistidas como un array
        try {
            if (!refreshedAccounts || !Array.isArray(refreshedAccounts)) {
                console.error("Error crítico: refreshedAccounts no es un array");
                refreshedAccounts = [];
            }
            console.log(`Intentando guardar ${refreshedAccounts.length} cuentas refrescadas`);
            
            // Verificar que todos los elementos sean objetos válidos
            let validAccounts = refreshedAccounts.filter(acc => acc && typeof acc === 'object' && acc.ID !== undefined);
            
            if (validAccounts.length !== refreshedAccounts.length) {
                console.warn(`Filtradas ${refreshedAccounts.length - validAccounts.length} cuentas inválidas`);
                refreshedAccounts = validAccounts;
            }
            
            if (refreshedAccounts.length > 0) {
                // Check for duplicate IDs and fix them
                const seenIds = new Set();
                let needsIdFix = false;
                
                refreshedAccounts = refreshedAccounts.map((acc, index) => {
                    // Deep copy to avoid reference issues
                    const accCopy = JSON.parse(JSON.stringify(acc));
                    
                    // Ensure ID is a number
                    let id = parseInt(String(accCopy.ID));
                    if (isNaN(id)) {
                        id = index + 1;  // Assign sequential ID
                        needsIdFix = true;
                    }
                    
                    // Check for duplicate IDs
                    if (seenIds.has(id)) {
                        id = Math.max(...Array.from(seenIds)) + 1; // Assign next highest ID
                        needsIdFix = true;
                    }
                    
                    seenIds.add(id);
                    
                    if (needsIdFix) {
                        accCopy.ID = id;
                    }
                    
                    return accCopy;
                });
                
                // Log IDs before saving
                console.log(`Guardando cuentas con IDs: ${refreshedAccounts.map(acc => acc.ID).join(', ')}`);
                
                await this.db.updateData("accounts", refreshedAccounts);
                console.log(`Guardadas ${refreshedAccounts.length} cuentas correctamente como array`);
            } else {
                console.warn("No hay cuentas válidas para guardar");
                await this.db.updateData("accounts", []);
            }
        } catch (error) {
            console.error("Error al guardar las cuentas:", error);
            try {
                await this.db.updateData("accounts", []);
            } catch (innerError) {
                console.error("Error también al intentar guardar array vacío:", innerError);
            }
        }
        
        // Actualizar la selección de cuenta si es necesario
        account_selected = configClient ? configClient.account_selected : null;
        
        // Ahora que tenemos todas las cuentas actualizadas y guardadas, las añadimos a la interfaz
        for (const account of refreshedAccounts) {
            await addAccount(account);
            await accountSelect(account);
            await clickableHead();
            await setUsername(account.name);
            await loginMSG();
            changePanel('home');
        }
        
        if ((!account_selected || typeof account_selected === 'undefined') && refreshedAccounts.length > 0) {
            let uuid = refreshedAccounts[0].ID;
            if (uuid) {
                configClient.account_selected = uuid;
                console.log(`Seleccionando cuenta por defecto con ID: ${uuid}, nombre: ${refreshedAccounts[0].name}`);
                await this.db.updateData("configClient", configClient);
                await accountSelect(refreshedAccounts[0]);
                clickableHead();
                await setUsername(refreshedAccounts[0].name);
            }
        } else if (account_selected && refreshedAccounts.length > 0) {
            // Asegurar que la cuenta seleccionada exista
            console.log(`Verificando cuenta seleccionada ID: ${account_selected}`);
            const selectedAccount = refreshedAccounts.find(acc => acc && String(acc.ID) === String(account_selected));
            if (selectedAccount) {
                console.log(`Cuenta seleccionada encontrada: ${selectedAccount.name} (ID: ${selectedAccount.ID})`);
                await accountSelect(selectedAccount);
                clickableHead();
                await setUsername(selectedAccount.name);
            } else if (refreshedAccounts.length > 0) {
                // Si la cuenta seleccionada no existe pero hay otras cuentas, seleccionar la primera
                console.log(`Cuenta seleccionada ID:${account_selected} no encontrada, seleccionando primera cuenta disponible: ${refreshedAccounts[0].name} (ID: ${refreshedAccounts[0].ID})`);
                configClient.account_selected = refreshedAccounts[0].ID;
                await this.db.updateData("configClient", configClient);
                await accountSelect(refreshedAccounts[0]);
                clickableHead();
                await setUsername(refreshedAccounts[0].name);
            }
        }
        
        console.log(`Cuentas finales disponibles: ${refreshedAccounts.length}`);
        
        popupRefresh.closePopup();
        
        if (refreshedAccounts.length > 0) {
            changePanel("home");
        } else {
            console.log("No hay cuentas después del refresco, redirigiendo a login");
            changePanel("login");
        }
    } else {
        // No hay cuentas desde el inicio
        if (configClient) {
            configClient.account_selected = null;
            await this.db.updateData('configClient', configClient);
        }
        popupRefresh.closePopup();
        changePanel("login");
    }
  }

  async initLogs() {
    // Configurar atajos de teclado para abrir la consola separada
    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey && e.shiftKey && e.keyCode == 73) || e.keyCode == 123) {
        // Abrir consola separada
        ipcRenderer.send('console-window-toggle');
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === 'Escape') {
        // Cerrar consola separada si está abierta
        ipcRenderer.send('console-window-close');
      }
    });

    // Configurar listeners para eventos de la consola desde app.js
    ipcRenderer.on('report-issue-triggered', async () => {
      await this.confirmReportIssue();
    });

    ipcRenderer.on('patch-toolkit-triggered', () => {
      this.runPatchToolkit();
    });

    // Listener para enviar colores cuando la consola los solicite
    ipcRenderer.on('send-colors-to-console', async () => {
      console.log('Consola solicita colores dinámicos, reenviando...');
      try {
        // Releer los colores del servidor y enviarlos a la consola
        await this.loadColors();
      } catch (error) {
        console.warn('Error reenviando colores a la consola:', error);
      }
    });

    // Listener para enviar configuración del servidor cuando la consola la solicite
    ipcRenderer.on('send-server-config-to-console', async () => {
      console.log('Consola solicita configuración del servidor, enviando...');
      try {
        const res = await config.GetConfig();
        
        const configForConsole = {
          patchToolkit: res.patchToolkit === true // Solo true si es específicamente true
        };
        
        ipcRenderer.send('apply-server-config', configForConsole);
      } catch (error) {
        console.warn('Error enviando configuración del servidor a la consola:', error);
        // Enviar configuración por defecto (toolkit deshabilitado) en caso de error
        ipcRenderer.send('apply-server-config', { patchToolkit: false });
      }
    });

    // Ya no necesitamos configurar la consola interna,
    // todos los logs se envían automáticamente a la consola separada
    console.log("Sistema de logs configurado para consola separada");
  }

  async confirmReportIssue() {
    let reportPopup = new popup();
    let dialogResult = await new Promise(resolve => {
      reportPopup.openDialog({
            title: localization.t('mklib.report_prompt'),
            content: localization.t('mklib.report_prompt_info'),
            options: true,
            callback: resolve
        });
    });
    if (dialogResult === 'cancel') {
        ipcRenderer.send('console-window-open');
        return;
    }
    await this.sendReport();
  }

  async sendReport() {
    try {
      // Obtener logs desde la consola separada
      console.log("Solicitando logs de consola para reporte...");
      const logContent = await ipcRenderer.invoke('get-console-logs');
      
      console.log("Respuesta de get-console-logs:", {
        type: typeof logContent,
        length: logContent ? logContent.length : 0,
        preview: logContent ? logContent.substring(0, 100) : 'null',
        isError: logContent && logContent.includes('Error al obtener logs'),
        isNotAvailable: logContent && logContent.includes('No hay logs disponibles'),
        isConsoleNotAvailable: logContent && logContent.includes('Consola no disponible')
      });
      
      // Validar que el contenido de logs no esté vacío y sea válido
      if (!logContent || 
          logContent.trim() === '' || 
          logContent === 'No hay logs disponibles' ||
          logContent.includes('No hay logs disponibles en la consola') ||
          logContent.includes('Consola no disponible')) {
        
        console.warn("No se encontraron logs válidos en la consola separada, intentando obtener desde archivo...");
        console.warn("Razón:", logContent);
        
        // Intentar obtener logs desde el archivo del FileLogger
        try {
          const fileLogContent = await this.getFileLogContent();
          console.log("Logs obtenidos desde archivo:", {
            type: typeof fileLogContent,
            length: fileLogContent ? fileLogContent.length : 0,
            preview: fileLogContent ? fileLogContent.substring(0, 100) : 'null'
          });
          
          if (fileLogContent && fileLogContent.trim() !== '' && 
              !fileLogContent.includes('Archivo de log no encontrado') &&
              !fileLogContent.includes('FileLogger no inicializado')) {
            console.log("Logs obtenidos desde archivo exitosamente");
            sendClientReport(fileLogContent, false);
          } else {
            console.warn("No se pudieron obtener logs desde archivo, usando información de diagnóstico");
            const diagnosticInfo = `Error: No se pudieron obtener logs válidos para el reporte.
            
Información de diagnóstico:
- Fecha: ${new Date().toISOString()}
- Respuesta de consola: ${logContent}
- Respuesta de archivo: ${fileLogContent}
- User Agent: ${navigator.userAgent}
- Versión del launcher: ${pkg.version}${pkg.sub_version ? `-${pkg.sub_version}` : ''}
- Estado de la aplicación: ${document.readyState}
- URL actual: ${window.location.href}`;
            
            sendClientReport(diagnosticInfo, false);
          }
        } catch (fileError) {
          console.error("Error obteniendo logs desde archivo:", fileError);
          const errorInfo = `Error al obtener logs: ${fileError.message}
          
Información de diagnóstico:
- Fecha: ${new Date().toISOString()}
- Error de consola: ${logContent}
- Error de archivo: ${fileError.stack || fileError.message}
- Versión del launcher: ${pkg.version}${pkg.sub_version ? `-${pkg.sub_version}` : ''}`;
          
          sendClientReport(errorInfo, false);
        }
      } else {
        console.log("Logs obtenidos exitosamente desde consola separada");
        sendClientReport(logContent, false);
      }
    } catch (error) {
      console.error('Error obteniendo logs para el reporte:', error);
      // Fallback: usar mensaje de error detallado
      const errorMessage = `Error crítico al obtener logs: ${error.message}

Stack trace: ${error.stack || 'No disponible'}
Fecha: ${new Date().toISOString()}
Tipo de error: ${error.name || 'Unknown'}
Versión del launcher: ${pkg.version}${pkg.sub_version ? `-${pkg.sub_version}` : ''}
User Agent: ${navigator.userAgent}`;
      
      sendClientReport(errorMessage, false);
    }
  }

  async getFileLogContent() {
    try {
      // Solicitar el contenido del archivo de log actual al proceso principal
      const fileLogContent = await ipcRenderer.invoke('get-file-log-content');
      return fileLogContent;
    } catch (error) {
      console.error('Error obteniendo contenido del archivo de log:', error);
      return null;
    }
  }
  async runPatchToolkit() {
    let patchToolkitPopup = new popup();
    let dialogResult = await new Promise(resolve => {
      patchToolkitPopup.openDialog({
            title: localization.t('mklib.patch_toolkit_prompt'),
            content: localization.t('mklib.patch_toolkit_prompt_info'),
            options: true,
            callback: resolve
        });
    });
    if (dialogResult === 'cancel') {
        ipcRenderer.send('console-window-open');
        return;
    }
    patchLoader();
  }

  applyPerformanceModeOverrides() {
    const panels = document.querySelectorAll('.panel');
    panels.forEach(panel => {
      panel.style.transition = 'none';
      panel.style.transitionProperty = 'none';
      panel.style.transitionDuration = '0s';
      panel.style.transitionDelay = '0s';
    });
    
    const settingsContainers = document.querySelectorAll('.container-settings');
    settingsContainers.forEach(container => {
           container.style.transition = 'none';
      container.style.transform = 'none';
    });
    
    const settingsBtns = document.querySelectorAll('.nav-settings-btn');
    settingsBtns.forEach(btn => {
      btn.style.transition = 'none';
    });
    
    const settingsContent = document.querySelector('.settings-content');
    if (settingsContent) {
      settingsContent.style.transition = 'none';
    }
    
    console.log("Aplicados ajustes específicos para el modo rendimiento");
  }

  verifyConfigStructure(config) {
    if (!config) return false;

    const topLevelFields = ['account_selected', 'instance_selct', 'mods_enabled', 'music_muted', 'terms_accepted', 'termsAcceptedDate'];
    for (const field of topLevelFields) {
      if (!(field in config)) {
        console.error(`Campo faltante en configClient: ${field}`);
        return false;
      }
    }

    if (!config.java_config || 
        !config.java_config.java_path || 
        !config.java_config.java_memory ||
        !config.java_config.java_memory.min || 
        !config.java_config.java_memory.max) {
      console.error("Estructura incorrecta en java_config");
      return false;
    }
    if (!config.game_config || 
        !config.game_config.screen_size ||
        !config.game_config.screen_size.width || 
        !config.game_config.screen_size.height) {
      console.error("Estructura incorrecta en game_config");
      return false;
    }

    if (!config.launcher_config || 
        !('theme' in config.launcher_config) ||
        !('closeLauncher' in config.launcher_config) ||
        !('intelEnabledMac' in config.launcher_config) ||
        !('music_muted' in config.launcher_config) ||
        !('performance_mode' in config.launcher_config)) {
      console.error("Estructura incorrecta en launcher_config");
      return false;
    }

    // Verificar que existe el campo de idioma (puede ser undefined)
    if (!('language' in config)) {
      console.warn("Campo 'language' no existe en configClient, se agregará automáticamente");
      config.language = 'auto';
    }

    return true;
  }

  async setupLanguageSelector(defaultLanguage) {
    try {
      console.log("Configurando selector de idioma para configuración inicial");
      
      // Variable para tracking del idioma seleccionado
      let selectedLanguage = defaultLanguage;
      
      // Asegurar que la propiedad de clase esté definida
      this.selectedSetupLanguage = selectedLanguage;
      
      // Cargar idiomas disponibles si no están cargados
      if (!localization.availableLanguages) {
        await localization.loadAvailableLanguages();
      }
      
      const languageOptionsContainer = document.querySelector('.setup-language-options');
      if (!languageOptionsContainer) {
        console.error("No se encontró el contenedor de opciones de idioma");
        return;
      }
      
      // Mapa de códigos de país para flagsapi.com (coincide con el de settings.js)
      const languageCountryCodes = {
        'es-ES': 'ES',
        'en-EN': 'GB', // Inglés usa bandera británica
        'fr-FR': 'FR',
        'de-DE': 'DE',
        'it-IT': 'IT',
        'pt-BR': 'BR',
        'pt-PT': 'PT',
        'ru-RU': 'RU',
        'ja-JP': 'JP',
        'ko-KR': 'KR',
        'zh-CN': 'CN',
        'zh-TW': 'TW',
        'pl-PL': 'PL',
        'nl-NL': 'NL',
        'sv-SE': 'SE',
        'da-DK': 'DK',
        'fi-FI': 'FI',
        'no-NO': 'NO',
        'cs-CZ': 'CZ',
        'hu-HU': 'HU',
        'tr-TR': 'TR',
        'ar-SA': 'SA',
        'he-IL': 'IL',
        'th-TH': 'TH',
        'vi-VN': 'VN',
        'id-ID': 'ID',
        'ms-MY': 'MY',
        'uk-UA': 'UA',
        'bg-BG': 'BG',
        'ro-RO': 'RO',
        'hr-HR': 'HR',
        'sr-RS': 'RS',
        'sl-SI': 'SI',
        'sk-SK': 'SK',
        'lt-LT': 'LT',
        'lv-LV': 'LV',
        'et-EE': 'EE'
      };
      
      // Limpiar opciones existentes
      languageOptionsContainer.innerHTML = '';
      
      // Obtener idiomas disponibles del sistema de localización
      const availableLanguages = localization.getAvailableLanguages();
      
      // Si no hay idiomas disponibles, usar los básicos
      const languagesToShow = Object.keys(availableLanguages).length > 0 
        ? Object.keys(availableLanguages) 
        : ['es-ES', 'en-EN', 'fr-FR', 'de-DE', 'it-IT', 'pt-PT', 'pt-BR'];
      
      // Crear opciones de idioma dinámicamente con banderas de flagsapi.com
      languagesToShow.forEach(langCode => {
        const langInfo = availableLanguages[langCode];
        const countryCode = languageCountryCodes[langCode];
        
        // Usar información del idioma disponible o fallback
        const displayName = langInfo ? langInfo.name : langCode;
        const nativeName = langInfo ? langInfo.nativeName : langCode;
        
        const option = document.createElement('div');
        option.className = 'setup-language-option';
        option.dataset.language = langCode;
        
        if (langCode === defaultLanguage) {
          option.classList.add('selected');
        }
        
        // Crear contenido de la opción con bandera dinámica
        const flagContent = countryCode 
          ? `<img src="https://flagsapi.com/${countryCode}/flat/64.png" alt="${countryCode} flag" 
                  style="width: 24px; height: 18px; border-radius: 3px; object-fit: cover;"
                  onerror="this.style.display='none'; this.parentNode.innerHTML='🏳️';">`
          : '🏳️'; // Fallback para idiomas sin código de país
        
        option.innerHTML = `
          <div class="setup-language-flag">
            ${flagContent}
          </div>
          <div class="setup-language-info">
            <div class="setup-language-name">${displayName}</div>
            <div class="setup-language-native">${nativeName}</div>
          </div>
        `;
        
        option.addEventListener('click', async () => {
          // Actualizar propiedades de clase para mantener estado
          this.selectedSetupLanguage = langCode;
          
          // Remover selección anterior
          document.querySelectorAll('.setup-language-option').forEach(opt => {
            opt.classList.remove('selected');
          });
          
          // Seleccionar nueva opción
          option.classList.add('selected');
          selectedLanguage = langCode;
          
          // Cambiar idioma inmediatamente y aplicar traducciones
          try {
            console.log(`Cambiando idioma a ${langCode} durante configuración inicial`);
            await localization.changeLanguage(langCode);
            localization.forceApplyTranslations();
            console.log("Traducciones aplicadas en configuración inicial");
          } catch (error) {
            console.error("Error al cambiar idioma durante configuración inicial:", error);
          }
        });
        
        languageOptionsContainer.appendChild(option);
      });
      
      // Establecer el idioma seleccionado inicialmente
      if (defaultLanguage) {
        try {
          console.log(`Estableciendo idioma inicial a ${defaultLanguage}`);
          await localization.changeLanguage(defaultLanguage);
          localization.forceApplyTranslations();
          console.log("Idioma inicial establecido y traducciones aplicadas");
        } catch (error) {
          console.error("Error al establecer idioma inicial:", error);
        }
      }
      
      console.log("Selector de idioma configurado exitosamente con banderas dinámicas");
      
    } catch (error) {
      console.error("Error configurando selector de idioma:", error);
    }
  }
}

new Launcher().init();

async function initialize() {
  window.addEventListener('unload', async () => {
    try {
      await ipcRenderer.invoke('process-cleanup-queue');
    } catch (error) {
      console.error('Error processing cleanup queue before exit:', error);
    }
  });
}

initialize().catch(error => {
  console.error('Error during initialization:', error);
});
