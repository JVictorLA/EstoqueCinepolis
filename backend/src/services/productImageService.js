const fs = require("fs/promises");
const path = require("path");
const sharp = require("sharp");

const uploadDir = path.join(__dirname, "..", "..", "uploads", "produtos");
const publicPrefix = "/uploads/produtos";
const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

function assertAllowedFile(file) {
  if (!file) {
    throw Object.assign(new Error("Imagem obrigatória"), { status: 400 });
  }

  if (!allowedMimeTypes.has(file.mimetype)) {
    throw Object.assign(new Error("Formato inválido. Use JPG, PNG ou WebP"), { status: 400 });
  }
}

function publicUrlFor(filename) {
  return `${publicPrefix}/${filename}`;
}

function filenameFromUrl(imageUrl) {
  if (!imageUrl || typeof imageUrl !== "string") return null;
  if (!imageUrl.startsWith(`${publicPrefix}/`)) return null;
  const filename = path.basename(imageUrl);
  if (!filename || filename.includes("..")) return null;
  return filename;
}

async function saveProductImage(productId, file) {
  assertAllowedFile(file);
  await fs.mkdir(uploadDir, { recursive: true });

  let metadata;
  try {
    metadata = await sharp(file.buffer).metadata();
  } catch {
    throw Object.assign(new Error("Arquivo de imagem inválido"), { status: 400 });
  }
  if (!["jpeg", "png", "webp"].includes(metadata.format)) {
    throw Object.assign(new Error("Arquivo de imagem inválido"), { status: 400 });
  }

  const filename = `produto-${productId}-${Date.now()}.webp`;
  const outputPath = path.join(uploadDir, filename);

  await sharp(file.buffer)
    .rotate()
    .resize(512, 512, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80 })
    .toFile(outputPath);

  return publicUrlFor(filename);
}

async function deleteProductImage(imageUrl) {
  const filename = filenameFromUrl(imageUrl);
  if (!filename) return;

  const filePath = path.join(uploadDir, filename);
  const resolvedUploadDir = path.resolve(uploadDir);
  const resolvedFilePath = path.resolve(filePath);
  if (!resolvedFilePath.startsWith(`${resolvedUploadDir}${path.sep}`)) return;

  try {
    await fs.unlink(resolvedFilePath);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

module.exports = {
  saveProductImage,
  deleteProductImage,
};
