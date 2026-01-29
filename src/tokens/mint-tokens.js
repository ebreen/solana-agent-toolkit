import { Connection, clusterApiUrl, PublicKey, Keypair } from '@solana/web3.js';
import { getOrCreateAssociatedTokenAccount, mintTo } from '@solana/spl-token';
import fs from 'fs';

const wallet = JSON.parse(fs.readFileSync('wallet.json', 'utf8'));
const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
const secretKey = new Uint8Array(wallet.secretKey);
const keypair = Keypair.fromSecretKey(secretKey);

// Get mint from command line or saved file
let mintAddress = process.argv[2];
if (!mintAddress) {
  try {
    const mintData = JSON.parse(fs.readFileSync('token-mint.json', 'utf8'));
    mintAddress = mintData.mint;
    console.log('Using saved mint from token-mint.json');
  } catch {
    console.log('Usage: node mint-tokens.js <mint-address> <amount>');
    console.log('Or create a mint first with create-token-mint.js');
    process.exit(1);
  }
}

const amount = parseFloat(process.argv[3] || '1000');

console.log('💰 Minting Tokens');
console.log('=================');
console.log('Mint:', mintAddress);
console.log('Amount:', amount);
console.log('');

try {
  const mint = new PublicKey(mintAddress);
  
  // Get or create token account
  const tokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    keypair,
    mint,
    keypair.publicKey
  );

  console.log('Token Account:', tokenAccount.address.toBase58());
  
  // Mint tokens
  await mintTo(
    connection,
    keypair,
    mint,
    tokenAccount.address,
    keypair.publicKey,
    amount * 10**9 // Convert to smallest unit
  );

  console.log('✅ Minted', amount, 'tokens!');
  
  // Check balance
  const balance = await connection.getTokenAccountBalance(tokenAccount.address);
  console.log('Current balance:', balance.value.uiAmount);
  
} catch (err) {
  console.log('❌ Failed to mint:', err.message);
}
