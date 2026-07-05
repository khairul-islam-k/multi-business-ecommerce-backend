import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "crypto";

import { Injectable } from "@nestjs/common";

import { AppConfigService } from "../../common/config/app-config.service";

import type { JsonValue } from "@/database/schema";

const ALGORITHM = "aes-256-gcm";
const ENCRYPTED_CONFIG_VERSION = 1;

type EncryptedConfig = {
  encrypted: true;
  version: number;
  algorithm: typeof ALGORITHM;
  iv: string;
  tag: string;
  data: string;
};

@Injectable()
export class CourierConfigEncryptionService {
  constructor(private readonly appConfig: AppConfigService) {}

  encrypt(value: Record<string, unknown>): JsonValue {
    const iv = randomBytes(12);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(value), "utf8"),
      cipher.final(),
    ]);

    return {
      encrypted: true,
      version: ENCRYPTED_CONFIG_VERSION,
      algorithm: ALGORITHM,
      iv: iv.toString("base64"),
      tag: cipher.getAuthTag().toString("base64"),
      data: encrypted.toString("base64"),
    };
  }

  decrypt(value: JsonValue): Record<string, unknown> {
    if (!this.isEncryptedConfig(value)) {
      return this.asObject(value);
    }

    const decipher = createDecipheriv(
      ALGORITHM,
      this.key,
      Buffer.from(value.iv, "base64"),
    );

    decipher.setAuthTag(Buffer.from(value.tag, "base64"));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(value.data, "base64")),
      decipher.final(),
    ]);

    return this.asObject(JSON.parse(decrypted.toString("utf8")) as JsonValue);
  }

  private get key() {
    return createHash("sha256")
      .update(this.appConfig.paymentConfigEncryptionKey)
      .digest();
  }

  private isEncryptedConfig(value: JsonValue): value is EncryptedConfig {
    return (
      typeof value === "object" &&
      value !== null &&
      !Array.isArray(value) &&
      value.encrypted === true &&
      value.algorithm === ALGORITHM &&
      typeof value.iv === "string" &&
      typeof value.tag === "string" &&
      typeof value.data === "string"
    );
  }

  private asObject(value: JsonValue): Record<string, unknown> {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return {};
    }

    return value;
  }
}
