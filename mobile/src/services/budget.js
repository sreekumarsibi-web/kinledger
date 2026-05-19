export function money(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value || 0);
}

export function totals(state) {
  const income = 7200;
  const spent = state.expenses.reduce((sum, item) => sum + Number(item.amount), 0);
  const shared = state.expenses
    .filter((item) => item.scope !== "personal")
    .reduce((sum, item) => sum + Number(item.amount), 0);
  const subscriptions = state.subscriptions.reduce((sum, item) => (
    sum + (item.cycle === "yearly" ? Number(item.cost) / 12 : Number(item.cost))
  ), 0);
  const savingsRatio = Math.max(0, ((income - spent - subscriptions) / income) * 100);

  return { income, spent, shared, subscriptions, savingsRatio };
}

export function categoryTotals(state, categories) {
  return categories
    .map((category) => ({
      category,
      amount: state.expenses
        .filter((item) => item.category === category)
        .reduce((sum, item) => sum + Number(item.amount), 0)
    }))
    .filter((item) => item.amount > 0)
    .sort((a, b) => b.amount - a.amount);
}

export function netWorth(state) {
  return state.netWorthItems.reduce((sum, item) => (
    sum + (item.type === "asset" ? Number(item.value) : -Number(item.value))
  ), 0);
}

export function goalContribution(goal) {
  if (!goal.month) return Math.max(0, goal.target - goal.saved);

  const [year, month] = goal.month.split("-").map(Number);
  const end = new Date(year, month - 1, 1);
  const now = new Date();
  const months = Math.max(1, (end.getFullYear() - now.getFullYear()) * 12 + end.getMonth() - now.getMonth() + 1);

  return Math.max(0, (goal.target - goal.saved) / months);
}
