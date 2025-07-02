import { createHash } from "crypto";
import axios from "axios";
import qs from "querystring";
import payfastConfig from "./config";

interface PaymentData {
  [key: string]: string | number | boolean | undefined;
}

interface PfData {
  [key: string]: string;
}

interface CancelArgs {
  url: string;
  headers: { [key: string]: string };
  token: string;
  subscriptionId: string;
  onCancel?: (data: any) => Promise<void>;
}

interface CancelResult {
  status: number;
  payload: any;
}

const generateSignatureForInitiate = (
  data: PaymentData,
  passphrase: string | null = null
): string => {
  const fieldOrder = [
    "merchant_id",
    "merchant_key",
    "return_url",
    "cancel_url",
    "notify_url",
    "name_first",
    "name_last",
    "email_address",
    "m_payment_id",
    "amount",
    "item_name",
    "item_description",
    "subscription_type",
    "billing_date",
    "recurring_amount",
    "frequency",
    "cycles",
    "subscription_notify_email",
    "subscription_notify_webhook",
    "subscription_notify_buyer",
  ];

  let paramString = fieldOrder.reduce((acc, key) => {
    if (data[key] !== undefined && data[key] !== "") {
      const value = encodeURIComponent(data[key]!.toString().trim()).replace(
        /%20/g,
        "+"
      );
      return acc + `${key}=${value}&`;
    }
    return acc;
  }, "");

  paramString = paramString.slice(0, -1);

  if (passphrase) {
    const encodedPass = encodeURIComponent(passphrase.trim()).replace(
      /%20/g,
      "+"
    );
    paramString += `&passphrase=${encodedPass}`;
  }

  return createHash("md5").update(paramString).digest("hex");
};

const pfValidSignature = (
  pfData: PfData,
  pfParamString: string,
  pfPassphrase: string | null = null
): boolean => {
  if (pfPassphrase !== null) {
    const encodedPass = encodeURIComponent(pfPassphrase.trim()).replace(
      /%20/g,
      "+"
    );
    pfParamString += `&passphrase=${encodedPass}`;
  }

  const signature = createHash("md5").update(pfParamString).digest("hex");
  return pfData["signature"] === signature;
};

const createITNPayload = (body: { [key: string]: string }): PfData => {
  return {
    m_payment_id: body.m_payment_id || "",
    pf_payment_id: body.pf_payment_id || "",
    payment_status: body.payment_status || "",
    item_name: body.item_name || "",
    item_description: body.item_description || "",
    amount_gross: body.amount_gross || "",
    amount_fee: body.amount_fee || "",
    amount_net: body.amount_net || "",
    custom_str1: body.custom_str1 || "",
    custom_str2: body.custom_str2 || "",
    custom_str3: body.custom_str3 || "",
    custom_str4: body.custom_str4 || "",
    custom_str5: body.custom_str5 || "",
    custom_int1: body.custom_int1 || "",
    custom_int2: body.custom_int2 || "",
    custom_int3: body.custom_int3 || "",
    custom_int4: body.custom_int4 || "",
    custom_int5: body.custom_int5 || "",
    name_first: body.name_first || "",
    name_last: body.name_last || "",
    email_address: body.email_address || "",
    merchant_id: body.merchant_id || "",
    token: body.token || "",
    billing_date: body.billing_date || "",
    signature: body.signature || "",
  };
};

const validateITNWithPayfast = async (pfData: PfData): Promise<boolean> => {
  const postData = qs.stringify(pfData);
  const url = payfastConfig.sandbox
    ? "https://sandbox.payfast.co.za/eng/query/validate"
    : "https://www.payfast.co.za/eng/query/validate";

  try {
    const response = await axios.post(url, postData, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    return response.data === "VALID";
  } catch {
    return false;
  }
};

const generateApiSignature = (
  pfData: { [key: string]: string },
  passPhrase: string | null = null
): string => {
  const data = { ...pfData };
  delete data.signature;
  delete data.testing;

  if (passPhrase !== null) {
    data.passphrase = passPhrase;
  }

  const sortedKeys = Object.keys(data).sort();
  const encodedPairs = sortedKeys.map((key) => {
    const encodedKey = encodeURIComponent(key);
    const encodedValue = encodeURIComponent(data[key]);
    return `${encodedKey}=${encodedValue}`;
  });

  const pfParamString = encodedPairs.join("&");

  return createHash("md5").update(pfParamString).digest("hex");
};

const getCurrentTimestamp = (): string => {
  return new Date().toISOString();
};

interface CsrfSession {
  csrfToken: string | null;
  sessionCookie: string | null;
}

const fetchCsrfAndSession = async (baseUrl: string): Promise<CsrfSession> => {
  try {
    const response = await axios.get(baseUrl, {
      timeout: 5000,
      headers: { Accept: "text/html" },
      withCredentials: true,
    });

    const tokenMatch = response.data.match(
      /<meta name="csrf-token" content="(.+?)"/
    );

    return {
      csrfToken: tokenMatch ? tokenMatch[1] : null,
      sessionCookie: response.headers["set-cookie"]?.join("; ") || null,
    };
  } catch {
    return { csrfToken: null, sessionCookie: null };
  }
};

const attemptPayfastCancel = async ({
  url,
  headers,
  token,
  subscriptionId,
  onCancel,
}: CancelArgs): Promise<CancelResult> => {
  const maxRetries = 2;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      const response = await axios.put(url, null, {
        headers,
        timeout: 10000,
      });

      if (typeof onCancel === "function") {
        await onCancel({
          subscriptionId,
          token,
          status: response.status,
          payload: response.data,
        });
      }

      return {
        status: 200,
        payload: {
          message: "Subscription cancelled successfully",
          data: response.data,
        },
      };
    } catch (error: any) {
      if (error.response?.status === 419 && attempt < maxRetries - 1) {
        const baseUrl = url.split("/subscriptions")[0];
        const { csrfToken, sessionCookie } = await fetchCsrfAndSession(baseUrl);
        if (csrfToken) headers["X-CSRF-TOKEN"] = csrfToken;
        if (sessionCookie) headers["Cookie"] = sessionCookie;
        attempt++;
        continue;
      }

      return {
        status: error.response?.status || 500,
        payload: {
          error:
            error.response?.data?.message ||
            error.message ||
            "Failed to cancel subscription",
          details: error.response?.data || {},
        },
      };
    }
  }

  return {
    status: 500,
    payload: { error: "Max retry attempts exceeded" },
  };
};

export {
  generateSignatureForInitiate,
  pfValidSignature,
  createITNPayload,
  validateITNWithPayfast,
  getCurrentTimestamp,
  generateApiSignature,
  fetchCsrfAndSession,
  attemptPayfastCancel,
};
