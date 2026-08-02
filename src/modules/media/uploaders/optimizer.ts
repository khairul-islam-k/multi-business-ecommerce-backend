import sharp from "sharp";

export type ImageInput = Buffer | Uint8Array | ArrayBuffer | readonly number[];

export type OptimizedImageFormat = "webp" | "jpeg" | "png" | "avif";

export interface OptimizeImageOptions {
  width?: number;
  height?: number;
  format?: OptimizedImageFormat;
  quality?: number;
  withoutEnlargement?: boolean;
}

export interface OptimizedImage {
  buffer: Buffer;
  format: OptimizedImageFormat;
  extension: string;
  mimeType: string;
  size: number;
  width: number;
  height: number;
}

const formatMetadata = {
  webp: {
    extension: ".webp",
    mimeType: "image/webp",
    defaultQuality: 82,
  },
  jpeg: {
    extension: ".jpg",
    mimeType: "image/jpeg",
    defaultQuality: 82,
  },
  png: {
    extension: ".png",
    mimeType: "image/png",
    defaultQuality: 100,
  },
  avif: {
    extension: ".avif",
    mimeType: "image/avif",
    defaultQuality: 50,
  },
} as const satisfies Record<
  OptimizedImageFormat,
  {
    extension: string;
    mimeType: string;
    defaultQuality: number;
  }
>;

function normalizeImageInput(input: ImageInput): Buffer {
  if (Buffer.isBuffer(input)) {
    return input;
  }

  if (input instanceof Uint8Array) {
    return Buffer.from(input.buffer, input.byteOffset, input.byteLength);
  }

  if (input instanceof ArrayBuffer) {
    return Buffer.from(input);
  }

  // Handles a regular number[] containing encoded image bytes.
  return Buffer.from(input);
}

export async function optimizeImage(
  input: ImageInput,
  options: OptimizeImageOptions = {},
): Promise<OptimizedImage> {
  const {
    width = 1920,
    height = 1920,
    format = "webp",
    withoutEnlargement = true,
  } = options;

  if (width <= 0 || height <= 0) {
    throw new RangeError("Image width and height must be greater than zero");
  }

  const metadata = formatMetadata[format];
  const quality = options.quality ?? metadata.defaultQuality;

  if (quality < 1 || quality > 100) {
    throw new RangeError("Image quality must be between 1 and 100");
  }

  let pipeline = sharp(normalizeImageInput(input), {
    // Prevent exceptionally large inputs from exhausting memory.
    limitInputPixels: 40_000_000,
    failOn: "warning",
  })
    .autoOrient()
    .resize({
      width,
      height,
      fit: "inside",
      withoutEnlargement,
    });

  switch (format) {
    case "webp":
      pipeline = pipeline.webp({
        quality,
        effort: 4,
        smartSubsample: true,
      });
      break;

    case "jpeg":
      pipeline = pipeline.jpeg({
        quality,
        mozjpeg: true,
      });
      break;

    case "png":
      // PNG compression is lossless; quality is not used here.
      pipeline = pipeline.png({
        compressionLevel: 9,
        adaptiveFiltering: true,
      });
      break;

    case "avif":
      pipeline = pipeline.avif({
        quality,
        effort: 4,
      });
      break;

    default: {
      const unsupportedFormat: never = format;
      throw new Error(`Unsupported image format: ${unsupportedFormat}`);
    }
  }

  const { data, info } = await pipeline.toBuffer({
    resolveWithObject: true,
  });

  return {
    buffer: data,
    format,
    extension: metadata.extension,
    mimeType: metadata.mimeType,
    size: info.size,
    width: info.width,
    height: info.height,
  };
}
