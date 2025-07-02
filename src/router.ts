import express, { Router, Request, Response } from "express";
import payfastConfig from "./config";
import {
  generateSignatureForInitiate,
  createITNPayload,
  pfValidSignature,
  validateITNWithPayfast,
  generateApiSignature,
  fetchCsrfAndSession,
  attemptPayfastCancel,
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
}

interface CancelParams {
  token: string;
  subscriptionId: string;
}

const buildPayfastRouter = (
  onPaymentUpdate: (payload: any) => Promise<void>,
  onCancel: (data: any) => Promise<void>
): Router => {
  const router: Router = express.Router();

  // === Initiate Subscription Payment ===
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
      } = req.body;

      if (!amount || !item_name || !m_payment_id) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const today = new Date().toISOString().split("T")[0];
      const parsedAmount = parseFloat(amount).toFixed(2);

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
        subscription_type: 1,
        billing_date: today,
        recurring_amount: parsedAmount,
        frequency: 3,
        cycles: 0,
        subscription_notify_email: true,
        subscription_notify_webhook: true,
        subscription_notify_buyer: true,
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

  // === ITN (Webhook) ===
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

      if (typeof onPaymentUpdate === "function") {
        try {
          await onPaymentUpdate(itnPayload);
        } catch (err) {
          console.error("Error in user callback:", err);
          return res.status(500).send("Callback failed");
        }
      }

      res.status(200).send("OK");
    }
  );

  // === Cancel Subscription ===
  router.post(
    "/cancel/:token/:subscriptionId",
    async (req: Request<CancelParams>, res: Response) => {
      try {
        const { token, subscriptionId } = req.params;

        if (!token || !subscriptionId) {
          return res
            .status(400)
            .json({ error: "Token and Subscription ID are required" });
        }

        const headers: { [key: string]: string } = {
          "merchant-id": payfastConfig.merchant_id || "",
          version: process.env.PAYFAST_API_VERSION || "v1",
          timestamp: new Date().toISOString(),
        };

        headers["signature"] = generateApiSignature(
          headers,
          payfastConfig.passphrase || null
        );

        const baseUrl = payfastConfig.sandbox
          ? "https://sandbox.payfast.co.za"
          : "https://www.payfast.co.za";
        const testingMode = process.env.TESTING_MODE || "false";
        const cancelUrl = `${baseUrl}/subscriptions/${token}/cancel?testing=${testingMode}`;

        const { csrfToken, sessionCookie } = await fetchCsrfAndSession(baseUrl);
        if (csrfToken) headers["X-CSRF-TOKEN"] = csrfToken;
        if (sessionCookie) headers["Cookie"] = sessionCookie;

        const result = await attemptPayfastCancel({
          url: cancelUrl,
          headers,
          token,
          subscriptionId,
          onCancel,
        });

        return res.status(result.status).json(result.payload);
      } catch (error: any) {
        return res.status(500).json({
          error: "Internal server error",
          details: error.message,
        });
      }
    }
  );

  return router;
};

export default buildPayfastRouter;
