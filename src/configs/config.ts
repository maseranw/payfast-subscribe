import { config as dotenvConfig } from "dotenv";
import { PayfastConfig } from "../types";

dotenvConfig();


const payfastConfig: PayfastConfig = {
  sandbox: process.env.NODE_ENV !== "production",
  merchant_id: process.env.PAYFAST_MERCHANT_ID,
  merchant_key: process.env.PAYFAST_MERCHANT_KEY,
  passphrase: process.env.PAYFAST_PASSPHRASE || "",
  return_url: process.env.RETURN_URL || "",
  cancel_url: process.env.CANCEL_URL || "",
  notify_url: process.env.NOTIFY_URL || "",
};

export default payfastConfig;