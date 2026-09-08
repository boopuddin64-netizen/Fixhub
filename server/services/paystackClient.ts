import crypto from 'crypto';

export interface PaystackInitializeOptions {
  email: string;
  amountKobo: number;
  reference: string;
  callbackUrl?: string;
  metadata?: Record<string, unknown>;
  channels?: string[];
}

export interface PaystackTransferRecipientParams {
  name: string;
  accountNumber: string;
  bankCode: string;
  currency?: string;
  description?: string;
}

export interface PaystackTransferParams {
  amountKobo: number;
  recipientCode: string;
  reason?: string;
  reference: string;
  currency?: string;
}

export interface PaystackRefundParams {
  transactionRefOrId: string;
  amountKobo?: number;
  merchantNote?: string;
  customerNote?: string;
}

export interface PaystackVerifyResult {
  status: boolean;
  message: string;
  data?: {
    id?: number;
    status: 'success' | 'failed' | 'abandoned' | 'pending';
    reference: string;
    amount: number; // in kobo
    currency: string;
    channel: string;
    paid_at?: string;
    gateway_response?: string;
    customer?: {
      email?: string;
      customer_code?: string;
    };
    metadata?: Record<string, unknown>;
  };
}

export class PaystackClient {
  private static getSecretKey(): string {
    return process.env.PAYSTACK_SECRET_KEY || 'sk_test_mock_fixhub_development_key';
  }

  private static getPaymentMode(): 'sandbox' | 'live' {
    const mode = (process.env.PAYMENT_MODE || 'sandbox').toLowerCase();
    return mode === 'live' ? 'live' : 'sandbox';
  }

  private static isLiveMode(): boolean {
    return this.getPaymentMode() === 'live';
  }

  private static isSimulatedTestKey(key: string): boolean {
    return !key || key.startsWith('sk_test_xxx') || key.includes('mock');
  }

