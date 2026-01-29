import { Connection, clusterApiUrl, LAMPORTS_PER_SOL, PublicKey, Keypair, Transaction, SystemProgram, sendAndConfirmTransaction } from '@solana/web3.js';
import fs from 'fs';

const wallet = JSON.parse(fs.readFileSync('wallet.json', 'utf8'));
const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');

// Load keypair from saved wallet
const secretKey = new Uint8Array(wallet.secretKey);
const keypair = Keypair.fromSecretKey(secretKey);

// Get recipient from command line
const recipientAddress = process.argv[2];
const amount = parseFloat(process.argv[3]);

if (!recipientAddress || !amount) {
  console.log('Usage: node transfer.js <recipient-address> <amount-in-sol>');
  process.exit(1);
}

console.log('💸 Transferring SOL');
console.log('===================');
console.log('From:', wallet.publicKey);
console.log('To:', recipientAddress);
console.log('Amount:', amount, 'SOL');
console.log('');

try {
  const recipient = new PublicKey(recipientAddress);
  
  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: keypair.publicKey,
      toPubkey: recipient,
      lamports: amount * LAMPORTS_PER_SOL,
    })
  );

  const signature = await sendAndConfirmTransaction(
    connection,
    transaction,
    [keypair]
  );

  console.log('✅ Transfer complete!');
  console.log('Signature:', signature);
  console.log(`Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
  
  // Check new balance
  const balance = await connection.getBalance(keypair.publicKey);
  console.log(`New balance: ${balance / LAMPORTS_PER_SOL} SOL`);
  
} catch (err) {
  console.log('❌ Transfer failed:', err.message);
}
