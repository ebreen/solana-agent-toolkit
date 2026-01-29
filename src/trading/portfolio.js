import { Connection, clusterApiUrl, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount } from '@solana/spl-token';
import fs from 'fs';

const wallet = JSON.parse(fs.readFileSync('wallet.json', 'utf8'));
const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
const publicKey = new PublicKey(wallet.publicKey);

console.log('💼 Portfolio Tracker');
console.log('====================');
console.log('Wallet:', wallet.publicKey);
console.log('Network: Devnet');
console.log('');

async function getPortfolio() {
  try {
    // Get SOL balance
    const solBalance = await connection.getBalance(publicKey);
    console.log('SOL Balance:', (solBalance / 10**9).toFixed(4), 'SOL');
    console.log('');
    
    // Get token accounts
    console.log('Token Accounts:');
    console.log('---------------');
    
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      publicKey,
      { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
    );
    
    if (tokenAccounts.value.length === 0) {
      console.log('No token accounts found.');
    } else {
      for (const { account } of tokenAccounts.value) {
        const parsedInfo = account.data.parsed.info;
        const mint = parsedInfo.mint;
        const balance = parsedInfo.tokenAmount.uiAmount;
        const decimals = parsedInfo.tokenAmount.decimals;
        
        if (balance > 0) {
          console.log(`Mint: ${mint}`);
          console.log(`Balance: ${balance.toLocaleString()}`);
          console.log(`Decimals: ${decimals}`);
          console.log('---');
        }
      }
    }
    
    // Check for our custom mint
    console.log('');
    console.log('Custom Token:');
    console.log('-------------');
    try {
      const mintData = JSON.parse(fs.readFileSync('token-mint.json', 'utf8'));
      const customMint = new PublicKey(mintData.mint);
      const tokenAccount = await getAssociatedTokenAddress(customMint, publicKey);
      
      try {
        const account = await getAccount(connection, tokenAccount);
        console.log('Mint:', mintData.mint);
        console.log('Balance:', Number(account.amount) / 10**mintData.decimals);
        console.log('Created:', mintData.createdAt);
      } catch {
        console.log('Token account not created yet.');
      }
    } catch {
      console.log('No custom mint found. Create one with create-token-mint.js');
    }
    
  } catch (err) {
    console.error('Error:', err.message);
  }
}

getPortfolio();
