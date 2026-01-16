import { eq, and, desc, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, users, 
  skus, InsertSku, Sku,
  syncHistory, InsertSyncHistory,
  transportConfig, InsertTransportConfig,
  shipments, InsertShipment,
  shipmentItems, InsertShipmentItem,
  promotions, InsertPromotion,
  promotionSales, InsertPromotionSale,
  springFestivalConfig, InsertSpringFestivalConfig,
  shippingPlans, InsertShippingPlan,
  actualShipments, InsertActualShipment,
  factoryInventory, InsertFactoryInventory
} from "../drizzle/schema";
import { ENV } from './_core/env';
import * as crypto from 'crypto';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// 密码哈希函数
export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// ==================== 用户相关 ====================
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// 用户名密码登录
export async function getUserByUsername(username: string) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// 注册新用户
export async function createUserWithPassword(username: string, password: string, brandName?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const hashedPassword = hashPassword(password);
  const openId = `local_${username}_${Date.now()}`;
  
  await db.insert(users).values({
    openId,
    username,
    password: hashedPassword,
    brandName: brandName || username,
    name: username,
    loginMethod: 'password',
  });
  
  return getUserByUsername(username);
}

// 更新密码
export async function updateUserPassword(userId: number, newPassword: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const hashedPassword = hashPassword(newPassword);
  await db.update(users).set({ password: hashedPassword }).where(eq(users.id, userId));
}

// ==================== SKU相关 ====================
export async function getSkusByBrand(brandName: string) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(skus).where(eq(skus.brandName, brandName)).orderBy(desc(skus.updatedAt));
}

export async function getSkuById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(skus).where(eq(skus.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getSkuBySku(sku: string, brandName: string) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(skus)
    .where(and(eq(skus.sku, sku), eq(skus.brandName, brandName)))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createSku(data: InsertSku) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(skus).values(data);
  return result;
}

export async function updateSku(id: number, data: Partial<InsertSku>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(skus).set(data).where(eq(skus.id, id));
}

export async function deleteSku(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(skus).where(eq(skus.id, id));
}

export async function clearAllSkus(brandName: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(skus).where(eq(skus.brandName, brandName));
}

export async function batchUpsertSkus(items: InsertSku[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  for (const item of items) {
    const existing = await getSkuBySku(item.sku, item.brandName);
    if (existing) {
      await updateSku(existing.id, item);
    } else {
      await createSku(item);
    }
  }
}

// ==================== 库存同步历史 ====================
export async function createSyncHistory(data: InsertSyncHistory) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(syncHistory).values(data);
  return result;
}

export async function updateSyncHistory(id: number, data: Partial<InsertSyncHistory>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(syncHistory).set(data).where(eq(syncHistory.id, id));
}

export async function getSyncHistoryByBrand(brandName: string) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(syncHistory)
    .where(eq(syncHistory.brandName, brandName))
    .orderBy(desc(syncHistory.createdAt))
    .limit(50);
}

// ==================== 运输配置 ====================
export async function getTransportConfig(brandName: string) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(transportConfig)
    .where(eq(transportConfig.brandName, brandName))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function upsertTransportConfig(brandName: string, data: Partial<InsertTransportConfig>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const existing = await getTransportConfig(brandName);
  if (existing) {
    await db.update(transportConfig).set(data).where(eq(transportConfig.id, existing.id));
  } else {
    await db.insert(transportConfig).values({ ...data, brandName });
  }
}

// ==================== 货件管理 ====================
export async function getShipmentsByBrand(brandName: string) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(shipments)
    .where(eq(shipments.brandName, brandName))
    .orderBy(desc(shipments.createdAt));
}

export async function getShipmentById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(shipments).where(eq(shipments.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createShipment(data: InsertShipment) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(shipments).values(data);
  return result;
}

export async function updateShipment(id: number, data: Partial<InsertShipment>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(shipments).set(data).where(eq(shipments.id, id));
}

export async function deleteShipment(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(shipmentItems).where(eq(shipmentItems.shipmentId, id));
  await db.delete(shipments).where(eq(shipments.id, id));
}

export async function clearAllShipments(brandName: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const brandShipments = await getShipmentsByBrand(brandName);
  for (const s of brandShipments) {
    await db.delete(shipmentItems).where(eq(shipmentItems.shipmentId, s.id));
  }
  await db.delete(shipments).where(eq(shipments.brandName, brandName));
}

// 货件明细
export async function getShipmentItems(shipmentId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(shipmentItems).where(eq(shipmentItems.shipmentId, shipmentId));
}

export async function createShipmentItem(data: InsertShipmentItem) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(shipmentItems).values(data);
}

export async function getShipmentItemsBySku(skuId: number) {
  const db = await getDb();
  if (!db) return [];
  
  // 只返回运输中的货件
  return db.select({
    item: shipmentItems,
    shipment: shipments
  })
  .from(shipmentItems)
  .innerJoin(shipments, eq(shipmentItems.shipmentId, shipments.id))
  .where(and(
    eq(shipmentItems.skuId, skuId),
    eq(shipments.status, 'shipping')
  ));
}

