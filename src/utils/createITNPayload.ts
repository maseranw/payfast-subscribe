interface ITNPayload {
  [key: string]: string;
}

const createITNPayload = (body: { [key: string]: string }): ITNPayload => {
  const fields = [
    "m_payment_id", "pf_payment_id", "payment_status", "item_name", "item_description",
    "amount_gross", "amount_fee", "amount_net", "custom_str1", "custom_str2", "custom_str3",
    "custom_str4", "custom_str5", "custom_int1", "custom_int2", "custom_int3", "custom_int4",
    "custom_int5", "name_first", "name_last", "email_address", "merchant_id", "token",
    "billing_date", "signature"
  ];

  return fields.reduce((acc, key) => {
    acc[key] = body[key] || "";
    return acc;
  }, {} as ITNPayload);
};

export default createITNPayload;