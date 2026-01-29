import { Connection, clusterApiUrl, PublicKey, Keypair } from '@solana/web3.js';
import { getOrCreateAssociatedTokenAccount, transfer } from '@solana/spl-token';
import fs from 'fs';

const wallet = JSON.parse(fs.readFileSync('wallet.json', 'utf8'));
const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
const secretKey = new Uint8Array(wallet.secretKey);
const keypair = Keypair.fromSecretKey(secretKey);

// Get mint from saved file
let mintAddress;
try {
  const mintData = JSON.parse(fs.readFileSync('token-mint.json', 'utf8'));
  mintAddress = mintData.mint;
} catch {
  console.log('❌ No token mint found. Run create-token-mint.js first.');
  process.exit(1);
}

console.log('🧪 Testing Token Transfer');
console.log('=========================');
console.log('From:', wallet.publicKey);
console.log('Mint:', mintAddress);
console.log('');

async function testTransfer() {
  try {
    const mint = new PublicKey(mintAddress);
    
    // Create a new recipient wallet for testing
    const recipientKeypair = Keypair.generate();
    console.log('Test recipient:', recipientKeypair.publicKey.toBase58());
    
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
      recipientKeypair.publicKey
    );

    console.log('Sender account:', senderTokenAccount.address.toBase58());
    console.log('Recipient account:', recipientTokenAccount.address.toBase58());
    
    // Check sender balance
    const senderBalance = await connection.getTokenAccountBalance(senderTokenAccount.address);
    console.log('Sender balance:', senderBalance.value.uiAmount);
    
    if (senderBalance.value.uiAmount < 100) {
      console.log('❌ Insufficient balance. Mint more tokens first.');
      process.exit(1);
    }
    
    // Transfer 100 tokens
    const transferAmount = 100;
    console.log(`\nTransferring ${transferAmount} tokens...`);
    
    const signature = await transfer(
      connection,
      keypair,
      senderTokenAccount.address,
      recipientTokenAccount.address,
      keypair.publicKey,
      transferAmount * 10**9 // 9 decimals
    );

    console.log('✅ Transfer complete!');
    console.log('Signature:', signature);
    console.log(`Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
    
    // Verify balances
    const newSenderBalance = await connection.getTokenAccountBalance(senderTokenAccount.address);
    const recipientBalance = await connection.getTokenAccountBalance(recipientTokenAccount.address);
    
    console.log('\nNew balances:');
    console.log('Sender:', newSenderBalance.value.uiAmount);
    console.log('Recipient:', recipientBalance.value.uiAmount);
    
    // Save test recipient for future use
    const testData = {
      recipient: recipientKeypair.publicKey.toBase58(),
      secretKey: Array.from(recipientKeypair.secretKey),
      transferred: transferAmount,
      signature,
      timestamp: new Date().toISOString()
    };
    fs.writeFileSync('test-transfer.json', JSON.stringify(testData, null, 2));
    console.log('\n✅ Test data saved to test-transfer.json');
    
  } catch (err) {
    console.log('❌ Transfer failed:', err.message);
    console.log(err);
  }
}

testTransfer();
