const today = new Date().toISOString().slice(0, 10);
const storageKey = "kinledger-budget-mvp";

const categories = ["Food", "Housing", "Transport", "Bills", "Health", "School", "Fun", "Shopping", "Debt", "Other"];
const plans = [
  { id: "free", name: "Free", monthly: 0, yearly: 0, fit: "Manual tracking for one household" },
  { id: "single", name: "Premium Single", monthly: 6, yearly: 60, fit: "AI insights, goals, reminders" },
  { id: "couple", name: "Premium Couple", monthly: 10, yearly: 96, fit: "Linked spouse login and shared tasks" },
  { id: "family", name: "Premium Family", monthly: 16, yearly: 156, fit: "Family permissions and dashboards" }
];

const sampleState = {
  activeUserId: "maya",
  billing: "monthly",
  selectedPlan: "couple",
  locked: false,
  users: {
    maya: { id: "maya", name: "Maya", contact: "maya@example.com", role: "wife" },
    omar: { id: "omar", name: "Omar", contact: "omar@example.com", role: "husband" }
  },
  household: {
    id: "hh_001",
    name: "Maya & Omar",
    type: "couple",
    links: [
      { id: crypto.randomUUID(), contact: "omar@example.com", relationship: "spouse", permission: "full", status: "linked" }
    ]
  },
  reminders: { expense: true, evening: true, missed: true, bills: true, customTime: "20:30" },
  expenses: [
    { id: crypto.randomUUID(), amount: 86, category: "Food", date: today, method: "Card", scope: "shared", note: "Weekly groceries", userId: "maya" },
    { id: crypto.randomUUID(), amount: 42, category: "Transport", date: today, method: "Wallet", scope: "personal", note: "Taxi to client meeting", userId: "omar" },
    { id: crypto.randomUUID(), amount: 130, category: "Bills", date: today, method: "Bank", scope: "split", note: "Internet bill", userId: "omar" },
    { id: crypto.randomUUID(), amount: 59, category: "Fun", date: today, method: "Card", scope: "shared", note: "Dinner", userId: "maya" }
  ],
  subscriptions: [
    { id: crypto.randomUUID(), name: "Netflix", cost: 15.99, cycle: "monthly", renewal: "2026-05-24" },
    { id: crypto.randomUUID(), name: "Cloud storage", cost: 99, cycle: "yearly", renewal: "2026-06-02" }
  ],
  tasks: [
    { id: crypto.randomUUID(), title: "Pay electricity bill", assignee: "omar", createdBy: "maya", due: "2026-05-20", priority: "High", notes: "Use shared card", completed: false },
    { id: crypto.randomUUID(), title: "Review grocery budget", assignee: "maya", createdBy: "omar", due: "2026-05-17", priority: "Medium", notes: "Food spending is rising", completed: false }
  ],
  goals: [
    { id: crypto.randomUUID(), name: "Emergency fund", target: 12000, saved: 3400, month: "2026-12" },
    { id: crypto.randomUUID(), name: "Vacation", target: 4500, saved: 900, month: "2026-08" }
  ],
  netWorthItems: [
    { id: crypto.randomUUID(), name: "Bank savings", type: "asset", category: "Bank", value: 8400 },
    { id: crypto.randomUUID(), name: "Credit card", type: "liability", category: "Credit card", value: 1200 }
  ]
};

let state = loadState();

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));
const money = (value) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value || 0);
const percent = (value) => `${Math.round(value || 0)}%`;
const activeUser = () => state.users[state.activeUserId] || Object.values(state.users)[0];
const byId = (collection, id) => collection.find((item) => item.id === id);
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#039;"
}[char]));

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    return saved ? normalize(saved) : structuredClone(sampleState);
  } catch {
    return structuredClone(sampleState);
  }
}

