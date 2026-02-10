import { Connection, clusterApiUrl, PublicKey, Keypair, VersionedTransaction } from '@solana/web3.js';
import fetch from 'node-fetch';
import fs from 'fs';

const wallet = JSON.parse(fs.readFileSync('wallet.json', 'utf8'));
const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
const secretKey = new Uint8Array(wallet.secretKey);
const keypair = Keypair.fromSecretKey(secretKey);

// Jupiter Ultra API (2025 - latest)
const JUPITER_ULTRA_API = 'https://api.jup.ag/swap/v1';

// Common token mints
const TOKENS = {
  SOL: 'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  JUP: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
  JLP: 'JLPzqFQZv3mZ8GTYZ5v8CnhWnQpc6Lqo25tHt7tWo2D',
  BONK: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  PYTH: 'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3',
};

// Token decimals
const DECIMALS = {
  SOL: 9,
  USDC: 6,
  USDT: 6,
  JUP: 6,
  JLP: 6,
  BONK: 5,
  PYTH: 6,
};

async function ultraSwap(inputMint, outputMint, amount, slippageBps = 50) {
  const url = `${JUPITER_ULTRA_API}/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippageBps}&onlyDirectRoutes=false`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }
    return await response.json();
  } catch (err) {
    console.error('❌ Quote error:', err.message);
    return null;
  }
}

async function getSwapTransaction(quoteResponse, userPublicKey) {
  try {
    const response = await fetch(`${JUPITER_ULTRA_API}/swap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quoteResponse,
        userPublicKey: userPublicKey.toString(),
        wrapAndUnwrapSol: true,
        prioritizationFeeLamports: 'auto', // Auto-compute priority fee
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }
    return await response.json();
  } catch (err) {
    console.error('❌ Swap build error:', err.message);
    return null;
  }
}

function formatAmount(amount, token) {
  const decimals = DECIMALS[token] || 6;
  return (amount / 10**decimals).toLocaleString('en-US', { 
    maximumFractionDigits: decimals 
  });
}

async function main() {
  const inputToken = (process.argv[2] || 'SOL').toUpperCase();
  const outputToken = (process.argv[3] || 'USDC').toUpperCase();
  const amount = parseFloat(process.argv[4] || '0.1');
  const slippage = parseFloat(process.argv[5] || '0.5'); // 0.5% default
  const dryRun = process.argv.includes('--dry-run');
  
  console.log('🚀 Jupiter Ultra Swap');
  console.log('====================');
  console.log(`Swap: ${amount} ${inputToken} → ${outputToken}`);
  console.log(`Slippage: ${slippage}%`);
  console.log(`Network: ${dryRun ? 'DRY RUN' : 'devnet'}`);
  console.log('Wallet:', wallet.publicKey);
  console.log('');
  
  const inputMint = TOKENS[inputToken];
  const outputMint = TOKENS[outputToken];
  
  if (!inputMint || !outputMint) {
    console.log('❌ Supported tokens:', Object.keys(TOKENS).join(', '));
    process.exit(1);
  }
  
  const inputDecimals = DECIMALS[inputToken] || 6;
  const amountInSmallest = Math.floor(amount * 10**inputDecimals);
  
  console.log('📊 Fetching Ultra quote...');
  const slippageBps = Math.floor(slippage * 100);
  const quote = await ultraSwap(inputMint, outputMint, amountInSmallest, slippageBps);
  
  if (!quote) {
    console.log('❌ Failed to get quote');
    process.exit(1);
  }
  
  console.log('✅ Quote received:');
  console.log('  Input:', formatAmount(quote.inAmount, inputToken), inputToken);
  console.log('  Output:', formatAmount(quote.outAmount, outputToken), outputToken);
  console.log('  Price impact:', quote.priceImpactPct, '%');
  console.log('  Route:', quote.routePlan?.length || 'direct', 'hops');
  if (quote.prioritizationFeeLamports) {
    console.log('  Priority fee:', quote.prioritizationFeeLamports / 10**9, 'SOL');
  }
  console.log('');
  
  if (dryRun) {
    console.log('📝 Dry run complete - no transaction sent');
    process.exit(0);
  }
  
  // Confirm swap
  console.log('⚡ Building swap transaction...');
  const swapData = await getSwapTransaction(quote, keypair.publicKey);
  
  if (!swapData || !swapData.swapTransaction) {
    console.log('❌ Failed to build swap transaction');
    process.exit(1);
  }
  
  console.log('✅ Transaction built!');
  console.log('');
  
  // Deserialize and sign
  const swapTransactionBuf = Buffer.from(swapData.swapTransaction, 'base64');
  const transaction = VersionedTransaction.deserialize(swapTransactionBuf);
  transaction.sign([keypair]);
  
  // Execute
  console.log('🔄 Executing swap...');
  try {
    const signature = await connection.sendTransaction(transaction, {
      maxRetries: 3,
      skipPreflight: false,
    });
    
    console.log('✅ Swap submitted!');
    console.log('Signature:', signature);
    console.log(`Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
    console.log('');
    
    // Wait for confirmation
    console.log('⏳ Waiting for confirmation...');
    const confirmation = await connection.confirmTransaction(signature, 'confirmed');
    
    if (confirmation.value.err) {
      console.log('❌ Transaction failed:', confirmation.value.err);
    } else {
      console.log('✅ Swap confirmed successfully!');
    }
    
  } catch (err) {
    console.log('❌ Swap failed:', err.message);
    if (err.message.includes('insufficient funds')) {
      console.log('💡 Tip: Get devnet SOL from https://faucet.solana.com/');
    }
  }
}

// Show help
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('Jupiter Ultra Swap Tool');
  console.log('=======================');
  console.log('Usage: node ultra-swap.js <input> <output> <amount> [slippage] [--dry-run]');
  console.log('');
  console.log('Examples:');
  console.log('  node ultra-swap.js SOL USDC 0.5       # Swap 0.5 SOL for USDC');
  console.log('  node ultra-swap.js USDC SOL 100 1     # Swap 100 USDC for SOL with 1% slippage');
  console.log('  node ultra-swap.js SOL JUP 1 --dry-run # Preview swap without executing');
  console.log('');
  console.log('Supported tokens:', Object.keys(TOKENS).join(', '));
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});