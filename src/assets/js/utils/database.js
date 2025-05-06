/**
 * @author MiguelkiNetwork (based on work by Luuxis)
 * @license CC-BY-NC 4.0 - https://creativecommons.org/licenses/by-nc/4.0
 */

import encryptedStorage from './encrypted-storage.js';
const { ipcRenderer } = require('electron');

class database {
    constructor() {
        // Queue to handle operations sequentially
        this.queue = Promise.resolve();
        this.busyRetryCount = 3;
        this.busyRetryDelay = 200;
        
        // Initialize database on creation
        this.init();
    }

    // Initialize database and verify storage
    async init() {
        try {
            // Consolidate storage to fix any issues on startup
            await this.consolidateStorage();
            console.log('Database initialized successfully');
        } catch (error) {
            console.error('Error initializing database:', error);
            // Continue even if initialization fails
        }
    }

    // Execute operations in sequence with retry logic
    async execute(operation) {
        return new Promise((resolve, reject) => {
            this.queue = this.queue.then(async () => {
                let attempt = 0;
                while (true) {
                    try {
                        const result = await operation();
                        resolve(result);
                        return result;
                    } catch (error) {
                        // Check if this is a database lock/busy error
                        const errorMsg = error.message || '';
                        const isBusyError = 
                            errorMsg.includes('busy') || 
                            errorMsg.includes('locked') ||
                            errorMsg.includes('timeout');
                        
                        // If it's a lock error and we haven't exceeded retry attempts
                        if (isBusyError && attempt < this.busyRetryCount) {
                            attempt++;
                            console.warn(`Database busy, retrying operation (attempt ${attempt}/${this.busyRetryCount})...`);
                            // Wait before retrying with exponential backoff
                            await new Promise(r => setTimeout(r, this.busyRetryDelay * attempt));
                        } else {
                            reject(error);
                            throw error;
                        }
                    }
                }
            }).catch(error => {
                reject(error);
                return Promise.resolve(); // Keep the queue going
            });
        });
    }

    // Create data with compatibility with the original implementation
    async createData(tableName, data) {
        return this.execute(async () => {
            if (!data) {
                throw new Error('Cannot create null or undefined data');
            }

            // Handle different table types
            if (tableName === 'accounts') {
                // Keep a copy without modifications
                const cleanData = JSON.parse(JSON.stringify(data));
                
                // Add to storage with ID handling
                const result = await encryptedStorage.addAccount(cleanData);
                
                if (!result) {
                    throw new Error('Failed to add account');
                }
                
                // Ensure the original ID format is maintained for compatibility
                // This is crucial for the Minecraft-java-core library
                if (result.ID !== undefined) {
                    // Convert ID to number for better compatibility with original system
                    result.ID = Number(result.ID);
                }
                
                return result;
            } else {
                // For configClient and other data, save directly
                const saved = await encryptedStorage.saveData(tableName, data);
                if (!saved) {
                    throw new Error('Failed to save encrypted data');
                }
                return data;
            }
        });
    }

