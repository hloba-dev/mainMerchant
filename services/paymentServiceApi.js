import 'dotenv/config';
import axios from 'axios';

import Payment from '../models/Payment.js';
import Config  from '../models/Config.js';
import { tronWeb } from './walletService.js';

async function performAMLCheck(payment) {
  const amlUrl      = 'https://api.getblock.net/rpc/v1/request';
  const accessToken = process.env.GETBLOCK_ACCESS_TOKEN;

  const initResp = await axios.post(
    amlUrl,
    {
      jsonrpc: '2.0',
      id: Date.now().toString(),
      method: 'checkup.checkaddr',
      params: { addr: payment.walletAddress, currency: 'TRX' },
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'cache-control': 'no-cache',
      },
      validateStatus: () => true,
    }
  );

  if (initResp.data.error)
    throw new Error(`AML check initiation error: ${initResp.data.error.message}`);

  const hash = initResp.data.result.check.hash;

  let amlResult = null;
  for (let i = 0; i < 5; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const res = await axios.post(
      amlUrl,
      {
        jsonrpc: '2.0',
        id: Date.now().toString(),
        method: 'checkup.getresult',
        params: { hash },
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'cache-control': 'no-cache',
        },
        validateStatus: () => true,
      }
    );

    if (res.data.error)
      throw new Error(`AML check getresult error: ${res.data.error.message}`);

    if (res.data.result?.check?.status === 'SUCCESS') {
      amlResult = res.data.result.check;
      break;
    }
  }

  if (!amlResult) throw new Error('AML check result not available in time');
  return amlResult.report?.riskscore < 0.2;
}

async function transferFunds(payment, targetWallet, balanceTRX) {
  const commission = 1;
  const amountSun = Math.floor((balanceTRX - commission) * 1e6);
  if (amountSun <= 0) throw new Error('Недостаточно средств для перевода с учётом комиссии');

  const tx  = await tronWeb.transactionBuilder.sendTrx(
    targetWallet,
    amountSun,
    payment.walletAddress
  );
  const sig = await tronWeb.trx.sign(tx, payment.privateKey);
  return tronWeb.trx.sendRawTransaction(sig);
}

export { Payment, Config, performAMLCheck, transferFunds };
