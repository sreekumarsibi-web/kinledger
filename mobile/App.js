import { useEffect, useMemo, useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { categories, initialState, plans } from "./src/data/seed";
import { api } from "./src/services/api";
import { categoryTotals, goalContribution, money, netWorth, totals } from "./src/services/budget";
import { deleteCurrentFirebaseUser, isFirebaseConfigured, loginWithEmail, logout, registerWithEmail, subscribeToAuth } from "./src/services/firebase";
import { getExpoPushToken } from "./src/services/push";

const tabs = [
  ["dashboard", "Home"],
  ["expenses", "Spend"],
  ["tasks", "Tasks"],
  ["analytics", "Stats"],
  ["more", "More"]
];

const reminderRuleMap = {
  expense: "expense_reminder",
  evening: "expense_reminder",
  missed: "expense_reminder",
  bills: "bill_reminder",
  bill: "bill_reminder",
  subscription: "subscription_renewal",
  goal: "goal_reminder",
  assignedTask: "assigned_task",
  overspending: "overspending_alert"
};

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function toCents(value) {
  return Math.round(Number(value || 0) * 100);
}

function fromCents(value) {
  return money((Number(value || 0) / 100));
}

function summarizeLiveData(income, expenses, subscriptions) {
  const earned = income.reduce((sum, item) => sum + Number(item.amount_cents || 0), 0);
  const spent = expenses.reduce((sum, item) => sum + Number(item.amount_cents || 0), 0);
  const shared = expenses.filter((item) => item.scope !== "personal").reduce((sum, item) => sum + Number(item.amount_cents || 0), 0);
  const subscriptionBurn = Number(subscriptions?.monthlyBurnCents || subscriptions?.monthly_burn_cents || 0);
  const savingsRatio = earned > 0 ? Math.max(0, ((earned - spent - subscriptionBurn) / earned) * 100) : 0;
  return {
    income: earned / 100,
    spent: spent / 100,
    shared: shared / 100,
    subscriptions: subscriptionBurn / 100,
    savingsRatio
  };
}

function liveCategoryTotals(expenses) {
  const totalsByCategory = expenses.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + Number(item.amount_cents || 0) / 100;
    return acc;
  }, {});
  return Object.entries(totalsByCategory)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
}

function planPrice(plan, billingCycle) {
  const cents = billingCycle === "yearly" ? plan.yearly_price_cents : plan.monthly_price_cents;
  return fromCents(cents);
}