    // Read data with compatibility with the original implementation
    async readData(tableName, key = 1) {
        return this.execute(async () => {
            // Ensure key is treated as a number for compatibility
            let keyId = Number(key);
            
            // For accounts table with specific ID
            if (tableName === 'accounts' && key !== undefined) {
                console.log(`Reading single account with ID: ${keyId}`);
                
                // Get all accounts first to ensure we have the freshest data
                const allAccounts = await encryptedStorage.getAllAccounts();
                
                if (!Array.isArray(allAccounts) || allAccounts.length === 0) {
                    console.warn(`Account with ID ${keyId} not found - no accounts available`);
                    return undefined;
                }
                
                // Try both string and number comparison to ensure we find the account
                // First try with number comparison (more strict)
                let account = allAccounts.find(acc => 
                    acc && Number(acc.ID) === keyId
                );
                
                // If not found with number comparison, try with string comparison
                if (!account) {
                    account = allAccounts.find(acc => 
                        acc && String(acc.ID) === String(keyId)
                    );
                    
                    if (account) {
                        console.log(`Found account: ${account.name} with ID: ${account.ID} using string comparison`);
                    }
                } else {
                    console.log(`Found account: ${account.name} with ID: ${account.ID} using number comparison`);
                }
                
                if (!account) {
                    console.warn(`Account with ID ${keyId} not found in readData`);
                    console.log(`Available accounts: ${allAccounts.map(a => `${a?.name}(${a?.ID})`).join(', ')}`);
                    return undefined; // Return undefined to match original behavior
                }
                
                // Ensure ID is a number for compatibility
                const accountCopy = JSON.parse(JSON.stringify(account));
                accountCopy.ID = Number(accountCopy.ID);
                return accountCopy;
            } 
            // For accounts with no specific ID (get all accounts)
            else if (tableName === 'accounts') {
                console.log(`Reading all accounts (no specific ID provided)`);
                const accounts = await encryptedStorage.getAllAccounts();
                
                // Ensure we always return an array
                if (!Array.isArray(accounts)) {
                    console.warn(`Read non-array account data, fixing...`);
                    if (typeof accounts === 'object' && accounts !== null && accounts.ID !== undefined && accounts.name) {
                        // Convert single account object to array with numeric ID
                        const singleAccount = { ...accounts };
                        singleAccount.ID = Number(singleAccount.ID);
                        return [singleAccount];
                    }
                    return [];
                } else {
                    // Ensure all IDs are numbers for compatibility
                    return accounts.map(account => {
                        if (account && account.ID !== undefined) {
                            const accountCopy = JSON.parse(JSON.stringify(account));
                            accountCopy.ID = Number(accountCopy.ID);
                            return accountCopy;
                        }
                        return account;
                    });
                }
            } 
            // For configClient or other data
            else {
                // Load the entire file
                const data = await encryptedStorage.loadData(tableName);
                
                // Handle empty data
                if (!data) return undefined;
                
                return data;
            }
        }).catch(error => {
            console.error(`Error reading encrypted data (${tableName}):`, error);
            if (tableName === 'accounts') {
                return [];
            }
            return undefined;
        });
    }

    // Read all data with compatibility with the original implementation
    async readAllData(tableName) {
        return this.execute(async () => {
            if (tableName === 'accounts') {
                const accounts = await encryptedStorage.getAllAccounts();
                
                if (!Array.isArray(accounts) || accounts.length === 0) {
                    return [];
                }
                
                // Ensure all IDs are numbers for compatibility
                const normalizedAccounts = accounts.map(account => {
                    if (account && account.ID !== undefined) {
                        // Create a fresh copy to avoid reference issues
                        const accountCopy = JSON.parse(JSON.stringify(account));
                        accountCopy.ID = Number(accountCopy.ID);
                        return accountCopy;
                    }
                    return account;
                });
                
                console.log(`ReadAllData found ${normalizedAccounts.length} accounts with IDs: ${normalizedAccounts.map(a => a?.ID).join(', ')}`);
                return normalizedAccounts;
            } else {
                // For other data types
                const data = await encryptedStorage.loadData(tableName);
                return data || [];
            }
        }).catch(error => {
            console.error(`Error reading all data (${tableName}):`, error);
            return [];
        });
    }

