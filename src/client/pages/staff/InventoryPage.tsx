import React, { useState, useEffect } from "react";
import {
  Button,
  Input,
  Switch,
  Spinner,
  Dropdown,
  Option,
  Dialog,
  DialogTrigger,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogActions,
  DialogContent,
  MessageBar,
  MessageBarBody,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { useTranslation } from "react-i18next";
import {
  deleteInventoryItem,
  fetchInventory,
  removeInventoryImage,
  saveInventoryItem,
  updateInventoryAvailability,
  updateInventoryStock,
  uploadInventoryImage,
} from "../../admin-api";
import type { MenuItem, Category } from "../../../types/models";

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    maxWidth: "900px",
    marginLeft: "auto",
    marginRight: "auto",
  },
  heading: {
    fontSize: tokens.fontSizeBase500,
    fontWeight: tokens.fontWeightBold,
    margin: 0,
  },
  topBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    textAlign: "left" as const,
    padding: "8px",
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
    borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
  },
  td: {
    padding: "8px",
    borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
    fontSize: tokens.fontSizeBase300,
  },
  stockInput: {
    width: "70px",
  },
  thumb: {
    width: "40px",
    height: "40px",
    objectFit: "cover" as const,
    borderRadius: "6px",
  },
  formField: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    marginBottom: "12px",
  },
  fieldLabel: {
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground3,
  },
  actions: {
    display: "flex",
    gap: "4px",
  },
});

const emptyForm = {
  id: "",
  categoryId: "",
  name: "",
  description: "",
  priceCents: 0,
  itemClass: "premade" as string,
  stockCount: 0,
};