export default function App() {
  const [state, setState] = useState(initialState);
  const [screen, setScreen] = useState("dashboard");
  const [authUser, setAuthUser] = useState(null);
  const [backendUser, setBackendUser] = useState(null);
  const [households, setHouseholds] = useState([]);
  const [activeHouseholdId, setActiveHouseholdId] = useState(null);
  const [householdMembers, setHouseholdMembers] = useState([]);
  const [householdInvites, setHouseholdInvites] = useState([]);
  const [liveIncome, setLiveIncome] = useState([]);
  const [liveExpenses, setLiveExpenses] = useState([]);
  const [liveTasks, setLiveTasks] = useState([]);
  const [liveSubscriptions, setLiveSubscriptions] = useState({ monthlyBurnCents: 0, items: [] });
  const [liveGoals, setLiveGoals] = useState([]);
  const [liveNetWorth, setLiveNetWorth] = useState({ totalCents: 0, items: [] });
  const [liveNotifications, setLiveNotifications] = useState([]);
  const [livePlans, setLivePlans] = useState([]);
  const [currentPlan, setCurrentPlan] = useState(null);
  const [planBillingCycle, setPlanBillingCycle] = useState("monthly");
  const [planStatus, setPlanStatus] = useState("");
  const [sessionStatus, setSessionStatus] = useState(isFirebaseConfigured ? "Checking session" : "Demo mode");
  const [sessionError, setSessionError] = useState("");
  const [authDraft, setAuthDraft] = useState({ email: "", password: "", displayName: "" });
  const [householdDraft, setHouseholdDraft] = useState({ name: "My Household", accountType: "couple" });
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [inviteDraft, setInviteDraft] = useState({ contact: "", relationship: "spouse", permission: "full" });
  const [lastInvite, setLastInvite] = useState(null);
  const [incomingInviteToken, setIncomingInviteToken] = useState("");
  const [inviteAcceptStatus, setInviteAcceptStatus] = useState("");
  const [incomeDraft, setIncomeDraft] = useState({ source: "Salary", amount: "", receivedAt: todayDate(), note: "", isRecurring: true });
  const [expenseDraft, setExpenseDraft] = useState({ amount: "", category: "Food", scope: "shared", note: "", method: "Card", isPrivate: false });
  const [taskDraft, setTaskDraft] = useState({ title: "", assignee: "self", due: "2026-05-20", priority: "Medium", notes: "" });
  const [subscriptionDraft, setSubscriptionDraft] = useState({ name: "", cost: "", billingCycle: "monthly", renewalDate: "2026-06-01" });
  const [goalDraft, setGoalDraft] = useState({ name: "Emergency fund", target: "", saved: "", targetMonth: "2026-12" });
  const [netWorthDraft, setNetWorthDraft] = useState({ name: "", itemType: "asset", category: "bank", value: "", asOfDate: "2026-05-19" });
  const [settingsState, setSettingsState] = useState({ biometric: false, pinLock: false, privateExpenses: true, sharedExpenses: true, spouseCanViewPrivate: false });
  const [assistantQuestion, setAssistantQuestion] = useState("Can we afford a 900 USD purchase this month?");
  const [assistantAnswer, setAssistantAnswer] = useState("");
  const [assistantStatus, setAssistantStatus] = useState("");
  const [pushStatus, setPushStatus] = useState("");
  const [pushTokenPreview, setPushTokenPreview] = useState("");
  const summary = useMemo(() => totals(state), [state]);
  const liveSummary = useMemo(() => summarizeLiveData(liveIncome, liveExpenses, liveSubscriptions), [liveIncome, liveExpenses, liveSubscriptions]);
  const activeUser = state.users[state.activeUserId];
  const headerAccountType = authUser ? (households.find((household) => household.id === activeHouseholdId)?.account_type || householdDraft.accountType) : state.household.type;
  const headerName = authUser ? (backendUser?.display_name || authUser.email || "Signed in") : activeUser.name;

  useEffect(() => {
    if (typeof window !== "undefined" && window.location?.pathname) {
      const match = window.location.pathname.match(/^\/invite\/([^/]+)$/);
      if (match?.[1]) {
        setIncomingInviteToken(match[1]);
        setScreen("acceptInvite");
      }
    }

    return subscribeToAuth(async (user) => {
      setAuthUser(user);
      setSessionError("");

      if (!user) {
        setBackendUser(null);
        setHouseholds([]);
        setActiveHouseholdId(null);
        setHouseholdMembers([]);
        setHouseholdInvites([]);
        setLiveIncome([]);
        setLiveExpenses([]);
        setLiveTasks([]);
        setLiveSubscriptions({ monthlyBurnCents: 0, items: [] });
        setLiveGoals([]);
        setLiveNetWorth({ totalCents: 0, items: [] });
        setLiveNotifications([]);
        setCurrentPlan(null);
        setPlanStatus("");
        setSessionStatus(isFirebaseConfigured ? "Signed out" : "Demo mode");
        return;
      }

      await bootstrapBackendSession();
    });
  }, []);

  async function acceptIncomingInvite() {
    if (!incomingInviteToken) {
      setInviteAcceptStatus("Invite token missing.");
      return;
    }

    if (!authUser) {
      setInviteAcceptStatus("Login or create an account first, then accept the invite.");
      return;
    }

    try {
      setInviteAcceptStatus("Accepting invite");
      const accepted = await api.acceptInvite(incomingInviteToken);
      await bootstrapBackendSession();
      setActiveHouseholdId(accepted.householdId);
      setInviteAcceptStatus(`Joined ${accepted.householdName}`);
      setScreen("dashboard");
    } catch (error) {
      setInviteAcceptStatus(error.message);
    }
  }

  async function bootstrapBackendSession() {
    try {
      setSessionStatus("Syncing backend");
      const syncedUser = await api.syncMe({ displayName: authDraft.displayName || undefined });
      const householdRows = await api.households();
      const planRows = await api.plans();
      const activeId = householdRows[0]?.id || null;
      const memberRows = activeId ? await api.householdMembers(activeId) : { members: [], invites: [] };
      setBackendUser(syncedUser);
      setHouseholds(householdRows);
      setLivePlans(planRows || []);
      setActiveHouseholdId(activeId);
      setHouseholdMembers(memberRows.members || []);
      setHouseholdInvites(memberRows.invites || []);
      if (activeId) await refreshHouseholdData(activeId);
      setSessionStatus(householdRows.length ? "Connected" : "Create household");
    } catch (error) {
      setSessionError(error.message);
      setSessionStatus("Backend offline");
    }
  }

  async function refreshHouseholdData(householdId = activeHouseholdId) {
    if (!householdId) return;

    const [incomeRows, expenseRows, taskRows, subscriptionRows, goalRows, netWorthRows, notificationRows] = await Promise.all([
      api.income(householdId),
      api.expenses(householdId),
      api.tasks(householdId),
      api.subscriptions(householdId),
      api.goals(householdId),
      api.netWorth(householdId),
      api.notifications(householdId)
    ]);
    const planRow = await api.currentPlan(householdId);

    setLiveIncome(incomeRows || []);
    setLiveExpenses(expenseRows || []);
    setLiveTasks(taskRows || []);
    setLiveSubscriptions(subscriptionRows || { monthlyBurnCents: 0, items: [] });
    setLiveGoals(goalRows || []);
    setLiveNetWorth(netWorthRows || { totalCents: 0, items: [] });
    setLiveNotifications(notificationRows || []);
    setCurrentPlan(planRow);
    if (planRow?.billing_cycle) setPlanBillingCycle(planRow.billing_cycle);
  }

  async function submitAuth(mode) {
    try {
      setSessionError("");
      setSessionStatus(mode === "register" ? "Creating account" : "Signing in");
      if (mode === "register") {
        await registerWithEmail(authDraft.email.trim(), authDraft.password);
      } else {
        await loginWithEmail(authDraft.email.trim(), authDraft.password);
      }
    } catch (error) {
      setSessionError(error.message);
      setSessionStatus("Auth failed");
    }
  }

  async function createBackendHousehold() {
    try {
      setSessionError("");
      setSessionStatus("Creating household");
      const household = await api.createHousehold(householdDraft);
      const nextHouseholds = await api.households();
      const memberRows = await api.householdMembers(household.id);
      setHouseholds(nextHouseholds);
      setActiveHouseholdId(household.id);
      setHouseholdMembers(memberRows.members || []);
      setHouseholdInvites(memberRows.invites || []);
      await refreshHouseholdData(household.id);
      setSessionStatus("Connected");
    } catch (error) {
      setSessionError(error.message);
      setSessionStatus("Household failed");
    }
  }

  async function sendInvite() {
    if (!activeHouseholdId) {
      setSessionError("Create a household before inviting members.");
      return;
    }

    try {
      setSessionError("");
      setSessionStatus("Sending invite");
      const invite = await api.inviteMember(activeHouseholdId, inviteDraft);
      const memberRows = await api.householdMembers(activeHouseholdId);
      setHouseholdMembers(memberRows.members || []);
      setHouseholdInvites(memberRows.invites || []);
      setLastInvite(invite);
      setInviteDraft({ contact: "", relationship: "spouse", permission: "full" });
      setSessionStatus("Invite created");
    } catch (error) {
      setSessionError(error.message);
      setSessionStatus("Invite failed");
    }
  }

  async function signOutUser() {
    try {
      setSessionError("");
      setSessionStatus("Signing out");
      await logout();
      setScreen("dashboard");
    } catch (error) {
      setSessionError(error.message);
    }
  }

  async function deleteAccount() {
    if (deleteConfirm !== "DELETE") {
      setSessionError("Type DELETE to confirm account deletion.");
      return;
    }

    try {
      setSessionError("");
      setSessionStatus("Deleting account");
      await api.deleteMe().catch(() => null);
      await deleteCurrentFirebaseUser();
      setDeleteConfirm("");
      setScreen("dashboard");
    } catch (error) {
      setSessionError(`${error.message}. Firebase may require a fresh login before account deletion.`);
      setSessionStatus("Delete failed");
    }
  }

  async function addIncome() {
    if (!incomeDraft.source || !incomeDraft.amount) return;
    if (authUser && activeHouseholdId) {
      try {
        setSessionError("");
        await api.createIncome(activeHouseholdId, {
          source: incomeDraft.source,
          amountCents: toCents(incomeDraft.amount),
          receivedAt: incomeDraft.receivedAt || todayDate(),
          note: incomeDraft.note || undefined,
          isRecurring: incomeDraft.isRecurring
        });
        await refreshHouseholdData(activeHouseholdId);
        setIncomeDraft({ source: "Salary", amount: "", receivedAt: todayDate(), note: "", isRecurring: true });
      } catch (error) {
        setSessionError(error.message);
      }
    }
  }

  async function addExpense() {
    if (!expenseDraft.amount) return;
    if (authUser && activeHouseholdId) {
      try {
        setSessionError("");
        await api.createExpense(activeHouseholdId, {
          amountCents: toCents(expenseDraft.amount),
          category: expenseDraft.category,
          spentAt: todayDate(),
          note: expenseDraft.note || expenseDraft.category,
          paymentMethod: expenseDraft.method,
          scope: expenseDraft.scope,
          isPrivate: expenseDraft.isPrivate
        });
        await refreshHouseholdData(activeHouseholdId);
        setExpenseDraft({ amount: "", category: "Food", scope: "shared", note: "", method: "Card", isPrivate: false });
      } catch (error) {
        setSessionError(error.message);
      }
      return;
    }

    setState((current) => ({
      ...current,
      expenses: [{
        id: `exp-${Date.now()}`,
        amount: Number(expenseDraft.amount),
        category: expenseDraft.category,
        date: "2026-05-18",
        method: expenseDraft.method,
        scope: expenseDraft.scope,
        isPrivate: expenseDraft.isPrivate,
        note: expenseDraft.note || expenseDraft.category,
        userId: current.activeUserId
      }, ...current.expenses]
    }));
    setExpenseDraft({ amount: "", category: "Food", scope: "shared", note: "", method: "Card", isPrivate: false });
  }

  async function addTask() {
    if (!taskDraft.title) return;
    if (authUser && activeHouseholdId && backendUser) {
      try {
        setSessionError("");
        await api.createTask(activeHouseholdId, {
          assigneeId: taskDraft.assignee === "self" ? backendUser.id : taskDraft.assignee,
          title: taskDraft.title,
          dueDate: taskDraft.due || undefined,
          priority: taskDraft.priority.toLowerCase(),
          notes: taskDraft.notes || undefined
        });
        await refreshHouseholdData(activeHouseholdId);
        setTaskDraft({ title: "", assignee: "self", due: "2026-05-20", priority: "Medium", notes: "" });
      } catch (error) {
        setSessionError(error.message);
      }
      return;
    }

    setState((current) => ({
      ...current,
      tasks: [{
        id: `task-${Date.now()}`,
        title: taskDraft.title,
        assignee: taskDraft.assignee,
        createdBy: current.activeUserId,
        due: taskDraft.due,
        priority: taskDraft.priority,
        notes: taskDraft.notes,
        completed: false
      }, ...current.tasks]
    }));
    setTaskDraft({ title: "", assignee: "self", due: "2026-05-20", priority: "Medium", notes: "" });
  }

  async function toggleTask(taskId) {
    if (authUser && activeHouseholdId) {
      try {
        setSessionError("");
        await api.completeTask(activeHouseholdId, taskId);
        await refreshHouseholdData(activeHouseholdId);
      } catch (error) {
        setSessionError(error.message);
      }
      return;
    }

    setState((current) => ({
      ...current,
      tasks: current.tasks.map((task) => task.id === taskId ? { ...task, completed: !task.completed } : task)
    }));
  }

  async function addSubscription() {
    if (!subscriptionDraft.name || !subscriptionDraft.cost) return;
    if (authUser && activeHouseholdId) {
      try {
        setSessionError("");
        await api.createSubscription(activeHouseholdId, {
          name: subscriptionDraft.name,
          costCents: toCents(subscriptionDraft.cost),
          billingCycle: subscriptionDraft.billingCycle,
          renewalDate: subscriptionDraft.renewalDate || undefined
        });
        await refreshHouseholdData(activeHouseholdId);
        setSubscriptionDraft({ name: "", cost: "", billingCycle: "monthly", renewalDate: "2026-06-01" });
      } catch (error) {
        setSessionError(error.message);
      }
    }
  }

  async function addGoal() {
    if (!goalDraft.name || !goalDraft.target) return;
    if (authUser && activeHouseholdId) {
      try {
        setSessionError("");
        await api.createGoal(activeHouseholdId, {
          name: goalDraft.name,
          targetCents: toCents(goalDraft.target),
          savedCents: toCents(goalDraft.saved || 0),
          targetMonth: goalDraft.targetMonth || undefined
        });
        await refreshHouseholdData(activeHouseholdId);
        setGoalDraft({ name: "Emergency fund", target: "", saved: "", targetMonth: "2026-12" });
      } catch (error) {
        setSessionError(error.message);
      }
    }
  }

  async function addNetWorthItem() {
    if (!netWorthDraft.name || !netWorthDraft.value) return;
    if (authUser && activeHouseholdId) {
      try {
        setSessionError("");
        await api.createNetWorth(activeHouseholdId, {
          name: netWorthDraft.name,
          itemType: netWorthDraft.itemType,
          category: netWorthDraft.category,
          valueCents: toCents(netWorthDraft.value),
          asOfDate: netWorthDraft.asOfDate || undefined
        });
        await refreshHouseholdData(activeHouseholdId);
        setNetWorthDraft({ name: "", itemType: "asset", category: "bank", value: "", asOfDate: todayDate() });
      } catch (error) {
        setSessionError(error.message);
      }
    }
  }

  async function toggleReminder(ruleType, enabled, localTime) {
    const nextReminders = { ...state.reminders, [ruleType]: enabled };
    setState((current) => ({ ...current, reminders: nextReminders }));
    if (!authUser || !activeHouseholdId) return;

    try {
      setSessionError("");
      await api.saveReminderRule(activeHouseholdId, {
        ruleType: reminderRuleMap[ruleType] || ruleType,
        enabled,
        localTime
      });
    } catch (error) {
      setSessionError(error.message);
    }
  }

  async function registerPushDevice() {
    if (!authUser || !activeHouseholdId) {
      setPushStatus("Login and create a household before enabling push.");
      return;
    }

    try {
      setPushStatus("Requesting notification permission");
      const token = await getExpoPushToken();
      await api.registerDevice(activeHouseholdId, {
        provider: "expo",
        token,
        platform: "expo",
        deviceName: "KinLedger mobile"
      });
      setPushTokenPreview(`${token.slice(0, 18)}...`);
      setPushStatus("Push device registered");
    } catch (error) {
      setPushStatus(error.message);
    }
  }

  async function sendTestPush() {
    if (!authUser || !activeHouseholdId) {
      setPushStatus("Login and create a household before sending a test push.");
      return;
    }

    try {
      setPushStatus("Sending test push");
      const result = await api.sendTestNotification(activeHouseholdId);
      await refreshHouseholdData(activeHouseholdId);
      setPushStatus(result.tokenCount ? "Test push sent" : "No registered push token yet");
    } catch (error) {
      setPushStatus(error.message);
    }
  }

  function choosePlan(planId) {
    setState((current) => ({
      ...current,
      household: { ...current.household, selectedPlan: planId }
    }));
  }

  async function selectLivePlan(planCode) {
    if (!authUser || !activeHouseholdId) {
      choosePlan(planCode);
      return;
    }

    try {
      setPlanStatus("Updating plan");
      const selected = await api.selectPlan(activeHouseholdId, {
        planCode,
        billingCycle: planBillingCycle
      });
      setCurrentPlan(selected);
      setPlanStatus("Plan updated");
    } catch (error) {
      setPlanStatus(error.message);
    }
  }

  async function startStripeCheckout(planCode) {
    if (!authUser || !activeHouseholdId) {
      setPlanStatus("Login and create a household before checkout.");
      return;
    }

    try {
      setPlanStatus("Starting checkout");
      const checkout = await api.createCheckout(activeHouseholdId, {
        planCode,
        billingCycle: planBillingCycle
      });
      if (checkout.free) {
        setCurrentPlan(checkout.subscription);
        setPlanStatus("Free plan activated");
        return;
      }
      if (typeof window !== "undefined" && checkout.checkoutUrl) {
        window.location.href = checkout.checkoutUrl;
      } else {
        setPlanStatus(checkout.checkoutUrl || "Checkout session created");
      }
    } catch (error) {
      setPlanStatus(error.message);
    }
  }

  async function askAssistant() {
    if (!authUser || !activeHouseholdId) {
      setAssistantAnswer("");
      setAssistantStatus("Sign in and create a household before asking the live AI assistant.");
      return;
    }

    if (!assistantQuestion.trim()) {
      setAssistantStatus("Type a question first.");
      return;
    }

    try {
      setAssistantStatus("Thinking");
      const result = await api.askAssistant(activeHouseholdId, assistantQuestion.trim());
      setAssistantAnswer(result.answer);
      setAssistantStatus("Answered");
    } catch (error) {
      setAssistantStatus(error.message);
    }
  }

  function renderScreen() {
    if (screen === "dashboard") return <Dashboard state={state} summary={authUser ? liveSummary : summary} authUser={authUser} liveExpenses={liveExpenses} liveSubscriptions={liveSubscriptions} liveNotifications={liveNotifications} />;
    if (screen === "income") return <Income authUser={authUser} liveIncome={liveIncome} draft={incomeDraft} setDraft={setIncomeDraft} addIncome={addIncome} sessionError={sessionError} />;
    if (screen === "expenses") return <Expenses state={state} authUser={authUser} liveExpenses={liveExpenses} draft={expenseDraft} setDraft={setExpenseDraft} addExpense={addExpense} sessionError={sessionError} />;
    if (screen === "tasks") return <Tasks state={state} authUser={authUser} backendUser={backendUser} householdMembers={householdMembers} householdInvites={householdInvites} liveTasks={liveTasks} draft={taskDraft} setDraft={setTaskDraft} addTask={addTask} toggleTask={toggleTask} sessionError={sessionError} />;
    if (screen === "analytics") return <Analytics state={state} summary={authUser ? liveSummary : summary} authUser={authUser} liveExpenses={liveExpenses} />;
    if (screen === "subscriptions") return <Subscriptions state={state} authUser={authUser} liveSubscriptions={liveSubscriptions} draft={subscriptionDraft} setDraft={setSubscriptionDraft} addSubscription={addSubscription} sessionError={sessionError} />;
    if (screen === "goals") return <Goals state={state} authUser={authUser} liveGoals={liveGoals} draft={goalDraft} setDraft={setGoalDraft} addGoal={addGoal} sessionError={sessionError} />;
    if (screen === "networth") return <NetWorth state={state} authUser={authUser} liveNetWorth={liveNetWorth} draft={netWorthDraft} setDraft={setNetWorthDraft} addNetWorthItem={addNetWorthItem} sessionError={sessionError} />;
    if (screen === "assistant") return <Assistant state={state} summary={summary} authUser={authUser} activeHouseholdId={activeHouseholdId} question={assistantQuestion} setQuestion={setAssistantQuestion} answer={assistantAnswer} status={assistantStatus} askAssistant={askAssistant} />;
    if (screen === "reminders") return <Reminders state={state} toggleReminder={toggleReminder} registerPushDevice={registerPushDevice} sendTestPush={sendTestPush} pushStatus={pushStatus} pushTokenPreview={pushTokenPreview} sessionError={sessionError} />;
    if (screen === "settings") return <Settings settingsState={settingsState} setSettingsState={setSettingsState} />;
    if (screen === "account") return <AccountScreen authUser={authUser} backendUser={backendUser} households={households} activeHouseholdId={activeHouseholdId} householdMembers={householdMembers} householdInvites={householdInvites} lastInvite={lastInvite} householdDraft={householdDraft} setHouseholdDraft={setHouseholdDraft} createBackendHousehold={createBackendHousehold} inviteDraft={inviteDraft} setInviteDraft={setInviteDraft} sendInvite={sendInvite} sessionStatus={sessionStatus} sessionError={sessionError} signOutUser={signOutUser} deleteConfirm={deleteConfirm} setDeleteConfirm={setDeleteConfirm} deleteAccount={deleteAccount} />;
    if (screen === "plans") return <Plans state={state} authUser={authUser} livePlans={livePlans} currentPlan={currentPlan} billingCycle={planBillingCycle} setBillingCycle={setPlanBillingCycle} choosePlan={choosePlan} selectLivePlan={selectLivePlan} startStripeCheckout={startStripeCheckout} planStatus={planStatus} />;
    if (screen === "link") return <LinkAccount state={state} authUser={authUser} activeHouseholdId={activeHouseholdId} householdMembers={householdMembers} householdInvites={householdInvites} lastInvite={lastInvite} inviteDraft={inviteDraft} setInviteDraft={setInviteDraft} sendInvite={sendInvite} sessionError={sessionError} />;
    if (screen === "acceptInvite") return <AcceptInvite token={incomingInviteToken} authUser={authUser} status={inviteAcceptStatus} acceptInvite={acceptIncomingInvite} />;
    return <More setScreen={setScreen} />;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>{headerAccountType} account - {headerName}</Text>
          <Text style={styles.brand}>KinLedger</Text>
        </View>
      </View>

      <View style={styles.profileStrip}>
        {authUser ? (
          <>
            <TouchableOpacity style={[styles.avatar, styles.avatarActive]} onPress={() => setScreen("account")}>
              <Text style={[styles.avatarInitial, styles.avatarInitialActive]}>{(backendUser?.display_name || authUser.email || "U")[0].toUpperCase()}</Text>
              <Text style={[styles.avatarText, styles.avatarTextActive]}>{backendUser?.display_name || authUser.email}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.linkPill} onPress={() => setScreen("account")}>
              <Text style={styles.linkText}>Account</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            {Object.values(state.users).map((user) => (
              <TouchableOpacity
                key={user.id}
                style={[styles.avatar, state.activeUserId === user.id && styles.avatarActive]}
                onPress={() => setState((current) => ({ ...current, activeUserId: user.id }))}
              >
                <Text style={[styles.avatarInitial, state.activeUserId === user.id && styles.avatarInitialActive]}>{user.name[0]}</Text>
                <Text style={[styles.avatarText, state.activeUserId === user.id && styles.avatarTextActive]}>{user.name}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.linkPill} onPress={() => setScreen("link")}>
              <Text style={styles.linkText}>Link spouse</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {!authUser && isFirebaseConfigured ? (
          <AuthPanel draft={authDraft} setDraft={setAuthDraft} submitAuth={submitAuth} sessionStatus={sessionStatus} sessionError={sessionError} />
        ) : null}
        {!authUser && incomingInviteToken ? (
          <AcceptInvite token={incomingInviteToken} authUser={authUser} status={inviteAcceptStatus} acceptInvite={acceptIncomingInvite} />
        ) : null}
        {!isFirebaseConfigured ? (
          <AuthSetupNotice />
        ) : null}
        {isFirebaseConfigured && !authUser ? null : authUser && !activeHouseholdId ? (
          <AccountScreen authUser={authUser} backendUser={backendUser} households={households} activeHouseholdId={activeHouseholdId} householdMembers={householdMembers} householdInvites={householdInvites} lastInvite={lastInvite} householdDraft={householdDraft} setHouseholdDraft={setHouseholdDraft} createBackendHousehold={createBackendHousehold} inviteDraft={inviteDraft} setInviteDraft={setInviteDraft} sendInvite={sendInvite} sessionStatus={sessionStatus} sessionError={sessionError} signOutUser={signOutUser} deleteConfirm={deleteConfirm} setDeleteConfirm={setDeleteConfirm} deleteAccount={deleteAccount} />
        ) : (
          <>
            {authUser ? <SignedInActions signOutUser={signOutUser} setScreen={setScreen} /> : null}
            {renderScreen()}
          </>
        )}
      </ScrollView>

      <View style={styles.bottomTabs}>
        {tabs.map(([id, label]) => (
          <TouchableOpacity key={id} style={[styles.tab, screen === id && styles.tabActive]} onPress={() => setScreen(id)}>
            <Text style={[styles.tabText, screen === id && styles.tabTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

function Dashboard({ state, summary, authUser, liveExpenses, liveSubscriptions, liveNotifications }) {
  const biggest = authUser ? liveCategoryTotals(liveExpenses)[0] : categoryTotals(state, categories)[0];
  const subscriptionBurn = authUser ? Number(liveSubscriptions.monthlyBurnCents || 0) / 100 : summary.subscriptions;
  return (
    <View>
      <MetricGrid metrics={[
        ["Income", money(summary.income), authUser ? "live household income" : "monthly estimate"],
        ["Spent", money(summary.spent), authUser ? "live household spend" : `${Math.round((summary.spent / summary.income) * 100)}% of income`],
        ["Shared", money(summary.shared), "household spend"],
        ["Savings", `${Math.round(summary.savingsRatio)}%`, "ratio"],
      ]} />
      <Card title="Today" eyebrow="Smart insights">
        <Insight title="Overspending explanation" body={biggest ? `${biggest.category} is your largest category at ${money(biggest.amount)}.` : "No expenses yet."} />
        <Insight title="Reduction idea" body={subscriptionBurn > 40 ? `Subscriptions cost ${money(subscriptionBurn)} monthly. Review unused renewals.` : "Recurring costs are modest."} />
        <Insight title="Can we afford this?" body={authUser ? "Ask the AI assistant with your live household data for a purchase check." : `A ${money(900)} purchase leaves about ${money(summary.income - summary.spent - summary.subscriptions - 900)} before savings.`} />
      </Card>
      <Card title="Smart nudges" eyebrow="Reminders">
        <ListRow title="Expense reminder" detail={`Likely free at ${state.reminders.customTime}`} side="On" />
        <ListRow title="Bill reminder" detail="Before subscription and bill renewals" side="On" />
        <ListRow title="Assigned task reminder" detail={`${liveNotifications?.length || 0} live notifications`} side="On" />
      </Card>
    </View>
  );
}

function Income({ authUser, liveIncome, draft, setDraft, addIncome, sessionError }) {
  return (
    <View>
      <SectionTitle eyebrow="Income tracking" title="Add income" />
      {!authUser ? <InlineNotice title="Login required" body="Income tracking is saved to the live household account after login." /> : null}
      <Card>
        <Field label="Source" value={draft.source} onChangeText={(source) => setDraft({ ...draft, source })} />
        <Field label="Amount" value={draft.amount} onChangeText={(amount) => setDraft({ ...draft, amount })} keyboardType="numeric" />
        <Field label="Received date" value={draft.receivedAt} onChangeText={(receivedAt) => setDraft({ ...draft, receivedAt })} />
        <ToggleRow title="Recurring income" detail="Salary, retainer, pension, or repeating source" value={draft.isRecurring} onChange={(isRecurring) => setDraft({ ...draft, isRecurring })} />
        <Field label="Note" value={draft.note} onChangeText={(note) => setDraft({ ...draft, note })} />
        <TouchableOpacity style={styles.primary} onPress={addIncome}><Text style={styles.primaryText}>Add income</Text></TouchableOpacity>
        {sessionError ? <Text style={styles.errorText}>{sessionError}</Text> : null}
      </Card>
      {liveIncome.map((item) => (
        <ListRow key={item.id} title={item.source} detail={`${item.received_at || ""} - ${item.is_recurring ? "recurring" : "one-time"} - ${item.note || item.created_by_name || "Income"}`} side={fromCents(item.amount_cents)} />
      ))}
    </View>
  );
}

function Expenses({ state, authUser, liveExpenses, draft, setDraft, addExpense, sessionError }) {
  const rows = authUser ? liveExpenses : state.expenses;
  return (
    <View>
      <SectionTitle eyebrow="Expense tracking" title="Add expense" />
      <Card>
        <Field label="Amount" value={draft.amount} onChangeText={(amount) => setDraft({ ...draft, amount })} keyboardType="numeric" />
        <ChoiceRow options={categories.slice(0, 5)} value={draft.category} onChange={(category) => setDraft({ ...draft, category })} />
        <ChoiceRow options={["personal", "shared", "split"]} value={draft.scope} onChange={(scope) => setDraft({ ...draft, scope })} />
        <ToggleRow title="Private expense" detail="Hide from linked users without private permission" value={draft.isPrivate} onChange={(isPrivate) => setDraft({ ...draft, isPrivate })} />
        <Field label="Note" value={draft.note} onChangeText={(note) => setDraft({ ...draft, note })} />
        <TouchableOpacity style={styles.primary} onPress={addExpense}><Text style={styles.primaryText}>Add expense</Text></TouchableOpacity>
        {sessionError ? <Text style={styles.errorText}>{sessionError}</Text> : null}
      </Card>
      {rows.map((item) => (
        <ListRow key={item.id} title={item.note || item.category} detail={authUser ? `${item.category} - ${item.scope} - ${item.created_by_name || "You"}` : `${item.category} - ${item.scope} - ${state.users[item.userId]?.name}`} side={authUser ? fromCents(item.amount_cents) : money(item.amount)} />
      ))}
    </View>
  );
}

function Tasks({ state, authUser, backendUser, householdMembers, householdInvites, liveTasks, draft, setDraft, addTask, toggleTask, sessionError }) {
  const liveMode = Boolean(authUser);
  const visibleTasks = liveMode ? liveTasks : state.tasks;
  const assignees = liveMode
    ? [
        { id: "self", name: backendUser?.display_name || authUser?.email || "Me" },
        ...householdMembers.filter((member) => member.user_id !== backendUser?.id).map((member) => ({ id: member.user_id, name: member.display_name || member.email || "Member" }))
      ]
    : Object.keys(state.users).map((id) => ({ id, name: state.users[id].name }));
  const missed = visibleTasks.filter((task) => (task.status || (task.completed ? "completed" : "pending")) !== "completed" && (task.due_date || task.due || "") < todayDate()).length;
  const pending = visibleTasks.filter((task) => (task.status || (task.completed ? "completed" : "pending")) === "pending").length;
  const completed = visibleTasks.filter((task) => (task.status || (task.completed ? "completed" : "pending")) === "completed").length;
  return (
    <View>
      <SectionTitle eyebrow="Couple tasks" title="Assign money tasks" />
      <MetricGrid metrics={[["Pending", pending, "open"], ["Completed", completed, "done"], ["Missed", missed, "late"]]} />
      <Card>
        <Field label="Task title" value={draft.title} onChangeText={(title) => setDraft({ ...draft, title })} />
        <ChoiceRow options={assignees.map((item) => item.id)} value={draft.assignee} onChange={(assignee) => setDraft({ ...draft, assignee })} labels={Object.fromEntries(assignees.map((item) => [item.id, { name: item.name }]))} />
        <Field label="Due date" value={draft.due} onChangeText={(due) => setDraft({ ...draft, due })} />
        <Field label="Notes" value={draft.notes} onChangeText={(notes) => setDraft({ ...draft, notes })} />
        <TouchableOpacity style={styles.primary} onPress={addTask}><Text style={styles.primaryText}>Assign task</Text></TouchableOpacity>
        {sessionError ? <Text style={styles.errorText}>{sessionError}</Text> : null}
      </Card>
      {visibleTasks.map((task) => (
        <TouchableOpacity key={task.id} onPress={() => toggleTask(task.id)}>
          <ListRow title={task.title} detail={liveMode ? `Assigned to ${task.assignee_name || "Member"} - ${task.notes || "No notes"}` : `Assigned to ${state.users[task.assignee]?.name} - ${task.notes || "No notes"}`} side={(task.status === "completed" || task.completed) ? "Done" : task.priority} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

function Analytics({ state, summary, authUser, liveExpenses }) {
  const rows = authUser ? liveCategoryTotals(liveExpenses) : categoryTotals(state, categories);
  const max = Math.max(1, ...rows.map((item) => item.amount));
  return (
    <View>
      <SectionTitle eyebrow="Analytics" title="Spending picture" />
      <Card>
        {rows.map((item) => (
          <View key={item.category} style={styles.barRow}>
            <View style={styles.barLabel}><Text style={styles.bold}>{item.category}</Text><Text>{money(item.amount)}</Text></View>
            <View style={styles.barTrack}><View style={[styles.barFill, { width: `${Math.max(5, (item.amount / max) * 100)}%` }]} /></View>
          </View>
        ))}
      </Card>
      <MetricGrid metrics={[
        ["Income", money(summary.income), "month"],
        ["Shared ratio", `${Math.round(summary.spent ? (summary.shared / summary.spent) * 100 : 0)}%`, "shared spend"],
        ["Overspend risk", summary.spent > summary.income * 0.55 ? "Medium" : "Low", "monthly pace"]
      ]} />
    </View>
  );
}

function Subscriptions({ state, authUser, liveSubscriptions, draft, setDraft, addSubscription, sessionError }) {
  const rows = authUser ? liveSubscriptions.items || [] : state.subscriptions;
  return (
    <View>
      <SectionTitle eyebrow="Subscription tracking" title="Recurring burn rate" />
      {authUser ? (
        <Card>
          <MetricGrid metrics={[["Monthly burn", fromCents(liveSubscriptions.monthlyBurnCents), "live recurring cost"]]} />
          <Field label="Subscription name" value={draft.name} onChangeText={(name) => setDraft({ ...draft, name })} />
          <Field label="Cost" value={draft.cost} onChangeText={(cost) => setDraft({ ...draft, cost })} keyboardType="numeric" />
          <ChoiceRow options={["monthly", "yearly"]} value={draft.billingCycle} onChange={(billingCycle) => setDraft({ ...draft, billingCycle })} />
          <Field label="Renewal date" value={draft.renewalDate} onChangeText={(renewalDate) => setDraft({ ...draft, renewalDate })} />
          <TouchableOpacity style={styles.primary} onPress={addSubscription}><Text style={styles.primaryText}>Add subscription</Text></TouchableOpacity>
          {sessionError ? <Text style={styles.errorText}>{sessionError}</Text> : null}
        </Card>
      ) : null}
      {rows.map((item) => (
        <ListRow key={item.id} title={item.name} detail={authUser ? `${item.billing_cycle} - renews ${item.renewal_date || "not set"} - ${item.cancel_recommendation || ""}` : `${item.cycle} - renews ${item.renewal}`} side={authUser ? fromCents(item.cost_cents) : money(item.cost)} />
      ))}
    </View>
  );
}

function Goals({ state, authUser, liveGoals, draft, setDraft, addGoal, sessionError }) {
  const rows = authUser ? liveGoals : state.goals;
  return (
    <View>
      <SectionTitle eyebrow="Goal setting" title="Build toward it" />
      {authUser ? (
        <Card>
          <Field label="Goal name" value={draft.name} onChangeText={(name) => setDraft({ ...draft, name })} />
          <Field label="Target amount" value={draft.target} onChangeText={(target) => setDraft({ ...draft, target })} keyboardType="numeric" />
          <Field label="Saved so far" value={draft.saved} onChangeText={(saved) => setDraft({ ...draft, saved })} keyboardType="numeric" />
          <Field label="Target month" value={draft.targetMonth} onChangeText={(targetMonth) => setDraft({ ...draft, targetMonth })} />
          <TouchableOpacity style={styles.primary} onPress={addGoal}><Text style={styles.primaryText}>Add goal</Text></TouchableOpacity>
          {sessionError ? <Text style={styles.errorText}>{sessionError}</Text> : null}
        </Card>
      ) : null}
      {rows.map((goal) => (
        <ListRow key={goal.id} title={goal.name} detail={authUser ? `${fromCents(goal.saved_cents)} of ${fromCents(goal.target_cents)} - suggest ${fromCents(goal.monthly_contribution_cents)}/mo` : `${money(goal.saved)} of ${money(goal.target)} - suggest ${money(goalContribution(goal))}/mo`} side={authUser ? `${Math.round((Number(goal.saved_cents || 0) / Math.max(1, Number(goal.target_cents || 1))) * 100)}%` : `${Math.round((goal.saved / goal.target) * 100)}%`} />
      ))}
    </View>
  );
}

function NetWorth({ state, authUser, liveNetWorth, draft, setDraft, addNetWorthItem, sessionError }) {
  const rows = authUser ? liveNetWorth.items || [] : state.netWorthItems;
  return (
    <View>
      <SectionTitle eyebrow="Net worth" title="Assets minus liabilities" />
      <Card><Text style={styles.metricValue}>{authUser ? fromCents(liveNetWorth.totalCents) : money(netWorth(state))}</Text><Text style={styles.muted}>Total net worth</Text></Card>
      {authUser ? (
        <Card>
          <Field label="Item name" value={draft.name} onChangeText={(name) => setDraft({ ...draft, name })} />
          <ChoiceRow options={["asset", "liability"]} value={draft.itemType} onChange={(itemType) => setDraft({ ...draft, itemType })} />
          <Field label="Category" value={draft.category} onChangeText={(category) => setDraft({ ...draft, category })} />
          <Field label="Value" value={draft.value} onChangeText={(value) => setDraft({ ...draft, value })} keyboardType="numeric" />
          <Field label="As of date" value={draft.asOfDate} onChangeText={(asOfDate) => setDraft({ ...draft, asOfDate })} />
          <TouchableOpacity style={styles.primary} onPress={addNetWorthItem}><Text style={styles.primaryText}>Add net worth item</Text></TouchableOpacity>
          {sessionError ? <Text style={styles.errorText}>{sessionError}</Text> : null}
        </Card>
      ) : null}
      {rows.map((item) => (
        <ListRow key={item.id} title={item.name} detail={`${authUser ? item.item_type : item.type} - ${item.category}`} side={authUser ? fromCents(item.value_cents) : money(item.value)} />
      ))}
    </View>
  );
}

function Assistant({ state, summary, authUser, activeHouseholdId, question, setQuestion, answer, status, askAssistant }) {
  const biggest = categoryTotals(state, categories)[0];
  const demoAnswer = `You have about ${money(summary.income - summary.spent - summary.subscriptions)} left before savings. ${biggest ? `${biggest.category} is driving the most spend at ${money(biggest.amount)}. ` : ""}Cap flexible spending and move at least 25% of leftover cash into goals.`;
  return (
    <View>
      <SectionTitle eyebrow="AI financial assistant" title="Ask the budget" />
      <Card>
        <Field label="Question" value={question} onChangeText={setQuestion} multiline />
        <TouchableOpacity style={styles.primary} onPress={askAssistant}>
          <Text style={styles.primaryText}>Ask AI assistant</Text>
        </TouchableOpacity>
        {status ? <Text style={status === "Answered" ? styles.muted : styles.errorText}>{status}</Text> : null}
        <Text style={styles.answer}>{authUser && activeHouseholdId ? (answer || "Ask about overspending, savings plans, or whether the household can afford a purchase.") : demoAnswer}</Text>
      </Card>
    </View>
  );
}

function Reminders({ state, toggleReminder, registerPushDevice, sendTestPush, pushStatus, pushTokenPreview, sessionError }) {
  return (
    <View>
      <SectionTitle eyebrow="Notifications" title="Reminder rules" />
      <Card>
        <Text style={styles.listTitle}>Push device</Text>
        <Text style={styles.listDetail}>{pushTokenPreview ? `Registered token ${pushTokenPreview}` : "Register this phone for Expo push notifications."}</Text>
        <TouchableOpacity style={styles.primary} onPress={registerPushDevice}>
          <Text style={styles.primaryText}>Enable push on this device</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={sendTestPush}>
          <Text style={styles.secondaryText}>Send test notification</Text>
        </TouchableOpacity>
        {pushStatus ? <Text style={pushStatus.includes("sent") || pushStatus.includes("registered") ? styles.muted : styles.errorText}>{pushStatus}</Text> : null}
      </Card>
      <ToggleRow title="Likely-free expense reminder" detail={`Custom time ${state.reminders.customTime}`} value={Boolean(state.reminders.expense)} onChange={(enabled) => toggleReminder("expense", enabled, state.reminders.customTime)} />
      <ToggleRow title="Evening reminder" detail="Daily expense nudge" value={Boolean(state.reminders.evening)} onChange={(enabled) => toggleReminder("evening", enabled, state.reminders.customTime)} />
      <ToggleRow title="Missed expense reminder" detail="Follow up after skipped days" value={Boolean(state.reminders.missed)} onChange={(enabled) => toggleReminder("missed", enabled, state.reminders.customTime)} />
      <ToggleRow title="Bill reminder" detail="Before bills are due" value={Boolean(state.reminders.bills)} onChange={(enabled) => toggleReminder("bills", enabled, state.reminders.customTime)} />
      <ToggleRow title="Subscription renewal" detail="Before recurring charges" value={Boolean(state.reminders.subscription ?? true)} onChange={(enabled) => toggleReminder("subscription", enabled, state.reminders.customTime)} />
      <ToggleRow title="Goal reminder" detail="Prompt monthly contributions" value={Boolean(state.reminders.goal ?? true)} onChange={(enabled) => toggleReminder("goal", enabled, state.reminders.customTime)} />
      <ToggleRow title="Assigned task reminder" detail="Notify spouse or family assignee" value={Boolean(state.reminders.assignedTask ?? true)} onChange={(enabled) => toggleReminder("assignedTask", enabled, state.reminders.customTime)} />
      <ToggleRow title="Overspending alert" detail="Warn when category spend spikes" value={Boolean(state.reminders.overspending ?? true)} onChange={(enabled) => toggleReminder("overspending", enabled, state.reminders.customTime)} />
      {sessionError ? <Text style={styles.errorText}>{sessionError}</Text> : null}
    </View>
  );
}

function AuthPanel({ draft, setDraft, submitAuth, sessionStatus, sessionError }) {
  return (
    <View>
      <SectionTitle eyebrow="Firebase Auth" title="Login or register" />
      <Card>
        <Field label="Email" value={draft.email} autoCapitalize="none" keyboardType="email-address" onChangeText={(email) => setDraft({ ...draft, email })} />
        <Field label="Password" value={draft.password} secureTextEntry onChangeText={(password) => setDraft({ ...draft, password })} />
        <Field label="Display name" value={draft.displayName} onChangeText={(displayName) => setDraft({ ...draft, displayName })} />
        <TouchableOpacity style={styles.primary} onPress={() => submitAuth("login")}>
          <Text style={styles.primaryText}>Login</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => submitAuth("register")}>
          <Text style={styles.secondaryText}>Create account</Text>
        </TouchableOpacity>
        <Text style={styles.muted}>{sessionStatus}</Text>
        {sessionError ? <Text style={styles.errorText}>{sessionError}</Text> : null}
      </Card>
    </View>
  );
}

function AuthSetupNotice() {
  return (
    <View>
      <SectionTitle eyebrow="Authentication setup" title="Firebase is not configured yet" />
      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>Real login is disabled</Text>
        <Text style={styles.noticeBody}>Create mobile/.env from mobile/.env.example and add your Firebase Web App values. Then create backend/.env from backend/.env.example with Firebase Admin and PostgreSQL values.</Text>
      </View>
      <Card>
        <Text style={styles.listTitle}>You are viewing demo data</Text>
        <Text style={styles.listDetail}>The static file and Expo app can still be clicked through, but Firebase email login will only appear after env values are present and the Expo server is restarted.</Text>
      </Card>
    </View>
  );
}

function AccountScreen({ authUser, backendUser, households, activeHouseholdId, householdMembers, householdInvites, lastInvite, householdDraft, setHouseholdDraft, createBackendHousehold, inviteDraft, setInviteDraft, sendInvite, sessionStatus, sessionError, signOutUser, deleteConfirm, setDeleteConfirm, deleteAccount }) {
  return (
    <View>
      <SectionTitle eyebrow="Production account" title="Backend connection" />
      <Card>
        <Text style={styles.listTitle}>{authUser?.email || "Signed in user"}</Text>
        <Text style={styles.listDetail}>Backend user: {backendUser?.id || "not synced yet"}</Text>
        <Text style={styles.listDetail}>Status: {sessionStatus}</Text>
        {sessionError ? <Text style={styles.errorText}>{sessionError}</Text> : null}
      </Card>
      {!backendUser ? (
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Backend setup required</Text>
          <Text style={styles.noticeBody}>Firebase login succeeded. Now start the Nest backend on port 3000 with backend/.env and PostgreSQL configured so this account can sync.</Text>
        </View>
      ) : null}
      <SectionTitle eyebrow="Household setup" title="Create or select household" />
      {households.map((household) => (
        <ListRow key={household.id} title={household.name} detail={`${household.account_type} - ${household.permission}`} side={activeHouseholdId === household.id ? "Active" : "Ready"} />
      ))}
      <Card>
        <Field label="Household name" value={householdDraft.name} onChangeText={(name) => setHouseholdDraft({ ...householdDraft, name })} />
        <ChoiceRow options={["single", "couple", "family"]} value={householdDraft.accountType} onChange={(accountType) => setHouseholdDraft({ ...householdDraft, accountType })} />
        <TouchableOpacity style={styles.primary} onPress={createBackendHousehold}>
          <Text style={styles.primaryText}>Create household</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={signOutUser}>
          <Text style={styles.secondaryText}>Sign out</Text>
        </TouchableOpacity>
      </Card>
      <MemberInvitePanel activeHouseholdId={activeHouseholdId} householdMembers={householdMembers} householdInvites={householdInvites} lastInvite={lastInvite} inviteDraft={inviteDraft} setInviteDraft={setInviteDraft} sendInvite={sendInvite} sessionError={sessionError} />
      <SectionTitle eyebrow="Account actions" title="Security" />
      <Card>
        <TouchableOpacity style={styles.secondaryButton} onPress={signOutUser}>
          <Text style={styles.secondaryText}>Sign out</Text>
        </TouchableOpacity>
        <Field label="Type DELETE to delete account" value={deleteConfirm} onChangeText={setDeleteConfirm} autoCapitalize="characters" />
        <TouchableOpacity style={styles.dangerButton} onPress={deleteAccount}>
          <Text style={styles.dangerText}>Delete account</Text>
        </TouchableOpacity>
        <Text style={styles.listDetail}>Deletion removes the synced backend user and then asks Firebase to delete the login. Firebase may require a fresh login first.</Text>
      </Card>
    </View>
  );
}

function SignedInActions({ signOutUser, setScreen }) {
  return (
    <View style={styles.notice}>
      <Text style={styles.noticeTitle}>Live account</Text>
      <Text style={styles.noticeBody}>You are signed in. Household, expenses, tasks, subscriptions, goals, net worth, reminders, and AI assistant now use live backend data.</Text>
      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.smallButton} onPress={() => setScreen("account")}>
          <Text style={styles.smallButtonText}>Account</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.smallButton} onPress={signOutUser}>
          <Text style={styles.smallButtonText}>Sign out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function InlineNotice({ title, body }) {
  return (
    <View style={styles.notice}>
      <Text style={styles.noticeTitle}>{title}</Text>
      <Text style={styles.noticeBody}>{body}</Text>
    </View>
  );
}

function Settings({ settingsState, setSettingsState }) {
  return (
    <View>
      <SectionTitle eyebrow="Privacy & security" title="Permissions and models" />
      <ToggleRow title="Biometric login" detail="Ready for native integration" value={settingsState.biometric} onChange={(biometric) => setSettingsState({ ...settingsState, biometric })} />
      <ToggleRow title="PIN lock" detail="Local lock state in MVP" value={settingsState.pinLock} onChange={(pinLock) => setSettingsState({ ...settingsState, pinLock })} />
      <ToggleRow title="Private expenses" detail="Hide personal items by default" value={settingsState.privateExpenses} onChange={(privateExpenses) => setSettingsState({ ...settingsState, privateExpenses })} />
      <ToggleRow title="Shared expenses" detail="Allow household-level expense tracking" value={settingsState.sharedExpenses} onChange={(sharedExpenses) => setSettingsState({ ...settingsState, sharedExpenses })} />
      <ToggleRow title="Spouse private access" detail="Permission gate for linked users" value={settingsState.spouseCanViewPrivate} onChange={(spouseCanViewPrivate) => setSettingsState({ ...settingsState, spouseCanViewPrivate })} />
      <Card><Text style={styles.muted}>Backend models: users, households, household_members, plans, subscriptions, expenses, expense_splits, tasks, goals, net_worth_items, notifications, reminder_rules, audit_logs.</Text></Card>
    </View>
  );
}

function Plans({ state, authUser, livePlans, currentPlan, billingCycle, setBillingCycle, choosePlan, selectLivePlan, startStripeCheckout, planStatus }) {
  const rows = authUser ? livePlans : plans;
  return (
    <View>
      <SectionTitle eyebrow="Subscription plans" title="Choose plan" />
      {authUser ? (
        <Card>
          <ChoiceRow options={["monthly", "yearly"]} value={billingCycle} onChange={setBillingCycle} />
          <Text style={styles.listDetail}>Current plan: {currentPlan?.name || "No active plan yet"}</Text>
          {planStatus ? <Text style={planStatus === "Plan updated" ? styles.muted : styles.errorText}>{planStatus}</Text> : null}
        </Card>
      ) : null}
      {rows.map((plan) => (
        <Card key={plan.id || plan.code}>
          <ListRow
            title={plan.name}
            detail={authUser ? `${plan.account_type} account - up to ${plan.max_members} member${plan.max_members === 1 ? "" : "s"}` : plan.fit}
            side={authUser ? `${planPrice(plan, billingCycle)}${billingCycle === "monthly" ? "/mo" : "/yr"}${currentPlan?.code === plan.code ? " selected" : ""}` : `${money(plan.monthly)}/mo${state.household.selectedPlan === plan.id ? " selected" : ""}`}
          />
          {authUser ? (
            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.smallButton} onPress={() => selectLivePlan(plan.code)}>
                <Text style={styles.smallButtonText}>Save plan</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.smallButton} onPress={() => startStripeCheckout(plan.code)}>
                <Text style={styles.smallButtonText}>{Number(plan.monthly_price_cents || 0) === 0 ? "Activate" : "Checkout"}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.secondaryButton} onPress={() => choosePlan(plan.id)}>
              <Text style={styles.secondaryText}>Select</Text>
            </TouchableOpacity>
          )}
        </Card>
      ))}
    </View>
  );
}

function MemberInvitePanel({ activeHouseholdId, householdMembers, householdInvites, lastInvite, inviteDraft, setInviteDraft, sendInvite, sessionError }) {
  const inviteUrl = lastInvite?.invite_url || (lastInvite?.invite_token ? `https://app.kinledger.local/invite/${lastInvite.invite_token}` : "");
  return (
    <View>
      <SectionTitle eyebrow="Linked accounts" title="Spouse / family invite" />
      {!activeHouseholdId ? <InlineNotice title="Create household first" body="A household is required before you can link a spouse or family member." /> : null}
      {householdMembers.map((member) => (
        <ListRow key={member.id} title={member.display_name || member.email || "Member"} detail={`${member.role} - ${member.permission}`} side="Linked" />
      ))}
      {householdInvites.map((invite) => (
        <ListRow key={invite.id} title={invite.invited_contact} detail={`${invite.relationship} - ${invite.permission}`} side="Invited" />
      ))}
      {lastInvite?.invite_token ? (
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>{lastInvite.email?.sent ? "Invite email sent" : "Invite created"}</Text>
          <Text style={styles.noticeBody}>{lastInvite.email?.sent ? "The invite was emailed. You can also share this link manually:" : `Email delivery is not active yet${lastInvite.email?.reason ? `: ${lastInvite.email.reason}` : ""}. Share this invite link manually for now:`}</Text>
          <Text style={styles.inviteCode}>{inviteUrl}</Text>
        </View>
      ) : null}
      <Card>
        <Field label="Email or phone" value={inviteDraft.contact} onChangeText={(contact) => setInviteDraft({ ...inviteDraft, contact })} />
        <ChoiceRow options={["spouse", "parent", "child"]} value={inviteDraft.relationship} onChange={(relationship) => setInviteDraft({ ...inviteDraft, relationship })} />
        <ChoiceRow options={["shared_only", "summary", "full"]} value={inviteDraft.permission} onChange={(permission) => setInviteDraft({ ...inviteDraft, permission })} />
        <TouchableOpacity style={styles.primary} onPress={sendInvite}>
          <Text style={styles.primaryText}>Send invite</Text>
        </TouchableOpacity>
        {sessionError ? <Text style={styles.errorText}>{sessionError}</Text> : null}
      </Card>
    </View>
  );
}

function LinkAccount({ state, authUser, activeHouseholdId, householdMembers, householdInvites, lastInvite, inviteDraft, setInviteDraft, sendInvite, sessionError }) {
  if (authUser) {
    return <MemberInvitePanel activeHouseholdId={activeHouseholdId} householdMembers={householdMembers} householdInvites={householdInvites} lastInvite={lastInvite} inviteDraft={inviteDraft} setInviteDraft={setInviteDraft} sendInvite={sendInvite} sessionError={sessionError} />;
  }

  return (
    <View>
      <SectionTitle eyebrow="Linked accounts" title="Spouse / family invite" />
      {state.household.links.map((link) => (
        <ListRow key={link.id} title={link.contact} detail={`${link.relationship} - ${link.permission}`} side={link.status} />
      ))}
    </View>
  );
}

function AcceptInvite({ token, authUser, status, acceptInvite }) {
  return (
    <View>
      <SectionTitle eyebrow="Household invite" title="Join linked account" />
      <Card>
        <Text style={styles.listTitle}>Invite ready</Text>
        <Text style={styles.listDetail}>{token ? "This invite will link your login to the household that sent it." : "No invite token was found in this link."}</Text>
        {!authUser ? <Text style={styles.listDetail}>Login or create your own account first. After login, return here to accept.</Text> : null}
        <TouchableOpacity style={styles.primary} onPress={acceptInvite}>
          <Text style={styles.primaryText}>Accept invite</Text>
        </TouchableOpacity>
        {status ? <Text style={status.includes("Joined") ? styles.muted : styles.errorText}>{status}</Text> : null}
      </Card>
    </View>
  );
}

function More({ setScreen }) {
  return (
    <View style={styles.moreGrid}>
      {["account", "income", "plans", "subscriptions", "goals", "networth", "assistant", "reminders", "settings", "link"].map((item) => (
        <TouchableOpacity key={item} style={styles.moreButton} onPress={() => setScreen(item)}>
          <Text style={styles.moreText}>{item}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function MetricGrid({ metrics }) {
  return (
    <View style={styles.metricGrid}>
      {metrics.map(([label, value, note]) => (
        <View key={label} style={styles.metric}>
          <Text style={styles.muted}>{label}</Text>
          <Text style={styles.metricValue}>{value}</Text>
          <Text style={styles.muted}>{note}</Text>
        </View>
      ))}
    </View>
  );
}

function Card({ title, eyebrow, children }) {
  return (
    <View style={styles.card}>
      {title ? <><Text style={styles.eyebrow}>{eyebrow}</Text><Text style={styles.cardTitle}>{title}</Text></> : null}
      {children}
    </View>
  );
}

function SectionTitle({ eyebrow, title }) {
  return (
    <View style={styles.sectionTitle}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.screenTitle}>{title}</Text>
    </View>
  );
}

function ToggleRow({ title, detail, value, onChange }) {
  return (
    <TouchableOpacity style={styles.toggleRow} onPress={() => onChange(!value)}>
      <View style={styles.listBody}>
        <Text style={styles.listTitle}>{title}</Text>
        <Text style={styles.listDetail}>{detail}</Text>
      </View>
      <View style={[styles.switchTrack, value && styles.switchTrackOn]}>
        <View style={[styles.switchThumb, value && styles.switchThumbOn]} />
      </View>
    </TouchableOpacity>
  );
}

function Field({ label, ...props }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput style={[styles.input, props.multiline && styles.inputMultiline]} placeholderTextColor="#8a9690" {...props} />
    </View>
  );
}

function ChoiceRow({ options, value, onChange, labels }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.choiceRow}>
      {options.map((option) => (
        <TouchableOpacity key={option} style={[styles.choice, value === option && styles.choiceActive]} onPress={() => onChange(option)}>
          <Text style={[styles.choiceText, value === option && styles.choiceTextActive]}>{labels ? labels[option].name : option}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

function ListRow({ title, detail, side }) {
  return (
    <View style={styles.listRow}>
      <View style={styles.listBody}>
        <Text style={styles.listTitle}>{title}</Text>
        <Text style={styles.listDetail}>{detail}</Text>
      </View>
      <Text style={styles.side}>{side}</Text>
    </View>
  );
}

function Insight({ title, body }) {
  return (
    <View style={styles.insight}>
      <Text style={styles.insightTitle}>{title}</Text>
      <Text style={styles.listDetail}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f4f5f0" },
  header: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  eyebrow: { color: "#66736d", fontSize: 11, fontWeight: "800", textTransform: "uppercase", marginBottom: 4 },
  brand: { color: "#16201c", fontSize: 24, fontWeight: "900" },
  lockButton: { minHeight: 44, minWidth: 54, borderRadius: 8, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  lockText: { fontWeight: "900", color: "#16201c" },
  profileStrip: { paddingHorizontal: 16, paddingBottom: 10, flexDirection: "row", gap: 8 },
  avatar: { minHeight: 44, borderRadius: 8, backgroundColor: "#fff", paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 8 },
  avatarActive: { backgroundColor: "#16372d" },
  avatarInitial: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#eef3f0", textAlign: "center", textAlignVertical: "center", fontWeight: "900" },
  avatarInitialActive: { backgroundColor: "#f1c95b" },
  avatarText: { color: "#66736d", fontWeight: "800" },
  avatarTextActive: { color: "#fff" },
  linkPill: { minHeight: 44, borderRadius: 8, paddingHorizontal: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#dbe9ff" },
  linkText: { color: "#15406d", fontWeight: "800" },
  content: { padding: 16, paddingBottom: 110 },
  bottomTabs: { position: "absolute", left: 12, right: 12, bottom: 12, padding: 8, borderRadius: 8, backgroundColor: "#fff", flexDirection: "row", gap: 6 },
  tab: { flex: 1, minHeight: 44, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  tabActive: { backgroundColor: "#16372d" },
  tabText: { color: "#66736d", fontWeight: "800", fontSize: 12 },
  tabTextActive: { color: "#fff" },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 12 },
  metric: { flexGrow: 1, flexBasis: "45%", borderRadius: 8, padding: 14, backgroundColor: "#fff", borderWidth: 1, borderColor: "#dce4df" },
  metricValue: { color: "#16201c", fontSize: 24, fontWeight: "900" },
  muted: { color: "#66736d" },
  card: { borderRadius: 8, padding: 16, backgroundColor: "#fff", borderWidth: 1, borderColor: "#dce4df", marginBottom: 12 },
  cardTitle: { fontSize: 19, fontWeight: "900", color: "#16201c", marginBottom: 12 },
  sectionTitle: { marginBottom: 12 },
  screenTitle: { fontSize: 22, fontWeight: "900", color: "#16201c" },
  field: { marginBottom: 12 },
  fieldLabel: { color: "#66736d", fontWeight: "800", marginBottom: 7 },
  input: { minHeight: 46, borderRadius: 8, borderWidth: 1, borderColor: "#dce4df", paddingHorizontal: 12, backgroundColor: "#fff", color: "#16201c" },
  inputMultiline: { minHeight: 86, paddingTop: 12, textAlignVertical: "top" },
  primary: { minHeight: 46, borderRadius: 8, backgroundColor: "#176f55", alignItems: "center", justifyContent: "center", paddingHorizontal: 14, marginBottom: 12 },
  primaryText: { color: "#fff", fontWeight: "900" },
  secondaryButton: { minHeight: 46, borderRadius: 8, backgroundColor: "#eef3f0", alignItems: "center", justifyContent: "center", paddingHorizontal: 14, marginBottom: 12 },
  secondaryText: { color: "#16201c", fontWeight: "900" },
  dangerButton: { minHeight: 46, borderRadius: 8, backgroundColor: "#c64b3b", alignItems: "center", justifyContent: "center", paddingHorizontal: 14, marginBottom: 12 },
  dangerText: { color: "#fff", fontWeight: "900" },
  errorText: { color: "#c64b3b", fontWeight: "800", marginTop: 8 },
  notice: { borderRadius: 8, padding: 12, backgroundColor: "#fff0ce", borderWidth: 1, borderColor: "#efd18f", marginBottom: 12 },
  noticeTitle: { color: "#8a5b0c", fontWeight: "900", marginBottom: 4 },
  noticeBody: { color: "#6f5a28", lineHeight: 20 },
  inviteCode: { color: "#16201c", fontWeight: "900", marginTop: 8, lineHeight: 20 },
  actionRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  smallButton: { minHeight: 38, borderRadius: 8, backgroundColor: "#fff", paddingHorizontal: 12, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#efd18f" },
  smallButtonText: { color: "#16201c", fontWeight: "900" },
  choiceRow: { gap: 8, paddingBottom: 12 },
  choice: { minHeight: 40, borderRadius: 8, borderWidth: 1, borderColor: "#dce4df", backgroundColor: "#fff", paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  choiceActive: { backgroundColor: "#16372d" },
  choiceText: { color: "#66736d", fontWeight: "800" },
  choiceTextActive: { color: "#fff" },
  listRow: { borderRadius: 8, padding: 14, backgroundColor: "#fff", borderWidth: 1, borderColor: "#dce4df", marginBottom: 10, flexDirection: "row", gap: 10, alignItems: "center" },
  toggleRow: { borderRadius: 8, padding: 14, backgroundColor: "#fff", borderWidth: 1, borderColor: "#dce4df", marginBottom: 10, flexDirection: "row", gap: 10, alignItems: "center" },
  listBody: { flex: 1 },
  listTitle: { fontSize: 16, fontWeight: "900", color: "#16201c", marginBottom: 3 },
  listDetail: { color: "#66736d", lineHeight: 20 },
  side: { color: "#16201c", fontWeight: "900" },
  switchTrack: { width: 50, height: 30, borderRadius: 15, padding: 3, backgroundColor: "#dce4df", justifyContent: "center" },
  switchTrackOn: { backgroundColor: "#176f55" },
  switchThumb: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#fff" },
  switchThumbOn: { transform: [{ translateX: 20 }] },
  insight: { borderRadius: 8, backgroundColor: "#eef3f0", padding: 12, marginBottom: 10 },
  insightTitle: { fontWeight: "900", color: "#15406d", marginBottom: 4 },
  barRow: { marginBottom: 13 },
  barLabel: { flexDirection: "row", justifyContent: "space-between", marginBottom: 7 },
  bold: { fontWeight: "900", color: "#16201c" },
  barTrack: { height: 10, borderRadius: 10, backgroundColor: "#eef3f0", overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 10, backgroundColor: "#2468a7" },
  answer: { color: "#16201c", lineHeight: 22, fontSize: 16 },
  moreGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  moreButton: { flexBasis: "47%", minHeight: 78, borderRadius: 8, backgroundColor: "#fff", borderWidth: 1, borderColor: "#dce4df", alignItems: "center", justifyContent: "center" },
  moreText: { fontWeight: "900", color: "#16201c", textTransform: "capitalize" }
});
