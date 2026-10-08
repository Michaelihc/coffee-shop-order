import type { CompatDatabase } from "./connection";
import { DEFAULT_APP_SETTINGS } from "../config/app-settings";
import { getBusinessDateForStoredTimestamp } from "../services/business-time-service";
import { parseOrderSequenceForBusinessDate } from "../services/order-id-service";

const ORDERS_PAYMENT_METHOD_CHECK =
  "CHECK(payment_method IN ('student-card', 'pay-at-collect', 'cash-at-counter', 'wechat-pay'))";

function createOrdersTableSql(tableName = "orders"): string {
  return `
    CREATE TABLE IF NOT EXISTS ${tableName} (
      id                TEXT PRIMARY KEY,
      student_aad_id    TEXT NOT NULL,
      student_name      TEXT NOT NULL,
      customer_type     TEXT NOT NULL DEFAULT 'student' CHECK(customer_type IN ('student','guest')),
      guest_phone       TEXT,
      pickup_window_id  TEXT NOT NULL REFERENCES pickup_windows(id),
      payment_method    TEXT NOT NULL ${ORDERS_PAYMENT_METHOD_CHECK},
      payment_status    TEXT NOT NULL DEFAULT 'unpaid' CHECK(payment_status IN ('paid','pending','unpaid','refunded')),
      status            TEXT NOT NULL DEFAULT 'confirmed'
                          CHECK(status IN ('confirmed','preparing','ready','collected','cancelled')),
      pickup_code       TEXT,
      grid_slot         TEXT,
      total_cents       INTEGER NOT NULL,
      payment_ref       TEXT,
      payment_settled_at TEXT,
      cancel_reason     TEXT,
      cancel_note       TEXT,
      business_date     TEXT,
      created_at        TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
      ready_at          TEXT,
      collected_at      TEXT,
      notes             TEXT
    )`;
}

function getColumnNames(db: CompatDatabase, tableName: string): Set<string> {
  const rows = db.prepare<{ name: string }>(`PRAGMA table_info(${tableName})`).all();
  return new Set(rows.map((column) => column.name));
}

function selectColumnOrDefault(
  columnNames: Set<string>,
  columnName: string,
  defaultExpr = "NULL"
): string {
  return columnNames.has(columnName) ? columnName : defaultExpr;
}

function ensureOrdersTableSupportsGuests(db: CompatDatabase): void {
  const row = db
    .prepare<{ sql: string | null }>(
      "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'orders'"
    )
    .get();
  if (!row?.sql) {
    return;
  }

  const orderColumnNames = getColumnNames(db, "orders");
  const hasNewPaymentMethods = row.sql.includes("cash-at-counter") && row.sql.includes("wechat-pay");
  const hasGuestColumns =
    orderColumnNames.has("customer_type") &&
    orderColumnNames.has("guest_phone") &&
    orderColumnNames.has("payment_status");

  if (hasNewPaymentMethods && hasGuestColumns) {
    return;
  }

  const customerTypeExpr = orderColumnNames.has("customer_type")
    ? "COALESCE(customer_type, 'student')"
    : "'student'";
  const guestPhoneExpr = selectColumnOrDefault(orderColumnNames, "guest_phone");
  const paymentSettledAtColumn = selectColumnOrDefault(orderColumnNames, "payment_settled_at");
  const paymentStatusDefaultExpr =
    `CASE WHEN payment_method = 'student-card' AND ${paymentSettledAtColumn} IS NOT NULL THEN 'paid' ELSE 'unpaid' END`;
  const paymentStatusExpr = orderColumnNames.has("payment_status")
    ? `COALESCE(payment_status, ${paymentStatusDefaultExpr})`
    : paymentStatusDefaultExpr;
  const pickupCodeExpr = selectColumnOrDefault(orderColumnNames, "pickup_code");
  const gridSlotExpr = selectColumnOrDefault(orderColumnNames, "grid_slot");
  const paymentRefExpr = selectColumnOrDefault(orderColumnNames, "payment_ref");
  const paymentSettledAtExpr = selectColumnOrDefault(orderColumnNames, "payment_settled_at");
  const cancelReasonExpr = selectColumnOrDefault(orderColumnNames, "cancel_reason");
  const cancelNoteExpr = selectColumnOrDefault(orderColumnNames, "cancel_note");
  const businessDateExpr = selectColumnOrDefault(orderColumnNames, "business_date");
  const readyAtExpr = selectColumnOrDefault(orderColumnNames, "ready_at");
  const collectedAtExpr = selectColumnOrDefault(orderColumnNames, "collected_at");
  const notesExpr = selectColumnOrDefault(orderColumnNames, "notes");

  db.exec("PRAGMA foreign_keys=OFF");
  db.transaction(() => {
    db.exec("DROP TABLE IF EXISTS orders_new");
    db.exec(createOrdersTableSql("orders_new"));
    db.exec(`
      INSERT INTO orders_new (
        id,
        student_aad_id,
        student_name,
        customer_type,
        guest_phone,
        pickup_window_id,
        payment_method,
        payment_status,
        status,
        pickup_code,
        grid_slot,
        total_cents,
        payment_ref,
        payment_settled_at,
        cancel_reason,
        cancel_note,
        business_date,
        created_at,
        updated_at,
        ready_at,
        collected_at,
        notes
      )
      SELECT
        id,
        student_aad_id,
        student_name,
        ${customerTypeExpr},
        ${guestPhoneExpr},
        pickup_window_id,
        payment_method,
        ${paymentStatusExpr},
        status,
        ${pickupCodeExpr},
        ${gridSlotExpr},
        total_cents,
        ${paymentRefExpr},
        ${paymentSettledAtExpr},
        ${cancelReasonExpr},
        ${cancelNoteExpr},
        ${businessDateExpr},
        created_at,
        updated_at,
        ${readyAtExpr},
        ${collectedAtExpr},
        ${notesExpr}
      FROM orders
    `);
    db.exec("DROP TABLE orders");
    db.exec("ALTER TABLE orders_new RENAME TO orders");
  })();
  db.exec("PRAGMA foreign_keys=ON");
}

