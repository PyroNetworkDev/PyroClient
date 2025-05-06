/**
 * @author Luuxis
 * @license CC-BY-NC 4.0 - https://creativecommons.org/licenses/by-nc/4.0
 */

import { changePanel, accountSelect, database, Slider, config, setStatus, popup, appdata, clickableHead, getTermsAndConditions, setPerformanceMode, isPerformanceModeEnabled, getDiscordUsername, getDiscordPFP, setDiscordUsername } from '../utils.js'
import { deleteDiscordToken } from '../MKLib.js'
const os = require('os');
const { shell, ipcRenderer, dialog } = require('electron');
const { marked } = require('marked');
const fs = require('fs');
const path = require('path');

class Settings {
    static id = "settings";
    async init(config) {
        this.config = config;
        this.db = new database();
        this.navBTN()
        this.accounts()
        this.ram()
        this.javaPath()
        this.resolution()
        this.launcher()
        this.socials()
        this.terms()
        this.discordAccount()
        
        this.applyPerfModeOverridesIfNeeded();
        this.addAccountButtonEffects(); // Añadir efectos de pulsación a los botones de cuentas
        this.addConfigButtonEffects(); // Añadir efectos de pulsación a los botones de configuración
        
        // Make sure the add account button is visible
        this.ensureAddAccountButton();
    }
    
    // Ensure the "Add Account" button is displayed
    ensureAddAccountButton() {
        try {
            const accountsList = document.querySelector('.accounts-list');
            if (!accountsList) {
                console.error('Accounts list element not found');
                return;
            }
            
            // Check if the add button already exists
            let addButton = accountsList.querySelector('#add');
            if (addButton) {
                console.log('Add account button already exists');
                // Make sure it's visible
                addButton.style.display = 'flex';
                return;
            }
            
            // Create the add account button if it doesn't exist
            console.log('Creating add account button');
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
            
            // Apply button effects
            this.applyAccountButtonEffect(addAccountBtn);
        } catch (error) {
            console.error('Error ensuring add account button:', error);
        }
    }

    // Añadir efectos de pulsación a los botones de configuración
    addConfigButtonEffects() {
        // Aplicar efectos a los botones de Java Path
        const javaPathButtons = document.querySelectorAll('.java-path-btn');
        javaPathButtons.forEach(button => {
            this.applyButtonPressEffect(button);
        });

        // Aplicar efectos al botón de reset de resolución
        const resolutionResetBtn = document.querySelector('.size-reset');
        if (resolutionResetBtn) {
            this.applyButtonPressEffect(resolutionResetBtn);
        }

        // Aplicar efectos al botón de reset de max-files
        const maxFilesResetBtn = document.querySelector('.max-files-btn');
        if (maxFilesResetBtn) {
            this.applyButtonPressEffect(maxFilesResetBtn);
        }

        // Aplicar efectos a los botones de gestión de datos
        const dataManagementBtns = document.querySelectorAll('.data-management-btn');
        dataManagementBtns.forEach(button => {
            this.applyButtonPressEffect(button);
        });

        // Aplicar efectos a los campos numéricos
        const numericInputs = document.querySelectorAll('.input-resolution, .input-max-files');
        numericInputs.forEach(input => {
            input.addEventListener('focus', () => {
                input.style.borderColor = 'var(--box-button)';
                input.style.boxShadow = '0 0 8px rgba(0, 120, 189, 0.5)';
            });
            
            input.addEventListener('blur', () => {
                input.style.borderColor = 'rgba(255, 255, 255, 0.25)';
                input.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.2)';
            });
        });

