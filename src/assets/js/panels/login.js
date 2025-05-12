/**
 * @author MiguelkiNetwork (based on work by Luuxis)
 * @license CC-BY-NC 4.0 - https://creativecommons.org/licenses/by-nc/4.0
 */
const { AZauth, Mojang } = require('minecraft-java-core');
const { ipcRenderer } = require('electron');

import { popup, database, changePanel, accountSelect, addAccount, config, setStatus, setUsername, clickableHead, getDiscordUsername } from '../utils.js';
import { getHWID, loginMSG, verificationError } from '../MKLib.js';

class Login {
    static id = "login";
    async init(config) {
        this.config = config;
        this.db = new database();
        
        console.log('Initializing login system');
        
        // Handle login method based on configuration
        if (typeof this.config.online == 'boolean') {
            this.config.online ? this.getMicrosoft() : this.getCrack();
        } else if (typeof this.config.online == 'string') {
            if (this.config.online.match(/^(http|https):\/\/[^ "]+$/)) {
                this.getAZauth();
            }
        }
        
        // Set up cancel buttons
        document.querySelector('.cancel-home').addEventListener('click', () => {
            document.querySelector('.cancel-home').style.display = 'none';
            changePanel('settings');
        });
        
        document.querySelector('.cancel-AZauth').addEventListener('click', () => {
            document.querySelector('.cancel-AZauth').style.display = 'none';
            changePanel('settings');
        });
        
        document.querySelector('.cancel-offline').addEventListener('click', () => {
            document.querySelector('.cancel-offline').style.display = 'none';
            changePanel('settings');
        });
        
        document.querySelector('.register-azauth').addEventListener('click', () => {
            ipcRenderer.send('create-register-window');
        });
    }

    async getMicrosoft() {
        console.log('Setting up Microsoft login...');
        let popupLogin = new popup();
        let loginHome = document.querySelector('.login-home');
        let microsoftBtn = document.querySelector('.connect-home');
        loginHome.style.display = 'block';

        microsoftBtn.addEventListener("click", () => {
            popupLogin.openPopup({
                title: 'Iniciar sesión',
                content: 'Por favor continua en la ventana de inicio de sesión de Microsoft...',
                color: 'var(--color)'
            });

            ipcRenderer.invoke('Microsoft-window', this.config.client_id)
                .then(async account_connect => {
                    if (account_connect == 'cancel' || !account_connect) {
                        popupLogin.closePopup();
                        return;
                    } else {
                        try {
                            await this.saveData(account_connect);
                            clickableHead(false);
                        } catch (error) {
                            console.error('Error saving Microsoft account:', error);
                            popupLogin.openPopup({
                                title: 'Error',
                                content: 'Ocurrió un error al guardar la cuenta. Intente nuevamente.',
                                options: true
                            });
                        }
                        popupLogin.closePopup();
                    }
                })
                .catch(err => {
                    console.error('Microsoft login error:', err);
                    popupLogin.openPopup({
                        title: 'Error',
                        content: err?.message || 'Error al iniciar sesión con Microsoft.',
                        options: true
                    });
                });
        });
    }

    async getCrack() {
        console.log('Setting up offline login...');
        let popupLogin = new popup();
        let loginOffline = document.querySelector('.login-offline');
        let microsoftcracked = document.querySelector('.connect-microsoftcracked');
        let emailOffline = document.querySelector('.email-offline');
        let connectOffline = document.querySelector('.connect-offline');
        loginOffline.style.display = 'block';

        microsoftcracked.addEventListener('click', () => {
            popupLogin.openPopup({
                title: 'Iniciar sesión',
                content: 'Por favor continua en la ventana de inicio de sesión de Microsoft...',
                color: 'var(--color)'
            });

            ipcRenderer.invoke('Microsoft-window', this.config.client_id)
                .then(async account_connect => {
                    if (account_connect == 'cancel' || !account_connect) {
                        popupLogin.closePopup();
                        return;
                    } else {
                        try {
                            await this.saveData(account_connect);
                            clickableHead(false);
                        } catch (error) {
                            console.error('Error saving Microsoft account:', error);
                            popupLogin.openPopup({
                                title: 'Error',
                                content: 'Ocurrió un error al guardar la cuenta. Intente nuevamente.',
                                options: true
                            });
                        }
                        popupLogin.closePopup();
                    }
                })
                .catch(err => {
                    console.error('Microsoft login error:', err);
                    popupLogin.openPopup({
                        title: 'Error',
                        content: err?.message || 'Error al iniciar sesión con Microsoft.',
                        options: true
                    });
                });
        });

        connectOffline.addEventListener('click', async () => {
            connectOffline.disabled = true;
            popupLogin.openPopup({
                title: 'Iniciando sesión...',
                content: 'Por favor, espere...',
                color: 'var(--color)'
            });
            
            try {
                // Validate username
                if (emailOffline.value.length < 3) {
                    popupLogin.closePopup();
                    popupLogin.openPopup({
                        title: 'Error',
                        content: 'Tu nombre de usuario debe tener al menos 3 caracteres.',
                        options: true
                    });
                    connectOffline.disabled = false;
                    return;
                }

                if (emailOffline.value.match(/ /g)) {
                    popupLogin.closePopup();
                    popupLogin.openPopup({
                        title: 'Error',
                        content: 'Su nombre de usuario no debe contener espacios.',
                        options: true
                    });
                    connectOffline.disabled = false;
                    return;
                }

                // Create offline account
                let offlineAccount = await Mojang.login(emailOffline.value);

                if (offlineAccount.error) {
                    popupLogin.closePopup();
                    popupLogin.openPopup({
                        title: 'Error',
                        content: offlineAccount.message,
                        options: true
                    });
                    connectOffline.disabled = false;
                    return;
                }
                
                await this.saveData(offlineAccount);
                popupLogin.closePopup();
            } catch (error) {
                console.error('Error during offline login:', error);
                popupLogin.closePopup();
                popupLogin.openPopup({
                    title: 'Error',
                    content: 'Ocurrió un error al iniciar sesión. Intente nuevamente.',
                    options: true
                });
            }
            connectOffline.disabled = false;
        });
    }

    async getAZauth() {
        console.log('Setting up MKNetworkID login...');
        let AZauthClient = new AZauth(this.config.online);
        let popupLogin = new popup();
        let loginAZauth = document.querySelector('.login-AZauth');
        let loginAZauthA2F = document.querySelector('.login-AZauth-A2F');
        let loginMicrosoftAzauth = document.querySelector('.connect-microsoftazauth');
        let registerBtn = document.querySelector('.register-azauth');
        let AZauthEmail = document.querySelector('.email-AZauth');
        let AZauthPassword = document.querySelector('.password-AZauth');
        let AZauthA2F = document.querySelector('.A2F-AZauth');
        let connectAZauthA2F = document.querySelector('.connect-AZauth-A2F');
        let AZauthConnectBTN = document.querySelector('.connect-AZauth');
        let AZauthCancelA2F = document.querySelector('.cancel-AZauth-A2F');

        loginAZauth.style.display = 'block';
        registerBtn.style.display = 'inline';

        // Microsoft login through AZauth
        loginMicrosoftAzauth.addEventListener('click', () => {
            popupLogin.openPopup({
                title: 'Iniciar sesión',
                content: 'Por favor continua en la ventana de inicio de sesión de Microsoft...',
                color: 'var(--color)'
            });

            ipcRenderer.invoke('Microsoft-window', this.config.client_id)
                .then(async account_connect => {
                    if (account_connect == 'cancel' || !account_connect) {
                        popupLogin.closePopup();
                        return;
                    } else {
                        try {
                            await this.saveData(account_connect);
                            clickableHead(false);
                        } catch (error) {
                            console.error('Error saving Microsoft account:', error);
                            popupLogin.openPopup({
                                title: 'Error',
                                content: 'Ocurrió un error al guardar la cuenta. Intente nuevamente.',
                                options: true
                            });
                        }
                        popupLogin.closePopup();
                    }
                })
                .catch(err => {
                    console.error('Microsoft login error:', err);
                    popupLogin.openPopup({
                        title: 'Error',
                        content: err?.message || 'Error al iniciar sesión con Microsoft.',
                        options: true
                    });
                });
        });

        // AZauth login
        AZauthConnectBTN.addEventListener('click', async () => {
            popupLogin.openPopup({
                title: 'Conexión en curso...',
                content: 'Espere, por favor...',
                color: 'var(--color)'
            });

            try {
                // Validate fields
                if (AZauthEmail.value == '' || AZauthPassword.value == '') {
                    popupLogin.openPopup({
                        title: 'Error',
                        content: 'Rellene todos los campos.',
                        options: true
                    });
                    return;
                }

                // Attempt login
                let AZauthConnect = await AZauthClient.login(AZauthEmail.value, AZauthPassword.value);

                if (AZauthConnect.error) {
                    popupLogin.openPopup({
                        title: 'Error',
                        content: AZauthConnect.message,
                        options: true
                    });
                    return;
                } else if (AZauthConnect.A2F) {
                    // 2FA required
                    loginAZauthA2F.style.display = 'block';
                    loginAZauth.style.display = 'none';
                    popupLogin.closePopup();

                    // Cancel 2FA flow
                    AZauthCancelA2F.addEventListener('click', () => {
                        loginAZauthA2F.style.display = 'none';
                        loginAZauth.style.display = 'block';
                    });

                    // Handle 2FA submission
                    connectAZauthA2F.addEventListener('click', async () => {
                        popupLogin.openPopup({
                            title: 'Conexión en curso...',
                            content: 'Espere, por favor...',
                            color: 'var(--color)'
                        });

                        try {
                            if (AZauthA2F.value == '') {
                                popupLogin.openPopup({
                                    title: 'Error',
                                    content: 'Introduzca el código A2F.',
                                    options: true
                                });
                                return;
                            }

                            AZauthConnect = await AZauthClient.login(
                                AZauthEmail.value, 
                                AZauthPassword.value, 
                                AZauthA2F.value
                            );

                            if (AZauthConnect.error) {
                                popupLogin.openPopup({
                                    title: 'Error',
                                    content: AZauthConnect.message,
                                    options: true
                                });
                                return;
                            }

                            await this.saveData(AZauthConnect);
                            clickableHead(true);
                            popupLogin.closePopup();
                        } catch (error) {
                            console.error('Error during 2FA verification:', error);
                            popupLogin.openPopup({
                                title: 'Error',
                                content: 'Ocurrió un error al verificar el código 2FA.',
                                options: true
                            });
                        }
                    });
                } else if (!AZauthConnect.A2F) {
                    // Normal login successful
                    await this.saveData(AZauthConnect);
                    clickableHead(true);
                    popupLogin.closePopup();
                }
            } catch (error) {
                console.error('AZauth login error:', error);
                popupLogin.openPopup({
                    title: 'Error',
                    content: 'Ocurrió un error durante el inicio de sesión. Intente nuevamente.',
                    options: true
                });
            }
        });
    }

    async saveData(connectionData) {
        if (!connectionData) {
            console.error("Error: connectionData is null or undefined");
            throw new Error("Invalid connection data");
        }

        console.log("Processing new account login...");
        
        try {
            // Create a deep copy of connectionData to avoid modifying the original object
            const accountData = JSON.parse(JSON.stringify(connectionData));
            
            // Get current configuration
            let configClient = await this.db.readData('configClient');
            if (!configClient) {
                console.warn("ConfigClient not found, creating new configuration");
                configClient = {
                    instance_selct: null,
                    account_selected: null,
                    launcher_config: {
                        closeLauncher: "close-launcher",
                        download_multi: 3,
                        theme: "auto",
                        music_muted: false,
                        performance_mode: false
                    }
                };
            }

            // Check for protected users
            try {
                const serverConfig = await config.GetConfig();
                if (serverConfig?.protectedUsers && typeof serverConfig.protectedUsers === 'object') {
                    const hwid = await getHWID();
                    
                    if (serverConfig.protectedUsers[accountData.name]) {
                        const allowedHWIDs = serverConfig.protectedUsers[accountData.name];
                        
                        if (Array.isArray(allowedHWIDs) && !allowedHWIDs.includes(hwid)) {
                            let protectedPopup = new popup();
                            protectedPopup.openPopup({
                                title: 'Cuenta protegida',
                                content: 'Esta cuenta está protegida y no puede ser usada en este dispositivo.',
                                color: 'red',
                                options: true
                            });
                            
                            await verificationError(accountData.name, true);
                            throw new Error('Protected account');
                        }
                    }
                }
            } catch (configError) {
                if (configError.message === 'Protected account') {
                    throw configError;
                }
                console.warn("Error checking protected users config:", configError);
            }
            
            // Check if account already exists and save/update
            let account;
            const existingAccount = await this.db.accountExists(accountData.name, accountData.meta?.type);
            
            if (existingAccount) {
                console.log(`Account ${accountData.name} already exists, updating...`);
                accountData.ID = existingAccount.ID;
                await this.db.updateData('accounts', accountData, existingAccount.ID);
                account = accountData;
            } else {
                console.log(`Creating new account: ${accountData.name}`);
                account = await this.db.createData('accounts', accountData);
                if (!account) {
                    throw new Error('Failed to create account');
                }
            }
            
            // Handle instance selection based on whitelists
            try {
                const instancesList = await config.getInstanceList();
                let instanceSelect = configClient.instance_selct;
                
                if (Array.isArray(instancesList) && instancesList.length > 0) {
                    // Check if current instance needs to change due to whitelist
                    for (let instance of instancesList) {
                        if (instance?.whitelistActive && Array.isArray(instance.whitelist)) {
                            const isWhitelisted = instance.whitelist.includes(account.name);
                            
                            // If current selected instance has whitelist and user isn't on it
                            if (!isWhitelisted && instance.name === instanceSelect) {
                                // Find an instance without whitelist
                                const publicInstance = instancesList.find(i => 
                                    i && i.whitelistActive === false
                                );
                                
                                if (publicInstance) {
                                    configClient.instance_selct = publicInstance.name;
                                    try {
                                        await setStatus(publicInstance);
                                    } catch (error) {
                                        console.warn("Error setting instance status:", error);
                                    }
                                }
                            }
                        }
                    }
                }
            } catch (instanceError) {
                console.warn("Error processing instance selection:", instanceError);
            }
            
            // Update selected account in config
            configClient.account_selected = account.ID;
            await this.db.updateData('configClient', configClient);
              // Update UI and navigate to home
            await addAccount(account);
            await accountSelect(account);
            
            // Siempre establecer la cabeza como clickeable
            await clickableHead();
            
            await setUsername(account.name);
            await loginMSG();
            changePanel('home');
            
            return account;
        } catch (error) {
            console.error("Error in saveData:", error);
            throw error;
        }
    }
}

export default Login;