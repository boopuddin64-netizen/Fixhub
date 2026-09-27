export interface NigerianBank {
  name: string;
  code: string;
  slug?: string;
}

export const NIGERIAN_BANKS: NigerianBank[] = [
  { name: 'OPay Digital Services Limited (OPay)', code: '999992', slug: 'paycom' },
  { name: 'PalmPay', code: '999991', slug: 'palmpay' },
  { name: 'Moniepoint MFB', code: '50515', slug: 'moniepoint-mfb-ng' },
  { name: 'Kuda Bank', code: '50211', slug: 'kuda-bank' },
  { name: 'Guaranty Trust Bank (GTBank)', code: '058', slug: 'guaranty-trust-bank' },
  { name: 'Access Bank', code: '044', slug: 'access-bank' },
  { name: 'Zenith Bank', code: '057', slug: 'zenith-bank' },
  { name: 'First Bank of Nigeria', code: '011', slug: 'first-bank-of-nigeria' },
  { name: 'United Bank for Africa (UBA)', code: '033', slug: 'united-bank-for-africa' },
  { name: 'Providus Bank', code: '101', slug: 'providus-bank' },
  { name: 'Stanbic IBTC Bank', code: '221', slug: 'stanbic-ibtc-bank' },
  { name: 'Sterling Bank', code: '232', slug: 'sterling-bank' },
  { name: 'Fidelity Bank', code: '070', slug: 'fidelity-bank' },
  { name: 'Union Bank of Nigeria', code: '032', slug: 'union-bank-of-nigeria' },
  { name: 'First City Monument Bank (FCMB)', code: '214', slug: 'first-city-monument-bank' },
  { name: 'Polaris Bank', code: '076', slug: 'polaris-bank' },
  { name: 'Wema Bank', code: '035', slug: 'wema-bank' },
  { name: 'Ecobank Nigeria', code: '050', slug: 'ecobank-nigeria' },
  { name: 'Keystone Bank', code: '082', slug: 'keystone-bank' },
  { name: 'Jaiz Bank', code: '301', slug: 'jaiz-bank' },
  { name: 'Taj Bank', code: '302', slug: 'taj-bank' },
  { name: 'VFD Microfinance Bank', code: '566', slug: 'vfd-mfb' },
  { name: 'Rubies MFB', code: '125', slug: 'rubies-mfb' },
];

export function getBankCodeByName(name: string): string | undefined {
  if (!name) return undefined;
  const normalized = name.toLowerCase().trim();
  if (normalized.includes('opay') || normalized === 'paycom') return '999992';
  if (normalized.includes('palmpay')) return '999991';
  if (normalized.includes('moniepoint')) return '50515';
  if (normalized.includes('kuda')) return '50211';

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
