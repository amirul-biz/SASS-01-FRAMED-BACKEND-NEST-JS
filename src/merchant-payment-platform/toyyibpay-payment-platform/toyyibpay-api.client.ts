import { Injectable, Logger } from '@nestjs/common';

export class ToyyibPayCredentialError extends Error {}

interface GetCategoryDetailsSuccess {
  categoryName: string;
  categoryDescription: string;
  categoryStatus: string;
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
