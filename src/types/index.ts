export interface PayfastConfig {
  sandbox: boolean;
  merchant_id: string | undefined;
  merchant_key: string | undefined;
  passphrase: string;
  return_url: string;
  cancel_url: string;
  notify_url: string;
}


export interface PaymentData {
  [key: string]: string | number | boolean | undefined;
}

export interface InitiateRequestBody {
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

export interface PfData {
  [key: string]: string;
}

export interface RequestArgs {
  method: "GET" | "PUT";
  url: string;
  headers: { [key: string]: string };
  token: string;
  subscriptionId?: string;
  callback?: (data: any) => Promise<void>;
}

export interface RequestResult {
  status: number;
  payload: any;
}

export interface CsrfSession {
  csrfToken: string | null;
  sessionCookie: string | null;
}

export type ActionType = "cancel" | "pause" | "unpause" | "fetch";
export type MethodType = "GET" | "PUT";

export interface SubscriptionRouteOptions {
  requireSubscriptionId?: boolean;
}
