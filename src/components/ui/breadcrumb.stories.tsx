import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "./button";
import { BreadcrumbRow, Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "./breadcrumb";

const meta = { title: "UI/Breadcrumb", component: Breadcrumb, tags: ["autodocs"] } satisfies Meta<typeof Breadcrumb>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Root: Story = { render: () => <Breadcrumb><BreadcrumbList><BreadcrumbItem><BreadcrumbPage>All boards</BreadcrumbPage></BreadcrumbItem></BreadcrumbList></Breadcrumb> };
export const Board: Story = { render: () => <Breadcrumb><BreadcrumbList><BreadcrumbItem><BreadcrumbLink asChild><button type="button">All boards</button></BreadcrumbLink></BreadcrumbItem><BreadcrumbSeparator /><BreadcrumbItem><BreadcrumbPage>Product</BreadcrumbPage></BreadcrumbItem></BreadcrumbList></Breadcrumb> };
export const LongName: Story = { render: () => <div className="max-w-64"><Breadcrumb><BreadcrumbList><BreadcrumbItem><BreadcrumbLink href="#">All boards</BreadcrumbLink></BreadcrumbItem><BreadcrumbSeparator /><BreadcrumbItem><BreadcrumbPage>Research and product development across multiple teams</BreadcrumbPage></BreadcrumbItem></BreadcrumbList></Breadcrumb></div> };
export const Disabled: Story = { render: () => <Breadcrumb><BreadcrumbList><BreadcrumbItem><BreadcrumbLink asChild><button type="button" disabled>All boards</button></BreadcrumbLink></BreadcrumbItem><BreadcrumbSeparator /><BreadcrumbItem><BreadcrumbPage>Product</BreadcrumbPage></BreadcrumbItem></BreadcrumbList></Breadcrumb> };

export const ConsistentRowHeight: Story = {
  render: () => <div className="space-y-6">
    <BreadcrumbRow actions={<Button size="sm">New</Button>}>
      <Breadcrumb><BreadcrumbList><BreadcrumbItem><BreadcrumbPage>All boards</BreadcrumbPage></BreadcrumbItem></BreadcrumbList></Breadcrumb>
    </BreadcrumbRow>
    <BreadcrumbRow>
      <Breadcrumb><BreadcrumbList><BreadcrumbItem><BreadcrumbLink href="#">All boards</BreadcrumbLink></BreadcrumbItem><BreadcrumbSeparator /><BreadcrumbItem><BreadcrumbPage>Product</BreadcrumbPage></BreadcrumbItem></BreadcrumbList></Breadcrumb>
    </BreadcrumbRow>
  </div>,
};
