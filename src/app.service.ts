import { Injectable, InternalServerErrorException } from "@nestjs/common";

import { PrismaService } from "./prisma/prisma.service";
import { apiResponse } from "./common/utils/api-response.util";

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  ping() {
    return apiResponse(null, "Server is up.");
  }

  async ready() {
    try {
      await this.prisma.$executeRaw`SELECT 1;`;
      return apiResponse(null, "Database is ready.");
    } catch {
      throw new InternalServerErrorException({
        message: "Couldn't connect to the database",
      });
    }
  }
}
