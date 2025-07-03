// buildPayfastRouter.ts (Refactored with individual callbacks)
import express, { Router, Request, Response } from "express";
import payfastConfig from "./config";
import {
  generateSignatureForInitiate,
  createITNPayload,
  pfValidSignature,
  validateITNWithPayfast,
  generateApiSignature,
  fetchCsrfAndSession,
  attemptPayfastRequest,
  buildSignedHeaders,
  getCurrentIsoTimestamp,
} from "./utils";

interface PaymentData {
  [key: string]: string | number | boolean | undefined;
}

interface InitiateRequestBody {
  amount?: string;
  item_name?: string;
  item_description?: string;
  name_first?: string;
  name_last?: string;
  email_address?: string;
  m_payment_id?: string;
  subscription_type?: number;
  billing_date?: string;
  recurring_amount?: string;
  frequency?: number;
  cycles?: number;
  subscription_notify_email?: boolean;
  subscription_notify_webhook?: boolean;
  subscription_notify_buyer?: boolean;
}

const buildPayfastRouter = (
  onPaymentUpdate: (payload: any) => Promise<void>,
  onCancel: (data: any) => Promise<void>,
  onPause: (data: any) => Promise<void>,
  onUnpause: (data: any) => Promise<void>,
  onFetch: (data: any) => Promise<void>
): Router => {
  const router: Router = express.Router();

  router.post("/initiate", (req: Request<{}, {}, InitiateRequestBody>, res: Response) => {
    const {
      amount,
      item_name,
      item_description,
      name_first,
      name_last,
      email_address,
      m_payment_id,
      subscription_type,
      billing_date,
      recurring_amount,
      frequency,
      cycles,
      subscription_notify_email,
      subscription_notify_webhook,
      subscription_notify_buyer,
    } = req.body;

    if (!amount || !item_name || !m_payment_id) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const effectiveBillingDate = billing_date || new Date().toISOString().split("T")[0];
    const parsedAmount = parseFloat(amount).toFixed(2);
    const effectiveRecurringAmount = recurring_amount || parsedAmount;

    const paymentData: PaymentData = {
      merchant_id: payfastConfig.merchant_id || "",
      merchant_key: payfastConfig.merchant_key || "",
      return_url: payfastConfig.return_url,
      cancel_url: payfastConfig.cancel_url,
      notify_url: payfastConfig.notify_url,
      name_first: name_first || "",
      name_last: name_last || "",
      email_address: email_address || "",
      m_payment_id,
      amount: parsedAmount,
      item_name,
      item_description,
      subscription_type: subscription_type || 1,
      billing_date: effectiveBillingDate,
      recurring_amount: effectiveRecurringAmount,
      frequency: frequency || 3,
      cycles: cycles || 0,
      subscription_notify_email: subscription_notify_email ?? true,
      subscription_notify_webhook: subscription_notify_webhook ?? true,
      subscription_notify_buyer: subscription_notify_buyer ?? true,
    };

    const signature = generateSignatureForInitiate(paymentData, payfastConfig.passphrase);
    paymentData.signature = signature;

    const payfastUrl = payfastConfig.sandbox
      ? "https://sandbox.payfast.co.za/eng/process"
      : "https://www.payfast.co.za/eng/process";

    res.json({ paymentData, payfastUrl });
  });

  router.post("/notify", express.urlencoded({ extended: false }), async (req: Request, res: Response) => {
    const itnPayload = createITNPayload(req.body);
    const pfData = { ...req.body };

    let pfParamString = "";
    Object.keys(pfData).forEach((key) => {
      if (key !== "signature") {
        pfParamString += `${key}=${encodeURIComponent(pfData[key].trim()).replace(/%20/g, "+")}&`;
      }
    });
    pfParamString = pfParamString.slice(0, -1);

    const isValidSig = pfValidSignature(pfData, pfParamString, payfastConfig.passphrase);
    if (!isValidSig) return res.status(400).send("Invalid signature");

    const isValid = await validateITNWithPayfast(itnPayload);
    if (!isValid) return res.status(400).send("Validation with PayFast failed");

    try {
      await onPaymentUpdate(itnPayload);
    } catch (err) {
      console.error("Error in user callback:", err);
      return res.status(500).send("Callback failed");
    }

    res.status(200).send("OK");
  });

  const handleSubscriptionRoute = (
    action: "cancel" | "pause" | "unpause" | "fetch",
    method: "GET" | "PUT",
    callback: (data: any) => Promise<void>
  ) =>
    async (req: Request<{ token: string; subscriptionId?: string }>, res: Response) => {
      const { token, subscriptionId } = req.params;

      if (!token || (action === "cancel" && !subscriptionId)) {
        return res.status(400).json({ error: "Token and Subscription ID are required" });
      }

      try {
        const baseUrl = "https://api.payfast.co.za";
        const testingMode = process.env.TESTING_MODE || "false";
        const url = `${baseUrl}/subscriptions/${token}/${action}?testing=${testingMode}`;

        const headers = await buildSignedHeaders(payfastConfig.passphrase);

        const { csrfToken, sessionCookie } = await fetchCsrfAndSession(baseUrl);
        if (csrfToken) headers["X-CSRF-TOKEN"] = csrfToken;
        if (sessionCookie) headers["Cookie"] = sessionCookie;

        const result = await attemptPayfastRequest({
          method,
          url,
          headers,
          token,
          subscriptionId,
          callback,
        });

        return res.status(result.status).json(result.payload);
      } catch (error: any) {
        return res.status(500).json({
          error: "Internal server error",
          details: error.message,
        });
      }
    };

  router.post("/cancel/:token/:subscriptionId", handleSubscriptionRoute("cancel", "PUT", onCancel));
  router.post("/pause/:token", handleSubscriptionRoute("pause", "PUT", onPause));
  router.post("/unpause/:token", handleSubscriptionRoute("unpause", "PUT", onUnpause));
  router.get("/fetch/:token", handleSubscriptionRoute("fetch", "GET", onFetch));

  return router;
};

export default buildPayfastRouter;
