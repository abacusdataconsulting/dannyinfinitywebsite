#!/usr/bin/env node
/**
 * Create an admin user with PBKDF2-hashed password.
 *
 * Usage:
 *   node scripts/create-admin.js <name> <password>
 *
 * This outputs the SQL INSERT statement. Pipe it to wrangler d1 execute:
 *   node scripts/create-admin.js admin MySecurePass123 | wrangler d1 execute abacus-db --local --command="$(cat)"
 *
 * Or copy the SQL and run it manually.
 */

async function main() {
    const [name, password] = process.argv.slice(2);

    if (!name || !password) {
        console.error('Usage: node scripts/create-admin.js <name> <password>');
        console.error('Example: node scripts/create-admin.js admin MySecurePass123');
        process.exit(1);
    }

    if (password.length < 8) {
        console.error('Error: Password must be at least 8 characters');
        process.exit(1);
    }

    // Generate 16-byte salt
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const saltHex = Array.from(salt, b => b.toString(16).padStart(2, '0')).join('');

    // Derive key with PBKDF2
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']
    );
    const hashBuffer = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt: salt, iterations: 100000, hash: 'SHA-256' },
        keyMaterial, 256
    );
    const hashHex = Array.from(new Uint8Array(hashBuffer), b => b.toString(16).padStart(2, '0')).join('');

    const sql = `INSERT OR REPLACE INTO users (name, password_hash, password_salt, password_version, is_admin) VALUES ('${name}', '${hashHex}', '${saltHex}', 2, 1);`;

    console.log('\n--- Admin User SQL ---');
    console.log(sql);
    console.log('\nRun locally:');
    console.log(`  wrangler d1 execute abacus-db --local --command="${sql}"`);
    console.log('\nRun in production:');
    console.log(`  wrangler d1 execute abacus-db --command="${sql}"`);
    console.log('');
}

main().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});
