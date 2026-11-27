import { expect, userEvent, within } from "storybook/test";

export async function editSetting(scope: ReturnType<typeof within>, label: string, value: string, multiline = false) {
  await userEvent.click(await scope.findByRole("button", { name: new RegExp(`^Edit ${label.toLowerCase()}:`) }));
  const field = scope.getByRole("textbox", { name: label });
  await userEvent.clear(field);
  await userEvent.type(field, value);
  if (multiline) await userEvent.tab();
  else await userEvent.keyboard("{Enter}");
  await expect(await scope.findByRole("button", { name: `Edit ${label.toLowerCase()}: ${value}` })).toBeVisible();
}
