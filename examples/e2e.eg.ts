import { equal } from "node:assert"
import { AccountUpdate, Bool, fetchAccount, Mina, NetworkId, PrivateKey, UInt64, UInt8 } from "o1js"
import { FungibleToken, FungibleTokenAdmin } from "../index.js"

async function getNewMinaLiteNetAccountSK(): Promise<string> {
    const { request } = await import('http');
    return new Promise((resolve, reject) => {
        const req = request(
            {
                host: 'localhost',
                port: 8181,
                path: '/acquire-account',
                method: 'GET',
            },
            (res) => {
                res.setEncoding('utf8');
                let buffer = '';
                res.on('data', (data) => (buffer += data));
                res.on('end', () => {
                    try {
                        const data = JSON.parse(buffer);
                        console.log(`Received new sk from acquire account.`);
                        resolve(data.sk);
                    } catch (e) {
                        const error = e as unknown as Error;
                        console.error(
                            `Failed to retreive a new account:\n${String(
                                error.stack
                            )}`
                        );
                        reject(error);
                    }
                });
            }
        );
        req.on('error', (err) => reject(err));
        req.end();
    });
}

const minaConfig = {
    networkId: 'devnet' as NetworkId,
    mina: 'http://localhost:8080/graphql',
};

const Network = Mina.Network(minaConfig);
Mina.setActiveInstance(Network);

const fee = 1e8

//const [deployer, owner, alexa, billy] = localChain.testAccounts

// Generate a funded test private keys for mina litenet
let litenetSk = await getNewMinaLiteNetAccountSK();
const deployerPrivateKey = PrivateKey.fromBase58(litenetSk);
const deployerPublicKey = deployerPrivateKey.toPublicKey();

litenetSk = await getNewMinaLiteNetAccountSK();
const ownerPrivateKey = PrivateKey.fromBase58(litenetSk);
const ownerPublicKey = deployerPrivateKey.toPublicKey();

litenetSk = await getNewMinaLiteNetAccountSK();
const alexaPrivateKey = PrivateKey.fromBase58(litenetSk);
const alexaPublicKey = alexaPrivateKey.toPublicKey();

litenetSk = await getNewMinaLiteNetAccountSK();
const billyPrivateKey = PrivateKey.fromBase58(litenetSk);
const billyPublicKey = billyPrivateKey.toPublicKey();

const contract = PrivateKey.randomKeypair();
const admin = PrivateKey.randomKeypair();

console.log('Public keys', deployerPublicKey.toBase58(), ownerPublicKey.toBase58(), contract.publicKey.toBase58(), admin.publicKey.toBase58(), alexaPublicKey.toBase58(), billyPublicKey.toBase58());

// Compile
console.time("FungibleToken compilation");
const fungibleTokenVk = await FungibleToken.compile();
console.timeEnd("FungibleToken compilation");
console.log("FungibleToken Vk.hash:", fungibleTokenVk.verificationKey.hash);

console.time("FungibleTokenAdmin compilation");
const fungibleTokenAdminVk = await FungibleTokenAdmin.compile();
console.timeEnd("FungibleTokenAdmin compilation");
console.log("FungibleTokenAdmin Vk.hash:", fungibleTokenAdminVk.verificationKey.hash);

const token = new FungibleToken(contract.publicKey)
const adminContract = new FungibleTokenAdmin(admin.publicKey)

console.log("Deploying token contract.")
const deployTx = await Mina.transaction({
  sender: deployerPublicKey,
  fee,
}, async () => {
  AccountUpdate.fundNewAccount(deployerPublicKey, 3)
  await adminContract.deploy({ adminPublicKey: admin.publicKey })
  await token.deploy({
    symbol: "abc",
    src: "https://github.com/MinaFoundation/mina-fungible-token/blob/main/FungibleToken.ts",
    allowUpdates: true,
  })
  await token.initialize(
    admin.publicKey,
    UInt8.from(9),
    // We can set `startPaused` to `Bool(false)` here, because we are doing an atomic deployment
    // If you are not deploying the admin and token contracts in the same transaction,
    // it is safer to start the tokens paused, and resume them only after verifying that
    // the admin contract has been deployed
    Bool(false),
  )
})

await deployTx.prove()
deployTx.sign([deployerPrivateKey, contract.privateKey, admin.privateKey])
const deployTxResult = await deployTx.send().then((v) => v.wait())
console.log("Deploy tx result:", deployTxResult.toPretty())
equal(deployTxResult.status, "included")

