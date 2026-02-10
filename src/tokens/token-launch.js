// Token Launch Toolkit
// One-command SPL token launches with metadata and distribution

import { 
  Connection, 
  Keypair, 
  PublicKey, 
  clusterApiUrl,
  SystemProgram,
  Transaction
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  createMint,
  mintTo,
  getOrCreateAssociatedTokenAccount,
  createSetAuthorityInstruction,
  AuthorityType
} from '@solana/spl-token';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load wallet
const walletFile = JSON.parse(fs.readFileSync(path.join(__dirname, 'wallet.json'), 'utf-8'));
const secretKey = new Uint8Array(walletFile.secretKey);
const keypair = Keypair.fromSecretKey(secretKey);

const NETWORK = process.env.NETWORK || 'devnet';
const connection = new Connection(clusterApiUrl(NETWORK), 'confirmed');

console.log(`🚀 Token Launch Toolkit on ${NETWORK}`);
console.log(`Wallet: ${keypair.publicKey.toBase58()}`);
console.log('');

// Launch token with full setup
export async function launchToken(config) {
  console.log('🎯 Launching Token...');
  console.log(`Name: ${config.name}`);
  console.log(`Symbol: ${config.symbol}`);
  console.log(`Supply: ${config.supply}`);
  console.log(`Decimals: ${config.decimals || 9}`);
  console.log('');

  try {
    // Step 1: Create mint
    console.log('Step 1/4: Creating token mint...');
    const mint = await createMint(
      connection,
      keypair,
      keypair.publicKey,
      config.freezeAuthority ? keypair.publicKey : null,
      config.decimals || 9
    );
    console.log(`✅ Mint created: ${mint.toBase58()}`);

    // Step 2: Create token account
    console.log('Step 2/4: Creating token account...');
    const tokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      keypair,
      mint,
      keypair.publicKey
    );
    console.log(`✅ Token account: ${tokenAccount.address.toBase58()}`);

    // Step 3: Mint tokens
    console.log('Step 3/4: Minting tokens...');
    const supplyAmount = config.supply * Math.pow(10, config.decimals || 9);
    await mintTo(
      connection,
      keypair,
      mint,
      tokenAccount.address,
      keypair.publicKey,
      BigInt(Math.floor(supplyAmount))
    );
    console.log(`✅ Minted ${config.supply} ${config.symbol}`);

    // Step 4: Revoke mint authority (if requested)
    if (config.revokeMintAuthority) {
      console.log('Step 4/4: Revoking mint authority...');
      const transaction = new Transaction().add(
        createSetAuthorityInstruction(
          mint,
          keypair.publicKey,
          AuthorityType.MintTokens,
          null
        )
      );
      await connection.sendAndConfirmTransaction(transaction, [keypair]);
      console.log('✅ Mint authority revoked (fixed supply)');
    } else {
      console.log('Step 4/4: Keeping mint authority...');
      console.log('⚠️  You can mint more tokens later');
    }

    // Save launch data
    const launchData = {
      name: config.name,
      symbol: config.symbol,
      mint: mint.toBase58(),
      tokenAccount: tokenAccount.address.toBase58(),
      supply: config.supply,
      decimals: config.decimals || 9,
      network: NETWORK,
      creator: keypair.publicKey.toBase58(),
      mintAuthorityRevoked: config.revokeMintAuthority || false,
      createdAt: new Date().toISOString()
    };

    const outputFile = path.join(__dirname, `token-launch-${Date.now()}.json`);
    fs.writeFileSync(outputFile, JSON.stringify(launchData, null, 2));

    console.log('');
    console.log('🎉 Token Launch Complete!');
    console.log('=' .repeat(50));
    console.log(`Token Name: ${config.name}`);
    console.log(`Symbol: ${config.symbol}`);
    console.log(`Mint: ${mint.toBase58()}`);
    console.log(`Supply: ${config.supply}`);
    console.log(`Explorer: https://explorer.solana.com/address/${mint.toBase58()}?cluster=${NETWORK}`);
    console.log(`Data saved: ${outputFile}`);

    return launchData;

  } catch (error) {
    console.error('❌ Launch failed:', error.message);
    throw error;
  }
}

// Distribute tokens to multiple addresses
export async function distribute(mintAddress, distributions) {
  console.log(`📤 Distributing tokens from ${mintAddress}...`);
  
  const mint = new PublicKey(mintAddress);
  const results = [];

  for (const dist of distributions) {
    try {
      const recipient = new PublicKey(dist.address);
      const amount = dist.amount * Math.pow(10, 9); // Assuming 9 decimals

      // Get or create recipient token account
      const recipientAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        keypair,
        mint,
        recipient
      );

      // Get sender token account
      const senderAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        keypair,
        mint,
        keypair.publicKey
      );

      // Transfer tokens
      const { transfer } = await import('@solana/spl-token');
      await transfer(
        connection,
        keypair,
        senderAccount.address,
        recipientAccount.address,
        keypair.publicKey,
        BigInt(Math.floor(amount))
      );

      console.log(`✅ Sent ${dist.amount} tokens to ${dist.address.slice(0, 20)}...`);
      results.push({ address: dist.address, amount: dist.amount, status: 'success' });

    } catch (error) {
      console.error(`❌ Failed to send to ${dist.address}:`, error.message);
      results.push({ address: dist.address, amount: dist.amount, status: 'failed', error: error.message });
    }
  }

  return results;
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'launch':
      if (args.length < 3) {
        console.log('Usage: node token-launch.js launch <name> <symbol> <supply> [options]');
        console.log('');
        console.log('Options:');
        console.log('  --decimals <n>      Token decimals (default: 9)');
        console.log('  --revoke-mint       Revoke mint authority (fixed supply)');
        console.log('  --freeze            Enable freeze authority');
        console.log('');
        console.log('Example:');
        console.log('  node token-launch.js launch "My Token" "MTK" 1000000 --revoke-mint');
        process.exit(1);
      }

      const config = {
        name: args[1],
        symbol: args[2],
        supply: parseFloat(args[3]),
        decimals: 9,
        revokeMintAuthority: args.includes('--revoke-mint'),
        freezeAuthority: args.includes('--freeze')
      };

      // Parse decimals if provided
      const decimalsIndex = args.indexOf('--decimals');
      if (decimalsIndex > -1 && args[decimalsIndex + 1]) {
        config.decimals = parseInt(args[decimalsIndex + 1]);
      }

      launchToken(config);
      break;

    case 'distribute':
      console.log('Distribution feature - provide JSON file with addresses');
      console.log('Usage: node token-launch.js distribute <mint> <distribution.json>');
      break;

    default:
      console.log('Token Launch Toolkit');
      console.log('');
      console.log('Commands:');
      console.log('  launch    Launch a new token');
      console.log('  distribute  Distribute tokens to multiple addresses');
      console.log('');
      console.log('Examples:');
      console.log('  node token-launch.js launch "My Token" "MTK" 1000000 --revoke-mint');
  }
}

export { launchToken, distribute };