    // Update data with compatibility with the original implementation
    async updateData(tableName, data, key = 1) {
        return this.execute(async () => {
            // Ensure key is treated as a number for compatibility
            key = Number(key);
            
            // Create deep copy to avoid modifying original data
            let dataCopy = JSON.parse(JSON.stringify(data));
            
            // For accounts, update a specific account
            if (tableName === 'accounts' && key !== 1) {
                if (!dataCopy) {
                    throw new Error('Cannot update with null or undefined data');
                }

                // Ensure ID is a number for compatibility
                if (dataCopy.ID !== undefined) {
                    dataCopy.ID = Number(dataCopy.ID);
                }

                // Verify the account exists before updating
                const allAccounts = await encryptedStorage.getAllAccounts();
                const accountExists = Array.isArray(allAccounts) && 
                    allAccounts.some(acc => Number(acc.ID) === key || String(acc.ID) === String(key));
                
                if (!accountExists) {
                    console.log(`Account with ID ${key} does not exist, attempting to add instead of update`);
                    // Force the ID to match what was requested
                    dataCopy.ID = key;
                    const addedAccount = await encryptedStorage.addAccount(dataCopy);
                    return addedAccount !== null;
                }

                const updated = await encryptedStorage.updateAccount(dataCopy, key);
                if (!updated) {
                    console.warn(`Failed to update account with ID: ${key}`);
                }
                return updated;
            } else if (tableName === 'accounts') {
                // If we're updating all accounts, ensure it's an array
                if (!Array.isArray(dataCopy)) {
                    console.warn('[updateData] Received an object instead of an array for accounts');
                    
                    // If it's a valid account object, convert it to an array
                    if (dataCopy && typeof dataCopy === 'object' && dataCopy.ID !== undefined && dataCopy.name) {
                        console.log('[updateData] Converting individual account to array for storage');
                        
                        // Ensure ID is a number for compatibility
                        dataCopy.ID = Number(dataCopy.ID);
                        
                        // Check if the account exists in the current data
                        const allAccounts = await encryptedStorage.getAllAccounts();
                        const accountExists = Array.isArray(allAccounts) && 
                            allAccounts.some(acc => Number(acc.ID) === Number(dataCopy.ID) || 
                                                  String(acc.ID) === String(dataCopy.ID));
                        
                        if (accountExists) {
                            // If the account exists, update it in the array
                            const updatedAccounts = allAccounts.map(acc => {
                                if (Number(acc.ID) === Number(dataCopy.ID) || 
                                    String(acc.ID) === String(dataCopy.ID)) {
                                    return dataCopy;
                                }
                                return acc;
                            });
                            dataCopy = updatedAccounts;
                            console.log(`Updated account ${dataCopy.ID} in accounts array`);
                        } else {
                            // If the account doesn't exist, add it to the array
                            dataCopy = Array.isArray(allAccounts) ? [...allAccounts, dataCopy] : [dataCopy];
                            console.log(`Added account ${dataCopy.ID} to accounts array`);
                        }
                    } else {
                        console.error('[updateData] Invalid data received to update accounts');
                        // Get current accounts as backup
                        const currentAccounts = await encryptedStorage.loadData('accounts') || [];
                        
                        if (Array.isArray(currentAccounts) && currentAccounts.length > 0) {
                            console.warn('[updateData] Using existing accounts instead of invalid data');
                            dataCopy = currentAccounts;
                        } else {
                            console.warn('[updateData] No existing accounts, using empty array');
                            dataCopy = [];
                        }
                    }
                } else {
                    // Ensure all IDs in the array are numbers
                    dataCopy.forEach(account => {
                        if (account && account.ID !== undefined) {
                            account.ID = Number(account.ID);
                        }
                    });
                }
                
                console.log(`[updateData] Saving array of ${Array.isArray(dataCopy) ? dataCopy.length : 0} accounts`);
                if (Array.isArray(dataCopy) && dataCopy.length > 0) {
                    console.log(`Saving accounts with IDs: ${dataCopy.map(acc => acc?.ID).join(', ')}`);
                }
                return await encryptedStorage.saveData(tableName, dataCopy);
            } else {
                // For configClient, save the entire object
                if (!dataCopy) {
                    throw new Error('Cannot update with null or undefined data');
                }
                return await encryptedStorage.saveData(tableName, dataCopy);
            }
        }).catch(error => {
            console.error(`Error updating encrypted data (${tableName}):`, error);
            throw error;
        });
    }

