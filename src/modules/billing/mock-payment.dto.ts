import { IsIn, IsString, Matches } from 'class-validator';

export class MockPaymentLookupDto {
  @IsString() @Matches(/^[A-Z0-9]{16}$/) paymentId: string;
}

export class MockPaymentSimulateDto extends MockPaymentLookupDto {
  @IsIn(['SUCCESS', 'FAILURE']) outcome: 'SUCCESS' | 'FAILURE';
}
