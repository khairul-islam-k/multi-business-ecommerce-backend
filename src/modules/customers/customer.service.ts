import { Injectable, NotFoundException } from "@nestjs/common";
import { OrderCustomerStatus } from "@/database/schema";

import type { CurrentUserPayload } from "../auth/decorators/current-user.decorator";
import {
  CreateCustomerDto,
  CustomerAddressDto,
  CustomerSortBy,
  CustomerSortOrder,
  QueryCustomerDto,
  QueryCustomerOrderDto,
  UpdateCustomerAddressDto,
  UpdateCustomerDto,
} from "./dto/customer.dto";
import {
  assertCustomerContactAvailable,
  normalizeCustomerContact,
  normalizeCustomerContactUpdate,
} from "./domain/customer-contact.policy";
import { CustomerAddressService } from "./application/customer-address.service";
import { CustomerOrderQueryService } from "./application/customer-order-query.service";
import { CustomerRepository } from "./infrastructure/customer.repository";
import { getPagination } from "../../common/http/pagination.util";
import { resolveSort, resolveSortDirection } from "../../common/http/sort.util";
import {
  normalizeOptionalText,
  normalizeRequiredText,
} from "../../common/text/normalizers";
import {
  apiResponse,
  paginatedResponse,
} from "../../common/utils/api-response.util";

const CUSTOMER_SORTS = Object.values(CustomerSortBy);

@Injectable()
export class CustomerService {
  constructor(
    private readonly customers: CustomerRepository,
    private readonly addresses: CustomerAddressService,
    private readonly orders: CustomerOrderQueryService,
  ) {}

  async create(
    currentUser: CurrentUserPayload,
    businessId: string,
    dto: CreateCustomerDto,
  ) {
    const contact = normalizeCustomerContact(dto);

    assertCustomerContactAvailable(
      await this.customers.findExistingContact(businessId, contact),
    );

    const customer = await this.customers.create({
      businessId,
      name: normalizeRequiredText(dto.name),
      email: contact.email,
      phone: contact.phone,
      status: dto.status ?? OrderCustomerStatus.ACTIVE,
      note: normalizeOptionalText(dto.note),
      createdBy: currentUser.id,
      updatedBy: currentUser.id,
    });

    return apiResponse(customer, "Customer created successfully");
  }

  async findAll(businessId: string, query: QueryCustomerDto) {
    const pagination = getPagination(query);
    const sortBy = resolveSort(
      query.sortBy,
      CUSTOMER_SORTS,
      CustomerSortBy.CREATED_AT,
    );
    const sortOrder = resolveSortDirection(
      query.sortOrder,
      CustomerSortOrder.DESC,
    );

    const where = {
      businessId,
      status: query.status,
      search: query.search,
    };

    const orderBy = [
      { field: sortBy, direction: sortOrder },
      { field: CustomerSortBy.CREATED_AT, direction: CustomerSortOrder.DESC },
    ];

    const [items, total] = await this.customers.findPage({
      where,
      skip: pagination.skip,
      take: pagination.limit,
      orderBy,
    });

    return paginatedResponse(items, pagination.meta(total));
  }

  async findOne(businessId: string, customerId: string) {
    return apiResponse(await this.getCustomerOrThrow(businessId, customerId));
  }

  async update(
    currentUser: CurrentUserPayload,
    businessId: string,
    customerId: string,
    dto: UpdateCustomerDto,
  ) {
    await this.getCustomerOrThrow(businessId, customerId);

    const contact = normalizeCustomerContactUpdate(dto);

    if (contact.email !== undefined || contact.phone !== undefined) {
      assertCustomerContactAvailable(
        await this.customers.findExistingContact(
          businessId,
          contact,
          customerId,
        ),
      );
    }

    const customer = await this.customers.update(customerId, {
      ...(dto.name !== undefined && {
        name: normalizeRequiredText(dto.name),
      }),
      ...(dto.email !== undefined && { email: contact.email }),
      ...(dto.phone !== undefined && { phone: contact.phone }),
      ...(dto.status !== undefined && { status: dto.status }),
      ...(dto.note !== undefined && {
        note: normalizeOptionalText(dto.note),
      }),
      updatedBy: currentUser.id,
    });

    return apiResponse(customer, "Customer updated successfully");
  }

  async remove(
    currentUser: CurrentUserPayload,
    businessId: string,
    customerId: string,
  ) {
    await this.getCustomerOrThrow(businessId, customerId);

    const deletedAt = new Date();

    await this.customers.transaction(async (tx) => {
      await this.customers.softDeleteAddresses(tx, customerId, deletedAt);
      await this.customers.softDeleteCustomer(
        tx,
        customerId,
        currentUser.id,
        deletedAt,
      );
    });

    return apiResponse(null, "Customer deleted successfully");
  }

  createAddress(
    businessId: string,
    customerId: string,
    dto: CustomerAddressDto,
  ) {
    return this.addresses.createAddress(businessId, customerId, dto);
  }

  findAddresses(businessId: string, customerId: string) {
    return this.addresses.findAddresses(businessId, customerId);
  }

  updateAddress(
    businessId: string,
    customerId: string,
    addressId: string,
    dto: UpdateCustomerAddressDto,
  ) {
    return this.addresses.updateAddress(businessId, customerId, addressId, dto);
  }

  removeAddress(businessId: string, customerId: string, addressId: string) {
    return this.addresses.removeAddress(businessId, customerId, addressId);
  }

  findOrders(
    businessId: string,
    customerId: string,
    query: QueryCustomerOrderDto,
  ) {
    return this.orders.findOrders(businessId, customerId, query);
  }

  private async getCustomerOrThrow(businessId: string, customerId: string) {
    const customer = await this.customers.findById(businessId, customerId);

    if (!customer) {
      throw new NotFoundException("Customer not found");
    }

    return customer;
  }
}
