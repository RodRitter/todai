import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Tabs } from "./tabs";
import { TabsList, TabsTrigger, TabsContent } from "./tabs";
import { fn } from "storybook/test";
const meta = {
  title: "Navigation/Tabs",
  component: Tabs,
  args: { defaultValue: "first", onValueChange: fn() },
  render: (args) => (
    <Tabs {...args} className="w-80 max-w-full">
      <TabsList aria-label="Example tabs">
        <TabsTrigger value="first">First</TabsTrigger>
        <TabsTrigger value="second">Second</TabsTrigger>
        <TabsTrigger value="disabled" disabled>
          Disabled
        </TabsTrigger>
      </TabsList>
      <TabsContent value="first">First tab content.</TabsContent>
      <TabsContent value="second">Second tab content.</TabsContent>
    </Tabs>
  ),
} satisfies Meta<typeof Tabs>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const SecondSelected: Story = { args: { defaultValue: "second" } };
