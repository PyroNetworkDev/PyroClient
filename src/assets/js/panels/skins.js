/**
 * @author MiguelkiNetwork (based on work by Luuxis)
 * @license CC-BY-NC 4.0 - https://creativecommons.org/licenses/by-nc/4.0
 */

import { config, database, changePanel, appdata, setStatus, popup, getUsername } from '../utils.js';
import { skin2D } from '../utils/skin.js';

const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const { Microsoft } = require('minecraft-java-core');

class Skins {
    static id = "skins";
    async init(config) {
        this.config = config;
        this.db = new database();
        this.skinViewer = null;
        this.currentSkin = null;
        this.currentAnimationController = null;
        this.userSkinPath = null; // Para almacenar la ruta de la skin del usuario
        
        // Inicializar el directorio de skins si no existe
        await this.initSkinsDirectory();
        
        // Configurar los botones (excepto el botón de subida que se configurará después)
        this.setupBackButton();
        this.setupPoseButtons();
        this.setupApplyButton();
        this.setupSearchFunction();
        this.setupFileInput(); // Configuramos solo el input de archivo
        
        // Cargar las skins y mostrarlas (esto ahora también configura el botón de subida)
        await this.loadSkins();
        
        // Inicializar el visor 3D de skin
        this.initSkinViewer();
        
        // Cargar la skin actual del usuario
        await this.loadCurrentUserSkin();

        // Configurar actualización automática para cuando el panel se hace visible
        document.addEventListener('panelChanged', async (e) => {
            if (e.detail.to === 'skins') {
                console.log('Panel de skins activado, actualizando información de cuenta');
                // Aseguramos que la pose estática está activa
                const staticButton = document.querySelector('[data-pose="idle"]');
                if (staticButton) {
                    this.changeAnimation('idle');
                }
                
                // Primero actualizamos la información de cuenta para que loadCurrentUserSkin tenga los datos actualizados
                await this.updateAccountInfo(); 
                
                // Luego cargamos la skin actual
                await this.loadCurrentUserSkin();
            }
        });
    }

    async initSkinsDirectory() {
        try {
            const skinsPath = await this.getSkinsPath();
            if (!fs.existsSync(skinsPath)) {
                fs.mkdirSync(skinsPath, { recursive: true });
                console.log('Directorio de skins creado:', skinsPath);
            }
        } catch (error) {
            console.error('Error al inicializar el directorio de skins:', error);
        }
    }
    
    async getSkinsPath() {
        const appdataPath = await appdata();
        return path.join(
            appdataPath,
            process.platform === 'darwin' ? this.config.dataDirectory : `.${this.config.dataDirectory}`,
            'skins'
        );
    }
    
