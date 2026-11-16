import type { Task } from "./task";

export const exampleTasks: Task[] = [
  { id: "1", title: "Plan the project", description: "Outline the scope and main deliverables.", status: "To do", agentStatus: "Blocked" },
  { id: "2", title: "Write the documentation", description: "Add setup instructions and usage examples.", status: "To do", agentStatus: "Paused" },
  { id: "3", title: "Build the task board", description: "Create a simple layout for managing tasks across the project. Each card should show its title, description, and agent status. Support dragging tasks between columns and opening a card to edit its details. Keep the layout readable on smaller screens, provide keyboard access to every task, and respect reduced-motion preferences when animating changes.", status: "In progress", agentStatus: "Running" },
  { id: "4", title: "Set up the project", description: "Install dependencies and configure the app.", status: "Done", agentStatus: "Review" },
];
