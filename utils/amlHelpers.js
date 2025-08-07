import 'dotenv/config';
import axios from 'axios';
import CleanWallet from '../models/CleanWallet.js';

async function performAMLCheck(addressToCheck) {
  try {
    const existing = await CleanWallet.findOne({ walletAddress: addressToCheck });
    if (existing) {
      return { passed: true, riskscore: 0, signals: {} };
    }

    const amlUrl = 'https://api.getblock.net/rpc/v1/request';
    const accessToken = process.env.GETBLOCK_ACCESS_TOKEN;

    const initPayload = {
      jsonrpc: '2.0',
      id: Date.now().toString(),
      method: 'checkup.checkaddr',
      params: { addr: addressToCheck, currency: 'TRX' },
    };

    const initResp = await axios.post(amlUrl, initPayload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'cache-control': 'no-cache',
      },
      validateStatus: () => true,
    });

    if (initResp.data.error) {
      throw new Error(`AML check initiation error: ${initResp.data.error.message}`);
    }

    const checkHash = initResp.data.result?.check?.hash;
    if (!checkHash) throw new Error('No check hash in AML response');

    let amlResult = null;
    for (let i = 0; i < 5; i++) {
      await new Promise(r => setTimeout(r, 3000));

      const res = await axios.post(
        amlUrl,
        {
          jsonrpc: '2.0',
          id: Date.now().toString(),
          method: 'checkup.getresult',
          params: { hash: checkHash },
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

      if (res.data.error) {
        throw new Error(`AML check getresult error: ${res.data.error.message}`);
      }

      if (res.data.result?.check?.status === 'SUCCESS') {
        amlResult = res.data.result.check;
        break;
      }
    }

    if (!amlResult) throw new Error('AML check result not available in time');

    const riskscore = amlResult.report?.riskscore ?? null;
    if (riskscore === null) throw new Error('No riskscore in AML report');

    const signals = amlResult.report?.signals;
    if (!signals) throw new Error('No signals in AML report');

    let passed = true;
    const THRESHOLD_VERY_STRICT = 0.00001;
    const THRESHOLD_FIVE_PERCENT = 0.05;
    const THRESHOLD_SUM = 0.5;
    const THRESHOLD_VERY_MANY = 0.01;

    if (
      (signals.dark_market ?? 0) > THRESHOLD_VERY_STRICT ||
      (signals.dark_service ?? 0) > THRESHOLD_VERY_STRICT ||
      (signals.scam ?? 0) > THRESHOLD_VERY_STRICT ||
      (signals.stolen_coins ?? 0) > THRESHOLD_VERY_STRICT ||
      (signals.mixer ?? 0) > THRESHOLD_VERY_STRICT ||
      (signals.exchange_fraudulent ?? 0) > THRESHOLD_VERY_STRICT ||
      (signals.illegal_service ?? 0) > THRESHOLD_VERY_STRICT ||
      (signals.ransom ?? 0) > THRESHOLD_VERY_STRICT ||
      (signals.terrorism_financing ?? 0) > THRESHOLD_VERY_STRICT ||
      (signals.gambling ?? 0) > THRESHOLD_VERY_MANY ||
      (signals.enforcement_action ?? 0) > THRESHOLD_VERY_STRICT ||
      (signals.sanctions ?? 0) > THRESHOLD_VERY_MANY
    ) passed = false;

    if (
      (signals.atm ?? 0) > THRESHOLD_FIVE_PERCENT ||
      (signals.exchange_mlrisk_high ?? 0) > THRESHOLD_FIVE_PERCENT ||
      (signals.p2p_exchange_mlrisk_high ?? 0) > THRESHOLD_FIVE_PERCENT ||
      (signals.unnamed_service ?? 0) > THRESHOLD_FIVE_PERCENT
    ) passed = false;

    const highRiskSignalsSum =
      (signals.dark_market ?? 0) +
      (signals.dark_service ?? 0) +
      (signals.scam ?? 0) +
      (signals.stolen_coins ?? 0) +
      (signals.mixer ?? 0) +
      (signals.exchange_fraudulent ?? 0) +
      (signals.illegal_service ?? 0) +
      (signals.ransom ?? 0) +
      (signals.terrorism_financing ?? 0) +
      (signals.gambling ?? 0) +
      (signals.enforcement_action ?? 0) +
      (signals.sanctions ?? 0) +
      (signals.atm ?? 0) +
      (signals.exchange_mlrisk_high ?? 0) +
      (signals.p2p_exchange_mlrisk_high ?? 0) +
      (signals.unnamed_service ?? 0);

    if (highRiskSignalsSum > THRESHOLD_SUM) passed = false;
    if (riskscore >= 0.4) passed = false;

    return { passed, riskscore, signals };
  } catch (err) {
    console.error('Ошибка в performAMLCheck:', err);
    return { passed: false, riskscore: 0, signals: {}, error: err.message };
  }
}

export { performAMLCheck };
