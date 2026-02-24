/**
 * Cryptographic utilities — PBKDF2 password hashing with transparent legacy SHA-256 support
 */

function bufferToHex(buffer) {
    return Array.from(new Uint8Array(buffer), b => b.toString(16).padStart(2, '0')).join('');
}

function hexToBuffer(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
}

// PBKDF2 with 100,000 iterations and 16-byte salt
export async function hashPasswordPBKDF2(password, salt) {
    if (!salt) {
        salt = crypto.getRandomValues(new Uint8Array(16));
    } else if (typeof salt === 'string') {
        salt = hexToBuffer(salt);
    }

    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']
    );
    const hashBuffer = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt: salt, iterations: 100000, hash: 'SHA-256' },
        keyMaterial, 256
    );

    return {
        hash: bufferToHex(hashBuffer),
        salt: bufferToHex(salt),
    };
}

// Legacy SHA-256 (for verifying old passwords before migration)
export async function hashPasswordSHA256(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return bufferToHex(hashBuffer);
}

// Verify a password against stored hash, handling both versions
export async function verifyPassword(password, storedHash, storedSalt, passwordVersion) {
    if (passwordVersion === 2) {
        // PBKDF2
        const result = await hashPasswordPBKDF2(password, storedSalt);
        return result.hash === storedHash;
    }
    // Legacy SHA-256 (version 1 or missing)
    const legacyHash = await hashPasswordSHA256(password);
    return legacyHash === storedHash;
}

// Generate a secure session token
export function generateToken() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return bufferToHex(array);
}
