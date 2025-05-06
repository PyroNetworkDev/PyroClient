/**
 * @author Luuxis
 * @license CC-BY-NC 4.0 - https://creativecommons.org/licenses/by-nc/4.0
 */
// import panel
import Login from "./panels/login.js";
import Home from "./panels/home.js";
import Settings from "./panels/settings.js";
import Mods from "./panels/mods.js";
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
  patchLoader
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
const { AZauth, Microsoft, Mojang } = require("minecraft-java-core");

const { ipcRenderer } = require("electron");
const fs = require("fs");
const os = require("os");
const fetch = require("node-fetch");
let dev = process.env.NODE_ENV === "dev";

class Launcher {
  async init() {
    if (dev) this.initLog();
    else this.initWindow();

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
    
    
    // Ahora que la migración ha terminado (si era necesaria), verificamos la configuración
    const configClient = await this.db.readData("configClient");
    const isFirstRun = !configClient;
    
    if (isFirstRun) {
      console.log("Primera ejecución detectada. Iniciando configuración inicial...");
      await this.showInitialSetup();
      this.hideLoadingOverlayWithFade();
      
      console.log("Inicializando cleanup manager después de configuración inicial");
      await cleanupManager.initialize();
    } else {
      if (configClient.launcher_config.performance_mode) {
        console.log("Modo de rendimiento activado");
        document.body.classList.add('performance-mode');
        
        this.applyPerformanceModeOverrides();
        
        setPerformanceMode(true);
      }
      
      console.log("Inicializando cleanup manager con configuración existente");
      await cleanupManager.initialize();
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
    this.config = await config
      .GetConfig()
      .then((res) => res)
      .catch((err) => err);
    if (await this.config.error) return this.errorConnect();
    
    if (isFirstRun) {
      await this.initConfigClient();
    }
    
    this.createPanels(Login, Home, Settings, Mods);
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
    
    
    const configClient = this.db.readData('configClient');
    if (configClient && configClient.launcher_config && configClient.launcher_config.performance_mode) {
      loadingOverlay.style.transition = 'none';
      loadingOverlay.style.opacity = '0';
      loadingOverlay.style.visibility = 'hidden';
      loadingOverlay.classList.remove('active');
      return;
    }
    
    try {
      loadingOverlay.classList.remove('active');
      
      setTimeout(() => {
        loadingOverlay.style.opacity = '0';
        loadingOverlay.style.visibility = 'hidden';
      }, 800);
    } catch (err) {
      console.error("Error al ocultar pantalla de carga:", err);
      loadingOverlay.style.opacity = '0';
      loadingOverlay.style.visibility = 'hidden';
      loadingOverlay.style.display = 'none';
    }
  }

  async showInitialSetup() {
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
      }
      
      document.querySelector('.setup-modal').style.display = 'flex';
      
      document.querySelector('#setup-total-ram').textContent = `${totalMem} GB`;
      
      const setupSliderElement = document.querySelector(".setup-memory-slider");
      setupSliderElement.setAttribute("max", Math.trunc((80 * totalMem) / 100));
      
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
        const setupSlider = new SetupSlider(setupSliderElement, defaultMinRam, defaultMaxRam);
        
        let currentStep = 1;
        const totalSteps = 4;
        
        const prevBtn = document.querySelector('.setup-prev-btn');
        const nextBtn = document.querySelector('.setup-next-btn');
        const finishBtn = document.querySelector('.setup-finish-btn');
        
        const stepIndicators = document.querySelectorAll('.step');
        
        const updateStepUI = (step) => {
          document.querySelectorAll('.setup-section').forEach(section => {
            section.classList.remove('active', 'prev', 'next');
            section.classList.add('next');
          });
          
          let currentSection = document.querySelector(`#setup-step-${step}`);
          currentSection.classList.remove('prev', 'next');
          currentSection.classList.add('active');
          
          for (let i = 1; i < step; i++) {
            let prevSection = document.querySelector(`#setup-step-${i}`);
            prevSection.classList.remove('active', 'next');
            prevSection.classList.add('prev');
          }
          
          stepIndicators.forEach(indicator => {
            const indicatorStep = parseInt(indicator.dataset.step);
            indicator.classList.remove('active-step');
            if (indicatorStep === step) {
              indicator.classList.add('active-step');
            }
          });
          
          prevBtn.style.display = step > 1 ? 'block' : 'none';
          nextBtn.style.display = step < totalSteps ? 'block' : 'none';
          finishBtn.style.display = step === totalSteps ? 'block' : 'none';
        };
        
        updateStepUI(1);
        
        prevBtn.addEventListener('click', () => {
          if (currentStep > 1) {
            currentStep--;
            updateStepUI(currentStep);
          }
        });
        
        const maxDownloadsInput = document.querySelector("#setup-max-downloads");
        let isMaxDownloadsValid = true;
        
        const validateMaxDownloads = () => {
          if (!maxDownloadsInput) return true;
          
          const value = parseInt(maxDownloadsInput.value);
          isMaxDownloadsValid = !isNaN(value) && value >= 1 && value <= 20;
          
          if (isMaxDownloadsValid) {
            maxDownloadsInput.style.borderColor = "";
            maxDownloadsInput.style.backgroundColor = "";
            
            const existingError = document.querySelector('.max-downloads-error');
            if (existingError) {
              existingError.remove();
            }
          } else {
            maxDownloadsInput.style.borderColor = "red";
            maxDownloadsInput.style.backgroundColor = "rgba(255, 0, 0, 0.1)";
            
            let errorMsg = document.querySelector('.max-downloads-error');
            if (!errorMsg) {
              errorMsg = document.createElement('div');
              errorMsg.className = 'max-downloads-error';
              errorMsg.style.color = 'red';
              errorMsg.style.fontSize = '12px';
              errorMsg.style.marginTop = '5px';
              errorMsg.innerText = 'Por favor ingresa un número entre 1 y 20';
              
              maxDownloadsInput.insertAdjacentElement('afterend', errorMsg);
            }
          }
          
          return isMaxDownloadsValid;
        };
        
        nextBtn.addEventListener('click', () => {
          if (currentStep === 3) {
            if (!validateMaxDownloads()) {
              return;
            }
          }
          
          if (currentStep < totalSteps) {
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
        
        if (maxDownloadsInput) {
          maxDownloadsInput.value = 3;
          
          maxDownloadsInput.addEventListener('input', () => {
            const value = parseInt(maxDownloadsInput.value);
            validateMaxDownloads();
          });
          
          maxDownloadsInput.addEventListener('blur', validateMaxDownloads);
        }
        
        finishBtn.addEventListener('click', async () => {
          if (!validateMaxDownloads()) {
            return;
          }
          
          const ramMin = setupSlider.getMinValue();
          const ramMax = setupSlider.getMaxValue();
          const performanceMode = document.querySelector("#setup-performance-mode").checked;
          const maxDownloads = maxDownloadsInput ? parseInt(maxDownloadsInput.value) || 3 : 3;
          
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
              download_multi: maxDownloads,
              theme: "auto",
              closeLauncher: selectedLauncherBehavior,
              intelEnabledMac: true,
              music_muted: false,
              performance_mode: performanceMode
            },
          });
          
          if (performanceMode) {
            setPerformanceMode(true);
          }
          resolve();
        });
      }, 200);
    });
  }

  hideLoadingOverlayWithFade() {
    const loadingOverlay = document.querySelector('.loading-overlay');
    if (!loadingOverlay) {
      console.warn("No se encontró elemento loading-overlay");
      return;
    }
    
    const configClient = this.db.readData('configClient');
    if (configClient && configClient.launcher_config && configClient.launcher_config.performance_mode) {
      loadingOverlay.style.transition = 'none';
      loadingOverlay.style.opacity = '0';
      loadingOverlay.style.visibility = 'hidden';
      loadingOverlay.classList.remove('active');
    } else {
      loadingOverlay.style.transition = 'opacity 0.5s ease, visibility 0.5s ease';
      loadingOverlay.style.opacity = '0';
      
      setTimeout(() => {
        loadingOverlay.style.visibility = 'hidden';
        loadingOverlay.classList.remove('active');
      }, 500);
    }
  }

  async initWindow() {
    window.logger2 = {
      launcher: new Logger2("Launcher", "#FF7F18"),
      minecraft: new Logger2("Minecraft", "#43B581"),
    };

    this.initLogs();

    let hwid = await getHWID();
    let hwidConsoleLabel = document.querySelector(".console-hwid");
    hwidConsoleLabel.innerHTML = hwid;
    
    let hwidCopyButton = document.querySelector(".copy-console-hwid");
    hwidCopyButton.addEventListener("click", () => {
      navigator.clipboard.writeText(hwid);
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
      await cleanupManager.processQueue();
      cleanupManager.stopAllLogWatchers();
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
    console.log("Inicializando Config Client...");
    let configClient = await this.db.readData("configClient");

    if (!configClient) {
      await this.db.createData("configClient", {
        account_selected: null,
        instance_selct: null,
        mods_enabled: [],
        music_muted: false,
        terms_accepted: false,
        java_config: {
          java_path: null,
          java_memory: {
            min: 2,
            max: 4,
          },
        },
        game_config: {
          screen_size: {
            width: 854,
            height: 480,
          },
        },
        launcher_config: {
          download_multi: 5,
          theme: "auto",
          closeLauncher: "close-launcher",
          intelEnabledMac: true,
          music_muted: false
        },
      });
    } else if (configClient.terms_accepted === undefined) {
      configClient.terms_accepted = false;
      await this.db.updateData("configClient", configClient);
    }
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
        
        const promptTitle = token ? "Error de autenticación" : "Verificación de Discord";
        const promptContent = token 
          ? "No se ha podido verificar la sesión de Discord. <br><br>¿Quieres volver a intentarlo?"
          : "Para poder acceder al launcher debes iniciar sesión con tu cuenta de Discord y estar en el servidor de Pyro Network. <br><br>¿Quieres iniciar sesión ahora?";
        
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
            title: 'Verificación de Discord',
            content: 'Esperando a la autorización...',
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
              title: "Error al verificar la cuenta de Discord",
              content: "No se ha podido verificar la cuenta de Discord. <br><br>¿Quieres intentarlo de nuevo?",
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
        title: "Verificando cuenta de Discord...",
        content: "Por favor, espera un momento...",
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
            title: "Error de conexión",
            content: "No se ha podido verificar la membresía en el servidor de Discord. <br><br>¿Quieres intentarlo de nuevo?",
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
        let joinServerDialog = new popup();
        const joinResult = await new Promise((resolve) => {
          joinServerDialog.openDialog({
            title: "Error al verificar la cuenta de Discord",
            content: "No se ha detectado que seas miembro del servidor de Discord. Para poder utilizar el launcher debes ser miembro del servidor. <br><br>¿Quieres unirte ahora? Se abrirá una ventana en tu navegador.",
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
            <div class="add-text-profile">Añadir una cuenta</div>
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
                        
                        await new Promise(resolve => {
                            popupError.openPopup({
                                title: 'Cuenta protegida',
                                content: 'Esta cuenta está protegida y no puede ser usada en este dispositivo. Por favor, contacta con el administrador si crees que esto es un error.',
                                color: 'red',
                                options: {
                                    value: "Entendido",
                                    event: resolve
                                }
                            });
                        });
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
        console.log(`Cuentas válidas después de filtrado: ${accounts.length}`);
        
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
            
            if (account.meta.type === "Xbox") {
              console.log(`Plataforma: ${account.meta.type} | Usuario: ${account.name}`);
                popupRefresh.openPopup({
                  title: "Conectando...",
                  content: `Plataforma: ${account.meta.type} | Usuario: ${account.name}`,
                  color: "var(--color)",
                  background: false,
                });
                
                try {
                    let refresh_accounts = await new Microsoft(this.config.client_id).refresh(account);
                    if (refresh_accounts.error) {
                      await this.db.deleteData("accounts", account_ID);
                      if (account_ID == account_selected) {
                        configClient.account_selected = null;
                        await this.db.updateData("configClient", configClient);
                      }
                      console.error(`[Account] ${account.name}: ${refresh_accounts.errorMessage || "Error desconocido"}`);
                      continue;
                    }
                    
                    if (!refresh_accounts || !refresh_accounts.name) {
                        console.error(`[Account] ${account.name}: La actualización devolvió datos incompletos`);
                        continue;
                    }
                    
                    refresh_accounts.ID = account_ID;
                    await this.db.updateData("accounts", refresh_accounts, account_ID);
                    // Agregar la cuenta actualizada al array de cuentas refrescadas
                    refreshedAccounts.push(refresh_accounts);
                    
                    if (account_ID == account_selected) {
                      // Solo seleccionar la cuenta pero no agregar visualmente aquí
                      clickableHead(false);
                      await setUsername(refresh_accounts.name);
                      await loginMSG();
                    }
                } catch (error) {
                    console.error(`Error al refrescar cuenta ${account.name}:`, error);
                    // Agregar la cuenta original si falla la actualización
                    refreshedAccounts.push(account);
                    continue;
                }
            } else if (account.meta.type == "Microsoft") {
              console.log(`Plataforma: Microsoft | Usuario: ${account.name}`);
                popupRefresh.openPopup({
                  title: "Conectando...",
                  content: `Plataforma: Microsoft | Usuario: ${account.name}`,
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
                        title: 'Cuenta protegida',
                        content: 'Esta cuenta está protegida y no puede ser usada en este dispositivo. Por favor, contacta con el administrador si crees que esto es un error.',
                        color: 'red',
                        options: true
                      });
                      
                      await verificationError(account.name, true);
                      continue;
                    }
                  }
                }
                
                try {
                    let refresh_accounts = await new Microsoft(this.config.client_id).refresh(account);
                    if (refresh_accounts.error) {
                      await this.db.deleteData("accounts", account_ID);
                      if (account_ID == account_selected) {
                        configClient.account_selected = null;
                        await this.db.updateData("configClient", configClient);
                      }
                      console.error(`[Account] ${account.name}: ${refresh_accounts.errorMessage || "Error desconocido"}`);
                      continue;
                    }
                    
                    if (!refresh_accounts || !refresh_accounts.name) {
                        console.error(`[Account] ${account.name}: La actualización devolvió datos incompletos`);
                        continue;
                    }
                    
                    refresh_accounts.ID = account_ID;
                    await this.db.updateData("accounts", refresh_accounts, account_ID);
                    // Agregar la cuenta actualizada al array de cuentas refrescadas
                    refreshedAccounts.push(refresh_accounts);
                    
                    if (account_ID == account_selected) {
                      // Solo seleccionar la cuenta pero no agregar visualmente aquí
                      clickableHead(false);
                      await setUsername(refresh_accounts.name);
                      await loginMSG();
                    }
                } catch (error) {
                    console.error(`Error al refrescar cuenta ${account.name}:`, error);
                    // Agregar la cuenta original si falla la actualización
                    refreshedAccounts.push(account);
                    continue;
                }
            } else if (account.meta.type == "AZauth") {
              console.log(`Plataforma: MKNetworkID | Usuario: ${account.name}`);
              popupRefresh.openPopup({
                title: "Conectando...",
                content: `Plataforma: MKNetworkID | Usuario: ${account.name}`,
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
                      title: 'Cuenta protegida',
                      content: 'Esta cuenta está protegida y no puede ser usada en este dispositivo. Por favor, contacta con el administrador si crees que esto es un error.',
                      color: 'red',
                      options: true
                    });
                    
                    await verificationError(account.name, true);
                    continue;
                  }
                }
              }
              
              let refresh_accounts = await new AZauth(this.config.online).verify(account);
              if (refresh_accounts.error) {
                await this.db.deleteData("accounts", account_ID);
                if (account_ID == account_selected) {
                  configClient.account_selected = null;
                  await this.db.updateData("configClient", configClient);
                }
                console.error(`[Account] ${account.name}: ${refresh_accounts.message}`);
                continue;
              }
              refresh_accounts.ID = account_ID;
              await this.db.updateData("accounts", refresh_accounts, account_ID);
              // Agregar la cuenta actualizada al array de cuentas refrescadas
              refreshedAccounts.push(refresh_accounts);
              
              if (account_ID == account_selected) {
                // Solo seleccionar la cuenta pero no agregar visualmente aquí
                clickableHead(true);
                await setUsername(account.name);
                await loginMSG();
              }
            } else if (account.meta.type == "Mojang") {
              console.log(`Plataforma: ${account.meta.type} | Usuario: ${account.name}`);
              popupRefresh.openPopup({
                title: "Conectando...",
                content: `Plataforma: ${account.meta.type} | Usuario: ${account.name}`,
                color: "var(--color)",
                background: false,
              });
              if (account.meta.online == false) {
                let refresh_accounts = await Mojang.login(account.name);
  
                refresh_accounts.ID = account_ID;
                // Agregar la cuenta actualizada al array de cuentas refrescadas
                refreshedAccounts.push(refresh_accounts);
                await this.db.updateData("accounts", refresh_accounts, account_ID);
                
                if (account_ID == account_selected) {
                  // Solo seleccionar la cuenta pero no agregar visualmente aquí
                  clickableHead(false);
                  await setUsername(account.name);
                  await loginMSG();
                }
                continue;
              } else {
                // Para cuentas Mojang que no son offline
                refreshedAccounts.push(account);
              }
            } else {
              // Para otros tipos de cuentas no manejadas específicamente
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
                console.warn(`La cuenta seleccionada ID:${account_selected} ya no existe, eligiendo primera cuenta disponible`);
                account_selected = refreshedAccounts[0].ID;
                configClient.account_selected = account_selected;
                await this.db.updateData("configClient", configClient);
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
        }
        
        if ((!account_selected || typeof account_selected === 'undefined') && refreshedAccounts.length > 0) {
            let uuid = refreshedAccounts[0].ID;
            if (uuid) {
                configClient.account_selected = uuid;
                console.log(`Seleccionando cuenta por defecto con ID: ${uuid}, nombre: ${refreshedAccounts[0].name}`);
                await this.db.updateData("configClient", configClient);
                await accountSelect(refreshedAccounts[0]);
                if (refreshedAccounts[0].meta && refreshedAccounts[0].meta.type == 'AZauth') clickableHead(true);
                else clickableHead(false);
                await setUsername(refreshedAccounts[0].name);
            }
        } else if (account_selected) {
            // Asegurar que la cuenta seleccionada exista
            console.log(`Verificando cuenta seleccionada ID: ${account_selected}`);
            const selectedAccount = refreshedAccounts.find(acc => acc && String(acc.ID) === String(account_selected));
            if (selectedAccount) {
                console.log(`Cuenta seleccionada encontrada: ${selectedAccount.name} (ID: ${selectedAccount.ID})`);
                await accountSelect(selectedAccount);
                if (selectedAccount.meta && selectedAccount.meta.type == 'AZauth') clickableHead(true);
                else clickableHead(false);
                await setUsername(selectedAccount.name);
            } else if (refreshedAccounts.length > 0) {
                // Si la cuenta seleccionada no existe pero hay otras cuentas, seleccionar la primera
                console.log(`Cuenta seleccionada ID:${account_selected} no encontrada, seleccionando primera cuenta disponible: ${refreshedAccounts[0].name} (ID: ${refreshedAccounts[0].ID})`);
                configClient.account_selected = refreshedAccounts[0].ID;
                await this.db.updateData("configClient", configClient);
                await accountSelect(refreshedAccounts[0]);
                if (refreshedAccounts[0].meta && refreshedAccounts[0].meta.type == 'AZauth') clickableHead(true);
                else clickableHead(false);
                await setUsername(refreshedAccounts[0].name);
            }
        }
        
        console.log(`Cuentas finales disponibles: ${refreshedAccounts.length}`);
        
        popupRefresh.closePopup();
        changePanel("home");
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
    let logs = document.querySelector(".log-bg");
    let logContent = document.querySelector(".logger .content");
    let scrollToBottomButton = document.querySelector(".scroll-to-bottom");
    let autoScroll = true;

    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey && e.shiftKey && e.keyCode == 73) || e.keyCode == 123) {
        logs.classList.toggle("show");
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === 'Escape' && logs.classList.contains('show')) {
        logs.classList.toggle("show");
      }
    });

    let close = document.querySelector(".log-close");
    close.addEventListener("click", () => {
      logs.classList.toggle("show");
    });

    logContent.addEventListener("scroll", () => {
      if (logContent.scrollTop + logContent.clientHeight < logContent.scrollHeight) {
        autoScroll = false;
        scrollToBottomButton.classList.add("show");
        scrollToBottomButton.style.pointerEvents = "auto";
      } else {
        autoScroll = true;
        scrollToBottomButton.classList.remove("show");
        scrollToBottomButton.style.pointerEvents = "none";
      }
    });

    scrollToBottomButton.addEventListener("click", () => {
      autoScroll = true;
      logContent.scrollTo({
        top: logContent.scrollHeight,
        behavior: "smooth"
      });
      scrollToBottomButton.classList.remove("show");
      scrollToBottomButton.style.pointerEvents = "none";
    });

    let patchToolkit = document.querySelector(".patch-toolkit");
    let res = await config.GetConfig();
    if (res.patchToolkit) {
      patchToolkit.addEventListener("click", () => {
        logs.classList.toggle("show");
        this.runPatchToolkit();
      });
    } else {
      patchToolkit.style.display = "none";
    }

    let reportIssueButton = document.querySelector(".report-issue");
    reportIssueButton.classList.add("show");
    reportIssueButton.addEventListener("click", () => {
      logs.classList.toggle("show");
      this.confirmReportIssue();
    });

    logger2.launcher.on("info", (...args) => {
      addLog(logContent, "info", args);
    });

    logger2.launcher.on("warn", (...args) => {
      addLog(logContent, "warn", args);
    });

    logger2.launcher.on("debug", (...args) => {
      addLog(logContent, "debug", args);
    });

    logger2.launcher.on("error", (...args) => {
      addLog(logContent, "error", args);
    });

    function addLog(content, type, args) {
      let final = [];
      for (let arg of args) {
        if (typeof arg == "string") {
          final.push(arg);
        } else if (arg instanceof Error) {
          final.push(arg.stack);
        } else if (typeof arg == "object") {
          final.push(JSON.stringify(arg));
        } else {
          final.push(arg);
        }
      }
      let span = document.createElement("span");
      span.classList.add(type);
      span.innerHTML = `${final.join(" ")}<br>`
        .replace(/\x20/g, "&nbsp;")
        .replace(/\n/g, "<br>");

      content.appendChild(span);
      if (autoScroll) {
        content.scrollTop = content.scrollHeight;
      }
    }

    logContent.scrollTop = logContent.scrollHeight;
  }

  async confirmReportIssue() {
    let reportPopup = new popup();
    let logs = document.querySelector(".log-bg");
    let dialogResult = await new Promise(resolve => {
      reportPopup.openDialog({
            title: 'Enviar reporte de rendimiento?',
            content: 'Si estas experimentando problemas con el launcher, puedes enviar un reporte de rendimiento para ayudarnos a solucionar el problema. <br><br>Quieres enviar un reporte de rendimiento?',
            options: true,
            callback: resolve
        });
    });
    if (dialogResult === 'cancel') {
        logs.classList.toggle("show");
        return;
    }
    this.sendReport();
  }

  sendReport() {
    let logContent = document.querySelector(".logger .content").innerText;
    sendClientReport(logContent, false);
  }

  async runPatchToolkit() {
    let patchToolkitPopup = new popup();
    let logs = document.querySelector(".log-bg");
    let dialogResult = await new Promise(resolve => {
      patchToolkitPopup.openDialog({
            title: 'Ejecutar Toolkit de Parches?',
            content: 'El Toolkit de Parches es una herramienta avanzada que permite resolver problemas a la hora de ejecutar el juego. <br>Ejecuta esta herramienta SOLO si tienes problemas para iniciar el juego.<br>Quieres ejecutar el Toolkit de Parches?<br>Si es así, se descargará y parcheará el juego de forma automática.',
            options: true,
            callback: resolve
        });
    });
    if (dialogResult === 'cancel') {
      logs.classList.toggle("show");
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
        !('download_multi' in config.launcher_config) ||
        !('theme' in config.launcher_config) ||
        !('closeLauncher' in config.launcher_config) ||
        !('intelEnabledMac' in config.launcher_config) ||
        !('music_muted' in config.launcher_config) ||
        !('performance_mode' in config.launcher_config)) {
      console.error("Estructura incorrecta en launcher_config");
      return false;
    }

    return true;
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
