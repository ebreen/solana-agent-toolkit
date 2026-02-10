import { Connection, clusterApiUrl, PublicKey } from '@solana/web3.js';
import fs from 'fs';

const wallet = JSON.parse(fs.readFileSync('wallet.json', 'utf8'));
const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');

console.log('📊 Token Balance Monitor');
console.log('========================');
console.log('Wallet:', wallet.publicKey);
console.log('');

async function monitor() {
  // Get SOL balance
  const solBalance = await connection.getBalance(new PublicKey(wallet.publicKey));
  console.log('SOL Balance:', (solBalance / 10**9).toFixed(4), 'SOL');
  
  // Get all token accounts
  const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
    new PublicKey(wallet.publicKey),
    { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
  );
  
  console.log('\nToken Accounts:', tokenAccounts.value.length);
  
  for (const { account } of tokenAccounts.value) {
    const parsed = account.data.parsed.info;
    const balance = parsed.tokenAmount.uiAmount;
    
    if (balance > 0) {
      console.log(`\n  Mint: ${parsed.mint}`);
      console.log(`  Balance: ${balance.toLocaleString()}`);
      
      // Check if it's our custom mint
      try {
        const mintData = JSON.parse(fs.readFileSync('token-mint.json', 'utf8'));
        if (parsed.mint === mintData.mint) {
          console.log('  ⭐ Custom Token');
        }
      } catch {}
    }
  }
  
  // Check recent transactions
  console.log('\n\nRecent Transactions:');
  const signatures = await connection.getSignaturesForAddress(
    new PublicKey(wallet.publicKey),
    { limit: 5 }
  );
  
  for (const sig of signatures) {
    const date = new Date(sig.blockTime * 1000).toLocaleString();
    console.log(`  ${date} - ${sig.signature.slice(0, 20)}...`);
    console.log(`    Status: ${sig.confirmationStatus}`);
    if (sig.memo) console.log(`    Memo: ${sig.memo}`);
  }
}

monitor().catch(console.error);