    // Delete data with compatibility with the original implementation
    async deleteData(tableName, key = 1) {
        return this.execute(async () => {
            // Ensure key is treated as a number for compatibility
            key = Number(key);
            
            // For accounts, delete a specific account
            if (tableName === 'accounts') {
                // CASO CRÍTICO: cuando tableName === 'accounts' y key === 1, podría ser:
                // 1) Una cuenta con ID 1 legítima que se desea eliminar
                // 2) Un intento de eliminar todas las cuentas (comportamiento por defecto de deleteData)
                
                // Verificamos si realmente existe una cuenta con ID 1 que estamos tratando de eliminar
                const allAccounts = await encryptedStorage.getAllAccounts();
                
                // Si key === 1 pero NO hay un parámetro key explícito en la llamada,
                // o si allAccounts es el objeto completo (no una cuenta específica),
                // entonces es un intento de eliminar todas las cuentas
                const accountWithId1Exists = Array.isArray(allAccounts) && 
                    allAccounts.some(acc => 
                        acc && (Number(acc.ID) === 1 || String(acc.ID) === '1')
                    );
                
                // Si key === 1 pero no existe una cuenta con ID 1, bloqueamos la operación
                if (key === 1 && !accountWithId1Exists) {
                    console.error('PROTECCIÓN CRÍTICA: Se intentó eliminar todas las cuentas. Operación bloqueada.');
                    return false;
                }
                
                console.log(`Attempting to delete account with ID: ${key}`);
                
                if (!Array.isArray(allAccounts) || allAccounts.length === 0) {
                    console.warn(`No accounts available to delete from`);
                    return true; // Nothing to delete
                }
                
                // Check if the account exists before deletion
                const accountToDelete = allAccounts.find(acc => 
                    acc && (Number(acc.ID) === key || String(acc.ID) === String(key))
                );
                
                if (!accountToDelete) {
                    console.warn(`Account with ID ${key} not found for deletion`);
                    return false;
                }
                
                console.log(`Found account for deletion: ${accountToDelete.name} with ID ${accountToDelete.ID}`);
                
                // Create a backup of all accounts before deletion
                try {
                    const accountsPath = await encryptedStorage.getSecurePath('accounts');
                    if (fs.existsSync(accountsPath)) {
                        await encryptedStorage.createSingleBackup(accountsPath, 'pre-delete-backup');
                    }
                } catch (error) {
                    console.error('Error creating backup before deletion:', error);
                    // Continue with deletion even if backup fails
                }
                
                // Use the dedicated deleteAccount method in encryptedStorage
                const deleted = await encryptedStorage.deleteAccount(key);
                
                if (!deleted) {
                    console.warn(`Failed to delete account with ID: ${key}`);
                }
                
                // Verify that the account was actually deleted
                const remainingAccounts = await encryptedStorage.getAllAccounts();
                const stillExists = Array.isArray(remainingAccounts) && 
                    remainingAccounts.some(acc => Number(acc.ID) === key || String(acc.ID) === String(key));
                
                if (stillExists) {
                    console.error(`Account with ID ${key} still exists after deletion attempt!`);
                    return false;
                }
                
                // Verificar que todavía quedan cuentas y mostrar mensaje informativo
                if (remainingAccounts.length === 0) {
                    console.warn('La última cuenta fue eliminada. El archivo de cuentas está ahora vacío.');
                }
                
                console.log(`Successfully deleted account with ID: ${key}, remaining accounts: ${remainingAccounts.length}`);
                return deleted;
            } else {
                // Para configClient u otros archivos, eliminar el archivo completo
                return await encryptedStorage.deleteData(tableName);
            }
        }).catch(error => {
            console.error(`Error deleting encrypted data (${tableName}):`, error);
            throw new Error(`Could not delete data in ${tableName}: ${error.message}`);
        });
    }
    
    // Clear the entire database
    async clearDatabase() {
        return this.execute(async () => {
            // Delete encrypted files
            try {
                await encryptedStorage.deleteData('configClient');
                await encryptedStorage.deleteData('accounts');
                console.log('Encrypted files deleted successfully');
                return true;
            } catch (error) {
                console.error('Error deleting encrypted files:', error);
                throw error;
            }
        });
    }

    /**
     * Run storage consolidation of scattered storage files
     * @returns {Promise<boolean>} - true if consolidation was successful
     */
    async consolidateStorage() {
        try {
            console.log('Starting storage consolidation from database.js');
            return await encryptedStorage.consolidateStorage();
        } catch (error) {
            console.error('Error consolidating storage:', error);
            return false;
        }
    }
    
    /**
     * Verify if an account exists by its credentials (username and type)
     * @param {string} username - Username to check
     * @param {string} accountType - Account type (microsoft, mojang, azauth, etc.)
     * @returns {Promise<Object|null>} - Account data if found, null otherwise
     */
    async accountExists(username, accountType) {
        try {
            if (!username || !accountType) {
                return null;
            }
            
            const accounts = await this.readAllData('accounts');
            if (!Array.isArray(accounts) || accounts.length === 0) {
                return null;
            }
            
            // Find account with matching name and type
            const account = accounts.find(acc => 
                acc && 
                acc.name === username &&
                acc.meta && 
                acc.meta.type === accountType
            );
            
            return account || null;
        } catch (error) {
            console.error('Error checking if account exists:', error);
            return null;
        }
    }
    
