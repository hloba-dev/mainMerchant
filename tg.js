import 'dotenv/config';
import { Telegraf } from 'telegraf';

const TOKEN = process.env.BOT_TOKEN || '7980521505:AAEQPBAYoXGmoAZLt2nM0Kja722paffTeCQ';
const bot   = new Telegraf(TOKEN);

bot.start((ctx) => {
  const chatId = ctx.chat.id;
  const text   = `Ваш chat_id для уведомлений: ${chatId}\nСкопируйте и вставьте его в форму на сайте.`;
  ctx.reply(text);
  console.log(`Пользователь ${ctx.from.username || ''} получил chat_id: ${chatId}`);
});

bot.on('message', (ctx) => {
  console.log(`Получено сообщение от ${ctx.from.username || ''}: ${ctx.message.text}`);
});

bot.launch()
  .then(() => console.log('Bot started with Telegraf'))
  .catch(console.error);

process.once('SIGINT',  () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
