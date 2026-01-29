import { Connection, clusterApiUrl, PublicKey, Keypair, VersionedTransaction } from '@solana/web3.js';
import fetch from 'node-fetch';
import fs from 'fs';

const wallet = JSON.parse(fs.readFileSync('wallet.json', 'utf8'));
const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
const secretKey = new Uint8Array(wallet.secretKey);
const keypair = Keypair.fromSecretKey(secretKey);

// Jupiter API
const JUPITER_QUOTE_API = 'https://quote-api.jup.ag/v6';
const JUPITER_SWAP_API = 'https://quote-api.jup.ag/v6';

async function getQuote(inputMint, outputMint, amount, slippageBps = 50) {
  const url = `${JUPITER_QUOTE_API}/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippageBps}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) {
    console.error('Quote error:', err.message);
    return null;
  }
}

async function getSwapTransaction(quoteResponse, userPublicKey) {
  try {
    const response = await fetch(`${JUPITER_SWAP_API}/swap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quoteResponse,
        userPublicKey: userPublicKey.toString(),
        wrapAndUnwrapSol: true,
      }),
    });
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) {
    console.error('Swap error:', err.message);
    return null;
  }
}

async function main() {
  // Parse arguments
  const inputToken = process.argv[2] || 'SOL';
  const outputToken = process.argv[3] || 'USDC';
  const amount = parseFloat(process.argv[4] || '0.1');
  
  console.log('🔄 Jupiter Swap');
  console.log('===============');
  console.log(`Swap: ${amount} ${inputToken} → ${outputToken}`);
  console.log('Wallet:', wallet.publicKey);
  console.log('');
  
  // Token mints
  const TOKENS = {
    SOL: 'So11111111111111111111111111111111111111112',
    USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  };
  
  const inputMint = TOKENS[inputToken.toUpperCase()];
  const outputMint = TOKENS[outputToken.toUpperCase()];
  
  if (!inputMint || !outputMint) {
    console.log('Supported tokens: SOL, USDC, USDT');
    process.exit(1);
  }
  
  // Convert amount to lamports/smallest unit
  const amountInSmallest = inputToken.toUpperCase() === 'SOL' 
    ? amount * 10**9 
    : amount * 10**6; // Assuming 6 decimals for tokens
  
  console.log('Fetching quote...');
  const quote = await getQuote(inputMint, outputMint, amountInSmallest);
  
  if (!quote) {
    console.log('❌ Failed to get quote');
    process.exit(1);
  }
  
  console.log('Quote received:');
  console.log('  Input:', quote.inAmount / 10**9, inputToken);
  console.log('  Output:', quote.outAmount / 10**6, outputToken);
  console.log('  Price impact:', quote.priceImpactPct, '%');
  console.log('  Route:', quote.routePlan.length, 'hops');
  console.log('');
  
  // Get swap transaction
  console.log('Building swap transaction...');
  const swapData = await getSwapTransaction(quote, keypair.publicKey);
  
  if (!swapData || !swapData.swapTransaction) {
    console.log('❌ Failed to build swap transaction');
    process.exit(1);
  }
  
  console.log('Transaction built!');
  console.log('');
  
  // Deserialize and sign transaction
  const swapTransactionBuf = Buffer.from(swapData.swapTransaction, 'base64');
  const transaction = VersionedTransaction.deserialize(swapTransactionBuf);
  
  // Sign
  transaction.sign([keypair]);
  
  // Execute
  console.log('Executing swap...');
  try {
    const signature = await connection.sendTransaction(transaction);
    console.log('✅ Swap submitted!');
    console.log('Signature:', signature);
    console.log(`Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
    
    // Wait for confirmation
    console.log('Waiting for confirmation...');
    await connection.confirmTransaction(signature);
    console.log('✅ Swap confirmed!');
    
  } catch (err) {
    console.log('❌ Swap failed:', err.message);
  }
}

main().catch(console.error);
