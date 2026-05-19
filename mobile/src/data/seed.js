export const categories = ["Food", "Housing", "Transport", "Bills", "Health", "School", "Fun", "Shopping", "Debt", "Other"];

export const plans = [
  { id: "free", name: "Free", monthly: 0, yearly: 0, fit: "Manual tracking for one household" },
  { id: "single", name: "Premium Single", monthly: 6, yearly: 60, fit: "AI insights, goals, reminders" },
  { id: "couple", name: "Premium Couple", monthly: 10, yearly: 96, fit: "Linked spouse login and shared tasks" },
  { id: "family", name: "Premium Family", monthly: 16, yearly: 156, fit: "Family permissions and dashboards" }
];

export const initialState = {
  activeUserId: "maya",
  household: {
    name: "Maya & Omar",
    type: "couple",
    selectedPlan: "couple",
    billing: "monthly",
    links: [
      { id: "link-1", contact: "omar@example.com", relationship: "spouse", permission: "full", status: "linked" }
    ]
  },
  users: {
    maya: { id: "maya", name: "Maya", role: "wife", contact: "maya@example.com" },
    omar: { id: "omar", name: "Omar", role: "husband", contact: "omar@example.com" }
  },
  reminders: {
    expense: true,
    evening: true,
    missed: true,
    bills: true,
    customTime: "20:30"
  },
  expenses: [
    { id: "exp-1", amount: 86, category: "Food", date: "2026-05-18", method: "Card", scope: "shared", note: "Weekly groceries", userId: "maya" },
    { id: "exp-2", amount: 42, category: "Transport", date: "2026-05-18", method: "Wallet", scope: "personal", note: "Taxi to client meeting", userId: "omar" },
    { id: "exp-3", amount: 130, category: "Bills", date: "2026-05-18", method: "Bank", scope: "split", note: "Internet bill", userId: "omar" }
  ],
  tasks: [
    { id: "task-1", title: "Pay electricity bill", assignee: "omar", createdBy: "maya", due: "2026-05-20", priority: "High", notes: "Use shared card", completed: false },
    { id: "task-2", title: "Review grocery budget", assignee: "maya", createdBy: "omar", due: "2026-05-17", priority: "Medium", notes: "Food spending is rising", completed: false }
  ],
  subscriptions: [
    { id: "sub-1", name: "Netflix", cost: 15.99, cycle: "monthly", renewal: "2026-05-24" },
    { id: "sub-2", name: "Cloud storage", cost: 99, cycle: "yearly", renewal: "2026-06-02" }
  ],
  goals: [
    { id: "goal-1", name: "Emergency fund", target: 12000, saved: 3400, month: "2026-12" },
    { id: "goal-2", name: "Vacation", target: 4500, saved: 900, month: "2026-08" }
  ],
  netWorthItems: [
    { id: "net-1", name: "Bank savings", type: "asset", category: "Bank", value: 8400 },
    { id: "net-2", name: "Credit card", type: "liability", category: "Credit card", value: 1200 }
  ]
};
