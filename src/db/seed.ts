import type { CompatDatabase } from "./connection";
import { DEFAULT_APP_SETTINGS } from "../config/app-settings";
import { allowUnsafeHeaderAuth, isLocalDevMode } from "../config/runtime-mode";

function parseAadIdList(value?: string): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function seedIfEmpty(db: CompatDatabase): void {
  const count = db.prepare("SELECT COUNT(*) as n FROM categories").get() as {
    n: number;
  };
  if (count.n > 0) return;

  const tx = db.transaction(() => {
    // Categories
    const insertCat = db.prepare(
      "INSERT INTO categories (id, label, sort_order, is_active) VALUES (?, ?, ?, 1)"
    );
    insertCat.run("coffee", "Coffee", 0);
    insertCat.run("cold-drinks", "Cold Drinks", 1);
    insertCat.run("snacks", "Snacks", 2);
    insertCat.run("quick-grab", "Quick Grab", 3);

    // Menu items
    const insertItem = db.prepare(`
      INSERT INTO menu_items (id, category_id, name, description, price_cents, item_class, stock_count, is_available, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
    `);
    // Coffee (made-to-order)
    insertItem.run("latte", "coffee", "Latte", "Freshly made latte", 350, "made-to-order", null, 0);
    insertItem.run("cappuccino", "coffee", "Cappuccino", "Classic cappuccino", 350, "made-to-order", null, 1);
    insertItem.run("americano", "coffee", "Americano", "Long black coffee", 300, "made-to-order", null, 2);
    insertItem.run("hot-choc", "coffee", "Hot Chocolate", "Rich hot chocolate", 300, "made-to-order", null, 3);
    // Cold drinks (premade)
    insertItem.run("water", "cold-drinks", "Water Bottle", "Still water 500ml", 150, "premade", 30, 0);
    insertItem.run("juice-orange", "cold-drinks", "Orange Juice", "Fresh orange juice", 250, "premade", 15, 1);
    insertItem.run("juice-apple", "cold-drinks", "Apple Juice", "Apple juice box", 200, "premade", 15, 2);
    // Snacks (premade)
    insertItem.run("muffin-choc", "snacks", "Chocolate Muffin", "Double chocolate muffin", 280, "premade", 12, 0);
    insertItem.run("muffin-blue", "snacks", "Blueberry Muffin", "Fresh blueberry muffin", 280, "premade", 10, 1);
    insertItem.run("cookie", "snacks", "Cookie", "Chocolate chip cookie", 200, "premade", 20, 2);
    // Quick grab (premade)
    insertItem.run("chips", "quick-grab", "Crisps", "Assorted flavour crisps", 150, "premade", 25, 0);
    insertItem.run("fruit-cup", "quick-grab", "Fruit Cup", "Mixed fresh fruit", 300, "premade", 8, 1);

    // Pickup windows
    const insertWindow = db.prepare(
      "INSERT INTO pickup_windows (id, label, starts_at, ends_at, made_to_order_cap, is_active, sort_order) VALUES (?, ?, ?, ?, ?, 1, ?)"
    );
    insertWindow.run("early-break", "Early Break", "09:50", "10:05", 15, 0);
    insertWindow.run("mid-break", "Mid Break", "10:05", "10:20", 15, 1);
    insertWindow.run("late-break", "Late Break", "10:20", "10:35", 10, 2);

    // Grid slots (20 numbered cubbies)
    const insertSlot = db.prepare(
      "INSERT INTO grid_slots (id, label, is_occupied, zone) VALUES (?, ?, 0, 'general')"
    );
    for (let i = 1; i <= 20; i++) {
      insertSlot.run(String(i), `Slot ${i}`);
    }

    if (isLocalDevMode() && allowUnsafeHeaderAuth()) {
      const insertStaff = db.prepare(
        "INSERT INTO staff (aad_id, display_name, role) VALUES (?, ?, ?)"
      );

      for (const aadId of parseAadIdList(process.env.DEV_STAFF_AAD_IDS)) {
        insertStaff.run(aadId, `Dev Staff (${aadId})`, "staff");
      }

      const adminIds = parseAadIdList(process.env.DEV_ADMIN_AAD_IDS);
      if (adminIds.length === 0) {
        adminIds.push("dev-user");
      }
      for (const aadId of adminIds) {
        insertStaff.run(aadId, `Dev Admin (${aadId})`, "admin");
      }
    }

    // Default settings
    const insertSetting = db.prepare(
      "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)"
    );
    for (const [key, value] of Object.entries(DEFAULT_APP_SETTINGS)) {
      insertSetting.run(key, value);
    }
  });

  tx();
}
