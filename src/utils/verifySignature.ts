import { createHash } from "crypto";

interface PfData {
  [key: string]: string;
}

const verifySignature = (pfData: PfData, pfParamString: string, passphrase: string | null = null): boolean => {
  if (passphrase) {
    const encodedPass = encodeURIComponent(passphrase.trim()).replace(/%20/g, "+");
    pfParamString += `&passphrase=${encodedPass}`;
  }

  const signature = createHash("md5").update(pfParamString).digest("hex");
  return pfData["signature"] === signature;
};

export default verifySignature;