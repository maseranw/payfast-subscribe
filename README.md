# PayFast Subscription Integration (Node.js/Express)

This package provides a modular Express router to integrate with [PayFast](https://www.payfast.co.za/) for managing subscription payments, including:

- Submitting subscription payment forms to PayFast
- Handling ITN (Instant Transaction Notification) webhooks
- Cancelling active subscriptions via PayFast's API
- Callback hooks for custom payment and cancellation handling

## ✅ Features

- 🔐 Signature generation for secure PayFast communication
- 🔄 Subscription initiation and recurring billing setup
- 📬 ITN webhook handling with signature + source validation
- ❌ Cancel PayFast subscriptions with retry logic
- 📦 Clean, pluggable Express router with optional callbacks

## 📋 Requirements

- Node.js 14+
- Express 4+

## 📦 Installation

Install from npm:

```bash
npm install payfast-subscribe
```

Or from GitHub (if applicable):

```bash
npm install https://github.com/maseranw/payfast-subscribe.git
```

## ⚙️ Environment Setup

Create a `.env` file in your root directory:

```env
PAYFAST_MERCHANT_ID=your_merchant_id
PAYFAST_MERCHANT_KEY=your_merchant_key
PAYFAST_PASSPHRASE=your_passphrase
PAYFAST_API_VERSION=v1
PAYFAST_RETURN_URL=https://yourdomain.com/payment-success
PAYFAST_CANCEL_URL=https://yourdomain.com/payment-cancel
PAYFAST_NOTIFY_URL=https://yourdomain.com/api/payfast/notify
TESTING_MODE=true
```

## 🚀 Usage

In your Express server:

```js
const express = require("express");
const cors = require("cors");
const buildPayfastRouter = require("payfast-subscribe");

const app = express();

const handlePaymentUpdate = async (itnData) => {
  console.log("💰 Payment received:", itnData);
  // e.g., update database, activate subscription
};

const handleCancel = async ({ token, subscriptionId, status, payload }) => {
  console.log("❌ Cancel callback called:", {
    token,
    subscriptionId,
    status,
    payload,
  });
  // e.g., mark subscription as cancelled in your system
};

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/payfast", buildPayfastRouter(handlePaymentUpdate, handleCancel));

app.listen(6000, () => console.log("Server running on http://localhost:6000"));
```

## 🔌 Exposed Routes

| Method | Route | Description |
| --- | --- | --- |
| POST | `/api/payfast/initiate` | Generate PayFast payment data + URL |
| POST | `/api/payfast/notify` | Handle ITN (Instant Transaction Notification) |
| POST | `/api/payfast/cancel/:token/:subscriptionId` | Cancel an active PayFast subscription |

## 🧠 Callbacks

### `onPaymentUpdate(itnPayload)`

Triggered when a valid ITN notification is received from PayFast.

```js
const onPaymentUpdate = async (payload) => {
  // Called with parsed ITN data
};
```

### `onCancel({ token, subscriptionId, status, payload })`

Called after a cancellation attempt. Includes final result.

```js
const onCancel = async ({ token, subscriptionId, status, payload }) => {
  if (status !== 200) {
    console.error("Cancel failed:", payload);
  }
};
```

## 🛡️ Security

- Validates PayFast's signature on every ITN
- Verifies source IP matches PayFast domains
- Uses CSRF/session token for authenticated cancellation
- Retry logic for expired CSRF/session (e.g., HTTP 419)
- 👉 [PayFast Developer Docs](https://developers.payfast.co.za/docs)

## 🧪 Testing Tips

- Use PayFast Sandbox
- Set `TESTING_MODE=true` in `.env`
- Use tools like Postman or Insomnia to test `/initiate`, `/notify`, and `/cancel`

## ✅ TODO (Contributions welcome)

- Add support for once-off payments
- Add TypeScript types
- Support webhook retries & deduplication
- Integrate PayFast subscription query endpoint

## 👥 Maintainers

- [@ngelekanyo](https://github.com/maseranw) (author & maintainer)

## 🤝 Contributing

Contributions, suggestions, and issues welcome!  
Please open an issue or submit a pull request.

## 📄 License

This project is licensed under the MIT License.  
See the [LICENSE](./LICENSE) file for details.
