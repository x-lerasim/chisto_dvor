# ЧистоДвор

Сайт сервиса по вывозу мусора из частных домов в Казани и пригороде.

## Стек

- HTML/CSS/JS (без фреймворков)
- Node.js + Express (backend)
- ЮКасса (платежи)
- Nodemailer (email-уведомления)

## Запуск локально

```bash
npm install
cp .env.example .env   # заполнить своими данными
node server.js
```

Сайт: `http://localhost:3000`

## Переменные окружения

| Переменная | Описание |
|---|---|
| `YOOKASSA_SHOP_ID` | ID магазина ЮКасса |
| `YOOKASSA_SECRET_KEY` | Секретный ключ ЮКасса |
| `COMPANY_EMAIL` | Email для получения заказов |
| `SMTP_HOST` | SMTP-сервер (smtp.gmail.com) |
| `SMTP_PORT` | Порт (587) |
| `SMTP_USER` | Email отправителя |
| `SMTP_PASS` | Пароль приложения |
| `BASE_URL` | URL сайта |
| `DEMO_MODE` | `true` — без реальных платежей |

## Структура

```
index.html      — лендинг
checkout.html   — форма оформления заказа
success.html    — страница после оплаты
server.js       — backend (API, платежи, email)
```
