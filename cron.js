import 'dotenv/config';
import cron from 'node-cron';
import axios from 'axios';

import connectDB from './lib/db.js';
import Payment   from './models/Payment.js';
import Config    from './models/Config.js';

import {
  delegateEnergyOneHour,
  sendUsdtFromEphemeralToMain,
  getUsdtBalance,
  getUsdtSenderAddress,
} from './utils/tronHelpers.js';

import { performAMLCheck } from './utils/amlHelpers.js';


(async () => {
  try {
    await connectDB();
    console.log('[USDT‑cron] MongoDB ready');

    await handlePayments();
    cron.schedule('* * * * *', handlePayments);
  } catch (err) {
    console.error('[USDT‑cron] Mongo connect error:', err);
    process.exit(1);
  }
})();


let isRunning = false;

async function handlePayments() {
  if (isRunning) {
    console.log('[USDT‑cron] previous run still working → skip');
    return;
  }
  isRunning = true;
  console.log('[USDT‑cron] tick', new Date().toLocaleString());

  try {
    const pendingPayments = await Payment.find({ status: 'pending', currency: 'USDT' });
    if (pendingPayments.length > 0) {
      console.log(`[USDT-cron] Найдено ожидающих платежей: ${pendingPayments.length}`);
    }

    for (const payment of pendingPayments) {
      const paymentId = payment._id.toString();
      console.log(`\n───[${paymentId}]─── Начало обработки.`);

      try {
        /* баланс USDT */
        console.log(`[${paymentId}] 1. Проверка баланса кошелька: ${payment.walletAddress}`);
        const usdtBalance = await getUsdtBalance(payment.walletAddress);
        console.log(`[${paymentId}] -> Баланс USDT: ${usdtBalance}`);
        if (usdtBalance === 0) {
          console.log(`[${paymentId}] -> Баланс 0. Пропускаем.`);
          continue;
        }

        console.log(`[${paymentId}] 2. Баланс > 0. Установка статуса 'wait'.`);
        payment.status = 'wait';
        await payment.save();
        console.log(`[${paymentId}] -> Статус 'wait' сохранен.`);
        await sendCallback(payment, { usdtBalance });

        /* адрес отправителя */
        console.log(`[${paymentId}] 3. Получение адреса отправителя.`);
        const senderAddress = await getUsdtSenderAddress(payment);
        if (!senderAddress) {
          console.log(`[${paymentId}] -> Адрес отправителя не найден. Возврат в 'pending'.`);
          await revertToPending(payment);
          continue;
        }
        console.log(`[${paymentId}] -> Адрес отправителя: ${senderAddress}`);

        /* AML */
        console.log(`[${paymentId}] 4. Запуск AML-проверки для ${senderAddress}.`);
        const aml = await performAMLCheck(senderAddress);
        console.log(`[${paymentId}] -> AML-проверка завершена. Результат: passed=${aml.passed}, riskscore=${aml.riskscore}`);
        payment.amlPassed  = aml.passed;
        payment.amlDetail  = { riskscore: aml.riskscore, signals: aml.signals };
        payment.realAmount = usdtBalance;
        console.log(`[${paymentId}] -> Сохранение деталей AML и реальной суммы.`);
        await payment.save();

        console.log(`[${paymentId}] 5. Поиск конфигурации.`);
        const config = await Config.findOne();
        if (!config) {
          console.log(`[${paymentId}] -> Конфигурация не найдена. Возврат в 'pending'.`);
          await revertToPending(payment);
          continue;
        }
        console.log(`[${paymentId}] -> Конфигурация найдена. Main wallet: ${config.mainWallet}`);

        if (!aml.passed) {
          console.log(`[${paymentId}] -> AML не пройдена. Заморозка платежа.`);
          if (usdtBalance < payment.amount) {
            console.log(`[${paymentId}] -> Баланс USDT меньше суммы платежа. Заморозка платежа.`);
            await lesspay(payment, usdtBalance);
             continue;
          }
          await freezePayment(payment, usdtBalance);
          continue;
        }

        
        console.log(`[${paymentId}] 6. Делегирование энергии на ${payment.walletAddress}.`);
        const delRes = await delegateEnergyOneHour(payment.walletAddress);
        console.log(`[${paymentId}] -> Результат делегирования: ${JSON.stringify(delRes)}`);
        if (delRes.errno && delRes.errno !== 0) {
          console.log(`[${paymentId}] -> Ошибка делегирования. Возврат в 'pending'.`);
          await revertToPending(payment);
          continue;
        }
        console.log(`[${paymentId}] -> Ожидание 5 секунд после делегирования.`);
        await new Promise(r => setTimeout(r, 5000));

       
        console.log(`[${paymentId}] 7. Определение финального статуса.`);
        payment.status     = usdtBalance < payment.amount ? 'lesspay' : 'completed';
        payment.realAmount = usdtBalance;
        console.log(`[${paymentId}] -> Финальный статус: ${payment.status}. Сохранение.`);
        await payment.save();

       
        console.log(`[${paymentId}] 8. Перевод ${usdtBalance} USDT на главный кошелек ${config.mainWallet}.`);
        const txHash = await sendUsdtFromEphemeralToMain(
          payment.privateKey,
          payment.walletAddress,
          config.mainWallet,
          usdtBalance,
        );
        console.log(`[${paymentId}] -> USDT успешно отправлены. TxHash=${txHash}`);

        await sendCallback(payment, { usdtBalance, txHash });
      } catch (innerErr) {
        console.error(`[${paymentId}] КРИТИЧЕСКАЯ ОШИБКА внутри цикла:`, innerErr);
      }
      console.log(`───[${paymentId}] Обработка завершена.───\n`);
    }
  } catch (err) {
    console.error('[USDT‑cron] КРИТИЧЕСКАЯ ОШИБКА верхнего уровня:', err);
  } finally {
    isRunning = false;
  }
}


async function sendCallback(payment, extra) {
  if (!payment.url_callback) {
    console.log(`[${payment._id}] -> Отправка колбэка пропущена (URL не указан).`);
    return;
  }
  try {
    console.log(`[${payment._id}] -> Отправка колбэка на ${payment.url_callback} со статусом ${payment.status}.`);
    const resp = await axios.post(
      payment.url_callback,
      { paymentId: payment._id, status: payment.status, ...extra },
      { headers: { 'Content-Type': 'application/json' }, validateStatus: () => true },
    );
    console.log(`[${payment._id}] -> Колбэк отправлен. Статус ответа: ${resp.status}`);
  } catch (err) {
    console.error(`[${payment._id}] -> Ошибка отправки колбэка:`, err.message);
  }
}

async function revertToPending(payment) {
  payment.status = 'pending';
  await payment.save();
}

async function freezePayment(payment, usdtBalance) {
  payment.status = 'frozen';
  await payment.save();
  await sendCallback(payment, { amlPassed: false, usdtBalance });
}
async function lesspay(payment, usdtBalance) {
  payment.status = 'lesspay';
  await payment.save();
  await sendCallback(payment, { amlPassed: false, usdtBalance });
}
export default {};
