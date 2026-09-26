import { Module } from '@nestjs/common';
import { PrismaModule } from '../../config/database/prisma.module';
import { CommissionCalculatorRegistry } from './commission-calculator.registry';
import { CommissionRepository } from './commission.repository';
import { CommissionService } from './commission.service';
import { AmountPerTransactionCommissionCalculator } from '../types/amount-per-transaction/amount-per-transaction.calculator';
import { AmountPerUnitCommissionCalculator } from '../types/amount-per-unit/amount-per-unit.calculator';
import { PercentagePerTransactionCommissionCalculator } from '../types/percentage-per-transaction/percentage-per-transaction.calculator';
import { PercentagePerUnitCommissionCalculator } from '../types/percentage-per-unit/percentage-per-unit.calculator';

@Module({
  imports: [PrismaModule],
  providers: [
    CommissionService,
    CommissionRepository,
    CommissionCalculatorRegistry,
    PercentagePerTransactionCommissionCalculator,
    AmountPerTransactionCommissionCalculator,
    PercentagePerUnitCommissionCalculator,
    AmountPerUnitCommissionCalculator,
  ],
  exports: [CommissionService],
})
export class CommissionModule {}
