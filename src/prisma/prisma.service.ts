import { PrismaPg } from "@prisma/adapter-pg";
import { ConfigService } from "@nestjs/config";
import { Prisma, PrismaClient } from "@prisma/client";
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";

const prismaLogOptions = [
  {
    emit: "event" as const,
    level: "query" as const,
  },
  {
    emit: "event" as const,
    level: "warn" as const,
  },
  {
    emit: "event" as const,
    level: "error" as const,
  },
] satisfies Prisma.PrismaClientOptions["log"];

type PrismaLogLevel = "query" | "warn" | "error";

@Injectable()
export class PrismaService
  extends PrismaClient<Prisma.PrismaClientOptions, PrismaLogLevel>
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger("Prisma");

  constructor(configService: ConfigService) {
    const databaseUrl = configService.getOrThrow<string>("DATABASE_URL");

    const adapter = new PrismaPg({
      connectionString: databaseUrl,
    });

    const options = {
      adapter,
      log: prismaLogOptions,
    } satisfies Prisma.PrismaClientOptions;

    super(options);
  }

  async onModuleInit() {
    this.$on("query", (event) => {
      const operation = this.getQueryOperation(event.query);

      if (this.isTransactionQuery(operation)) {
        return;
      }

      const tables = this.getQueriedTables(event.query);
      const tableLabel = tables.length > 0 ? tables.join(",") : "unknown";

      const message = `${operation} ${tableLabel} ${event.duration}ms`;

      this.logger.debug(message);
    });

    this.$on("warn", (event) => {
      this.logger.warn(event.message);
    });

    this.$on("error", (event) => {
      this.logger.error(event.message);
    });

    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  private getQueryOperation(query: string) {
    return query.trim().split(/\s+/)[0]?.toUpperCase() || "QUERY";
  }

  private isTransactionQuery(operation: string) {
    return ["BEGIN", "COMMIT", "ROLLBACK"].includes(operation);
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
