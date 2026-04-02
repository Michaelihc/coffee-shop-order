import React from "react";
import {
  Menu,
  MenuTrigger,
  MenuPopover,
  MenuList,
  MenuItem,
  Button,
} from "@fluentui/react-components";
import { useTranslation } from "react-i18next";

const LANGUAGES = [
  { code: "en", label: "language.en" },
  { code: "zh", label: "language.zh" },
  { code: "ko", label: "language.ko" },
];

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const current = LANGUAGES.find((l) => l.code === i18n.language) || LANGUAGES[0];

  return (
    <Menu>
      <MenuTrigger disableButtonEnhancement>
        <Button
          appearance="subtle"
          size="small"
          style={{ color: "rgba(255,249,243,0.85)", minWidth: "auto" }}
        >
          {t(current.label)}
        </Button>
      </MenuTrigger>
      <MenuPopover>
        <MenuList>
          {LANGUAGES.map((lang) => (
            <MenuItem
              key={lang.code}
              onClick={() => i18n.changeLanguage(lang.code)}
            >
              {t(lang.label)}
            </MenuItem>
          ))}
        </MenuList>
      </MenuPopover>
    </Menu>
  );
}