function backfillOrderSequences(db: CompatDatabase): void {
  const orders = db
    .prepare<{ id: string; business_date: string | null }>(
      "SELECT id, business_date FROM orders WHERE business_date IS NOT NULL AND TRIM(business_date) != ''"
    )
    .all();

  const nextSequenceByDate = new Map<string, number>();
  for (const order of orders) {
    if (!order.business_date) {
      continue;
    }

    const sequence = parseOrderSequenceForBusinessDate(order.id, order.business_date);
    if (!sequence) {
      continue;
    }

    const nextSequence = sequence + 1;
    const current = nextSequenceByDate.get(order.business_date) ?? 1;
    if (nextSequence > current) {
      nextSequenceByDate.set(order.business_date, nextSequence);
    }
  }

  const upsert = db.prepare(
    `INSERT INTO order_sequences (business_date, next_sequence)
     VALUES (?, ?)
     ON CONFLICT(business_date) DO UPDATE SET next_sequence =
       CASE
         WHEN excluded.next_sequence > order_sequences.next_sequence THEN excluded.next_sequence
         ELSE order_sequences.next_sequence
       END`
  );

  const tx = db.transaction(() => {
    for (const [businessDate, nextSequence] of nextSequenceByDate.entries()) {
      upsert.run(businessDate, nextSequence);
    }
  });
  tx();
}

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
      is_advertised INTEGER NOT NULL DEFAULT 0,
      image_url     TEXT,
      sort_order    INTEGER NOT NULL DEFAULT 0
    );

    ${createOrdersTableSql()};

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

    CREATE TABLE IF NOT EXISTS guest_users (
      phone         TEXT PRIMARY KEY,
      masked_phone  TEXT NOT NULL,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
      verified_at   TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS guest_sms_challenges (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      phone        TEXT NOT NULL,
      code_hash    TEXT NOT NULL,
      code_salt    TEXT NOT NULL,
      ip_address   TEXT,
      attempts     INTEGER NOT NULL DEFAULT 0,
      created_at   TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at   TEXT NOT NULL,
      consumed_at  TEXT
    );

    CREATE TABLE IF NOT EXISTS guest_sessions (
      token_hash  TEXT PRIMARY KEY,
      phone       TEXT NOT NULL REFERENCES guest_users(phone),
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at  TEXT NOT NULL,
      revoked_at  TEXT
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS order_sequences (
      business_date  TEXT PRIMARY KEY,
      next_sequence  INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payment_reconciliation_incidents (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id         TEXT,
      transaction_ref  TEXT NOT NULL,
      amount_cents     INTEGER NOT NULL,
      incident_type    TEXT NOT NULL,
      details          TEXT,
      created_at       TEXT NOT NULL DEFAULT (datetime('now')),
      resolved_at      TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_orders_student ON orders(student_aad_id);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_orders_window ON orders(pickup_window_id);
    CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
    CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
    CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category_id);
    CREATE INDEX IF NOT EXISTS idx_guest_sms_phone_created ON guest_sms_challenges(phone, created_at);
    CREATE INDEX IF NOT EXISTS idx_guest_sms_ip_created ON guest_sms_challenges(ip_address, created_at);
    CREATE INDEX IF NOT EXISTS idx_guest_sessions_phone ON guest_sessions(phone);
  `);

  ensureOrdersTableSupportsGuests(db);

  const orderColumnNames = getColumnNames(db, "orders");
  const menuItemColumns = db
    .prepare<{ name: string }>("PRAGMA table_info(menu_items)")
    .all();
  const menuItemColumnNames = new Set(menuItemColumns.map((column) => column.name));

  if (!orderColumnNames.has("payment_settled_at")) {
    db.exec("ALTER TABLE orders ADD COLUMN payment_settled_at TEXT");
  }
  if (!orderColumnNames.has("cancel_reason")) {
    db.exec("ALTER TABLE orders ADD COLUMN cancel_reason TEXT");
  }
  if (!orderColumnNames.has("cancel_note")) {
    db.exec("ALTER TABLE orders ADD COLUMN cancel_note TEXT");
  }
  if (!orderColumnNames.has("business_date")) {
    db.exec("ALTER TABLE orders ADD COLUMN business_date TEXT");
  }
  if (!orderColumnNames.has("customer_type")) {
    db.exec("ALTER TABLE orders ADD COLUMN customer_type TEXT NOT NULL DEFAULT 'student'");
  }
  if (!orderColumnNames.has("guest_phone")) {
    db.exec("ALTER TABLE orders ADD COLUMN guest_phone TEXT");
  }
  if (!orderColumnNames.has("payment_status")) {
    db.exec("ALTER TABLE orders ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'unpaid'");
  }
  if (!menuItemColumnNames.has("is_advertised")) {
    db.exec("ALTER TABLE menu_items ADD COLUMN is_advertised INTEGER NOT NULL DEFAULT 0");
  }

  db.exec("CREATE INDEX IF NOT EXISTS idx_orders_business_date ON orders(business_date)");

  db.exec(`
    UPDATE orders
    SET payment_settled_at = COALESCE(payment_settled_at, created_at),
        payment_status = 'paid'
    WHERE payment_method = 'student-card'
  `);

  db.exec(`
    UPDATE orders
    SET payment_settled_at = NULL,
        payment_status = CASE WHEN payment_method = 'wechat-pay' THEN payment_status ELSE 'unpaid' END
    WHERE payment_method IN ('pay-at-collect', 'cash-at-counter', 'wechat-pay')
  `);

  const insertDefaultSetting = db.prepare(
    "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)"
  );
  const seedDefaultSettings = db.transaction(() => {
    for (const [key, value] of Object.entries(DEFAULT_APP_SETTINGS)) {
      insertDefaultSetting.run(key, value);
    }
  });
  seedDefaultSettings();

  const ordersMissingBusinessDate = db
    .prepare<{ id: string; created_at: string }>(
      "SELECT id, created_at FROM orders WHERE business_date IS NULL OR TRIM(business_date) = ''"
    )
    .all();

  if (ordersMissingBusinessDate.length > 0) {
    const updateBusinessDate = db.prepare(
      "UPDATE orders SET business_date = ? WHERE id = ?"
    );
    const tx = db.transaction(() => {
      for (const order of ordersMissingBusinessDate) {
        updateBusinessDate.run(
          getBusinessDateForStoredTimestamp(order.created_at),
          order.id
        );
      }
    });
    tx();
  }

  backfillOrderSequences(db);
}
