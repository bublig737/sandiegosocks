// bot.js
require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

const ITEMS = [
  { model: "Straight", size: "middle", label: "Straight 36–39", price: 10000 },
  { model: "Straight", size: "large", label: "Straight 40–43", price: 10000 },
  { model: "Railway", size: "middle", label: "Railway 36–39", price: 10000 },
  { model: "Railway", size: "large", label: "Railway 40–43", price: 10000 },
];

const sessions = {}; // userId -> { item, quantity, name, phone, city, np }

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  sessions[chatId] = {};
  bot.sendMessage(chatId, "Привіт! Обери модель шкарпеток:", {
    reply_markup: {
      keyboard: [["Straight"], ["Railway"]],
      one_time_keyboard: true,
    },
  });
});

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const session = sessions[chatId] || {};
  const text = msg.text;

  if (!session.model && ["Straight", "Railway"].includes(text)) {
    session.model = text;
    bot.sendMessage(chatId, "Окей, тепер обери розмір:", {
      reply_markup: {
        keyboard: [["middle (36–39)"], ["large (40–43)"]],
        one_time_keyboard: true,
      },
    });
  } else if (!session.size && text.includes("(")) {
    session.size = text.includes("middle") ? "middle" : "large";
    bot.sendMessage(chatId, "Скільки пар? (напиши число)");
  } else if (!session.quantity && /^\d+$/.test(text)) {
    session.quantity = parseInt(text);
    bot.sendMessage(chatId, "Як тебе звати?");
  } else if (!session.name) {
    session.name = text;
    bot.sendMessage(chatId, "Твій номер телефону?");
  } else if (!session.phone) {
    session.phone = text;
    bot.sendMessage(chatId, "Місто доставки?");
  } else if (!session.city) {
    session.city = text;
    bot.sendMessage(chatId, "Номер відділення Нової Пошти?");
  } else if (!session.np) {
    session.np = text;

    // формуємо оплату
    const item = ITEMS.find(
      (i) => i.model === session.model && i.size === session.size
    );
    const total = item.price * session.quantity;
    const label = `${item.label} x${session.quantity}`;

    bot.sendInvoice(chatId, {
      title: "San Diego Socks",
      description: label,
      payload: "order_payload",
      provider_token: process.env.SMARTGLOCAL_TOKEN, // заменено с BILLLINE_TOKEN
      currency: "UAH",
      prices: [{ label, amount: total }],
      start_parameter: "order-socks",
    });
  }
});

bot.on("pre_checkout_query", (query) => {
  bot.answerPreCheckoutQuery(query.id, true);
});

bot.on("successful_payment", (msg) => {
  const chatId = msg.chat.id;
  const s = sessions[chatId];
  const summary = `✅ Замовлення підтверджено!

Модель: ${s.model}
Розмір: ${s.size}
Кількість: ${s.quantity}
Ім'я: ${s.name}
Тел: ${s.phone}
Місто: ${s.city}
НП: ${s.np}
Сума: ${msg.successful_payment.total_amount / 100} грн`;

  bot.sendMessage(chatId, summary);
});