await fetchAccount({publicKey: alexaPublicKey});
await fetchAccount({
    publicKey: alexaPublicKey,
    tokenId: token.deriveTokenId(),
});
await fetchAccount({publicKey: contract.publicKey});

// just alexa
const alexaBalanceBeforeMint = (await token.getBalanceOf(alexaPublicKey)).toBigInt()
console.log("Alexa balance before mint:", alexaBalanceBeforeMint)
equal(alexaBalanceBeforeMint, 0n)

console.log("Minting new tokens to Alexa.")
const mintTx = await Mina.transaction({
  sender: deployerPublicKey, //ownerPublicKey,
  fee,
}, async () => {
  AccountUpdate.fundNewAccount(deployerPublicKey, 1); // ownerPublicKey
  await token.mint(alexaPublicKey, new UInt64(2e9))
})
await mintTx.prove()
mintTx.sign([deployerPrivateKey, admin.privateKey]) // ownerPrivateKey

// owner private key was removed because mint tx fails (invalid\n \"Invalid_signature:

const mintTxResult = await mintTx.send().then((v) => v.wait())
console.log("Mint tx result:", mintTxResult.toPretty())
equal(mintTxResult.status, "included")

await fetchAccount({publicKey: alexaPublicKey});
await fetchAccount({
    publicKey: alexaPublicKey,
    tokenId: token.deriveTokenId(),
});
await fetchAccount({publicKey: contract.publicKey});

const alexaBalanceAfterMint = (await token.getBalanceOf(alexaPublicKey)).toBigInt()
console.log("Alexa balance after mint:", alexaBalanceAfterMint)
equal(alexaBalanceAfterMint, BigInt(2e9));

await fetchAccount({publicKey: billyPublicKey});
await fetchAccount({
    publicKey: billyPublicKey,
    tokenId: token.deriveTokenId(),
});
await fetchAccount({publicKey: contract.publicKey});

const billyBalanceBeforeMint = await token.getBalanceOf(billyPublicKey)
console.log("Billy balance before mint:", billyBalanceBeforeMint.toBigInt())
equal(alexaBalanceBeforeMint, 0n)

console.log("Transferring tokens from Alexa to Billy")
const transferTx = await Mina.transaction({
  sender: alexaPublicKey,
  fee,
}, async () => {
  AccountUpdate.fundNewAccount(alexaPublicKey, 1)
  await token.transfer(alexaPublicKey, billyPublicKey, new UInt64(1e9))
})
await transferTx.prove()
transferTx.sign([alexaPrivateKey])
const transferTxResult = await transferTx.send().then((v) => v.wait())
console.log("Transfer tx result:", transferTxResult.toPretty())
equal(transferTxResult.status, "included")

await fetchAccount({publicKey: alexaPublicKey});
await fetchAccount({
    publicKey: alexaPublicKey,
    tokenId: token.deriveTokenId(),
});
await fetchAccount({publicKey: contract.publicKey});
await fetchAccount({publicKey: billyPublicKey});
await fetchAccount({
    publicKey: billyPublicKey,
    tokenId: token.deriveTokenId(),
});
await fetchAccount({publicKey: contract.publicKey});

const alexaBalanceAfterTransfer = (await token.getBalanceOf(alexaPublicKey)).toBigInt()
console.log("Alexa balance after transfer:", alexaBalanceAfterTransfer)
equal(alexaBalanceAfterTransfer, BigInt(1e9))

const billyBalanceAfterTransfer = (await token.getBalanceOf(billyPublicKey)).toBigInt()
console.log("Billy balance after transfer:", billyBalanceAfterTransfer)
equal(billyBalanceAfterTransfer, BigInt(1e9))

console.log("Burning Billy's tokens")
const burnTx = await Mina.transaction({
  sender: billyPublicKey,
  fee,
}, async () => {
  await token.burn(billyPublicKey, new UInt64(6e8))
})
await burnTx.prove()
burnTx.sign([billyPrivateKey])
const burnTxResult = await burnTx.send().then((v) => v.wait())
console.log("Burn tx result:", burnTxResult.toPretty())
equal(burnTxResult.status, "included")

await fetchAccount({publicKey: billyPublicKey});
await fetchAccount({
    publicKey: billyPublicKey,
    tokenId: token.deriveTokenId(),
});
await fetchAccount({publicKey: contract.publicKey});

const billyBalanceAfterBurn = (await token.getBalanceOf(billyPublicKey)).toBigInt()
console.log("Billy balance after burn:", billyBalanceAfterBurn)
equal(billyBalanceAfterBurn, BigInt(4e8))
