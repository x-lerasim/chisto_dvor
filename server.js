require('dotenv').config();

const express = require('express');
const axios = require('axios');
const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// In-memory хранилище заказов (для продакшн — замените на БД)
const orders = new Map();

const YOOKASSA_API = 'https://api.yookassa.ru/v3';
const PLAN_PRICE = '2600.00';
const PLAN_NAME = 'Подписка ЧистоДвор — вывоз мусора (1 месяц)';
const DEMO_MODE = process.env.DEMO_MODE === 'true';

// ─── Генерация номера заказа ──────────────────────────────────────────────────
function generateOrderId() {
  const year = new Date().getFullYear();
  const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `ЧД-${year}-${rand}`;
}

// ─── Создание платежа в ЮКасса ───────────────────────────────────────────────
async function createYookassaPayment(orderData, orderId) {
  const idempotencyKey = uuidv4();

  const payload = {
    amount: { value: PLAN_PRICE, currency: 'RUB' },
    confirmation: {
      type: 'redirect',
      return_url: `${process.env.BASE_URL}/success.html?order=${encodeURIComponent(orderId)}`,
    },
    capture: true,
    description: `${PLAN_NAME} — ${orderData.name}`,
    metadata: { order_id: orderId },
    receipt: {
      customer: {
        email: orderData.email,
        phone: orderData.phone.replace(/\D/g, ''),
      },
      items: [
        {
          description: PLAN_NAME,
          quantity: '1.00',
          amount: { value: PLAN_PRICE, currency: 'RUB' },
          vat_code: 1,
          payment_mode: 'full_prepayment',
          payment_subject: 'service',
        },
      ],
    },
  };

  const response = await axios.post(`${YOOKASSA_API}/payments`, payload, {
    auth: {
      username: process.env.YOOKASSA_SHOP_ID,
      password: process.env.YOOKASSA_SECRET_KEY,
    },
    headers: {
      'Idempotence-Key': idempotencyKey,
      'Content-Type': 'application/json',
    },
  });

  return response.data;
}