        // Aplicar efectos a los opciones de comportamiento del launcher
        const behaviorOptions = document.querySelectorAll('.launcher-behavior-option');
        behaviorOptions.forEach(option => {
            option.addEventListener('mousedown', () => {
                if (!option.classList.contains('selected')) {
                    option.style.transform = 'translateY(2px)';
                    option.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.2)';
                }
            });
            
            option.addEventListener('mouseup', () => {
                if (!option.classList.contains('selected')) {
                    option.style.transform = '';
                    option.style.boxShadow = '';
                }
            });
            
            option.addEventListener('mouseleave', () => {
                if (!option.classList.contains('selected')) {
                    option.style.transform = '';
                    option.style.boxShadow = '';
                }
            });
        });
    }

    // Función para aplicar efecto de pulsación a un botón
    applyButtonPressEffect(button) {
        button.addEventListener('mousedown', () => {
            button.style.transform = 'translateY(3px)';
            button.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.2)';
        });
        
        button.addEventListener('mouseup', () => {
            button.style.transform = '';
            button.style.boxShadow = '';
        });
        
        button.addEventListener('mouseleave', () => {
            button.style.transform = '';
            button.style.boxShadow = '';
        });
    }

    // Añadir efecto de pulsación a los elementos de cuenta
    addAccountButtonEffects() {
        // Observador de mutaciones para aplicar efectos a elementos de cuenta que se añaden dinámicamente
        const observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === 1 && (node.classList.contains('account') || 
                                                    node.classList.contains('delete-profile'))) {
                            this.applyAccountButtonEffect(node);
                        }
                    });
                }
            });
        });

        // Comenzar a observar la lista de cuentas
        const accountsList = document.querySelector('.accounts-list');
        if (accountsList) {
            observer.observe(accountsList, { childList: true });
            
            // Aplicar efectos a los elementos existentes
            accountsList.querySelectorAll('.account, .delete-profile').forEach(element => {
                this.applyAccountButtonEffect(element);
            });
        }
    }

    // Aplicar efecto de pulsación a un elemento específico
    applyAccountButtonEffect(element) {
        if (element.classList.contains('account')) {
            // Para los elementos de cuenta completos
            element.addEventListener('mousedown', () => {
                if (!element.classList.contains('account-select')) {
                    element.style.transform = 'translateY(2px) scale(0.98)';
                }
            });
            
            element.addEventListener('mouseup', () => {
                if (!element.classList.contains('account-select')) {
                    element.style.transform = '';
                }
            });
            
            element.addEventListener('mouseleave', () => {
                if (!element.classList.contains('account-select')) {
                    element.style.transform = '';
                }
            });
        } else if (element.classList.contains('delete-profile')) {
            // Para los botones de eliminar
            element.addEventListener('mousedown', () => {
                element.style.transform = 'translateY(2px) scale(0.95)';
            });
            
            element.addEventListener('mouseup', () => {
                element.style.transform = '';
            });
            
            element.addEventListener('mouseleave', () => {
                element.style.transform = '';
            });
        }
    }

    async applyPerfModeOverridesIfNeeded() {
        if (isPerformanceModeEnabled()) {
            console.log("Applying performance mode overrides for settings panel");
            
            const containers = document.querySelectorAll('.container-settings');
            containers.forEach(container => {
                container.style.transition = 'none';
                container.style.transitionProperty = 'none';
                container.style.transitionDuration = '0s';
                
                if (container.classList.contains('active-container-settings')) {
                    container.style.transform = 'translateX(0)';
                    container.style.opacity = '1';
                    container.style.visibility = 'visible';
                } else {
                    container.style.transform = 'translateX(100%)';
                    container.style.opacity = '0';
                    container.style.visibility = 'hidden';
                }
            });
            
            document.querySelectorAll('.settings-elements-box, .titre-tab').forEach(el => {
                el.style.transition = 'none';
                el.style.animation = 'none';
            });
        }
    }

    navBTN() {
        document.querySelector('.nav-box').addEventListener('click', e => {
            if (e.target.classList.contains('nav-settings-btn')) {
                let id = e.target.id;
                let activeSettingsBTN = document.querySelector('.active-settings-BTN');
                let activeContainerSettings = document.querySelector('.active-container-settings');
                const performanceMode = isPerformanceModeEnabled();

                if (id == 'save') {
                    if (activeSettingsBTN) activeSettingsBTN.classList.toggle('active-settings-BTN');
                    document.querySelector('#account').classList.add('active-settings-BTN');

                    if (activeContainerSettings) {
                        if (performanceMode) {
                            activeContainerSettings.classList.remove('active-container-settings');
                            activeContainerSettings.style.opacity = '0';
                            activeContainerSettings.style.transform = 'translateX(100%)';
                            activeContainerSettings.style.visibility = 'hidden';
                        } else {
                            activeContainerSettings.classList.toggle('active-container-settings');
                        }
                    }

                    if (performanceMode) {
                        const accountTab = document.querySelector(`#account-tab`);
                        accountTab.classList.add('active-container-settings');
                        accountTab.style.opacity = '1';
                        accountTab.style.transform = 'translateX(0)';
                        accountTab.style.visibility = 'visible';
                    } else {
                        document.querySelector(`#account-tab`).classList.add('active-container-settings');
                    }
                    
                    return changePanel('home');
                }

                if (activeSettingsBTN) activeSettingsBTN.classList.toggle('active-settings-BTN');
                e.target.classList.add('active-settings-BTN');

                if (activeContainerSettings) {
                    if (performanceMode) {
                        activeContainerSettings.classList.remove('active-container-settings');
                        activeContainerSettings.style.opacity = '0';
                        activeContainerSettings.style.transform = 'translateX(100%)';
                        activeContainerSettings.style.visibility = 'hidden';
                        void activeContainerSettings.offsetWidth;
                    } else {
                        activeContainerSettings.classList.toggle('active-container-settings');
                    }
                }

                if (performanceMode) {
                    const newTab = document.querySelector(`#${id}-tab`);
                    
                    newTab.style.transition = 'none';
                    newTab.style.transitionProperty = 'none';
                    newTab.style.animation = 'none';
                    
                    void newTab.offsetWidth;
                    
                    newTab.classList.add('active-container-settings');
                    newTab.style.opacity = '1';
                    newTab.style.transform = 'translateX(0)';
                    newTab.style.visibility = 'visible';
                } else {
                    document.querySelector(`#${id}-tab`).classList.add('active-container-settings');
                }
            }
        });

        // Efectos de presionado para los botones de navegación
        const navButtons = document.querySelectorAll('.nav-settings-btn');
        navButtons.forEach(button => {
            button.addEventListener('mousedown', () => {
                if (!button.classList.contains('active-settings-BTN')) {
                    button.style.transform = 'translateY(1px) scale(0.98)';
                }
            });
            
            button.addEventListener('mouseup', () => {
                if (!button.classList.contains('active-settings-BTN')) {
                    button.style.transform = '';
                }
            });
            
            button.addEventListener('mouseleave', () => {
                if (!button.classList.contains('active-settings-BTN')) {
                    button.style.transform = '';
                }
            });
        });
    }

    accounts() {
        document.querySelector('.accounts-list').addEventListener('click', async e => {
            let popupAccount = new popup();
            try {
                let id = e.target.id;
                if (e.target.classList.contains('account')) {
                    popupAccount.openPopup({
                        title: 'Iniciar sesión',
                        content: 'Espere, por favor...',
                        color: 'var(--color)'
                    });

                    if (id == 'add') {
                        document.querySelector('.cancel-home').style.display = 'inline';
                        document.querySelector('.cancel-AZauth').style.display = 'inline';
                        document.querySelector('.cancel-offline').style.display = 'inline';
                        popupAccount.closePopup();
                        return changePanel('login');
                    }

                    // Primero comprobamos si la cuenta existe 
                    console.log(`Verificando cuenta con ID: ${id}`);
                    let allAccounts = await this.db.readAllData('accounts');
                    console.log(`Total de cuentas encontradas: ${allAccounts.length}`);
                    let account = allAccounts.find(acc => String(acc.ID) === String(id));

                    if (!account) {
                        console.error(`No se encontró cuenta con ID: ${id}`);
                        popupAccount.closePopup();
                        popupAccount.openPopup({
                            title: 'Error',
                            content: `No se pudo encontrar la cuenta seleccionada (ID: ${id}). La cuenta podría haber sido eliminada o dañada.`,
                            color: 'red',
                            options: true
                        });
                        return;
                    }

                    console.log(`Cuenta encontrada: ${account.name} (ID: ${account.ID})`);
                    let configClient = await this.setInstance(account);
                    await accountSelect(account);
                    
                    if (account.meta && account.meta.type == 'AZauth') {
                        clickableHead(true);
                    } else {
                        clickableHead(false);
                    }
                    
                    configClient.account_selected = account.ID;
                    console.log(`Actualizando cuenta seleccionada en configClient a: ${account.ID}`);
                    await this.db.updateData('configClient', configClient);
                    popupAccount.closePopup();
                    return;
                }

                if (e.target.classList.contains("delete-profile") || e.target.classList.contains("icon-account-delete")) {
                    // Asegurarse de obtener el id correcto, ya sea del elemento o de su padre
                    let deleteId = id;
                    if (e.target.classList.contains("icon-account-delete")) {
                        deleteId = e.target.parentElement.id;
                    }
                    
                    if (!deleteId) {
                        popupAccount.closePopup();
                        popupAccount.openPopup({
                            title: 'Error',
                            content: 'No se pudo identificar la cuenta a eliminar.',
                            color: 'red',
                            options: true
                        });
                        return;
                    }

                    console.log(`Starting deletion process for account ID: ${deleteId}`);

                    // Pedir confirmación antes de eliminar
                    const confirmResult = await new Promise(resolve => {
                        popupAccount.openDialog({
                            title: 'Confirmar eliminación',
                            content: '¿Estás seguro de que quieres eliminar esta cuenta?',
                            options: true,
                            callback: resolve
                        });
                    });

                    if (confirmResult === 'cancel') {
                        console.log("Account deletion cancelled by user");
                        return;
                    }

                    popupAccount.openPopup({
                        title: 'Eliminando cuenta',
                        content: 'Espere, por favor...',
                        color: 'var(--color)'
                    });

                    // Before deletion, verify that the account exists
                    let allAccounts = await this.db.readAllData('accounts');
                    console.log(`Found ${allAccounts.length} accounts before deletion`);
                    console.log(`Current accounts: ${allAccounts.map(acc => `${acc.name}(${acc.ID})`).join(', ')}`);
                    
                    // Verify using both string and number comparison
                    let accountToDelete = allAccounts.find(acc => 
                        String(acc.ID) === String(deleteId) || Number(acc.ID) === Number(deleteId)
                    );

                    if (!accountToDelete) {
                        popupAccount.closePopup();
                        popupAccount.openPopup({
                            title: 'Error',
                            content: `No se pudo encontrar la cuenta a eliminar (ID: ${deleteId}).`,
                            color: 'red',
                            options: true
                        });
                        return;
                    }
                    
                    console.log(`Found account to delete: ${accountToDelete.name} with ID ${accountToDelete.ID}`);
                    
                    // Get configClient BEFORE attempting to delete the account
                    let configClient = await this.db.readData('configClient');
                    if (!configClient) {
                        configClient = {
                            account_selected: null,
                            instance_selct: null,
                            launcher_config: {
                                closeLauncher: "close-launcher",
                                download_multi: 3,
                                theme: "auto",
                                music_muted: false,
                                performance_mode: false
                            }
                        };
                    }

                    // Guardar una copia de la configuración original por si acaso
                    const originalConfig = JSON.parse(JSON.stringify(configClient));

                    // Perform the account deletion
                    console.log(`Deleting account with ID: ${deleteId}`);
                    const deleted = await this.db.deleteData('accounts', deleteId);
                    
                    if (!deleted) {
                        popupAccount.closePopup();
                        popupAccount.openPopup({
                            title: 'Error',
                            content: `No se pudo eliminar la cuenta (ID: ${deleteId}).`,
                            color: 'red',
                            options: true
                        });
                        return;
                    }
                    
                    // Verify the deletion was successful
                    allAccounts = await this.db.readAllData('accounts');
                    console.log(`Found ${allAccounts.length} accounts after deletion`);
                    console.log(`Updated accounts: ${allAccounts.map(acc => `${acc.name}(${acc.ID})`).join(', ')}`);
                    
                    // Double-check the account was actually deleted
                    const stillExists = allAccounts.some(acc => 
                        String(acc.ID) === String(deleteId) || Number(acc.ID) === Number(deleteId)
                    );
                    
                    if (stillExists) {
                        console.error(`Account with ID ${deleteId} still exists after deletion!`);
                        popupAccount.closePopup();
                        popupAccount.openPopup({
                            title: 'Error',
                            content: `Ocurrió un error al eliminar la cuenta. Por favor, inténtalo de nuevo.`,
                            color: 'red',
                            options: true
                        });
                        return;
                    }

                    // Remove the account element from the UI
                    let deleteProfile = document.getElementById(`${deleteId}`);
                    let accountListElement = document.querySelector('.accounts-list');
                    
                    if (deleteProfile && accountListElement.contains(deleteProfile)) {
                        accountListElement.removeChild(deleteProfile);
                        console.log(`Removed account element from UI (ID: ${deleteId})`);
                    } else {
                        console.warn(`No se encontró el elemento DOM para la cuenta ID: ${deleteId}`);
                    }

                    // If the deleted account was selected, update the selection
                    if (configClient.account_selected == deleteId) {
                        console.log(`Deleted account was the selected one (ID: ${deleteId})`);
                        
                        // Find another account to select
                        if (allAccounts.length > 0) {
                            const nextAccount = allAccounts[0];
                            configClient.account_selected = nextAccount.ID;
                            console.log(`Setting new selected account: ${nextAccount.name} (ID: ${nextAccount.ID})`);
                            
                            await accountSelect(nextAccount);
                            
                            // Verificar si se debe habilitar la personalización de skin
                            if (nextAccount.meta && nextAccount.meta.type === 'AZauth') {
                                clickableHead(true);
                            } else {
                                clickableHead(false);
                            }
                            
                            try {
                                let newInstanceSelect = await this.setInstance(nextAccount);
                                configClient.instance_selct = newInstanceSelect.instance_selct;
                                
                                // Guardar la nueva configuración
                                await this.db.updateData('configClient', configClient);
                                console.log(`Updated configClient with new selections`);
                            } catch (error) {
                                console.warn(`Error al obtener instancia después de cambiar cuenta: ${error.message}`);
                                // Continuar con la configuración actual si hay un error
                                await this.db.updateData('configClient', configClient);
                            }
                            
                            popupAccount.closePopup();
                            
                            // Mensaje mejorado cuando la cuenta eliminada era la seleccionada
                            popupAccount.openPopup({
                                title: 'Cuenta eliminada',
                                content: `La cuenta se eliminó correctamente. Se ha seleccionado automáticamente la cuenta ${nextAccount.name}.`,
                                color: 'var(--color)',
                                options: true
                            });
                        } else {
                            // No accounts left - CRITICAL CASE
                            console.log(`No accounts left, clearing account selection and resetting configClient`);
                            
                            // Asegurarse de que account_selected sea null
                            configClient.account_selected = null;
                            
                            // Guardar la configuración actualizada
                            await this.db.updateData('configClient', configClient);
                            
                            popupAccount.closePopup();
                            popupAccount.openPopup({
                                title: 'Cuenta eliminada',
                                content: 'La cuenta se eliminó correctamente. Serás redirigido al panel de inicio de sesión ya que no quedan cuentas disponibles.',
                                color: 'var(--color)',
                                options: true,
                                callback: () => {
                                    // Asegurar que se redirija al login después de cerrar el popup
                                    changePanel('login');
                                }
                            });
                        }
                    } else {
                        // La cuenta eliminada no era la seleccionada
                        // Asegurarnos de que configClient sigue teniendo account_selected válido
                        if (allAccounts.length === 0) {
                            configClient.account_selected = null;
                        } else if (configClient.account_selected) {
                            // Verificar que la cuenta seleccionada siga existiendo
                            const accountExists = allAccounts.some(acc => 
                                Number(acc.ID) === Number(configClient.account_selected) || 
                                String(acc.ID) === String(configClient.account_selected)
                            );
                            
                            if (!accountExists) {
                                console.warn(`Selected account ${configClient.account_selected} no longer exists, selecting first available`);
                                configClient.account_selected = allAccounts[0].ID;
                            }
                        }
                        
                        // Guardar la configuración actualizada
                        await this.db.updateData('configClient', configClient);
                        
                        popupAccount.closePopup();
                        
                        // Mensaje cuando se elimina una cuenta que no era la seleccionada
                        popupAccount.openPopup({
                            title: 'Cuenta eliminada',
                            content: 'La cuenta se eliminó correctamente.',
                            color: 'var(--color)',
                            options: true
                        });
                    }
                    
                    // Ensure the "add account" button is visible
                    this.ensureAddAccountButton();
                }
            } catch (err) {
                console.error('Error al cambiar/eliminar cuenta:', err);
                popupAccount.closePopup();
                popupAccount.openPopup({
                    title: 'Error',
                    content: `Ha ocurrido un error: ${err.message}`,
                    color: 'red',
                    options: true
                });
            }
        });
    }

    async setInstance(auth) {
        if (!auth || typeof auth.name === 'undefined') {
            console.warn('Invalid account data received in setInstance:', auth);
            return await this.db.readData('configClient') || { instance_selct: null };
        }

        let configClient = await this.db.readData('configClient') || { instance_selct: null };
        let instanceSelect = configClient.instance_selct;
        
        try {
            let instancesList = await config.getInstanceList();
            
            if (!instancesList || instancesList.length === 0) {
                console.log("No instances available");
                return configClient;
            }

            for (let instance of instancesList) {
                if (instance.whitelistActive) {
                    let whitelist = instance.whitelist.find(whitelist => whitelist == auth.name);
                    if (whitelist !== auth.name) {
                        if (instance.name == instanceSelect) {
                            let newInstanceSelect = instancesList.find(i => i.whitelistActive == false);
                            if (!newInstanceSelect && instancesList.length > 0) {
                                newInstanceSelect = instancesList[0];
                            }
                            
                            if (newInstanceSelect) {
                                configClient.instance_selct = newInstanceSelect.name;
                                await setStatus(newInstanceSelect);
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.warn(`Error al obtener lista de instancias en setInstance: ${error.message}`);
            // Continuar con la configuración actual si hay un error al obtener instancias
        }
        
        return configClient;
    }

    async ram() {
        let config = await this.db.readData('configClient');
        let totalMem = Math.trunc(os.totalmem() / 1073741824 * 10) / 10;
        let freeMem = Math.trunc(os.freemem() / 1073741824 * 10) / 10;

        document.getElementById("total-ram").textContent = `${totalMem} GB`;
        document.getElementById("free-ram").textContent = `${freeMem} GB`;

        let sliderDiv = document.querySelector(".memory-slider");
        sliderDiv.setAttribute("max", Math.trunc((80 * totalMem) / 100));

        let ram = config?.java_config?.java_memory ? {
            ramMin: config.java_config.java_memory.min,
            ramMax: config.java_config.java_memory.max
        } : { ramMin: "1", ramMax: "2" };

        if (totalMem < ram.ramMin) {
            config.java_config.java_memory = { min: 1, max: 2 };
            this.db.updateData('configClient', config);
            ram = { ramMin: "1", ramMax: "2" }
        };

        class SettingsSlider {
            constructor(element, minValue, maxValue) {
                this.element = document.querySelector(element);
                this.min = Math.max(0.5, parseFloat(this.element.getAttribute('min')) || 0.5);
                this.max = parseFloat(this.element.getAttribute('max')) || 8;
                this.step = parseFloat(this.element.getAttribute('step')) || 0.5;
                this.normalizeFact = 18;
                
                this.touchLeft = this.element.querySelector('.slider-touch-left');
                this.touchRight = this.element.querySelector('.slider-touch-right');
                this.lineSpan = this.element.querySelector('.slider-line span');
                
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
                    // Ensure the left handle doesn't move beyond the right handle minus necessary gap
                    // Calculate position that would create a 2GB gap
                    const minGapInGB = 2; // Minimum gap in GB
                    const gapRatio = minGapInGB / (this.max - this.min);
                    const gapPixels = gapRatio * (this.element.offsetWidth - (this.normalizeFact * 2));
                    
                    const rightHandlePosition = this.touchRight.offsetLeft;
                    newX = Math.min(newX, rightHandlePosition - gapPixels);
                    
                    this.touchLeft.style.left = `${newX}px`;
                    this.lineSpan.style.marginLeft = `${newX}px`;
                } else {
                    // Ensure the right handle doesn't move before the left handle plus necessary gap
                    // Calculate position that would create a 2GB gap
                    const minGapInGB = 2; // Minimum gap in GB
                    const gapRatio = minGapInGB / (this.max - this.min);
                    const gapPixels = gapRatio * (this.element.offsetWidth - (this.normalizeFact * 2));
                    
                    const leftHandlePosition = this.touchLeft.offsetLeft;
                    newX = Math.max(newX, leftHandlePosition + gapPixels);
                    
                    this.touchRight.style.left = `${newX}px`;
                }
                
                this.lineSpan.style.width = `${this.touchRight.offsetLeft - this.touchLeft.offsetLeft}px`;
                
                let minValue = this.getMinValue();
                let maxValue = this.getMaxValue();
                
                // Additional check to ensure min is never larger than max - minGapInGB
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
            }
            
            on(event, callback) {
                if (event === 'change') {
                    this.callbacks.push(callback);
                }
            }
        }

        // Initialize the new slider with the existing values
        const settingsSlider = new SettingsSlider(".memory-slider", parseFloat(ram.ramMin), parseFloat(ram.ramMax));
        
        // Set up the slider callback to update the config
        settingsSlider.on('change', async (min, max) => {
            let config = await this.db.readData('configClient');
            config.java_config.java_memory = { min: min, max: max };
            this.db.updateData('configClient', config);
        });
    }

    async javaPath() {
        let javaPathText = document.querySelector(".java-path-txt");
        if (javaPathText) {
            javaPathText.textContent = `${await appdata()}/${process.platform == 'darwin' ? this.config.dataDirectory : `.${this.config.dataDirectory}`}/runtime`;
        }

        let configClient = await this.db.readData('configClient')
        let javaPath = configClient?.java_config?.java_path || 'Utilice la versión de java suministrada con el launcher';
        let javaPathInputTxt = document.querySelector(".java-path-input-text");
        let javaPathInputFile = document.querySelector(".java-path-input-file");
        
        if (javaPathInputTxt) {
            javaPathInputTxt.value = javaPath;
        }

        let javaPathSetBtn = document.querySelector(".java-path-set");
        let javaPathResetBtn = document.querySelector(".java-path-reset");

        if (javaPathSetBtn) {
            javaPathSetBtn.addEventListener("click", async () => {
                if (!javaPathInputFile) return;
                
                javaPathInputFile.value = '';
                javaPathInputFile.click();
                await new Promise((resolve) => {
                    let interval;
                    interval = setInterval(() => {
                        if (javaPathInputFile.value != '') resolve(clearInterval(interval));
                    }, 100);
                });

                if (javaPathInputFile.value.replace(".exe", '').endsWith("java") || javaPathInputFile.value.replace(".exe", '').endsWith("javaw")) {
                    let configClient = await this.db.readData('configClient')
                    let file = javaPathInputFile.files[0].path;
                    if (javaPathInputTxt) {
                        javaPathInputTxt.value = file;
                    }
                    configClient.java_config.java_path = file
                    await this.db.updateData('configClient', configClient);
                } else alert("El nombre del archivo debe ser java o javaw");
            });
        }

        if (javaPathResetBtn) {
            javaPathResetBtn.addEventListener("click", async () => {
                let configClient = await this.db.readData('configClient')
                if (javaPathInputTxt) {
                    javaPathInputTxt.value = 'Utilice la versión de java suministrada con el launcher';
                }
                configClient.java_config.java_path = null
                await this.db.updateData('configClient', configClient);
            });
        }
    }

    async resolution() {
        let configClient = await this.db.readData('configClient')
        let resolution = configClient?.game_config?.screen_size || { width: 1920, height: 1080 };

        let width = document.querySelector(".width-size");
        let height = document.querySelector(".height-size");
        let resolutionReset = document.querySelector(".size-reset");

        width.value = resolution.width;
        height.value = resolution.height;

        width.addEventListener("change", async () => {
            let configClient = await this.db.readData('configClient')
            configClient.game_config.screen_size.width = width.value;
            await this.db.updateData('configClient', configClient);
        })

        height.addEventListener("change", async () => {
            let configClient = await this.db.readData('configClient')
            configClient.game_config.screen_size.height = height.value;
            await this.db.updateData('configClient', configClient);
        })

        resolutionReset.addEventListener("click", async () => {
            let configClient = await this.db.readData('configClient')
            configClient.game_config.screen_size = { width: '854', height: '480' };
            width.value = '854';
            height.value = '480';
            await this.db.updateData('configClient', configClient);
        })
    }

    async launcher() {
        let configClient = await this.db.readData('configClient');

        let maxDownloadFiles = configClient?.launcher_config?.download_multi || 3;
        let maxDownloadFilesInput = document.querySelector(".max-files");
        let maxDownloadFilesReset = document.querySelector(".max-files-reset");
        
        if (maxDownloadFilesInput) {
            maxDownloadFilesInput.value = maxDownloadFiles;

            maxDownloadFilesInput.addEventListener("change", async () => {
                let configClient = await this.db.readData('configClient')
                configClient.launcher_config.download_multi = maxDownloadFilesInput.value;
                await this.db.updateData('configClient', configClient);
            });
        }

        if (maxDownloadFilesReset) {
            maxDownloadFilesReset.addEventListener("click", async () => {
                let configClient = await this.db.readData('configClient')
                if (maxDownloadFilesInput) {
                    maxDownloadFilesInput.value = 3;
                }
                configClient.launcher_config.download_multi = 3;
                await this.db.updateData('configClient', configClient);
            });
        }

        const performanceModeCheckbox = document.querySelector(".performance-mode-checkbox");
        if (performanceModeCheckbox) {
            let configClient = await this.db.readData('configClient');
            performanceModeCheckbox.checked = configClient?.launcher_config?.performance_mode || false;
            
            performanceModeCheckbox.addEventListener("change", async () => {
                let configClient = await this.db.readData('configClient');
                configClient.launcher_config.performance_mode = performanceModeCheckbox.checked;
                await this.db.updateData('configClient', configClient);
                
                let performanceModePopup = new popup();
                let dialogResult = await new Promise((resolve) => {
                    performanceModePopup.openDialog({
                      title: performanceModeCheckbox.checked ? 'Modo de rendimiento activado' : 'Modo de rendimiento desactivado',
                      content:
                        "Para aplicar completamente los cambios del modo de rendimiento, es necesario reiniciar el launcher. Esto eliminará todas las transiciones y efectos visuales para mejorar el rendimiento. <br><br>¿Desea reiniciar el launcher ahora?",
                      options: true,
                      callback: resolve,
                    });
                  });
            
                  if (dialogResult === "cancel") {
                    return;
                  } else {
                    ipcRenderer.send("app-restart");
                  }
            });
        }

        let closeLauncher = configClient?.launcher_config?.closeLauncher || "close-launcher";
        let behaviorOptions = document.querySelectorAll('.launcher-behavior-option');
        
        behaviorOptions.forEach(option => {
            if (option.dataset.value === closeLauncher) {
                option.classList.add('selected');
            }
            
            option.addEventListener('click', async () => {
                behaviorOptions.forEach(opt => opt.classList.remove('selected'));
                
                option.classList.add('selected');
                
                let configClient = await this.db.readData('configClient');
                configClient.launcher_config.closeLauncher = option.dataset.value;
                await this.db.updateData('configClient', configClient);
            });
        });

        const resetConfigBtn = document.querySelector('.reset-config-btn');
        const deleteAllBtn = document.querySelector('.delete-all-btn');

        if (resetConfigBtn) {
            resetConfigBtn.addEventListener('click', async () => {
                this.handleResetConfig();
            });
        }

        if (deleteAllBtn) {
            deleteAllBtn.addEventListener('click', async () => {
                this.handleDeleteAll();
            });
        }
    }

    async handleResetConfig() {
        const resetPopup = new popup();
        const result = await new Promise(resolve => {
            resetPopup.openDialog({
                title: 'Reiniciar configuración',
                content: '¿Estás seguro de que quieres reiniciar toda la configuración del launcher? Esta acción no puede deshacerse y el launcher se reiniciará.<br><br>Los archivos del juego (assets, bibliotecas, instancias) no se eliminarán.',
                options: true,
                callback: resolve
            });
        });

        if (result === 'cancel') {
            return;
        }
        
        try {
            const processingPopup = new popup();
            processingPopup.openPopup({
                title: 'Reiniciando configuración',
                content: 'Por favor, espera mientras se reinicia la configuración...',
                color: 'var(--color)'
            });
            
            console.log('Limpiando archivos de configuración...');
            
            // Eliminar solo los archivos de configuración
            await this.db.clearDatabase();
            
            // Esperar un momento antes de reiniciar
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            processingPopup.closePopup();
            console.log('Reiniciando launcher...');
            ipcRenderer.send('app-restart');
            
        } catch (error) {
            console.error('Error resetting config:', error);
            const errorPopup = new popup();
            errorPopup.openPopup({
                title: 'Error',
                content: `Ha ocurrido un error al reiniciar la configuración: ${error.message}`,
                color: 'red',
                options: true
            });
        }
    }

    async handleDeleteAll() {
        const deletePopup = new popup();
        const result = await new Promise(resolve => {
            deletePopup.openDialog({
                title: 'Eliminar todos los datos',
                content: '⚠️ ADVERTENCIA ⚠️<br><br>¿Estás seguro de que quieres eliminar TODOS los datos del launcher? Esta acción eliminará:<br>- Todas las configuraciones<br>- Todas las instancias de juego<br>- Todos los assets y bibliotecas descargados<br><br>Esta acción no puede deshacerse y el launcher se reiniciará.',
                options: true,
                callback: resolve
            });
        });

        if (result === 'cancel') {
            return;
        }
        
        const confirmDeletePopup = new popup();
        const confirmResult = await new Promise(resolve => {
            confirmDeletePopup.openDialog({
                title: 'Confirmar eliminación total',
                content: '¿Estás ABSOLUTAMENTE seguro? Esta acción eliminará todos los datos y no podrás recuperarlos.',
                options: true,
                callback: resolve
            });
        });

        if (confirmResult === 'cancel') {
            return;
        }
        
        try {
            const processingPopup = new popup();
            processingPopup.openPopup({
                title: 'Eliminando datos',
                content: 'Por favor, espera mientras se eliminan todos los datos...',
                color: 'var(--color)'
            });
            
            const appdataPath = await appdata();
            const dataPath = path.join(
                appdataPath,
                process.platform == 'darwin' ? this.config.dataDirectory : `.${this.config.dataDirectory}`
            );
            
            // Limpiar base de datos y archivos encriptados
            console.log('Limpiando base de datos y archivos encriptados...');
            await this.db.clearDatabase();
            
            // Eliminar directorio de datos
            if (fs.existsSync(dataPath)) {
                await this.recursiveDelete(dataPath);
                console.log('Data directory deleted successfully');
            }
            
            // Wait a moment before restarting
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Restart the launcher
            processingPopup.closePopup();
            ipcRenderer.send('app-restart');
            
        } catch (error) {
            console.error('Error deleting all data:', error);
            const errorPopup = new popup();
            errorPopup.openPopup({
                title: 'Error',
                content: `Ha ocurrido un error al eliminar los datos: ${error.message}`,
                color: 'red',
                options: true
            });
        }
    }

    async recursiveDelete(directoryPath) {
        return new Promise((resolve, reject) => {
            if (typeof fs.rm === 'function') {
                fs.rm(directoryPath, { recursive: true, force: true }, err => {
                    if (err) reject(err);
                    else resolve();
                });
            } 
            else {
                fs.rmdir(directoryPath, { recursive: true }, err => {
                    if (err) reject(err);
                    else resolve();
                });
            }
        });
    }

    async socials() {
        document.querySelectorAll('.external').forEach(link => {
            link.addEventListener('click', (event) => {
                event.preventDefault();
                const url = link.getAttribute('href');
                shell.openExternal(url);
            });
        });
    }

    async terms() {
        try {
            const result = await getTermsAndConditions();
        
            const termsContainer = document.querySelector('.info-container');
            const lastModifiedText = `<strong>Última modificación:</strong> ${result.lastModified === 'desconocida' ? 'Desconocida' : new Date(result.lastModified).toLocaleString()}`;
        
            const metaInfoHTML = `
                <p>${lastModifiedText}</p>
                <hr />
            `;
        
            termsContainer.innerHTML = metaInfoHTML + result.htmlContent;
            termsContainer.querySelectorAll('a').forEach(link => {
                link.addEventListener('click', (event) => {
                    event.preventDefault();
                    const url = event.target.href;
                    shell.openExternal(url);
                });
            });
        } catch (error) {
            console.error('Error al inicializar los términos y condiciones:', error);
            const termsContainer = document.querySelector('.info-container');
            termsContainer.innerHTML = '<p>Ha ocurrido un error al cargar los términos y condiciones.</p>';
        }
    }

    async discordAccount() {
        let discordLogoutBtn = document.querySelector('.discord-logout-btn');
        let discordUsername = await getDiscordUsername();
        let discordUsernameText = document.querySelector('.profile-username');
        let discordPFP = await getDiscordPFP();
        let discordPFPElement = document.querySelector('.discord-profile-image');
        let discordAccountManager = document.querySelector('#discord-account-manager');
        
        if (discordAccountManager) discordAccountManager.style.display = 'block';

        if (discordLogoutBtn) {
            discordLogoutBtn.addEventListener('click', async () => {
                const logoutPopup = new popup();
                const result = await new Promise(resolve => {
                    logoutPopup.openDialog({
                        title: 'Cerrar sesión de Discord',
                        content: '¿Estás seguro de que quieres cerrar sesión de Discord? El launcher se reiniciará.',
                        options: true,
                        callback: resolve
                    });
                });

                if (result === 'cancel') return;

                const processingPopup = new popup();
                processingPopup.openPopup({
                    title: 'Cerrando sesión',
                    content: 'Por favor, espera mientras se cierra la sesión...',
                    color: 'var(--color)'
                });

                try {
                    await deleteDiscordToken();
                    
                    await setDiscordUsername('');
                    
                    await new Promise(resolve => setTimeout(resolve, 500));
                    
                    ipcRenderer.send('app-restart');
                } catch (error) {
                    console.error('Error al cerrar sesión de Discord:', error);
                    
                    processingPopup.closePopup();
                    const errorPopup = new popup();
                    errorPopup.openPopup({
                        title: 'Error',
                        content: `Ha ocurrido un error al cerrar sesión: ${error.message}`,
                        color: 'red',
                        options: true
                    });
                }
            });
        }
    }
}
export default Settings;