import type { Meta, StoryObj } from "@storybook/react-vite";
import { Avatar, type MemberColorIndex } from "./Avatar";

const meta = {
  title: "Components/Avatar",
  component: Avatar,
  args: { name: "Ana García", size: "md", colorIndex: 1, decorative: false },
  argTypes: {
    size: { control: "inline-radio", options: ["sm", "md", "lg"] },
    colorIndex: { control: { type: "range", min: 1, max: 8, step: 1 } },
  },
} satisfies Meta<typeof Avatar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Initials: Story = {};

/** Inline SVG photo so the story works offline and in CI. */
const PHOTO =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#c5d8c1"/><circle cx="32" cy="26" r="12" fill="#4a634c"/><rect x="14" y="42" width="36" height="22" rx="11" fill="#4a634c"/></svg>',
  );

export const WithPhoto: Story = {
  args: { src: PHOTO, size: "lg" },
};

export const BrokenPhotoFallsBackToInitials: Story = {
  args: { src: "https://invalid.example/missing.jpg" },
};

const household: { name: string; colorIndex: MemberColorIndex }[] = [
  { name: "Ana García", colorIndex: 1 },
  { name: "Marta Ruiz", colorIndex: 2 },
  { name: "Luis Pérez", colorIndex: 3 },
  { name: "Sofía Martín", colorIndex: 4 },
  { name: "Javier Gómez", colorIndex: 5 },
  { name: "Lucía Díaz", colorIndex: 6 },
  { name: "Pablo Torres", colorIndex: 7 },
  { name: "Elena Vidal", colorIndex: 8 },
];

export const MemberColors: Story = {
  render: (args) => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)" }}>
      {household.map((member) => (
        <Avatar key={member.name} {...args} name={member.name} colorIndex={member.colorIndex} />
      ))}
    </div>
  ),
};
