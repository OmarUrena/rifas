import { DynamicModule, Module } from '@nestjs/common';
import { OperationsController } from './operations/operations.controller';
import { OperationsService } from './operations/operations.service';
import { MediaController } from './catalog/media.controller';
import { CheckoutController } from './checkout/checkout.controller';
import { CheckoutService } from './checkout/checkout.service';
import { MulterModule } from '@nestjs/platform-express';
import { OrdersController, OrderUploadGuard, UploadCapacityInterceptor } from './orders/orders.controller';
import { OrdersService } from './orders/orders.service';
import { ReceiptService } from './orders/receipt.service';
import { PrivateStorageService } from './orders/private-storage.service';
import { PaymentsController } from './payments/payments.controller';
import { PaymentsService } from './payments/payments.service';
import { FinancialAuthorization, FinancialGuard } from './auth/financial.guard';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule, ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
import { SharedThrottlerStorage } from './common/shared-throttler';
import { APP_CONFIG, AppConfig } from './config/config';
import { DatabaseService } from './database/database.service';
import { HealthController } from './health/health.controller';
import { AdminGuard } from './auth/admin.guard';
import { AdminSessionController } from './auth/admin-session.controller';
import { CatalogService } from './catalog/catalog.service';
import { MediaService } from './catalog/media.service';
import { AdminRafflesController, PublicBankAccountsController, PublicRafflesController } from './catalog/catalog.controller';

@Module({})
export class AppModule {
  static register(config: AppConfig): DynamicModule {
    return {
      module: AppModule,
      imports: [ThrottlerModule.forRoot({
        throttlers: [{ ttl: config.rateTtlMs, limit: config.rateLimit }],
        skipIf: context => config.httpRateStore === 'postgres' && context.getClass() === HealthController && context.getHandler().name === 'health',
      }),
        MulterModule.register({limits:{fileSize:config.receiptMaxBytes,files:1,fields:9,parts:10,fieldNameSize:64,fieldSize:512}})],
      controllers: [MediaController,OperationsController,HealthController,PublicRafflesController,PublicBankAccountsController,AdminRafflesController,CheckoutController,OrdersController,PaymentsController,AdminSessionController],
      providers: [
        { provide: APP_CONFIG, useValue: config }, DatabaseService,AdminGuard,CatalogService,MediaService,CheckoutService,
        { provide: ThrottlerStorage, inject: [DatabaseService], useFactory: (db:DatabaseService) =>
          config.httpRateStore === 'postgres' ? new SharedThrottlerStorage(db,config) : new ThrottlerStorageService() },
        OrdersService,ReceiptService,PrivateStorageService,OrderUploadGuard,UploadCapacityInterceptor,
        OperationsService,PaymentsService,FinancialAuthorization,FinancialGuard,
        { provide: APP_GUARD, useClass: ThrottlerGuard },
      ],
    };
  }
}
