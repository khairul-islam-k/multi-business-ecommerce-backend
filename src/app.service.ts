import { sql } from "drizzle-orm";

import { Injectable, InternalServerErrorException } from "@nestjs/common";

import { apiResponse } from "./common/utils/api-response.util";
import { DatabaseService } from "./database/database.service";

@Injectable()
export class AppService {
  constructor(private readonly database: DatabaseService) {}

  ping() {
    return apiResponse(null, "Server is up.");
  }

  async ready() {
    try {
      await this.database.db.execute(sql`SELECT 1`);
      return apiResponse(null, "Database is ready.");
    } catch {
      throw new InternalServerErrorException({
        message: "Couldn't connect to the database",
      });
    }
  }
}
