import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { sql, type Logger as DrizzleLogger } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { AppConfigService } from "../common/config/app-config.service";
import * as schema from "./schema";

export type Database = NodePgDatabase<typeof schema>;
export type DatabaseTransaction = Parameters<
  Parameters<Database["transaction"]>[0]
>[0];

class NestDrizzleLogger implements DrizzleLogger {
  private readonly logger = new Logger("Drizzle");

  logQuery(query: string, _params: unknown[]) {
    const operation = query.trim().split(/\s+/)[0]?.toUpperCase() || "QUERY";

    if (["BEGIN", "COMMIT", "ROLLBACK"].includes(operation)) {
      return;
    }

    const tables = this.getQueriedTables(query);
    const tableLabel = tables.length > 0 ? tables.join(",") : "unknown";

    this.logger.debug(`${operation} ${tableLabel}`);
  }

  private getQueriedTables(query: string) {
    const tableRegex =
      /\b(?:FROM|JOIN|INTO|UPDATE)\s+(?:(?:"[^"]+"\.)?"([^"]+)"|([a-zA-Z_][\w.]*))/gi;
    const tables = new Set<string>();

    for (const match of query.matchAll(tableRegex)) {
      const rawTable = match[1] || match[2];

      if (!rawTable) {
        continue;
      }

      const table = rawTable.split(".").pop();

      if (table) {
        tables.add(table);
      }
    }

    return [...tables];
  }
}

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly pool: Pool;
  readonly db: Database;

  constructor(appConfig: AppConfigService) {
    this.pool = new Pool({
      connectionString: appConfig.databaseUrl,
    });

    this.db = drizzle({
      client: this.pool,
      schema,
      logger: new NestDrizzleLogger(),
    });
  }

  async onModuleInit() {
    await this.db.execute(sql`SELECT 1`);
  }

  async onModuleDestroy() {
    await this.pool.end();
  }
}
