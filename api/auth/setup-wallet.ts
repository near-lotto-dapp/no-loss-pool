import { createClient } from '@supabase/supabase-js';
import { KeyPair } from 'near-api-js';

const supabaseUrl = process.env.VITE_NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { user_id, email } = req.body;

        if (!user_id || !email) {
            return res.status(400).json({ error: 'Missing user_id or email' });
        }

        const keyPair = KeyPair.fromRandom('ed25519');
        const publicKey = keyPair.getPublicKey().toString();
        const privateKey = keyPair.toString(); // Це секретний ключ, який дає повний доступ до грошей

        const publicKeyBytes = keyPair.getPublicKey().data;
        const implicitAccountId = Buffer.from(publicKeyBytes).toString('hex');

        const { error } = await supabase
            .from('profiles')
            .insert([
                {
                    id: user_id,
                    email: email,
                    near_account_id: implicitAccountId,
                    public_key: publicKey,
                    encrypted_private_key: privateKey // MVP !!!
                }
            ])
            .select()
            .single();

        if (error) throw error;

        return res.status(200).json({
            success: true,
            wallet: {
                accountId: implicitAccountId,
                publicKey: publicKey
            }
        });

    } catch (error: any) {
        console.error("Wallet generation error:", error);
        return res.status(500).json({ error: error.message || "Failed to generate wallet" });
    }
}