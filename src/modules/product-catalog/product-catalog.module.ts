import { Module } from "@nestjs/common";

import { ProductAttributeService } from "./attributes/product-attribute.service";
import { ProductBrandService } from "./brands/product-brand.service";
import { ProductCategoryService } from "./categories/product-category.service";
import { ProductCatalogLookupService } from "./common/product-catalog-lookup.service";
import { ProductService } from "./products/product.service";
import { ProductReviewService } from "./reviews/product-review.service";
import { ProductTagService } from "./tags/product-tag.service";
import { ProductUnitService } from "./units/product-unit.service";
import { ProductVariantService } from "./variants/product-variant.service";
import { ProductAttributeController } from "./attributes/product-attribute.controller";
import { ProductBrandController } from "./brands/product-brand.controller";
import { ProductCategoryController } from "./categories/product-category.controller";
import { ProductController } from "./products/product.controller";
import { ProductReviewController } from "./reviews/product-review.controller";
import { ProductTagController } from "./tags/product-tag.controller";
import { ProductUnitController } from "./units/product-unit.controller";
import { ProductVariantController } from "./variants/product-variant.controller";
import { AccessModule } from "../access/access.module";
import { BusinessModule } from "../business/business.module";
import { PackageModule } from "../packages/package.module";
import { PermissionModule } from "../permissions/permission.module";

@Module({
  imports: [AccessModule, BusinessModule, PermissionModule, PackageModule],
  controllers: [
    ProductCategoryController,
    ProductBrandController,
    ProductUnitController,
    ProductTagController,
    ProductController,
    ProductAttributeController,
    ProductVariantController,
    ProductReviewController,
  ],
  providers: [
    ProductCatalogLookupService,
    ProductCategoryService,
    ProductBrandService,
    ProductUnitService,
    ProductTagService,
    ProductService,
    ProductAttributeService,
    ProductVariantService,
    ProductReviewService,
  ],
  exports: [
    ProductCatalogLookupService,
    ProductCategoryService,
    ProductBrandService,
    ProductUnitService,
    ProductTagService,
    ProductService,
    ProductAttributeService,
    ProductVariantService,
    ProductReviewService,
  ],
})
export class ProductCatalogModule {}
