# ЧистоДвор

Сайт сервиса по вывозу мусора из частных домов в Казани и пригороде.

## Две версии сайта

### index.html — Основной лендинг (полная версия)

Полноценная страница для работающего сервиса. Содержит подробное описание услуги, тарифы, фотографии, отзывы, FAQ и форму обратной связи. Кнопки "Подключиться" ведут на `checkout.html` для оформления заказа с оплатой через ЮКасса.

**Когда использовать:** когда сервис уже запущен и принимает оплату.

### index-lite.html — Лендинг предзаказа (lite-версия)

Компактная страница для сбора предзаказов до запуска сервиса. Форма предзаказа встроена прямо в первый экран (hero). Клиент заполняет ФИО, телефон, город, адрес и выбирает предпочтительный способ связи (WhatsApp, Telegram или MAX). Оплата не требуется.

**Когда использовать:** до запуска сервиса, для сбора базы первых клиентов.

**Что получает владелец:** email-уведомление на `COMPANY_EMAIL` с данными клиента и выбранным мессенджером.

## Стек

- HTML / CSS / JS (без фреймворков)
- Node.js + Express (backend)
- ЮКасса (платежи, только для полной версии)
- Nodemailer (email-уведомления)

## Запуск

```bash
npm install
cp .env.example .env   # заполнить своими данными
node server.js
```

Сервер запустится на `http://localhost:3000`.

- Основной сайт: `http://localhost:3000/index.html`
- Предзаказ: `http://localhost:3000/index-lite.html`

## Настройка email-уведомлений

Чтобы заявки приходили на почту, заполните в `.env`:

```
COMPANY_EMAIL=ваш_email@gmail.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=ваш_email@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx
```

**Как получить SMTP_PASS для Gmail:**

1. Откройте https://myaccount.google.com/security
2. Включите двухфакторную аутентификацию
3. Перейдите в "Пароли приложений" (https://myaccount.google.com/apppasswords)
4. Создайте пароль для "Почта" и вставьте 16-символьный код в `SMTP_PASS`

## Все переменные окружения

| Переменная | Описание | Нужна для |
|---|---|---|
| `COMPANY_EMAIL` | Email для получения заявок/заказов | index + index-lite |
| `SMTP_HOST` | SMTP-сервер (smtp.gmail.com) | index + index-lite |
| `SMTP_PORT` | Порт (587) | index + index-lite |
| `SMTP_SECURE` | SSL (false для порта 587) | index + index-lite |
| `SMTP_USER` | Email отправителя | index + index-lite |
| `SMTP_PASS` | Пароль приложения Gmail | index + index-lite |
| `YOOKASSA_SHOP_ID` | ID магазина ЮКасса | только index |
| `YOOKASSA_SECRET_KEY` | Секретный ключ ЮКасса | только index |
| `BASE_URL` | URL сайта (для редиректа после оплаты) | только index |
| `DEMO_MODE` | `true` — без реальных платежей | только index |
| `PORT` | Порт сервера (по умолчанию 3000) | оба |

## Структура файлов

```
index.html       — основной лендинг (полная версия с оплатой)
index-lite.html  — лендинг предзаказа (без оплаты)
checkout.html    — форма оформления заказа с оплатой
success.html     — страница после успешной оплаты
server.js        — backend: API, платежи ЮКасса, email
.env.example     — шаблон переменных окружения
```

## API-эндпоинты

| Метод | URL | Описание |
|---|---|---|
| `POST` | `/api/create-lead` | Создание предзаказа (index-lite) |
| `POST` | `/api/create-payment` | Создание платежа через ЮКасса (index) |
| `POST` | `/api/webhook` | Вебхук от ЮКасса |
| `GET` | `/api/order/:id` | Данные заказа |
| `GET` | `/api/payment-status/:id` | Статус платежа |