function normalize(saved) {
  return {
    ...structuredClone(sampleState),
    ...saved,
    reminders: { ...sampleState.reminders, ...(saved.reminders || {}) },
    users: { ...sampleState.users, ...(saved.users || {}) },
    household: { ...sampleState.household, ...(saved.household || {}) },
    expenses: saved.expenses || sampleState.expenses,
    subscriptions: saved.subscriptions || sampleState.subscriptions,
    tasks: saved.tasks || sampleState.tasks,
    goals: saved.goals || sampleState.goals,
    netWorthItems: saved.netWorthItems || sampleState.netWorthItems
  };
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function totals() {
  const income = 7200;
  const spent = state.expenses.reduce((sum, item) => sum + Number(item.amount), 0);
  const shared = state.expenses.filter((item) => item.scope !== "personal").reduce((sum, item) => sum + Number(item.amount), 0);
  const subsMonthly = state.subscriptions.reduce((sum, item) => sum + (item.cycle === "yearly" ? Number(item.cost) / 12 : Number(item.cost)), 0);
  const savingsRatio = Math.max(0, ((income - spent - subsMonthly) / income) * 100);
  return { income, spent, shared, subsMonthly, savingsRatio };
}

function switchView(view) {
  $$(".view").forEach((panel) => panel.classList.toggle("is-visible", panel.id === `${view}-view`));
  $$(".nav-item").forEach((item) => item.classList.toggle("is-active", item.dataset.view === view));
  if (view !== "onboarding") render();
}

function render() {
  renderHeader();
  renderPlans();
  renderDashboard();
  renderExpenses();
  renderTasks();
  renderAnalytics();
  renderSubscriptions();
  renderGoals();
  renderNetWorth();
  renderLinks();
  renderReminders();
}

function renderHeader() {
  $("#account-label").textContent = `${state.household.type} account - ${activeUser().name}`;
  $("#lock-toggle").textContent = state.locked ? "Open" : "Lock";
  $$(".avatar").forEach((button) => button.classList.toggle("is-active", button.dataset.login === state.activeUserId));
}

function renderPlans() {
  $("#plan-list").innerHTML = plans.map((plan) => {
    const price = state.billing === "yearly" ? plan.yearly : plan.monthly;
    const suffix = state.billing === "yearly" ? "/yr" : "/mo";
    return `
      <article class="plan-card ${state.selectedPlan === plan.id ? "is-selected" : ""}">
        <div>
          <h3>${plan.name}</h3>
          <p>${plan.fit}</p>
        </div>
        <div class="price">${money(price)}${price ? suffix : ""}</div>
        <button class="ghost" data-plan="${plan.id}" type="button">${state.selectedPlan === plan.id ? "Selected" : "Choose"}</button>
      </article>
    `;
  }).join("");
  $$(".billing-toggle button").forEach((button) => button.classList.toggle("is-active", button.dataset.billing === state.billing));
}

function renderDashboard() {
  const total = totals();
  $("#metric-spent").textContent = money(total.spent);
  $("#metric-spent-note").textContent = `${percent((total.spent / total.income) * 100)} of income`;
  $("#metric-shared").textContent = money(total.shared);
  $("#metric-savings").textContent = percent(total.savingsRatio);
  $("#metric-savings-note").textContent = total.savingsRatio < 20 ? "below goal" : "healthy";
  $("#metric-subs").textContent = money(total.subsMonthly);
  $("#hello-title").textContent = `Hi ${activeUser().name}`;

  const biggest = categoryTotals()[0];
  const risk = total.spent > total.income * 0.65;
  $("#dashboard-insights").innerHTML = [
    insight("Overspending explanation", biggest ? `${biggest.category} is your largest category at ${money(biggest.amount)}.` : "No expenses yet."),
    insight("Reduction idea", total.subsMonthly > 40 ? `Subscriptions cost ${money(total.subsMonthly)} monthly. Review anything unused before renewal.` : "Recurring costs are still modest."),
    insight("Can we afford this?", `A ${money(900)} purchase would leave about ${money(total.income - total.spent - total.subsMonthly - 900)} before savings.`),
    risk ? insight("Overspending alert", "Spending is above 65% of income. Keep shared discretionary buys tight this week.", "red") : insight("Budget status", "Current pace is inside the MVP safe range.", "green")
  ].join("");
}

function insight(title, body, tone = "blue") {
  return `<article class="insight"><span class="chip ${tone}">${title}</span><p>${body}</p></article>`;
}

function renderReminders() {
  const rows = [
    ["Expense reminder", state.reminders.expense ? `Likely free at ${state.reminders.customTime}` : "Off"],
    ["Evening reminder", state.reminders.evening ? "Ask both users to log missed spending" : "Off"],
    ["Bill reminder", state.reminders.bills ? "Before subscription and bill renewals" : "Off"],
    ["Assigned task reminder", "Push assignee before due date"]
  ];
  $("#reminder-list").innerHTML = rows.map(([title, detail]) => listRow(title, detail, "On")).join("");
  $$("#reminders-view [data-reminder]").forEach((box) => { box.checked = Boolean(state.reminders[box.dataset.reminder]); });
  $("#custom-reminder-time").value = state.reminders.customTime;
}

function renderExpenses() {
  $("#expense-category").innerHTML = categories.map((category) => `<option>${category}</option>`).join("");
  $("#expense-date").value ||= today;
  $("#expense-list").innerHTML = state.expenses.map((item) => {
    const owner = state.users[item.userId]?.name || "Unknown";
    return listRow(item.note || item.category, `${item.category} - ${item.scope} - ${item.method} - ${owner}`, money(item.amount), [
      ["blue", item.date],
      [item.scope === "personal" ? "amber" : "green", item.scope]
    ], `<button data-delete-expense="${item.id}" type="button">x</button>`);
  }).join("");
}

function renderTasks() {
  const now = today;
  const pending = state.tasks.filter((task) => !task.completed && task.due >= now).length;
  const completed = state.tasks.filter((task) => task.completed).length;
  const missed = state.tasks.filter((task) => !task.completed && task.due < now).length;
  $("#pending-count").textContent = pending;
  $("#completed-count").textContent = completed;
  $("#missed-count").textContent = missed;
  $("#task-list").innerHTML = state.tasks.map((task) => {
    const assignee = state.users[task.assignee]?.name || task.assignee;
    const status = task.completed ? "Completed" : task.due < now ? "Missed" : "Pending";
    const tone = task.completed ? "green" : task.due < now ? "red" : "amber";
    return listRow(task.title, `Assigned to ${assignee} by ${state.users[task.createdBy]?.name || "Partner"} - ${task.notes || "No notes"}`, task.priority, [[tone, status], ["blue", task.due || "No due date"]], `
      <button data-toggle-task="${task.id}" type="button">Done</button>
      <button data-delete-task="${task.id}" type="button">x</button>
    `);
  }).join("");
}

function renderAnalytics() {
  const totalsByCategory = categoryTotals();
  const max = Math.max(1, ...totalsByCategory.map((item) => item.amount));
  $("#category-bars").innerHTML = totalsByCategory.map((item) => `
    <article class="bar-row">
      <div class="bar-label"><span>${item.category}</span><span>${money(item.amount)}</span></div>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.max(5, (item.amount / max) * 100)}%"></div></div>
    </article>
  `).join("") || `<article class="insight"><p>No spending yet.</p></article>`;

  const total = totals();
  $("#shared-ratio").textContent = percent(total.spent ? (total.shared / total.spent) * 100 : 0);
  const risk = total.spent > total.income * 0.75 ? "High" : total.spent > total.income * 0.55 ? "Medium" : "Low";
  $("#risk-score").textContent = risk;
  $("#risk-note").textContent = risk === "Low" ? "Within trend" : "Reduce discretionary categories";
}

function categoryTotals() {
  return categories.map((category) => ({
    category,
    amount: state.expenses.filter((item) => item.category === category).reduce((sum, item) => sum + Number(item.amount), 0)
  })).filter((item) => item.amount > 0).sort((a, b) => b.amount - a.amount);
}

function renderSubscriptions() {
  const monthly = totals().subsMonthly;
  $("#subscription-list").innerHTML = [
    listRow("Total monthly subscription burn", "Includes yearly plans divided by 12", money(monthly), [["amber", "burn rate"]]),
    ...state.subscriptions.map((item) => {
      const monthlyCost = item.cycle === "yearly" ? Number(item.cost) / 12 : Number(item.cost);
      const recommendation = monthlyCost > 20 ? "Review or cancel if unused" : "Keep if actively used";
      return listRow(item.name, `${item.cycle} - renews ${item.renewal || "unscheduled"} - ${recommendation}`, money(item.cost), [["blue", money(monthlyCost) + "/mo"]], `<button data-delete-sub="${item.id}" type="button">x</button>`);
    })
  ].join("");
}

function renderGoals() {
  $("#goal-list").innerHTML = state.goals.map((goal) => {
    const progress = Math.min(100, (goal.saved / goal.target) * 100);
    const suggestion = monthlyGoalSuggestion(goal);
    return `
      <article class="list-row">
        <div>
          <h3>${goal.name}</h3>
          <p>${money(goal.saved)} of ${money(goal.target)} - suggest ${money(suggestion)}/mo</p>
          <div class="bar-track"><div class="bar-fill" style="width:${progress}%"></div></div>
          <div class="chip-row"><span class="chip green">${percent(progress)}</span><span class="chip blue">${goal.month || "No date"}</span></div>
        </div>
        <div class="row-actions"><button data-delete-goal="${goal.id}" type="button">x</button></div>
      </article>
    `;
  }).join("");
}

function monthlyGoalSuggestion(goal) {
  if (!goal.month) return Math.max(0, goal.target - goal.saved);
  const [year, month] = goal.month.split("-").map(Number);
  const end = new Date(year, month - 1, 1);
  const now = new Date();
  const months = Math.max(1, (end.getFullYear() - now.getFullYear()) * 12 + end.getMonth() - now.getMonth() + 1);
  return Math.max(0, (goal.target - goal.saved) / months);
}

function renderNetWorth() {
  const total = state.netWorthItems.reduce((sum, item) => sum + (item.type === "asset" ? Number(item.value) : -Number(item.value)), 0);
  $("#net-worth-total").textContent = money(total);
  $("#networth-list").innerHTML = state.netWorthItems.map((item) => (
    listRow(item.name, `${item.type} - ${item.category}`, money(item.value), [[item.type === "asset" ? "green" : "red", item.type]], `<button data-delete-net="${item.id}" type="button">x</button>`)
  )).join("");
}

function renderLinks() {
  $("#linked-list").innerHTML = state.household.links.map((link) => (
    listRow(link.contact, `${link.relationship} - ${link.permission}`, link.status, [["green", link.status]])
  )).join("");
}

function listRow(title, detail, side = "", chips = [], actions = "") {
  const chipHtml = chips.length ? `<div class="chip-row">${chips.map(([tone, label]) => `<span class="chip ${escapeHtml(tone)}">${escapeHtml(label)}</span>`).join("")}</div>` : "";
  return `
    <article class="list-row">
      <div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(detail)}</p>${chipHtml}</div>
      <div class="amount">${escapeHtml(side)}</div>
      ${actions ? `<div class="row-actions">${actions}</div>` : ""}
    </article>
  `;
}

document.addEventListener("click", (event) => {
  const viewButton = event.target.closest("[data-view]");
  const loginButton = event.target.closest("[data-login]");
  const planButton = event.target.closest("[data-plan]");
  const billingButton = event.target.closest("[data-billing]");
  const quickButton = event.target.closest("[data-quick]");

  if (viewButton) switchView(viewButton.dataset.view);
  if (loginButton) {
    state.activeUserId = loginButton.dataset.login;
    saveState();
    render();
  }
  if (planButton) {
    state.selectedPlan = planButton.dataset.plan;
    saveState();
    renderPlans();
  }
  if (billingButton) {
    state.billing = billingButton.dataset.billing;
    saveState();
    renderPlans();
  }
  if (quickButton) {
    const [note, amount, category] = quickButton.dataset.quick.split("|");
    state.expenses.unshift({ id: crypto.randomUUID(), amount: Number(amount), category, date: today, method: "Card", scope: "personal", note, userId: state.activeUserId });
    saveState();
    render();
  }

  deleteFrom(event, "delete-expense", state.expenses);
  deleteFrom(event, "delete-sub", state.subscriptions);
  deleteFrom(event, "delete-goal", state.goals);
  deleteFrom(event, "delete-net", state.netWorthItems);

  const taskToggle = event.target.closest("[data-toggle-task]");
  if (taskToggle) {
    const task = byId(state.tasks, taskToggle.dataset.toggleTask);
    if (task) task.completed = !task.completed;
    saveState();
    render();
  }

  const taskDelete = event.target.closest("[data-delete-task]");
  if (taskDelete) {
    state.tasks = state.tasks.filter((task) => task.id !== taskDelete.dataset.deleteTask);
    saveState();
    render();
  }
});

function deleteFrom(event, key, collection) {
  const button = event.target.closest(`[data-${key}]`);
  if (!button) return;
  const id = button.dataset[key.replace(/-([a-z])/g, (_, c) => c.toUpperCase())];
  const index = collection.findIndex((item) => item.id === id);
  if (index >= 0) collection.splice(index, 1);
  saveState();
  render();
}

$("#lock-toggle").addEventListener("click", () => {
  state.locked = !state.locked;
  saveState();
  renderHeader();
});

$("#auth-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const id = $("#auth-name").value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-") || crypto.randomUUID();
  state.users[id] = { id, name: $("#auth-name").value.trim(), contact: $("#auth-contact").value.trim(), role: "owner" };
  state.activeUserId = id;
  state.household.type = $("#auth-account-type").value;
  saveState();
  switchView("plan");
});

