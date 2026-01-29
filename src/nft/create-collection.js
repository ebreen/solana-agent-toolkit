// NFT Collection Minter
// Creates multiple NFTs in a collection

import { createNft, mplTokenMetadata } from '@metaplex-foundation/mpl-token-metadata';
import { generateSigner, percentAmount, signerIdentity, createSignerFromKeypair } from '@metaplex-foundation/umi';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const walletPath = process.env.WALLET_PATH || path.join(__dirname, 'wallet.json');
const walletFile = JSON.parse(fs.readFileSync(walletPath, 'utf-8'));
const secretKey = new Uint8Array(walletFile.secretKey);

const NETWORK = process.env.NETWORK || 'devnet';
const RPC_URL = NETWORK === 'mainnet' 
  ? 'https://api.mainnet-beta.solana.com'
  : 'https://api.devnet.solana.com';

export async function createCollection(name, symbol, baseUri, count, options = {}) {
  console.log(`🎨 Creating NFT Collection on ${NETWORK}...`);
  console.log(`   Collection: ${name}`);
  console.log(`   Symbol: ${symbol}`);
  console.log(`   Count: ${count}`);
  console.log(`   Base URI: ${baseUri}`);
  console.log('');

  const umi = createUmi(RPC_URL);
  const umiKeypair = umi.eddsa.createKeypairFromSecretKey(secretKey);
  const signer = createSignerFromKeypair(umi, umiKeypair);
  umi.use(signerIdentity(signer));
  umi.use(mplTokenMetadata());

  const nfts = [];
  const startNum = options.startNumber || 1;

  for (let i = 0; i < count; i++) {
    const num = startNum + i;
    const nftName = `${name} #${num}`;
    const uri = `${baseUri}/${num}.json`;
    
    console.log(`Creating ${nftName}...`);
    
    try {
      const mint = generateSigner(umi);
      const result = await createNft(umi, {
        mint,
        name: nftName,
        symbol,
        uri,
        sellerFeeBasisPoints: percentAmount(options.royalty || 5),
        creators: options.creators || [
          { address: signer.publicKey, verified: true, share: 100 }
        ],
        collection: options.collection ? { key: options.collection, verified: false } : undefined,
      }).sendAndConfirm(umi);

      const mintAddress = mint.publicKey.toString();
      
      console.log(`  ✅ Created: ${mintAddress}`);
      
      nfts.push({
        name: nftName,
        number: num,
        mint: mintAddress,
        signature: result.signature.toString()
      });

      // Small delay between mints
      if (i < count - 1) {
        await new Promise(r => setTimeout(r, 500));
      }
    } catch (error) {
      console.error(`  ❌ Failed to create ${nftName}:`, error.message);
    }
  }

  // Save collection data
  const collectionData = {
    name,
    symbol,
    baseUri,
    network: NETWORK,
    createdAt: new Date().toISOString(),
    count: nfts.length,
    nfts
  };

  const outputPath = path.join(__dirname, `collection-${Date.now()}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(collectionData, null, 2));
  
  console.log('');
  console.log(`✅ Collection Complete!`);
  console.log(`   Created: ${nfts.length}/${count} NFTs`);
  console.log(`   Saved to: ${outputPath}`);

  return collectionData;
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  
  if (args.length < 4) {
    console.log('Usage: node create-collection.js <name> <symbol> <baseUri> <count> [startNumber]');
    console.log('');
    console.log('Example:');
    console.log('  node create-collection.js "Pixel Punks" "PUNK" "https://arweave.net/collection" 100');
    console.log('');
    console.log('Note: Assumes metadata files are at baseUri/1.json, baseUri/2.json, etc.');
    process.exit(1);
  }

  const [name, symbol, baseUri, count, startNumber] = args;
  
  createCollection(name, symbol, baseUri, parseInt(count), { 
    startNumber: parseInt(startNumber) || 1 
  })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