export function InventoryPage() {
  const styles = useStyles();
  const { t } = useTranslation();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  function fetchItems() {
    fetchInventory()
      .then((data) => {
        setItems(data.items);
        setCategories(data.categories);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchItems();
  }, []);

  function clearMessages() {
    setError(null);
    setSuccess(null);
  }

  async function handleStockChange(itemId: string, stockCount: number) {
    await updateInventoryStock(itemId, stockCount);
    fetchItems();
  }

  async function handleToggleAvailable(itemId: string, isAvailable: boolean) {
    await updateInventoryAvailability(itemId, isAvailable);
    fetchItems();
  }

  function openAdd() {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(item: MenuItem) {
    setEditingId(item.id);
    setForm({
      id: item.id,
      categoryId: item.categoryId,
      name: item.name,
      description: item.description || "",
      priceCents: item.priceCents,
      itemClass: item.itemClass,
      stockCount: item.stockCount ?? 0,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    clearMessages();
    setSaving(true);
    try {
      await saveInventoryItem({
        id: form.id,
        categoryId: form.categoryId,
        name: form.name,
        description: form.description || null,
        priceCents: form.priceCents,
        itemClass: form.itemClass,
        stockCount: form.stockCount,
      }, editingId);
      if (editingId) {
        setSuccess(t("inventory.itemUpdated"));
      } else {
        setSuccess(t("inventory.itemCreated"));
      }
      setDialogOpen(false);
      fetchItems();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("common.failedToSave"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(itemId: string) {
    if (!confirm(t("inventory.deleteConfirm"))) return;
    clearMessages();
    try {
      const result = await deleteInventoryItem(itemId);
      if (result.softDeleted) {
        setSuccess(t("inventory.softDeleted"));
      } else {
        setSuccess(t("inventory.itemDeleted"));
      }
      fetchItems();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("common.failedToDelete"));
    }
  }

  async function handleImageUpload(itemId: string, file: File) {
    clearMessages();
    try {
      await uploadInventoryImage(itemId, file);
      setSuccess(t("inventory.imageUploaded"));
      fetchItems();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("inventory.failedUpload"));
    }
  }

  async function handleImageRemove(itemId: string) {
    clearMessages();
    try {
      await removeInventoryImage(itemId);
      setSuccess(t("inventory.imageRemoved"));
      fetchItems();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("inventory.failedRemove"));
    }
  }

  if (loading) return <Spinner label={t("inventory.loading")} />;

  return (
    <div className={styles.container}>
      <div className={styles.topBar}>
        <h2 className={styles.heading}>{t("inventory.title")}</h2>
        <Button appearance="primary" size="small" onClick={openAdd}>
          {t("inventory.addItem")}
        </Button>
      </div>

      {error && (
        <MessageBar intent="error">
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      )}
      {success && (
        <MessageBar intent="success">
          <MessageBarBody>{success}</MessageBarBody>
        </MessageBar>
      )}

      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.th}>{t("inventory.image")}</th>
            <th className={styles.th}>{t("inventory.item")}</th>
            <th className={styles.th}>{t("inventory.category")}</th>
            <th className={styles.th}>{t("inventory.price")}</th>
            <th className={styles.th}>{t("inventory.type")}</th>
            <th className={styles.th}>{t("inventory.stock")}</th>
            <th className={styles.th}>{t("inventory.available")}</th>
            <th className={styles.th}>{t("common.actions")}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td className={styles.td}>
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt="" className={styles.thumb} />
                ) : (
                  <span style={{ color: tokens.colorNeutralForeground4, fontSize: tokens.fontSizeBase100 }}>
                    {t("inventory.noImg")}
                  </span>
                )}
              </td>
              <td className={styles.td}>{item.name}</td>
              <td className={styles.td}>
                {categories.find((c) => c.id === item.categoryId)?.label ?? item.categoryId}
              </td>
              <td className={styles.td}>
                &yen;{(item.priceCents / 100).toFixed(2)}
              </td>
              <td className={styles.td}>{item.itemClass}</td>
              <td className={styles.td}>
                {item.itemClass === "premade" ? (
                  <Input
                    className={styles.stockInput}
                    type="number"
                    size="small"
                    value={String(item.stockCount ?? 0)}
                    onChange={(_, data) => {
                      const val = parseInt(data.value, 10);
                      if (!isNaN(val) && val >= 0) {
                        handleStockChange(item.id, val);
                      }
                    }}
                  />
                ) : (
                  "\u2014"
                )}
              </td>
              <td className={styles.td}>
                <Switch
                  checked={item.isAvailable}
                  onChange={(_, data) =>
                    handleToggleAvailable(item.id, data.checked)
                  }
                />
              </td>
              <td className={styles.td}>
                <div className={styles.actions}>
                  <Button appearance="subtle" size="small" onClick={() => openEdit(item)}>
                    {t("common.edit")}
                  </Button>
                  <Button appearance="subtle" size="small" onClick={() => handleDelete(item.id)}>
                    {t("common.delete")}
                  </Button>
                  <label>
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload(item.id, file);
                        e.target.value = "";
                      }}
                    />
                    <Button as="span" appearance="subtle" size="small">
                      {item.imageUrl ? t("inventory.changeImg") : t("inventory.addImg")}
                    </Button>
                  </label>
                  {item.imageUrl && (
                    <Button appearance="subtle" size="small" onClick={() => handleImageRemove(item.id)}>
                      {t("inventory.removeImg")}
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <Dialog open={dialogOpen} onOpenChange={(_, data) => setDialogOpen(data.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>{editingId ? t("inventory.editItem") : t("inventory.addNewItem")}</DialogTitle>
            <DialogContent>
              {!editingId && (
                <div className={styles.formField}>
                  <span className={styles.fieldLabel}>{t("inventory.idSlug")}</span>
                  <Input
                    size="small"
                    value={form.id}
                    onChange={(_, data) => setForm({ ...form, id: data.value })}
                    placeholder={t("inventory.idPlaceholder")}
                  />
                </div>
              )}
              <div className={styles.formField}>
                <span className={styles.fieldLabel}>{t("common.name")}</span>
                <Input
                  size="small"
                  value={form.name}
                  onChange={(_, data) => setForm({ ...form, name: data.value })}
                />
              </div>
              <div className={styles.formField}>
                <span className={styles.fieldLabel}>{t("common.description")}</span>
                <Input
                  size="small"
                  value={form.description}
                  onChange={(_, data) => setForm({ ...form, description: data.value })}
                />
              </div>
              <div className={styles.formField}>
                <span className={styles.fieldLabel}>{t("inventory.category")}</span>
                <Dropdown
                  size="small"
                  value={categories.find((c) => c.id === form.categoryId)?.label ?? ""}
                  selectedOptions={form.categoryId ? [form.categoryId] : []}
                  onOptionSelect={(_, data) =>
                    setForm({ ...form, categoryId: data.optionValue as string })
                  }
                >
                  {categories.map((cat) => (
                    <Option key={cat.id} value={cat.id}>
                      {cat.label}
                    </Option>
                  ))}
                </Dropdown>
              </div>
              <div className={styles.formField}>
                <span className={styles.fieldLabel}>{t("inventory.priceCents")}</span>
                <Input
                  size="small"
                  type="number"
                  value={String(form.priceCents)}
                  onChange={(_, data) =>
                    setForm({ ...form, priceCents: parseInt(data.value, 10) || 0 })
                  }
                />
              </div>
              <div className={styles.formField}>
                <span className={styles.fieldLabel}>{t("inventory.type")}</span>
                <Dropdown
                  size="small"
                  value={form.itemClass}
                  selectedOptions={[form.itemClass]}
                  onOptionSelect={(_, data) =>
                    setForm({ ...form, itemClass: data.optionValue as string })
                  }
                >
                  <Option value="premade">{t("inventory.premade")}</Option>
                  <Option value="made-to-order">{t("inventory.madeToOrder")}</Option>
                </Dropdown>
              </div>
              {form.itemClass === "premade" && (
                <div className={styles.formField}>
                  <span className={styles.fieldLabel}>{t("inventory.initialStock")}</span>
                  <Input
                    size="small"
                    type="number"
                    value={String(form.stockCount)}
                    onChange={(_, data) =>
                      setForm({ ...form, stockCount: parseInt(data.value, 10) || 0 })
                    }
                  />
                </div>
              )}
            </DialogContent>
            <DialogActions>
              <DialogTrigger disableButtonEnhancement>
                <Button appearance="secondary">{t("common.cancel")}</Button>
              </DialogTrigger>
              <Button appearance="primary" onClick={handleSave} disabled={saving}>
                {saving ? t("common.saving") : t("common.save")}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}
