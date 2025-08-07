import 'dotenv/config';
import cron from 'node-cron';
import connectDB from './lib/db.js';
import Payment from './models/Payment.js';
import { tronWeb, transferFunds } from './utils/tronHelpers.js';

(async () => {
  try {
    await connectDB();
    console.log('[TRX-Collector] MongoDB подключен.');
    
    
    cron.schedule('0 8 * * *', collectTrxRemainders);
    console.log('[TRX-Collector] Задача запланирована для ежедневного выполнения в 8:00 (по времени сервера).');

   
    console.log('[TRX-Collector] Выполнение первого запуска при старте...');
    collectTrxRemainders();
    
  } catch (err) {
    console.error('[TRX-Collector] Ошибка подключения к БД:', err);
    process.exit(1);
  }
})();

let isRunning = false;

async function collectTrxRemainders() {
  if (isRunning) {
    console.log('[TRX-Collector] Предыдущий запуск еще выполняется. Пропускаем.');
    return;
  }
  isRunning = true;
  console.log(`\n[TRX-Collector] Запуск задачи в ${new Date().toLocaleString()}`);

  try {
    
    console.log('[TRX-Collector] Шаг 1: Поиск вчерашних USDT-платежей с остатком TRX...');
    const addressesToProcess = [];
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59);

    const payments = await Payment.find({
      currency: 'USDT',
      createdAt: { $gte: start, $lte: end },
    }).sort({ createdAt: 1 });

    console.log(`[TRX-Collector] Найдено ${payments.length} USDT-платежей за вчера. Проверка балансов...`);

    for (const pay of payments) {
      try {
        const balanceSun = await tronWeb.trx.getBalance(pay.walletAddress);
        const balanceTRX = balanceSun / 1e6;
        await new Promise((r) => setTimeout(r, 1000)); 

        if (balanceTRX >= 1) { 
          addressesToProcess.push({
            paymentId: pay._id.toString(),
            address: pay.walletAddress,
            privateKey: pay.privateKey,
            balance: balanceTRX,
          });
          console.log(`[TRX-Collector] -> Найден ${balanceTRX} TRX на кошельке ${pay.walletAddress} (PaymentID: ${pay._id})`);
        }
      } catch (balanceError) {
         console.error(`[TRX-Collector] Ошибка проверки баланса для ${pay.walletAddress}:`, balanceError.message);
      }
    }

    if (addressesToProcess.length === 0) {
        console.log('[TRX-Collector] Кошельков со значительным остатком TRX не найдено. Задача завершена.');
        isRunning = false;
        return;
    }

    console.log(`[TRX-Collector] Шаг 2: Перевод TRX с ${addressesToProcess.length} кошельков.`);

    
    const mainWallet = process.env.MAIN_WALLETTOTRX;
    if (!mainWallet) {
      throw new Error('MAIN_WALLETTOTRX не установлен в .env!');
    }
    console.log(`[TRX-Collector] Главный кошелек для сбора: ${mainWallet}`);

    const transferResults = [];
    for (const item of addressesToProcess) {
      try {
        console.log(`[TRX-Collector] -> Перевод ${item.balance} TRX с ${item.address}...`);
        const receipt = await transferFunds(
          { walletAddress: item.address, privateKey: item.privateKey },
          mainWallet,
          item.balance
        );
        await new Promise((r) => setTimeout(r, 1000)); 
        const status = `Успешно, txId=${receipt?.txid || '?'}`;
        transferResults.push({ ...item, status });
        console.log(`[TRX-Collector] -> ${status}`);
      } catch (transferErr) {
        const status = `Ошибка: ${transferErr.message}`;
        transferResults.push({ ...item, status });
        console.error(`[TRX-Collector] -> ${status}`);
      }
    }

    console.log('\\n[TRX-Collector] --- Отчет о переводах ---');
    console.table(transferResults.map(r => ({ address: r.address, balance: r.balance, status: r.status })));
    console.log('[TRX-Collector] --- Задача завершена ---');

  } catch (e) {
    console.error('[TRX-Collector] Возникла критическая ошибка:', e);
  } finally {
    isRunning = false;
  }
} 