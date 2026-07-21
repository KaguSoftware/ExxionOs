// English is the SOURCE OF TRUTH for the dictionary shape.
//
// `fa.ts` is typed as `typeof en`, so a key added here and not there is a
// COMPILE ERROR, not a silently-missing string that ships to production. That
// is the whole reason this is hand-rolled rather than a library with runtime
// fallbacks: a fallback hides the bug, a type error reports it.
//
// Keep this file flat-ish and grouped by surface. Interpolation uses {name}
// placeholders resolved by `t()` in ./index.ts.

export const en = {
  app: {
    name: "ExxionOs",
    tagline: "Exxion internal system",
  },

  nav: {
    dashboard: "Dashboard",
    finance: "Finance",
    creative: "Creative",
    equipment: "Equipment",
    shipping: "Shipping",
    clients: "Clients",
    marketing: "Marketing",
    settings: "Settings",
    search: "Search",
    signOut: "Sign out",
    account: "Account",
    skipToContent: "Skip to content",
    openMenu: "Open menu",
    closeMenu: "Close menu",
  },

  auth: {
    signIn: "Sign in",
    signInSubtitle: "Sign in to continue to ExxionOs.",
    email: "Email",
    password: "Password",
    signingIn: "Signing in…",
    signOutConfirm: "Sign out of ExxionOs?",
    invalidCredentials: "That email and password don't match.",
    genericError: "Could not sign you in. Try again.",
  },

  dashboard: {
    title: "Dashboard",
    greetingMorning: "Good morning, {name}",
    greetingAfternoon: "Good afternoon, {name}",
    greetingEvening: "Good evening, {name}",
    needsYou: "Needs you",
    remindersDue: "{count} reminders due",
    reminderDue: "1 reminder due",
    allClear: "Nothing needs you right now.",
    reminders: "Reminders",
    addReminder: "Add a reminder",
    reminderPlaceholder: "What needs doing?",
    noReminders: "No reminders yet.",
    overdue: "Overdue",
    dueToday: "Due today",
    recentActivity: "Recent activity",
    noActivity: "Nothing has happened yet.",
    comingInPhase: "Arrives in a later phase.",
  },

  settings: {
    title: "Settings",
    subtitle: "Your profile and how the app looks.",
    profile: "Profile",
    fullName: "Full name",
    yourColor: "Your colour",
    colorHint: "Used to mark things you created.",
    appearance: "Appearance",
    language: "Language",
    theme: "Theme",
    themeLight: "Light",
    themeDark: "Dark",
    themeSystem: "System",
    english: "English",
    farsi: "فارسی",
    saved: "Settings saved.",
    saveFailed: "Could not save. Try again.",
  },

  common: {
    save: "Save",
    saving: "Saving…",
    cancel: "Cancel",
    delete: "Delete",
    edit: "Edit",
    create: "Create",
    add: "Add",
    remove: "Remove",
    close: "Close",
    confirm: "Confirm",
    back: "Back",
    search: "Search",
    filter: "Filter",
    clear: "Clear",
    none: "None",
    optional: "optional",
    required: "required",
    loading: "Loading…",
    today: "Today",
    yesterday: "Yesterday",
    tomorrow: "Tomorrow",
    chooseDate: "Choose a date",
    choose: "Choose…",
    noResults: "No results.",
    selected: "{count} selected",
    clearSelection: "Clear selection",
    somethingWentWrong: "Something went wrong",
    tryAgain: "Try again",
    errorBoundaryBody:
      "This page failed to load. The reference below identifies it in the server log.",
    reference: "Reference",
    notFound: "Not found",
    notFoundBody: "That page doesn't exist.",
    backToDashboard: "Back to dashboard",
  },

  create: {
    emptyConfirmTitle: "{fields} are empty",
    emptyConfirmBody: "Create it anyway?",
    emptyConfirmOne: "{fields} is empty",
  },

  finance: {
    title: "Finance",
    subtitle: "Everything that came in and went out.",

    thisMonth: "This month",
    income: "Income",
    expense: "Expense",
    net: "Net",
    balance: "Balance",

    transactions: "Transactions",
    newTransaction: "New transaction",
    editTransaction: "Edit transaction",
    noTransactions: "No transactions yet.",
    noTransactionsHint: "Record what came in and what went out — every figure here becomes a line on your charts.",
    noMatches: "Nothing matches those filters.",
    noMatchesHint: "Try a wider date range or clear the filters.",

    date: "Date",
    description: "Description",
    descriptionPlaceholder: "What was it?",
    amount: "Amount",
    category: "Category",
    direction: "Direction",
    money_in: "Money in",
    money_out: "Money out",
    note: "Note",
    notePlaceholder: "Anything worth remembering later",
    receipt: "Receipt",
    attachReceipt: "Attach a receipt",
    viewReceipt: "View receipt",
    removeReceipt: "Remove receipt",
    uploading: "Uploading…",

    filters: "Filters",
    from: "From",
    to: "To",
    allCategories: "All categories",
    allDirections: "Everything",
    searchPlaceholder: "Search descriptions",
    clearFilters: "Clear filters",
    exportCsv: "Export CSV",

    categories: "Categories",
    manageCategories: "Manage categories",
    newCategory: "New category",
    categoryName: "Category name",
    categoryKind: "Type",
    incomeCategory: "Income",
    expenseCategory: "Expense",
    archive: "Archive",
    unarchive: "Restore",
    archived: "Archived",
    archivedHint: "Archived categories stay on past transactions but stop appearing in pickers.",
    noCategories: "No categories yet.",

    recurring: "Recurring",
    recurringItems: "Recurring items",
    newRecurring: "New recurring item",
    editRecurring: "Edit recurring item",
    noRecurring: "No recurring items.",
    noRecurringHint: "Rent, electricity, a filament subscription — anything that repeats. Transactions are created for you.",
    label: "Label",
    labelPlaceholder: "Rent, electricity…",
    cadence: "Repeats",
    monthly: "Monthly",
    quarterly: "Every 3 months",
    yearly: "Yearly",
    dayOfMonth: "Day of month",
    dayOfMonthHint: "A day past the end of a short month bills on its last day.",
    startsOn: "Starts",
    endsOn: "Ends",
    endsOnHint: "Leave empty to repeat indefinitely",
    active: "Active",
    paused: "Paused",
    pause: "Pause",
    resume: "Resume",
    nextDue: "Next {date}",
    generated: "Created automatically",
    generatedFrom: "From {label}",

    chartInOut: "Income and expense",
    chartInOutHint: "Last 12 months",
    chartByCategory: "Where the money went",
    chartByCategoryHint: "Expenses in the selected range",
    chartNet: "Net over time",
    chartNetHint: "Income minus expense, by month",
    noChartData: "No data to chart yet.",
    noChartDataHint: "Add a few transactions and this fills in.",
    other: "Other",

    fromSection: "Added by {section}",
    fromEquipment: "Equipment",
    fromShipping: "Shipping",
    fromMarketing: "Marketing",
    fromClient: "Clients",
    deleteTransaction: "Delete this transaction?",
    deleteBody: "This can't be undone.",
    deleteLinkedBody:
      "This was created by {section}. Deleting it removes the financial record only — the original stays, and may create this row again.",
    deleteRecurringTitle: "Delete this recurring item?",
    deleteRecurringBody:
      "Transactions it already created stay — those months really happened. Only the template is removed.",

    saved: "Saved.",
    created: "Transaction added.",
    deleted: "Deleted.",
    saveFailed: "Could not save. Try again.",
    receiptTooBig: "That file is over 5 MB.",
    receiptWrongType: "Receipts must be an image or a PDF.",
  },

  units: {
    currency: "₺",
  },
};

/**
 * The dictionary SHAPE — every key of `en`, with `string` values.
 *
 * ⚠️ Deliberately NOT `typeof en` with `as const`. That would make each value
 * a string LITERAL type, so `fa.ts` would have to contain the English text to
 * typecheck — the opposite of the point. `Widen` keeps the key structure
 * strict (a missing or misspelled Farsi key is still a compile error) while
 * letting the values be any string.
 */
type Widen<T> = { [K in keyof T]: T[K] extends string ? string : Widen<T[K]> };

export type Dictionary = Widen<typeof en>;
