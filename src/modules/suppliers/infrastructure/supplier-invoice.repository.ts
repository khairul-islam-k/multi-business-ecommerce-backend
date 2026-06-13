import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../../prisma/prisma.service";

@Injectable()
export class SupplierInvoiceRepository {
  constructor(readonly prisma: PrismaService) {}
}
