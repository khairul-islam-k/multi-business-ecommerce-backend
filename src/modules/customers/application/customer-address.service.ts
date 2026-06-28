import { CustomerAddressType } from "@/database/schema";
import { Injectable, NotFoundException } from "@nestjs/common";

import {
  normalizeOptionalText,
  normalizeRequiredText,
} from "../../../common/text/normalizers";
import { apiResponse } from "../../../common/utils/api-response.util";
import { shouldUseDefaultAddress } from "../domain/customer-address.policy";
import {
  CustomerAddressDto,
  UpdateCustomerAddressDto,
} from "../dto/customer.dto";
import { CustomerRepository } from "../infrastructure/customer.repository";

import type { CurrentUserPayload } from "../../auth/decorators/current-user.decorator";

@Injectable()
export class CustomerAddressService {
  constructor(private readonly customers: CustomerRepository) {}

  async createAddress(
    businessId: string,
    customerId: string,
    dto: CustomerAddressDto,
  ) {
    await this.getCustomerOrThrow(businessId, customerId);

    const existingAddressCount =
      await this.customers.countAddresses(customerId);
    const shouldBeDefault = shouldUseDefaultAddress(
      dto.isDefault,
      existingAddressCount,
    );

    const address = await this.customers.transaction(async (tx) => {
      if (shouldBeDefault) {
        await this.customers.unsetDefaultAddresses(tx, customerId);
      }

      return this.customers.createAddress(tx, {
        customerId,
        addressType: dto.addressType ?? CustomerAddressType.HOME,
        name: normalizeOptionalText(dto.name),
        address: normalizeRequiredText(dto.address),
        city: normalizeOptionalText(dto.city),
        country: normalizeOptionalText(dto.country),
        isDefault: shouldBeDefault,
      });
    });

    return apiResponse(
      address,
      "Customer address was created successfully. The address has been saved and default-address rules were applied when requested.",
    );
  }

  async findAddresses(businessId: string, customerId: string) {
    await this.getCustomerOrThrow(businessId, customerId);

    return apiResponse(await this.customers.findAddresses(customerId));
  }

  async updateAddress(
    businessId: string,
    customerId: string,
    addressId: string,
    dto: UpdateCustomerAddressDto,
  ) {
    await this.getAddressOrThrow(businessId, customerId, addressId);

    const address = await this.customers.transaction(async (tx) => {
      if (dto.isDefault === true) {
        await this.customers.unsetDefaultAddresses(tx, customerId, addressId);
      }

      return this.customers.updateAddress(tx, addressId, {
        ...(dto.addressType !== undefined && {
          addressType: dto.addressType,
        }),
        ...(dto.name !== undefined && {
          name: normalizeOptionalText(dto.name),
        }),
        ...(dto.address !== undefined && {
          address: normalizeRequiredText(dto.address),
        }),
        ...(dto.city !== undefined && {
          city: normalizeOptionalText(dto.city),
        }),
        ...(dto.country !== undefined && {
          country: normalizeOptionalText(dto.country),
        }),
        ...(dto.isDefault !== undefined && { isDefault: dto.isDefault }),
      });
    });

    return apiResponse(
      address,
      "Customer address was updated successfully. The saved address now reflects the submitted details and default-address rules.",
    );
  }

  async removeAddress(
    currentUser: CurrentUserPayload,
    businessId: string,
    customerId: string,
    addressId: string,
  ) {
    const existingAddress = await this.getAddressOrThrow(
      businessId,
      customerId,
      addressId,
    );

    await this.customers.transaction(async (tx) => {
      await this.customers.updateAddress(tx, addressId, {
        isDefault: false,
        deletedAt: new Date(),
        deletedBy: currentUser.id,
      });

      if (existingAddress.isDefault) {
        const nextDefault = await this.customers.findNextDefaultAddress(
          tx,
          customerId,
        );

        if (nextDefault) {
          await this.customers.updateAddress(tx, nextDefault.id, {
            isDefault: true,
          });
        }
      }
    });

    return apiResponse(
      null,
      "Customer address was deleted successfully. The address has been soft-deleted and will no longer be used for customer checkout or profile flows.",
    );
  }

  private async getCustomerOrThrow(businessId: string, customerId: string) {
    const customer = await this.customers.findById(businessId, customerId);

    if (!customer) {
      throw new NotFoundException(
        "Customer could not be found. It may not exist, may have been deleted, or may not belong to the current business or storefront.",
      );
    }

    return customer;
  }

  private async getAddressOrThrow(
    businessId: string,
    customerId: string,
    addressId: string,
  ) {
    await this.getCustomerOrThrow(businessId, customerId);

    const address = await this.customers.findAddressById(customerId, addressId);

    if (!address) {
      throw new NotFoundException(
        "Customer address could not be found. It may not exist, may have been deleted, or may not belong to this customer.",
      );
    }

    return address;
  }
}
