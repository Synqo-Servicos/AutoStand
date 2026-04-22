import Database from "better-sqlite3";
import path from "path";
import type { Vehicle, VehicleInput, VehiclePhoto, VehicleWithPhotos } from "@/types/vehicle";
import type { Transaction, TransactionInput, TransactionWithVehicle } from "@/types/transaction";
import type { DashboardStats, MonthlyData, StockByStatus } from "@/types/dashboard";

const ALLOWED_VEHICLE_FIELDS = new Set([
  "brand", "model", "year", "km", "cost_price", "sale_price",
  "transmission", "fuel", "color", "doors", "description",
  "status", "primary_photo_url",
]);

export function createDb(dbPath = path.join(process.cwd(), "pedro-ivo.db")): Database.Database {
  const db = new Database(dbPath);
  db.pragma("foreign_keys = ON");
  db.pragma("journal_mode = WAL");

  db.prepare(`
    CREATE TABLE IF NOT EXISTS users (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      email      TEXT NOT NULL UNIQUE,
      password   TEXT NOT NULL,
      name       TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS vehicles (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      brand             TEXT NOT NULL,
      model             TEXT NOT NULL,
      year              INTEGER NOT NULL,
      km                INTEGER NOT NULL,
      cost_price        INTEGER NOT NULL,
      sale_price        INTEGER NOT NULL,
      transmission      TEXT NOT NULL DEFAULT 'automatico',
      fuel              TEXT NOT NULL DEFAULT 'flex',
      color             TEXT NOT NULL,
      doors             INTEGER NOT NULL DEFAULT 4,
      description       TEXT,
      status            TEXT NOT NULL DEFAULT 'disponivel',
      primary_photo_url TEXT,
      created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS vehicle_photos (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
      url        TEXT NOT NULL,
      order_idx  INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS transactions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_id  INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
      type        TEXT NOT NULL,
      amount      INTEGER NOT NULL,
      date        TEXT NOT NULL,
      buyer_name  TEXT,
      buyer_phone TEXT,
      notes       TEXT,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  return db;
}

let _singleton: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_singleton) _singleton = createDb();
  return _singleton;
}

// --- Vehicles ---

export interface VehicleFilters {
  status?: string;
  brand?: string;
  fuel?: string;
  transmission?: string;
  year_min?: number;
  year_max?: number;
  km_max?: number;
  price_min?: number;
  price_max?: number;
  search?: string;
}

export function listVehicles(filters: VehicleFilters = {}, db = getDb()): Vehicle[] {
  let query = "SELECT * FROM vehicles WHERE 1=1";
  const params: unknown[] = [];

  if (filters.status)       { query += " AND status = ?";      params.push(filters.status); }
  if (filters.brand)        { query += " AND brand = ?";        params.push(filters.brand); }
  if (filters.fuel)         { query += " AND fuel = ?";         params.push(filters.fuel); }
  if (filters.transmission) { query += " AND transmission = ?"; params.push(filters.transmission); }
  if (filters.year_min)     { query += " AND year >= ?";        params.push(filters.year_min); }
  if (filters.year_max)     { query += " AND year <= ?";        params.push(filters.year_max); }
  if (filters.km_max)       { query += " AND km <= ?";          params.push(filters.km_max); }
  if (filters.price_min)    { query += " AND sale_price >= ?";  params.push(filters.price_min); }
  if (filters.price_max)    { query += " AND sale_price <= ?";  params.push(filters.price_max); }
  if (filters.search) {
    query += " AND (brand LIKE ? OR model LIKE ?)";
    params.push(`%${filters.search}%`, `%${filters.search}%`);
  }

  query += " ORDER BY created_at DESC";
  return db.prepare(query).all(...params) as Vehicle[];
}

export function getVehicle(id: number, db = getDb()): Vehicle | null {
  return db.prepare("SELECT * FROM vehicles WHERE id = ?").get(id) as Vehicle | null;
}

export function getVehicleWithPhotos(id: number, db = getDb()): VehicleWithPhotos | null {
  const vehicle = db.prepare("SELECT * FROM vehicles WHERE id = ?").get(id) as Vehicle | null;
  if (!vehicle) return null;
  const photos = db
    .prepare("SELECT * FROM vehicle_photos WHERE vehicle_id = ? ORDER BY order_idx ASC")
    .all(id) as VehiclePhoto[];
  return { ...vehicle, photos };
}

export function createVehicle(input: VehicleInput, db = getDb()): Vehicle {
  const stmt = db.prepare(`
    INSERT INTO vehicles
      (brand, model, year, km, cost_price, sale_price, transmission, fuel,
       color, doors, description, status, primary_photo_url)
    VALUES
      (@brand, @model, @year, @km, @cost_price, @sale_price, @transmission, @fuel,
       @color, @doors, @description, @status, @primary_photo_url)
  `);
  const result = stmt.run(input);
  return db.prepare("SELECT * FROM vehicles WHERE id = ?").get(result.lastInsertRowid) as Vehicle;
}

export function updateVehicle(id: number, input: Partial<VehicleInput>, db = getDb()): Vehicle {
  const safe = Object.fromEntries(Object.entries(input).filter(([k]) => ALLOWED_VEHICLE_FIELDS.has(k)));
  if (Object.keys(safe).length > 0) {
    const fields = Object.keys(safe).map(k => `${k} = @${k}`).join(", ");
    db.prepare(`UPDATE vehicles SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = @id`).run({ ...safe, id });
  }
  return db.prepare("SELECT * FROM vehicles WHERE id = ?").get(id) as Vehicle;
}

export function deleteVehicle(id: number, db = getDb()): void {
  db.prepare("DELETE FROM vehicles WHERE id = ?").run(id);
}

// --- Photos ---

export function addPhoto(vehicleId: number, url: string, orderIdx = 0, db = getDb()): VehiclePhoto {
  const result = db
    .prepare("INSERT INTO vehicle_photos (vehicle_id, url, order_idx) VALUES (?, ?, ?)")
    .run(vehicleId, url, orderIdx);
  return db.prepare("SELECT * FROM vehicle_photos WHERE id = ?").get(result.lastInsertRowid) as VehiclePhoto;
}

export function deletePhoto(url: string, db = getDb()): void {
  db.prepare("DELETE FROM vehicle_photos WHERE url = ?").run(url);
}

export function getPhotosByVehicle(vehicleId: number, db = getDb()): VehiclePhoto[] {
  return db
    .prepare("SELECT * FROM vehicle_photos WHERE vehicle_id = ? ORDER BY order_idx ASC")
    .all(vehicleId) as VehiclePhoto[];
}

// --- Transactions ---

export interface TransactionFilters {
  vehicle_id?: number;
  type?: string;
  month?: string;
  year?: string;
}

export function listTransactions(filters: TransactionFilters = {}, db = getDb()): TransactionWithVehicle[] {
  let query = `
    SELECT t.*, v.brand as vehicle_brand, v.model as vehicle_model, v.year as vehicle_year
    FROM transactions t
    JOIN vehicles v ON v.id = t.vehicle_id
    WHERE 1=1
  `;
  const params: unknown[] = [];

  if (filters.vehicle_id) { query += " AND t.vehicle_id = ?"; params.push(filters.vehicle_id); }
  if (filters.type)       { query += " AND t.type = ?";       params.push(filters.type); }
  if (filters.year)       { query += " AND t.date LIKE ?";    params.push(`${filters.year}%`); }
  if (filters.month)      { query += " AND t.date LIKE ?";    params.push(`${filters.month}%`); }

  query += " ORDER BY t.date DESC, t.created_at DESC";
  return db.prepare(query).all(...params) as TransactionWithVehicle[];
}

export function createTransaction(input: TransactionInput, db = getDb()): Transaction {
  const doInsert = db.transaction((inp: TransactionInput) => {
    const result = db.prepare(`
      INSERT INTO transactions (vehicle_id, type, amount, date, buyer_name, buyer_phone, notes)
      VALUES (@vehicle_id, @type, @amount, @date, @buyer_name, @buyer_phone, @notes)
    `).run(inp);

    if (inp.type === "saida") {
      db.prepare("UPDATE vehicles SET status = 'vendido', updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .run(inp.vehicle_id);
    } else if (inp.type === "entrada") {
      db.prepare("UPDATE vehicles SET status = 'disponivel', updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .run(inp.vehicle_id);
    }

    return db.prepare("SELECT * FROM transactions WHERE id = ?").get(result.lastInsertRowid) as Transaction;
  });

  return doInsert(input);
}

export function updateTransaction(id: number, input: Partial<TransactionInput>, db = getDb()): Transaction {
  const allowed = new Set(["amount", "date", "buyer_name", "buyer_phone", "notes"]);
  const safe = Object.fromEntries(Object.entries(input).filter(([k]) => allowed.has(k)));
  if (Object.keys(safe).length > 0) {
    const fields = Object.keys(safe).map(k => `${k} = @${k}`).join(", ");
    db.prepare(`UPDATE transactions SET ${fields} WHERE id = @id`).run({ ...safe, id });
  }
  return db.prepare("SELECT * FROM transactions WHERE id = ?").get(id) as Transaction;
}

export function deleteTransaction(id: number, db = getDb()): void {
  db.prepare("DELETE FROM transactions WHERE id = ?").run(id);
}

// --- Dashboard ---

export function getDashboardStats(db = getDb()): DashboardStats {
  const now = new Date();
  const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const stockByStatus = db
    .prepare("SELECT status, COUNT(*) as count FROM vehicles GROUP BY status")
    .all() as StockByStatus[];

  const monthlySales = db
    .prepare(`
      SELECT COUNT(*) as units, COALESCE(SUM(amount), 0) as revenue
      FROM transactions WHERE type = 'saida' AND date LIKE ?
    `)
    .get(`${monthStr}%`) as { units: number; revenue: number };

  const totalCostValue = db
    .prepare("SELECT COALESCE(SUM(cost_price), 0) as total FROM vehicles WHERE status != 'vendido'")
    .get() as { total: number };

  const monthlyProfit = db
    .prepare(`
      SELECT COALESCE(SUM(t.amount - v.cost_price), 0) as profit
      FROM transactions t
      JOIN vehicles v ON v.id = t.vehicle_id
      WHERE t.type = 'saida' AND t.date LIKE ?
    `)
    .get(`${monthStr}%`) as { profit: number };

  const monthly = db
    .prepare(`
      SELECT strftime('%Y-%m', date) as month,
             SUM(t.amount) as revenue,
             SUM(t.amount - v.cost_price) as profit,
             COUNT(*) as units
      FROM transactions t
      JOIN vehicles v ON v.id = t.vehicle_id
      WHERE t.type = 'saida'
      GROUP BY month
      ORDER BY month DESC
      LIMIT 12
    `)
    .all() as MonthlyData[];

  return {
    stockByStatus,
    monthlySales: { units: monthlySales.units ?? 0, revenue: monthlySales.revenue ?? 0 },
    totalCostValue: totalCostValue.total ?? 0,
    monthlyProfit: monthlyProfit.profit ?? 0,
    monthly,
  };
}

// --- Users ---

export interface UserRow {
  id: number;
  email: string;
  password: string;
  name: string;
  created_at: string;
}

export function getUserByEmail(email: string, db = getDb()): UserRow | null {
  return db.prepare("SELECT * FROM users WHERE email = ?").get(email) as UserRow | null;
}

export function createUser(email: string, passwordHash: string, name: string, db = getDb()): void {
  db.prepare("INSERT INTO users (email, password, name) VALUES (?, ?, ?)").run(email, passwordHash, name);
}
