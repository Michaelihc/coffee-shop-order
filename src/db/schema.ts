import type { CompatDatabase } from "./connection";

export function migrateDatabase(db: CompatDatabase): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS pickup_windows (
      id                TEXT PRIMARY KEY,
      label             TEXT NOT NULL,
      starts_at         TEXT NOT NULL,
      ends_at           TEXT NOT NULL,
      made_to_order_cap INTEGER NOT NULL,
      is_active         INTEGER NOT NULL DEFAULT 1,
      sort_order        INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS categories (
      id          TEXT PRIMARY KEY,
      label       TEXT NOT NULL,
      sort_order  INTEGER NOT NULL DEFAULT 0,
      is_active   INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS menu_items (
      id            TEXT PRIMARY KEY,
      category_id   TEXT NOT NULL REFERENCES categories(id),
      name          TEXT NOT NULL,
      description   TEXT,
      price_cents   INTEGER NOT NULL,
      item_class    TEXT NOT NULL CHECK(item_class IN ('premade', 'made-to-order')),
      stock_count   INTEGER,
      is_available  INTEGER NOT NULL DEFAULT 1,
      image_url     TEXT,
      sort_order    INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS orders (
      id                TEXT PRIMARY KEY,
      student_aad_id    TEXT NOT NULL,
      student_name      TEXT NOT NULL,
      pickup_window_id  TEXT NOT NULL REFERENCES pickup_windows(id),
      payment_method    TEXT NOT NULL CHECK(payment_method IN ('student-card', 'pay-at-collect')),
      status            TEXT NOT NULL DEFAULT 'confirmed'
                          CHECK(status IN ('confirmed','preparing','ready','collected','cancelled')),
      pickup_code       TEXT,
      grid_slot         TEXT,
      total_cents       INTEGER NOT NULL,
      payment_ref       TEXT,
      payment_settled_at TEXT,
      cancel_reason     TEXT,
      cancel_note       TEXT,
      created_at        TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
      ready_at          TEXT,
      collected_at      TEXT,
      notes             TEXT
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id      TEXT NOT NULL REFERENCES orders(id),
      menu_item_id  TEXT NOT NULL REFERENCES menu_items(id),
      item_name     TEXT NOT NULL,
      price_cents   INTEGER NOT NULL,
      quantity      INTEGER NOT NULL DEFAULT 1,
      item_class    TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS grid_slots (
      id                TEXT PRIMARY KEY,
      label             TEXT NOT NULL,
      is_occupied       INTEGER NOT NULL DEFAULT 0,
      current_order_id  TEXT REFERENCES orders(id),
      zone              TEXT DEFAULT 'general'
    );

    CREATE TABLE IF NOT EXISTS staff (
      aad_id        TEXT PRIMARY KEY,
      display_name  TEXT NOT NULL,
      role          TEXT NOT NULL DEFAULT 'staff' CHECK(role IN ('staff', 'admin'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_orders_student ON orders(student_aad_id);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_orders_window ON orders(pickup_window_id);
    CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
    CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
    CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category_id);
  `);

  const orderColumns = db
    .prepare<{ name: string }>("PRAGMA table_info(orders)")
    .all();
  const orderColumnNames = new Set(orderColumns.map((column) => column.name));

  if (!orderColumnNames.has("payment_settled_at")) {
    db.exec("ALTER TABLE orders ADD COLUMN payment_settled_at TEXT");
  }
  if (!orderColumnNames.has("cancel_reason")) {
    db.exec("ALTER TABLE orders ADD COLUMN cancel_reason TEXT");
  }
  if (!orderColumnNames.has("cancel_note")) {
    db.exec("ALTER TABLE orders ADD COLUMN cancel_note TEXT");
  }

  db.exec(`
    UPDATE orders
    SET payment_settled_at = COALESCE(payment_settled_at, created_at)
    WHERE payment_method = 'student-card'
  `);

  db.exec(`
    UPDATE orders
    SET payment_settled_at = NULL
    WHERE payment_method = 'pay-at-collect'
  `);

  db.exec(`
    INSERT OR IGNORE INTO settings (key, value)
    VALUES ('daily_spend_limit_cents', '30000')
  `);
}
