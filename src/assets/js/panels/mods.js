import { config, database, logger, changePanel, localization} from '../utils.js'

class Mods {
    static id = "mods";
    async init(config) {
        this.config = config;
        this.db = new database();
        const dropdownButton = document.querySelector('.dropdown-instance-select button');
        const dropdown = document.querySelector('.dropdown-instance-select-content');
        const dropdownSpan = dropdownButton.querySelector('span');
        
        dropdownSpan.textContent = '\u25BC';

        document.querySelector('.back-btn').addEventListener('click', e => {
            document.querySelector('.mods-list').innerHTML = '';
            document.querySelector('.dropdown-instance-select button a').innerHTML = localization.t('mods.select_client');
            changePanel('home')
        })

        dropdownButton.addEventListener('click', async () => {
            dropdown.innerHTML = '';

            const instances = await this.getInstancesWithOptionalMods();
            instances.forEach(instance => {
                const dropdownItem = document.createElement('a');
                dropdownItem.textContent = instance.name;
                dropdownItem.addEventListener('click', () => {
                    this.selectInstance(instance);
                    document.querySelector('.dropdown-instance-select button a').innerHTML = instance.name;
                    dropdown.style.maxHeight = null;
                });
                dropdown.appendChild(dropdownItem);
            });

            if (dropdown.style.maxHeight){
                dropdown.style.maxHeight = null;
                dropdownSpan.style.transform = 'rotate(0deg)';
            } else {
                dropdown.style.maxHeight = dropdown.scrollHeight + "px";
                dropdownSpan.style.transform = 'rotate(180deg)';
            }
        });
    }

    async getInstancesWithOptionalMods() {
        const instances = await config.getInstanceList()
        let configClient = await this.db.readData('configClient')
        let auth = await this.db.readData('accounts', configClient.account_selected);

        const filteredInstances = instances.filter(instance => {
            if (instance.whitelistActive) {
                return instance.whitelist.includes(auth?.name);
            } else {
                return true;
            }
        });
    
        return filteredInstances;
    }

    async selectInstance(instance) {
        let modsPanel = document.querySelector('.mods-panel .mods-list');
        modsPanel.innerHTML = '';
        let configClient = await this.db.readData('configClient')
    
        if (instance.optionalMods && instance.optionalMods.length > 0) {
            instance.optionalMods.forEach(async mod => {
                const modItem = document.createElement('div');
                modItem.className = 'mod-item'; 
    
                const modImg = document.createElement('img');
                modImg.src = mod.img; 
                modItem.appendChild(modImg); 
    
                const modName = document.createElement('span'); 
                modName.textContent = mod.name; 
                modItem.appendChild(modName); 
    
                const modSwitch = document.createElement('input');
                modSwitch.type = 'checkbox';
                modSwitch.className = 'checkbox';
    
                const modId = `${instance.name}-${mod.name}`;
                modSwitch.id = modId;
    
                const modSwitchStyled = document.createElement('label');
                modSwitchStyled.htmlFor = modId;
                modSwitchStyled.className = 'switch';
    
                if (configClient && configClient.mods_enabled && configClient.mods_enabled.includes(modId)) {
                    modSwitch.checked = true;
                } else {
                    modSwitch.checked = false;
                }
    
                modItem.appendChild(modSwitch);

                modSwitch.addEventListener('change', async () => {
                    if (!configClient.mods_enabled) {
                        configClient.mods_enabled = [];
                    }
                    if (modSwitch.checked) {
                        if (!configClient.mods_enabled.includes(modId)) {
                            configClient.mods_enabled.push(modId);
                        }
                    } else {
                        const index = configClient.mods_enabled.indexOf(modId);
                        if (index > -1) {
                            configClient.mods_enabled.splice(index, 1);
                        }
                    }
    
                    await this.db.updateData('configClient', configClient);
    
                    configClient = await this.db.readData('configClient');
                });

                modItem.appendChild(modSwitchStyled);
    
                modsPanel.appendChild(modItem);
            });
        } else {
            modsPanel.textContent = localization.t('mods.no_mods');
        }
    }
}
export default Mods;
