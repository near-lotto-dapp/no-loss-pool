const encoder = new TextEncoder();
const decoder = new TextDecoder();

async function getCryptoKey(secret: string) {
    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        encoder.encode(secret),
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
    );
    return crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: encoder.encode("jomo-static-salt"), // Можна змінити на свій
            iterations: 100000,
            hash: "SHA-256",
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
    );
}

export async function encrypt(text: string, secret: string) {
    const key = await getCryptoKey(secret);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        encoder.encode(text)
    );

    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);
    return btoa(String.fromCharCode(...combined));
}

export async function decrypt(encoded: string, secret: string) {
    const key = await getCryptoKey(secret);
    const combined = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);

    const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        key,
        data
    );
    return decoder.decode(decrypted);
}