// ─── Отправка email компании ──────────────────────────────────────────────────
async function sendOrderEmail(order, paymentInfo) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const paidAt = new Date(order.paidAt || Date.now()).toLocaleString('ru-RU', {
    timeZone: 'Europe/Moscow',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const html = `
<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<style>
  body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
  .wrapper { max-width: 620px; margin: 0 auto; background: #fff; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,.12); }
  .header { background: #1a1a2e; padding: 28px 32px; }
  .header h1 { color: #2ecc40; margin: 0; font-size: 22px; }
  .header p { color: #ccc; margin: 6px 0 0; font-size: 14px; }
  .body { padding: 28px 32px; }
  .badge { display: inline-block; background: #e8fbe8; color: #1a7a1a; border: 1px solid #2ecc40; border-radius: 20px; padding: 4px 14px; font-size: 13px; font-weight: 700; margin-bottom: 20px; }
  .section-title { font-size: 13px; font-weight: 700; color: #888; text-transform: uppercase; letter-spacing: .5px; margin: 22px 0 10px; }
  table.info { width: 100%; border-collapse: collapse; }
  table.info td { padding: 9px 0; border-bottom: 1px solid #f0f0f0; font-size: 14px; color: #333; }
  table.info td:first-child { color: #888; width: 45%; }
  .plan-box { background: #f8fffe; border: 1px solid #c8f0c8; border-radius: 8px; padding: 16px 20px; margin-top: 10px; }
  .plan-box .price { font-size: 26px; font-weight: 800; color: #1a1a2e; }
  .plan-box .price span { font-size: 15px; font-weight: 400; color: #666; }
  .plan-box ul { margin: 10px 0 0; padding: 0 0 0 18px; color: #444; font-size: 14px; line-height: 1.8; }
  .footer { background: #f5f5f5; padding: 18px 32px; font-size: 12px; color: #999; border-top: 1px solid #eee; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="header">
    <h1>🗑️ ЧистоДвор</h1>
    <p>Новый заказ на подписку</p>
  </div>
  <div class="body">
    <div class="badge">✅ Оплата подтверждена</div>

    <div class="section-title">Заказ</div>
    <table class="info">
      <tr><td>Номер заказа</td><td><strong>#${order.orderId}</strong></td></tr>
      <tr><td>Дата и время</td><td>${paidAt} (МСК)</td></tr>
      <tr><td>Статус платежа</td><td><span style="color:#1a7a1a;font-weight:700;">Оплачен</span></td></tr>
      <tr><td>ID транзакции</td><td style="font-family:monospace;font-size:13px;">${paymentInfo?.id || '—'}</td></tr>
      <tr><td>Сумма</td><td><strong>2 600 ₽</strong></td></tr>
    </table>

    <div class="section-title">Покупатель</div>
    <table class="info">
      <tr><td>ФИО</td><td><strong>${order.name}</strong></td></tr>
      <tr><td>Телефон</td><td>${order.phone}</td></tr>
      <tr><td>Email</td><td>${order.email}</td></tr>
      ${order.telegram ? `<tr><td>Telegram</td><td>${order.telegram}</td></tr>` : ''}
    </table>

    <div class="section-title">Адрес обслуживания</div>
    <table class="info">
      <tr><td>Улица и дом</td><td>${order.street}</td></tr>
      <tr><td>Город</td><td>${order.city}</td></tr>
      <tr><td>Регион</td><td>${order.region}</td></tr>
      <tr><td>Почтовый индекс</td><td>${order.postal}</td></tr>
    </table>

    ${order.pickupDays ? `
    <div class="section-title">Дни вывоза</div>
    <table class="info">
      <tr><td>Предпочтительные дни</td><td>${order.pickupDays}</td></tr>
    </table>` : ''}

    ${order.comment ? `
    <div class="section-title">Комментарий клиента</div>
    <table class="info">
      <tr><td colspan="2" style="color:#333;">${order.comment.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td></tr>
    </table>` : ''}

    <div class="section-title">Тариф</div>
    <div class="plan-box">
      <div class="price">2 600 ₽ <span>/ месяц</span></div>
      <ul>
        <li>Вывоз мусора от частного дома</li>
        <li>8 вывозов в месяц, 2 раза в неделю</li>
        <li>Бесплатные мешки 120 л</li>
        <li>Официальный договор и гарантии</li>
      </ul>
    </div>
  </div>
  <div class="footer">
    Это автоматическое уведомление от сайта ЧистоДвор. Свяжитесь с клиентом в течение 24 часов.
  </div>
</div>
</body>
</html>`;

  await transporter.sendMail({
    from: `"ЧистоДвор Заказы" <${process.env.SMTP_USER}>`,
    to: process.env.COMPANY_EMAIL,
    subject: `🗑️ Новый заказ #${order.orderId} — ${order.name} (2 600 ₽)`,
    html,
  });
}

// ─── Отправка email клиенту ───────────────────────────────────────────────────
async function sendCustomerEmail(order) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const html = `
<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<style>
  body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
  .wrapper { max-width: 560px; margin: 0 auto; background: #fff; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,.12); }
  .header { background: #1a1a2e; padding: 32px; text-align: center; }
  .header h1 { color: #2ecc40; margin: 0 0 8px; font-size: 24px; }
  .header p { color: #bbb; margin: 0; font-size: 14px; }
  .body { padding: 32px; }
  .checkmark { text-align: center; font-size: 56px; margin-bottom: 16px; }
  .title { text-align: center; font-size: 22px; font-weight: 800; color: #1a1a2e; margin-bottom: 8px; }
  .subtitle { text-align: center; color: #666; font-size: 15px; margin-bottom: 28px; }
  .order-num { text-align: center; background: #f0fdf0; border: 1px dashed #2ecc40; border-radius: 8px; padding: 12px; font-size: 18px; font-weight: 700; color: #1a1a2e; margin-bottom: 24px; }
  .steps { background: #fafafa; border-radius: 8px; padding: 20px 24px; }
  .steps h3 { margin: 0 0 14px; font-size: 14px; color: #888; text-transform: uppercase; letter-spacing: .5px; }
  .step { display: flex; gap: 12px; align-items: flex-start; margin-bottom: 12px; font-size: 14px; color: #333; }
  .step-num { background: #2ecc40; color: #fff; width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; flex-shrink: 0; }
  .contact { margin-top: 24px; text-align: center; font-size: 14px; color: #555; }
  .contact a { color: #2ecc40; text-decoration: none; }
  .footer { background: #f5f5f5; padding: 16px 32px; text-align: center; font-size: 12px; color: #aaa; border-top: 1px solid #eee; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="header">
    <h1>🗑️ ЧистоДвор</h1>
    <p>Чистый двор — просто и без хлопот</p>
  </div>
  <div class="body">
    <div class="checkmark">✅</div>
    <div class="title">Оплата прошла успешно!</div>
    <div class="subtitle">Спасибо, ${order.name.split(' ')[0]}! Ваша подписка оформлена.</div>
    <div class="order-num">Номер заказа: #${order.orderId}</div>

    <div class="steps">
      <h3>Что дальше?</h3>
      <div class="step"><div class="step-num">1</div><div>Наш менеджер свяжется с вами в течение 24 часов для согласования расписания</div></div>
      <div class="step"><div class="step-num">2</div><div>Мы доставим бесплатные мешки 120 л по адресу: ${order.street}, ${order.city}</div></div>
      <div class="step"><div class="step-num">3</div><div>В дни вывоза оставляйте наполненные мешки у ворот — мы сделаем всё остальное</div></div>
    </div>

    <div class="contact">
      Вопросы? Пишите: <a href="mailto:${process.env.COMPANY_EMAIL}">${process.env.COMPANY_EMAIL}</a>
    </div>
  </div>
  <div class="footer">© 2024 ЧистоДвор, Казань. Сохраните это письмо как подтверждение заказа.</div>
</div>
</body>
</html>`;

  await transporter.sendMail({
    from: `"ЧистоДвор" <${process.env.SMTP_USER}>`,
    to: order.email,
    subject: `✅ Заказ #${order.orderId} оформлен — ЧистоДвор`,
    html,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// МАРШРУТЫ API
// ═══════════════════════════════════════════════════════════════════════════════

// Создание платежа
app.post('/api/create-payment', async (req, res) => {
  const { name, phone, email, street, city, region, postal, telegram, comment, pickupDays } = req.body;

  // Валидация обязательных полей
  const required = { name, phone, email, street, city, region, postal };
  for (const [field, value] of Object.entries(required)) {
    if (!value || !value.toString().trim()) {
      return res.status(400).json({ error: `Поле "${field}" обязательно для заполнения` });
    }
  }

  // Базовая валидация email
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Некорректный email адрес' });
  }

  const orderId = generateOrderId();
  const orderData = {
    orderId,
    name: name.trim(),
    phone: phone.trim(),
    email: email.trim().toLowerCase(),
    street: street.trim(),
    city: city.trim(),
    region: region.trim(),
    postal: postal.trim(),
    telegram: telegram?.trim() || '',
    comment: comment?.trim() || '',
    pickupDays: pickupDays?.trim() || '',
    createdAt: new Date().toISOString(),
    status: 'pending',
  };

  orders.set(orderId, orderData);

  // DEMO режим — симуляция успешного платежа
  if (DEMO_MODE) {
    console.log('[DEMO] Заказ создан:', orderId);
    return res.json({
      orderId,
      confirmationUrl: `/success.html?order=${encodeURIComponent(orderId)}&demo=true`,
    });
  }

  try {
    const payment = await createYookassaPayment(orderData, orderId);
    orderData.paymentId = payment.id;
    orders.set(orderId, orderData);

    res.json({
      orderId,
      confirmationUrl: payment.confirmation.confirmation_url,
    });
  } catch (err) {
    console.error('[YooKassa] Ошибка создания платежа:', err.response?.data || err.message);
    orders.delete(orderId);
    res.status(502).json({ error: 'Ошибка платёжного сервиса. Попробуйте ещё раз через несколько секунд.' });
  }
});

// Вебхук от ЮКасса
app.post('/api/webhook', async (req, res) => {
  res.status(200).send('OK'); // Отвечаем сразу, чтобы ЮКасса не ретраила

  const event = req.body;
  if (event?.event !== 'payment.succeeded') return;

  const paymentId = event.object?.id;
  const orderId = event.object?.metadata?.order_id;

  if (!orderId || !orders.has(orderId)) {
    console.warn('[Webhook] Неизвестный order_id:', orderId);
    return;
  }

  const order = orders.get(orderId);
  if (order.status === 'paid') return; // Уже обработан

  try {
    // Верификация: перезапрашиваем платёж у ЮКасса
    const { data: payment } = await axios.get(`${YOOKASSA_API}/payments/${paymentId}`, {
      auth: {
        username: process.env.YOOKASSA_SHOP_ID,
        password: process.env.YOOKASSA_SECRET_KEY,
      },
    });

    if (payment.status !== 'succeeded') return;

    order.status = 'paid';
    order.paymentId = paymentId;
    order.paidAt = payment.captured_at || new Date().toISOString();
    orders.set(orderId, order);

    console.log(`[Webhook] Оплачен заказ #${orderId}`);

    // Отправляем письма параллельно
    await Promise.allSettled([
      sendOrderEmail(order, payment),
      sendCustomerEmail(order),
    ]);
  } catch (err) {
    console.error('[Webhook] Ошибка обработки:', err.message);
  }
});

// Эмуляция успешного платежа (только DEMO_MODE)
app.post('/api/demo-complete', async (req, res) => {
  if (!DEMO_MODE) return res.status(403).json({ error: 'Только в демо-режиме' });

  const { orderId } = req.body;
  if (!orderId || !orders.has(orderId)) {
    return res.status(404).json({ error: 'Заказ не найден' });
  }

  const order = orders.get(orderId);
  order.status = 'paid';
  order.paidAt = new Date().toISOString();
  orders.set(orderId, order);

  try {
    await Promise.allSettled([
      sendOrderEmail(order, { id: 'DEMO-' + uuidv4().substring(0, 8).toUpperCase() }),
      sendCustomerEmail(order),
    ]);
  } catch (err) {
    console.error('[Demo] Email ошибка:', err.message);
  }

  res.json({ success: true });
});

// Получение данных заказа (для страницы успеха)
app.get('/api/order/:orderId', (req, res) => {
  const order = orders.get(req.params.orderId);
  if (!order) return res.status(404).json({ error: 'Заказ не найден' });

  // Не отдаём чувствительные данные
  res.json({
    orderId: order.orderId,
    name: order.name,
    email: order.email,
    city: order.city,
    status: order.status,
    createdAt: order.createdAt,
    paidAt: order.paidAt || null,
  });
});

// Проверка статуса платежа (polling со страницы успеха)
app.get('/api/payment-status/:orderId', async (req, res) => {
  const order = orders.get(req.params.orderId);
  if (!order) return res.status(404).json({ error: 'Заказ не найден' });

  if (order.status === 'paid') {
    return res.json({ status: 'paid', orderId: order.orderId, name: order.name });
  }

  if (DEMO_MODE) {
    return res.json({ status: order.status, orderId: order.orderId, name: order.name });
  }

  // Если есть paymentId — проверяем у ЮКасса
  if (order.paymentId) {
    try {
      const { data: payment } = await axios.get(`${YOOKASSA_API}/payments/${order.paymentId}`, {
        auth: {
          username: process.env.YOOKASSA_SHOP_ID,
          password: process.env.YOOKASSA_SECRET_KEY,
        },
      });

      if (payment.status === 'succeeded' && order.status !== 'paid') {
        order.status = 'paid';
        order.paidAt = payment.captured_at || new Date().toISOString();
        orders.set(order.orderId, order);
        await Promise.allSettled([
          sendOrderEmail(order, payment),
          sendCustomerEmail(order),
        ]);
      }

      return res.json({ status: payment.status, orderId: order.orderId, name: order.name });
    } catch (err) {
      console.error('[Status] Ошибка проверки:', err.message);
    }
  }

  res.json({ status: order.status, orderId: order.orderId, name: order.name });
});

// ─── Запуск сервера ───────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('');
  console.log('  🗑️  ЧистоДвор — сервер запущен');
  console.log(`  🌐  http://localhost:${PORT}`);
  console.log(`  📋  Режим: ${DEMO_MODE ? 'ДЕМО (без реальных платежей)' : 'ПРОДАКШН'}`);
  console.log('');
});
