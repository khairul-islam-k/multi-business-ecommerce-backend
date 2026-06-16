import { customType } from "drizzle-orm/pg-core";
import Decimal from "decimal.js";

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export const decimal = customType<{
  data: Decimal;
  driverData: string;
  config: { precision?: number; scale?: number };
}>({
  dataType(config) {
    if (config?.precision !== undefined && config?.scale !== undefined) {
      return `numeric(${config.precision}, ${config.scale})`;
    }
    return "numeric";
  },
  fromDriver(value) {
    return new Decimal(value);
  },
  toDriver(value) {
    return new Decimal(value).toString();
  },
});
