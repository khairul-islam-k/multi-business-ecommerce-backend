import { Injectable } from "@nestjs/common";
import { AsyncLocalStorage } from "node:async_hooks";

import {
  BusinessAccessContext,
  RequestContextStore,
} from "./request-context.types";

@Injectable()
export class RequestContextService {
  private readonly storage = new AsyncLocalStorage<RequestContextStore>();

  run<T>(callback: () => T): T {
    return this.storage.run(
      {
        businessAccess: new Map(),
      },
      callback,
    );
  }

  getBusinessAccess(cacheKey: string) {
    return this.storage.getStore()?.businessAccess.get(cacheKey);
  }

  setBusinessAccess(cacheKey: string, context: BusinessAccessContext) {
    this.storage.getStore()?.businessAccess.set(cacheKey, context);
  }
}
