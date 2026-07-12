import { Module } from "@nestjs/common";

import { AccessModule } from "../access/access.module";
import { BusinessModule } from "../business/business.module";
import { CustomerAuthModule } from "../customer-auth/customer-auth.module";
import { FinanceModule } from "../finance/finance.module";
import { OrderModule } from "../orders/order.module";
import { PackageModule } from "../packages/package.module";
import { PermissionModule } from "../permissions/permission.module";
import { WebsiteModule } from "../website/website.module";
import { PaymentGatewayCoreModule } from "./payment-gateway-core.module";
import { PaymentGatewayController } from "./payment-gateway.controller";
import { PaymentGatewayService } from "./payment-gateway.service";
import { StorefrontPaymentGatewayController } from "./storefront-payment-gateway.controller";

@Module({
  imports: [
    AccessModule,
    BusinessModule,
    CustomerAuthModule,
    FinanceModule,
    OrderModule,
    PackageModule,
    PaymentGatewayCoreModule,
    PermissionModule,
    WebsiteModule,
  ],
  controllers: [PaymentGatewayController, StorefrontPaymentGatewayController],
  providers: [PaymentGatewayService],
  exports: [PaymentGatewayService],
})
export class PaymentGatewayModule {}