// 获取品牌所有货件明细
export async function getAllShipmentItems(brandName: string) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select({
    id: shipmentItems.id,
    shipmentId: shipmentItems.shipmentId,
    skuId: shipmentItems.skuId,
    sku: shipmentItems.sku,
    quantity: shipmentItems.quantity,
  })
  .from(shipmentItems)
  .innerJoin(shipments, eq(shipmentItems.shipmentId, shipments.id))
  .where(eq(shipments.brandName, brandName));
}

// ==================== 促销管理 ====================
export async function getPromotionsByBrand(brandName: string) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(promotions)
    .where(eq(promotions.brandName, brandName))
    .orderBy(desc(promotions.createdAt));
}

export async function getPromotionById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(promotions).where(eq(promotions.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createPromotion(data: InsertPromotion) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(promotions).values(data);
  return result;
}

export async function updatePromotion(id: number, data: Partial<InsertPromotion>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(promotions).set(data).where(eq(promotions.id, id));
}

export async function deletePromotion(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(promotionSales).where(eq(promotionSales.promotionId, id));
  await db.delete(promotions).where(eq(promotions.id, id));
}

// 促销销量
export async function getPromotionSales(promotionId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(promotionSales).where(eq(promotionSales.promotionId, promotionId));
}

export async function upsertPromotionSale(data: InsertPromotionSale) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const existing = await db.select().from(promotionSales)
    .where(and(
      eq(promotionSales.promotionId, data.promotionId),
      eq(promotionSales.skuId, data.skuId)
    ))
    .limit(1);
  
  if (existing.length > 0) {
    await db.update(promotionSales)
      .set({ lastYearSales: data.lastYearSales })
      .where(eq(promotionSales.id, existing[0].id));
  } else {
    await db.insert(promotionSales).values(data);
  }
}

// ==================== 春节配置 ====================
export async function getSpringFestivalConfig(brandName: string, year: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(springFestivalConfig)
    .where(and(
      eq(springFestivalConfig.brandName, brandName),
      eq(springFestivalConfig.year, year)
    ))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function upsertSpringFestivalConfig(brandName: string, year: number, data: Partial<InsertSpringFestivalConfig>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const existing = await getSpringFestivalConfig(brandName, year);
  if (existing) {
    await db.update(springFestivalConfig).set(data).where(eq(springFestivalConfig.id, existing.id));
  } else {
    await db.insert(springFestivalConfig).values({ ...data, brandName, year });
  }
}

// ==================== 发货计划 ====================
export async function getShippingPlansByBrand(brandName: string) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(shippingPlans)
    .where(eq(shippingPlans.brandName, brandName))
    .orderBy(desc(shippingPlans.createdAt));
}

export async function createShippingPlan(data: InsertShippingPlan) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(shippingPlans).values(data);
}

// 实际发货记录
export async function getActualShipmentsByBrand(brandName: string) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(actualShipments)
    .where(eq(actualShipments.brandName, brandName))
    .orderBy(desc(actualShipments.createdAt));
}

export async function getActualShipmentsBySku(skuId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(actualShipments)
    .where(eq(actualShipments.skuId, skuId))
    .orderBy(desc(actualShipments.shipDate));
}

export async function createActualShipment(data: InsertActualShipment) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(actualShipments).values(data);
}

export async function deleteActualShipment(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(actualShipments).where(eq(actualShipments.id, id));
}

// ==================== 工厂库存 ====================
export async function getFactoryInventoryByBrand(brandName: string, month?: string) {
  const db = await getDb();
  if (!db) return [];
  
  if (month) {
    return db.select().from(factoryInventory)
      .where(and(
        eq(factoryInventory.brandName, brandName),
        eq(factoryInventory.month, month)
      ));
  }
  return db.select().from(factoryInventory)
    .where(eq(factoryInventory.brandName, brandName))
    .orderBy(desc(factoryInventory.month));
}

export async function upsertFactoryInventory(data: InsertFactoryInventory) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const existing = await db.select().from(factoryInventory)
    .where(and(
      eq(factoryInventory.brandName, data.brandName),
      eq(factoryInventory.skuId, data.skuId),
      eq(factoryInventory.month, data.month)
    ))
    .limit(1);
  
  if (existing.length > 0) {
    await db.update(factoryInventory)
      .set({
        quantity: data.quantity,
        additionalOrder: data.additionalOrder,
        suggestedOrder: data.suggestedOrder
      })
      .where(eq(factoryInventory.id, existing[0].id));
  } else {
    await db.insert(factoryInventory).values(data);
  }
}

// 初始化默认用户
export async function initDefaultUser() {
  const db = await getDb();
  if (!db) return;
  
  const existing = await getUserByUsername('ELYONA');
  if (!existing) {
    await createUserWithPassword('ELYONA', '123456', 'ELYONA');
    console.log('[Database] Default user ELYONA created');
  }
}
