import { firebaseAuth } from "./firebase";

const apiUrl = process.env.EXPO_PUBLIC_API_URL || "http://127.0.0.1:3000/api";

async function authHeaders() {
  const user = firebaseAuth?.currentUser;
  if (!user) return { "Content-Type": "application/json" };

  const token = await user.getIdToken();
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`
  };
}

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${apiUrl}${path}`, {
      ...options,
      headers: {
        ...(await authHeaders()),
        ...(options.headers || {})
      }
    });
  } catch (error) {
    throw new Error(`Backend is not reachable at ${apiUrl}. Start the backend server and check mobile/.env EXPO_PUBLIC_API_URL.`);
  }

  const responseText = await response.text();
  const parseJson = () => {
    if (!responseText) return null;
    try {
      return JSON.parse(responseText);
    } catch (error) {
      throw new Error(`Backend returned an invalid response for ${path}.`);
    }
  };

  if (!response.ok) {
    const error = parseJson() || { message: response.statusText };
    throw new Error(error.message || `API request failed with ${response.status}`);
  }

  return parseJson();
}

export const api = {
  plans: () => request("/plans"),
  currentPlan: (householdId) => request(`/plans/households/${householdId}/current`),
  selectPlan: (householdId, body) => request(`/plans/households/${householdId}/select`, { method: "POST", body: JSON.stringify(body) }),
  createCheckout: (householdId, body) => request(`/plans/households/${householdId}/checkout`, { method: "POST", body: JSON.stringify(body) }),
  me: () => request("/users/me"),
  syncMe: (body) => request("/users/me", { method: "POST", body: JSON.stringify(body) }),
  deleteMe: () => request("/users/me", { method: "DELETE" }),
  households: () => request("/households"),
  createHousehold: (body) => request("/households", { method: "POST", body: JSON.stringify(body) }),
  householdMembers: (householdId) => request(`/households/${householdId}/members`),
  inviteMember: (householdId, body) => request(`/households/${householdId}/invites`, { method: "POST", body: JSON.stringify(body) }),
  acceptInvite: (token) => request(`/households/invites/${token}/accept`, { method: "POST" }),
  income: (householdId) => request(`/households/${householdId}/income`),
  createIncome: (householdId, body) => request(`/households/${householdId}/income`, { method: "POST", body: JSON.stringify(body) }),
  updateIncome: (householdId, incomeId, body) => request(`/households/${householdId}/income/${incomeId}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteIncome: (householdId, incomeId) => request(`/households/${householdId}/income/${incomeId}`, { method: "DELETE" }),
  expenses: (householdId) => request(`/households/${householdId}/expenses`),
  createExpense: (householdId, body) => request(`/households/${householdId}/expenses`, { method: "POST", body: JSON.stringify(body) }),
  updateExpense: (householdId, expenseId, body) => request(`/households/${householdId}/expenses/${expenseId}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteExpense: (householdId, expenseId) => request(`/households/${householdId}/expenses/${expenseId}`, { method: "DELETE" }),
  tasks: (householdId) => request(`/households/${householdId}/tasks`),
  createTask: (householdId, body) => request(`/households/${householdId}/tasks`, { method: "POST", body: JSON.stringify(body) }),
  updateTask: (householdId, taskId, body) => request(`/households/${householdId}/tasks/${taskId}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteTask: (householdId, taskId) => request(`/households/${householdId}/tasks/${taskId}`, { method: "DELETE" }),
  completeTask: (householdId, taskId) => request(`/households/${householdId}/tasks/${taskId}/complete`, { method: "PATCH" }),
  subscriptions: (householdId) => request(`/households/${householdId}/subscriptions`),
  createSubscription: (householdId, body) => request(`/households/${householdId}/subscriptions`, { method: "POST", body: JSON.stringify(body) }),
  goals: (householdId) => request(`/households/${householdId}/goals`),
  createGoal: (householdId, body) => request(`/households/${householdId}/goals`, { method: "POST", body: JSON.stringify(body) }),
  netWorth: (householdId) => request(`/households/${householdId}/net-worth`),
  createNetWorth: (householdId, body) => request(`/households/${householdId}/net-worth`, { method: "POST", body: JSON.stringify(body) }),
  notifications: (householdId) => request(`/households/${householdId}/notifications`),
  saveReminderRule: (householdId, body) => request(`/households/${householdId}/notifications/rules`, { method: "POST", body: JSON.stringify(body) }),
  registerDevice: (householdId, body) => request(`/households/${householdId}/notifications/devices`, { method: "POST", body: JSON.stringify(body) }),
  sendTestNotification: (householdId) => request(`/households/${householdId}/notifications/test`, { method: "POST" }),
  askAssistant: (householdId, question) => request(`/households/${householdId}/assistant/ask`, {
    method: "POST",
    body: JSON.stringify({ question })
  })
};