    /**
     * Get the currently selected account
     * @returns {Promise<Object|null>} - Selected account data or null if none is selected
     */
    async getSelectedAccount() {
        try {
            // Read config to get selected account ID
            const config = await this.readData('configClient');
            if (!config || !config.account_selected) {
                console.log('No account is currently selected in config');
                return null;
            }
            
            const selectedId = config.account_selected;
            console.log(`Looking for selected account with ID: ${selectedId}`);
            
            // Get all accounts to find the selected one
            const accounts = await encryptedStorage.getAllAccounts();
            
            if (!Array.isArray(accounts) || accounts.length === 0) {
                console.warn('No accounts available to select from');
                return null;
            }
            
            // Try to find the account by ID using both number and string comparison
            const account = accounts.find(acc => 
                acc && (Number(acc.ID) === Number(selectedId) || String(acc.ID) === String(selectedId))
            );
            
            // If account not found, log and return null
            if (!account) {
                console.warn(`Selected account with ID ${selectedId} not found`);
                console.log(`Available accounts: ${accounts.map(a => `${a?.name}(${a?.ID})`).join(', ')}`);
                return null;
            }
            
            console.log(`Found selected account: ${account.name} with ID: ${account.ID}`);
            
            // Return a deep copy to avoid reference issues
            const accountCopy = JSON.parse(JSON.stringify(account));
            
            // Ensure ID is a number for compatibility
            if (accountCopy && accountCopy.ID !== undefined) {
                accountCopy.ID = Number(accountCopy.ID);
            }
            
            return accountCopy;
        } catch (error) {
            console.error('Error getting selected account:', error);
            return null;
        }
    }
    
    /**
     * Sync account IDs to ensure consistency across operations
     * @returns {Promise<boolean>} - true if successful
     */
    async syncAccountIds() {
        try {
            const accounts = await encryptedStorage.getAllAccounts();
            
            if (!Array.isArray(accounts) || accounts.length === 0) {
                return true; // Nothing to sync
            }
            
            console.log(`Syncing ${accounts.length} accounts`);
            
            // Check for duplicate IDs or invalid IDs
            const seenIds = new Set();
            let needsFix = false;
            
            const fixedAccounts = accounts.map((acc, index) => {
                if (!acc) {
                    console.warn(`Found null/undefined account at index ${index}, skipping`);
                    needsFix = true;
                    return null; // This will be filtered out later
                }
                
                if (acc.ID === undefined) {
                    // Account is missing ID, assign a new one
                    console.warn(`Account ${acc.name || 'unknown'} is missing ID, assigning new one`);
                    needsFix = true;
                    const newId = index + 1;
                    return { ...acc, ID: newId };
                }
                
                const id = Number(acc.ID);
                if (isNaN(id)) {
                    // ID is not a number, assign a new one
                    console.warn(`Account ${acc.name || 'unknown'} has invalid ID (${acc.ID}), assigning new one`);
                    needsFix = true;
                    const newId = index + 1;
                    return { ...acc, ID: newId };
                }
                
                if (seenIds.has(id)) {
                    // Duplicate ID found, assign a new one
                    needsFix = true;
                    const newId = Math.max(...Array.from(seenIds)) + 1;
                    console.warn(`Found duplicate ID ${id} for account ${acc.name}, reassigning to ${newId}`);
                    seenIds.add(newId);
                    return { ...acc, ID: newId };
                }
                
                seenIds.add(id);
                return { ...acc, ID: id };
            }).filter(acc => acc !== null); // Remove any null accounts
            
            if (needsFix) {
                console.log('Account IDs needed fixing, saving corrected accounts');
                console.log(`Saving accounts with IDs: ${fixedAccounts.map(acc => acc?.ID).join(', ')}`);
                await encryptedStorage.saveData('accounts', fixedAccounts);
                
                // Verify that the fix was applied
                const verifiedAccounts = await encryptedStorage.getAllAccounts();
                console.log(`Verified accounts after fix: ${verifiedAccounts.map(acc => acc?.ID).join(', ')}`);
            }
            
            return true;
        } catch (error) {
            console.error('Error syncing account IDs:', error);
            return false;
        }
    }
    
    /**
     * Set an account as selected
     * @param {string|number} accountId - ID of the account to select
     * @returns {Promise<boolean>} - true if successful
     */
    async setSelectedAccount(accountId) {
        try {
            if (!accountId) {
                throw new Error('Account ID is required');
            }
            
            // Ensure accountId is a number
            accountId = Number(accountId);
            
            // Check if account exists
            const account = await this.readData('accounts', accountId);
            if (!account) {
                console.warn(`Cannot select non-existent account with ID: ${accountId}`);
                return false;
            }
            
            // Get current config
            let config = await this.readData('configClient');
            if (!config || typeof config !== 'object') {
                console.warn('configClient no existe, no se puede seleccionar la cuenta');
                return false;
            }
            
            // Update selected account
            config.account_selected = accountId;
            
            // Save updated config
            return await this.updateData('configClient', config);
        } catch (error) {
            console.error('Error setting selected account:', error);
            return false;
        }
    }
}

export default database;