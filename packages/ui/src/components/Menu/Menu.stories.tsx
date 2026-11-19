import type { Meta, StoryObj } from "@storybook/react-vite";
import { Languages, LogOut, Moon, MoreHorizontal, Pencil, Sun, Trash2 } from "lucide-react";
import { useState } from "react";
import { storyText } from "../../docs/blocks/storyLocale";
import { Avatar } from "../Avatar/Avatar";
import { Button } from "../Button/Button";
import { Menu, MenuItem, MenuRadioGroup, MenuSeparator } from "./Menu";

const meta = {
  title: "Components/Menu",
  component: Menu,
  args: { trigger: null, children: null, align: "start" },
  parameters: { layout: "centered" },
} satisfies Meta<typeof Menu>;

export default meta;
type Story = StoryObj<typeof meta>;

function AccountMenuDemo({ globals, align }: { globals: Record<string, unknown>; align: "start" | "end" }) {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [language, setLanguage] = useState<"en" | "es">("en");
  const t = <T,>(value: { en: T; es: T }) => storyText(globals, value);
  return (
    <Menu
      align={align}
      trigger={
        <button
          type="button"
          aria-label={t({ en: "Account menu", es: "Menú de cuenta" })}
          style={{ all: "unset", cursor: "pointer", borderRadius: "var(--radius-full)" }}
        >
          <Avatar name="Ana García" decorative />
        </button>
      }
    >
      <MenuRadioGroup
        label={t({ en: "Theme", es: "Tema" })}
        value={theme}
        onValueChange={setTheme}
        options={[
          { value: "light", label: t({ en: "Light", es: "Claro" }), icon: <Sun /> },
          { value: "dark", label: t({ en: "Dark", es: "Oscuro" }), icon: <Moon /> },
        ]}
      />
      <MenuSeparator />
      <MenuRadioGroup
        label={t({ en: "Language", es: "Idioma" })}
        value={language}
        onValueChange={setLanguage}
        options={[
          { value: "en", label: "English", icon: <Languages /> },
          { value: "es", label: "Español", icon: <Languages /> },
        ]}
      />
      <MenuSeparator />
      <MenuItem icon={<LogOut />}>{t({ en: "Sign out", es: "Cerrar sesión" })}</MenuItem>
    </Menu>
  );
}

export const AccountMenu: Story = {
  render: (args, { globals }) => <AccountMenuDemo globals={globals} align={args.align ?? "start"} />,
};

/**
 * Actions someone can't use right now stay in the menu, disabled, with the reason under them:
 * here, an item another person has in their cart.
 */
export const DisabledWithReason: Story = {
  render: function Render(args, { globals }) {
    const t = <T,>(value: { en: T; es: T }) => storyText(globals, value);
    const reason = t({
      en: "Only Bruno can change it while it's in their cart.",
      es: "Solo Bruno puede cambiarlo mientras esté en su carrito.",
    });
    return (
      <Menu
        align={args.align ?? "start"}
        trigger={
          <Button variant="ghost" size="sm" aria-label={t({ en: "Options for Milk", es: "Opciones de Leche" })}>
            <MoreHorizontal aria-hidden="true" />
          </Button>
        }
      >
        <MenuItem icon={<Pencil />} disabled description={reason}>
          {t({ en: "Edit", es: "Editar" })}
        </MenuItem>
        <MenuItem icon={<Trash2 />} disabled description={reason}>
          {t({ en: "Delete", es: "Borrar" })}
        </MenuItem>
      </Menu>
    );
  },
};
