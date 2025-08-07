import 'dotenv/config';
import { TronWeb } from 'tronweb';

const tronWeb = new TronWeb({ fullHost: process.env.TRON_FULL_NODE });

const tronWebMain = new TronWeb({
  fullHost: process.env.TRON_FULL_NODE,
  privateKey: process.env.PRIVATE_PASSWORD_MAIN,
});

export async function generateOneTimeWallet() {
  const acc = await tronWeb.createAccount();
  return { walletAddress: acc.address.base58, privateKey: acc.privateKey };
}

export async function generateOneTimeWalletUSDT() {
  const acc = await tronWeb.createAccount();
  const newAddr = acc.address.base58;
  const pk = acc.privateKey;

  console.log('Новый USDT‑кошелек:', newAddr);
  const tx = await tronWebMain.trx.sendTransaction(newAddr, 1_000_000);
  console.log('Результат отправки 1 TRX:', tx);

  return { walletAddress: newAddr, privateKey: pk };
}

export { tronWeb, tronWebMain };
