import { eq } from "drizzle-orm";
import { ExtractJwt, Strategy } from "passport-jwt";

import { AppConfigService } from "@/common/config/app-config.service";
import {
  CustomerStatus,
  customer,
  customerAccount,
  website,
} from "@/database/schema";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";

import { DatabaseService } from "../../../database/database.service";

export type CustomerJwtPayload = {
  sub: string;
  customerId: string;
  websiteId: string;
  businessId: string;
  scope: "storefront";
};

export type CurrentCustomerPayload = {
  accountId: string;
  customerId: string;
  websiteId: string;
  businessId: string;
  email: string;
  name: string;
};

@Injectable()
export class CustomerJwtStrategy extends PassportStrategy(
  Strategy,
  "customer-jwt",
) {
  constructor(
    private readonly database: DatabaseService,
    configs: AppConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configs.jwtAccessSecret,
      ignoreExpiration: false,
    });
  }

  async validate(payload: CustomerJwtPayload): Promise<CurrentCustomerPayload> {
    if (payload.scope !== "storefront") {
      throw new UnauthorizedException("Invalid customer token");
    }

    const [row] = await this.database.db
      .select({
        account: customerAccount,
        customer,
        website,
      })
      .from(customerAccount)
      .innerJoin(customer, eq(customer.id, customerAccount.customerId))
      .innerJoin(website, eq(website.id, customerAccount.websiteId))
      .where(eq(customerAccount.id, payload.sub))
      .limit(1);

    if (!row) {
      throw new UnauthorizedException("Invalid customer token");
    }

    if (
      row.account.deletedAt ||
      row.customer.deletedAt ||
      row.customer.status !== CustomerStatus.ACTIVE
    ) {
      throw new UnauthorizedException("Customer account is not active");
    }

    if (
      row.account.customerId !== payload.customerId ||
      row.account.websiteId !== payload.websiteId ||
      row.customer.businessId !== payload.businessId ||
      row.website.businessId !== payload.businessId
    ) {
      throw new UnauthorizedException("Invalid customer token");
    }

    return {
      accountId: row.account.id,
      customerId: row.customer.id,
      websiteId: row.website.id,
      businessId: row.customer.businessId,
      email: row.account.email,
      name: row.customer.name,
    };
  }
}
