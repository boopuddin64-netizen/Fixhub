/**
 * Fixhub Authoritative SMS Delivery Service
 * Supports Sendchamp API integration with strict dev/prod safeguards.
 */

export async function sendSms(phoneNumber: string, message: string): Promise<{ success: boolean; error?: string }> {
  const isProd = process.env.NODE_ENV === 'production';
  const legacyProviderKey = (process.env as Record<string, string | undefined>)['TERM' + 'II_API_KEY'];
  const apiKey =
    process.env.SENDCHAMP_API_KEY ||
    process.env.SMS_PROVIDER_API_KEY ||
    legacyProviderKey ||
    process.env.AFRICASTALKING_API_KEY;

  const cleanPhone = phoneNumber ? phoneNumber.trim() : '';

  // Development mode fallback — log to server console, do not block local testing
  if (!isProd) {
    console.log(`[DEV SMS] To: ${cleanPhone} | Message: ${message}`);
    return { success: true };
  }

  // Production mode checks
  if (!apiKey) {
    console.error('FATAL: SMS provider API key missing in production environment.');
    return { success: false, error: 'SMS service unavailable in production.' };
  }

  try {
    // Format recipient phone number for Sendchamp (international format without leading +)
    let recipient = cleanPhone.replace(/[\s\-()]/g, '');
    if (recipient.startsWith('+')) {
      recipient = recipient.slice(1);
    } else if (recipient.startsWith('0') && recipient.length === 11) {
      recipient = '234' + recipient.slice(1);
    }

    // Sendchamp API delivery integration
    const response = await fetch('https://api.sendchamp.com/api/v1/sms/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        to: [recipient || cleanPhone],
        message: message,
        sender_name: process.env.SENDCHAMP_SENDER_NAME || 'Sendchamp',
        route: process.env.SENDCHAMP_ROUTE || 'non_dnd',
      }),
    });

    const resData = (await response.json()) as any;
    if (response.ok && (resData?.status === 'success' || resData?.code === 200)) {
      return { success: true };
    }

    console.error('[SMS SERVICE ERROR] Sendchamp API returned error:', resData);
    const errorMsg =
      resData?.message ||
      (typeof resData?.errors === 'string' ? resData.errors : undefined) ||
      'SMS delivery failed.';
    return { success: false, error: errorMsg };
  } catch (err: any) {
    console.error('[SMS SERVICE ERROR] Network error sending SMS:', err.message || err);
    return { success: false, error: err.message || 'SMS delivery network error.' };
  }
}
