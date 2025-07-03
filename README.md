
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
npm install @ngelekanyo/payfast-subscribe
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
const buildPayfastRouter = require("@ngelekanyo/payfast-subscribe");

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

const handlePause = async ({ token, status, payload }) => {
  console.log("⏸️ Pause callback called:", {
    token,
    status,
    payload,
  });
  // e.g., mark subscription as paused in your system
};

const handleUnpause = async ({ token, status, payload }) => {
  console.log("▶️ Unpause callback called:", {
    token,
    status,
    payload,
  });
  // e.g., resume subscription in your system
};

const handleFetch = async ({ token, status, payload }) => {
  console.log("📄 Fetch callback called:", {
    token,
    status,
    payload,
  });
  // e.g., update subscription status from fetch data
};

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  "/api/payfast",
  buildPayfastRouter(
    handlePaymentUpdate,
    handleCancel,
    handlePause,
    handleUnpause,
    handleFetch
  )
);

app.listen(6000, () => console.log("Server running on http://localhost:6000"));
```

# 🔗 PayFast Integration with External Backend

This section demonstrates how to integrate your `@ngelekanyo/payfast-subscribe` backend with a client-side or external application using a `PayFastService` class.

> ⚙️ This example assumes your backend is running at `http://localhost:6000` or a configured `VITE_BACKEND_URL`.

You can copy the code below into a file (e.g., `payfast-service.ts`) and use it in your project.

---

### 🟦 TypeScript Example

```ts
// PayFast integration with external backend
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:6000";

export interface PaymentData {
  amount: string;
  item_name: string;
  item_description?: string;
  name_first?: string;
  name_last?: string;
  email_address?: string;
  m_payment_id: string;
}

export interface PayFastResponse {
  paymentData: Record<string, string>;
  payfastUrl: string;
}

export class PayFastService {
  static async initiatePayment(data: PaymentData): Promise<PayFastResponse> {
    console.log("[PayFastService] Initiating payment with data:", data);

    try {
      const response = await fetch(`${BACKEND_URL}/api/payfast/initiate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error("[PayFastService] Error response:", error);
        throw new Error(error.error || "Failed to initiate payment");
      }

      const responseData = await response.json();
      return responseData;
    } catch (err) {
      console.error("[PayFastService] Failed to initiate payment:", err);
      throw err;
    }
  }

  static async cancelSubscription(
    token: string,
    subscriptionId: string
  ): Promise<void> {
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/payfast/cancel/${token}/${subscriptionId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        console.error("[PayFastService] Cancel error response:", error);
        throw new Error(error.error || "Failed to cancel subscription");
      }

      const responseData = await response.json();
      console.log(
        "[PayFastService] Subscription cancelled successfully:",
        responseData
      );
    } catch (err) {
      console.error("[PayFastService] Failed to cancel subscription:", err);
      throw err;
    }
  }

  static createPaymentForm(
    paymentData: Record<string, string>,
    actionUrl: string
  ): HTMLFormElement {
    const form = document.createElement("form");
    form.method = "POST";
    form.action = actionUrl;
    form.style.display = "none";

    Object.entries(paymentData).forEach(([key, value]) => {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = key;
      input.value = value;
      form.appendChild(input);
    });

    return form;
  }

  static submitPayment(
    paymentData: Record<string, string>,
    actionUrl: string
  ): void {
    const form = this.createPaymentForm(paymentData, actionUrl);
    document.body.appendChild(form);
    form.submit();
  }
}
```

---

### 🚀 Usage Example

```ts
const paymentData: PaymentData = {
  amount: "100.00",
  item_name: "Monthly Subscription",
  m_payment_id: "SUB12345",
};

PayFastService.initiatePayment(paymentData)
  .then((response) => {
    console.log("Redirecting to PayFast:", response.payfastUrl);
    PayFastService.submitPayment(response.paymentData, response.payfastUrl);
  })
  .catch((err) => console.error("Payment initiation failed:", err));

// Cancel a subscription
PayFastService.cancelSubscription("token123", "SUB12345").catch((err) =>
  console.error("Cancel failed:", err)
);
```

## 🔌 Exposed Routes

| Method | Route                                        | Description                                   |
| ------ | -------------------------------------------- | --------------------------------------------- |
| POST   | `/api/payfast/initiate`                      | Generate PayFast payment data + URL           |
| POST   | `/api/payfast/notify`                        | Handle ITN (Instant Transaction Notification) |
| POST   | `/api/payfast/cancel/:token/:subscriptionId` | Cancel an active PayFast subscription         |
| POST   | `/api/payfast/cancel/:token`                 | Cancel an active PayFast subscription         |
| POST   | `/api/payfast/pause/:token`                  | Pause an active subscription                   |
| POST   | `/api/payfast/unpause/:token`                | Unpause a paused subscription                  |
| GET    | `/api/payfast/fetch/:token`                   | Fetch subscription details                      |

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

### `onPause({ token, status, payload })`

Called after a pause attempt.

```js
const onPause = async ({ token, status, payload }) => {
  if (status !== 200) {
    console.error("Pause failed:", payload);
  }
};
```

### `onUnpause({ token, status, payload })`

Called after an unpause attempt.

```js
const onUnpause = async ({ token, status, payload }) => {
  if (status !== 200) {
    console.error("Unpause failed:", payload);
  }
};
```

### `onFetch({ token, status, payload })`

Called after fetching subscription details.

```js
const onFetch = async ({ token, status, payload }) => {
  if (status !== 200) {
    console.error("Fetch failed:", payload);
  }
};
```

## 📌 Subscription ID Explanation

The `subscriptionId` parameter in the `cancelSubscription` method refers to a unique identifier for a subscription record in **your application’s database** (e.g., a `subscriptions` table).

This ID is typically generated by your backend when a subscription is created, and is stored **alongside the PayFast `payfast_token`**.

### 🧠 Context

If you use a service like **Supabase** to manage subscriptions, `subscriptionId` could simply be the `id` column of your `subscriptions` table — uniquely identifying each user’s subscription.

### ✅ Usage

When calling `PayFastService.cancelSubscription`, pass:

- the **`payfast_token`** (provided by PayFast), and
- your **local `subscriptionId`**  
  to ensure the correct subscription is cancelled **both** on PayFast and in your own system.

---

## 🔧 Example Implementation (React + Supabase)

```ts
const handleCancelSubscription = async () => {
  if (!subscription || !subscription.payfast_token) {
    toast.error("Cannot cancel subscription: missing PayFast token");
    return;
  }

  setActionLoading(true);
  try {
    // Cancel via PayFast API through backend
    await PayFastService.cancelSubscription(
      subscription.payfast_token,
      subscription.id
    );

    // Mark subscription to cancel at end of period in local DB
    const { error } = await supabase
      .from("subscriptions")
      .update({
        cancel_at_period_end: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", subscription.id)
      .eq("user_id", user!.id);

    if (error) throw error;
    toast.success("Subscription scheduled for cancellation at period end");
  } catch (err) {
    toast.error("Failed to cancel subscription");
    console.error("Cancel error:", err);
  } finally {
    setActionLoading(false);
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
- Use tools like Postman or Insomnia to test `/initiate`, `/notify`, `/cancel`

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
