import { IsEnum, IsNotEmpty, IsString, IsUUID } from 'class-validator';

export enum ToyyibPayCallbackStatus {
  SUCCESS = '1',
  PENDING = '2',
  FAILED = '3',
}

// Field names deliberately match ToyyibPay's own snake_case wire format (order_id,
// transaction_time), not this codebase's camelCase convention — this describes an external
// system's callback payload, not our own API. `order_id` is the billExternalReferenceNo we sent
// at bill-creation time, which is our own MerchantPayment.id. `amount` is kept as a string and
// never used for the actual charge — our stored payment.amount is the source of truth; ToyyibPay's
// copy is only useful for an optional mismatch-warning log. Real callbacks also include
// status_id, msg, transaction_id and fpx_transaction_id beyond what ToyyibPay's own docs list —
// those aren't modeled since they're unused, and the global ValidationPipe doesn't strip unknown
// properties, so they pass through harmlessly.
export class ToyyibPayWebhookCallbackDto {
  @IsString()
  @IsNotEmpty()
  refno!: string;

  @IsEnum(ToyyibPayCallbackStatus)
  status!: ToyyibPayCallbackStatus;

  @IsString()
  @IsNotEmpty()
  reason!: string;

  @IsString()
  @IsNotEmpty()
  billcode!: string;

  @IsUUID()
  order_id!: string;

  @IsString()
  @IsNotEmpty()
  amount!: string;

  @IsString()
  @IsNotEmpty()
  transaction_time!: string;

  @IsString()
  @IsNotEmpty()
  hash!: string;
}
