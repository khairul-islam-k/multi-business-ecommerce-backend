import { Injectable, NotFoundException } from "@nestjs/common";
import { FinanceTaxStatus, Prisma } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";

@Injectable()
export class TaxLookupService {
  async assertActiveTax(
    client: Prisma.TransactionClient | PrismaService,
    businessId: string,
    taxId: string,
  ) {
    const tax = await client.financeTax.findFirst({
      where: {
        id: taxId,
        businessId,
        deletedAt: null,
        status: FinanceTaxStatus.ACTIVE,
      },
    });

    if (!tax) {
      throw new NotFoundException("Tax not found");
    }

    return tax;
  }
}
