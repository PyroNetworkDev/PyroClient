/**
 * @author MiguelkiNetwork (based on work by Luuxis)
 * @license CC-BY-NC 4.0 - https://creativecommons.org/licenses/by-nc/4.0
 */
const { Authenticator } = require("minecraft-launcher-core");
const { ipcRenderer } = require("electron");

import {
	popup,
	database,
	changePanel,
	accountSelect,
	addAccount,
	config,
	setStatus,
	setUsername,
	clickableHead,
	getDiscordUsername,
	localization,
} from "../utils.js";
import AZauth from "../utils/azauth.js";
import { getHWID, loginMSG, verificationError } from "../MKLib.js";

class Login {
	static id = "login";
	async init(config) {
		this.config = config;
		this.db = new database();

		console.log("Initializing login system with new authentication modules");

		// Handle login method based on configuration
		if (typeof this.config.online == "boolean") {
			this.config.online ? this.getMicrosoft() : this.getCrack();
		} else if (typeof this.config.online == "string") {
			if (this.config.online.match(/^(http|https):\/\/[^ "]+$/)) {
				this.getAZauth();
			}
		}

		// Set up cancel buttons
		document.querySelector(".cancel-home").addEventListener("click", () => {
			document.querySelector(".cancel-home").style.display = "none";
			changePanel("settings");
		});

		document.querySelector(".cancel-AZauth").addEventListener("click", () => {
			document.querySelector(".cancel-AZauth").style.display = "none";
			changePanel("settings");
		});

		document.querySelector(".cancel-offline").addEventListener("click", () => {
			document.querySelector(".cancel-offline").style.display = "none";
			changePanel("settings");
		});

		document.querySelector(".register-azauth").addEventListener("click", () => {
			ipcRenderer.send("create-register-window");
		});
	}

	async getMicrosoft() {
		console.log("Setting up Microsoft login with msmc...");
		let popupLogin = new popup();
		let loginHome = document.querySelector(".login-home");
		let microsoftBtn = document.querySelector(".connect-home");
		loginHome.style.display = "block";

		microsoftBtn.addEventListener("click", async () => {
			popupLogin.openPopup({
				title: "Iniciar sesión",
				content: "Iniciando sesión con Microsoft...",
				color: "var(--color)",
			});

			try {
				console.log("Starting Microsoft login process...");
				
				// Get server configuration to use the client_id for better security
				const serverConfig = await config.GetConfig();
				const clientId = serverConfig?.client_id || null;
				
				console.log("Using client_id from server config:", clientId ? "✓" : "default");
				
				// Use the IPC handler with the server's client_id
				const accountData = await ipcRenderer.invoke('Microsoft-window', clientId);
				
				if (!accountData) {
					throw new Error("No authentication data received");
				}

				console.log(`Successfully authenticated Microsoft account: ${accountData.name}`);
				await this.saveData(accountData);
				clickableHead(false);
				popupLogin.closePopup();
			} catch (error) {
				console.error("Microsoft login error:", error);
				popupLogin.closePopup();

				// Handle specific error cases with better messages
				let errorMessage = "Error al iniciar sesión con Microsoft.";
				let errorTitle = "Error";

				if (error.message && error.message.includes("error.gui.closed")) {
					errorMessage = "La ventana de inicio de sesión fue cerrada. Intente nuevamente.";
					errorTitle = "Ventana cerrada";
					console.log("User closed the Microsoft login window");
				} else if (error.message && error.message.includes("error.user.cancelled")) {
					errorMessage = "El inicio de sesión fue cancelado por el usuario.";
					errorTitle = "Cancelado";
					console.log("User cancelled the Microsoft login process");
				} else if (error.message && error.message.includes("closed")) {
					errorMessage = "La ventana de inicio de sesión se cerró inesperadamente.";
					errorTitle = "Conexión interrumpida";
					console.log("Microsoft login window was closed unexpectedly");
				} else if (error.message && error.message.includes("network")) {
					errorMessage = "Error de conexión. Verifique su conexión a internet.";
					errorTitle = "Error de conexión";
				} else {
					console.error("Unexpected Microsoft login error:", error);
				}

				let errorPopup = new popup();
				errorPopup.openPopup({
					title: errorTitle,
					content: errorMessage,
					color: "red",
					options: true,
				});
			}
		});
	}

	async getCrack() {
		console.log("Setting up offline login with Microsoft option...");
		let popupLogin = new popup();
		let loginOffline = document.querySelector(".login-offline");
		let microsoftcracked = document.querySelector(".connect-microsoftcracked");
		let emailOffline = document.querySelector(".email-offline");
		let connectOffline = document.querySelector(".connect-offline");
		loginOffline.style.display = "block";

		// Microsoft login option in crack mode
		microsoftcracked.addEventListener("click", async () => {
			popupLogin.openPopup({
				title: "Iniciar sesión",
				content: "Iniciando sesión con Microsoft...",
				color: "var(--color)",
			});

			try {
				console.log("Starting Microsoft login process...");
				
				// Get server configuration to use the client_id for better security
				const serverConfig = await config.GetConfig();
				const clientId = serverConfig?.client_id || null;
				
				console.log("Using client_id from server config:", clientId ? "✓" : "default");
				
				// Use the IPC handler with the server's client_id
				const accountData = await ipcRenderer.invoke('Microsoft-window', clientId);
				
				if (!accountData) {
					throw new Error("No authentication data received");
				}

				console.log(`Successfully authenticated Microsoft account: ${accountData.name}`);
				await this.saveData(accountData);
				clickableHead(false);
				popupLogin.closePopup();
			} catch (error) {
				console.error("Microsoft login error:", error);
				popupLogin.closePopup();

				let errorMessage = "Error al iniciar sesión con Microsoft.";
				let errorTitle = "Error";

				if (error.message && error.message.includes("error.gui.closed")) {
					errorMessage = "La ventana de inicio de sesión fue cerrada. Intente nuevamente.";
					errorTitle = "Ventana cerrada";
					console.log("User closed the Microsoft login window");
				} else if (error.message && error.message.includes("error.user.cancelled")) {
					errorMessage = "El inicio de sesión fue cancelado por el usuario.";
					errorTitle = "Cancelado";
					console.log("User cancelled the Microsoft login process");
				} else if (error.message && error.message.includes("closed")) {
					errorMessage = "La ventana de inicio de sesión se cerró inesperadamente.";
					errorTitle = "Conexión interrumpida";
					console.log("Microsoft login window was closed unexpectedly");
				} else if (error.message && error.message.includes("network")) {
					errorMessage = "Error de conexión. Verifique su conexión a internet.";
					errorTitle = "Error de conexión";
				} else {
					console.error("Unexpected Microsoft login error:", error);
				}

				let errorPopup = new popup();
				errorPopup.openPopup({
					title: errorTitle,
					content: errorMessage,
					color: "red",
					options: true,
				});
			}
		});

		// Offline login
		connectOffline.addEventListener("click", async () => {
			connectOffline.disabled = true;
			popupLogin.openPopup({
				title: localization.t("login.logging_in"),
				content: localization.t("messages.please_wait"),
				color: "var(--color)",
			});

			try {
				// Validate username
				if (emailOffline.value.length < 3) {
					popupLogin.closePopup();
					popupLogin.openPopup({
						title: localization.t("login.error"),
						content: localization.t("login.user_too_short"),
						options: true,
					});
					connectOffline.disabled = false;
					return;
				}

				if (emailOffline.value.match(/ /g)) {
					popupLogin.closePopup();
					popupLogin.openPopup({
						title: localization.t("launcher.error"),
						content: localization.t("login.user_with_space"),
						options: true,
					});
					connectOffline.disabled = false;
					return;
				}

				// Validate and truncate username to Minecraft's 16-character limit
				let username = emailOffline.value.trim();
				if (username.length > 16) {
					username = username.substring(0, 16);
					console.warn(`Username truncated from "${emailOffline.value}" to "${username}" (Minecraft 16-char limit)`);
					
					popupLogin.closePopup();
					popupLogin.openDialog({
						title: localization.t("login.truncated_username"),
						content: `${localization.t('login.truncated_username_info')} "${username}".<br>${localization.t('login.truncated_username_confirm')}`,
						color: "orange",
						acceptText: localization.t("buttons.continue"),
						cancelText: localization.t("buttons.cancel"),
						callback: async (result) => {
							if (result === 'accept') {
								try {
									await this.createOfflineAccount(username, popupLogin);
								} catch (error) {
									popupLogin.openPopup({
										title: localization.t("launcher.error"),
										content: localization.t("login.error_creating_account"),
										options: true,
									});
								}
							}
							connectOffline.disabled = false;
						}
					});
					return;
				}

				await this.createOfflineAccount(username, popupLogin);
				connectOffline.disabled = false;
				
			} catch (error) {
				console.error("Error during offline login:", error);
				popupLogin.closePopup();
				popupLogin.openPopup({
					title: localization.t("launcher.error"),
					content:
						localization.t("login.error_creating_account"),
					options: true,
				});
				connectOffline.disabled = false;
			}
		});
	}

	async getAZauth() {
		console.log("Setting up MKNetworkID login...");
		let AZauthClient = new AZauth(this.config.online);
		let popupLogin = new popup();
		let loginAZauth = document.querySelector(".login-AZauth");
		let loginAZauthA2F = document.querySelector(".login-AZauth-A2F");
		let loginMicrosoftAzauth = document.querySelector(
			".connect-microsoftazauth"
		);
		let registerBtn = document.querySelector(".register-azauth");
		let AZauthEmail = document.querySelector(".email-AZauth");
		let AZauthPassword = document.querySelector(".password-AZauth");
		let AZauthA2F = document.querySelector(".A2F-AZauth");
		let connectAZauthA2F = document.querySelector(".connect-AZauth-A2F");
		let AZauthConnectBTN = document.querySelector(".connect-AZauth");
		let AZauthCancelA2F = document.querySelector(".cancel-AZauth-A2F");

		loginAZauth.style.display = "block";
		registerBtn.style.display = "inline";

		// Microsoft login through AZauth using new system
		loginMicrosoftAzauth.addEventListener("click", async () => {
			popupLogin.openPopup({
				title: localization.t("login.login"),
				content: localization.t("login.logging_in_microsoft"),
				color: "var(--color)",
			});

			try {
				console.log("Starting Microsoft login process...");
				
				// Get server configuration to use the client_id for better security
				const serverConfig = await config.GetConfig();
				const clientId = serverConfig?.client_id || null;
				
				console.log("Using client_id from server config:", clientId ? "✓" : "default");
				
				// Use the IPC handler with the server's client_id
				const accountData = await ipcRenderer.invoke('Microsoft-window', clientId);
				
				if (!accountData) {
					throw new Error("No authentication data received");
				}

				console.log(`Successfully authenticated Microsoft account: ${accountData.name}`);
				await this.saveData(accountData);
				clickableHead(false);
				popupLogin.closePopup();
			} catch (error) {
				console.error("Microsoft login error:", error);
				popupLogin.closePopup();

				let errorMessage = "Error al iniciar sesión con Microsoft.";
				let errorTitle = "Error";

				if (error.message && error.message.includes("error.gui.closed")) {
					errorMessage = "La ventana de inicio de sesión fue cerrada. Intente nuevamente.";
					errorTitle = "Ventana cerrada";
					console.log("User closed the Microsoft login window");
				} else if (error.message && error.message.includes("error.user.cancelled")) {
					errorMessage = "El inicio de sesión fue cancelado por el usuario.";
					errorTitle = "Cancelado";
					console.log("User cancelled the Microsoft login process");
				} else if (error.message && error.message.includes("closed")) {
					errorMessage = "La ventana de inicio de sesión se cerró inesperadamente.";
					errorTitle = "Conexión interrumpida";
					console.log("Microsoft login window was closed unexpectedly");
				} else if (error.message && error.message.includes("network")) {
					errorMessage = "Error de conexión. Verifique su conexión a internet.";
					errorTitle = "Error de conexión";
				} else {
					console.error("Unexpected Microsoft login error:", error);
				}

				let errorPopup = new popup();
				errorPopup.openPopup({
					title: errorTitle,
					content: errorMessage,
					color: "red",
					options: true,
				});
			}
		});

		// AZauth login with new module
		AZauthConnectBTN.addEventListener("click", async () => {
			popupLogin.openPopup({
				title: "Conexión en curso...",
				content: "Espere, por favor...",
				color: "var(--color)",
			});

			try {
				// Validate fields
				if (AZauthEmail.value == "" || AZauthPassword.value == "") {
					popupLogin.openPopup({
						title: "Error",
						content: "Rellene todos los campos.",
						options: true,
					});
					return;
				}

				// Attempt login with new AZauth module
				let AZauthConnect = await AZauthClient.login(
					AZauthEmail.value,
					AZauthPassword.value
				);

				// Transform response to match expected format
				const connectionData = {
					name: AZauthConnect.user.name,
					uuid: AZauthConnect.user.uuid,
					access_token: AZauthConnect.access_token,
					refresh_token: AZauthConnect.refresh_token,
					meta: {
						type: 'azauth',
						demo: false,
						...AZauthConnect.meta
					},
					user: AZauthConnect.user
				};

				await this.saveData(connectionData);
				clickableHead(true);
				popupLogin.closePopup();

			} catch (error) {
				console.error("AZauth login error:", error);
				
				// Check if 2FA is required
				if (error.requiresTwoFactor) {
					// Show 2FA form
					loginAZauthA2F.style.display = "block";
					loginAZauth.style.display = "none";
					popupLogin.closePopup();

					// Cancel 2FA flow
					AZauthCancelA2F.addEventListener("click", () => {
						loginAZauthA2F.style.display = "none";
						loginAZauth.style.display = "block";
					});

					// Handle 2FA submission
					connectAZauthA2F.addEventListener("click", async () => {
						popupLogin.openPopup({
							title: "Conexión en curso...",
							content: "Espere, por favor...",
							color: "var(--color)",
						});

						try {
							if (AZauthA2F.value == "") {
								popupLogin.openPopup({
									title: "Error",
									content: "Introduzca el código A2F.",
									options: true,
								});
								return;
							}

							let AZauth2FA = await AZauthClient.loginWith2FA(
								AZauthEmail.value,
								AZauthPassword.value,
								AZauthA2F.value
							);

							// Transform response to match expected format
							const connectionData = {
								name: AZauth2FA.user.name,
								uuid: AZauth2FA.user.uuid,
								access_token: AZauth2FA.access_token,
								refresh_token: AZauth2FA.refresh_token,
								meta: {
									type: 'azauth',
									demo: false,
									...AZauth2FA.meta
								},
								user: AZauth2FA.user
							};

							await this.saveData(connectionData);
							clickableHead(true);
							popupLogin.closePopup();
						} catch (error) {
							console.error("Error during 2FA verification:", error);
							popupLogin.openPopup({
								title: "Error",
								content: error.message || "Ocurrió un error al verificar el código 2FA.",
								options: true,
							});
						}
					});
				} else {
					// Show regular error
					popupLogin.openPopup({
						title: "Error",
						content: error.message || "Ocurrió un error durante el inicio de sesión. Intente nuevamente.",
						options: true,
					});
				}
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
			let configClient = await this.db.readData("configClient");
			if (!configClient) {
				console.warn("ConfigClient not found, creating new configuration");
				configClient = {
					instance_selct: null,
					account_selected: null,
					launcher_config: {
						closeLauncher: "close-launcher",
						theme: "auto",
						music_muted: false,
						performance_mode: false,
					},
				};
			}

			// Check for protected users
			try {
				const serverConfig = await config.GetConfig();
				if (
					serverConfig?.protectedUsers &&
					typeof serverConfig.protectedUsers === "object"
				) {
					const hwid = await getHWID();

					if (serverConfig.protectedUsers[accountData.name]) {
						const allowedHWIDs = serverConfig.protectedUsers[accountData.name];

						if (Array.isArray(allowedHWIDs) && !allowedHWIDs.includes(hwid)) {
							let protectedPopup = new popup();
							protectedPopup.openPopup({
								title: localization.t("login.protected_account"),
								content:
									localization.t("login.protected_account_info"),
								color: "red",
								options: true,
							});
							await verificationError(accountData.name, true);
							return;
						}
					}
				}
			} catch (configError) {
				if (configError.message === "Protected account") {
					throw configError;
				}
				console.warn("Error checking protected users config:", configError);
			}

			// Check if account already exists and save/update
			let account;
			const existingAccount = await this.db.accountExists(
				accountData.name,
				accountData.meta?.type
			);

			if (existingAccount) {
				console.log(`Account ${accountData.name} already exists, updating...`);
				accountData.ID = existingAccount.ID;
				await this.db.updateData("accounts", accountData, existingAccount.ID);
				account = accountData;
			} else {
				console.log(`Creating new account: ${accountData.name}`);
				account = await this.db.createData("accounts", accountData);
				if (!account) {
					throw new Error("Failed to create account");
				}
			}

			// Handle instance selection based on whitelists
			try {
				const instancesList = await config.getInstanceList();
				let instanceSelect = configClient.instance_selct;

				if (Array.isArray(instancesList) && instancesList.length > 0) {
					// Check if current instance needs to change due to whitelist
					for (let instance of instancesList) {
						if (
							instance?.whitelistActive &&
							Array.isArray(instance.whitelist)
						) {
							const isWhitelisted = instance.whitelist.includes(account.name);

							// If current selected instance has whitelist and user isn't on it
							if (!isWhitelisted && instance.name === instanceSelect) {
								// Find an instance without whitelist
								const publicInstance = instancesList.find(
									(i) => i && i.whitelistActive === false
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
			await this.db.updateData("configClient", configClient);
			// Update UI and navigate to home
			await addAccount(account);
			await accountSelect(account);

			// Siempre establecer la cabeza como clickeable
			await clickableHead();

			await setUsername(account.name);
			await loginMSG();
			changePanel("home");

			return account;
		} catch (error) {
			console.error("Error in saveData:", error);
			throw error;
		}
	}

	/**
	 * Creates an offline account with proper validation and format
	 * @param {string} username - Validated username (max 16 chars)
	 * @param {popup} popupLogin - Popup instance for UI feedback
	 */
	async createOfflineAccount(username, popupLogin) {
		try {
			// Create offline account using minecraft-launcher-core
			// When no password is provided, getAuth creates an offline account
			const offlineAuth = await Authenticator.getAuth(username);

			// Ensure the username in the auth object is also properly limited
			if (offlineAuth.name && offlineAuth.name.length > 16) {
				offlineAuth.name = offlineAuth.name.substring(0, 16);
				console.warn(`Auth name truncated to: ${offlineAuth.name}`);
			}

			const accountData = {
				access_token: offlineAuth.access_token,
				client_token: offlineAuth.client_token,
				uuid: offlineAuth.uuid,
				name: offlineAuth.name || username, // Fallback to our validated username
				user_properties: offlineAuth.user_properties || "{}",
				meta: {
					type: "Mojang",
					offline: true,
				},
			};

			// Final validation to ensure name is within limits
			if (accountData.name.length > 16) {
				accountData.name = accountData.name.substring(0, 16);
				console.warn(`Final account name truncated to: ${accountData.name}`);
			}

			console.log(`Created offline account: ${accountData.name} (${accountData.name.length} chars)`);
			await this.saveData(accountData);
			popupLogin.closePopup();
			
		} catch (error) {
			console.error("Error in createOfflineAccount:", error);
			throw error;
		}
	}
}

export default Login;