$("#link-form").addEventListener("submit", (event) => {
  event.preventDefault();
  state.household.links.push({
    id: crypto.randomUUID(),
    contact: $("#link-contact").value.trim(),
    relationship: $("#link-role").value,
    permission: $("#link-permission").value,
    status: "invited"
  });
  event.target.reset();
  saveState();
  renderLinks();
});

$("#expense-form").addEventListener("submit", (event) => {
  event.preventDefault();
  state.expenses.unshift({
    id: crypto.randomUUID(),
    amount: Number($("#expense-amount").value),
    category: $("#expense-category").value,
    date: $("#expense-date").value || today,
    method: $("#expense-method").value,
    scope: $("#expense-scope").value,
    note: $("#expense-note").value.trim() || $("#expense-category").value,
    userId: state.activeUserId
  });
  event.target.reset();
  $("#expense-date").value = today;
  saveState();
  render();
});

$("#task-form").addEventListener("submit", (event) => {
  event.preventDefault();
  state.tasks.unshift({
    id: crypto.randomUUID(),
    title: $("#task-title").value.trim(),
    assignee: $("#task-assignee").value,
    createdBy: state.activeUserId,
    due: $("#task-due").value || today,
    priority: $("#task-priority").value,
    notes: $("#task-notes").value.trim(),
    completed: false
  });
  event.target.reset();
  saveState();
  render();
});

