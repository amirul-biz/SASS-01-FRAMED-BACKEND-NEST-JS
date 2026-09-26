import { Injectable, Logger } from '@nestjs/common';

export class ToyyibPayCredentialError extends Error {}

export class ToyyibPayBillCreationError extends Error {}

interface GetCategoryDetailsSuccess {
  categoryName: string;
  categoryDescription: string;
  categoryStatus: string;
}

export interface SplitPaymentParams {
  recipientUsername: string;
  amountInCents: number;
}

export interface CreateBillParams {
  secretKey: string;
  categoryCode: string;
  billName: string;
  billDescription: string;
  amountInCents: number;
  returnUrl: string;
  callbackUrl: string;
  externalReferenceNo: string;
  payerName: string;
  payerEmail: string;
  payerPhone: string;
  chargeFeeToCustomer: boolean;
  splitPayment?: SplitPaymentParams;
}

export interface CreateBillResult {
  billCode: string;
  requestPayload: Record<string, string>;
  responsePayload: unknown;
}

export interface BillTransactionStatus {
  isPaid: boolean;
  isFailed: boolean;
}

@Injectable()
export class ToyyibPayApiClient {
  private readonly logger = new Logger(ToyyibPayApiClient.name);

  private get baseUrl(): string {
    return process.env.TOYYIBPAY_BASE_URL ?? 'https://dev.toyyibpay.com';
  }

