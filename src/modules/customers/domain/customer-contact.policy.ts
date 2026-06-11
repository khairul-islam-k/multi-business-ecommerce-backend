import { BadRequestException } from "@nestjs/common";

import {
  normalizeEmail,
  normalizeOptionalText,
} from "../../../common/text/normalizers";

type CustomerContactInput = {
  email?: string | null;
  phone?: string | null;
};

export function normalizeCustomerContact(contact: CustomerContactInput) {
  return {
    email: normalizeEmail(contact.email),
    phone: normalizeOptionalText(contact.phone),
  };
}

export function normalizeCustomerContactUpdate(contact: CustomerContactInput) {
  return {
    email:
      contact.email !== undefined ? normalizeEmail(contact.email) : undefined,
    phone:
      contact.phone !== undefined
        ? normalizeOptionalText(contact.phone)
        : undefined,
  };
}

export function assertCustomerContactAvailable(
  existingCustomer: { id: string } | null,
) {
  if (existingCustomer) {
    throw new BadRequestException(
      "Customer with this email or phone already exists for this business",
    );
  }
}