    setupBackButton() {
        const backBtn = document.querySelector('.skins .back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                this.goToHome();
            });
        } else {
            console.error('No se pudo encontrar el botón de volver en el panel de skins');
            // Intentar buscar de manera más general
            setTimeout(() => {
                const fallbackBackBtn = document.querySelector('.back-btn');
                if (fallbackBackBtn) {
                    fallbackBackBtn.addEventListener('click', () => {
                        this.goToHome();
                    });
                    console.log('Se encontró y configuró el botón de volver con búsqueda alternativa');
                }
            }, 500);
        }
    }
    
    goToHome() {
        // Disparar evento personalizado antes de cambiar de panel
        const event = new CustomEvent('panelChanged', {
            detail: {
                from: 'skins',
                to: 'home'
            }
        });
        document.dispatchEvent(event);
        
        // Cambiar al panel home
        changePanel('home');
    }
    
    setupFileInput() {
        const fileInput = document.getElementById('skin-file-input');
        if (fileInput) {
            fileInput.addEventListener('change', async (e) => {
                if (e.target.files.length > 0) {
                    await this.uploadNewSkin(e.target.files[0]);
                }
            });
        }
    }
    
    setupUploadButton() {
        console.log('setupUploadButton is deprecated. Upload button is now created in loadSkins');
    }
    
    setupPoseButtons() {
        const poseButtons = document.querySelectorAll('.skin-pose-btn');
        
        poseButtons.forEach(button => {
            button.addEventListener('click', () => {
                const pose = button.dataset.pose;
                this.changeAnimation(pose);
            });
        });
    }
    
    setupApplyButton() {
        const applyBtn = document.querySelector('.apply-skin-btn');
        
        applyBtn.addEventListener('click', async () => {
            if (!this.currentSkin) {
                this.showNotification('No hay ninguna skin seleccionada.', 'error');
                return;
            }
            
            await this.applySkin(this.currentSkin);
        });
    }
    
    setupSearchFunction() {
        const searchInput = document.querySelector('.skin-search-input');
        const searchBtn = document.querySelector('.skin-search-btn');
        
        // Cambiar el ícono del botón de búsqueda a borrar
        searchBtn.innerHTML = '<i class="fas fa-times"></i>';
        searchBtn.classList.add('skin-clear-btn');
        searchBtn.classList.remove('skin-search-btn');
        
        // Función de búsqueda
        const performSearch = () => {
            const query = searchInput.value.toLowerCase().trim();
            const skinItems = document.querySelectorAll('.skin-item');
            const uploadBtn = document.querySelector('.upload-skin-btn');
            
            // Si la búsqueda está vacía, mostrar todo incluyendo el botón de subir
            if (query === '') {
                skinItems.forEach(item => {
                    item.classList.remove('hidden-item');
                });
                if (uploadBtn) uploadBtn.classList.remove('hidden-item');
                return;
            }
            
            // Ocultar inicialmente el botón de subir durante la búsqueda
            if (uploadBtn) uploadBtn.classList.add('hidden-item');
            
            let hasResults = false;
            
            // Filtrar los elementos según la búsqueda
            skinItems.forEach(item => {
                const skinName = item.dataset.name.toLowerCase();
                if (skinName.includes(query)) {
                    item.classList.remove('hidden-item');
                    hasResults = true;
                } else {
                    item.classList.add('hidden-item');
                }
            });
            
            // Si no hay resultados, mostrar un mensaje
            const noResultsMsg = document.getElementById('no-search-results');
            if (!hasResults) {
                if (!noResultsMsg) {
                    const emptyMessage = document.createElement('div');
                    emptyMessage.id = 'no-search-results';
                    emptyMessage.classList.add('empty-skins-message');
                    emptyMessage.textContent = `No se encontraron skins con: "${searchInput.value}"`;
                    document.querySelector('.skins-list').appendChild(emptyMessage);
                }
            } else if (noResultsMsg) {
                noResultsMsg.remove();
            }
        };
        
        // Realizar búsqueda en tiempo real mientras se escribe
        searchInput.addEventListener('input', performSearch);
        
        // Botón para borrar el campo de búsqueda
        searchBtn.addEventListener('click', () => {
            searchInput.value = '';
            searchInput.focus();
            performSearch();
        });
    }
    
    async loadSkins() {
        try {
            const skinsList = document.querySelector('.skins-list');
            const skinsPath = await this.getSkinsPath();
            
            // Limpiar lista completamente
            skinsList.innerHTML = '';
            
            // Leer archivos en el directorio
            const files = fs.readdirSync(skinsPath);
            const skinFiles = files.filter(file => file.endsWith('.png'));
            
            // Si no hay skins, mostrar un mensaje
            if (skinFiles.length === 0) {
                const emptyMessage = document.createElement('div');
                emptyMessage.classList.add('empty-skins-message');
                emptyMessage.textContent = 'No hay skins guardadas. Sube tu primera skin.';
                skinsList.appendChild(emptyMessage);
            }
            
            // Crear elementos para cada skin
            for (const file of skinFiles) {
                const skinPath = path.join(skinsPath, file);
                const skinItem = await this.createSkinItem(skinPath, file);
                skinsList.appendChild(skinItem);
            }
            
            // Añadir el botón de subir skin como último elemento
            const uploadBtn = document.createElement('div');
            uploadBtn.classList.add('upload-skin-btn');
            uploadBtn.innerHTML = `
                <i class="fas fa-upload"></i>
                <span>Subir nueva skin</span>
            `;
            
            // Configurar el evento click del botón aquí
            const fileInput = document.getElementById('skin-file-input');
            if (fileInput) {
                uploadBtn.addEventListener('click', () => {
                    fileInput.click();
                });
            }
            
            skinsList.appendChild(uploadBtn);
            
        } catch (error) {
            console.error('Error al cargar las skins:', error);
        }
    }
    
    async createSkinItem(skinPath, filename) {
        const skinItem = document.createElement('div');
        skinItem.classList.add('skin-item');
        skinItem.dataset.path = skinPath;
        
        // Obtener el nombre sin extensión
        const skinName = filename.replace('.png', '');
        skinItem.dataset.name = skinName;
        
        // Crear previsualización 2D de la cabeza
        try {
            const skinData = fs.readFileSync(skinPath).toString('base64');
            const skinDataUrl = `data:image/png;base64,${skinData}`;
            const headTexture = await new skin2D().creatHeadTexture(skinDataUrl);
            
            // Contenedor para la miniatura y otros elementos
            const skinPreviewContainer = document.createElement('div');
            skinPreviewContainer.classList.add('skin-thumbnail-container'); // Cambiado de skin-preview-container a skin-thumbnail-container
            
            // Botón de eliminar
            const deleteButton = document.createElement('div');
            deleteButton.classList.add('skin-delete-btn');
            deleteButton.innerHTML = '×';
            deleteButton.title = 'Eliminar skin';
            deleteButton.addEventListener('click', (e) => {
                e.stopPropagation(); // Evitar que se seleccione la skin al eliminarla
                this.confirmDeleteSkin(skinPath, skinName, skinItem);
            });
            
            // Miniatura de la skin
            const skinPreview = document.createElement('div');
            skinPreview.classList.add('skin-thumbnail');
            skinPreview.style.backgroundImage = `url(${headTexture})`;
            
            // Agregar elementos al contenedor
            skinPreviewContainer.appendChild(skinPreview);
            skinPreviewContainer.appendChild(deleteButton);
            skinItem.appendChild(skinPreviewContainer);
            
            // Nombre de la skin
            const skinNameElement = document.createElement('div');
            skinNameElement.classList.add('skin-name');
            skinNameElement.textContent = skinName;
            skinItem.appendChild(skinNameElement);
            
            // Agregar eventos para seleccionar la skin
            skinItem.addEventListener('click', () => {
                this.selectSkin(skinItem);
            });
        } catch (error) {
            console.error(`Error al crear vista previa para ${filename}:`, error);
        }
        
        return skinItem;
    }
    
    async confirmDeleteSkin(skinPath, skinName, skinItem) {
        const confirmPopup = new popup();
        const result = await new Promise((resolve) => {
            confirmPopup.openDialog({
                title: 'Eliminar skin',
                content: `¿Estás seguro de que deseas eliminar la skin "${skinName}"?`,
                options: true,
                callback: (result) => {
                    resolve(result !== 'cancel');
                }
            });
        });
        
        if (result) {
            try {
                // Eliminar el archivo
                fs.unlinkSync(skinPath);
                // También eliminar el archivo de metadatos si existe
                const metadataPath = skinPath + '.json';
                if (fs.existsSync(metadataPath)) {
                    fs.unlinkSync(metadataPath);
                }
                
                // Eliminar el elemento de la UI con animación
                skinItem.style.transition = 'all 0.3s ease';
                skinItem.style.transform = 'scale(0.5)';
                skinItem.style.opacity = '0';
                
                setTimeout(() => {
                    skinItem.remove();
                    
                    // Si esta skin era la seleccionada, seleccionar la skin del usuario
                    if (skinItem.classList.contains('selected')) {
                        // Buscar la skin del usuario actual
                        if (this.userSkinPath) {
                            const userSkinItem = this.findSkinItemByPath(this.userSkinPath);
                            if (userSkinItem) {
                                this.selectSkin(userSkinItem);
                            } else {
                                // Si no se encuentra, restaurar la vista por defecto
                                document.querySelector('.current-skin-name').textContent = 'Selecciona una skin';
                                document.querySelector('.current-skin-details').textContent = '';
                                this.currentSkin = null;
                                
                                // Cargar skin por defecto en el visor
                                this.skinViewer.loadSkin('assets/images/default/steve-skin.png');
                            }
                        } else {
                            // Restaurar la vista por defecto
                            document.querySelector('.current-skin-name').textContent = 'Selecciona una skin';
                            document.querySelector('.current-skin-details').textContent = '';
                            this.currentSkin = null;
                            
                            // Cargar skin por defecto en el visor
                            this.skinViewer.loadSkin('assets/images/default/steve-skin.png');
                        }
                    }
                }, 300);
            } catch (error) {
                console.error('Error al eliminar la skin:', error);
                this.showNotification('Error al eliminar la skin.', 'error');
            }
        }
    }

    // Método auxiliar para encontrar un elemento de skin por su ruta
    findSkinItemByPath(skinPath) {
        const skinItems = document.querySelectorAll('.skin-item');
        for (const item of skinItems) {
            if (item.dataset.path === skinPath) {
                return item;
            }
        }
        return null;
    }
    
    initSkinViewer() {
        try {
            const canvas = document.getElementById('skin-viewer-canvas');
            
            // Usar el objeto skinview3d que está disponible globalmente
            // (cargado desde el script en el HTML)
            this.skinViewer = new skinview3d.SkinViewer({
                canvas: canvas,
                width: 280,
                height: 400,
                skin: null
            });
            
            // Configurar controles de cámara
            this.skinViewer.controls.enableRotate = true;
            this.skinViewer.controls.enableZoom = true;
            
            // Configurar la pose inicial
            document.querySelector('[data-pose="idle"]').classList.add('active');
            
            // Aplicar pose después de un breve retraso para asegurar que todo está listo
            setTimeout(() => {
                this.changeAnimation('idle');
            }, 100);
        } catch (error) {
            console.error('Error al inicializar el visor de skin:', error);
        }
    }
    
    changeAnimation(pose) {
        // Limpiar clases activas de los botones manualmente
        const buttons = document.querySelectorAll('.skin-pose-btn');
        if (buttons) {
            buttons.forEach(btn => {
                btn.classList.remove('active');
                if (btn.dataset.pose === pose) {
                    btn.classList.add('active');
                }
            });
        }
        
        if (!this.skinViewer) {
            console.warn('No se puede cambiar la animación porque skinViewer no está inicializado');
            return;
        }
        
        // Guardar referencia previa para poder recuperar en caso de error
        const prevAnimationController = this.currentAnimationController;
        
        // Eliminar todas las animaciones previas con manejo de errores
        try {
            if (this.skinViewer.animations) {
                this.skinViewer.animations.clear();
            } else if (this.skinViewer.animation) {
                this.skinViewer.animation = null;
            }
        } catch (clearError) {
            console.warn('Error al limpiar animaciones previas:', clearError);
        }
        
        // Configurar la nueva animación correctamente según cómo se haya cargado la librería
        try {
            // Determinar si estamos usando la versión bundled o la importada dinámicamente
            const skinviewLib = window.skinview3d;
            
            if (!skinviewLib) {
                throw new Error('La librería skinview3d no está disponible');
            }
            
            switch (pose) {
                case 'idle':
                    if (this.skinViewer.animations) {
                        // Método para la versión bundled
                        this.currentAnimationController = this.skinViewer.animations.add(skinviewLib.IdleAnimation);
                    } else {
                        // Método para la versión importada
                        this.skinViewer.animation = new skinviewLib.IdleAnimation();
                        this.currentAnimationController = this.skinViewer.animation;
                    }
                    break;
                case 'walk':
                    if (this.skinViewer.animations) {
                        // Método para la versión bundled
                        this.currentAnimationController = this.skinViewer.animations.add(skinviewLib.WalkingAnimation);
                    } else {
                        // Método para la versión importada
                        this.skinViewer.animation = new skinviewLib.WalkingAnimation();
                        this.currentAnimationController = this.skinViewer.animation;
                    }
                    break;
                case 'run':
                    if (this.skinViewer.animations) {
                        // Método para la versión bundled
                        const runAnimation = this.skinViewer.animations.add(skinviewLib.WalkingAnimation);
                        if (runAnimation) runAnimation.speed = 2;
                        this.currentAnimationController = runAnimation;
                    } else {
                        // Método para la versión importada
                        this.skinViewer.animation = new skinviewLib.WalkingAnimation();
                        if (this.skinViewer.animation) this.skinViewer.animation.speed = 2;
                        this.currentAnimationController = this.skinViewer.animation;
                    }
                    break;
                default:
                    console.warn('Pose desconocida:', pose);
                    this.currentAnimationController = prevAnimationController;
            }
        } catch (error) {
            console.error('Error al cambiar la animación:', error);
            this.currentAnimationController = prevAnimationController;
            
            // Intentar recuperar la animación anterior como fallback
            try {
                if (prevAnimationController && this.skinViewer.animations) {
                    this.skinViewer.animations.add(prevAnimationController);
                }
            } catch (recoveryError) {
                console.warn('No se pudo recuperar la animación anterior:', recoveryError);
            }
        }
    }
    
    async selectSkin(skinItem) {
        try {
            // Eliminar selección anterior
            document.querySelectorAll('.skin-item').forEach(item => {
                item.classList.remove('selected');
            });
            
            // Añadir selección a la skin actual
            skinItem.classList.add('selected');
            
            const skinPath = skinItem.dataset.path;
            const skinName = skinItem.dataset.name;
            
            if (!skinPath || !fs.existsSync(skinPath)) {
                throw new Error('La ruta de la skin no existe');
            }
            
            const skinData = fs.readFileSync(skinPath);
            const skinDataUrl = `data:image/png;base64,${skinData.toString('base64')}`;
            
            // Detectar el modelo (slim o classic)
            const skinModel = await this.detectSkinModel(skinDataUrl);
            
            // Activar botón de aplicar
            const applyBtn = document.querySelector('.apply-skin-btn');
            if (applyBtn) {
                applyBtn.disabled = false;
            }
            
            // Actualizar el visor 3D
            this.skinViewer.loadSkin(skinDataUrl);
            
            // Actualizar información de la skin
            document.querySelector('.current-skin-name').innerHTML = 
                `${skinName} <span class="skin-model-indicator skin-model-${skinModel}">${skinModel}</span>`;
            
            // Obtener la información más reciente de la cuenta seleccionada
            await this.updateAccountInfo();
            
            // Guardar referencia a la skin seleccionada
            this.currentSkin = {
                path: skinPath,
                name: skinName,
                data: skinData,
                dataUrl: skinDataUrl,
                model: skinModel
            };
            
        } catch (error) {
            console.error('Error al seleccionar skin:', error);
            this.showNotification('Error al cargar la skin.', 'error');
        }
    }
    
    sanitizeFileName(name) {
        // Eliminar caracteres especiales y reemplazarlos con guiones
        // Permitir letras, números, guiones y guiones bajos
        return name.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/__+/g, '_');
    }

    async uploadNewSkin(file) {
        try {
            // Validar que sea un archivo PNG
            if (!file.name.endsWith('.png')) {
                this.showNotification('Solo se permiten archivos PNG.', 'error');
                return;
            }
            
            // Validar tamaño del archivo (máx. 1MB)
            if (file.size > 1024 * 1024) {
                this.showNotification('La skin es demasiado grande. Máximo 1MB.', 'error');
                return;
            }
            
            // Obtener nombre inicial (limitado a 16 caracteres)
            const initialName = path.basename(file.name, path.extname(file.name)).substring(0, 16);
            
            // Preguntar al usuario un nombre personalizado para la skin
            const skinNameInput = await this.promptSkinName(initialName);
            if (!skinNameInput) {
                // El usuario canceló el diálogo
                return;
            }
            
            // Comprobar si ya existe una skin con ese nombre
            const skinsPath = await this.getSkinsPath();
            const sanitizedName = this.sanitizeFileName(skinNameInput);
            const skinFileName = `${sanitizedName}.png`;
            const skinFilePath = path.join(skinsPath, skinFileName);
            
            // Verificar si ya existe
            if (fs.existsSync(skinFilePath)) {
                this.showNotification(`Ya existe una skin con el nombre "${skinNameInput}". Por favor, usa otro nombre.`, 'error');
                return;
            }
            
            // Leer el archivo
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    // Validar dimensiones
                    const img = new Image();
                    img.onload = async () => {
                        // Comprobar dimensiones válidas (64x64 o 64x32)
                        if (!((img.width === 64 && img.height === 64) || (img.width === 64 && img.height === 32))) {
                            this.showNotification('Las dimensiones de la skin deben ser 64x64 o 64x32 píxeles.', 'error');
                            return;
                        }
                        
                        // Mostrar indicador de carga
                        const loadingPopup = new popup();
                        loadingPopup.openPopup({
                            title: 'Procesando skin',
                            content: 'Guardando y configurando la skin...',
                            color: 'var(--color)',
                            background: false
                        });
                        
                        try {
                            // Verificar que el directorio de skins exista
                            if (!fs.existsSync(skinsPath)) {
                                fs.mkdirSync(skinsPath, { recursive: true });
                                console.log('Directorio de skins creado:', skinsPath);
                            }
                            
                            // Convertir a buffer y guardar
                            const buffer = Buffer.from(e.target.result.split(',')[1], 'base64');
                            fs.writeFileSync(skinFilePath, buffer);
                            
                            // Detectar el modelo (slim o classic)
                            const skinModel = await this.detectSkinModel(e.target.result);
                            
                            // Guardar el modelo como metadata
                            const metadata = { model: skinModel };
                            const metadataPath = path.join(skinsPath, `${sanitizedName}.json`);
                            fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
                            
                            // Recargar las skins
                            await this.loadSkins();
                            
                            // Encontrar y seleccionar la nueva skin
                            const skinItems = document.querySelectorAll('.skin-item');
                            let newSkinItem = null;
                            
                            for (const item of skinItems) {
                                if (item.dataset.path === skinFilePath || item.dataset.name === sanitizedName) {
                                    newSkinItem = item;
                                    break;
                                }
                            }
                            
                            if (newSkinItem) {
                                this.selectSkin(newSkinItem);
                                // Desplazar a la vista de la nueva skin
                                newSkinItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            } else {
                                console.error('No se pudo encontrar la skin recién subida en la lista');
                            }
                            
                            loadingPopup.closePopup();
                            this.showNotification('Skin subida correctamente.', 'success');
                        } catch (error) {
                            console.error('Error al guardar la skin:', error);
                            loadingPopup.closePopup();
                            this.showNotification(`Error al guardar la skin: ${error.message}`, 'error');
                        }
                    };
                    
                    img.onerror = () => {
                        this.showNotification('El archivo no es una imagen válida.', 'error');
                    };
                    
                    img.src = e.target.result;
                } catch (error) {
                    console.error('Error al procesar la skin:', error);
                    this.showNotification(`Error al procesar la skin: ${error.message}`, 'error');
                }
            };
            
            reader.onerror = () => {
                this.showNotification('Error al leer el archivo.', 'error');
            };
            
            reader.readAsDataURL(file);
            
        } catch (error) {
            console.error('Error al subir skin:', error);
            this.showNotification(`Error al subir la skin: ${error.message}`, 'error');
        }
    }
    
    async promptSkinName(defaultName) {
        return new Promise((resolve) => {
            // Crear elementos del modal personalizado
            const modalOverlay = document.createElement('div');
            modalOverlay.classList.add('skin-name-modal-overlay');
            
            const modalContent = document.createElement('div');
            modalContent.classList.add('skin-name-modal');
            
            modalContent.innerHTML = `
                <div class="skin-name-modal-header">
                    <h3>Nombre de la skin</h3>
                </div>
                <div class="skin-name-modal-body">
                    <p>Introduce un nombre para la skin (máx. 16 caracteres):</p>
                    <input type="text" id="skin-name-input" value="${defaultName}" 
                           class="skin-name-input" autocomplete="off" maxlength="16">
                    <small style="color: rgba(255,255,255,0.6); display: block; margin-top: 8px;">El nombre ayudará a identificar tu skin en la biblioteca.</small>
                </div>
                <div class="skin-name-modal-footer">
                    <button class="skin-name-cancel-btn">Cancelar</button>
                    <button class="skin-name-confirm-btn">Aceptar</button>
                </div>
            `;
            
            document.body.appendChild(modalOverlay);
            modalOverlay.appendChild(modalContent);
            
            // Enfocar el input
            const nameInput = document.getElementById('skin-name-input');
            nameInput.focus();
            nameInput.select();
            
            // Permitir cerrar con Escape
            const handleEscape = (e) => {
                if (e.key === 'Escape') {
                    cleanup();
                    resolve(null);
                }
            };
            
            // Permitir enviar con Enter
            const handleEnter = (e) => {
                if (e.key === 'Enter') {
                    submitName();
                }
            };
            
            document.addEventListener('keydown', handleEscape);
            nameInput.addEventListener('keydown', handleEnter);
            
            // Configurar botones
            const cancelBtn = document.querySelector('.skin-name-cancel-btn');
            const confirmBtn = document.querySelector('.skin-name-confirm-btn');
            
            cancelBtn.addEventListener('click', () => {
                cleanup();
                resolve(null);
            });
            
            confirmBtn.addEventListener('click', submitName);
            
            // Función para enviar el nombre
            function submitName() {
                const skinName = nameInput.value.trim();
                
                if (!skinName) {
                    nameInput.style.border = '1px solid red';
                    nameInput.classList.add('shake');
                    setTimeout(() => nameInput.classList.remove('shake'), 500);
                    return;
                }
                
                cleanup();
                resolve(skinName);
            }
            
            // Función para limpiar
            function cleanup() {
                document.removeEventListener('keydown', handleEscape);
                nameInput.removeEventListener('keydown', handleEnter);
                
                // Añadir animación de salida
                modalContent.style.animation = 'modalDisappear 0.2s forwards';
                modalOverlay.style.opacity = '0';
                
                // Eliminar después de la animación
                setTimeout(() => {
                    modalOverlay.remove();
                }, 200);
            }
        });
    }
    
    async saveSkinFromUrl(url, name, model = 'classic') {
        try {
            // Descargar la skin
            const response = await fetch(url);
            const buffer = await response.buffer();
            
            // Guardar la skin
            const skinsPath = await this.getSkinsPath();
            
            // Para cuentas existentes, simplificamos el nombre
            const simplifiedName = name;
            const skinFileName = `${simplifiedName}.png`;
            const skinFilePath = path.join(skinsPath, skinFileName);
            
            // Siempre guardar la skin, incluso si ya existe (sobrescribir)
            fs.writeFileSync(skinFilePath, buffer);
            
            // Guardar el modelo como metadata
            const metadata = { model: model };
            const metadataPath = path.join(skinsPath, `${simplifiedName}.json`);
            fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
            
            console.log('Skin actual guardada/actualizada localmente');
            
            // Recargar lista de skins
            await this.loadSkins();
            
            // Devolver la ruta de la skin guardada
            return skinFilePath;
        } catch (error) {
            console.error('Error al guardar la skin de la URL:', error);
            return null;
        }
    }
    
    async saveSkinFromBase64(base64Data, name, model = 'classic') {
        try {
            // Convertir base64 a buffer
            const buffer = Buffer.from(base64Data, 'base64');
            
            // Guardar la skin
            const skinsPath = await this.getSkinsPath();
            
            // Para cuentas existentes, simplificamos el nombre
            const simplifiedName = name;
            const skinFileName = `${simplifiedName}.png`;
            const skinFilePath = path.join(skinsPath, skinFileName);
            
            // Siempre guardar la skin, incluso si ya existe (sobrescribir)
            fs.writeFileSync(skinFilePath, buffer);
            
            // Guardar el modelo como metadata
            const metadata = { model: model };
            const metadataPath = path.join(skinsPath, `${simplifiedName}.json`);
            fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
            
            console.log('Skin guardada/actualizada desde base64');
            
            // Recargar lista de skins
            await this.loadSkins();
            
            // Devolver la ruta de la skin guardada
            return skinFilePath;
        } catch (error) {
            console.error('Error al guardar la skin desde base64:', error);
            return null;
        }
    }
    
    async loadCurrentUserSkin() {
        try {
            // Limpiar información previa para evitar mostrar datos obsoletos
            document.querySelector('.current-skin-name').textContent = 'Cargando...';
            document.querySelector('.current-skin-details').textContent = '';
            
            // Resetear la referencia a la skin del usuario
            this.userSkinPath = null;
            
            // Obtener la configuración del cliente actualizada
            const configClient = await this.db.readData('configClient');
            if (!configClient || !configClient.account_selected) {
                console.log('No hay cuenta seleccionada en la configuración');
                document.querySelector('.current-skin-name').textContent = 'No hay cuenta seleccionada';
                return;
            }

            // Obtener la cuenta actualmente seleccionada
            const currentAccount = await this.db.readData('accounts', configClient.account_selected);
            if (!currentAccount) {
                console.log('No se pudo encontrar la cuenta seleccionada');
                document.querySelector('.current-skin-name').textContent = 'Cuenta no encontrada';
                return;
            }
            
            console.log('Cargando skin para la cuenta:', currentAccount.name);
            
            // Verificar que sea una cuenta de Microsoft/Xbox
            if (currentAccount.meta && (currentAccount.meta.type === 'Xbox' || currentAccount.meta.type === 'Microsoft')) {
                // Obtener la skin actual
                if (currentAccount.profile && currentAccount.profile.skins && currentAccount.profile.skins.length > 0) {
                    const currentSkin = currentAccount.profile.skins[0];
                    
                    if (currentSkin.url) {
                        // Cargar la skin desde la URL
                        this.skinViewer.loadSkin(currentSkin.url);
                        
                        // Verificar el modelo de la skin (slim o classic)
                        const skinModel = currentSkin.variant || "classic";
                        
                        // Mostrar información de la skin actual con el modelo
                        document.querySelector('.current-skin-name').innerHTML = 
                            `Skin actual <span class="skin-model-indicator skin-model-${skinModel}">${skinModel}</span>`;
                        document.querySelector('.current-skin-details').textContent = `Cuenta: ${currentAccount.name}`;
                        
                        // Guardar la referencia de la skin actual
                        this.currentSkin = {
                            url: currentSkin.url,
                            name: 'Skin actual',
                            id: currentSkin.id,
                            accountId: currentAccount.ID,
                            model: skinModel
                        };
                        
                        // También guardarla localmente si no existe
                        const savedPath = await this.saveSkinFromUrl(currentSkin.url, `${currentAccount.name}`, skinModel);
                        this.userSkinPath = savedPath; // Almacenar la ruta de la skin del usuario
                        
                    } else if (currentSkin.base64) {
                        // Si hay una skin en base64, cargarla directamente
                        const skinDataUrl = `data:image/png;base64,${currentSkin.base64}`;
                        this.skinViewer.loadSkin(skinDataUrl);
                        
                        const skinModel = currentSkin.variant || "classic";
                        
                        document.querySelector('.current-skin-name').innerHTML = 
                            `Skin actual <span class="skin-model-indicator skin-model-${skinModel}">${skinModel}</span>`;
                        document.querySelector('.current-skin-details').textContent = `Cuenta: ${currentAccount.name}`;
                        
                        this.currentSkin = {
                            dataUrl: skinDataUrl,
                            base64: currentSkin.base64,
                            name: 'Skin actual',
                            id: currentSkin.id,
                            accountId: currentAccount.ID,
                            model: skinModel
                        };
                        
                        // Guardar localmente
                        const savedPath = await this.saveSkinFromBase64(currentSkin.base64, `${currentAccount.name}`, skinModel);
                        this.userSkinPath = savedPath; // Almacenar la ruta de la skin del usuario
                    }
                    else {
                        this.loadDefaultSkin(currentAccount.name);
                        console.log('La skin actual no tiene URL o base64');
                    }
                } else {
                    this.loadDefaultSkin(currentAccount.name);
                    console.log('La cuenta no tiene skins configuradas');
                }
            } else {
                // Cargar skin para cuenta no premium usando Minotar
                console.log('Cuenta no premium, intentando cargar skin desde Minotar');
                const username = currentAccount.name;
                if (username) {
                    const minotarUrl = `https://minotar.net/skin/${username}`;
                    
                    try {
                        // Cargar la skin con la URL de Minotar
                        this.skinViewer.loadSkin(minotarUrl);
                        
                        // Intentar determinar el modelo analizando la skin
                        const skinModel = await this.detectSkinModel(minotarUrl);
                        
                        document.querySelector('.current-skin-name').innerHTML = 
                            `Skin de Minecraft <span class="skin-model-indicator skin-model-${skinModel}">${skinModel}</span>`;
                        document.querySelector('.current-skin-details').textContent = `Cuenta: ${username}`;
                        
                        this.currentSkin = {
                            url: minotarUrl,
                            name: `Skin de ${username}`,
                            model: skinModel
                        };
                        
                        // Guardar la skin localmente si no existe
                        const savedPath = await this.saveSkinFromUrl(minotarUrl, `${username}`, skinModel);
                        this.userSkinPath = savedPath; // Almacenar la ruta de la skin del usuario
                        
                    } catch (error) {
                        console.error('Error al cargar skin desde Minotar:', error);
                        this.loadDefaultSkin(username);
                    }
                } else {
                    this.loadDefaultSkin(currentAccount.name);
                }
            }
            
            // Intentar seleccionar la skin del usuario en la lista
            if (this.userSkinPath) {
                const userSkinItem = this.findSkinItemByPath(this.userSkinPath);
                if (userSkinItem) {
                    // Añadir una clase identificativa a esta skin
                    userSkinItem.classList.add('user-current-skin');
                    // Hacer scroll hasta la skin del usuario
                    setTimeout(() => {
                        userSkinItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, 500);
                }
            }
            
        } catch (error) {
            console.error('Error al cargar la skin actual:', error);
            document.querySelector('.current-skin-name').textContent = 'Error al cargar skin';
            document.querySelector('.current-skin-details').textContent = 'Intenta nuevamente más tarde';
        }
    }

    // Método auxiliar para cargar la skin por defecto
    loadDefaultSkin(username) {
        try {
            this.skinViewer.loadSkin('assets/images/default/steve-skin.png');
            document.querySelector('.current-skin-name').textContent = 'Skin por defecto';
            document.querySelector('.current-skin-details').textContent = `Cuenta: ${username || 'Desconocida'}`;
            this.currentSkin = null;
        } catch (error) {
            console.error('Error al cargar skin por defecto:', error);
        }
    }
    
    async applySkin(skin) {
        try {
            // Obtener la cuenta actualmente seleccionada
            const configClient = await this.db.readData('configClient');
            if (!configClient || !configClient.account_selected) {
                this.showNotification('No hay cuenta seleccionada.', 'error');
                return;
            }
            
            const currentAccount = await this.db.readData('accounts', configClient.account_selected);
            if (!currentAccount) {
                this.showNotification('No se pudo encontrar la cuenta seleccionada.', 'error');
                return;
            }
            
            // Verificar que sea una cuenta de Microsoft/Xbox
            if (!currentAccount.meta || (currentAccount.meta.type !== 'Xbox' && currentAccount.meta.type !== 'Microsoft')) {
                this.showNotification('Solo las cuentas de Xbox/Microsoft pueden cambiar de skin.', 'error');
                return;
            }
            
            // Crear popup de carga interactivo
            const loadingPopup = new popup();
            loadingPopup.openPopup({
                title: 'Aplicando skin',
                content: `<div class="skin-apply-progress">
                    <div class="progress-step active" data-step="1">Preparando skin</div>
                    <div class="progress-step" data-step="2">Conectando con los servicios</div>
                    <div class="progress-step" data-step="3">Aplicando cambios</div>
                </div>`,
                color: 'var(--color)',
                background: false,
                width: '400px'
            });
            
            // Leer el archivo de la skin y convertirlo a base64
            const skinData = fs.readFileSync(skin.path);
            const skinBase64 = skinData.toString('base64');
            const skinDataUrl = `data:image/png;base64,${skinBase64}`;
            
            // Verificar el tamaño y tipo de la piel antes de continuar
            const img = new Image();
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = skinDataUrl;
            });
            
            // Determinar correctamente si el modelo es slim o classic usando la detección de píxeles
            const skinVariant = await this.detectSkinModel(skinDataUrl);
            
            console.log(`Modelo de skin detectado: ${skinVariant}`);
            
            // Asegurar que el archivo es accesible
            if (!fs.existsSync(skin.path)) {
                throw new Error("No se puede acceder al archivo de skin seleccionado");
            }
            await this.updateApplyProgress(2);
            
            try {
                const token = currentAccount.access_token;
                if (!token) {
                    throw new Error("No hay token de acceso disponible");
                }                    
                
                const FormData = require('form-data');
                const form = new FormData();
                
                // Añadir el archivo de skin como stream
                form.append('file', fs.createReadStream(skin.path));
                
                // Importante: Incluir la variante en la forma correcta, según la API actual
                form.append('variant', skinVariant);
                
                console.log('Intentando subir skin con FormData');
                await this.updateApplyProgress(3);
                
                // Solo hacemos una llamada a la API para subir la skin con su variante
                const uploadResponse = await fetch(`https://api.minecraftservices.com/minecraft/profile/skins`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                    },
                    body: form
                }).catch(error => {
                    console.error('Error de red al subir la skin:', error);
                    throw new Error('Error de conexión al intentar subir la skin');
                });
                
                if (!uploadResponse.ok) {
                    const errorText = await uploadResponse.text();
                    console.error("Error al subir la skin:", uploadResponse.status, errorText);
                    throw new Error(`Error al subir la skin: ${uploadResponse.status} ${errorText}`);
                }
                
                console.log(`Skin aplicada correctamente con variante ${skinVariant}`);
                
                // Actualizar la información de la skin en la cuenta local
                if (!currentAccount.profile) {
                    currentAccount.profile = {};
                }
                
                if (!currentAccount.profile.skins) {
                    currentAccount.profile.skins = [];
                }
                
                // Crear objeto de skin con el modelo correcto
                const skinObj = {
                    id: `custom-${Date.now()}`,
                    state: "ACTIVE",
                    url: `file://${skin.path}`,
                    variant: skinVariant,
                    base64: skinBase64
                };
                
                // Actualizar la skin en el perfil de la cuenta
                currentAccount.profile.skins[0] = skinObj;
                await this.db.updateData('accounts', currentAccount, currentAccount.ID);
                
                // Obtener los datos actualizados de la cuenta después de cambiar la skin
                try {
                    const profileResponse = await fetch('https://api.minecraftservices.com/minecraft/profile', {
                        method: 'GET',
                        headers: {
                            'Authorization': `Bearer ${currentAccount.access_token}`
                        }
                    });
                    console.log('Skin aplicada correctamente en la cuenta de Minecraft');
                } catch (refreshError) {
                    console.warn("No se pudieron refrescar los datos de la cuenta, pero la skin debería haberse aplicado:", refreshError);
                }
                
                // Cerrar el popup de carga
                loadingPopup.closePopup();
                
                // Mostrar mensaje de éxito
                this.showNotification('¡Skin aplicada correctamente a tu cuenta de Minecraft!', 'success');
                
                // Actualizar la información de la skin actual en el visor
                document.querySelector('.current-skin-name').textContent = skin.name || 'Skin personalizada';
                document.querySelector('.current-skin-details').textContent = `Cuenta: ${currentAccount.name}`;
                
                // Actualizar la skin actual
                this.currentSkin = {
                    ...skin,
                    id: skinObj.id,
                    accountId: currentAccount.ID,
                    active: true
                };
                
            } catch (error) {
                console.error('Error al subir la skin:', error);
                throw new Error('Error al subir la skin');
            }
        } catch (apiError) {
            this.handleSkinError(apiError, loadingPopup);
        }
    }
    
    async updateApplyProgress(step) {
        const steps = document.querySelectorAll('.progress-step');
        if (steps.length) {
            steps.forEach(stepEl => {
                const stepNum = parseInt(stepEl.getAttribute('data-step'));
                if (stepNum < step) {
                    stepEl.classList.remove('active');
                    stepEl.classList.add('completed');
                } else if (stepNum === step) {
                    stepEl.classList.add('active');
                } else {
                    stepEl.classList.remove('active', 'completed');
                }
            });
        }
        
        // Esperar un tiempo para que la animación sea visible
        return new Promise(resolve => setTimeout(resolve, 800));
    }
    
    showNotification(message, type = 'info') {
        try {
            const popupInstance = new popup();
            popupInstance.openPopup({
                title: type === 'error' ? 'Error' : type === 'success' ? 'Éxito' : 'Información',
                content: message,
                color: type === 'error' ? '#e21212' : type === 'success' ? '#4CAF50' : 'var(--color)',
                options: true
            });
        } catch (err) {
            // Fallback if popup fails
            console.error('Error mostrando notificación:', err);
            alert(message);
        }
    }
    
    handleSkinError(error, loadingPopup = null) {
        console.error('Error al aplicar la skin:', error);
        
        try {
            // Cerrar el popup de carga si existe
            if (loadingPopup) {
                try {
                    loadingPopup.closePopup();
                } catch (closeError) {
                    console.warn("Error al cerrar el popup:", closeError);
                }
            }
            
            // Cerrar cualquier popup de carga que pueda estar abierto (como fallback)
            document.querySelectorAll('.popup-window, .popup').forEach(popup => {
                if (popup.textContent && popup.textContent.includes('Aplicando skin')) {
                    try {
                        // Buscar el botón de cerrar y simulamos un clic
                        const closeBtn = popup.querySelector('.popup-btn, #okButton');
                        if (closeBtn) closeBtn.click();
                    } catch (btnError) {
                        console.warn("Error al hacer clic en botón de cierre:", btnError);
                    }
                }
            });
        } catch (popupError) {
            console.warn("No se pudo cerrar el popup correctamente:", popupError);
        }
        
        // Extraer mensaje de error más útil
        let errorMessage = "";
        if (typeof error === 'string') {
            errorMessage = error;
        } else if (error && error.message) {
            errorMessage = error.message;
        } else {
            errorMessage = "Error desconocido al aplicar la skin";
        }
        
        // Mostrar error con formato mejorado
        this.showNotification(`❌ ${errorMessage}`, 'error');
        
        // Reproducir sonido de error si está disponible
        try {
            const errorSound = new Audio('assets/sounds/error.mp3');
            errorSound.volume = 0.5;
            errorSound.play().catch(e => console.log('No se pudo reproducir sonido de error:', e));
        } catch (soundError) {
            // Ignorar errores de sonido
        }
    }
    
    async updateAccountInfo() {
        try {
            // Obtener la configuración del cliente para obtener la cuenta seleccionada
            const configClient = await this.db.readData('configClient');
            if (!configClient || !configClient.account_selected) {
                document.querySelector('.current-skin-details').textContent = 'No hay cuenta seleccionada';
                return;
            }
            
            // Obtener la cuenta actualmente seleccionada usando su ID
            const currentAccount = await this.db.readData('accounts', configClient.account_selected);
            if (!currentAccount) {
                document.querySelector('.current-skin-details').textContent = 'Cuenta no encontrada';
                return;
            }
            
            // Actualizar la información de la cuenta en el panel
            const accountInfoElement = document.querySelector('.current-skin-details');
            if (accountInfoElement) {
                accountInfoElement.textContent = `Seleccionada para: ${currentAccount.name}`;
            }
        } catch (error) {
            console.error('Error al actualizar información de cuenta:', error);
            document.querySelector('.current-skin-details').textContent = 'Error al obtener información de la cuenta';
        }
    }
    
    async detectSkinModel(skinUrl) {
        try {
            return new Promise((resolve) => {
                const img = new Image();
                img.crossOrigin = "Anonymous";
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    if (img.height === 64) {
                        const pixelData = ctx.getImageData(54, 20, 1, 1).data;
                        const isSlim = pixelData[3] === 0;
                        resolve(isSlim ? 'slim' : 'classic');
                    } else {
                        resolve('classic');
                    }
                };
                img.onerror = () => {
                    console.warn("No se pudo cargar la imagen para detectar modelo, asumiendo classic");
                    resolve('classic');
                };
                img.src = skinUrl;
            });
        } catch (error) {
            console.error("Error al detectar modelo de skin:", error);
            return 'classic';
        }
    }
}

export default Skins;
