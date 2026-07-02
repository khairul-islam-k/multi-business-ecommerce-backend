import "dotenv/config";

import { Logger } from "@nestjs/common";
import { sql } from "drizzle-orm";

import {
  CourierAreaType,
  courierAreaCatalog,
  JsonValue,
  NewCourierAreaCatalog,
} from "../src/database/schema";
import { createDrizzleScriptClient } from "./database-script-client";

const database = createDrizzleScriptClient();
const logger = new Logger("CourierAreaSeedScript");

const SOURCE = "BD_GEOCODE";
const CHUNK_SIZE = 500;

const sources = {
  divisions:
    "https://raw.githubusercontent.com/nuhil/bangladesh-geocode/master/divisions/divisions.json",
  districts:
    "https://raw.githubusercontent.com/nuhil/bangladesh-geocode/master/districts/districts.json",
  upazilas:
    "https://raw.githubusercontent.com/nuhil/bangladesh-geocode/master/upazilas/upazilas.json",
  unions:
    "https://raw.githubusercontent.com/nuhil/bangladesh-geocode/master/unions/unions.json",
} as const;

type GeoRow = Record<string, string | undefined>;
type GeoExport = Array<{
  type?: string;
  name?: string;
  data?: GeoRow[];
}>;

type AreaSeedRow = NewCourierAreaCatalog;

const main = async () => {
  logger.log("Downloading Bangladesh geography area catalog...");

  const [divisions, districts, upazilas, unions] = await Promise.all([
    loadGeoTable(sources.divisions, "divisions"),
    loadGeoTable(sources.districts, "districts"),
    loadGeoTable(sources.upazilas, "upazilas"),
    loadGeoTable(sources.unions, "unions"),
  ]);

  const divisionById = new Map(divisions.map((row) => [required(row.id), row]));
  const districtById = new Map(districts.map((row) => [required(row.id), row]));
  const upazilaById = new Map(upazilas.map((row) => [required(row.id), row]));

  const rows: AreaSeedRow[] = [
    ...divisions.map((division) => ({
      source: SOURCE,
      externalId: required(division.id),
      areaType: CourierAreaType.DIVISION,
      name: required(division.name),
      bnName: nullable(division.bn_name),
      divisionName: required(division.name),
      rawData: toJson(division),
    })),
    ...districts.map((district) => {
      const division = divisionById.get(required(district.division_id));

      return {
        source: SOURCE,
        externalId: required(district.id),
        areaType: CourierAreaType.DISTRICT,
        name: required(district.name),
        bnName: nullable(district.bn_name),
        divisionName: division?.name,
        districtName: required(district.name),
        parentExternalId: required(district.division_id),
        rawData: toJson(district),
      };
    }),
    ...upazilas.map((upazila) => {
      const district = districtById.get(required(upazila.district_id));
      const division = district
        ? divisionById.get(required(district.division_id))
        : undefined;

      return {
        source: SOURCE,
        externalId: required(upazila.id),
        areaType: CourierAreaType.UPAZILA,
        name: required(upazila.name),
        bnName: nullable(upazila.bn_name),
        divisionName: division?.name,
        districtName: district?.name,
        upazilaName: required(upazila.name),
        parentExternalId: required(upazila.district_id),
        rawData: toJson(upazila),
      };
    }),
    ...unions.map((union) => {
      const upazilaId = required(union.upazilla_id ?? union.upazila_id);
      const upazila = upazilaById.get(upazilaId);
      const district = upazila
        ? districtById.get(required(upazila.district_id))
        : undefined;
      const division = district
        ? divisionById.get(required(district.division_id))
        : undefined;

      return {
        source: SOURCE,
        externalId: required(union.id),
        areaType: CourierAreaType.UNION,
        name: required(union.name),
        bnName: nullable(union.bn_name),
        divisionName: division?.name,
        districtName: district?.name,
        upazilaName: upazila?.name,
        parentExternalId: upazilaId,
        rawData: toJson(union),
      };
    }),
  ];

  let seeded = 0;

  await database.db.transaction(async (tx) => {
    for (let index = 0; index < rows.length; index += CHUNK_SIZE) {
      const chunk = rows.slice(index, index + CHUNK_SIZE);

      await tx
        .insert(courierAreaCatalog)
        .values(chunk)
        .onConflictDoUpdate({
          target: [
            courierAreaCatalog.source,
            courierAreaCatalog.areaType,
            courierAreaCatalog.externalId,
          ],
          set: {
            name: sql`excluded.name`,
            bnName: sql`excluded.bn_name`,
            divisionName: sql`excluded.division_name`,
            districtName: sql`excluded.district_name`,
            upazilaName: sql`excluded.upazila_name`,
            parentExternalId: sql`excluded.parent_external_id`,
            rawData: sql`excluded.raw_data`,
            updatedAt: new Date(),
          },
        });

      seeded += chunk.length;
    }
  });

  logger.log(
    `Seeded ${seeded} courier area catalog rows from ${SOURCE}: ${divisions.length} divisions, ${districts.length} districts, ${upazilas.length} upazilas, ${unions.length} unions.`,
  );
};

const loadGeoTable = async (url: string, tableName: string) => {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Failed to download ${tableName} from ${url}: HTTP ${response.status}`,
    );
  }

  const payload = (await response.json()) as GeoExport;
  const table = payload.find(
    (entry) => entry.type === "table" && entry.name === tableName,
  );

  if (!table?.data?.length) {
    throw new Error(`No ${tableName} data found in ${url}`);
  }

  return table.data;
};

const required = (value: string | undefined) => {
  const trimmed = value?.trim();

  if (!trimmed) {
    throw new Error("Required geography value is missing");
  }

  return trimmed;
};

const nullable = (value: string | undefined) => {
  const trimmed = value?.trim();

  return trimmed || undefined;
};

const toJson = (value: GeoRow): JsonValue => value as JsonValue;

main()
  .catch((error) => {
    logger.error(
      "Failed to seed courier areas.",
      error instanceof Error ? error.stack : String(error),
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await database.close();
  });
