import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

// Posted by our own frontend's return-URL landing page, not by ToyyibPay directly — so this uses
// our own camelCase convention, unlike ToyyibPayWebhookCallbackDto (which mirrors ToyyibPay's
// wire format verbatim). billCode is the only field the authorization check actually uses; the
// rest are optional and only ever logged for diagnostics.
export class ConfirmToyyibPayReturnDto {
  @IsString()
  @IsNotEmpty()
  billCode!: string;

  @IsOptional()
  @IsString()
  statusId?: string;

  @IsOptional()
  @IsString()
  msg?: string;

  @IsOptional()
  @IsString()
  transactionId?: string;
}
