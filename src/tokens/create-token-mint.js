import { Connection, clusterApiUrl, PublicKey, Keypair } from '@solana/web3.js';
import { createMint, getOrCreateAssociatedTokenAccount, mintTo, transfer } from '@solana/spl-token';
import fs from 'fs';

const wallet = JSON.parse(fs.readFileSync('wallet.json', 'utf8'));
const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
const secretKey = new Uint8Array(wallet.secretKey);
const keypair = Keypair.fromSecretKey(secretKey);

console.log('🪙 Creating SPL Token Mint');
console.log('==========================');
console.log('Authority:', wallet.publicKey);
console.log('');

try {
  // Create mint
  const mint = await createMint(
    connection,
    keypair,
    keypair.publicKey,
    keypair.publicKey,
    9 // 9 decimals
  );

  console.log('✅ Token mint created!');
  console.log('Mint Address:', mint.toBase58());
  console.log('');
  console.log('💾 Save this mint address for future use!');
  
  // Save mint info
  const mintData = {
    mint: mint.toBase58(),
    authority: wallet.publicKey,
    decimals: 9,
    createdAt: new Date().toISOString()
  };
  
  fs.writeFileSync('token-mint.json', JSON.stringify(mintData, null, 2));
  console.log('✅ Mint info saved to token-mint.json');
  
} catch (err) {
  console.log('❌ Failed to create mint:', err.message);
}