  /**
   * Initializes a transaction with Paystack (or mock sandbox if in test mode with dummy key).
   */
  public static async initializeTransaction(
    options: PaystackInitializeOptions
  ): Promise<{
    success: boolean;
    authorizationUrl?: string;
    accessCode?: string;
    reference: string;
    error?: string;
  }> {
    const secretKey = this.getSecretKey();
    const isLive = this.isLiveMode();
    const isDummyKey = this.isSimulatedTestKey(secretKey);

    // In LIVE mode, credentials MUST be real and validated
    if (isLive && isDummyKey) {
      return {
        success: false,
        reference: options.reference,
        error: 'Production Paystack secret key is required in LIVE mode.',
      };
    }

    // Try real Paystack API if not a dummy test key
    if (!isDummyKey) {
      try {
        const safeEmail = options.email && options.email.includes('@') ? options.email : 'customer@fixhub.ng';
        const response = await fetch('https://api.paystack.co/transaction/initialize', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${secretKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: safeEmail,
            amount: options.amountKobo,
            reference: options.reference,
            callback_url: options.callbackUrl,
            metadata: options.metadata,
            channels: options.channels || ['card', 'bank', 'ussd', 'qr', 'bank_transfer'],
          }),
        });

        const data: any = await response.json();
        if (response.ok && data?.status && data?.data) {
          return {
            success: true,
            authorizationUrl: data.data.authorization_url,
            accessCode: data.data.access_code,
            reference: data.data.reference || options.reference,
          };
        } else {
          // If Paystack returned an error
          if (isLive) {
            return {
              success: false,
              reference: options.reference,
              error: data?.message || 'Paystack initialization failed.',
            };
          }
          console.warn('[PaystackClient] Real API failed, falling back to simulated sandbox:', data?.message);
        }
      } catch (err: any) {
        if (isLive) {
          return {
            success: false,
            reference: options.reference,
            error: err.message || 'Network error communicating with Paystack.',
          };
        }
        console.warn('[PaystackClient] Network exception connecting to Paystack, falling back to sandbox mode:', err.message);
      }
    }

    // Deterministic, secure Sandbox Mode simulation
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    return {
      success: true,
      authorizationUrl: `${appUrl}/payment/checkout?reference=${encodeURIComponent(options.reference)}&amount=${options.amountKobo}`,
      accessCode: `acc_${options.reference.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}`,
      reference: options.reference,
    };
  }

  /**
   * Verifies a transaction with Paystack server-side.
   */
  public static async verifyTransaction(
    reference: string,
    expectedAmountKobo?: number
  ): Promise<PaystackVerifyResult> {
    const secretKey = this.getSecretKey();
    const isLive = this.isLiveMode();
    const isDummyKey = this.isSimulatedTestKey(secretKey);

    if (isLive && isDummyKey) {
      return {
        status: false,
        message: 'Cannot verify transactions in LIVE mode with dummy Paystack secret key.',
      };
    }

    // Call real Paystack API if key is real
    if (!isDummyKey) {
      try {
        const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${secretKey}`,
          },
        });

        const data: any = await response.json();
        if (response.ok && data?.status && data?.data) {
          return {
            status: true,
            message: 'Verification successful from Paystack API',
            data: {
              id: data.data.id,
              status: data.data.status,
              reference: data.data.reference,
              amount: data.data.amount,
              currency: data.data.currency,
              channel: data.data.channel,
              paid_at: data.data.paid_at,
              gateway_response: data.data.gateway_response,
              customer: data.data.customer,
              metadata: data.data.metadata,
            },
          };
        } else {
          if (isLive) {
            return {
              status: false,
              message: data?.message || 'Transaction verification failed at Paystack.',
            };
          }
          console.warn('[PaystackClient] Real verify failed in sandbox mode:', data?.message);
        }
      } catch (err: any) {
        if (isLive) {
          return {
            status: false,
            message: err.message || 'Network error communicating with Paystack verification API.',
          };
        }
        console.warn('[PaystackClient] Network exception during verify, falling back to sandbox mode:', err.message);
      }
    }

    // In sandbox mode simulation:
    // If expectedAmountKobo is provided, we simulate a successful transaction matching the reference
    return {
      status: true,
      message: 'Simulated sandbox verification successful',
      data: {
        id: Math.floor(1000000 + Math.random() * 9000000),
        status: 'success',
        reference,
        amount: expectedAmountKobo || 0,
        currency: 'NGN',
        channel: 'card',
        paid_at: new Date().toISOString(),
        gateway_response: 'Successful Sandbox Payment',
        customer: {
          email: 'customer@fixhub.ng',
        },
      },
    };
  }

  /**
   * Generates HMAC SHA512 signature using the active secret key.
   */
  public static generateHmacSignature(
    rawBody: Buffer | string,
    secretKey?: string
  ): string {
    const key = secretKey || this.getSecretKey();
    return crypto.createHmac('sha512', key).update(rawBody).digest('hex');
  }

  /**
   * Cryptographically verifies the Paystack Webhook signature (HMAC SHA512).
   */
  public static verifyWebhookSignature(
    rawBody: Buffer | string | undefined,
    signatureHeader: string | undefined
  ): boolean {
    if (!signatureHeader || !rawBody) {
      return false;
    }

    const secretKey = this.getSecretKey();

    try {
      const computedHash = crypto
        .createHmac('sha512', secretKey)
        .update(rawBody)
        .digest('hex');

      const expectedBuffer = Buffer.from(computedHash, 'utf8');
      const headerBuffer = Buffer.from(signatureHeader, 'utf8');

      if (expectedBuffer.length !== headerBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(expectedBuffer, headerBuffer);
    } catch (err) {
      console.error('[PaystackClient] Signature verification error:', err);
      return false;
    }
  }

  /**
   * Creates a Transfer Recipient on Paystack.
   */
  public static async createTransferRecipient(
    params: PaystackTransferRecipientParams
  ): Promise<{
    success: boolean;
    recipientCode?: string;
    message?: string;
    data?: any;
  }> {
    const secretKey = this.getSecretKey();
    const isLive = this.isLiveMode();
    const isDummyKey = this.isSimulatedTestKey(secretKey);

    if (isLive && isDummyKey) {
      return {
        success: false,
        message: 'Production Paystack secret key is required in LIVE mode for transfers.',
      };
    }

    if (!isDummyKey) {
      try {
        const response = await fetch('https://api.paystack.co/transferrecipient', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${secretKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'nuban',
            name: params.name,
            account_number: params.accountNumber,
            bank_code: params.bankCode,
            currency: params.currency || 'NGN',
            description: params.description || `Technician Payout for ${params.name}`,
          }),
        });

        const data: any = await response.json();
        if (response.ok && data?.status && data?.data?.recipient_code) {
          return {
            success: true,
            recipientCode: data.data.recipient_code,
            message: data.message || 'Transfer recipient created',
            data: data.data,
          };
        } else {
          if (isLive) {
            return {
              success: false,
              message: data?.message || 'Failed to create transfer recipient at Paystack.',
            };
          }
          console.warn('[PaystackClient] Real recipient creation failed, falling back to sandbox:', data?.message);
        }
      } catch (err: any) {
        if (isLive) {
          return {
            success: false,
            message: err.message || 'Network error creating Paystack transfer recipient.',
          };
        }
        console.warn('[PaystackClient] Network exception during recipient creation, falling back to sandbox:', err.message);
      }
    }

    // Sandbox simulation
    const mockCode = `RCP_${params.accountNumber.slice(-4)}_${Math.random().toString(36).substring(2, 8)}`;
    return {
      success: true,
      recipientCode: mockCode,
      message: 'Simulated sandbox transfer recipient created',
      data: {
        recipient_code: mockCode,
        name: params.name,
        details: {
          account_number: params.accountNumber,
          bank_code: params.bankCode,
        },
      },
    };
  }

  /**
   * Initiates a Transfer on Paystack.
   */
  public static async initiateTransfer(
    params: PaystackTransferParams
  ): Promise<{
    success: boolean;
    transferCode?: string;
    reference: string;
    status?: string;
    message?: string;
    data?: any;
  }> {
    const secretKey = this.getSecretKey();
    const isLive = this.isLiveMode();
    const isDummyKey = this.isSimulatedTestKey(secretKey);

    if (isLive && isDummyKey) {
      return {
        success: false,
        reference: params.reference,
        message: 'Production Paystack secret key is required in LIVE mode for transfers.',
      };
    }

    if (!isDummyKey) {
      try {
        const response = await fetch('https://api.paystack.co/transfer', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${secretKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            source: 'balance',
            amount: params.amountKobo,
            recipient: params.recipientCode,
            reason: params.reason || 'Technician Payout',
            reference: params.reference,
            currency: params.currency || 'NGN',
          }),
        });

        const data: any = await response.json();
        if (response.ok && data?.status && data?.data) {
          return {
            success: true,
            transferCode: data.data.transfer_code,
            reference: data.data.reference || params.reference,
            status: data.data.status,
            message: data.message || 'Transfer initiated successfully',
            data: data.data,
          };
        } else {
          if (isLive) {
            return {
              success: false,
              reference: params.reference,
              message: data?.message || 'Transfer initiation failed at Paystack.',
            };
          }
          console.warn('[PaystackClient] Real transfer failed, falling back to sandbox:', data?.message);
        }
      } catch (err: any) {
        if (isLive) {
          return {
            success: false,
            reference: params.reference,
            message: err.message || 'Network error initiating Paystack transfer.',
          };
        }
        console.warn('[PaystackClient] Network exception during transfer, falling back to sandbox:', err.message);
      }
    }

    // Sandbox simulation: successful transfer queue
    const mockTransferCode = `TRF_${Math.random().toString(36).substring(2, 10)}`;
    return {
      success: true,
      transferCode: mockTransferCode,
      reference: params.reference,
      status: 'success',
      message: 'Simulated sandbox transfer queued successfully',
      data: {
        transfer_code: mockTransferCode,
        reference: params.reference,
        amount: params.amountKobo,
        currency: 'NGN',
        status: 'success',
      },
    };
  }

  /**
   * Initiates a Refund on Paystack.
   */
  public static async createRefund(
    params: PaystackRefundParams
  ): Promise<{
    success: boolean;
    refundId?: number;
    transactionReference?: string;
    status?: string;
    message?: string;
    data?: any;
  }> {
    const secretKey = this.getSecretKey();
    const isLive = this.isLiveMode();
    const isDummyKey = this.isSimulatedTestKey(secretKey);

    if (isLive && isDummyKey) {
      return {
        success: false,
        message: 'Production Paystack secret key is required in LIVE mode for refunds.',
      };
    }

    if (!isDummyKey) {
      try {
        const body: any = {
          transaction: params.transactionRefOrId,
          merchant_note: params.merchantNote || 'Fix Hub Customer Refund',
        };
        if (params.amountKobo && params.amountKobo > 0) {
          body.amount = params.amountKobo;
        }
        if (params.customerNote) {
          body.customer_note = params.customerNote;
        }

        const response = await fetch('https://api.paystack.co/refund', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${secretKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });

        const data: any = await response.json();
        if (response.ok && data?.status && data?.data) {
          return {
            success: true,
            refundId: data.data.id,
            transactionReference: data.data.transaction_reference,
            status: data.data.status,
            message: data.message || 'Refund created successfully',
            data: data.data,
          };
        } else {
          if (isLive) {
            return {
              success: false,
              message: data?.message || 'Refund creation failed at Paystack.',
            };
          }
          console.warn('[PaystackClient] Real refund failed, falling back to sandbox:', data?.message);
        }
      } catch (err: any) {
        if (isLive) {
          return {
            success: false,
            message: err.message || 'Network error creating Paystack refund.',
          };
        }
        console.warn('[PaystackClient] Network exception during refund, falling back to sandbox:', err.message);
      }
    }

    // Sandbox simulation: completed/pending refund
    const mockRefundId = Math.floor(1000000 + Math.random() * 9000000);
    return {
      success: true,
      refundId: mockRefundId,
      transactionReference: params.transactionRefOrId,
      status: 'processed',
      message: 'Simulated sandbox refund processed successfully',
      data: {
        id: mockRefundId,
        transaction_reference: params.transactionRefOrId,
        amount: params.amountKobo,
        status: 'processed',
      },
    };
  }
}