  async getCategoryDetails(
    secretKey: string,
    categoryCode: string,
  ): Promise<GetCategoryDetailsSuccess> {
    const response = await fetch(
      `${this.baseUrl}/index.php/api/getCategoryDetails`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ userSecretKey: secretKey, categoryCode }),
      },
    );

    const rawBody = await response.text();
    return this.parseCategoryDetailsResponse(rawBody);
  }

  // Every bill this app creates is FPX-only (the schema's own comment on
  // MerchantToyyibPayPaymentPlatformOption already forces this) — split payment only works for
  // FPX too, so that constraint covers both. Per ToyyibPay's real API reference (not assumed):
  // billSplitPaymentArgs identifies the recipient by their toyyibPay USERNAME, not a category code
  // or secret key, and the split amount is a fixed cents value, never a percentage.
  async createBill(params: CreateBillParams): Promise<CreateBillResult> {
    const hasSplitPayment = params.splitPayment !== undefined;
    const requestPayload: Record<string, string> = {
      userSecretKey: params.secretKey,
      categoryCode: params.categoryCode,
      billName: params.billName.slice(0, 30),
      billDescription: params.billDescription.slice(0, 100),
      billPriceSetting: '1',
      billPayorInfo: '1',
      billAmount: String(params.amountInCents),
      billReturnUrl: params.returnUrl,
      billCallbackUrl: params.callbackUrl,
      billExternalReferenceNo: params.externalReferenceNo,
      billTo: params.payerName,
      billEmail: params.payerEmail,
      billPhone: params.payerPhone,
      billSplitPayment: hasSplitPayment ? '1' : '0',
      billPaymentChannel: '0',
      billChargeToCustomer: params.chargeFeeToCustomer ? '1' : '0',
      ...(hasSplitPayment && {
        billSplitPaymentArgs: JSON.stringify([
          {
            id: params.splitPayment!.recipientUsername,
            amount: String(params.splitPayment!.amountInCents),
          },
        ]),
      }),
    };

    const response = await fetch(`${this.baseUrl}/index.php/api/createBill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(requestPayload),
    });

    const rawBody = await response.text();
    const { billCode, responsePayload } = this.parseCreateBillResponse(rawBody);
    return { billCode, requestPayload, responsePayload };
  }

  getBillPaymentUrl(billCode: string): string {
    return `${this.baseUrl}/${billCode}`;
  }

  // Used by the reconciliation sweep/manual resync, not the webhook — asks ToyyibPay directly
  // "what actually happened to this bill" instead of waiting for them to tell us. Confirmed live
  // against a real paid bill: a bill with no transaction attempt yet returns the plain-text
  // "No data found!" (not JSON) rather than an empty array, so that has to be treated as "still
  // nothing definitive" rather than an error. A paid bill returns a JSON array of transactions,
  // each with billpaymentStatus using 1=success/3=fail, and both 2 and 4 as pending variants
  // (4 seen live on a real bank-settlement-pending transaction, not just in ToyyibPay's docs) —
  // anything other than 1 or 3 falls through to "still nothing definitive" below, which already
  // covers both. Conservative on purpose: only reports "failed" when every transaction attempt
  // on the bill failed — a mix of an earlier failed attempt and a still-open one is left as
  // "nothing definitive yet" rather than risk cancelling an order that might still get paid.
  async getBillTransactionStatus(
    secretKey: string,
    billCode: string,
  ): Promise<BillTransactionStatus> {
    const response = await fetch(
      `${this.baseUrl}/index.php/api/getBillTransactions`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ billCode, userSecretKey: secretKey }),
      },
    );

    const rawBody = await response.text();
    return this.parseBillTransactionsResponse(rawBody);
  }

  private parseBillTransactionsResponse(
    rawBody: string,
  ): BillTransactionStatus {
    const trimmed = rawBody.trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return { isPaid: false, isFailed: false };
    }

    const transactions = Array.isArray(parsed) ? parsed : [parsed];
    const paymentStatuses = transactions
      .filter((transaction): transaction is Record<string, unknown> =>
        this.isRecord(transaction),
      )
      .map((transaction) =>
        this.getFieldCaseInsensitive(transaction, 'billpaymentStatus'),
      );

    const isPaid = paymentStatuses.some((status) => status === '1');
    const isFailed =
      paymentStatuses.length > 0 &&
      paymentStatuses.every((status) => status === '3');
    return { isPaid, isFailed };
  }

  private parseCreateBillResponse(rawBody: string): {
    billCode: string;
    responsePayload: unknown;
  } {
    const trimmed = rawBody.trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      throw new ToyyibPayBillCreationError(
        `ToyyibPay rejected the bill request: ${trimmed}`,
      );
    }

    if (this.isErrorPayload(parsed)) {
      throw new ToyyibPayBillCreationError(
        `ToyyibPay rejected the bill request: ${parsed.msg}`,
      );
    }

    const details: unknown = Array.isArray(parsed)
      ? (parsed as unknown[])[0]
      : parsed;
    const billCode = this.isRecord(details)
      ? this.getFieldCaseInsensitive(details, 'BillCode')
      : undefined;
    if (typeof billCode !== 'string' || billCode.length === 0) {
      this.logger.warn(
        `ToyyibPay createBill response did not contain a BillCode: ${trimmed}`,
      );
      throw new ToyyibPayBillCreationError(
        'ToyyibPay did not return a bill code',
      );
    }

    return { billCode, responsePayload: parsed };
  }

  private parseCategoryDetailsResponse(
    rawBody: string,
  ): GetCategoryDetailsSuccess {
    const trimmed = rawBody.trim();

    // ToyyibPay's bracketed error codes ([KEY-DID-NOT-EXIST], [CATEGORY-NOT-MATCH],
    // [CATEGORY-IS-INACTIVE]) are plain text, never valid JSON — so a parse failure IS the
    // reliable signal for that case, unlike a fragile "starts with [ and contains -" guess
    // (which would misfire on a real categoryDescription that happens to contain a hyphen).
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      throw new ToyyibPayCredentialError(
        `ToyyibPay rejected the credentials: ${trimmed}`,
      );
    }

    if (this.isErrorPayload(parsed)) {
      throw new ToyyibPayCredentialError(
        `ToyyibPay rejected the credentials: ${parsed.msg}`,
      );
    }

    const details: unknown = Array.isArray(parsed)
      ? (parsed as unknown[])[0]
      : parsed;
    const categoryDetails = this.isRecord(details)
      ? this.extractCategoryDetails(details)
      : null;
    if (!categoryDetails) {
      this.logger.warn(
        `ToyyibPay getCategoryDetails response did not contain category details: ${trimmed}`,
      );
      throw new ToyyibPayCredentialError(
        'ToyyibPay category could not be verified',
      );
    }

    return categoryDetails;
  }

  // ToyyibPay's own docs say lowercase (categoryName), but the live API has been observed
  // returning CategoryName (capital C) — so field lookup can't assume either casing.
  private extractCategoryDetails(
    value: Record<string, unknown>,
  ): GetCategoryDetailsSuccess | null {
    const categoryName = this.getFieldCaseInsensitive(value, 'categoryName');
    const categoryDescription = this.getFieldCaseInsensitive(
      value,
      'categoryDescription',
    );
    const categoryStatus = this.getFieldCaseInsensitive(
      value,
      'categoryStatus',
    );

    const hasAllCategoryFields =
      typeof categoryName === 'string' &&
      typeof categoryDescription === 'string' &&
      typeof categoryStatus === 'string';

    if (!hasAllCategoryFields) {
      return null;
    }

    return { categoryName, categoryDescription, categoryStatus };
  }

  private getFieldCaseInsensitive(
    value: Record<string, unknown>,
    key: string,
  ): unknown {
    const matchedKey = Object.keys(value).find(
      (candidateKey) => candidateKey.toLowerCase() === key.toLowerCase(),
    );
    return matchedKey ? value[matchedKey] : undefined;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  private isErrorPayload(
    value: unknown,
  ): value is { status: string; msg: string } {
    return (
      typeof value === 'object' &&
      value !== null &&
      'status' in value &&
      value.status === 'error'
    );
  }
}
