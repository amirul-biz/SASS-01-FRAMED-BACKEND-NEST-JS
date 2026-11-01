import { Module } from '@nestjs/common';
import { PrismaModule } from '../../config/database/prisma.module';
import { CommissionAdminController } from '../commission-admin/commission-admin.controller';
import { CommissionAdminRepository } from '../commission-admin/commission-admin.repository';
import { CommissionAdminService } from '../commission-admin/commission-admin.service';
import { CommissionCalculatorRegistry } from './commission-calculator.registry';
import { CommissionRepository } from './commission.repository';
import { CommissionService } from './commission.service';
import { AmountPerTransactionCommissionCalculator } from '../types/amount-per-transaction/amount-per-transaction.calculator';
import { AmountPerUnitCommissionCalculator } from '../types/amount-per-unit/amount-per-unit.calculator';
import { PercentagePerTransactionCommissionCalculator } from '../types/percentage-per-transaction/percentage-per-transaction.calculator';
import { PercentagePerUnitCommissionCalculator } from '../types/percentage-per-unit/percentage-per-unit.calculator';

@Module({
  imports: [PrismaModule],
  controllers: [CommissionAdminController],
  providers: [
    CommissionService,
    CommissionRepository,
    CommissionAdminService,
    CommissionAdminRepository,
    CommissionCalculatorRegistry,
    PercentagePerTransactionCommissionCalculator,
    AmountPerTransactionCommissionCalculator,
    PercentagePerUnitCommissionCalculator,
    AmountPerUnitCommissionCalculator,
  ],
  exports: [CommissionService],
})
export class CommissionModule {}
