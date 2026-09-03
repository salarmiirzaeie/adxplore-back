import { BadRequestException } from '@nestjs/common';

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

/** First-6 Shetab BIN → bank display name */
const CARD_BIN_TO_BANK: Record<string, string> = {
  '603799': 'بانک ملی ایران',
  '589210': 'بانک سپه',
  '627648': 'بانک توسعه صادرات',
  '627961': 'بانک صنعت و معدن',
  '603770': 'بانک کشاورزی',
  '628023': 'بانک مسکن',
  '627760': 'پست بانک',
  '502908': 'بانک توسعه تعاون',
  '627412': 'بانک اقتصاد نوین',
  '622106': 'بانک پارسیان',
  '627884': 'بانک پارسیان',
  '639194': 'بانک پارسیان',
  '502229': 'بانک پاسارگاد',
  '639347': 'بانک پاسارگاد',
  '627488': 'بانک کارآفرین',
  '502910': 'بانک کارآفرین',
  '621986': 'بانک سامان',
  '639346': 'بانک سینا',
  '639607': 'بانک سرمایه',
  '636214': 'بانک آینده',
  '502806': 'بانک شهر',
  '504706': 'بانک شهر',
  '502938': 'بانک دی',
  '627381': 'بانک انصار',
  '505785': 'بانک ایران زمین',
  '627353': 'بانک تجارت',
  '585983': 'بانک تجارت',
  '589463': 'بانک رفاه کارگران',
  '610433': 'بانک ملت',
  '991975': 'بانک ملت',
  '603769': 'بانک صادرات ایران',
  '505416': 'بانک گردشگری',
  '636949': 'بانک حکمت ایرانیان',
  '504172': 'بانک قرض‌الحسنه رسالت',
  '585947': 'بانک خاورمیانه',
  '606373': 'بانک قرض‌الحسنه مهر ایران',
  '606256': 'موسسه اعتباری ملل',
  '639599': 'بانک قوامین',
  '639370': 'بانک مهر اقتصاد',
  '628157': 'موسسه اعتباری توسعه',
  '636795': 'بانک مرکزی',
  '507677': 'موسسه اعتباری نور',
};

/** Sheba 3-digit bank identifier (digits after IR + check) → bank display name */
const SHEBA_BANK_CODE_TO_BANK: Record<string, string> = {
  '010': 'بانک مرکزی',
  '011': 'بانک صنعت و معدن',
  '012': 'بانک ملت',
  '013': 'بانک رفاه کارگران',
  '014': 'بانک مسکن',
  '015': 'بانک سپه',
  '016': 'بانک کشاورزی',
  '017': 'بانک ملی ایران',
  '018': 'بانک تجارت',
  '019': 'بانک صادرات ایران',
  '020': 'بانک توسعه صادرات',
  '021': 'پست بانک',
  '022': 'بانک توسعه تعاون',
  '053': 'بانک کارآفرین',
  '054': 'بانک پارسیان',
  '055': 'بانک اقتصاد نوین',
  '056': 'بانک سامان',
  '057': 'بانک پاسارگاد',
  '058': 'بانک سرمایه',
  '059': 'بانک سینا',
  '060': 'بانک مهر ایران',
  '061': 'بانک شهر',
  '062': 'بانک آینده',
  '063': 'بانک ایران زمین',
  '064': 'بانک حکمت ایرانیان',
  '065': 'بانک گردشگری',
  '066': 'بانک ایران ونزوئلا',
  '069': 'بانک قرض‌الحسنه مهر ایران',
  '070': 'بانک قرض‌الحسنه رسالت',
  '078': 'بانک خاورمیانه',
  '079': 'بانک خاورمیانه',
  '080': 'بانک قرض‌الحسنه رسالت',
};

export type ParsedBankCard = {
  holderName: string;
  cardNumber: string;
  sheba: string;
  bankName: string;
};

export type BankCardPublic = {
  holderName: string;
  cardNumber: string;
  cardMasked: string;
  cardLast4: string;
  sheba: string;
  bankName: string;
  updatedAt?: Date;
};

export function toIranianDigits(value: string): string {
  return String(value ?? '')
    .split('')
    .map((ch) => {
      const p = PERSIAN_DIGITS.indexOf(ch);
      if (p >= 0) return String(p);
      const a = ARABIC_DIGITS.indexOf(ch);
      if (a >= 0) return String(a);
      return ch;
    })
    .join('');
}

export function normalizeCardNumber(value: string): string {
  return toIranianDigits(value).replace(/[\s-]/g, '');
}

export function normalizeSheba(value: string): string {
  const raw = toIranianDigits(value).replace(/[\s-]/g, '').toUpperCase();
  if (/^\d{24}$/.test(raw)) return `IR${raw}`;
  return raw;
}

export function maskCardNumber(cardNumber: string): string {
  const d = normalizeCardNumber(cardNumber);
  if (d.length < 10) return d;
  return `${d.slice(0, 6)}******${d.slice(-4)}`;
}

export function bankNameFromCard(cardNumber: string): string | null {
  const d = normalizeCardNumber(cardNumber);
  return CARD_BIN_TO_BANK[d.slice(0, 6)] ?? null;
}

export function bankNameFromSheba(sheba: string): string | null {
  const s = normalizeSheba(sheba);
  if (!/^IR\d{24}$/.test(s)) return null;
  return SHEBA_BANK_CODE_TO_BANK[s.slice(4, 7)] ?? null;
}

function luhnOk(digits: string): boolean {
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = Number(digits[i]);
    if (!Number.isInteger(n)) return false;
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

function shebaChecksumOk(sheba: string): boolean {
  const s = normalizeSheba(sheba);
  if (!/^IR\d{24}$/.test(s)) return false;
  const rearranged = s.slice(4) + s.slice(0, 4);
  let numeric = '';
  for (const ch of rearranged) {
    if (ch >= 'A' && ch <= 'Z') numeric += String(ch.charCodeAt(0) - 55);
    else numeric += ch;
  }
  let remainder = 0;
  for (const ch of numeric) {
    remainder = (remainder * 10 + Number(ch)) % 97;
  }
  return remainder === 1;
}

export function parseBankCardInput(input: {
  holderName: string;
  cardNumber: string;
  sheba: string;
}): ParsedBankCard {
  const holderName = input.holderName.trim().replace(/\s+/g, ' ');
  if (holderName.length < 2 || holderName.length > 80) {
    throw new BadRequestException('نام صاحب کارت را وارد کنید');
  }

  const cardNumber = normalizeCardNumber(input.cardNumber);
  if (!/^\d{16}$/.test(cardNumber) || !luhnOk(cardNumber)) {
    throw new BadRequestException('شماره کارت معتبر نیست');
  }

  const sheba = normalizeSheba(input.sheba);
  if (!shebaChecksumOk(sheba)) {
    throw new BadRequestException('شماره شبا معتبر نیست');
  }

  const bankName =
    bankNameFromCard(cardNumber) ??
    bankNameFromSheba(sheba) ??
    'نامشخص';

  return { holderName, cardNumber, sheba, bankName };
}

export function toBankCardPublic(
  card: {
    holderName: string;
    cardNumber: string;
    sheba: string;
    bankName: string;
    updatedAt?: Date;
  },
): BankCardPublic {
  return {
    holderName: card.holderName,
    cardNumber: card.cardNumber,
    cardMasked: maskCardNumber(card.cardNumber),
    cardLast4: card.cardNumber.slice(-4),
    sheba: card.sheba,
    bankName: card.bankName,
    ...(card.updatedAt ? { updatedAt: card.updatedAt } : {}),
  };
}
