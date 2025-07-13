/**
 * @author Luuxis
 * @license CC-BY-NC 4.0 - https://creativecommons.org/licenses/by-nc/4.0
 */
import {
	config,
	database,
	changePanel,
	appdata,
	setStatus,
	setInstanceBackground,
	pkg,
	popup,
	clickHead,
	getClickeableHead,
	toggleModsForInstance,
	discordAccount,
	toggleMusic,
	fadeOutAudio,
	setBackgroundMusic,
	getUsername,
	isPerformanceModeEnabled,
	removeUserFromQueue,
	captureAndSetVideoFrame,
	getExecutionKey,
	localization,
} from "../utils.js";
import {
	getHWID,
	checkHWID,
	getFetchError,
	playMSG,
	playquitMSG,
	addInstanceMSG,
	installMKLibMods,
	hideFolder,
	killMinecraftProcess,
} from "../MKLib.js";
import cleanupManager from "../utils/cleanup-manager.js";
import { downloadAssets } from "../utils/instance-manager.js";
import { getJavaForMinecraft, setGameInProgress, setGameFinished, getJavaVersion } from "../utils/java-manager.js";
import MinecraftStatus from "../utils/minecraft-status.js";

const path = require("path");
const fs = require("fs");

const clientId = pkg.discord_client_id;
const DiscordRPC = require("discord-rpc");
const RPC = new DiscordRPC.Client({ transport: "ipc" });
const startingTime = Date.now();
let dev = process.env.NODE_ENV === "dev";
let rpcActive = true;
let LogBan = false;
let playing = false;
let username;
let discordUrl = pkg.discord_url;
DiscordRPC.register(clientId);

async function setActivity() {
	if (!RPC) return;
}
RPC.on("ready", async () => {
	setActivity();
	username = await getUsername();
	RPC.setActivity({
		state: `En el launcher`,
		startTimestamp: startingTime,
		largeImageKey: "icon",
		largeImageText: pkg.productname,
		instance: true,
	}).catch((err) => {
		console.error("Error al establecer la actividad de Discord:", err);
	});
	setInterval(() => {
		setActivity();
	}, 1000);
});
RPC.login({ clientId }).catch((err) => {
	console.error(
		"Servidor de Discord no detectado. Tranquilo, esto no es una crisis."
	);
	rpcActive = false;
});
const { Client } = require("minecraft-launcher-core");
const { shell, ipcRenderer } = require("electron");
class Home {
	static id = "home";
	intervalId = null;

	async init(config) {
		this.config = config;
		this.db = new database();

		await cleanupManager.initialize();

		this.news();
		this.showstore();
		this.notification();
		this.startNotificationCheck();
		this.socialLick();
		this.instancesSelect();
		this.startButtonManager();
		await this.loadRecentInstances();
		document
			.querySelector(".action-button:nth-child(3)")
			.addEventListener(
				"click",
				(e) => discordAccount() && changePanel("settings")
			);
		document
			.querySelector(".player-options")
			.addEventListener("click", (e) => changePanel("skins"));
		this.addInstanceButton();
		this.addPlayerTooltip();
		this.addInterfaceTooltips();
		this.initializeCloseGameButton();
		
		// Aplicar traducciones al cargar el panel
		setTimeout(() => {
			if (localization && localization.initialized) {
				localization.forceApplyTranslations();
			}
		}, 100);
	}

	async showstore() {
		let storebutton = document.querySelector(".storebutton");
		let res = await config.GetConfig();
		if (res.store_enabled) {
			try {
				const response = await fetch(pkg.store_url).catch((err) =>
					console.error(
						localization.t('home.store_offline')
					)
				);
				if (response.ok) {
					document.querySelector(".news-blockshop").style.display = "block";
				} else {
					console.error(
						localization.t('home.store_offline')
					);
					document.querySelector(".news-blockshop").style.display = "none";
				}
			} catch (error) {
				console.error(
					localization.t('home.store_offline')
				);
				document.querySelector(".news-blockshop").style.display = "none";
			}
			storebutton.addEventListener("click", (e) => {
				ipcRenderer.send("create-store-window");
			});
		} else {
			document.querySelector(".news-blockshop").style.display = "none";
			console.log(
				localization.t('home.store_disabled')
			);
		}
	}

