import { Injectable, NotFoundException } from "@nestjs/common";
import { OrderAddressType } from "@/database/schema";

import {
  CustomerAddressDto,
  UpdateCustomerAddressDto,
} from "../dto/customer.dto";
import { shouldUseDefaultAddress } from "../domain/customer-address.policy";
import { CustomerRepository } from "../infrastructure/customer.repository";
import {
  normalizeOptionalText,
  normalizeRequiredText,
} from "../../../common/text/normalizers";
import { apiResponse } from "../../../common/utils/api-response.util";

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
        addressType: dto.addressType ?? OrderAddressType.HOME,
        name: normalizeOptionalText(dto.name),
        address: normalizeRequiredText(dto.address),
        city: normalizeOptionalText(dto.city),
        country: normalizeOptionalText(dto.country),
        isDefault: shouldBeDefault,
      });
    });

    return apiResponse(address, "Customer address created successfully");
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

    return apiResponse(address, "Customer address updated successfully");
  }

  async removeAddress(
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

    return apiResponse(null, "Customer address deleted successfully");
  }

  private async getCustomerOrThrow(businessId: string, customerId: string) {
    const customer = await this.customers.findById(businessId, customerId);

    if (!customer) {
      throw new NotFoundException("Customer not found");
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
      throw new NotFoundException("Customer address not found");
    }

    return address;
  }
}
