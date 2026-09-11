export interface NigerianBank {
  name: string;
  code: string;
  slug?: string;
}

export const NIGERIAN_BANKS: NigerianBank[] = [
  { name: 'Access Bank', code: '044' },
  { name: 'Guaranty Trust Bank (GTBank)', code: '058' },
  { name: 'Zenith Bank', code: '057' },
  { name: 'First Bank of Nigeria', code: '011' },
  { name: 'United Bank for Africa (UBA)', code: '033' },
  { name: 'Providus Bank', code: '101' },
  { name: 'Kuda Microfinance Bank', code: '50211' },
  { name: 'OPay Digital Services', code: '999992' },
  { name: 'PalmPay', code: '999991' },
  { name: 'Moniepoint MFB', code: '50515' },
  { name: 'Stanbic IBTC Bank', code: '221' },
  { name: 'Sterling Bank', code: '232' },
  { name: 'Fidelity Bank', code: '070' },
  { name: 'Union Bank of Nigeria', code: '032' },
  { name: 'First City Monument Bank (FCMB)', code: '214' },
  { name: 'Polaris Bank', code: '076' },
  { name: 'Wema Bank', code: '035' },
  { name: 'Ecobank Nigeria', code: '050' },
  { name: 'Keystone Bank', code: '082' },
  { name: 'Jaiz Bank', code: '301' },
  { name: 'Taj Bank', code: '302' },
  { name: 'VFD Microfinance Bank', code: '566' },
  { name: 'Rubies MFB', code: '125' },
];

export function getBankCodeByName(name: string): string | undefined {
  if (!name) return undefined;
  const normalized = name.toLowerCase().trim();
  const direct = NIGERIAN_BANKS.find((b) => b.name.toLowerCase() === normalized);
  if (direct) return direct.code;
  const partial = NIGERIAN_BANKS.find(
    (b) =>
      b.name.toLowerCase().includes(normalized) ||
      normalized.includes(b.name.toLowerCase())
  );
  return partial?.code;
}

export function getBankNameByCode(code: string): string | undefined {
  if (!code) return undefined;
  const cleanCode = String(code).trim();
  return NIGERIAN_BANKS.find((b) => b.code === cleanCode)?.name;
}