	async notification() {
		let res = await config.GetConfig();
		let hwid = await getHWID();
		let check = await checkHWID(hwid);
		let fetchError = await getFetchError();

		let notification = document.querySelector(".message-container");
		let notificationIcon = document.querySelector(".message-icon");
		let notificationTitle = document.querySelector(".message-title");
		let notificationContent = document.querySelector(".message-content");

		let colorRed = getComputedStyle(document.documentElement).getPropertyValue(
			"--notification-red"
		);
		let colorGreen = getComputedStyle(
			document.documentElement
		).getPropertyValue("--notification-green");
		let colorBlue = getComputedStyle(document.documentElement).getPropertyValue(
			"--notification-blue"
		);
		let colorYellow = getComputedStyle(
			document.documentElement
		).getPropertyValue("--notification-yellow");

		if (check) {
			if (fetchError == false) {
				if (LogBan == false) {
					console.error(
						localization.t('home.hwid_blocked_error')
					);
					LogBan = true;
				}
				notificationTitle.innerHTML = localization.t('home.hwid_blocked_title');
				notificationContent.innerHTML = localization.t('home.hwid_blocked');
				notification.style.background = colorRed;
				notificationIcon.src = "assets/images/notification/error.png";
				await this.showNotification();
			} else {
				if (LogBan == false) {
					console.error(
						localization.t('home.anticheat_verify_error')
					);
					LogBan = true;
				}
				notificationTitle.innerHTML = localization.t('home.hwid_blocked_title');
				notificationContent.innerHTML = localization.t('home.anticheat_error');
				notification.style.background = colorRed;
				notificationIcon.src = "assets/images/notification/error.png";
				await this.showNotification();
			}
		} else if (res.notification.enabled) {
			notificationTitle.innerHTML = res.notification.title;
			notificationContent.innerHTML = res.notification.content;
			if (notificationContent.innerHTML.length > 160) {
				notificationContent.style.fontSize = "0.75rem";
				notificationTitle.style.fontSize = "1.0rem";
			}

			if (res.notification.color == "red")
				notification.style.background = colorRed;
			else if (res.notification.color == "green")
				notification.style.background = colorGreen;
			else if (res.notification.color == "blue")
				notification.style.background = colorBlue;
			else if (res.notification.color == "yellow")
				notification.style.background = colorYellow;
			else notification.style.background = res.notification.color;
			if (res.notification.icon.match(/^(http|https):\/\/[^ "]+$/))
				notificationIcon.src = res.notification.icon;
			else if (res.notification.icon == "info")
				notificationIcon.src = "assets/images/notification/info.png";
			else if (res.notification.icon == "warning")
				notificationIcon.src = "assets/images/notification/exclamation2.png";
			else if (res.notification.icon == "error")
				notificationIcon.src = "assets/images/notification/error.png";
			else if (res.notification.icon == "exclamation")
				notificationIcon.src = "assets/images/notification/exclamation.png";
			else notificationIcon.style.display = "none";
			await this.showNotification();
		} else {
			await this.hideNotification();
		}
	}

	async showNotification() {
		let notification = document.querySelector(".message-container");
		notification.style.display = "flex";
		notification.style.visibility = "visible";
		requestAnimationFrame(function () {
			requestAnimationFrame(function () {
				notification.style.opacity = "1";
			});
		});
	}

	async hideNotification() {
		let notification = document.querySelector(".message-container");
		notification.style.opacity = "0";
		await new Promise((resolve) => setTimeout(resolve, 1000));
		notification.style.visibility = "hidden";
		notification.style.display = "none";
	}

	startNotificationCheck() {
		this.intervalId = setInterval(() => {
			this.notification();
		}, 60000);
		console.log("Comprobación de notificación programada iniciada.");
	}

	stopNotificationCheck() {
		if (this.intervalId) {
			clearInterval(this.intervalId);
			this.intervalId = null;
		}
		console.log("Se ha detenido la comprobación programada de notificaciones.");
	}

	async startButtonManager() {
		this.startModsButton();
		this.startMusicButton();
	}

	async startModsButton() {
		let res = await config.GetConfig();
		if (res.modsBeta || dev) {
			document.querySelector(".action-button:nth-child(2)").style.display =
				"flex";
			document
				.querySelector(".action-button:nth-child(2)")
				.addEventListener("click", (e) => changePanel("mods"));
		} else {
			document.querySelector(".action-button:nth-child(2)").style.display =
				"none";
		}
	}

	async startMusicButton() {
		let res = await config.GetConfig();
		if (res.musicBeta || dev) {
			let configClient = await this.db.readData("configClient");
			document.querySelector(".action-button:nth-child(1)").style.display =
				"flex";
			document
				.querySelector(".action-button:nth-child(1)")
				.addEventListener("click", function () {
					if (!playing) toggleMusic();
				});
			if (configClient.launcher_config.music_muted) {
				document
					.querySelector(".music-btn")
					.classList.remove("icon-speaker-on");
				document.querySelector(".music-btn").classList.add("icon-speaker-off");
			} else {
				document
					.querySelector(".music-btn")
					.classList.remove("icon-speaker-off");
				document.querySelector(".music-btn").classList.add("icon-speaker-on");
			}
		} else {
			document.querySelector(".action-button:nth-child(1)").style.display =
				"none";
		}
	}

	async news() {
		let name = pkg.productname;
		let version = pkg.version;
		let subversion = pkg.sub_version;
		let changelog = pkg.changelog;
		let titlechangelog = document.querySelector(".titlechangelog");
		let changelogcontent = document.querySelector(".bbWrapper");
		changelogcontent.innerHTML = `<p>${changelog}</p>`;
		titlechangelog.innerHTML = `${name} ${version}${
			subversion ? `-${subversion}` : ""
		}`;

		let newsElement = document.querySelector(".news-list");
		let news = await config
			.getNews()
			.then((res) => res)
			.catch((err) => false);
		if (news) {
			if (!news.length) {
				let blockNews = document.createElement("div");
				blockNews.classList.add("news-block");
				blockNews.innerHTML = `
                    <div class="news-header">
                        <div class="header-text">
                            <div class="title">Actualmente no hay noticias disponibles.</div>
                        </div>
                        <div class="date">
                            <div class="day">1</div>
                            <div class="month">Enero</div>
                        </div>
                    </div>
                    <div class="news-content">
                        <div class="bbWrapper">
                            <p>Puede seguir todas las noticias sobre el servidor aquí.</p>
                        </div>
                    </div>`;
				newsElement.appendChild(blockNews);
			} else {
				for (let News of news) {
					let date = this.getdate(News.publish_date);
					let blockNews = document.createElement("div");
					blockNews.classList.add("news-block");
					blockNews.innerHTML = `
                        <div class="news-header">
                            <div class="header-text">
                                <div class="title">${News.title}</div>
                            </div>
                            <div class="date">
                                <div class="day">${date.day}</div>
                                <div class="month">${date.month}</div>
                            </div>
                        </div>
                        <div class="news-content">
                            <div class="bbWrapper">
                                <p>${News.content.replace(/\n/g, "</br>")}</p>
                                <p class="news-author">Autor - <span>${
																	News.author
																}</span></p>
                            </div>
                        </div>`;
					newsElement.appendChild(blockNews);
				}
			}
		} else {
			let blockNews = document.createElement("div");
			blockNews.classList.add("news-block");
			blockNews.innerHTML = `
                <div class="news-header">
                        <div class="header-text">
                            <div class="title">Error.</div>
                        </div>
                        <div class="date">
                            <div class="day">1</div>
                            <div class="month">Enero</div>
                        </div>
                    </div>
                    <div class="news-content">
                        <div class="bbWrapper">
                            <p>No se puede contactar con el servidor de noticias.</p>
                        </div>
                    </div>`;
			newsElement.appendChild(blockNews);
		}
	}

	socialLick() {
		let socials = document.querySelectorAll(".social-block");

		socials.forEach((social) => {
			social.addEventListener("click", (e) => {
				shell.openExternal(e.target.dataset.url);
			});
		});
	}

	async instancesSelect() {
		let configClient = await this.db.readData("configClient");
		let auth = await this.db.readData(
			"accounts",
			configClient.account_selected
		);
		let username = await getUsername();
		let instancesList = await config.getInstanceList();
		let instanceSelect =
			instancesList &&
			instancesList.length > 0 &&
			instancesList.find((i) => i.name == configClient?.instance_selct)
				? configClient?.instance_selct
				: null;

		let instanceBTN = document.querySelector(".play-instance");
		let instancePopup = document.querySelector(".instance-popup");
		let instancesGrid = document.querySelector(".instances-grid");
		let instanceSelectBTN = document.querySelector(".instance-select");
		let instanceCloseBTN = document.querySelector(".close-popup");

		if (!instancesList || instancesList.length === 0) {
			instancesGrid.innerHTML = `
                <div class="no-instances-message">
                    <p>${localization.t('home.no_instances')}</p>
                    <p>${localization.t('home.no_instances_contact')}</p>
                </div>
            `;
			if (configClient.instance_selct) {
				configClient.instance_selct = null;
				await this.db.updateData("configClient", configClient);
			}
		}

		if (!instanceSelect) {
			let newInstanceSelect = instancesList.find(
				(i) => i.whitelistActive == false
			);

			if (newInstanceSelect) {
				configClient.instance_selct = newInstanceSelect.name;
				instanceSelect = newInstanceSelect.name;
				await this.db.updateData("configClient", configClient);
			} else if (instancesList.length > 0) {
				configClient.instance_selct = instancesList[0].name;
				instanceSelect = instancesList[0].name;
				await this.db.updateData("configClient", configClient);
			}
		}

		if (instancesList && instancesList.length > 0) {
			for (let instance of instancesList) {
				if (instance.whitelistActive) {
					let whitelist = instance.whitelist.find(
						(whitelist) => whitelist == username
					);
					if (whitelist !== username) {
						if (instance.name == instanceSelect) {
							let newInstanceSelect = instancesList.find(
								(i) => i.whitelistActive == false
							);

							if (newInstanceSelect) {
								configClient.instance_selct = newInstanceSelect.name;
								instanceSelect = newInstanceSelect.name;
								setStatus(newInstanceSelect);
								setBackgroundMusic(newInstanceSelect.backgroundMusic);
								setInstanceBackground(newInstanceSelect.background);
								await this.db.updateData("configClient", configClient);
							} else if (instancesList.length > 0) {
								configClient.instance_selct = instancesList[0].name;
								instanceSelect = instancesList[0].name;
								setStatus(instancesList[0]);
								setBackgroundMusic(instancesList[0].backgroundMusic);
								setInstanceBackground(instancesList[0].background);
								await this.db.updateData("configClient", configClient);
							}
						}
					}
				} else {
					console.log(`Configurando instancia ${instance.name}...`);
				}

				if (instanceSelect && instance.name == instanceSelect) {
					setStatus(instance);
					setBackgroundMusic(instance.backgroundMusic);
					setInstanceBackground(instance.background);
					this.updateSelectedInstanceStyle(instanceSelect);
				}

				this.notification();
			}

			instanceSelectBTN.removeEventListener(
				"click",
				this.instanceSelectClickHandler
			);
			this.instanceSelectClickHandler = async () => {
				if (instanceSelectBTN.disabled) return;

				// Mostrar el popup inmediatamente con estado de carga
				this.showInstancePopupWithLoading();

				// Verificar si hay bloqueo de dispositivo u otros errores
				let hwid = await getHWID();
				let check = await checkHWID(hwid);
				let fetchError = await getFetchError();

				if (check) {
					// Ocultar el popup de carga y mostrar error
					instancePopup.classList.remove("show");
					
					if (fetchError == false) {
						let popupError = new popup();
						popupError.openPopup({
							title: localization.t('launcher.error'),
							content: localization.t('home.hwid_blocked') + "<br><br>" + localization.t('home.hwid_blocked_ticket'),
						 color: "red",
							options: true,
						});
						return;
					} else {
						let popupError = new popup();
						popupError.openPopup({
							title: localization.t('launcher.error'),
							content: localization.t('home.anticheat_error'),
							color: "red",
							options: true,
						});
						return;
					}
				}

				let username = await getUsername();

				try {
					let refreshedInstancesList = await config.getInstanceList();

					// Agregar una pequeña demora solo en desarrollo para que se vea el efecto de carga
					if (dev) {
						await new Promise(resolve => setTimeout(resolve, 800));
					} else {
						await new Promise(resolve => setTimeout(resolve, 300));
					}

					// Ocultar elementos de loading y mostrar las instancias reales
					this.hideInstanceLoading();
					
					// Limpiar y llenar el contenido de instancias
					instancesGrid.innerHTML = "";

					if (!refreshedInstancesList || refreshedInstancesList.length === 0) {
						instancesGrid.innerHTML = `
						<div class="no-instances-message">
							<p>${localization.t('home.no_instances')}</p>
							<p>${localization.t('home.no_instances_contact')}</p>
						</div>
					`;
					} else {
						let visibleInstanceCount = 0;

						for (let instance of refreshedInstancesList) {
							let color = instance.maintenance ? "red" : "green";
							let whitelist =
								instance.whitelistActive && instance.whitelist.includes(username);
							let imageUrl =
								instance.thumbnail || "assets/images/default/placeholder.jpg";
							if (!instance.whitelistActive || whitelist) {
								instancesGrid.innerHTML += `
								<div id="${
																		instance.name
																	}" class="instance-element ${
									instance.name === instanceSelect ? "active-instance" : ""
								}">
									<div class="instance-image" style="background-image: url('${imageUrl}');"></div>
									<div class="instance-name">${
																			instance.name
																		}<div class="instance-mkid" style="background-color: ${color};"></div></div>
								</div>`;
								visibleInstanceCount++;
							}
						}

						if (visibleInstanceCount === 0) {
							instancesGrid.innerHTML = `
							<div class="no-instances-message">
								<p>${localization.t('home.no_instances_account')}</p>
								<p>${localization.t('home.no_instances_contact')}</p>
							</div>
						`;
						} else {
							const remainder = visibleInstanceCount % 3;
							instancesGrid.classList.remove("one-item", "two-items");

							if (remainder === 1) {
								instancesGrid.classList.add("one-item");
							} else if (remainder === 2) {
								instancesGrid.classList.add("two-items");
							}
						}
					}

				} catch (error) {
					console.error("Error al cargar las instancias:", error);
					
					// Ocultar loading y mostrar error
					this.hideInstanceLoading();
					instancesGrid.innerHTML = `
						<div class="no-instances-message">
							<p>${localization.t('home.error_loading_instances') || 'Error al cargar las instancias'}</p>
							<p>${localization.t('home.error_loading_instances_info') || 'Por favor, inténtalo de nuevo más tarde'}</p>
						</div>
					`;
				}
			};

			instanceSelectBTN.addEventListener(
				"click",
				this.instanceSelectClickHandler
			);

			instancePopup.addEventListener("click", async (e) => {
				let configClient = await this.db.readData("configClient");

				if (e.target.closest(".instance-element")) {
					let newInstanceSelect = e.target.closest(".instance-element").id;
					let activeInstanceSelect = document.querySelector(".active-instance");

					// Clear cache when changing instance
					if (instanceSelect !== newInstanceSelect) {
						console.log('Clearing server status cache due to instance change in popup');
						MinecraftStatus.clearCache();
					}

					if (activeInstanceSelect)
						activeInstanceSelect.classList.remove("active-instance");
					e.target
						.closest(".instance-element")
						.classList.add("active-instance");

					configClient.instance_selct = newInstanceSelect;
					await this.db.updateData("configClient", configClient);
					instanceSelect = newInstanceSelect;
					instancePopup.classList.remove("show");
					this.notification();
					let instance = await config.getInstanceList();
					let options = instance.find(
						(i) => i.name == configClient.instance_selct
					);
					setStatus(options);
					setBackgroundMusic(options.backgroundMusic);
					const performanceMode = isPerformanceModeEnabled();
					if (performanceMode) {
						document
							.querySelector(".server-status-icon")
							?.setAttribute("data-background", options.background);
						if (
							options.background &&
							options.background.match(/^(http|https):\/\/[^ "]+$/)
						) {
							await captureAndSetVideoFrame(options.background);
						} else {
							await captureAndSetVideoFrame();
						}
					} else {
						setInstanceBackground(options.background);
					}
					this.updateSelectedInstanceStyle(newInstanceSelect);
				}
			});

			instanceBTN.addEventListener("click", async () => {
				this.disablePlayButton();
				this.startGame();
			});

			instanceCloseBTN.addEventListener("click", () => {
				instancePopup.classList.remove("show");
				this.notification();
			});
		}
	}

	disablePlayButton() {
		const playInstanceBTN = document.querySelector(".play-instance");
		playInstanceBTN.disabled = true;
		playInstanceBTN.style.pointerEvents = "none";
		playInstanceBTN.style.opacity = "0.5";
	}

	enablePlayButton() {
		const playInstanceBTN = document.querySelector(".play-instance");
		playInstanceBTN.disabled = false;
		playInstanceBTN.style.pointerEvents = "auto";
		playInstanceBTN.style.opacity = "1";
	}

	async startGame() {
		let musicPlaying = true;
		
		try {
			let configClient = await this.db.readData("configClient");
			let javaPath = configClient.java_config.java_path;

		if (!configClient.instance_selct) {
			this.enablePlayButton();
			let popupError = new popup();
			popupError.openPopup({
				title: "Selecciona una instancia",
				content: "Debes seleccionar una instancia antes de iniciar el juego.",
				color: "var(--color)",
				options: true,
			});
			return;
		}

		let instance = await config.getInstanceList();

		if (!configClient.account_selected) {
			this.enablePlayButton();
			let popupError = new popup();
			popupError.openPopup({
				title: "Error de cuenta",
				content:
					"No hay una cuenta seleccionada. Por favor, selecciona una cuenta para continuar.",
				color: "red",
				options: true,
			});
			return;
		}

		console.log(`Obteniendo cuenta con ID: ${configClient.account_selected}`);

		await this.db.syncAccountIds();

		let authenticator = null;

		try {
			authenticator = await this.db.getSelectedAccount();

			if (authenticator) {
				console.log(
					`Cuenta obtenida mediante getSelectedAccount: ${authenticator.name} (ID: ${authenticator.ID})`
				);
			}
		} catch (err) {
			console.warn(`Error al obtener cuenta seleccionada: ${err.message}`);
		}

		if (!authenticator) {
			try {
				authenticator = await this.db.readData(
					"accounts",
					configClient.account_selected
				);

				if (authenticator) {
					console.log(
						`Cuenta obtenida mediante readData: ${authenticator.name} (ID: ${authenticator.ID})`
					);
				}
			} catch (err) {
				console.warn(`Error al leer cuenta directamente: ${err.message}`);
			}
		}

		if (!authenticator) {
			console.log(`Intentando obtener cuenta desde la lista completa...`);
			let allAccounts = await this.db.readAllData("accounts");
			if (Array.isArray(allAccounts) && allAccounts.length > 0) {
				authenticator = allAccounts.find(
					(acc) =>
						String(acc.ID) === String(configClient.account_selected) ||
						Number(acc.ID) === Number(configClient.account_selected)
				);

				if (authenticator) {
					console.log(
						`Cuenta encontrada por método alternativo: ${authenticator.name} (ID: ${authenticator.ID})`

					);

					await this.db.updateData("accounts", authenticator, authenticator.ID);
				}
			}
		}

		if (!authenticator) {
			console.error(
				`No se pudo encontrar la cuenta con ID: ${configClient.account_selected}`
			);

			let allAccounts = await this.db.readAllData("accounts");
			if (Array.isArray(allAccounts)) {
				console.log(
					`Cuentas disponibles: ${allAccounts
						.map((a) => `${a.name}(${a.ID})`)
						.join(", ")}`

				);
			}

			this.enablePlayButton();
			let popupError = new popup();
			popupError.openPopup({
				title: "Error de cuenta",
				content:
					"La cuenta seleccionada no se encuentra disponible. Por favor, selecciona otra cuenta o inicia sesión nuevamente.",
				color: "red",
				options: true,
			});
			return;
		}

		let hwid = await getHWID();
		let check = await checkHWID(hwid);
		let fetchError = await getFetchError();

		if (check) {
			if (fetchError == false) {
				this.enablePlayButton();
				let popupError = new popup();
				popupError.openPopup({
					title: localization.t('launcher.error'),
					content: localization.t('home.hwid_blocked') + "<br><br>" + localization.t('home.hwid_blocked_ticket'),
					color: "red",
					options: true,
				});
				return;
			} else {
				this.enablePlayButton();
				let popupError = new popup();
				popupError.openPopup({
					title: localization.t('launcher.error'),
					content: localization.t('home.anticheat_error'),
					color: "red",
					options: true,
				});
				return;
			}
		}

		console.log(
			`Cuenta recuperada: ${authenticator.name} (ID: ${authenticator.ID})`
		);
		let options = instance.find((i) => i.name == configClient.instance_selct);

		if (!options) {
			this.enablePlayButton();
			let popupError = new popup();
			popupError.openDialog({
				title: localization.t('home.instance_not_found'),
				content: localization.t('home.instance_not_found_message', {instance: configClient.instance_selct}) + 
				'<br>' + localization.t('home.instance_update_list'),
				options: true,
				acceptText: localization.t('home.update_list'),
				cancelText: localization.t('home.select_other'),
				callback: async (result) => {
					if (result === 'accept') {
						// Recargar lista de instancias
						try {
							await config.getInstanceList(true); // Force refresh
						} catch (error) {
							console.error("Error al actualizar lista de instancias:", error);
							let errorPopup = new popup();
							errorPopup.openPopup({
								title: localization.t('home.update_error'),
								content: localization.t('home.update_error_message') + `:
${error.message}`,
								color: "red",
								options: true,
							});
						}
					} else {
						// Abrir selector de instancias
						document.querySelector(".instance-popup").style.display = "flex";
					}
				}
			});
			return;
		}

		let playInstanceBTN = document.querySelector(".play-instance");
		let infoStartingBOX = document.querySelector(".info-starting-game");
		let instanceSelectBTN = document.querySelector(".instance-select");
		let infoStarting = document.querySelector(".info-starting-game-text");
		let progressBar = document.querySelector(".progress-bar");
		let closeGameButton = document.querySelector(".force-close-button");

		if (options.maintenance) {
			this.enablePlayButton();
			let popupError = new popup();
			if (options.maintenancemsg == "") {
				popupError.openPopup({
					title: localization.t('home.game_launch_error'),
					content: localization.t('home.instance_maintenance'),
					color: "red",
					options: true,
				});
			} else {
				popupError.openPopup({
					title: localization.t('home.game_launch_error'),
					content: options.maintenancemsg,
					color: "red",
					options: true,
				});
			}
			return;
		}

		let username = await getUsername();
		if (options.whitelistActive && !options.whitelist.includes(username)) {
			this.enablePlayButton();
			let popupError = new popup();
			popupError.openPopup({
				title: localization.t('launcher.error'),
				content: localization.t('home.instance_no_permission'),
				color: "red",
				options: true,
			});
			return;
		}

		playInstanceBTN.style.display = "none";
		infoStartingBOX.style.display = "flex";
		instanceSelectBTN.disabled = true;
		instanceSelectBTN.classList.add("disabled");
		this.hideProgressBar();

		try {
			const queueResult = await this.checkQueueStatus(hwid, username);
			if (queueResult.cancelled) {
				this.enablePlayButton();
				playInstanceBTN.style.display = "flex";
				infoStartingBOX.style.display = "none";
				instanceSelectBTN.disabled = false;
				instanceSelectBTN.classList.remove("disabled");
				ipcRenderer.send("main-window-progress-reset");
				return;
			}
		} catch (error) {
			console.error("Error in queue system:", error);
			this.enablePlayButton();
			playInstanceBTN.style.display = "flex";
			infoStartingBOX.style.display = "none";
			instanceSelectBTN.disabled = false;
			instanceSelectBTN.classList.remove("disabled");
			ipcRenderer.send("main-window-progress-reset");

			let popupError = new popup();
			popupError.openPopup({
				title: localization.t('home.queue_error'),
				content: localization.t('home.queue_error_message'),
				color: "red",
				options: true,
			});
			return;
		}

		this.showProgressBar();
		ipcRenderer.send("main-window-progress-load");

		let recentInstances = configClient.recent_instances || [];

		recentInstances = recentInstances.filter((name) => name !== options.name);

		recentInstances.unshift(options.name);

		if (recentInstances.length > 3)
			recentInstances = recentInstances.slice(0, 3);

		configClient.recent_instances = recentInstances;

		await this.db.updateData("configClient", configClient);

		await this.loadRecentInstances();

		console.log("Instancias recientes actualizadas:", recentInstances);

		const ignoredFiles = [...options.ignored];

		try {
			infoStarting.innerHTML = localization.t('home.downloading_libraries');
			this.setProgressBarIndeterminate();
			const loaderType = options.loadder.loadder_type;
			const minecraftVersion = options.loadder.minecraft_version;

			// Asegurar que la carpeta mods existe y está oculta
			const instanceModsPath = path.join(
				await appdata(),
				process.platform == "darwin"
					? this.config.dataDirectory
					: `.${this.config.dataDirectory}`,
				"instances",
				options.name,
				"mods"
			);

			// Crear la carpeta mods si no existe
			if (!fs.existsSync(instanceModsPath)) {
				fs.mkdirSync(instanceModsPath, { recursive: true });
			}

			/* await hideFolder(instanceModsPath); */

			const installResult = await installMKLibMods(
				options.name,
				minecraftVersion,
				loaderType
			);

			if (installResult.success && installResult.modFile) {
				if (!ignoredFiles.includes(installResult.modFile)) {
					ignoredFiles.push(installResult.modFile);
				}
			}

			await new Promise((resolve) => setTimeout(resolve, 500));
		} catch (error) {
			console.error("Error al instalar las librerias extra:", error);
		}

		infoStarting.innerHTML = localization.t('home.connecting');
		this.setProgressBarIndeterminate();

		console.log("Obteniendo clave de ejecución...");
		let execKey = null;
		let execKeyValid = false;
		let gameArgs = options.game_args || [];
		try {
			const execKeyResponse = await getExecutionKey();

			if (
				execKeyResponse &&
				execKeyResponse.status === "success" &&
				execKeyResponse.exec_key
			) {
				execKey = execKeyResponse.exec_key;
				execKeyValid = true;
				console.log("Execution key obtained successfully");

				// Corregir cómo se añaden los argumentos según si gameArgs es array o string
				if (Array.isArray(gameArgs)) {
					gameArgs.push("--key", execKey, "--id", hwid);
				} else if (typeof gameArgs === "string") {
					// Si es string, añadir los argumentos con el formato correcto
					gameArgs = gameArgs
						? `${gameArgs} --key ${execKey} --id ${hwid}`
						: `--key ${execKey} --id ${hwid}`;
				}
			} else {
				throw new Error("Invalid execution key response");
			}
		} catch (keyError) {
			console.error("Error fetching execution key:", keyError.message);

			// Ask user if they want to continue without execution key
			const continueWithoutKey = await new Promise((resolve) => {
				let keyErrorPopup = new popup();
				keyErrorPopup.openDialog({
					title: "Error de verificación",
					content: `Error al obtener la clave de ejecución: ${keyError.message}. Sin esta verificación, el juego podría no iniciar correctamente. ¿Desea continuar de todos modos?`,
					options: true,
					callback: resolve,
				});
			});

			if (continueWithoutKey === "cancel") {
				this.enablePlayButton();
				infoStartingBOX.style.display = "none";
				playInstanceBTN.style.display = "flex";
				instanceSelectBTN.disabled = false;
				instanceSelectBTN.classList.remove("disabled");
				ipcRenderer.send("main-window-progress-reset");
				if (closeGameButton) {
					closeGameButton.style.display = "none";
				}
				return;
			}
		}

		console.log("Configurando opciones de lanzamiento...");
		let launcher = new Client();
		let launchConfig;

		try {
			console.log(`Iniciando descarga de assets para la instancia: ${options.name}`);
			infoStarting.innerHTML = localization.t('home.downloading_assets');
			this.setProgressBarDeterminate(0, 100);

			// Carpeta de destino para los assets - directamente en la instancia
			const instancePath = `${await appdata()}/${
				process.platform == "darwin"
					? this.config.dataDirectory
					: `.${this.config.dataDirectory}`
			}/instances/${options.name}`;
			console.log(`Ruta de la instancia: ${instancePath}`);
			
			// URL de assets basada en la URL de la instancia con un endpoint fijo
			const assetsUrl = options.url;
			console.log(`URL de assets: ${assetsUrl}`);
			
			// Lista de archivos ignorados para la verificación de integridad
			const ignoredAssets = ignoredFiles;
			
			// Variable para controlar cuándo mostrar progreso vs. estado
			let showingProgress = false;
			
			// Callback para reportar progreso
			const progressCallback = (progress, processed, total, downloadedSize, totalSize) => {
				// Activar modo de progreso
				showingProgress = true;
				
				// Validar que los valores sean números finitos válidos
				const safeProgress = (typeof progress === 'number' && isFinite(progress) && !isNaN(progress)) ? Math.max(0, Math.min(100, progress)) : 0;
				const safeProcessed = (typeof processed === 'number' && isFinite(processed) && !isNaN(processed)) ? processed : 0;
				const safeTotal = (typeof total === 'number' && isFinite(total) && !isNaN(total)) ? Math.max(1, total) : 1;
				const safeDownloadedSize = (typeof downloadedSize === 'number' && isFinite(downloadedSize) && !isNaN(downloadedSize)) ? downloadedSize : 0;
				const safeTotalSize = (typeof totalSize === 'number' && isFinite(totalSize) && !isNaN(totalSize)) ? totalSize : 0;
				const sizeText = safeTotalSize > 0 ? 
					` (${(safeDownloadedSize / 1024 / 1024).toFixed(1)}MB/${(safeTotalSize / 1024 / 1024).toFixed(1)}MB)` : '';
				
				// Actualizar la barra de progreso local con valores validados
				if (progressBar) {
					try {
						this.setProgressBarDeterminate(safeProgress, 100);
					} catch (error) {
						try {
							this.setProgressBarDeterminate(0, 100);
						} catch (fallbackError) {
							console.error('Even fallback failed:', fallbackError);
						}
					}
				}
				
				// Actualizar el progreso en la barra de tareas de Windows
				ipcRenderer.send("main-window-progress", { progress: safeProgress, size: 100 });
				
				// Actualizar el texto del estado con el progreso
				if (infoStarting) {
					if (safeProgress <= 50) {
						// Fase de verificación (0-50%)
						infoStarting.innerHTML = `${localization.t('home.verifying_assets')} ${Math.round(safeProgress)}% (${safeProcessed}/${safeTotal})`;
					} else {
						// Fase de descarga (50-100%)
						infoStarting.innerHTML = `${localization.t('home.downloading_assets')} ${Math.round(safeProgress)}% (${safeProcessed}/${safeTotal})${sizeText}`;
					}
				}
			};

			// CallbackProgress event received para actualizar el estado - SOLO para mensajes de estado sin progreso
			const statusCallback = (status) => {
				// Validar que el status sea una cadena válida
				const safeStatus = (typeof status === 'string' && status.trim()) ? status.trim() : localization.t('messages.processing');
				
				// SOLO actualizar si NO estamos mostrando progreso o si es un mensaje de finalización
				if (infoStarting && (!showingProgress || safeStatus.includes('completada') || safeStatus.includes('Limpiando'))) {
					infoStarting.innerHTML = safeStatus;
					// Si es un mensaje de finalización, desactivar el modo progreso
					if (safeStatus.includes('completada')) {
						showingProgress = false;
					}
				}
			};

			// Descargar assets
			console.log('🚀 Starting downloadAssets function...');
			await downloadAssets(
				assetsUrl,
				instancePath,
				ignoredAssets,
				progressCallback,
				statusCallback
			);
			console.log('✅ downloadAssets function completed successfully');

			console.log(`Descarga de assets completada para la instancia: ${options.name}`);
			infoStarting.innerHTML = localization.t('home.assets_download_success');
			
			// Mostrar progreso completo por un momento
			this.setProgressBarDeterminate(100, 100);
			
			// Dar tiempo adicional para que todos los procesos asíncronos terminen
			await new Promise(resolve => setTimeout(resolve, 1500));
			
			// Desactivar el modo progreso
			showingProgress = false;

		} catch (error) {
			console.error(`Error al descargar assets para ${options.name}:`, error);
			
			// Mostrar error al usuario con detalles específicos
			this.enablePlayButton();
			if (playInstanceBTN) playInstanceBTN.style.display = "flex";
			if (infoStartingBOX) infoStartingBOX.style.display = "none";
			if (instanceSelectBTN) {
				instanceSelectBTN.disabled = false;
				instanceSelectBTN.classList.remove("disabled");
			}
			if (closeGameButton) closeGameButton.style.display = "none";
			
			ipcRenderer.send("main-window-progress-reset");
			
			// Categorizar el error para mostrar mensaje más útil
			let errorTitle = "Error de Descarga de Assets";
			let errorMessage = error.message;
			let suggestions = [];
			
			if (errorMessage.includes('ENOTFOUND') || errorMessage.includes('ECONNREFUSED')) {
				errorTitle = "Error de Conexión";
				errorMessage = "No se pudo conectar al servidor de assets.";
				suggestions.push("- Verifica tu conexión a internet");
				suggestions.push("- El servidor puede estar temporalmente no disponible");
				suggestions.push("- Inténtalo de nuevo en unos minutos");
			} else if (errorMessage.includes('ENOSPC')) {
				errorTitle = "Espacio Insuficiente";
				errorMessage = "No hay suficiente espacio en disco para descargar los assets.";
				suggestions.push("- Libera espacio en tu disco duro");
				suggestions.push("- Verifica que tienes al menos 2GB libres");
			} else if (errorMessage.includes('EPERM') || errorMessage.includes('EACCES')) {
				errorTitle = "Error de Permisos";
				errorMessage = "No se tienen permisos para escribir en la carpeta de destino.";
				suggestions.push("- Ejecuta el launcher como administrador");
				suggestions.push("- Verifica permisos de la carpeta del launcher");
			} else if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
				errorTitle = "Timeout de Descarga";
				errorMessage = "La descarga tardó demasiado tiempo.";
				suggestions.push("- Tu conexión puede ser lenta");
				suggestions.push("- Inténtalo de nuevo");
				suggestions.push("- Considera usar una conexión más estable");
			} else if (errorMessage.includes('404') || errorMessage.includes('not found')) {
				errorTitle = "Assets No Encontrados";
				errorMessage = "Los assets para esta instancia no están disponibles.";
				suggestions.push("- Contacta al administrador del servidor");
				suggestions.push("- Verifica que la instancia esté configurada correctamente");
			}
			
			const fullMessage = suggestions.length > 0 
				? `${errorMessage}\n\nSugerencias:\n${suggestions.join('\n')}`
				: errorMessage;
			
			let popupError = new popup();
			popupError.openPopup({
				title: errorTitle,
				content: fullMessage,
				color: "red",
				options: true,
			});
			return;
		}
		console.log("🎯 Finalizada completamente la descarga de assets. Continuando con configuración del loader...");
		
		try {
			console.log(`Obteniendo configuración para loader: ${options.loadder.loadder_type}`);
			
			const rootPath = `${await appdata()}/${
				process.platform == "darwin"
					? this.config.dataDirectory
					: `.${this.config.dataDirectory}`
			}`;
			
			// Mostrar progreso de configuración
			infoStarting.innerHTML = `${localization.t('home.configuring_loader')} ${options.loadder.loadder_type}...`;
			this.setProgressBarDeterminate(0, 100);
			
			const loaderResult = await ipcRenderer.invoke('get-launcher-config', {
				loaderType: options.loadder.loadder_type,
				gameVersion: options.loadder.minecraft_version,
				rootPath: rootPath
			});
			
			if (!loaderResult.success) {
				console.error('Error detallado del loader:', loaderResult);
				
				// Manejo específico por tipo de error
				let errorTitle = "Error de Configuración";
				let errorContent = loaderResult.error;
				let suggestions = [];
				
				switch (loaderResult.category) {
					case 'network':
						errorTitle = "Error de Conexión";
						suggestions.push("- Verifica tu conexión a internet");
						suggestions.push("- Inténtalo de nuevo en unos minutos");
						break;
					case 'filesystem':
						errorTitle = "Error de Permisos";
						suggestions.push("- Ejecuta el launcher como administrador");
						suggestions.push("- Verifica que tienes permisos de escritura");
						break;
					case 'timeout':
						errorTitle = "Timeout de Descarga";
						suggestions.push("- Tu conexión puede ser lenta");
						suggestions.push("- Inténtalo de nuevo");
						break;
					case 'version':
						errorTitle = "Versión No Disponible";
						suggestions.push(`- Verifica que ${options.loadder.loadder_type} soporta Minecraft ${options.loadder.minecraft_version}`);
						suggestions.push("- Contacta al administrador del servidor");
						break;
					default:
						suggestions.push("- Inténtalo de nuevo");
						suggestions.push("- Si el problema persiste, contacta al soporte");
						break;
				}
				
				const fullErrorMessage = `${errorContent}\n\nSugerencias:\n${suggestions.join('\n')}`;
				
				throw new Error(fullErrorMessage);
			}
			
			// Validar configuración antes de continuar
			const validationResult = await ipcRenderer.invoke('validate-launcher-config', {
				config: loaderResult.config,
				loaderType: options.loadder.loadder_type,
				gameVersion: options.loadder.minecraft_version
			});
			
			if (validationResult.success) {
				if (!validationResult.validation.valid) {
					console.warn('Configuración del launcher tiene problemas:', validationResult.validation);
					
					// Mostrar advertencias al usuario si las hay
					if (validationResult.validation.warnings.length > 0) {
						console.warn('Advertencias de configuración:', validationResult.validation.warnings);
					}
					
					// Solo fallar si hay errores críticos que no podemos solucionar
					const criticalErrors = validationResult.validation.errors.filter(error => 
						!error.includes('directorio del juego') // Este error lo solucionamos nosotros
					);
					
					if (criticalErrors.length > 0) {
						throw new Error(`Configuración inválida:\n${criticalErrors.join('\n')}`);
					}
				}
			} else {
				console.warn('Error al validar configuración:', validationResult.error);
				// Continuar de todos modos, la validación no es crítica
			}
			
			launchConfig = loaderResult.config;
			console.log("Configuración del launcher obtenida y validada correctamente");
			
		} catch (error) {
			console.error("Error al configurar el launcher:", error);
			
			// Restablecer UI
			this.enablePlayButton();
			if (playInstanceBTN) playInstanceBTN.style.display = "flex";
			if (infoStartingBOX) infoStartingBOX.style.display = "none";
			if (instanceSelectBTN) {
				instanceSelectBTN.disabled = false;
				instanceSelectBTN.classList.remove("disabled");
			}
			if (closeGameButton) closeGameButton.style.display = "none";
			
			// Limpiar barra de progreso
			ipcRenderer.send("main-window-progress-reset");
			
			// Mostrar error detallado al usuario
			let popupError = new popup();
			popupError.openPopup({
				title: "Error de Configuración del Loader",
				content: `No se pudo configurar ${options.loadder.loadder_type} para Minecraft ${options.loadder.minecraft_version}:\n\n${error.message}`,
				color: "red",
				options: true,
			});
			
			return;
		}

		let opt;
		/* if (options.loadder.loadder_type == "forge") { */
		
		// Definir rootPath al inicio para uso en toda la configuración
		const rootPath = `${await appdata()}/${
			process.platform == "darwin"
				? this.config.dataDirectory
				: `.${this.config.dataDirectory}`
		}`;
		
		// Establecer el gameDirectory correcto para la instancia
		const instanceGameDirectory = `${rootPath}/instances/${options.name}`;
		
		// Asegurar que launchConfig tiene las propiedades necesarias
		if (!launchConfig.gameDirectory && !launchConfig.directory) {
			console.log(`Estableciendo gameDirectory para la instancia: ${instanceGameDirectory}`);
			launchConfig.gameDirectory = instanceGameDirectory;
		}
		
		// Crear el directorio de la instancia si no existe
		if (!fs.existsSync(instanceGameDirectory)) {
			console.log(`Creando directorio de instancia: ${instanceGameDirectory}`);
			fs.mkdirSync(instanceGameDirectory, { recursive: true });
		}
		
		// Crear estructura de directorios necesaria para Minecraft
		const requiredDirs = [
			path.join(instanceGameDirectory, 'mods'),
			path.join(instanceGameDirectory, 'config'),
			path.join(instanceGameDirectory, 'saves'),
			path.join(instanceGameDirectory, 'resourcepacks'),
			path.join(instanceGameDirectory, 'screenshots'),
			path.join(instanceGameDirectory, 'logs'),
			path.join(instanceGameDirectory, 'crash-reports')
		];
		
		for (const dir of requiredDirs) {
			if (!fs.existsSync(dir)) {
				console.log(`Creando directorio: ${dir}`);
				fs.mkdirSync(dir, { recursive: true });
			}
		}
		
		// ======== CONFIGURACIÓN ESPECÍFICA PARA VERSIONES LEGACY ========
		// Añadir argumentos JVM específicos para versiones antiguas de Minecraft
		const minecraftVersionFloat = parseFloat(options.loadder.minecraft_version.replace(/^1\./, '1.'));
		let legacyJvmArgs = [];
		
		if (minecraftVersionFloat <= 1.16) {
			console.log(`🔧 Aplicando configuración legacy para Minecraft ${options.loadder.minecraft_version}`);
			
			// Argumentos específicos para LWJGL 2.x (versiones legacy)
			legacyJvmArgs = [
				// Forzar el uso de OpenGL software rendering como fallback
				'-Dorg.lwjgl.opengl.Display.allowSoftwareOpenGL=true',
				// Configurar biblioteca nativa LWJGL
				'-Dorg.lwjgl.librarypath=' + path.join(rootPath, 'bin', 'natives'),
				// Deshabilitar verificaciones de compatibilidad de LWJGL que pueden fallar
				'-Dorg.lwjgl.util.NoChecks=true',
				// Configurar OpenAL para compatibilidad
				'-Dopenal.library=' + path.join(rootPath, 'bin', 'natives', process.platform === 'win32' ? 'OpenAL32.dll' : 'libopenal.so'),
				// Argumentos para prevenir errores de memoria de LWJGL
				'-Dorg.lwjgl.util.Debug=false',
				// Configurar DirectX/OpenGL para Windows
				...(process.platform === 'win32' ? [
					'-Djava.library.path=' + path.join(rootPath, 'bin', 'natives'),
					'-Dsun.java2d.d3d=false',
					'-Dsun.java2d.opengl=false'
				] : [])
			];
			
			console.log(`🛠️ Argumentos JVM legacy añadidos`);
		}

		// ======== VERIFICACIÓN Y DESCARGA AUTOMÁTICA DE JAVA ========
		console.log("☕ Verificando compatibilidad de Java...");
		console.log(`🎮 Versión de Minecraft: ${options.loadder.minecraft_version}`);
		console.log(`📍 Java configurado actualmente: ${javaPath}`);
		infoStarting.innerHTML = `${localization.t('home.java_checking_for_mc')} ${options.loadder.minecraft_version}...`;
		this.setProgressBarIndeterminate();

		try {
			// Usar getJavaForMinecraft para obtener la ruta de Java apropiada
			const compatibleJavaPath = await getJavaForMinecraft(
				options.loadder.minecraft_version,
				javaPath,
				// Progress callback para descarga de Java
				(progress, downloaded, total) => {
					this.setProgressBarDeterminate(progress, 100);
					console.log(`📥 Descarga de Java: ${progress}% (${Math.round(downloaded / (1024 * 1024))}/${Math.round(total / (1024 * 1024))} MB)`);
				},
				// Status callback para descarga de Java
				(status) => {
					infoStarting.innerHTML = status;
					console.log(`☕ ${status}`);
				}
			);
			
			// Actualizar la configuración con la ruta de Java apropiada
			javaPath = compatibleJavaPath;
			console.log(`✅ Java final seleccionado: ${javaPath}`);
			
			// Verificar versión de Java seleccionada
			try {
				const javaVersionInfo = await getJavaVersion(javaPath);
				console.log(`📊 Versión de Java detectada: Java ${javaVersionInfo.major}.${javaVersionInfo.minor} (${javaVersionInfo.full})`);
			} catch (versionError) {
				console.warn(`⚠️ No se pudo verificar la versión de Java: ${versionError.message}`);
			}
			javaPath = compatibleJavaPath;
			console.log(`✅ Java verificado/descargado: ${javaPath}`);
			
			// Marcar que el juego va a usar este Java
			setGameInProgress(javaPath, options.name);
			
			// Validar que el ejecutable de Java existe y es accesible
			if (!javaPath || !fs.existsSync(javaPath)) {
				throw new Error(`Ruta de Java no válida o no existe: ${javaPath}`);
			}
			
			// Validar que el archivo Java es ejecutable
			try {
				fs.accessSync(javaPath, fs.constants.X_OK);
				console.log(`✅ Java ejecutable verificado: ${javaPath}`);
			} catch (error) {
				console.warn(`⚠️ Java puede no ser ejecutable: ${error.message}`);
				// En Windows, esto puede fallar pero el archivo sigue siendo válido
			}
			
			// Si se descargó una nueva versión de Java, actualizar la configuración para uso futuro
			if (compatibleJavaPath !== configClient.java_config.java_path && 
				(configClient.java_config.java_path === null || 
				 configClient.java_config.java_path === 'launcher')) {
				
				// Solo actualizar si el usuario no había configurado una ruta personalizada
				console.log(`📝 Actualizando configuración de Java con nueva ruta automática`);
				configClient.java_config.java_path = compatibleJavaPath;
				await this.db.updateData('configClient', configClient);
			}
			
		} catch (javaError) {
			console.error('❌ Error configurando Java:', javaError);
			
			// Mostrar error específico al usuario
			let popupError = new popup();
			popupError.openPopup({
				title: "Error de Java",
				content: `No se pudo configurar Java para Minecraft ${options.loadder.minecraft_version}:<br>
				${javaError.message}<br><br>
				Por favor:<br>
				- Verifica tu conexión a internet<br>
				- Asegúrate de tener suficiente espacio en disco<br>
				- Si el problema persiste, contacta al soporte`,
				color: "red",
				options: true,
			});
			
			// Restaurar UI
			if (infoStartingBOX) infoStartingBOX.style.display = "none";
			if (instanceSelectBTN) {
				instanceSelectBTN.disabled = false;
				instanceSelectBTN.classList.remove("disabled");
			}
			if (closeGameButton) closeGameButton.style.display = "none";
			ipcRenderer.send("main-window-progress-reset");
			
			return;
		}
		
		// ======== VALIDACIÓN DEL OBJETO AUTENTICADOR ========
		// Asegurar que el nombre del usuario esté dentro del límite de 16 caracteres de Minecraft
		if (authenticator && authenticator.name && authenticator.name.length > 16) {
			console.warn(`⚠️ Nombre de usuario demasiado largo: "${authenticator.name}" (${authenticator.name.length} chars)`);
			console.warn(`🔧 Truncando nombre a 16 caracteres para evitar error de protocolo`);
			
			// Crear una copia del objeto authenticator con el nombre truncado
			authenticator = {
				...authenticator,
				name: authenticator.name.substring(0, 16)
			};
			
			console.log(`✅ Nombre truncado a: "${authenticator.name}" (${authenticator.name.length} chars)`);
		}
		
		console.log(`👤 Usuario final para autenticación: "${authenticator.name}" (${authenticator.name.length} chars)`);
		
		// Configuración específica para minecraft-launcher-core
		opt = {
			// Configuración base de tomate-loaders
			...launchConfig,
			
			// Autenticación
			authorization: authenticator,
			
			// Timeout para conexiones
			timeout: 10000,
			
			// Directorio raíz donde se almacenan los archivos del launcher
			root: instanceGameDirectory,
			
			// Nombre de la instancia
			instance: options.name,
			
			// Configuración de versión
			version: {
				number: options.loadder.minecraft_version,
				type: "release",
				custom: options.loadder.custom_version
			},
			
			// Configuración de proceso separado
			detached: configClient.launcher_config.closeLauncher == "close-all" ? false : true,

			// Configuración del loader (Forge/Fabric/Quilt)
			loader: {
				type: options.loadder.loadder_type,
				build: options.loadder.loadder_version,
				enable: options.loadder.loadder_type !== "none" && options.loadder.loadder_type !== "vanilla"
			},
			
			// Para Forge específicamente, usar el campo forge si está disponible
			...(options.loadder.loadder_type === "forge" && launchConfig.forge ? { forge: launchConfig.forge } : {}),

			// Configuración de Java - usar la ruta verificada/descargada
			javaPath: javaPath,
			
			// Configuración alternativa para minecraft-launcher-core (algunas versiones usan java en vez de javaPath)
			java: javaPath,

			// Argumentos personalizados de JVM (incluir argumentos legacy si es necesario)
			customArgs: [
				...(legacyJvmArgs || []),
				...(options.jvm_args ? options.jvm_args : [])
			],
			
			// Argumentos personalizados del juego
			customLaunchArgs: gameArgs ? gameArgs : [],

			// Configuración de pantalla
			screen: {
				width: configClient.game_config.screen_size.width,
				height: configClient.game_config.screen_size.height,
			},

			// Configuración de memoria
			memory: {
				min: `${configClient.java_config.java_memory.min * 1024}M`,
				max: `${configClient.java_config.java_memory.max * 1024}M`,
			},

			// Overrides específicos para directorios personalizados
			overrides: {
				// Directorio donde el juego genera saves, resource packs, etc.
				gameDirectory: instanceGameDirectory,
				// Directorio donde están los archivos del Minecraft jar y version json
				directory: launchConfig.directory || path.join(rootPath, 'versions', options.loadder.minecraft_version),
				// Directorio de nativos
				natives: path.join(rootPath, 'bin', 'natives'),
				// Directorio de assets
				assetRoot: path.join(rootPath, 'assets'),
				// Directorio de librerías
				libraryRoot: path.join(rootPath, 'libraries'),
				// Directorio de trabajo para el proceso Java
				cwd: instanceGameDirectory,
				detached: configClient.launcher_config.closeLauncher == "close-all" ? false : true,
			}
		};
	
		
		// Verificar que el directorio de mods existe y tiene permisos de escritura
		const modsDir = path.join(instanceGameDirectory, 'mods');
		if (fs.existsSync(modsDir)) {
			try {
				fs.accessSync(modsDir, fs.constants.W_OK);
				console.log(`✅ Directorio de mods accesible: ${modsDir}`);
			} catch (error) {
				console.error(`❌ Error de permisos en directorio de mods: ${error.message}`);
			}
		} else {
			console.error(`❌ Directorio de mods no existe: ${modsDir}`);
		}

		let musicMuted = configClient.launcher_config.music_muted;
		// musicPlaying is already declared at function scope

		let modsApplied = false;
		let specialModCleaned = false;

		// Inicializar el proceso de limpieza antes del lanzamiento
		let gameStartMonitoringStarted = false;
		let cleanupTriggered = false;

		if (
			options.cleaning &&
			options.cleaning.enabled &&
			cleanupManager.enabled
		) {
			console.log(`Configurando limpieza para la instancia: ${options.name}`);
			await cleanupManager.queueCleanup(
				options.name,
				rootPath, // Usar rootPath definido anteriormente
				options.cleaning.files,
				false
			);
		} else {
			console.log(
				`Limpieza no configurada o desactivada para la instancia: ${options.name}`
			);
		}

	launcher.launch(opt);
		
		
		
		infoStarting.innerHTML = localization.t('home.verifying_files');
		//barra de carga indeterminada
		this.setProgressBarIndeterminate();

		launcher.on("extract", (extract) => {
			console.log('Extract event received:', extract);
			ipcRenderer.send("main-window-progress-load");
			infoStarting.innerHTML = localization.t('home.extracting_files');
		});
		// emitir todos los conteniddos de el evento progress
		// no solo el porcentaje
		launcher.on("progress", (type, task, total) => {
			if (type === "assets") {
				// Validar que los valores sean números finitos válidos
				const safeTask = (typeof task === 'number' && isFinite(task)) ? Math.max(0, task) : 0;
				const safeTotal = (typeof total === 'number' && isFinite(total)) ? Math.max(1, total) : 1;
				const safePercentage = safeTotal > 0 ? ((safeTask / safeTotal) * 100).toFixed(0) : '0';
				
				infoStarting.innerHTML = `${localization.t('home.downloading_assets')} ${safePercentage}% (${safeTask}/${safeTotal})`;
				ipcRenderer.send("main-window-progress", { progress: safeTask, size: safeTotal });
				this.setProgressBarDeterminate(safeTask, safeTotal);
			} else if (type === "assets-copy") {
				// Validar que los valores sean números finitos válidos
				const safeTask = (typeof task === 'number' && isFinite(task)) ? Math.max(0, task) : 0;
				const safeTotal = (typeof total === 'number' && isFinite(total)) ? Math.max(1, total) : 1;
				const safePercentage = safeTotal > 0 ? ((safeTask / safeTotal) * 100).toFixed(0) : '0';
				infoStarting.innerHTML = `${localization.t('home.copying_assets')} ${safePercentage}% (${safeTask}/${safeTotal})`;
				ipcRenderer.send("main-window-progress", { progress: safeTask, size: safeTotal });
				this.setProgressBarDeterminate(safeTask, safeTotal);
			} else if (type === "natives") {
				// Validar que los valores sean números finitos válidos
				const safeTask = (typeof task === 'number' && isFinite(task)) ? Math.max(0, task) : 0;
				const safeTotal = (typeof total === 'number' && isFinite(total)) ? Math.max(1, total) : 1;
				const safePercentage = safeTotal > 0 ? ((safeTask / safeTotal) * 100).toFixed(0) : '0';
				infoStarting.innerHTML = `${localization.t('home.downloading_natives')} ${safePercentage}% (${safeTask}/${safeTotal})`;
				ipcRenderer.send("main-window-progress", { progress: safeTask, size: safeTotal });
				this.setProgressBarDeterminate(safeTask, safeTotal);
			} else {
				infoStarting.innerHTML = `${localization.t('home.verifying')}...`;
				ipcRenderer.send("main-window-progress-load");
				//barra de carga indeterminada
				this.setProgressBarIndeterminate();
			}
		});


		launcher.on("download_status", (name, type, current, total) => {
			if (type === "version-jar") {
				infoStarting.innerHTML = `${localization.t('home.downloading_mc_version')} ${name}... (${current}/${total})`;
				ipcRenderer.send("main-window-progress", { progress: current, size: total });
				this.setProgressBarDeterminate(current, total);
			} else if (type === "asset-json") {
				infoStarting.innerHTML = `${localization.t('home.downloading_assets_json')} ${name}... (${current}/${total})`;
				ipcRenderer.send("main-window-progress", { progress: current, size: total });
				this.setProgressBarDeterminate(current, total);
			} else if (type === "assets") {
				infoStarting.innerHTML = `${localization.t('home.downloading_natives')} ${name} (${current}/${total})`;
				ipcRenderer.send("main-window-progress", { progress: current, size: total });
				this.setProgressBarDeterminate(current, total);
			} else if (type === "log4j") {
				infoStarting.innerHTML = `${localization.t('home.downloading_log4j')} ${name} (${current}/${total})`;
				ipcRenderer.send("main-window-progress", { progress: current, size: total });
				this.setProgressBarDeterminate(current, total);
			} else {
				infoStarting.innerHTML = `${localization.t('downloading')} ${name} (${current}/${total})`;
				ipcRenderer.send("main-window-progress", { progress: current, size: total });
				this.setProgressBarDeterminate(current, total);
			}
		});

		launcher.on("check", (progress, size) => {
			// Validar que los valores sean números finitos válidos
			const safeProgress = (typeof progress === 'number' && isFinite(progress)) ? Math.max(0, progress) : 0;
			const safeSize = (typeof size === 'number' && isFinite(size)) ? Math.max(1, size) : 1;
			const safePercentage = safeSize > 0 ? Math.min(100, ((safeProgress / safeSize) * 100)) : 0;
			
			infoStarting.innerHTML = `${localization.t('home.verifying')}...`;
			ipcRenderer.send("main-window-progress", { progress: safeProgress, size: safeSize });
			this.setProgressBarDeterminate(safeProgress, safeSize);
		});

		launcher.on("data", async (e) => {
			if (typeof e === "string") {
				console.log(e);

				if (rpcActive) {
					username = await getUsername();
					RPC.setActivity({
						state: `${localization.t('rpc.playing')} ${configClient.instance_selct}`,
						startTimestamp: startingTime,
						largeImageKey: "icon",
						smallImageKey: `https://minotar.net/helm/${username}/512.png`,
						smallImageText: username,
						largeImageText: pkg.productname,
						instance: true,
					});
				}

				// Procesar la salida para detectar patrones de limpieza si la limpieza está activada
				if (
					options.cleaning &&
					options.cleaning.enabled &&
					cleanupManager.enabled
				) {
					// Procesa la salida para detectar patrones que indiquen que el juego se inició completamente
					cleanupManager.processGameOutput(options.name, e);

					// Si el juego ya se inició completamente y no hemos ejecutado la limpieza
					if (
						cleanupManager.isGameFullyStarted(options.name) &&
						!cleanupTriggered
					) {
						cleanupTriggered = true;
						console.log(
							`Juego completamente iniciado. Ejecutando limpieza de archivos para: ${options.name}`
						);

						try {
							// Esperar un poco para asegurar que el juego esté estable
							setTimeout(async () => {
								await cleanupManager.performStartupCleanup(options.name);
								console.log(
									`Limpieza de archivos completada para: ${options.name}`
								);
							}, 5000);
						} catch (error) {
							console.error(
								`Error durante la limpieza de archivos: ${error.message}`
							);
						}
					}

					if (!gameStartMonitoringStarted) {
						gameStartMonitoringStarted = true;
						console.log(
							`Monitoreo de inicio del juego activado para: ${options.name}`
						);
					}
				}
			}

			if (!modsApplied) {
				modsApplied = true;
				try {
					infoStarting.innerHTML = localization.t('home.applying_optional_mods');
					await this.applyOptionalMods(options.name);
					console.log(`Mods opcionales aplicados para: ${options.name}`);
				} catch (error) {
					console.error(`Error al aplicar mods opcionales: ${error}`);
				}
			}

			if (
				!specialModCleaned &&
				(e.includes("Setting user:") ||
					e.includes("Connecting to") ||
					e.includes("LWJGL Version:") ||
					e.includes("OpenAL initialized"))
			) {
				specialModCleaned = true;
				try {
					launcher;
					const basePath = `${await appdata()}/${
						process.platform == "darwin"
							? this.config.dataDirectory
							: `.${this.config.dataDirectory}`
					}`;
					setTimeout(async () => {
						await cleanupManager.cleanMKLibMods(options.name, basePath);
					}, 5000);
				} catch (cleanError) {
					console.error("Error al limpiar las librerías extra:", cleanError);
				}
			}

			if (!musicMuted && musicPlaying) {
				musicMuted = false;
				fadeOutAudio();
			}
			this.hideProgressBar();
			closeGameButton.style.display = "block";

			if (!playing) {
				playing = true;
				playMSG(configClient.instance_selct);
				removeUserFromQueue(hwid);
				if (configClient.launcher_config.closeLauncher == "close-launcher") {
					ipcRenderer.send("main-window-hide");
				}
			}

			ipcRenderer.send("main-window-progress-load");
			infoStarting.innerHTML = localization.t('home.playing');
		});

		launcher.on("patch", (patch) => {
			console.log(patch);
			ipcRenderer.send("main-window-progress-load");
			infoStarting.innerHTML = localization.t('home.patching');
		});

		launcher.on("close", async (code) => {
			setGameFinished();

			this.notification();
			if (!musicMuted && !musicPlaying) {
				musicPlaying = true;
				setBackgroundMusic(options.backgroundMusic);
			}
			infoStartingBOX.style.display = "none";
			playInstanceBTN.style.display = "flex";
			instanceSelectBTN.disabled = false;
			instanceSelectBTN.classList.remove("disabled");
			infoStarting.innerHTML = localization.t('home.closing');
			console.log("Close");

			if (closeGameButton) {
				closeGameButton.style.display = "none";
			}

			if (configClient.launcher_config?.closeLauncher == "close-launcher") {
				ipcRenderer.send("main-window-show");
			}

			this.enablePlayButton();

			// Ejecutar limpieza en cierre si está configurada
			if (
				options.cleaning &&
				options.cleaning.enabled &&
				cleanupManager.enabled
			) {
				try {
					await cleanupManager.cleanupOnGameClose(options.name);
					console.log(
						`Limpieza en cierre del juego completada para: ${options.name}`
					);
				} catch (error) {
					console.error(`Error durante limpieza en cierre: ${error.message}`);
				}
			}

			if (rpcActive) {
				username = await getUsername();
				RPC.setActivity({
					state: `En el launcher`,
					startTimestamp: startingTime,
					largeImageKey: "icon",
					largeImageText: pkg.productname,
					instance: true,
				}).catch();
				playquitMSG(configClient.instance_selct);
				playing = false;
			}
		});

		launcher.on("error", async (err) => {
			console.error("Error del launcher:", err);
			removeUserFromQueue(hwid);

			// Marcar que el juego ha terminado debido a error
			setGameStopped();
			console.log("❌ Error en el launcher, Java liberado");

			// Restablecer estado de UI
			this.enablePlayButton();
			if (playInstanceBTN) playInstanceBTN.style.display = "flex";
			if (infoStartingBOX) infoStartingBOX.style.display = "none";
			if (instanceSelectBTN) {
				instanceSelectBTN.disabled = false;
				instanceSelectBTN.classList.remove("disabled");
			}
			if (closeGameButton) closeGameButton.style.display = "none";
			
			// Limpiar progreso
			ipcRenderer.send("main-window-progress-reset");
			
			// Restablecer música
			let configClient = await this.db.readData("configClient").catch(() => ({}));
			let musicMuted = configClient.launcher_config?.music_muted;
			if (!musicMuted && !musicPlaying) {
				musicPlaying = true;
				if (options?.backgroundMusic) {
					setBackgroundMusic(options.backgroundMusic);
				}
			}
			
			// Mostrar launcher si estaba oculto
			if (configClient.launcher_config?.closeLauncher == "close-launcher") {
				ipcRenderer.send("main-window-show");
			}

			// Determinar tipo de error y mensaje apropiado
			let errorTitle = "Error al Iniciar el Juego";
			let errorContent = "Ha ocurrido un error inesperado al iniciar el juego.";
			
			if (typeof err.error === "undefined") {
				// Error sin mensaje específico - posiblemente problema de configuración
				errorTitle = "Error de Configuración";
				errorContent = `El juego no pudo iniciarse debido a un problema de configuración.<br><br>Posibles causas:<br>- Archivos del juego corruptos o faltantes<br>- Configuración de Java incorrecta<br>- Problemas con ${options.loadder.loadder_type}<br>- Falta de memoria RAM<br>Si el problema persiste, contacta al soporte técnico.`;
			} else {
				// Error con mensaje específico
				let originalError = err.error;
				
				// Categorizar errores comunes
				if (originalError.includes('OutOfMemoryError') || originalError.includes('heap')) {
					errorTitle = "Error de Memoria";
					errorContent = `El juego se quedó sin memoria RAM.<br><br>Soluciones:<br>- Incrementa la memoria máxima de Java en Configuración<br>- Cierra otros programas que consuman memoria<br>- Usa menos mods o un modpack más ligero<br>Error técnico: ${originalError}`;
				} else if (originalError.includes('java') || originalError.includes('JVM')) {
					errorTitle = "Error de Java";
					errorContent = `Problema con la instalación de Java.<br><br>Soluciones:<br>- Verifica que Java esté instalado correctamente<br>- Reinstala Java desde el sitio oficial<br>- Verifica la ruta de Java en Configuración<br>Error técnico: ${originalError}`;
				} else if (originalError.includes('connection') || originalError.includes('network')) {
					errorTitle = "Error de Conexión";
					errorContent = `No se pudo conectar al servidor.<br><br>Soluciones:<br>- Verifica tu conexión a internet<br>- El servidor puede estar temporalmente no disponible<br>- Verifica que no tengas firewall bloqueando el juego<br>Error técnico: ${originalError}`;
				} else if (originalError.includes('mod') || originalError.includes('forge') || originalError.includes('fabric')) {
					errorTitle = "Error de Mods";
					errorContent = `Problema con mods o el mod loader.<br><br>Soluciones:<br>- Verifica que todos los mods sean compatibles<br>- Verifica que ${options.loadder.loadder_type} sea la versión correcta<br>- Intenta desactivar mods opcionales<br>Error técnico: ${originalError}`;
				} else if (originalError.includes('file') || originalError.includes('path')) {
					errorTitle = "Error de Archivos";
					errorContent = `Problema con archivos del juego.<br><br>Soluciones:<br>- Ejecuta el launcher como administrador<br>- Verifica permisos de la carpeta del juego<br>- Verifica que hay suficiente espacio en disco<br>Error técnico: ${originalError}`;
				} else {
					errorContent = `${originalError}<br><br>Si el problema persiste, contacta al soporte técnico.`;
				}
			}

			// Actualizar Discord RPC
			if (rpcActive) {
				try {
					let username = await getUsername();
					RPC.setActivity({
						state: `En el launcher`,
						largeImageKey: "icon",
						largeImageText: pkg.productname,
						instance: true,
					}).catch();
				} catch (rpcError) {
					console.error("Error al actualizar Discord RPC:", rpcError);
				}
			}

			// Mostrar popup de error
			let popupError = new popup();
			popupError.openPopup({
				title: errorTitle,
				content: errorContent,
				color: "red",
				options: true
			});

			// Resetear notificación y estado
			this.notification();
			infoStarting.innerHTML = `${localization.t('home.verifying')}...`;
		});
		
		} catch (error) {
			console.error("Error fatal en startGame:", error);
			
			// Restablecer el estado de la UI
			this.enablePlayButton();
			const playInstanceBTN = document.querySelector(".play-instance");
			const infoStartingBOX = document.querySelector(".info-starting-game");
			const instanceSelectBTN = document.querySelector(".instance-select");
			const closeGameButton = document.querySelector(".force-close-button");
			
			if (playInstanceBTN) playInstanceBTN.style.display = "flex";
			if (infoStartingBOX) infoStartingBOX.style.display = "none";
			if (instanceSelectBTN) {
				instanceSelectBTN.disabled = false;
				instanceSelectBTN.classList.remove("disabled");
			}
			if (closeGameButton) closeGameButton.style.display = "none";
			
			// Limpiar barra de progreso
			ipcRenderer.send("main-window-progress-reset");
			
			// Restablecer música si estaba silenciada
			let configClient = await this.db.readData("configClient").catch(() => ({}));
			let musicMuted = configClient.launcher_config?.music_muted;
			if (!musicMuted && !musicPlaying) {
				musicPlaying = true;
				if (options?.backgroundMusic) {
					setBackgroundMusic(options.backgroundMusic);
				}
			}
			
			// Mostrar popup de error
			let popupError = new popup();
			popupError.openPopup({
				title: "Error Fatal",
				content: `Ha ocurrido un error inesperado al iniciar el juego:\n\n${error.message}\n\nRevisa la consola para más detalles.`,
				color: "red",
				options: true,
			});
			
			// Limpiar Discord RPC si estaba activo
			if (rpcActive) {
				try {
					let username = await getUsername();
					RPC.setActivity({
						state: `En el launcher`,
						largeImageKey: "icon",
						largeImageText: pkg.productname,
						instance: true,
					}).catch();
				} catch (rpcError) {
					console.error("Error al actualizar Discord RPC:", rpcError);
				}
			}
		}
	}

	async applyOptionalMods(instanceName) {
		console.log(`Aplicando mods opcionales para instancia: ${instanceName}`);

		const instances = await config.getInstanceList();
		const instance = instances.find((i) => i.name === instanceName);

		if (
			!instance ||
			!instance.optionalMods ||
			instance.optionalMods.length === 0
		) {
			console.log(`No hay mods opcionales para la instancia: ${instanceName}`);
			return;
		}

		const db = new database();
		let configClient = await db.readData("configClient");

		const activeModsForInstance = configClient.mods_enabled
			.filter((modId) => {
				const [modIdInstanceName] = modId.split("-");
				return modIdInstanceName === instanceName;
			})
			.map((modId) => {
				const [, modIdModName] = modId.split("-");
				return modIdModName;
			});

		let res = await config.GetConfig();
		const appdataPath = await appdata();
		const instanceModsPath = path.join(
			appdataPath,
			process.platform == "darwin"
				? res.dataDirectory
				: `.${res.dataDirectory}`,
			"instances",
			instanceName,
			"mods"
		);

		for (const mod of instance.optionalMods) {
			const modIsActiveInConfig = activeModsForInstance.includes(mod.name);
			const modFile = mod.file;

			const activeModPath = path.join(instanceModsPath, `${modFile}.jar`);
			const disabledModPath = path.join(
				instanceModsPath,
				`${modFile}.disabled`
			);

			if (!fs.existsSync(activeModPath) && !fs.existsSync(disabledModPath)) {
				console.warn(`No se ha encontrado el mod opcional: ${modFile}`);
				continue;
			}

			try {
				if (modIsActiveInConfig && fs.existsSync(disabledModPath)) {
					console.log(`Activando mod: ${modFile}`);
					fs.renameSync(disabledModPath, activeModPath);
				} else if (!modIsActiveInConfig && fs.existsSync(activeModPath)) {
					console.log(`Desactivando mod: ${modFile}`);
					fs.renameSync(activeModPath, disabledModPath);
				}
			} catch (error) {
				console.error(`Error al procesar el mod ${modFile}:`, error);
			}
		}

		return true;
	}

	async checkQueueStatus(hwid, username) {
		return new Promise(async (resolve, reject) => {
			let cancelled = false;
			let infoStarting = document.querySelector(".info-starting-game-text");

			let cancelButton = document.createElement("button");
			cancelButton.textContent = "Cancelar";
			cancelButton.classList.add("cancel-queue-button");

			cancelButton.addEventListener("click", async () => {
				cancelled = true;
				document.querySelector(".info-starting-game").removeChild(cancelButton);
				await removeUserFromQueue(hwid);
				resolve({ cancelled: true });
			});

			document.querySelector(".info-starting-game").appendChild(cancelButton);

			const checkStatus = async () => {
				if (cancelled) return;

				try {
					const formData = new URLSearchParams();
					formData.append("hwid", hwid);
					formData.append("username", username);

					const response = await fetch(`${pkg.url}/api/queue-status.php`, {
						method: "POST",
						body: formData,
						headers: {
							"Content-Type": "application/x-www-form-urlencoded",
							"User-Agent": "MiguelkiNetworkMCLauncher",
						},
					});

					if (!response.ok) {
						throw new Error(`Error en la respuesta: ${response.status}`);
					}

					const data = await response.json();

					if (data.status === "open") {
						if (
							document
								.querySelector(".info-starting-game")
								.contains(cancelButton)
						) {
							document
								.querySelector(".info-starting-game")
								.removeChild(cancelButton);
						}
						infoStarting.innerHTML = localization.t('home.preparing_launch');
						resolve({ cancelled: false });
						return;
					} else if (data.status === "on_queue") {
						infoStarting.innerHTML = `${localization.t('home.queue_position')}: ${data.position} / ${data.total_in_queue}`;

						if (!cancelled) {
							setTimeout(checkStatus, 30000);
						}
					} else {
						throw new Error(`Estado de cola desconocido: ${data.status}`);
					}
							} catch (error) {
					if (
						document.querySelector(".info-starting-game").contains(cancelButton)
					) {
						document
							.querySelector(".info-starting-game")
							.removeChild(cancelButton);
					}

					reject(error);
				}
			};

			await checkStatus();
		});
	}

	async loadRecentInstances() {
		try {
			const configClient = await this.db.readData("configClient");
			const recentInstances = configClient.recent_instances || [];
			const recentInstancesContainer =
				document.querySelector(".recent-instances");
			const instancesList = await config.getInstanceList();

			recentInstancesContainer.innerHTML = "";

			if (
				!recentInstances.length ||
				!instancesList ||
				instancesList.length === 0
			) {
				return;
			}

			const validInstances = recentInstances.filter((name) =>
				instancesList.some((instance) => instance.name === name)
			);

			if (validInstances.length !== recentInstances.length) {
				configClient.recent_instances = validInstances;
				await this.db.updateData("configClient", configClient);
			}

			const username = await getUsername();

			for (const instanceName of validInstances) {
				const instance = instancesList.find((i) => i.name === instanceName);

				if (!instance) continue;

				const button = document.createElement("div");
				button.classList.add("recent-instance-button");
				button.style.backgroundImage = `url(${
					instance.icon ||
					instance.thumbnail ||
					"assets/images/default/placeholder.jpg"
				})`;
				button.dataset.instanceName = instanceName;

				if (instanceName === configClient.instance_selct) {
					button.classList.add("selected-instance");
				}

				button.addEventListener("click", async () => {
					const refreshedInstances = await config.getInstanceList();
					const refreshedInstance = refreshedInstances.find(
						(i) => i.name === instanceName
					);
					const currentUsername = await getUsername();

					if (
						refreshedInstance &&
						refreshedInstance.whitelistActive &&
						(!refreshedInstance.whitelist ||
							!refreshedInstance.whitelist.includes(currentUsername))
					) {
						const popupError = new popup();
						popupError.openPopup({
							title: "Error",
							content: "No tienes permiso para seleccionar esta instancia.",
							color: "red",
							options: true,
						});
					} else {
						await this.selectInstance(instanceName);
					}
				});

				this.addTooltipToElement(button, instanceName);

				recentInstancesContainer.appendChild(button);
			}
		} catch (error) {
			console.error("Error al cargar instancias recientes:", error);
		}
	}

	addTooltipToElement(element, text) {
		if (!window.tooltipManager) {
			this.initializeTooltipManager();
		}

		element.addEventListener("mouseenter", (e) => {
			window.tooltipManager.showTooltip(element, text);
		});

		element.addEventListener("mouseleave", (e) => {
			window.tooltipManager.hideTooltip(element);
		});

		const observer = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				if (
					mutation.type === "childList" &&
					Array.from(mutation.removedNodes).some(
						(node) =>
							node === element || (node.contains && node.contains(element))
					)
				) {
					if (window.tooltipManager) {
						window.tooltipManager.hideTooltip(element);
					}
					observer.disconnect();
					break;
				}
			}
		});

		if (element.parentNode) {
			observer.observe(element.parentNode, { childList: true, subtree: true });
		}
	}

	addPlayerTooltip() {
		const playerOptions = document.querySelector(".player-options");

		if (!window.tooltipManager) {
			this.initializeTooltipManager();
		}

		if (playerOptions) {
			let tooltipActive = false;

			playerOptions.addEventListener("mouseenter", async (e) => {
				if (tooltipActive) return;
				tooltipActive = true;

				try {
					const username = await getUsername();
					if (username) {
						window.tooltipManager.showTooltip(playerOptions, username);
					}
				} catch (error) {
					console.error("Error al obtener el nombre de usuario:", error);
				}
			});

			playerOptions.addEventListener("mouseleave", (e) => {
				tooltipActive = false;
				window.tooltipManager.hideTooltip(playerOptions);
			});

			playerOptions.style.pointerEvents = "auto";
		}
	}

	initializeTooltipManager() {
		if (window.tooltipManager) return;

		window.tooltipManager = {
			activeTooltips: new Map(),

			showTooltip(element, text) {
				this.hideTooltip(element);

				const tooltip = document.createElement("div");
				tooltip.classList.add("tooltip");
				tooltip.innerHTML = text;
				document.body.appendChild(tooltip);

				const rect = element.getBoundingClientRect();
				tooltip.style.left = `${rect.right + window.scrollX + 10}px`;
				tooltip.style.top = `${
					rect.top + window.scrollY + rect.height / 2 - tooltip.offsetHeight / 2
				}px`;

				tooltip.style.zIndex = "10000";

				this.activeTooltips.set(element, tooltip);

				tooltip.style.opacity = "1";
			},

			hideTooltip(element) {
				const tooltip = this.activeTooltips.get(element);
				if (tooltip) {
					tooltip.style.opacity = "0";
					this.activeTooltips.delete(element);

					setTimeout(() => {
						if (document.body.contains(tooltip)) {
							document.body.removeChild(tooltip);
						}
					}, 200);
				}
			},

			hideAllTooltips() {
				this.activeTooltips.forEach((tooltip, element) => {
					this.hideTooltip(element);
				});
			},

			cleanupOrphanedTooltips() {
				document.querySelectorAll(".tooltip").forEach((tooltip) => {
					if (!Array.from(this.activeTooltips.values()).includes(tooltip)) {
						if (document.body.contains(tooltip)) {
							document.body.removeChild(tooltip);
						}
					}
				});
			},
		};

		document.addEventListener("mouseleave", () => {
			window.tooltipManager.hideAllTooltips();
		});

		window.addEventListener("blur", () => {
			window.tooltipManager.hideAllTooltips();
		});

		setInterval(() => {
			window.tooltipManager.cleanupOrphanedTooltips();
		}, 5000);

		document.addEventListener("click", () => {
			window.tooltipManager.hideAllTooltips();
		});

		document.addEventListener("visibilitychange", () => {
			if (document.visibilityState === "hidden") {
				window.tooltipManager.hideAllTooltips();
			}
		});
	}

	async selectInstance(instanceName) {
		let selectInstanceBTN = document.querySelector(".instance-select");
		if (selectInstanceBTN.disabled) return;

		try {
			let configClient = await this.db.readData("configClient");
			const oldInstance = configClient.instance_selct;
			configClient.instance_selct = instanceName;
			await this.db.updateData("configClient", configClient);

			// Clear MinecraftStatus cache when switching instances
			if (oldInstance !== instanceName) {
				console.log('Clearing server status cache due to instance change');
				MinecraftStatus.clearCache();
			}

			let instance = await config
				.getInstanceList()
				.then((instances) => instances.find((i) => i.name === instanceName));

			if (!instance) {
				return;
			}

			this.notification();
			setStatus(instance);

			const performanceMode = isPerformanceModeEnabled();
			if (performanceMode) {
				setBackgroundMusic(instance.backgroundMusic);
				if (
					instance.background &&
					instance.background.match(/^(http|https):\/\/[^ "]+$/)
				) {
					document
						.querySelector(".server-status-icon")
						?.setAttribute("data-background", instance.background);
				} else {
					document
						.querySelector(".server-status-icon")
						?.removeAttribute("data-background");
				}
			} else {
				setBackgroundMusic(instance.backgroundMusic);
				setInstanceBackground(instance.background);
			}

			this.updateSelectedInstanceStyle(instanceName);
		} catch (error) {
			console.error("Error al seleccionar instancia:", error);
		}
	}

	updateSelectedInstanceStyle(instanceName) {
		const recentInstancesContainer =
			document.querySelector(".recent-instances");
		const buttons = recentInstancesContainer.querySelectorAll(
			".recent-instance-button"
		);

		buttons.forEach((button) => {
			if (button.dataset.instanceName === instanceName) {
				button.classList.add("selected-instance");
			} else {
				button.classList.remove("selected-instance");
			}
		});
	}

	updateInstanceBackground(instance) {
		const performanceMode = isPerformanceModeEnabled();
		if (performanceMode) {
			if (
				instance.background &&
				instance.background.match(/^(http|https):\/\/[^ "]+$/)
			) {
				captureAndSetVideoFrame(instance.background);
			}
		}
	}

	getdate(e) {
		let date = new Date(e);
		let year = date.getFullYear();
		let month = date.getMonth() + 1;
		let day = date.getDate();
		let allMonth = [
			"Enero",
			"Febrero",
			"Marzo",
			"Abril",
			"Mayo",
			"Junio",
			"Julio",
			"Agosto",
			"Septiembre",
			"Octubre",
			"Noviembre",
			"Diciembre",
		];
		return { year: year, month: allMonth[month - 1], day: day };
	}

	addInstanceButton() {
		const addInstanceButton = document.querySelector(".add-instance");
		const instancePopup = document.querySelector(".instance-popup");
		const addInstancePopup = document.querySelector(".add-instance-popup");
		const addInstanceInput = document.querySelector(".add-instance-input");
		const addInstanceConfirm = document.querySelector(".add-instance-confirm");
		const addInstanceCancel = document.querySelector(".add-instance-cancel");

		addInstanceButton.addEventListener("click", () => {
			addInstancePopup.classList.add("show");
		});

		addInstanceConfirm.addEventListener("click", async () => {
			const code = addInstanceInput.value;
			if (code) {
				try {
					const username = await getUsername();
					const response = await fetch(
						`${pkg.url}/api/instance-code.php?code=${code}&user=${username}`,
						{
							headers: {
								"User-Agent": "MiguelkiNetworkMCLauncher",
							},
						}
					);
					const result = await response.json();

					const popupMessage = new popup();
					popupMessage.openPopup({
						title: result.success ? "Éxito" : "Error",
						content: result.message,
						color: result.success ? "green" : "red",
						options: true,
					});
					if (result.success) {
						await this.instancesSelect();
					}
					addInstanceMSG(result.success, code);
					addInstancePopup.classList.remove("show");
					addInstanceInput.value = "";
				} catch (error) {
					addInstanceMSG(false, code);
					const popupMessage = new popup();
					popupMessage.openPopup({
						title: "Error",
						content: "Ha ocurrido un error al intentar agregar el código.",
						color: "red",
						options: true,
					});
				}
			}
		});

		addInstanceCancel.addEventListener("click", () => {
			addInstancePopup.classList.remove("show");
			addInstanceInput.value = "";
		});
	}

	async runCleanupBatchFiles() {
		try {
			const fs = require("fs");
			const path = require("path");
			const glob = require("glob");
			const { exec } = require("child_process");

			const appDir = await appdata();
			const instancesDir = path.join(
				appDir,
				process.platform === "darwin"
					? this.config.dataDirectory
					: `.${this.config.dataDirectory}`,
				"instances"
			);

			if (!fs.existsSync(instancesDir)) {
				return;
			}

			const batchFiles = glob.sync(
				path.join(instancesDir, "**", "_cleanup_*.bat")
			);

			if (batchFiles.length > 0) {
				for (const batchFile of batchFiles) {
					exec(`"${batchFile}"`, (error, stdout, stderr) => {
						if (error) {
							return;
						}
						if (stderr) {
							return;
						}
					});
				}
			}
		} catch (error) {
			console.error("Error running cleanup batch files:", error);
		}
	}

	addInterfaceTooltips() {
		if (!window.tooltipManager) {
			this.initializeTooltipManager();
		}

		const addInstanceButton = document.querySelector(".add-instance");
		if (addInstanceButton) {
			this.addTooltipToElement(addInstanceButton, localization.t('tooltips.add_instance'));
		}

		const instanceSelectButton = document.querySelector(".instance-select");
		if (instanceSelectButton) {
			this.addTooltipToElement(instanceSelectButton, localization.t('tooltips.select_instance'));
		}

		const musicButton = document.querySelector(".action-button:nth-child(1)");
		if (musicButton) {
			this.addDynamicTooltipToElement(musicButton, () =>
				musicButton
					.querySelector(".music-btn")
					.classList.contains("icon-speaker-on")
					? localization.t('tooltips.mute_music')
					: localization.t('tooltips.play_music')
			);
		}

		const modsButton = document.querySelector(".action-button:nth-child(2)");
		if (modsButton) {
			this.addTooltipToElement(modsButton, localization.t('tooltips.manage_mods'));
		}

		const settingsButton = document.querySelector(
			".action-button:nth-child(3)"
		);
		if (settingsButton) {
			this.addTooltipToElement(settingsButton, localization.t('tooltips.settings'));
		}
	}

	addDynamicTooltipToElement(element, textCallback) {
		if (!window.tooltipManager) {
			this.initializeTooltipManager();
		}

		element.addEventListener("mouseenter", (e) => {
			const text =
				typeof textCallback === "function" ? textCallback() : textCallback;
			window.tooltipManager.showTooltip(element, text);
		});

		element.addEventListener("mouseleave", (e) => {
			window.tooltipManager.hideTooltip(element);
		});

		const observer = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				if (
					mutation.type === "childList" &&
					Array.from(mutation.removedNodes).some(
						(node) =>
							node === element || (node.contains && node.contains(element))
					)
				) {
					window.tooltipManager.hideTooltip(element);
					observer.disconnect();
				}
			}
		});

		if (element.parentNode) {
			observer.observe(element.parentNode, { childList: true, subtree: true });
		}
	}

	initializeCloseGameButton() {
		if (!document.querySelector(".force-close-button")) {
			const progressBar = document.querySelector(".progress-bar");
			const parentElement = progressBar.parentElement;

			const closeGameButton = document.createElement("div");
			closeGameButton.className = "force-close-button";
			closeGameButton.innerHTML = localization.t('home.close_game');
			closeGameButton.style.display = "none";

			closeGameButton.addEventListener("click", () => this.closeRunningGame());

			parentElement.insertBefore(closeGameButton, progressBar.nextSibling);
		}
	}

	closeRunningGame() {
		if (!playing) {
			console.warn("No hay juego en ejecución para cerrar");
			return;
		}

		try {
			const closeGamePopup = new popup();
			closeGamePopup.openDialog({
				title: localization.t('home.close_game'),
				content:
					localization.t('home.close_game_confirmation'),
				options: true,
				callback: async (result) => {
					if (result === "cancel") {
						return;
					}

					try {
						console.log("Intentando cerrar el proceso de Minecraft...");
						closeGamePopup.openPopup({
							title: localization.t('home.closing'),
							content: localization.t('home.closing_game_info'),
							color: "var(--color)",
							options: false,
						});
						const killed = await killMinecraftProcess();
						closeGamePopup.closePopup();

						if (killed) {
							console.log("Proceso de Minecraft terminado correctamente");

							const successPopup = new popup();
							successPopup.openPopup({
								title: localization.t('home.game_closed'),
								content: localization.t('home.game_closed_info'),
								color: "var(--color)",
								options: true,
							});
						} else {
							console.error("No se pudo terminar el proceso de Minecraft");

							const errorPopup = new popup();
							errorPopup.openPopup({
								title: "Error",
								content:
									localization.t('home.game_closed_error'),
								color: "red",
								options: true,
							});
						}
					} catch (err) {
						console.error("Error al intentar cerrar el juego:", err);

						const errorPopup = new popup();
						errorPopup.openPopup({
							title: localization.t('launcher.error'),
							content:
								localization.t('home.game_closed_error'),
						 color: "red",
							options: true,
						});
					}
				},
			});
		} catch (error) {
			console.error("Error al intentar cerrar el juego:", error);
		}
	}

	// Funciones para manejar los estados de la barra de progreso
	setProgressBarIndeterminate() {
		const progressBar = document.querySelector(".progress-bar");
		if (progressBar) {
			progressBar.classList.add("indeterminate");
			progressBar.removeAttribute("value");
			progressBar.removeAttribute("max");
		}
	}

	setProgressBarDeterminate(value = 0, max = 100) {
		const progressBar = document.querySelector(".progress-bar");
		if (progressBar) {
			progressBar.classList.remove("indeterminate");
			progressBar.value = value;
			progressBar.max = max;
		}
	}

	hideProgressBar() {
		const progressBar = document.querySelector(".progress-bar");
		if (progressBar) {
			progressBar.style.display = "none";
			progressBar.classList.remove("indeterminate");
		}
	}

	showProgressBar() {
		const progressBar = document.querySelector(".progress-bar");
		if (progressBar) {
			progressBar.style.display = "block";
		}
	}

	// Función para mostrar el popup con estado de carga
	showInstancePopupWithLoading() {
		let instancePopup = document.querySelector(".instance-popup");
		let instancesGrid = document.querySelector(".instances-grid");
		let skeletonGrid = document.querySelector(".skeleton-grid");
		let loadingContainer = document.querySelector(".loading-container");
		let instancesGridContainer = document.querySelector(".instances-grid-container");
		
		// Mostrar el popup inmediatamente
		instancePopup.classList.add("show");
		
		// Ocultar el contenedor de instancias reales
		if (instancesGridContainer) {
			instancesGridContainer.style.display = "none";
		}
		
		// Limpiar el contenido del instances-grid
		instancesGrid.innerHTML = "";
		
		// Mostrar el skeleton loading y el spinner
		if (skeletonGrid) {
			skeletonGrid.style.display = "grid";
			console.log("Skeleton grid mostrado");
		}
		if (loadingContainer) {
			loadingContainer.style.display = "flex";
			console.log("Loading container mostrado");
		}
	}

	// Función para ocultar el loading y mostrar las instancias reales
	hideInstanceLoading() {
		let instancesGrid = document.querySelector(".instances-grid");
		let skeletonGrid = document.querySelector(".skeleton-grid");
		let loadingContainer = document.querySelector(".loading-container");
		let instancesGridContainer = document.querySelector(".instances-grid-container");
		
		// Ocultar elementos de loading
		if (skeletonGrid) skeletonGrid.style.display = "none";
		if (loadingContainer) loadingContainer.style.display = "none";
		
		// Mostrar el contenedor de instancias reales
		if (instancesGridContainer) {
			instancesGridContainer.style.display = "flex";
		}
		
		// Mostrar el grid de instancias reales
		instancesGrid.style.display = "grid";
	}
}
export default Home;