import { createHash } from "crypto";
import axios from "axios";
import qs from "querystring";
import payfastConfig from "../configs/config";
import { Request, Response } from "express";
import {
  PaymentData,
  PfData,
  CsrfSession,
  RequestArgs,
  RequestResult,
  ActionType,
  MethodType,
  SubscriptionRouteOptions,
} from "../types";

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

const getCurrentIsoTimestamp = (): string => {
  const date = new Date();
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const pad = (n: number) => String(Math.floor(Math.abs(n))).padStart(2, "0");
  const hours = pad(offsetMinutes / 60);
  const minutes = pad(offsetMinutes % 60);
  const isoString = date.toISOString().slice(0, 19);
  return `${isoString}${sign}${hours}:${minutes}`;
};

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

const buildSignedHeaders = async (
  passphrase: string | null
): Promise<{ [key: string]: string }> => {
  const headers: { [key: string]: string } = {
    "merchant-id": payfastConfig.merchant_id || "",
    version: process.env.PAYFAST_API_VERSION || "v1",
    timestamp: getCurrentIsoTimestamp(),
  };
  headers["signature"] = generateApiSignature(headers, passphrase);
  return headers;
};

const attemptPayfastRequest = async ({
  method,
  url,
  headers,
  token,
  subscriptionId,
  callback,
}: RequestArgs): Promise<RequestResult> => {
  const maxRetries = 2;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      const axiosConfig = {
        method,
        url,
        headers,
        timeout: 10000,
        ...(method === "PUT" ? { data: null } : {}),
      };

      const response = await axios(axiosConfig);

      if (typeof callback === "function") {
        await callback({
          token,
          subscriptionId,
          status: response.status,
          payload: response.data,
        });
      }

      return {
        status: response.status,
        payload: {
          message: response.data.message,
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
            error.response?.data?.message || error.message || "Request failed",
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

const handleSubscriptionRoute =
  (
    action: ActionType,
    method: MethodType,
    callback: (data: any) => Promise<void>,
    options: SubscriptionRouteOptions = {}
  ) =>
  async (
    req: Request<{ token: string; subscriptionId?: string }>,
    res: Response
  ) => {
    const { token, subscriptionId } = req.params;
    const { requireSubscriptionId = false } = options;

    if (!token || (requireSubscriptionId && !subscriptionId)) {
      return res.status(400).json({
        error:
          "Token" +
          (requireSubscriptionId ? " and Subscription ID" : "") +
          " are required",
      });
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

export {
  generateSignatureForInitiate,
  pfValidSignature,
  createITNPayload,
  validateITNWithPayfast,
  generateApiSignature,
  fetchCsrfAndSession,
  getCurrentIsoTimestamp,
  buildSignedHeaders,
  attemptPayfastRequest,
  handleSubscriptionRoute,
};
