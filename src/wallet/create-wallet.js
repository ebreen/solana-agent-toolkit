import { Keypair, Connection, clusterApiUrl, LAMPORTS_PER_SOL } from '@solana/web3.js';
import fs from 'fs';
import path from 'path';

// Generate a new wallet
const keypair = Keypair.generate();

console.log('🔑 New Solana Wallet Generated');
console.log('================================');
console.log('Public Key:', keypair.publicKey.toBase58());
console.log('Private Key (save this!):', JSON.stringify(Array.from(keypair.secretKey)));
console.log('');
console.log('💾 Saving to wallet.json...');

// Save to file
const walletData = {
  publicKey: keypair.publicKey.toBase58(),
  secretKey: Array.from(keypair.secretKey),
  createdAt: new Date().toISOString()
};

fs.writeFileSync('wallet.json', JSON.stringify(walletData, null, 2));
console.log('✅ Wallet saved to wallet.json');
console.log('');
console.log('⚠️  IMPORTANT: Back up wallet.json securely!');
console.log('   This is your only way to access your funds.');
