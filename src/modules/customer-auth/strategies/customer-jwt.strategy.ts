import { eq } from "drizzle-orm";
import { ExtractJwt, Strategy } from "passport-jwt";

import { AppConfigService } from "@/common/config/app-config.service";
import {
  customer,
  customerAccount,
  CustomerStatus,
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
      throw new UnauthorizedException(
        "The customer access token is not valid for storefront requests. Please sign in through the storefront again and retry the request.",
      );
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
      throw new UnauthorizedException(
        "The customer access token could not be matched to an active storefront customer account. Please sign in again and retry the request.",
      );
    }

    if (
      row.account.deletedAt ||
      row.customer.deletedAt ||
      row.customer.status !== CustomerStatus.ACTIVE
    ) {
      throw new UnauthorizedException(
        "This customer account cannot use the storefront because the account or customer profile is inactive, blocked, or deleted. Please contact store support before trying again.",
      );
    }

    if (
      row.account.customerId !== payload.customerId ||
      row.account.websiteId !== payload.websiteId ||
      row.customer.businessId !== payload.businessId ||
      row.website.businessId !== payload.businessId
    ) {
      throw new UnauthorizedException(
        "The customer access token does not match this storefront, business, or customer profile. Please sign in again from the correct storefront and retry the request.",
      );
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
