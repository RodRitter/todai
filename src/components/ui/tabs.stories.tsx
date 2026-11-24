import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

const meta = {
  title: "Navigation/Tabs",
  component: Tabs,
  parameters: { layout: "centered" },
  render: () => (
    <Tabs defaultValue="detail">
      <TabsList layout="wrap" aria-label="Task sections">
        <TabsTrigger value="detail">Detail</TabsTrigger>
        <TabsTrigger value="activity">Activity and comments</TabsTrigger>
        <TabsTrigger value="usage" disabled>Usage</TabsTrigger>
      </TabsList>
      <TabsContent value="detail">Task details</TabsContent>
      <TabsContent value="activity">Task activity</TabsContent>
    </Tabs>
  ),
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Dark: Story = { globals: { theme: "dark" } };
