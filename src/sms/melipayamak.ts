import https from 'https';

const MELI_HOST = 'console.melipayamak.com';
const MELI_PATH = process.env.SMS_MELIPAYAMAK_PATH!; // required, e.g. /api/send/shared/YOUR_KEY

export function sendSms(
  bodyId: number,
  phoneNumber: string,
  args: string[],
): Promise<void> {
  return new Promise((resolve, reject) => {
    const normalized = phoneNumber.replace(/\s/g, '');
    if (!/^(\+98|0)?9\d{9}$/.test(normalized)) {
      reject(new Error(`invalid phone: ${phoneNumber}`));
      return;
    }
    const payload = JSON.stringify({ bodyId, to: normalized, args });
    const req = https.request(
      {
        hostname: MELI_HOST,
        port: 443,
        path: MELI_PATH,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk: Buffer) => {
          body += chunk.toString();
        });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300)
            resolve();
          else
            reject(
              new Error(`SMS API returned status ${res.statusCode}: ${body}`),
            );
        });
      },
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

export async function smsOtpCode(
  phoneNumber: string,
  otp: string,
): Promise<void> {
  const id = parseInt(process.env.SMS_BODY_OTP || '420054', 10);
  await sendSms(id, phoneNumber, [otp]);
}
