import { Connection, clusterApiUrl, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import fs from 'fs';

const wallet = JSON.parse(fs.readFileSync('wallet.json', 'utf8'));
const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
const publicKey = new PublicKey(wallet.publicKey);

console.log('💰 Checking Balance');
console.log('===================');
console.log('Address:', wallet.publicKey);
console.log('Network: Devnet');
console.log('');

const balance = await connection.getBalance(publicKey);
console.log(`Balance: ${balance / LAMPORTS_PER_SOL} SOL`);

if (balance === 0) {
  console.log('');
  console.log('🚰 Requesting airdrop...');
  try {
    const signature = await connection.requestAirdrop(publicKey, 2 * LAMPORTS_PER_SOL);
    await connection.confirmTransaction(signature);
    const newBalance = await connection.getBalance(publicKey);
    console.log(`✅ Airdrop complete! New balance: ${newBalance / LAMPORTS_PER_SOL} SOL`);
  } catch (err) {
    console.log('❌ Airdrop failed:', err.message);
  }
}
