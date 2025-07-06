import express, { Router, Request, Response } from "express";
import payfastConfig from "../configs/config";
import {
  generateSignatureForInitiate,
  createITNPayload,
  pfValidSignature,
  validateITNWithPayfast,
  handleSubscriptionRoute,
} from "../utils/hepler-functions";
import { InitiateRequestBody, PaymentData } from "../types";

const buildPayfastRouter = (
  onPaymentUpdate: (payload: any) => Promise<void>,
  onCancel: (data: any) => Promise<void>,
  onPause: (data: any) => Promise<void>,
  onUnpause: (data: any) => Promise<void>,
  onFetch: (data: any) => Promise<void>
): Router => {
  const router: Router = express.Router();

  // Initiate payment
  router.post(
    "/initiate",
    (req: Request<{}, {}, InitiateRequestBody>, res: Response) => {
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

      const effectiveBillingDate =
        billing_date || new Date().toISOString().split("T")[0];
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

      const signature = generateSignatureForInitiate(
        paymentData,
        payfastConfig.passphrase
      );
      paymentData.signature = signature;

      const payfastUrl = payfastConfig.sandbox
        ? "https://sandbox.payfast.co.za/eng/process"
        : "https://www.payfast.co.za/eng/process";

      res.json({ paymentData, payfastUrl });
    }
  );

  // Notify 
  router.post(
    "/notify",
    express.urlencoded({ extended: false }),
    async (req: Request, res: Response) => {
      const itnPayload = createITNPayload(req.body);
      const pfData = { ...req.body };

      let pfParamString = "";
      Object.keys(pfData).forEach((key) => {
        if (key !== "signature") {
          pfParamString += `${key}=${encodeURIComponent(
            pfData[key].trim()
          ).replace(/%20/g, "+")}&`;
        }
      });
      pfParamString = pfParamString.slice(0, -1);

      const isValidSig = pfValidSignature(
        pfData,
        pfParamString,
        payfastConfig.passphrase
      );
      if (!isValidSig) return res.status(400).send("Invalid signature");

      const isValid = await validateITNWithPayfast(itnPayload);
      if (!isValid)
        return res.status(400).send("Validation with PayFast failed");

      try {
        await onPaymentUpdate(itnPayload);
      } catch (err) {
        console.error("Error in user callback:", err);
        return res.status(500).send("Callback failed");
      }

      res.status(200).send("OK");
    }
  );

  // Cancel with subscriptionId required
  router.post(
    "/cancel/:token/:subscriptionId",
    handleSubscriptionRoute("cancel", "PUT", onCancel, {
      requireSubscriptionId: true,
    })
  );

  // Cancel with token only
  router.post(
    "/cancel/:token",
    handleSubscriptionRoute("cancel", "PUT", onCancel)
  );

  // Pause Subscription
  router.post(
    "/pause/:token",
    handleSubscriptionRoute("pause", "PUT", onPause)
  );

  // Unpause Subscription
  router.post(
    "/unpause/:token",
    handleSubscriptionRoute("unpause", "PUT", onUnpause)
  );

  // Fetch Subscription
  router.get("/fetch/:token", handleSubscriptionRoute("fetch", "GET", onFetch));


  // TODO - Qyery Refund

  // TODO - Create Refund

  // TODO - Retrieve Refund

  return router;
};

export default buildPayfastRouter;