$("#subscription-form").addEventListener("submit", (event) => {
  event.preventDefault();
  state.subscriptions.unshift({
    id: crypto.randomUUID(),
    name: $("#sub-name").value.trim(),
    cost: Number($("#sub-cost").value),
    cycle: $("#sub-cycle").value,
    renewal: $("#sub-renewal").value || today
  });
  event.target.reset();
  saveState();
  render();
});

$("#goal-form").addEventListener("submit", (event) => {
  event.preventDefault();
  state.goals.unshift({
    id: crypto.randomUUID(),
    name: $("#goal-name").value,
    target: Number($("#goal-target").value),
    saved: Number($("#goal-saved").value),
    month: $("#goal-month").value
  });
  event.target.reset();
  saveState();
  render();
});

$("#networth-form").addEventListener("submit", (event) => {
  event.preventDefault();
  state.netWorthItems.unshift({
    id: crypto.randomUUID(),
    name: $("#net-name").value.trim(),
    type: $("#net-type").value,
    category: $("#net-category").value,
    value: Number($("#net-value").value)
  });
  event.target.reset();
  saveState();
  render();
});

$("#assistant-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const total = totals();
  const question = $("#assistant-question").value.trim();
  const biggest = categoryTotals()[0];
  const remaining = total.income - total.spent - total.subsMonthly;
  $("#assistant-answer").innerHTML = `
    <strong>${escapeHtml(question || "Budget check")}</strong><br>
    You have about ${money(remaining)} left before savings this month. ${biggest ? `${biggest.category} is driving the most spend at ${money(biggest.amount)}. ` : ""}
    A cautious plan is to cap flexible spending at ${money(Math.max(0, remaining * 0.45))} and move ${money(Math.max(0, remaining * 0.25))} toward goals.
  `;
});

$$("#reminders-view [data-reminder]").forEach((box) => {
  box.addEventListener("change", () => {
    state.reminders[box.dataset.reminder] = box.checked;
    saveState();
    renderReminders();
  });
});

$("#custom-reminder-time").addEventListener("input", (event) => {
  state.reminders.customTime = event.target.value;
  saveState();
  renderReminders();
});

render();
