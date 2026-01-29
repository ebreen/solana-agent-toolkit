import { Connection, clusterApiUrl, PublicKey, Keypair } from '@solana/web3.js';
import { getOrCreateAssociatedTokenAccount, transfer } from '@solana/spl-token';
import fs from 'fs';

const wallet = JSON.parse(fs.readFileSync('wallet.json', 'utf8'));
const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
const secretKey = new Uint8Array(wallet.secretKey);
const keypair = Keypair.fromSecretKey(secretKey);

// Get parameters
const recipientAddress = process.argv[2];
const mintAddress = process.argv[3];
const amount = parseFloat(process.argv[4]);

if (!recipientAddress || !mintAddress || !amount) {
  console.log('Usage: node transfer-tokens.js <recipient-address> <mint-address> <amount>');
  process.exit(1);
}

console.log('💸 Transferring Tokens');
console.log('======================');
console.log('From:', wallet.publicKey);
console.log('To:', recipientAddress);
console.log('Mint:', mintAddress);
console.log('Amount:', amount);
console.log('');

try {
  const mint = new PublicKey(mintAddress);
  const recipient = new PublicKey(recipientAddress);
  
  // Get sender token account
  const senderTokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    keypair,
    mint,
    keypair.publicKey
  );
  
  // Get or create recipient token account
  const recipientTokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    keypair,
    mint,
    recipient
  );

  console.log('Sender Account:', senderTokenAccount.address.toBase58());
  console.log('Recipient Account:', recipientTokenAccount.address.toBase58());
  
  // Transfer tokens
  const signature = await transfer(
    connection,
    keypair,
    senderTokenAccount.address,
    recipientTokenAccount.address,
    keypair.publicKey,
    amount * 10**9 // Convert to smallest unit
  );

  console.log('');
  console.log('✅ Transfer complete!');
  console.log('Signature:', signature);
  console.log(`Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
  
} catch (err) {
  console.log('❌ Transfer failed:', err.message);
}
