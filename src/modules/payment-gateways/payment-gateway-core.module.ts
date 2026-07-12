import { Module } from "@nestjs/common";

import { PaymentConfigEncryptionService } from "./payment-config-encryption.service";
import { PaymentGatewayProviderService } from "./payment-gateway-provider.service";

@Module({
  providers: [PaymentConfigEncryptionService, PaymentGatewayProviderService],
  exports: [PaymentConfigEncryptionService, PaymentGatewayProviderService],
})
export class PaymentGatewayCoreModule {}
