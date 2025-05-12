/**
 * @author Luuxis
 * @license CC-BY-NC 4.0 - https://creativecommons.org/licenses/by-nc/4.0
 */

const { ipcRenderer, shell } = require('electron')
const { Status } = require('minecraft-java-core')
const fs = require('fs');
const path = require('path');
const pkg = require('../package.json');
const fetch = require('node-fetch');
const { marked, options } = require('marked');

import config from './utils/config.js';
import database from './utils/database.js';
import logger from './utils/logger.js';
import popup from './utils/popup.js';
import { skin2D } from './utils/skin.js';
import slider from './utils/slider.js';
import cleanupManager from './utils/cleanup-manager.js';
let username = '';
let DiscordUsername = '';
let DiscordPFP = '';
let musicAudio = new Audio();
let musicSource = '';
let isMusicPlaying = false;
let videoBusy = false;
const fadeDuration = 1000;
let performanceMode = false;

async function setPerformanceMode(mode) {
  performanceMode = mode;
  
  if (mode) {
    document.body.classList.add('performance-mode');
    console.log("Activando modo rendimiento - capturando primer frame de video");
    
    applyPerformanceModeStyleOverrides();
    
    const instanceBackground = document.querySelector('.server-status-icon')?.getAttribute('data-background');
    
    if (instanceBackground && instanceBackground.match(/^(http|https):\/\/[^ "]+$/)) {
        console.log("Using instance background for performance mode");
        await captureAndSetVideoFrame(instanceBackground);
    } else {
        await captureAndSetVideoFrame();
    }
    
    const loadingOverlay = document.querySelector('.loading-overlay');
    if (loadingOverlay && loadingOverlay.classList.contains('active')) {
      console.log("Forcing immediate style updates for loading overlay in performance mode");
      loadingOverlay.style.transition = 'none';
    }
  } else {
    document.body.classList.remove('performance-mode');
    
    removePerformanceModeStyleOverrides();
    
    const staticBackground = document.querySelector('.static-background');
    if (staticBackground) {
      staticBackground.remove();
    }
    
    const videoElements = document.querySelectorAll('.background-video');
    videoElements.forEach(video => {
      video.style.display = '';
    });
    
    console.log("Desactivando modo rendimiento - restaurando videos");
    
    const instanceBackground = document.querySelector('.server-status-icon')?.getAttribute('data-background');
    if (instanceBackground && instanceBackground.match(/^(http|https):\/\/[^ "]+$/)) {
        setVideoSource(instanceBackground);
    } else {
        setVideoSource();
    }
  }
  
  console.log(`Modo de rendimiento ${mode ? 'activado' : 'desactivado'}`);
}

function applyPerformanceModeStyleOverrides() {
  const panels = document.querySelectorAll('.panel');
  panels.forEach(panel => {
    panel.style.transition = 'none';
    panel.style.transitionProperty = 'none';
    panel.style.transitionDuration = '0s';
    panel.style.transitionDelay = '0s';
    
    if (panel.classList.contains('active')) {
      panel.style.opacity = '1';
      panel.style.maxHeight = '100vh';
    }
  });
  
  const settingsContainers = document.querySelectorAll('.container-settings');
  settingsContainers.forEach(container => {
    container.style.transition = 'none';
    container.style.transitionProperty = 'none';
    
    if (container.classList.contains('active-container-settings')) {
      container.style.opacity = '1';
      container.style.transform = 'translateX(0)';
    }
  });
  
  const settingsBtns = document.querySelectorAll('.nav-settings-btn');
  settingsBtns.forEach(btn => {
    btn.style.transition = 'none';
  });
  
  const settingsContent = document.querySelector('.settings-content');
  if (settingsContent) {
    settingsContent.style.transition = 'none';
  }
  
  const loadingOverlay = document.querySelector('.loading-overlay');
  if (loadingOverlay) {
    loadingOverlay.style.transition = 'none';
    if (loadingOverlay.classList.contains('active')) {
      loadingOverlay.style.opacity = '1';
      loadingOverlay.style.visibility = 'visible';
    } else {
      loadingOverlay.style.opacity = '0';
      loadingOverlay.style.visibility = 'hidden';
    }
  }
  
  console.log("Applying direct performance mode style overrides");
}

function removePerformanceModeStyleOverrides() {
  const panels = document.querySelectorAll('.panel');
  panels.forEach(panel => {
    panel.style.transition = '';
    panel.style.transitionProperty = '';
    panel.style.transitionDuration = '';
    panel.style.transitionDelay = '';
  });
  
  const settingsContainers = document.querySelectorAll('.container-settings');
  settingsContainers.forEach(container => {
    container.style.transition = '';
    container.style.transitionProperty = '';
    container.style.transform = '';
  });
  
  console.log("Removing direct performance mode style overrides");
}

function changePanel(id) {
    let panel = document.querySelector(`.${id}`);
    let active = document.querySelector(`.active`);
    
    if (performanceMode) {
        if (active) {
            active.classList.remove("active");
            active.style.opacity = "0";
            active.style.maxHeight = "0";
            active.style.visibility = "hidden";
            active.style.transition = "none";
            active.style.transitionProperty = "none";
        }
        panel.classList.add("active");
        panel.style.transition = "none";
        panel.style.transitionProperty = "none";
        panel.style.opacity = "1";
        panel.style.maxHeight = "100vh";
        panel.style.visibility = "visible";
    } else {
        if (active) {
            active.classList.remove("active");
            active.style.transition = "";
            active.style.opacity = "";
            active.style.maxHeight = "";
            active.style.visibility = "";
        }
        panel.classList.add("active");
        panel.style.transition = "";
        panel.style.visibility = "visible";
    }
}

function fileExists(filePath) {
  return new Promise((resolve) => {
    try {
      if (filePath.startsWith('./') || filePath.startsWith('../') || !filePath.includes('://')) {
        const absolutePath = new URL(filePath, window.location.href).href;
        const video = document.createElement('video');
        
        const timeoutId = setTimeout(() => {
          video.removeEventListener('loadedmetadata', handleLoad);
          video.removeEventListener('error', handleError);
          resolve(false);
        }, 2000);
        
        const handleLoad = () => {
          clearTimeout(timeoutId);
          video.remove();
          resolve(true);
        };
        
        const handleError = () => {
          clearTimeout(timeoutId);
          video.remove();
          resolve(false);
        };
        
        video.addEventListener('loadedmetadata', handleLoad);
        video.addEventListener('error', handleError);
        
        video.style.display = 'none';
        video.src = absolutePath;
        document.body.appendChild(video);
      } else {
        fetch(filePath, { method: 'HEAD' })
          .then(response => resolve(response.ok))
          .catch(() => resolve(false));
      }
    } catch (error) {
      console.error(`Error checking if file exists: ${error}`);
      resolve(false);
    }
  });
}

function isImageUrl(url) {
  if (!url) return false;
  
  // Verificar extensiones comunes de imágenes
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
  const lowerUrl = url.toLowerCase();
  
  // Si la URL termina con una extensión de imagen, es una imagen
  if (imageExtensions.some(ext => lowerUrl.endsWith(ext))) {
    return true;
  }
  
  // Comprobar si contiene parámetros que indican que es una imagen
  // Por ejemplo: imagen.php?type=jpg o cloudinary/image/upload
  if (lowerUrl.includes('image/') || 
      lowerUrl.includes('/img/') || 
      lowerUrl.includes('=jpg') || 
      lowerUrl.includes('=png') ||
      lowerUrl.includes('=webp')) {
    return true;
  }
  
  return false;
}

async function captureAndSetVideoFrame(customUrl = null) {
  return new Promise(async (resolve) => {
    try {
      // If we have a custom URL, mark it as an instance-specific background
      if (customUrl && customUrl.match(/^(http|https):\/\/[^ "]+$/)) {
        console.log(`Using instance-specific background for frame capture: ${customUrl}`);
        // Mark that we're using an instance-specific background and store the URL
        localStorage.setItem('hasInstanceBackground', 'true');
        localStorage.setItem('instanceBackgroundUrl', customUrl);
      } else if (!customUrl && localStorage.getItem('hasInstanceBackground') && !localStorage.getItem('forceBackgroundReset')) {
        // Don't override instance-specific background unless explicitly reset
        console.log("Instance-specific background detected, not overriding in captureAndSetVideoFrame");
        resolve();
        return;
      }
      
      const season = getSeason();
      const seasonalVideoPath = `./assets/images/background/${season}.mp4`;
      
      let configCustomVideoPath = null;
      if (!customUrl) {
        try {
          let res = await config.GetConfig();
          if (res.custom_background && res.custom_background.match(/^(http|https):\/\/[^ "]+$/)) {
            configCustomVideoPath = res.custom_background;
          }
        } catch (err) {
          console.error("Error fetching custom background from config:", err);
        }
      }
      
      // Use custom URL if provided, otherwise use config URL or seasonal video
      const backgroundPath = customUrl || configCustomVideoPath || seasonalVideoPath;
      
      const handleFallback = () => {
        console.log("Using fallback static background");
        setStaticBackground();
        resolve();
      };
      
      // Verificar si es una imagen en lugar de un video
      if (isImageUrl(backgroundPath)) {
        console.log("La URL proporcionada es una imagen, configurando como fondo estático");
        
        // Crear un nuevo elemento para el nuevo fondo estático
        let newStaticBackground = document.createElement('div');
        newStaticBackground.className = 'static-background new-background';
        newStaticBackground.style.position = 'fixed';
        newStaticBackground.style.top = '0';
        newStaticBackground.style.left = '0';
        newStaticBackground.style.width = '100%';
        newStaticBackground.style.height = '100%';
        newStaticBackground.style.backgroundSize = 'cover';
        newStaticBackground.style.backgroundPosition = 'center';
        newStaticBackground.style.backgroundRepeat = 'no-repeat';
        newStaticBackground.style.zIndex = '-1';
        // Start with opacity 0 but display block to ensure it's ready before transition starts
        newStaticBackground.style.opacity = '0';
        newStaticBackground.style.transition = 'opacity 1s ease';
        document.body.appendChild(newStaticBackground);
        
        // Cargar la imagen directamente
        const img = new Image();
        img.onload = function() {
          // Configurar la imagen en el nuevo fondo
          newStaticBackground.style.backgroundImage = `url('${backgroundPath}')`;
          
          // MEJORA: Iniciar el fade in del nuevo fondo - PERO PRIMERO esperar un tick para asegurar que la imagen se ha aplicado
          setTimeout(() => {
            // Primero mostramos la nueva imagen (antes de ocultar los videos)
            newStaticBackground.style.opacity = '1';
            
            // Esperar a que la nueva imagen sea visible antes de ocultar el video
            // Solo después de que la nueva imagen comience a aparecer, ocultamos los videos
            setTimeout(() => {
              // Ocultar los videos y el antiguo fondo si existen
              const videoElements = document.querySelectorAll('.background-video');
              videoElements.forEach(video => {
                if (!video.paused) {
                  video.pause();
                }
                video.style.transition = 'opacity 1s ease';
                video.style.opacity = '0';
                
                setTimeout(() => {
                  video.style.display = 'none';
                }, 1000);
              });
              
              // Fade out del fondo estático anterior
              const oldStaticBackground = document.querySelector('.static-background:not(.new-background)');
              if (oldStaticBackground) {
                oldStaticBackground.style.transition = 'opacity 1s ease';
                oldStaticBackground.style.opacity = '0';
                
                // Eliminar el fondo antiguo después de la transición
                setTimeout(() => {
                  oldStaticBackground.remove();
                  // Quitar la clase 'new-background' del nuevo fondo
                  newStaticBackground.classList.remove('new-background');
                }, 1000);
              } else {
                // Si no había fondo anterior, simplemente quitar la clase
                setTimeout(() => {
                  newStaticBackground.classList.remove('new-background');
                }, 1000);
              }
            }, 300); // Aumentado el retraso para asegurar que la imagen está completamente visible
          }, 50); // Pequeño retraso para asegurar que la imagen se ha aplicado correctamente
          resolve();
        };
        
        img.onerror = function() {
          console.error("Error loading image:", backgroundPath);
          newStaticBackground.remove();
          handleFallback();
        };
        
        img.src = backgroundPath;
        return;
      }
      
      const captureFrame = async (videoSrc) => {
        return new Promise((captureResolve) => {
          const tempVideo = document.createElement('video');
          tempVideo.style.display = 'none';
          document.body.appendChild(tempVideo);
          
          const timeoutId = setTimeout(() => {
            console.warn("Video loading timed out, using fallback");
            tempVideo.remove();
            captureResolve(null);
          }, 5000);
          
          tempVideo.addEventListener('error', () => {
            clearTimeout(timeoutId);
            console.error(`Error loading video: ${videoSrc}`);
            tempVideo.remove();
            captureResolve(null);
          });
          
          tempVideo.addEventListener('loadeddata', async () => {
            clearTimeout(timeoutId);
            try {
              await new Promise(r => setTimeout(r, 200));
              
              await tempVideo.play();
              tempVideo.pause();
              
              const canvas = document.createElement('canvas');
              canvas.width = tempVideo.videoWidth;
              canvas.height = tempVideo.videoHeight;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(tempVideo, 0, 0, canvas.width, canvas.height);
              
              const frameDataUrl = canvas.toDataURL('image/jpeg', 0.9);
              tempVideo.remove();
              captureResolve(frameDataUrl);
            } catch (err) {
              console.error("Error capturing video frame:", err);
              tempVideo.remove();
              captureResolve(null);
            }
          });
          
          tempVideo.crossOrigin = "anonymous";
          tempVideo.preload = "auto";
          tempVideo.src = videoSrc;
          tempVideo.load();
        });
      };
      
      const videoSources = [
        backgroundPath,
        './assets/images/background/default.mp4'
      ].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);
      
      let frameDataUrl = null;
      
      for (const src of videoSources) {
        frameDataUrl = await captureFrame(src);
        if (frameDataUrl) {
          break;
        }
      }
      
      if (!frameDataUrl) {
        console.warn("Failed to capture frame from any video source");
        return handleFallback();
      }
      
      // Crear un nuevo fondo con transición
      let newStaticBackground = document.createElement('div');
      newStaticBackground.className = 'static-background new-background';
      newStaticBackground.style.position = 'fixed';
      newStaticBackground.style.top = '0';
      newStaticBackground.style.left = '0';
      newStaticBackground.style.width = '100%';
      newStaticBackground.style.height = '100%';
      newStaticBackground.style.backgroundSize = 'cover';
      newStaticBackground.style.backgroundPosition = 'center';
      newStaticBackground.style.backgroundRepeat = 'no-repeat';
      newStaticBackground.style.zIndex = '-1';
      newStaticBackground.style.opacity = '0';
      newStaticBackground.style.transition = 'opacity 1s ease';
      newStaticBackground.style.backgroundImage = `url('${frameDataUrl}')`;
      document.body.appendChild(newStaticBackground);
      
      // MEJORA: Realizar un crossfade entre el fondo antiguo y el nuevo
      setTimeout(() => {
        // Fade in del nuevo fondo
        newStaticBackground.style.opacity = '1';
        
        // Fade out de los videos y el viejo fondo
        const videoElements = document.querySelectorAll('.background-video');
        videoElements.forEach(video => {
          if (!video.paused) {
            video.pause();
          }
          video.style.transition = 'opacity 1s ease';
          video.style.opacity = '0';
          
          setTimeout(() => {
            video.style.display = 'none';
          }, 1000);
        });
        
        // Fade out del fondo estático anterior
        const oldStaticBackground = document.querySelector('.static-background:not(.new-background)');
        if (oldStaticBackground) {
          oldStaticBackground.style.transition = 'opacity 1s ease';
          oldStaticBackground.style.opacity = '0';
          
          setTimeout(() => {
            oldStaticBackground.remove();
            newStaticBackground.classList.remove('new-background');
          }, 1000);
        } else {
          setTimeout(() => {
            newStaticBackground.classList.remove('new-background');
          }, 1000);
        }
      }, 0);
      
      resolve();
    } catch (err) {
      console.error("Error in captureAndSetVideoFrame:", err);
      setStaticBackground();
      resolve();
    }
  });
}

function setStaticBackground() {
  const season = getSeason();
  let staticBackground = document.querySelector('.static-background');
  
  if (!staticBackground) {
    staticBackground = document.createElement('div');
    staticBackground.className = 'static-background';
    staticBackground.style.position = 'fixed';
    staticBackground.style.top = '0';
    staticBackground.style.left = '0';
    staticBackground.style.width = '100%';
    staticBackground.style.height = '100%';
    staticBackground.style.backgroundSize = 'cover';
    staticBackground.style.backgroundPosition = 'center';
    staticBackground.style.backgroundRepeat = 'no-repeat';
    staticBackground.style.zIndex = '-1';
    document.body.appendChild(staticBackground);
  }
  
  const checkImageExists = (url) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = url;
    });
  };
  
  (async () => {
    const imagePaths = [
      `assets/images/background/${season}.jpg`,
      'assets/images/background/default.png'
    ];
    
    let imageFound = false;
    for (const path of imagePaths) {
      if (await checkImageExists(path)) {
        console.log(`Using static background: ${path}`);
        staticBackground.style.backgroundImage = `url('${path}')`;
        imageFound = true;
        break;
      }
    }
    
    if (!imageFound) {
      console.warn("No background images found, using fallback color");
      staticBackground.style.backgroundImage = 'none';
      staticBackground.style.backgroundColor = '#121212';
    }
  })();
}

async function setBackground() {
    // Check if there's already a static background or a video background set
    const staticBackground = document.querySelector('.static-background');
    const videoBackground = document.querySelector('.background-video.current[style*="opacity: 1"]');
    
    // If there's already a visible background, don't override it
    if (staticBackground && staticBackground.style.opacity !== "0" && 
        staticBackground.style.backgroundImage && staticBackground.style.backgroundImage !== "none" ||
        videoBackground) {
        console.log("Background already set, not applying default background");
        return;
    }
    
    let body = document.body;
    body.className = 'dark global';
    body.style.backgroundImage = `linear-gradient(#00000080, #00000080), url(./assets/images/background/default.png)`;
    body.style.backgroundSize = 'cover';
}

let currentVideo = document.querySelector('.background-video.current');
let nextVideo = document.querySelector('.background-video.next');
async function setVideoSource(game = '') {
    const db = new database();
    let configClient = await db.readData('configClient');
    
    // If this is an instance-specific background, mark it as such
    if (game) {
        localStorage.setItem('hasInstanceBackground', 'true');
    } else if (localStorage.getItem('forceBackgroundReset') === 'true') {
        // If we're forcing a background reset, clear the instance flag
        localStorage.removeItem('hasInstanceBackground');
        localStorage.removeItem('forceBackgroundReset');
    }
    
    if (configClient && configClient.launcher_config.performance_mode) {
        await captureAndSetVideoFrame(game ? game : null);
        return;
    }
    
    // Block multiple simultaneous calls to prevent transition issues
    if (videoBusy) {
        console.log('Video transition already in progress, skipping');
        return;
    }
    videoBusy = true;
    
    let source;
    let sourcePromise = new Promise(async (resolve) => {
      if (game) {
          source = `${game}`;
          // Mark that we've set an instance-specific background
          localStorage.setItem('hasInstanceBackground', 'true');
          resolve();
      } else {
          // If we're trying to set a non-instance background but already have an instance background,
          // don't override it unless explicitly reset
          if (localStorage.getItem('hasInstanceBackground') && !localStorage.getItem('forceBackgroundReset')) {
              source = null;
              resolve();
              return;
          }
          // Clear the instance background flag when explicitly setting a non-instance background
          localStorage.removeItem('hasInstanceBackground');
          
          let res = await config.GetConfig();
          if (res.custom_background && res.custom_background.match(/^(http|https):\/\/[^ "]+$/)) {
              source = res.custom_background;
              resolve();
          } else {
              const season = getSeason();
              const seasonVideoExists = await fileExists(`./assets/images/background/${season}.mp4`);
              if (seasonVideoExists) {
                  source = `./assets/images/background/${season}.mp4`;
              } else {
                  console.warn(`Season video for ${season} not found, trying default background`);
                  const defaultVideoExists = await fileExists('./assets/images/background/default.mp4');
                  if (defaultVideoExists) {
                      source = './assets/images/background/default.mp4';
                  } else {
                      console.warn('Default video not found, falling back to static background');
                      setStaticBackground();
                  }
              }
              resolve();
          }
      }
    });
    
    // Ensure we always have at least some time to prepare the transition
    let timeoutPromise = new Promise(resolve => setTimeout(resolve, 500));
    await Promise.all([sourcePromise, timeoutPromise]);

    // If we tried to set a non-instance background but already have an instance background set,
    // and we're not forcing a reset, then skip changing the background
    if (!game && localStorage.getItem('hasInstanceBackground') && !source) {
      console.log('Manteniendo fondo de instancia actual');
      videoBusy = false;
      return;
    }

    if (!source) {
      console.error('No se pudo establecer la fuente del video: source está indefinida');
      setStaticBackground();
      videoBusy = false;
      return;
    }
    
    // Remove any forced background reset flag if it was set
    localStorage.removeItem('forceBackgroundReset');

    // Comprobar si la fuente es una imagen
    if (isImageUrl(source)) {
      console.log('Usando imagen como fondo:', source);
      
      // Crear o actualizar el fondo estático con la imagen
      let staticBackground = document.querySelector('.static-background');
      const needNewBackground = !staticBackground;
      
      if (needNewBackground) {
        staticBackground = document.createElement('div');
        staticBackground.className = 'static-background';
        staticBackground.style.position = 'fixed';
        staticBackground.style.top = '0';
        staticBackground.style.left = '0';
        staticBackground.style.width = '100%';
        staticBackground.style.height = '100%';
        staticBackground.style.backgroundSize = 'cover';
        staticBackground.style.backgroundPosition = 'center';
        staticBackground.style.backgroundRepeat = 'no-repeat';
        staticBackground.style.zIndex = '-1';
        staticBackground.style.opacity = '0';
        staticBackground.style.transition = 'opacity 1s ease';
        document.body.appendChild(staticBackground);
      } else {
        // Si ya existe un fondo estático, asegurarse de que sea visible
        staticBackground.style.display = '';
      }
      
      // Cargar la imagen primero y verificar que se carga correctamente
      const img = new Image();
      img.onload = function() {
        // Configurar la imagen de fondo primero, antes de hacer cualquier cambio de opacidad
        staticBackground.style.backgroundImage = `url('${source}')`;

        // Pequeño retraso para asegurarnos que la imagen se ha renderizado correctamente
        setTimeout(() => {
          // PRIMERO mostramos la imagen de fondo
          staticBackground.style.opacity = '1';
          
          // DESPUÉS de mostrar la imagen (con un retraso mayor), ocultamos los videos
          // Este retraso es crucial para evitar el parpadeo del fondo de respaldo
          setTimeout(() => {
            // Asegurar que todos los videos se detienen y ocultan correctamente
            const videoElements = document.querySelectorAll('.background-video');
            videoElements.forEach(video => {
              if (!video.paused) {
                try {
                  video.pause();
                } catch (e) {
                  console.warn('Error pausing video:', e);
                }
              }
              video.style.transition = 'opacity 1s ease';
              video.style.opacity = '0';
              
              setTimeout(() => {
                video.style.display = 'none';
                video.src = ''; // Limpiar la fuente para liberar recursos
              }, 1000);
            });
            
            // Liberar el flag después de asegurar que la transición ha finalizado
            setTimeout(() => {
              videoBusy = false;
              console.log('Transition to image background completed');
            }, 1200);
          }, 300); // Aumentamos el retraso para asegurar que la imagen esté completamente visible
        }, 50); // Pequeño retraso para asegurar que la imagen se ha aplicado al fondo
      };
      
      img.onerror = function() {
        console.error('Error al cargar la imagen de fondo:', source);
        setStaticBackground();
        videoBusy = false;
      };
      
      img.src = source;
    } else {
      // Es un video, usar el flujo normal
      console.log('Usando video como fondo:', source);
      
      // Ensure video elements exist and are properly configured
      if (!currentVideo || !nextVideo) {
        console.log('Initializing video elements');
        
        // Find or create video elements
        currentVideo = document.querySelector('.background-video.current');
        nextVideo = document.querySelector('.background-video.next');
        
        if (!currentVideo) {
          currentVideo = document.createElement('video');
          currentVideo.className = 'background-video current';
          currentVideo.playsInline = true;
          currentVideo.autoplay = true;
          currentVideo.muted = true;
          currentVideo.loop = true;
          currentVideo.style.position = 'fixed';
          currentVideo.style.top = '0';
          currentVideo.style.left = '0';
          currentVideo.style.width = '100%';
          currentVideo.style.height = '100%';
          currentVideo.style.objectFit = 'cover';
          currentVideo.style.zIndex = '-1';
          document.body.appendChild(currentVideo);
        }
        
        if (!nextVideo) {
          nextVideo = document.createElement('video');
          nextVideo.className = 'background-video next';
          nextVideo.playsInline = true;
          nextVideo.autoplay = false;
          nextVideo.muted = true;
          nextVideo.loop = true;
          nextVideo.style.position = 'fixed';
          nextVideo.style.top = '0';
          nextVideo.style.left = '0';
          nextVideo.style.width = '100%';
          nextVideo.style.height = '100%';
          nextVideo.style.objectFit = 'cover';
          nextVideo.style.zIndex = '-1';
          nextVideo.style.opacity = '0';
          document.body.appendChild(nextVideo);
        }
      }
      
      // Ensure videos are visible before starting transitions
      currentVideo.style.display = '';
      nextVideo.style.display = '';
      
      try {
        // Preparar la transición del video
        console.log('Preparing video transition');
        
        // Reset nextVideo properties
        nextVideo.style.transition = '';
        nextVideo.style.opacity = '0';
        
        // Load the new source into nextVideo
        nextVideo.src = source;
        nextVideo.load();
        
        // Wait for the video to be ready to play
        await new Promise((resolve, reject) => {
          const onCanPlay = () => {
            nextVideo.removeEventListener('canplay', onCanPlay);
            clearTimeout(timeoutId);
            resolve();
          };
          
          const timeoutId = setTimeout(() => {
            nextVideo.removeEventListener('canplay', onCanPlay);
            console.warn('Video loading timed out, trying to continue anyway');
            resolve();
          }, 5000);
          
          nextVideo.addEventListener('canplay', onCanPlay);
          
          nextVideo.addEventListener('error', (e) => {
            clearTimeout(timeoutId);
            nextVideo.removeEventListener('canplay', onCanPlay);
            console.error('Error loading video:', e);
            reject(e);
          }, { once: true });
        });
        
        // Start playing the video before making it visible
        try {
          await nextVideo.play();
        } catch (e) {
          console.error('Failed to play video:', e);
          throw e;
        }
        
        // Fade in the next video
        console.log('Transitioning to new video');
        nextVideo.style.transition = 'opacity 1.5s ease';
        nextVideo.style.opacity = '1';
        
        // Wait for fade-in to complete
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Hide the static background
        const staticBackground = document.querySelector('.static-background');
        if (staticBackground) {
          staticBackground.style.transition = 'opacity 1.5s ease';
          staticBackground.style.opacity = '0';
          
          // Delay hiding it completely to ensure smooth transition
          setTimeout(() => {
            staticBackground.style.display = 'none';
          }, 1500);
        }
        
        // If there's a current video playing, fade it out
        if (currentVideo && currentVideo.style.opacity !== '0') {
          currentVideo.style.transition = 'opacity 1.5s ease';
          currentVideo.style.opacity = '0';
          
          // Complete the transition
          setTimeout(() => {
            if (!currentVideo.paused) {
              try {
                currentVideo.pause();
              } catch (e) {
                console.warn('Error pausing current video:', e);
              }
            }
            
            // Swap the videos for next transition
            const temp = currentVideo;
            currentVideo = nextVideo;
            nextVideo = temp;
            
            // Reset nextVideo for future transitions
            nextVideo.src = '';
            
            // Release the busy flag
            videoBusy = false;
            console.log('Video transition completed');
          }, 1700);
        } else {
          // If there's no current video active, just update references
          const temp = currentVideo;
          currentVideo = nextVideo;
          nextVideo = temp;
          
          // Reset nextVideo for future transitions
          nextVideo.src = '';
          
          // Release the busy flag
          videoBusy = false;
          console.log('Initial video transition completed');
        }
      } catch (err) {
        console.error('Error during video transition:', err);
        
        // Fallback to static background
        setStaticBackground();
        
        // Ensure all videos are properly cleaned up
        const videoElements = document.querySelectorAll('.background-video');
        videoElements.forEach(video => {
          try {
            if (!video.paused) video.pause();
            video.src = '';
            video.style.opacity = '0';
          } catch (e) {
            console.warn('Error cleaning up video element:', e);
          }
        });
        
        // Release the busy flag
        videoBusy = false;
      }
    }
}

function getSeason() {
    const now = new Date();
    const month = now.getMonth() + 1; 
    let season;

    switch (month) {
        case 3:
        case 4:
        case 5:
            season = 'spring';
            break;
        case 6:
        case 7:
        case 8:
            season = 'summer';
            break;
        case 9:
        case 10:
        case 11:
            season = 'autumn';
            break;
        case 12:
        case 1:
        case 2:
            season = 'winter';
            break;
        default:
            season = 'winter';
            break;
    }

    return season;
}

async function appdata() {
    return await ipcRenderer.invoke('appData').then(path => path)
}

async function addAccount(data) {
    let skin = false
    if (data?.profile?.skins[0]?.base64) skin = await new skin2D().creatHeadTexture(data.profile.skins[0].base64);
    else {
        try {
            if (data?.name) {
                let response = await fetch(`https://mineskin.eu/helm/${data.name}`);
                if (response.ok) skin = `https://mineskin.eu/helm/${data.name}`;
                else skin = false;
            }
        } catch (error) {
            skin = false;
        }
    }
    let div = document.createElement("div");
    div.classList.add("account");
    div.id = data.ID;
    div.innerHTML = `
        <div class="profile-image" ${skin ? 'style="background-image: url(' + skin + ');"' : ''}></div>
        <div class="profile-infos">
            <div class="profile-pseudo">${data.name}</div>
            <div class="profile-uuid">${data.uuid}</div>
        </div>
        <div class="delete-profile" id="${data.ID}">
            <div class="icon-account-delete delete-profile-icon"></div>
        </div>
    `
    return document.querySelector('.accounts-list').appendChild(div);
}

async function accountSelect(data) {
    let account = document.getElementById(`${data.ID}`);
    let activeAccount = document.querySelector('.account-select')

    if (activeAccount) activeAccount.classList.toggle('account-select');
    if (account) account.classList.add('account-select');
    if (data?.profile?.skins[0]?.base64) headplayer(data.profile.skins[0].base64); 
    else if (data?.name) {
        let img = new Image();
        img.onerror = function() {
            console.warn("Error al cargar la imagen de la cabeza del jugador, se cargará la imagen por defecto");
            document.querySelector(".player-head").style.backgroundImage = 'url("assets/images/default/steve.png")';
        }
        img.onload = function() {
            document.querySelector(".player-head").style.backgroundImage = `url(${img.src})`;
        }
        img.src = `https://mineskin.eu/helm/${data.name}`;
    }
    setUsername(data.name);
    /* if (data.name) document.querySelector('.player-name').innerHTML = data.name; */
    
    // Update clickable head function with the full account data
    clickableHead(data);
}


async function headplayer(skinBase64) {
    let skin = await new skin2D().creatHeadTexture(skinBase64);
    document.querySelector(".player-head").style.backgroundImage = `url(${skin})`;
}

async function clickableHead(account) {
    let playerHead = document.querySelector('.player-options');
    let playerHeadFrame = document.querySelector('.head-frame');
    
    // Siempre habilitar el clic en la cabeza del jugador
    playerHead.style.cursor = 'pointer';
    playerHead.classList.add('hoverenabled');
    playerHeadFrame.classList.add('border-animation');
}

async function getClickeableHead() {
    return true; // Siempre retornar true
}

async function clickHead() {
    // Siempre cambiar al panel de skins cuando se hace clic
    changePanel("skins");
}

async function setStatus(opt) {
    let instanceIcon = document.querySelector('.server-status-icon')
    let nameServerElement = document.querySelector('.server-status-name')
    let statusServerElement = document.querySelector('.server-status-text')
    let playersOnline = document.querySelector('.status-player-count .player-count')

    if (!opt) {
        instanceIcon.src = './assets/images/icon.png'
        statusServerElement.classList.add('red')
        statusServerElement.innerHTML = `Offline - 0 ms`
        document.querySelector('.status-player-count').classList.add('red')
        playersOnline.innerHTML = '0'
        return
    }
    instanceIcon.src = opt.icon || './assets/images/icon.png'
    let { ip, port, nameServer } = opt.status
    nameServerElement.innerHTML = nameServer
    let status = new Status(ip, port);
    let statusServer = await status.getStatus().then(res => res).catch(err => err);
    

    if (!statusServer.error) {
        statusServerElement.classList.remove('red')
        document.querySelector('.status-player-count').classList.remove('red')
        statusServerElement.innerHTML = `Online - ${statusServer.ms} ms`
        playersOnline.innerHTML = statusServer.playersConnect
    } else {
        statusServerElement.classList.add('red')
        statusServerElement.innerHTML = `Offline - 0 ms`
        document.querySelector('.status-player-count').classList.add('red')
        playersOnline.innerHTML = '0'
    }
}

async function setInstanceBackground(opt) {
    let instancebackground = opt
    if (instancebackground && instancebackground.match(/^(http|https):\/\/[^ "]+$/)) {
        // Store the instance background URL in localStorage for persistence
        localStorage.setItem('hasInstanceBackground', 'true');
        localStorage.setItem('instanceBackgroundUrl', instancebackground);
        
        const db = new database();
        let configClient = await db.readData('configClient');
        
        if (configClient && configClient.launcher_config.performance_mode) {
            console.log(`Capturing frame from instance background: ${instancebackground}`);
            await captureAndSetVideoFrame(instancebackground);
        } else {
            setVideoSource(instancebackground);
        }
    } else {
        // If no instance background is provided, use the default background
        localStorage.removeItem('hasInstanceBackground');
        localStorage.removeItem('instanceBackgroundUrl');
        
        if (performanceMode) {
            await captureAndSetVideoFrame();
        } else {
            setVideoSource();
        }
    }
}

async function setBackgroundMusic(opt) {
    let music = opt
    if (music === undefined) {
        setMusicSource()
    } else if (music.match(/^(http|https):\/\/[^ "]+$/)) {
        setMusicSource(music)
    } else {
        setMusicSource()
    }
}

async function getUsername() {
    return username;
}
async function setUsername(name) {
    username = name;
}

async function getDiscordUsername() {
    return DiscordUsername;
}
async function setDiscordUsername(name) {
    DiscordUsername = name;
}

async function getDiscordPFP() {
    return DiscordPFP;
}

async function setDiscordPFP(pfp) {
    DiscordPFP = pfp;
}

async function toggleModsForInstance(instanceName) {
    const instances = await config.getInstanceList();
    const instance = instances.find(i => i.name === instanceName);
    const db = new database();

    if (instance) {
        for (const mod of instance.optionalMods) {
            let configClient = await db.readData('configClient')
            const activeModsForInstance = configClient.mods_enabled.filter(modId => {
                const [modIdInstanceName, modIdModName] = modId.split('-');
                return modIdInstanceName === instanceName;
            }).map(modId => {
                const [, modIdModName] = modId.split('-');
                return modIdModName;
            });

            const modFile = instance.optionalMods.find(m => m.name === mod.name).file;
            const modIsActiveInConfig = activeModsForInstance.includes(mod.name);
            await toggleMod(modFile, instanceName, modIsActiveInConfig);
        }
    } else {
        console.error(`Instance with name ${instanceName} not found`);
    }
}

async function toggleMod(modFile, instanceName, isActive) {
    if (isActive) {
        console.log(`Activando mod opcional, Mod: ${modFile} Instancia: ${instanceName}`);
    } else {
        console.log(`Desactivando mod opcional, Mod: ${modFile} Instancia: ${instanceName}`);
    }
    let res = await config.GetConfig();
    const appdataPath = await appdata();
    const modPath = path.join(
        appdataPath,
        process.platform == 'darwin' ? await res.dataDirectory : `.${await res.dataDirectory}`,
        'instances',
        instanceName,
        'mods',
        modFile
    );
    console.log(modPath);
    const activeModPath = `${modPath}.jar`;
    const disabledModPath = `${modPath}.disabled`;
    

    if (!fs.existsSync(activeModPath) && !fs.existsSync(disabledModPath)) {
        console.warn(`No se ha encontrado el mod opcional a modificar, Saltando... Mod: ${modFile}`);
        return;
    }
    

    if (isActive && fs.existsSync(disabledModPath)) {
        fs.renameSync(disabledModPath, activeModPath);
    }

    else if (!isActive && fs.existsSync(activeModPath)) {
        fs.renameSync(activeModPath, disabledModPath);
    }
}

async function discordAccount() {
    let discordLogoutBtn = document.querySelector('.discord-logout-btn');
    let discordAccountManagerTitle = document.querySelector('#discord-account-manager-title');
    let discordAccountManagerPanel = document.querySelector('#discord-account-manager');
    let discordUsername = await getDiscordUsername();
    let discordUsernameText = document.querySelector('.profile-username');
    let discordPFP = await getDiscordPFP();
    let discordPFPElement = document.querySelector('.discord-profile-image');
    let discordAccountColumn = document.querySelector('#discord-account-column');
    // Obtener la columna de cuentas de Minecraft (es el hermano siguiente del discord-account-column)
    let minecraftAccountColumn = document.querySelector('#discord-account-column + .settings-column');

    if (discordUsername !== '') {
        discordUsernameText.textContent = discordUsername;
        discordPFPElement.src = discordPFP;
        // Asegurarse de que las columnas tengan el ancho normal cuando hay cuenta de Discord
        if (discordAccountColumn) discordAccountColumn.style.width = '45%';
        if (minecraftAccountColumn) minecraftAccountColumn.style.width = '45%';
    } else {
        discordAccountManagerTitle.style.display = 'none';
        discordAccountManagerPanel.style.display = 'none';
        // Ocultar completamente la columna de Discord
        if (discordAccountColumn) discordAccountColumn.style.display = 'none';
        // Expandir la columna de Minecraft para ocupar todo el ancho
        if (minecraftAccountColumn) minecraftAccountColumn.style.width = '100%';
    }
}

async function getTermsAndConditions() {
    try {
        console.log('Iniciando descarga de términos y condiciones...');
        const termsResponse = await fetch(`${pkg.url}launcher/config-launcher/terms.txt`);
        const metaResponse = await fetch(`${pkg.url}launcher/config-launcher/terms-meta.json`);
        

        if (!termsResponse.ok) {
            console.error('Error al obtener términos:', termsResponse.statusText);
            throw new Error(`Error al obtener términos: ${termsResponse.statusText}`);
        }

        if (!metaResponse.ok) {
            console.error('Error al obtener meta información:', metaResponse.statusText);
            throw new Error(`Error al obtener meta información: ${metaResponse.statusText}`);
        }

        const termsContent = await termsResponse.text();
        const metaInfo = await metaResponse.json();

        const htmlContent = marked(termsContent);
        const lastModified = metaInfo.lastModified || 'desconocida';

        return { htmlContent, lastModified };
    } catch (error) {
        console.error('Error al inicializar los términos y condiciones:', error.message);
        throw error;
    }
}

async function showTermsAndConditions() {
    try {
        const result = await getTermsAndConditions();
        const db = new database();
        let configClient = await db.readData('configClient');
        const lastModified = new Date(result.lastModified);

        let isNewUser = false;

        if (!configClient.terms_accepted || !configClient.termsAcceptedDate) {
            console.log("No se han aceptado los términos anteriormente. Usuario nuevo.");
            isNewUser = true;
        } else {
            const termsAcceptedDate = new Date(configClient.termsAcceptedDate);

            if (termsAcceptedDate < lastModified) {
                console.log("Términos modificados, solicitando aceptación nuevamente.");
            } else {
                console.log("Términos ya aceptados y no han sido modificados.");
                return true;
            }
        }

        return new Promise((resolve, reject) => {
            const termsContainer = document.querySelector('.terms-container');
            const acceptButton = document.querySelector('.accept-terms-btn');
            const declineButton = document.querySelector('.decline-terms-btn');
            const messageText = document.querySelector('.terms-message');

            if (isNewUser) {
                messageText.innerText = "Bienvenido. Antes de continuar, acepta los términos y condiciones para poder utilizar el software. De lo contrario, el launcher se cerrará y no podrás utilizarlo hasta que los aceptes.";
            } else {
                messageText.innerText = "Los términos y condiciones han sido modificados y debes aceptarlos para seguir usando el lanzador.";
            }

            termsContainer.innerHTML = result.htmlContent;
            termsContainer.querySelectorAll('a').forEach(link => {
                link.addEventListener('click', (event) => {
                    event.preventDefault();
                    const url = event.target.href;
                    shell.openExternal(url);
                });
            });

            acceptButton.disabled = true;

            document.querySelector('.terms-modal').style.display = 'flex';

            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        acceptButton.disabled = false;
                        observer.disconnect();
                    }
                });
            }, { threshold: 1.0 });

            const lastElement = termsContainer.lastElementChild;
            if (lastElement) {
                observer.observe(lastElement);
            }

            acceptButton.addEventListener('click', async () => {
                document.querySelector('.terms-modal').style.display = 'none';

                configClient.terms_accepted = true;
                configClient.termsAcceptedDate = new Date().toISOString();
                await db.updateData('configClient', configClient);

                resolve(true);  
            });

            declineButton.addEventListener('click', () => {
              quitAPP();
                reject(false);
            });
        });
    } catch (error) {
        console.error('Error al cargar los términos y condiciones:', error);
        throw error;
    }
}

async function setMusicSource(source) {
    let res = await config.GetConfig();
    let dev = process.env.NODE_ENV === 'dev';
    if (!res.musicBeta && !dev) return;
    if (source === undefined || source === '' || source === 'none') {
        if (res.custom_music.match(/^(http|https):\/\/[^ "]+$/)) {
            source = res.custom_music;
        } else {
        source = './assets/sounds/music/default-music.mp3';
        }
    }
    if (musicSource === source) return;
    musicSource = source;

    const db = new database();
    const configClient = await db.readData('configClient');

    if (isMusicPlaying) await fadeOutAudio();

    musicAudio.muted = configClient.launcher_config.music_muted;
    musicAudio.src = source;
    musicAudio.loop = true;
    musicAudio.volume = 0;
    musicAudio.disableRemotePlayback = true;

    navigator.mediaSession.setActionHandler('play', null);
    navigator.mediaSession.setActionHandler('pause', null);
    navigator.mediaSession.setActionHandler('seekbackward', null);
    navigator.mediaSession.setActionHandler('seekforward', null);
    navigator.mediaSession.setActionHandler('previoustrack', null);
    navigator.mediaSession.setActionHandler('nexttrack', null);

    if (musicAudio.muted) {
        musicAudio.play();
    } else {
        musicAudio.play().then(() => fadeInAudio());
    }

    isMusicPlaying = true;
}


function fadeInAudio() {
    let volume = 0;
    const maxVolume = 0.008;
    const interval = setInterval(() => {
        volume += 0.0005;
        if (volume >= maxVolume) {
            musicAudio.volume = maxVolume;
            clearInterval(interval);
        } else {
            musicAudio.volume = volume;
        }
    }, fadeDuration / 25);
}

function fadeOutAudio() {
    return new Promise((resolve) => {
        let volume = musicAudio.volume;
        const interval = setInterval(() => {
            volume -= 0.0005;
            if (volume <= 0) {
                musicAudio.volume = 0;
                musicAudio.pause();
                clearInterval(interval);
                resolve();
            } else {
                musicAudio.volume = volume;
            }
        }, fadeDuration / 25);
    });
}

async function toggleMusic() {
    const db = new database();
    let configClient = await db.readData('configClient');

    if (configClient.launcher_config.music_muted) {
        document.querySelector('.music-btn').classList.remove('icon-speaker-off');
        document.querySelector('.music-btn').classList.add('icon-speaker-on');
        configClient.launcher_config.music_muted = false;
        musicAudio.muted = false;
        await db.updateData('configClient', configClient);
        await fadeInAudio();
        
        if (!isMusicPlaying) {
            await musicAudio.play();
            isMusicPlaying = true;
        }
    } else {
        document.querySelector('.music-btn').classList.remove('icon-speaker-on');
        document.querySelector('.music-btn').classList.add('icon-speaker-off');
        configClient.launcher_config.music_muted = true;
        await db.updateData('configClient', configClient);
        await fadeOutAudio();
        isMusicPlaying = false;
    }
}

function isPerformanceModeEnabled() {
  return performanceMode;
}

async function patchLoader() {
  try {
    const patchPopup = new popup();
    patchPopup.openPopup({
      title: "Toolkit de Parches",
      content: "Iniciando proceso de parcheo...",
      color: "var(--color)",
      background: true
    });

    const res = await config.GetConfig();
    const dataDir = process.platform == 'darwin' ? res.dataDirectory : `.${res.dataDirectory}`;
    const baseFolder = await appdata();
    const dataFolder = path.join(baseFolder, dataDir);
    
    if (!fs.existsSync(dataFolder)) {
      console.error("Error: El directorio de datos no existe:", dataFolder);
      patchPopup.closePopup();
      
      new popup().openPopup({
        title: "Error al iniciar el Toolkit de Parches",
        content: "No se puede iniciar un parche al no existir la carpeta de assets. Por favor, prueba a iniciar el juego antes de intentar parchear.",
        color: "red",
        background: true,
        options: true
      });
      
      return;
    }
    
    const cacheFolder = path.join(baseFolder, dataDir, 'cache');
    
    console.log(`Directorio de caché: ${cacheFolder}`);

    if (!fs.existsSync(cacheFolder)) {
      console.log("Creando directorio de caché...");
      fs.mkdirSync(cacheFolder, { recursive: true });
    }

    // Prepare patch download
    const patchFilePath = path.join(cacheFolder, 'Patch.zip');
    const patchUrl = `${pkg.url}api/support/Patch.zip`;
    
    patchPopup.closePopup();
    patchPopup.openPopup({
      title: "Toolkit de Parches",
      content: "Descargando parche desde el servidor...<br><br>Por favor, no cierres el launcher durante el proceso.",
      color: "var(--color)",
      background: true
    });
    
    console.log(`Descargando parche desde: ${patchUrl}`);
    console.log(`Guardando en: ${patchFilePath}`);

    const response = await fetch(patchUrl);
    
    if (!response.ok) {
      throw new Error(`Error al descargar el parche: ${response.statusText}`);
    }
    
    const totalSize = parseInt(response.headers.get('content-length') || '0');
    
    const fileStream = fs.createWriteStream(patchFilePath);
    
    if (response.body && typeof response.body.pipe === 'function') {
      console.log("Using pipe stream method for download");
      
      let downloadedSize = 0;
      
      response.body.on('data', (chunk) => {
        downloadedSize += chunk.length;
        const progressPercent = totalSize ? Math.round((downloadedSize / totalSize) * 100) : 0;
        
        patchPopup.closePopup();
        patchPopup.openPopup({
          title: "Toolkit de Parches",
          content: `Descargando parche... ${progressPercent}%<br><br>Por favor, no cierres el launcher durante el proceso.`,
          color: "var(--color)",
          background: true
        });
      });
      
      await new Promise((resolve, reject) => {
        response.body.pipe(fileStream)
          .on('finish', resolve)
          .on('error', reject);
      });
    } else {
      console.log("Using buffer method for download");
      const buffer = await response.buffer();
      
      await new Promise((resolve, reject) => {
        fileStream.write(buffer, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
    
    await new Promise((resolve) => {
      fileStream.end(resolve);
    });
    
    console.log("Descarga completada");
    
    patchPopup.closePopup();
    patchPopup.openPopup({
      title: "Toolkit de Parches", 
      content: "Extrayendo archivos del parche...<br><br>Por favor, no cierres el launcher durante el proceso.",
      color: "var(--color)",
      background: true
    });
    
    try {
      console.log("Iniciando extracción con adm-zip...");
      const AdmZip = require('adm-zip');
      
      const zip = new AdmZip(patchFilePath);
      const zipEntries = zip.getEntries();
      
      const totalFiles = zipEntries.length;
      
      for (let i = 0; i < zipEntries.length; i++) {
        const entry = zipEntries[i];
        const progress = Math.round(((i + 1) / totalFiles) * 100);
        
        console.log(`Extrayendo archivo (${i + 1}/${totalFiles}): ${entry.entryName}`);
        
        patchPopup.closePopup();
        patchPopup.openPopup({
          title: "Toolkit de Parches",
          content: `Extrayendo archivos... ${progress}%<br><br>Archivo: ${entry.entryName}<br><br>Por favor, no cierres el launcher durante el proceso.`,
          color: "var(--color)",
          background: true
        });
        
        if (!entry.isDirectory) {
          const entryPath = path.join(dataFolder, entry.entryName);
          const entryDir = path.dirname(entryPath);
          
          if (!fs.existsSync(entryDir)) {
            fs.mkdirSync(entryDir, { recursive: true });
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      zip.extractAllTo(dataFolder, true);
      console.log("Extracción completada con adm-zip");
      
    } catch (extractError) {
      console.error("Error al extraer el archivo:", extractError);
      throw new Error(`Error al extraer el archivo: ${extractError.message}`);
    }
    
    patchPopup.closePopup();
    patchPopup.openPopup({
      title: "Toolkit de Parches",
      content: "¡Parcheo completado con éxito!<br><br>El launcher se reiniciará para aplicar los cambios.",
      color: "var(--color)",
      background: true
    });
    
    try {
      fs.unlinkSync(patchFilePath);
      console.log("Archivo de parche eliminado");
    } catch (err) {
      console.warn("No se pudo eliminar el archivo de parche", err);
    }
    
    setTimeout(() => {
      patchPopup.closePopup();
      ipcRenderer.send('app-restart');
    }, 3000);
    
  } catch (error) {
    console.error("Error en el proceso de parcheo:", error);
    
    new popup().openPopup({
      title: "Error en el Toolkit de Parches",
      content: `Ha ocurrido un error durante el proceso de parcheo:<br><br>${error.message}`,
      color: "red",
      background: true,
      options: true
    });
  }
}

async function removeUserFromQueue(hwid) {
  try {
      const username = await getUsername();
      const formData = new URLSearchParams();
      formData.append('hwid', hwid);
      formData.append('username', username);
      
      await fetch(`${pkg.url}/api/quit-queue.php`, {
          method: 'POST',
          body: formData,
          headers: {
              'Content-Type': 'application/x-www-form-urlencoded'
          }
      });
      console.log('User removed from queue');
  } catch (error) {
      console.error('Error removing user from queue');
  }
}

// Inicializamos el CleanupManager con la instancia de base de datos para evitar referencias circulares
(async function initializeCleanupManager() {
  try {
    // Creamos una instancia de database en lugar de pasar la clase
    const dbInstance = new database();
    await cleanupManager.initializeWithDatabase(dbInstance);
    console.log("CleanupManager inicializado correctamente");
  } catch (error) {
    console.error("Error al inicializar CleanupManager:", error);
  }
})();

export {
    appdata as appdata,
    changePanel as changePanel,
    config as config,
    database as database,
    logger as logger,
    popup as popup,
    setBackground as setBackground,
    setVideoSource as setVideoSource,
    skin2D as skin2D,
    addAccount as addAccount,
    accountSelect as accountSelect,
    slider as Slider,
    pkg as pkg,
    setStatus as setStatus,
    setInstanceBackground as setInstanceBackground,
    getUsername as getUsername,
    setUsername as setUsername,
    clickableHead as clickableHead,
    clickHead as clickHead,
    getClickeableHead as getClickeableHead,
    toggleModsForInstance as toggleModsForInstance,
    getDiscordUsername as getDiscordUsername,
    setDiscordUsername as setDiscordUsername,
    discordAccount as discordAccount,
    getDiscordPFP as getDiscordPFP,
    setDiscordPFP as setDiscordPFP,
    getTermsAndConditions as getTermsAndConditions,
    showTermsAndConditions as showTermsAndConditions,
    toggleMusic as toggleMusic,
    fadeOutAudio as fadeOutAudio,
    fadeInAudio as fadeInAudio,
    setBackgroundMusic as setBackgroundMusic,
    setPerformanceMode as setPerformanceMode,
    isPerformanceModeEnabled as isPerformanceModeEnabled,
    patchLoader as patchLoader,
    cleanupManager as cleanupManager,
    removeUserFromQueue as removeUserFromQueue,
    captureAndSetVideoFrame as captureAndSetVideoFrame,
    setStaticBackground as setStaticBackground,
    fileExists as fileExists,
    isImageUrl as isImageUrl
}
window.setVideoSource = setVideoSource;