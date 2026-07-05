import { and, eq, isNull } from "drizzle-orm";

import { financeTax, FinanceTaxStatus } from "@/database/schema";
import { Injectable, NotFoundException } from "@nestjs/common";

import {
  Database,
  DatabaseService,
  DatabaseTransaction,
} from "../../../database/database.service";

@Injectable()
export class TaxLookupService {
  constructor(private readonly database: DatabaseService) {}

  async assertActiveTax(
    client: Database | DatabaseTransaction | undefined,
    businessId: string,
    taxId: string,
  ) {
    const db = client ?? this.database.db;
    const [tax] = await db
      .select()
      .from(financeTax)
      .where(
        and(
          eq(financeTax.id, taxId),
          eq(financeTax.businessId, businessId),
          isNull(financeTax.deletedAt),
          eq(financeTax.status, FinanceTaxStatus.ACTIVE),
        ),
      )
      .limit(1);

    if (!tax) {
      throw new NotFoundException(
        "Tax could not be found. It may not exist, may have been deleted, or may not belong to the current business.",
      );
    }

    return tax;
  }
}
