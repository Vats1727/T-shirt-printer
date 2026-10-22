import * as catalog from '../services/catalogStore.js';
import * as productsStore from '../services/productsStore.js';
import * as userStore from '../services/userStore.js';
import { db } from '../../db.js';
import { assets as assetsTable, designs as designsTable } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import fs from "fs/promises";
import path from "path";
export async function getCatalog(req, res) {
  const user = req.user;
  if (!user) return res.status(401).json({ message: "Not authenticated" });
  const userId = user.sub || user.id;
  const userRow = await userStore.findById(Number(userId));
  const ownerId = userRow?.associated_provider_id || (user.role === "print_provider" ? userId : null);
  const data = await catalog.listCatalog(ownerId);
  const list = await productsStore.listProducts(ownerId);
  const products = [];
  for (const p of list) {
    const full = await productsStore.getProduct(p.id, ownerId);
    if (full) products.push(full);
  }
  return res.json({ ...data, products });
}
export async function placeOrder(req, res) {
  const user = req.user;
  if (!user) return res.status(401).json({ message: "Not authenticated" });
  const { items, shipping } = req.body;
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ message: "items are required" });
  const MAX_ITEMS = 50;
  const MAX_QUANTITY = 1e3;
  const MAX_SNAPSHOT_BYTES = 500 * 1024;
  if (items.length > MAX_ITEMS) return res.status(400).json({ message: `Too many items (max ${MAX_ITEMS})` });
  const sanitizeSnapshot = (snap) => {
    if (!snap || typeof snap !== "object") return null;
    const clone = JSON.parse(JSON.stringify(snap));
    const stripLargeImages = (obj) => {
      if (!obj || typeof obj !== "object") return;
      for (const k of Object.keys(obj)) {
        const v = obj[k];
        if (typeof v === "string" && (v.startsWith("data:") || v.length > 200 * 1024)) {
          obj[k] = null;
        } else if (typeof v === "object") {
          stripLargeImages(v);
        }
      }
    };
    stripLargeImages(clone);
    return clone;
  };
  const itemsValidated = [];
  for (const it of items) {
    const quantity = Number(it.quantity || 0);
    if (!Number.isFinite(quantity) || quantity <= 0) return res.status(400).json({ message: "Invalid quantity" });
    if (quantity > MAX_QUANTITY) return res.status(400).json({ message: `Quantity exceeds maximum of ${MAX_QUANTITY}` });
    const validated = {
      product: it.product || "tshirt",
      color_id: Number(it.color_id),
      size_id: Number(it.size_id),
      quantity,
      price: Number(it.price || 0),
      design_id: it.design_id ? Number(it.design_id) : void 0
    };
    if (it.design_snapshot) {
      const sanitized = sanitizeSnapshot(it.design_snapshot);
      try {
        const bytes = Buffer.byteLength(JSON.stringify(sanitized || {}), "utf8");
        if (bytes > MAX_SNAPSHOT_BYTES) return res.status(400).json({ message: "Design snapshot too large" });
      } catch (e) {
        return res.status(400).json({ message: "Invalid design snapshot" });
      }
      validated.design_snapshot = sanitized;
    }
    itemsValidated.push(validated);
  }
  let orderId;
  try {
    orderId = await catalog.createSupplierOrder(user.sub || user.sub, user.sub || null, itemsValidated, shipping);
  } catch (e) {
    orderId = await catalog.createOrder(user.sub || user.sub, itemsValidated.map((it) => ({ product: it.product, color_id: it.color_id, size_id: it.size_id, quantity: it.quantity, price: it.price })));
  }
  return res.status(201).json({ id: orderId });
}
export async function listOrders(req, res) {
  const user = req.user;
  if (!user) return res.status(401).json({ message: "Not authenticated" });
  try {
    const orders = await catalog.listSupplierOrders(user.sub || user.sub);
    return res.json({ orders });
  } catch (e) {
    return res.status(500).json({ message: "Failed to list orders" });
  }
}
export async function getOrder(req, res) {
  const user = req.user;
  if (!user) return res.status(401).json({ message: "Not authenticated" });
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ message: "Invalid order id" });
  try {
    const ord = await catalog.getSupplierOrder(id);
    if (!ord) return res.status(404).json({ message: "Order not found" });
    if (Number(ord.supplier_id) !== Number(user.sub)) return res.status(403).json({ message: "Forbidden" });
    return res.json({ order: ord });
  } catch (e) {
    return res.status(500).json({ message: "Failed to fetch order" });
  }
}
export async function listSavedDesigns(req, res) {
  const user = req.user;
  try {
    const uid = req.user && (req.user.sub || req.user.id) ? req.user.sub || req.user.id : null;
    console.log("DEBUG: listSavedDesigns hit", { path: req.path, userId: uid, hasAuth: !!req.headers.authorization });
  } catch (e) {
  }
  if (!user) return res.status(401).json({ message: "Not authenticated" });
  try {
    if (!db) {
      try {
        const dir = path.join(process.cwd(), "client", "attached_assets");
        const files = await fs.readdir(dir);
        const groupsMap2 = {};
        for (const fname of files) {
          const m = fname.match(/^design-(\d+)-(front|back)\.(png|jpg|jpeg)$/i);
          if (!m) continue;
          const key = `design-${m[1]}`;
          const side = m[2] === "back" ? "back" : "front";
          if (!groupsMap2[key]) groupsMap2[key] = { key, front: null, back: null, any: null };
          const url = `/attached_assets/${fname}`;
          groupsMap2[key][side] = { id: null, filename: fname, url, mime: `image/${m[3]}`, metadata: { preview: true } };
        }
        const groups2 = Object.keys(groupsMap2).map((k) => ({ key: k, ...groupsMap2[k] }));
        return res.json({ designs: groups2 });
      } catch (e) {
        return res.status(500).json({ message: "DB not configured and failed to read attached_assets" });
      }
    }
    const userId = user.sub || user.id;
    const rows = await db.select().from(assetsTable).where(eq(assetsTable.uploader_id, Number(userId))).orderBy(assetsTable.id);
    const groupsMap = {};
    for (const p of rows) {
      let meta = p.metadata;
      try {
        if (meta && typeof meta === "string") meta = JSON.parse(meta);
      } catch (e) {
      }
      const previewFlag = meta && (meta.preview === true || meta.preview === "true");
      const designIdFromMeta = meta && (meta.designId || meta.design_id || meta.design);
      const filename = p.filename || "";
      const sideFromMeta = meta && (meta.side || meta.side_name);
      let key = null;
      let side = null;
      if (designIdFromMeta) {
        key = `design-${designIdFromMeta}`;
        side = sideFromMeta === "back" ? "back" : sideFromMeta === "front" ? "front" : null;
      }
      if (!key) {
        const m = String(filename || "").match(/^design-(\d+)-(front|back)\.(png|jpg|jpeg)$/i);
        if (m) {
          key = `design-${m[1]}`;
          side = m[2] === "back" ? "back" : "front";
        }
      }
      if (!previewFlag && !key) continue;
      const uploadsDir = path.resolve(process.cwd(), "server", "uploads");
      const altUploadsDir = path.resolve(process.cwd(), "uploads");
      const fileCandidates = [
        p.filename ? path.resolve(uploadsDir, p.filename) : null,
        p.filename ? path.resolve(altUploadsDir, p.filename) : null,
        p.storage_key ? path.resolve(uploadsDir, path.basename(p.storage_key)) : null,
        p.storage_key ? path.resolve(process.cwd(), p.storage_key) : null,
        p.storage_key ? path.resolve(process.cwd(), "server", p.storage_key) : null
      ].filter(Boolean);
      let fileFound = false;
      for (const fc of fileCandidates) {
        try {
          const st = await fs.stat(fc);
          if (st.isFile() && st.size > 200) {
            fileFound = true;
            break;
          }
        } catch (e) {
        }
      }
      if (!fileFound) continue;
      if (!groupsMap[key || `asset-${p.id}`]) groupsMap[key || `asset-${p.id}`] = { key: key || `asset-${p.id}`, front: null, back: null, any: null };
      const entry = { id: p.id, filename: p.filename, url: `/api/assets/${p.id}`, mime: p.mime, size: p.size, storage_key: p.storage_key, metadata: meta };
      if (side === "front") groupsMap[key || `asset-${p.id}`].front = entry;
      else if (side === "back") groupsMap[key || `asset-${p.id}`].back = entry;
      else groupsMap[key || `asset-${p.id}`].any = entry;
    }
    const groups = Object.keys(groupsMap).map((k) => ({ key: k, ...groupsMap[k] })).filter((g) => g.front || g.back || g.any);
    return res.json({ designs: groups });
  } catch (e) {
    console.error("listSavedDesigns error", e?.message || e);
    return res.status(500).json({ message: "Failed to list saved designs" });
  }
}
export async function listSavedDesignsPublic(_req, res) {
  try {
    if (!db) {
      try {
        const dir = path.join(process.cwd(), "client", "attached_assets");
        const files = await fs.readdir(dir);
        const groupsMap = {};
        for (const fname of files) {
          const m = fname.match(/^design-(\d+)-(front|back)\.(png|jpg|jpeg)$/i);
          if (!m) continue;
          const key = `design-${m[1]}`;
          const side = m[2] === "back" ? "back" : "front";
          if (!groupsMap[key]) groupsMap[key] = { key, front: null, back: null, any: null };
          const url = `/attached_assets/${fname}`;
          groupsMap[key][side] = { id: null, filename: fname, url, mime: `image/${m[3]}`, metadata: { preview: true } };
        }
        const groups = Object.keys(groupsMap).map((k) => ({ key: k, ...groupsMap[k] }));
        return res.json({ designs: groups });
      } catch (e) {
        return res.status(500).json({ message: "DB not configured and failed to read attached_assets" });
      }
    }
    const rows = await db.select().from(assetsTable).orderBy(assetsTable.id);
    const previews = rows.filter((r) => r && r.metadata && (r.metadata.preview === true || r.metadata.preview === "true"));
    const mapped = [];
    for (const p of previews) {
      const filename = p.filename;
      const clientPath = path.join(process.cwd(), "client", "attached_assets", filename || "");
      let url = `/api/assets/${p.id}`;
      try {
        if (filename) {
          await fs.access(clientPath);
          url = `/attached_assets/${filename}`;
        }
      } catch (e) {
      }
      mapped.push({ id: p.id, filename, mime: p.mime, size: p.size, storage_key: p.storage_key, metadata: p.metadata, url });
    }
    return res.json({ designs: mapped });
  } catch (e) {
    console.error("listSavedDesignsPublic error", e?.message || e);
    return res.status(500).json({ message: "Failed to list saved designs" });
  }
}
export async function updateProfile(req, res) {
  const user = req.user;
  if (!user) return res.status(401).json({ message: "Not authenticated" });
  const userId = user.sub || user.id;
  const { associated_provider_id } = req.body;
  try {
    await userStore.updateUser(Number(userId), { associated_provider_id: associated_provider_id ? Number(associated_provider_id) : null });
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ message: e.message || "Failed to update profile" });
  }
}
export const getDesignsByGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const results = await db.select({ design_code: designsTable.design_code }).from(designsTable).where(eq(designsTable.group_id, groupId)).orderBy(designsTable.id);
    return res.json(results.map((r) => r.design_code).filter(Boolean));
  } catch (e) {
    return res.status(500).json({ message: e.message || "Failed to fetch group designs" });
  }
};
export const getDesignByGroupAndCode = async (req, res) => {
  try {
    const { groupId, designCode } = req.params;
    const [design] = await db.select().from(designsTable).where(
      and(
        eq(designsTable.group_id, groupId),
        eq(designsTable.design_code, designCode)
      )
    ).limit(1);
    if (!design) {
      return res.status(400).json({ message: "Invalid design code" });
    }
    return res.json(design);
  } catch (e) {
    return res.status(500).json({ message: e.message || "Failed to fetch design" });
  }
};
