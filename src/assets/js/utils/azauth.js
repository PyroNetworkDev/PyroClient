/**
 * @author MiguelkiNetwork
 * @license CC-BY-NC 4.0 - https://creativecommons.org/licenses/by-nc/4.0
 * 
 * AZauth authentication module using azuriom-auth
 */

const { AzuriomAuth } = require('azuriom-auth');

class AZauth {
    constructor(apiUrl) {
        if (!apiUrl) {
            throw new Error('API URL is required for AZauth');
        }
        
        // Ensure URL ends with proper format for azuriom-auth
        this.apiUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
        this.auth = new AzuriomAuth(this.apiUrl);
        
        console.log(`AZauth initialized with URL: ${this.apiUrl}`);
    }

    /**
     * Login with email and password
     * @param {string} email - User email
     * @param {string} password - User password
     * @returns {Promise<Object>} User data
     */
    async login(email, password) {
        try {
            console.log('Attempting AZauth login...');
            
            const response = await this.auth.login(email, password);
            
            if (!response.success) {
                throw new Error(response.message || 'Login failed');
            }

            // Transform response to match expected format
            const userData = {
                access_token: response.access_token,
                refresh_token: response.refresh_token,
                user: {
                    id: response.user.id,
                    name: response.user.name,
                    email: response.user.email,
                    uuid: response.user.game_id,
                    created_at: response.user.created_at,
                    updated_at: response.user.updated_at
                },
                meta: {
                    type: 'azauth',
                    demo: false
                }
            };

            console.log(`AZauth login successful for user: ${userData.user.name}`);
            return userData;
            
        } catch (error) {
            console.error('AZauth login error:', error);
            
            // Handle specific error cases
            if (error.message && error.message.includes('2FA')) {
                error.requiresTwoFactor = true;
            }
            
            throw error;
        }
    }

    /**
     * Login with 2FA code
     * @param {string} email - User email  
     * @param {string} password - User password
     * @param {string} code - 2FA code
     * @returns {Promise<Object>} User data
     */
    async loginWith2FA(email, password, code) {
        try {
            console.log('Attempting AZauth login with 2FA...');
            
            const response = await this.auth.loginWith2FA(email, password, code);
            
            if (!response.success) {
                throw new Error(response.message || 'Login with 2FA failed');
            }

            // Transform response to match expected format
            const userData = {
                access_token: response.access_token,
                refresh_token: response.refresh_token,
                user: {
                    id: response.user.id,
                    name: response.user.name,
                    email: response.user.email,
                    uuid: response.user.game_id,
                    created_at: response.user.created_at,
                    updated_at: response.user.updated_at
                },
                meta: {
                    type: 'azauth',
                    demo: false
                }
            };

            console.log(`AZauth 2FA login successful for user: ${userData.user.name}`);
            return userData;
            
        } catch (error) {
            console.error('AZauth 2FA login error:', error);
            throw error;
        }
    }

    /**
     * Verify access token
     * @param {string} accessToken - Access token to verify
     * @returns {Promise<Object>} User data if valid
     */
    async verify(accessToken) {
        try {
            console.log('Verifying AZauth access token...');
            
            const response = await this.auth.verify(accessToken);
            
            if (!response.success) {
                throw new Error(response.message || 'Token verification failed');
            }

            // Transform response to match expected format
            const userData = {
                user: {
                    id: response.user.id,
                    name: response.user.name,
                    email: response.user.email,
                    uuid: response.user.game_id,
                    created_at: response.user.created_at,
                    updated_at: response.user.updated_at
                },
                meta: {
                    type: 'azauth',
                    demo: false
                }
            };

            console.log(`AZauth token verification successful for user: ${userData.user.name}`);
            return userData;
            
        } catch (error) {
            console.error('AZauth token verification error:', error);
            throw error;
        }
    }

    /**
     * Refresh access token
     * @param {string} refreshToken - Refresh token
     * @returns {Promise<Object>} New tokens
     */
    async refresh(refreshToken) {
        try {
            console.log('Refreshing AZauth access token...');
            
            const response = await this.auth.refresh(refreshToken);
            
            if (!response.success) {
                throw new Error(response.message || 'Token refresh failed');
            }

            const tokenData = {
                access_token: response.access_token,
                refresh_token: response.refresh_token
            };

            console.log('AZauth token refresh successful');
            return tokenData;
            
        } catch (error) {
            console.error('AZauth token refresh error:', error);
            throw error;
        }
    }

    /**
     * Logout user
     * @param {string} accessToken - Access token
     * @returns {Promise<boolean>} Success status
     */
    async logout(accessToken) {
        try {
            console.log('Logging out AZauth user...');
            
            const response = await this.auth.logout(accessToken);
            
            console.log('AZauth logout successful');
            return response.success || true;
            
        } catch (error) {
            console.error('AZauth logout error:', error);
            // Don't throw error for logout, just log it
            return false;
        }
    }
}

export default AZauth;
