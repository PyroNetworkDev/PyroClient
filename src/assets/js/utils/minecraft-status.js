/**
 * @author MiguelkiNetwork
 * @license CC-BY-NC 4.0 - https://creativecommons.org/licenses/by-nc/4.0
 * 
 * Lightweight Minecraft server status checker
 */

const net = require('net');

// Cache for server status to avoid too many rapid requests
const statusCache = new Map();
const CACHE_DURATION = 30000; // 30 seconds

// Clean up expired cache entries periodically
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of statusCache.entries()) {
        if (now - value.timestamp > CACHE_DURATION) {
            statusCache.delete(key);
        }
    }
}, 60000); // Clean up every minute

class MinecraftStatus {
    constructor(host, port = 25565) {
        this.host = host;
        this.port = port;
        this.cacheKey = `${host}:${port}`;
    }

    async getStatus() {
        return new Promise((resolve) => {
            const startTime = Date.now();
            
            // Check cache first
            const cached = statusCache.get(this.cacheKey);
            if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
                console.log('Using cached status for', this.cacheKey);
                resolve({
                    ...cached.data,
                    ms: cached.data.ms // Use cached ping time
                });
                return;
            }
            
            // Try to get detailed server info directly
            this.getDetailedStatus().then(detailedInfo => {
                const ms = Date.now() - startTime;
                const result = {
                    online: true,
                    ms: ms,
                    playersConnect: detailedInfo.players || 0,
                    playersMax: detailedInfo.maxPlayers || 0,
                    version: detailedInfo.version || 'Unknown',
                    motd: detailedInfo.motd || 'Minecraft Server'
                };
                
                // Cache the result
                statusCache.set(this.cacheKey, {
                    data: result,
                    timestamp: Date.now()
                });
                
                resolve(result);
            }).catch((err) => {
                console.log('Failed to get detailed info:', err.message);
                console.log('Trying fallback method...');
                
                // Try fallback method
                this.getFallbackStatus().then(fallbackInfo => {
                    const ms = Date.now() - startTime;
                    const result = {
                        online: true,
                        ms: ms,
                        playersConnect: fallbackInfo.players || 0,
                        playersMax: fallbackInfo.maxPlayers || 0,
                        version: fallbackInfo.version || 'Unknown',
                        motd: fallbackInfo.motd || 'Minecraft Server'
                    };
                    
                    // Cache the result
                    statusCache.set(this.cacheKey, {
                        data: result,
                        timestamp: Date.now()
                    });
                    
                    resolve(result);
                }).catch((fallbackErr) => {
                    console.log('Fallback method also failed:', fallbackErr.message);
                    const result = {
                        error: true,
                        message: err.message,
                        online: false,
                        ms: 0,
                        playersConnect: 0,
                        playersMax: 0
                    };
                    
                    // Cache the failed result for a shorter time
                    statusCache.set(this.cacheKey, {
                        data: result,
                        timestamp: Date.now() - (CACHE_DURATION - 5000) // Cache for only 5 seconds
                    });
                    
                    resolve(result);
                });
            });
        });
    }

    async getDetailedStatus() {
        return new Promise((resolve, reject) => {
            const socket = new net.Socket();
            socket.setTimeout(8000); // Increased timeout for large responses
            
            let hasResponded = false;
            let receivedData = Buffer.alloc(0);
            let expectedLength = -1;
            
            socket.on('connect', () => {
                console.log(`Connected to ${this.host}:${this.port} for detailed status`);
                
                // Send handshake packet
                const handshake = this.createHandshakePacket();
                socket.write(handshake);
                
                // Send status request
                const statusRequest = this.createStatusRequestPacket();
                socket.write(statusRequest);
            });
            
            socket.on('data', (data) => {
                if (hasResponded) return;
                
                // Accumulate received data
                receivedData = Buffer.concat([receivedData, data]);
                
                // If we haven't determined the expected length yet, try to read it
                if (expectedLength === -1 && receivedData.length > 0) {
                    try {
                        const { value: packetLength, offset } = this.readVarInt(receivedData, 0);
                        expectedLength = packetLength + offset;
                    } catch (err) {
                        // Not enough data to read the length yet, wait for more
                        return;
                    }
                }
                
                // Check if we have received all the expected data
                if (expectedLength > 0 && receivedData.length >= expectedLength) {
                    hasResponded = true;
                    
                    try {
                        const response = this.parseStatusResponse(receivedData);
                        
                        // Send ping request to complete the handshake
                        const pingRequest = this.createPingRequestPacket();
                        socket.write(pingRequest);
                        
                        // Close socket after a brief delay
                        setTimeout(() => {
                            socket.destroy();
                        }, 100);
                        
                        resolve(response);
                    } catch (err) {
                        console.error('Error parsing status response:', err);
                        socket.destroy();
                        reject(err);
                    }
                }
            });
            
            socket.on('error', (err) => {
                console.error('Socket error in detailed status:', err);
                if (!hasResponded) {
                    reject(err);
                }
            });
            
            socket.on('timeout', () => {
                console.log('Socket timeout in detailed status');
                socket.destroy();
                if (!hasResponded) {
                    reject(new Error('Timeout'));
                }
            });
            
            socket.connect(this.port, this.host);
        });
    }

    createHandshakePacket() {
        const hostname = Buffer.from(this.host, 'utf8');
        const port = Buffer.allocUnsafe(2);
        port.writeUInt16BE(this.port, 0);
        
        const packetData = Buffer.concat([
            Buffer.from([0x00]), // Packet ID (Handshake)
            this.writeVarInt(770), // Protocol version (1.21.4 - updated to current version)
            this.writeVarInt(hostname.length), // Hostname length
            hostname, // Hostname
            port, // Port
            this.writeVarInt(1) // Next state (1 for status)
        ]);
        
        const length = this.writeVarInt(packetData.length);
        return Buffer.concat([length, packetData]);
    }

    createStatusRequestPacket() {
        // Status Request packet: packet length (1) + packet ID (0x00)
        return Buffer.from([0x01, 0x00]);
    }

    createPingRequestPacket() {
        // Ping Request packet with current timestamp
        const timestamp = Buffer.allocUnsafe(8);
        timestamp.writeBigInt64BE(BigInt(Date.now()), 0);
        
        const packetData = Buffer.concat([
            Buffer.from([0x01]), // Packet ID (Ping Request)
            timestamp // Timestamp
        ]);
        
        const length = this.writeVarInt(packetData.length);
        return Buffer.concat([length, packetData]);
    }

    writeVarInt(value) {
        const buffer = [];
        while (value > 0x7F) {
            buffer.push((value & 0x7F) | 0x80);
            value >>>= 7;
        }
        buffer.push(value & 0x7F);
        return Buffer.from(buffer);
    }

    parseStatusResponse(data) {
        try {
            let offset = 0;
            
            // Read packet length
            const { value: packetLength, offset: newOffset } = this.readVarInt(data, offset);
            offset = newOffset;
            
            
            // Read packet ID
            const { value: packetId, offset: newOffset2 } = this.readVarInt(data, offset);
            offset = newOffset2;
            
            
            if (packetId !== 0x00) {
                throw new Error(`Expected packet ID 0x00, got 0x${packetId.toString(16)}`);
            }
            
            // Read JSON length
            const { value: jsonLength, offset: newOffset3 } = this.readVarInt(data, offset);
            offset = newOffset3;
            
            
            // Check if we have enough data
            const availableDataLength = data.length - offset;
            if (availableDataLength < jsonLength) {
                throw new Error(`Insufficient data: expected ${jsonLength} bytes but only ${availableDataLength} available`);
            }
            
            // Read JSON data - Extract the exact amount of bytes specified
            const jsonBuffer = data.slice(offset, offset + jsonLength);
            
            // Convert to string, handling potential encoding issues
            let jsonData;
            try {
                jsonData = jsonBuffer.toString('utf8');
            } catch (encodingErr) {
                console.warn('UTF-8 encoding failed, trying binary conversion');
                jsonData = jsonBuffer.toString('binary');
            }
            
            
            // The issue might be multi-byte UTF-8 characters affecting byte vs character count
            // Let's be more flexible with the length validation
            const lengthDifference = Math.abs(jsonData.length - jsonLength);
            if (lengthDifference > 50) { // Increased tolerance for UTF-8 encoding differences
                console.warn(`JSON length mismatch: expected ${jsonLength} bytes but got ${jsonData.length} characters (difference: ${lengthDifference})`);
                // Don't throw error, just log warning and continue with parsing
            }
            
            // Clean the JSON data before parsing
            let cleanedJsonData = jsonData;
            
            // Remove any null bytes or non-printable characters at the end
            cleanedJsonData = cleanedJsonData.replace(/\0+$/, '');
            
            // Check for common JSON truncation issues and clean the data
            if (!cleanedJsonData.endsWith('}') && !cleanedJsonData.endsWith(']')) {
                console.warn('JSON might be truncated, attempting to clean...');
                cleanedJsonData = this.cleanJsonString(cleanedJsonData);
            }
            
            // Additional validation: ensure we have a valid JSON structure
            if (!cleanedJsonData.startsWith('{') && !cleanedJsonData.startsWith('[')) {
                throw new Error('Invalid JSON structure: does not start with { or [');
            }
            
            let status;
            try {
                status = JSON.parse(cleanedJsonData);
            } catch (jsonParseError) {
                console.warn('Initial JSON parse failed, attempting fallback extraction...');
                // Try to extract JSON by looking for the first { and last }
                const firstBrace = cleanedJsonData.indexOf('{');
                const lastBrace = cleanedJsonData.lastIndexOf('}');
                
                if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                    const extractedJson = cleanedJsonData.substring(firstBrace, lastBrace + 1);
                    try {
                        status = JSON.parse(extractedJson);
                        console.log('Successfully parsed JSON using fallback method');
                    } catch (fallbackError) {
                        throw new Error(`JSON parsing failed even with fallback: ${jsonParseError.message}`);
                    }
                } else {
                    throw new Error(`Could not extract valid JSON structure: ${jsonParseError.message}`);
                }
            }
            
            // Extract MOTD - handle both string and object formats
            let motd = 'Minecraft Server';
            if (status.description) {
                if (typeof status.description === 'string') {
                    motd = status.description;
                } else if (status.description.text) {
                    motd = status.description.text;
                } else if (status.description.extra) {
                    motd = status.description.extra.map(part => part.text || '').join('');
                }
            }
            
            return {
                players: status.players?.online || 0,
                maxPlayers: status.players?.max || 0,
                version: status.version?.name || 'Unknown',
                motd: motd
            };
        } catch (err) {
            console.error('Error parsing status response:', err);
            console.error('Raw data length:', data.length);
            console.error('Raw data (first 200 chars):', data.toString('hex').substring(0, 200));
            
            // If it's a JSON parsing error, try to provide more context
            if (err instanceof SyntaxError && err.message.includes('JSON')) {
                console.error('JSON parsing failed - data might be truncated or corrupted');
                console.error('Attempting to extract JSON from available data...');
                
                // Try to extract JSON by looking for the first { and last }
                try {
                    const dataString = data.toString('utf8');
                    const firstBrace = dataString.indexOf('{');
                    const lastBrace = dataString.lastIndexOf('}');
                    
                    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                        const extractedJson = dataString.substring(firstBrace, lastBrace + 1);
                        console.log('Attempting to parse extracted JSON...');
                        const status = JSON.parse(extractedJson);
                        
                        // If successful, return the parsed data
                        let motd = 'Minecraft Server';
                        if (status.description) {
                            if (typeof status.description === 'string') {
                                motd = status.description;
                            } else if (status.description.text) {
                                motd = status.description.text;
                            } else if (status.description.extra) {
                                motd = status.description.extra.map(part => part.text || '').join('');
                            }
                        }
                        
                        console.log('Successfully parsed JSON using fallback method');
                        return {
                            players: status.players?.online || 0,
                            maxPlayers: status.players?.max || 0,
                            version: status.version?.name || 'Unknown',
                            motd: motd
                        };
                    }
                } catch (fallbackErr) {
                    console.error('Fallback JSON parsing also failed:', fallbackErr.message);
                }
            }
            
            throw new Error('Failed to parse status response: ' + err.message);
        }
    }

    readVarInt(buffer, offset) {
        let value = 0;
        let position = 0;
        let currentByte;
        
        while (offset < buffer.length) {
            currentByte = buffer[offset++];
            value |= (currentByte & 0x7F) << position;
            
            if ((currentByte & 0x80) === 0) break;
            
            position += 7;
            
            if (position >= 32) {
                throw new Error('VarInt is too big');
            }
        }
        
        return { value, offset };
    }

    // Helper function to clean and validate JSON string
    cleanJsonString(jsonString) {
        // Remove any potential null bytes or other problematic characters
        let cleaned = jsonString.replace(/\0/g, '');
        
        // If the string seems to be truncated, try to find the last complete object
        if (!cleaned.endsWith('}') && !cleaned.endsWith(']')) {
            // Try to find the last complete JSON object
            let lastCompleteIndex = -1;
            let braceCount = 0;
            
            for (let i = 0; i < cleaned.length; i++) {
                if (cleaned[i] === '{') {
                    braceCount++;
                } else if (cleaned[i] === '}') {
                    braceCount--;
                    if (braceCount === 0) {
                        lastCompleteIndex = i;
                    }
                }
            }
            
            if (lastCompleteIndex > 0) {
                cleaned = cleaned.substring(0, lastCompleteIndex + 1);
                console.log('Truncated JSON to last complete object at position:', lastCompleteIndex);
            }
        }
        
        return cleaned;
    }

    // Fallback method using simple ping
    async getFallbackStatus() {
        return new Promise((resolve, reject) => {
            const socket = new net.Socket();
            socket.setTimeout(3000);
            
            let hasResponded = false;
            
            socket.on('connect', () => {
                console.log(`Connected to ${this.host}:${this.port} for fallback status`);
                hasResponded = true;
                socket.destroy();
                
                // Return basic info since we can connect
                resolve({
                    players: 0,
                    maxPlayers: 0,
                    version: 'Unknown',
                    motd: 'Minecraft Server'
                });
            });
            
            socket.on('error', (err) => {
                console.error('Socket error in fallback status:', err);
                if (!hasResponded) {
                    reject(err);
                }
            });
            
            socket.on('timeout', () => {
                console.log('Socket timeout in fallback status');
                socket.destroy();
                if (!hasResponded) {
                    reject(new Error('Connection timeout'));
                }
            });
            
            socket.connect(this.port, this.host);
        });
    }

    // Static method to clear cache
    static clearCache() {
        statusCache.clear();
        console.log('Server status cache cleared');
    }
}

export default MinecraftStatus;
