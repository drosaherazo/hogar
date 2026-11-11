import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { storyText } from "../../docs/blocks/storyLocale";
import { Amount } from "../Amount/Amount";
import { ChoiceGroup } from "./ChoiceGroup";

const meta = {
  title: "Components/ChoiceGroup",
  component: ChoiceGroup,
  args: { legend: "", options: [], value: "", onChange: () => {} },
  // The props are a union (one value or several), which react-docgen can't read, so the table
  // is described here. Keep it in sync with the JSDoc in ChoiceGroup.tsx.
  argTypes: {
    legend: {
      description: 'Names the whole group ("How should it be split?"), already translated.',
      table: { type: { summary: "string" } },
    },
    options: {
      description:
        "The choices: `value`, a translated `label`, an optional `hint` read together with the option, " +
        "`disabled` (give a `hint` explaining why) and `trailing` content such as a person's share.",
      table: { type: { summary: "readonly ChoiceOption[]" } },
    },
    multiple: {
      description: "Lets people pick several options (checkboxes) instead of one (radios).",
      table: { type: { summary: "boolean" }, defaultValue: { summary: "false" } },
    },
    value: {
      description: "The selected value, or the selected values when `multiple`.",
      table: { type: { summary: "string | readonly string[]" } },
    },
    onChange: {
      description: "Called with the new value, or with the selected values in the options' order when `multiple`.",
      table: { type: { summary: "(value: string) => void | (value: string[]) => void" } },
    },
    name: {
      description: "Form field name; generated when omitted.",
      table: { type: { summary: "string" } },
    },
    initialFocusRef: {
      description: "Attached to the selected option (or the first one), so a dialog can start there.",
      table: { type: { summary: "Ref<HTMLInputElement>" } },
    },
    className: { table: { type: { summary: "string" } } },
  },
} satisfies Meta<typeof ChoiceGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SingleChoice: Story = {
  render: function Render(_, { globals }) {
    const [value, setValue] = useState("weights");
    const t = (en: string, es: string) => storyText(globals, { en, es });
    return (
      <ChoiceGroup
        legend={t("How should it be split?", "¿Cómo se reparte?")}
        value={value}
        onChange={setValue}
        options={[
          { value: "weights", label: t("The household's split", "El reparto del hogar"), hint: "Ana 75 %, Bruno 25 %" },
          { value: "equal", label: t("Equally between…", "A partes iguales entre…") },
          { value: "exact", label: t("Exact amounts", "Importes exactos") },
        ]}
      />
    );
  },
};

export const Multiple: Story = {
  render: function Render(_, { globals }) {
    const [value, setValue] = useState(["ana", "bruno"]);
    const t = (en: string, es: string) => storyText(globals, { en, es });
    const share = value.length > 0 ? Math.floor(3500 / value.length) : 0;
    return (
      <ChoiceGroup
        multiple
        legend={t("Who shares it?", "¿Entre quién se reparte?")}
        value={value}
        onChange={setValue}
        options={["Ana García", "Bruno Díaz", "Carla Ruiz"].map((name) => {
          const id = name.split(" ")[0]?.toLowerCase() ?? name;
          return { value: id, label: name, trailing: value.includes(id) ? <Amount cents={share} /> : undefined };
        })}
      />
    );
  },
};

export const WithDisabledOption: Story = {
  render: function Render(_, { globals }) {
    const [value, setValue] = useState("equal");
    const t = (en: string, es: string) => storyText(globals, { en, es });
    return (
      <ChoiceGroup
        legend={t("How should it be split?", "¿Cómo se reparte?")}
        value={value}
        onChange={setValue}
        options={[
          {
            value: "weights",
            label: t("The household's split", "El reparto del hogar"),
            hint: t(
              "Nobody pays in the household's split yet. Choose people, or review the split.",
              "Todavía nadie paga en el reparto del hogar. Elige personas o revisa el reparto.",
            ),
            disabled: true,
          },
          { value: "equal", label: t("Equally between…", "A partes iguales entre…") },
        ]}
      />
    );
  },
};
