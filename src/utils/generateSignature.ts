import { createHash } from "crypto";
import { PaymentData } from "../types";


const generateSignature = (data: PaymentData, passphrase: string | null = null): string => {
  const fieldOrder = [
    "merchant_id", "merchant_key", "return_url", "cancel_url", "notify_url",
    "name_first", "name_last", "email_address", "m_payment_id", "amount",
    "item_name", "item_description", "subscription_type", "billing_date",
    "recurring_amount", "frequency", "cycles",
    "subscription_notify_email", "subscription_notify_webhook", "subscription_notify_buyer"
  ];

  let paramString = fieldOrder.reduce((acc, key) => {
    if (data[key]) {
      const value = encodeURIComponent(data[key]!.toString().trim()).replace(/%20/g, "+");
      acc += `${key}=${value}&`;
    }
    return acc;
  }, "");

  paramString = paramString.slice(0, -1);

  if (passphrase) {
    const encodedPass = encodeURIComponent(passphrase.trim()).replace(/%20/g, "+");
    paramString += `&passphrase=${encodedPass}`;
  }

  return createHash("md5").update(paramString).digest("hex");
};

export default generateSignature;