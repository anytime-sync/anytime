/**
 * i18n.ts — central language registry + minimal translation table for
 * pre-login pages.
 *
 * Adding a new language means:
 *   1. add a row to LANGUAGES below
 *   2. add a translation block to STRINGS below
 *   3. update the CHECK constraint via a follow-up migration
 *
 * UI labels INSIDE the app stay in English for v1 — only auth pages
 * (login, signup) and a few brand surfaces translate via this table,
 * because that's the user's first impression and hardest to change later.
 *
 * The two places where the user's language genuinely matters in the app:
 *   - AI-generated content (Daily Edition, Weekly Retro, parsed task titles)
 *   - Date formatting (date-fns locale)
 */
import { enUS, zhTW, zhCN, ja, ko, type Locale } from "date-fns/locale";

export type LanguageCode = "en" | "zh-TW" | "zh-CN" | "ja" | "ko";

export type LanguageDef = {
  code: LanguageCode;
  displayName: string;
  dateFnsLocale: Locale;
  aiName: string;
};

export const LANGUAGES: LanguageDef[] = [
  { code: "en",    displayName: "English",   dateFnsLocale: enUS, aiName: "English" },
  { code: "zh-TW", displayName: "繁體中文",  dateFnsLocale: zhTW, aiName: "Traditional Chinese (zh-TW)" },
  { code: "zh-CN", displayName: "简体中文",  dateFnsLocale: zhCN, aiName: "Simplified Chinese (zh-CN)" },
  { code: "ja",    displayName: "日本語",    dateFnsLocale: ja,   aiName: "Japanese" },
  { code: "ko",    displayName: "한국어",    dateFnsLocale: ko,   aiName: "Korean" },
];

export const DEFAULT_LANGUAGE: LanguageCode = "en";

export function getLanguage(code: string | null | undefined): LanguageDef {
  return (
    LANGUAGES.find((l) => l.code === code) ??
    LANGUAGES.find((l) => l.code === DEFAULT_LANGUAGE)!
  );
}

/* ----------------------------------------------------------------- */
/* Translation strings — minimal, just for the auth pages right now. */
/* Keys read like English by design so missing translations fall     */
/* back gracefully.                                                  */
/* ----------------------------------------------------------------- */

type StringKey =
  | "auth.login.title"
  | "auth.login.subtitle"
  | "auth.login.orEmail"
  | "auth.login.emailPlaceholder"
  | "auth.login.passwordPlaceholder"
  | "auth.login.submit"
  | "auth.login.magic"
  | "auth.login.newHere"
  | "auth.login.createAccount"
  | "auth.signup.title"
  | "auth.signup.subtitle"
  | "auth.signup.namePlaceholder"
  | "auth.signup.passwordPlaceholder"
  | "auth.signup.submit"
  | "auth.signup.haveAccount"
  | "auth.signup.login"
  | "auth.signup.created"
  | "auth.shared.language"
  | "auth.shared.close"
  | "auth.shared.signupTab"
  | "auth.shared.loginTab"
  | "landing.kicker"
  | "landing.heroLine1"
  | "landing.heroLine2"
  | "landing.heroBody"
  | "landing.signupCta"
  | "landing.loginCta"
  | "landing.ctaNote"
  | "landing.headerLogin"
  | "landing.headerSignup"
  | "landing.principlesKicker"
  | "landing.principlesHeading"
  | "landing.principle1Title"
  | "landing.principle1Body"
  | "landing.principle2Title"
  | "landing.principle2Body"
  | "landing.principle3Title"
  | "landing.principle3Body"
  | "landing.principle4Title"
  | "landing.principle4Body"
  | "landing.principle5Title"
  | "landing.principle5Body"
  | "landing.footerCredit"
  | "landing.footerSource"
  | "sidebar.addTask"
  | "sidebar.search"
  | "sidebar.today"
  | "sidebar.tomorrow"
  | "sidebar.next7"
  | "sidebar.inbox"
  | "sidebar.calendar"
  | "sidebar.eisenhower"
  | "sidebar.pomodoro"
  | "sidebar.habits"
  | "sidebar.weeklyReview"
  | "sidebar.lists"
  | "sidebar.tags"
  | "sidebar.noLists"
  | "sidebar.noTags"
  | "sidebar.newList"
  | "sidebar.logout"
  | "sidebar.next90"
  | "sidebar.completed"
  | "view.next90.subtitle"
  | "view.completed.subtitle"
  | "sidebar.settings"
  | "email.subject"
  | "email.kicker"
  | "email.dueLabel"
  | "email.openCta"
  | "email.footer"
  | "email.unsubscribe"
  /* common */
  | "common.save"
  | "common.cancel"
  | "common.delete"
  | "common.confirm"
  | "common.loading"
  | "common.add"
  | "common.remove"
  | "common.edit"
  | "common.done"
  | "common.yes"
  | "common.no"
  | "common.back"
  | "common.next"
  | "common.close"
  | "common.apply"
  | "common.applyAll"
  | "common.skip"
  | "common.tryAgain"
  | "common.aiDisabled"
  | "common.budgetReached"
  | "common.unknown"
  /* view */
  | "view.tomorrow.subtitle"
  | "view.next7.subtitle"
  | "view.calendar.subtitle"
  | "view.inbox.subtitle"
  | "view.habits.subtitle"
  | "view.settings.subtitle"
  | "view.tags.subtitle"
  | "view.pomodoro.subtitle"
  | "view.matrix.subtitle"
  | "view.lists.subtitle"
  /* empty */
  | "empty.noTasks"
  | "empty.nothingToShow"
  | "empty.pressQ"
  | "empty.allClear"
  | "empty.noResults"
  | "empty.dropTasksHere"
  /* goal */
  | "goal.title"
  | "goal.intro"
  | "goal.placeholder"
  | "goal.planIt"
  | "goal.planning"
  | "goal.cancel"
  | "goal.back"
  | "goal.cmdEnterHint"
  | "goal.steps"
  | "goal.projectLabel"
  | "goal.create"
  | "goal.creating"
  | "goal.remove"
  | "goal.todayLabel"
  | "goal.errBudget"
  | "goal.errPlan"
  | "goal.errCreate"
  | "goal.successAdded"
  /* reflect */
  | "reflect.title"
  | "reflect.reading"
  | "reflect.carryHeading"
  | "reflect.rollAll"
  | "reflect.rollOne"
  | "reflect.dropHeading"
  | "reflect.clearOne"
  | "reflect.notesHeading"
  | "reflect.notesPlaceholder"
  | "reflect.close"
  | "reflect.toastRolled"
  | "reflect.toastCleared"
  | "reflect.toastSaved"
  | "reflect.errLoad"
  | "reflect.errSaveJournal"
  /* retro */
  | "retro.kicker"
  | "retro.thisWeek"
  | "retro.lastWeek"
  | "retro.nextWeek"
  | "retro.titleThisWeek"
  | "retro.titleLastWeek"
  | "retro.titleNextWeek"
  | "retro.updating"
  | "retro.empty"
  | "retro.weekOf"
  | "retro.onCalendar"
  | "retro.scheduled"
  | "retro.itemsOne"
  | "retro.itemsMany"
  | "retro.shipped"
  | "retro.slipped"
  | "retro.themes"
  | "retro.dropList"
  | "retro.nextWeekPlan"
  | "retro.allDay"
  /* procrastination */
  | "procrastination.title"
  | "procrastination.intro"
  | "procrastination.scan"
  | "procrastination.scanning"
  | "procrastination.allClear"
  | "procrastination.errBudget"
  | "procrastination.errScan"
  | "procrastination.verdictDrop"
  | "procrastination.verdictSchedule"
  | "procrastination.verdictBreak"
  | "procrastination.apply"
  | "procrastination.skip"
  /* planDay */
  | "planDay.button"
  | "planDay.planning"
  | "planDay.title"
  | "planDay.reading"
  | "planDay.empty"
  | "planDay.allSet"
  | "planDay.applyAll"
  | "planDay.close"
  | "planDay.errBudget"
  | "planDay.errPlan"
  | "planDay.toastApplied"
  /* todayAi */
  | "todayAi.over"
  | "todayAi.planned"
  | "todayAi.clearOverdue"
  | "todayAi.rescheduling"
  | "todayAi.modalTitle"
  | "todayAi.reading"
  | "todayAi.empty"
  | "todayAi.cleared"
  | "todayAi.applyAll"
  | "todayAi.close"
  | "todayAi.errBudget"
  | "todayAi.errReschedule"
  | "todayAi.toastNothingOverdue"
  /* commandPalette */
  | "commandPalette.placeholder"
  | "commandPalette.askAi"
  | "commandPalette.askAiHint"
  | "commandPalette.aiMatches"
  | "commandPalette.tasks"
  | "commandPalette.lists"
  | "commandPalette.tags"
  | "commandPalette.done"
  | "commandPalette.noResults"
  | "commandPalette.errBudget"
  | "commandPalette.errSearch"
  /* quickAdd */
  | "quickAdd.kicker"
  | "quickAdd.placeholder"
  | "quickAdd.scanTitle"
  | "quickAdd.scanAria"
  | "quickAdd.chipTime"
  | "quickAdd.chipRepeat"
  | "quickAdd.chipReminder"
  | "quickAdd.chipPriority"
  | "quickAdd.chipInbox"
  | "quickAdd.chipTag"
  | "quickAdd.priorityHigh"
  | "quickAdd.priorityMedium"
  | "quickAdd.priorityLow"
  | "quickAdd.priorityNone"
  | "quickAdd.repeatDaily"
  | "quickAdd.repeatWeekdays"
  | "quickAdd.repeatWeekly"
  | "quickAdd.repeatMonthly"
  | "quickAdd.repeatYearly"
  | "quickAdd.repeatRepeats"
  | "quickAdd.timeToday"
  | "quickAdd.timeTomorrow"
  | "quickAdd.miniSiftCaption"
  | "quickAdd.q1"
  | "quickAdd.q2"
  | "quickAdd.q3"
  | "quickAdd.q4"
  | "quickAdd.tagsHelpPrefix"
  | "quickAdd.tagsHelpSuffix"
  | "quickAdd.cancel"
  | "quickAdd.enterToAdd"
  /* taskPanel */
  | "taskPanel.markComplete"
  | "taskPanel.markIncomplete"
  | "taskPanel.delete"
  | "taskPanel.close"
  | "taskPanel.done"
  | "taskPanel.titlePlaceholder"
  | "taskPanel.starts"
  | "taskPanel.ends"
  | "taskPanel.due"
  | "taskPanel.startPlaceholder"
  | "taskPanel.duePlaceholder"
  | "taskPanel.repeat"
  | "taskPanel.recurNone"
  | "taskPanel.recurDaily"
  | "taskPanel.recurEveryOtherDay"
  | "taskPanel.recurWeekdays"
  | "taskPanel.recurWeekends"
  | "taskPanel.recurWeekly"
  | "taskPanel.recurEveryOtherWeek"
  | "taskPanel.recurMonthly"
  | "taskPanel.recurEveryThreeMonths"
  | "taskPanel.recurYearly"
  | "taskPanel.recurCustom"
  | "taskPanel.recurNeedsDue"
  | "taskPanel.reminder"
  | "taskPanel.reminderHelp"
  | "taskPanel.priority"
  | "taskPanel.list"
  | "taskPanel.inboxNoList"
  | "taskPanel.shareGroup"
  | "taskPanel.privateOnly"
  | "taskPanel.manageGroups"
  | "taskPanel.assignedTo"
  | "taskPanel.unassigned"
  | "taskPanel.tags"
  | "taskPanel.subtasks"
  | "taskPanel.attachments"
  | "taskPanel.aiShortcuts"
  | "taskPanel.notes"
  | "taskPanel.notesPlaceholder"
  | "taskPanel.created"
  | "taskPanel.updated"
  /* scan */
  | "scan.kicker"
  | "scan.title"
  | "scan.takePhoto"
  | "scan.takePhotoHint"
  | "scan.uploadImage"
  | "scan.uploadImageHint"
  | "scan.reading"
  | "scan.foundOne"
  | "scan.foundMany"
  | "scan.unreadable"
  | "scan.removeImage"
  | "scan.cancel"
  | "scan.adding"
  | "scan.addOne"
  | "scan.addMany"
  | "scan.errNotImage"
  | "scan.errTooLarge"
  | "scan.errAiOff"
  | "scan.errNoTasks"
  | "scan.errFailed"
  | "scan.toastAddedOne"
  | "scan.toastAddedMany"
  /* members */
  | "members.shareTitle"
  | "members.shareIntro"
  | "members.invitePlaceholder"
  | "members.invite"
  | "members.invited"
  | "members.heading"
  | "members.empty"
  | "members.remove"
  | "members.ownerOnly"
  | "members.toastAdded"
  | "members.roleOwner"
  | "members.roleMember"
  /* createProject */
  | "createProject.title"
  | "createProject.intro"
  | "createProject.namePlaceholder"
  | "createProject.colorLabel"
  | "createProject.cancel"
  | "createProject.create"
  | "createProject.creating"
  | "createProject.toastCreated"
  | "createProject.errCreate"
  /* dailyEdition */
  | "dailyEdition.errLoad"
  | "dailyEdition.tryAgain"
  | "dailyEdition.regenerate"
  | "dailyEdition.regenAria"
  | "dailyEdition.readMore"
  /* kanban */
  | "kanban.priorityHigh"
  | "kanban.priorityMedium"
  | "kanban.priorityLow"
  | "kanban.priorityNone"
  | "kanban.dropHere"
  | "kanban.quickAdd"
  /* shared */
  | "shared.quickAdd"
  | "shared.untitled";

const STRINGS: Record<LanguageCode, Record<StringKey, string>> = {
  en: {
    "auth.login.title": "Welcome back",
    "auth.login.subtitle": "Log in to your tasks.",
    "auth.login.orEmail": "or with email",
    "auth.login.emailPlaceholder": "you@example.com",
    "auth.login.passwordPlaceholder": "Password",
    "auth.login.submit": "Log in",
    "auth.login.magic": "Email me a magic link instead",
    "auth.login.newHere": "New here?",
    "auth.login.createAccount": "Create an account",
    "auth.signup.title": "Create your account",
    "auth.signup.subtitle": "It's free. No credit card.",
    "auth.signup.namePlaceholder": "Your name",
    "auth.signup.passwordPlaceholder": "Password (min 6 chars)",
    "auth.signup.submit": "Sign up",
    "auth.signup.haveAccount": "Already have an account?",
    "auth.signup.login": "Log in",
    "auth.signup.created": "Account created. Check your inbox to verify.",
    "auth.shared.language": "Language",
    "auth.shared.close": "Close",
    "auth.shared.signupTab": "Sign up",
    "auth.shared.loginTab": "Log in",
    "landing.kicker": "First Light · A calm operating system for getting things done",
    "landing.heroLine1": "Plan with intent,",
    "landing.heroLine2": "light with purpose.",
    "landing.heroBody": "Tasks, calendar, habits, and Pomodoro — synced across every device. A daily editorial briefing that keeps your day on the page, not on fire.",
    "landing.signupCta": "Get started — free",
    "landing.loginCta": "Log in",
    "landing.ctaNote": "No credit card. No tracking. Real-time sync.",
    "landing.headerLogin": "Log in",
    "landing.headerSignup": "Get started",
    "landing.principlesKicker": "Brand principles",
    "landing.principlesHeading": "Five intentions, every day.",
    "landing.principle1Title": "Clarity",
    "landing.principle1Body": "Clear thinking, clear direction.",
    "landing.principle2Title": "Focus",
    "landing.principle2Body": "One thing at a time.",
    "landing.principle3Title": "Progress",
    "landing.principle3Body": "Small steps create big change.",
    "landing.principle4Title": "Calm",
    "landing.principle4Body": "Peaceful mind, productive life.",
    "landing.principle5Title": "Light",
    "landing.principle5Body": "Inspiration to move forward.",
    "landing.footerCredit": "© First Light · Built with Next.js, Supabase & Tailwind.",
    "landing.footerSource": "Source on GitHub →",
    "sidebar.addTask": "Add task",
    "sidebar.search": "Search…",
    "sidebar.today": "Today",
    "sidebar.tomorrow": "Tomorrow",
    "sidebar.next7": "Next 7 Days",
    "sidebar.inbox": "Inbox",
    "sidebar.calendar": "Calendar",
    "sidebar.eisenhower": "The Sift",
    "sidebar.pomodoro": "Focus",
    "sidebar.habits": "Habits",
    "sidebar.weeklyReview": "Weekly review",
    "sidebar.lists": "Lists",
    "sidebar.tags": "Tags",
    "sidebar.noLists": "No lists yet.",
    "sidebar.noTags": "No tags yet — type #tagname in a task title.",
    "sidebar.newList": "New list",
    "sidebar.logout": "Log out",
    "sidebar.next90": "Next 90 Days",
    "sidebar.completed": "Completed",
    "view.next90.subtitle": "Tasks due in the next 90 days.",
    "view.completed.subtitle": "Everything you have finished, most recent first.",
    "email.subject": "Reminder · {title}",
    "email.kicker": "FIRST LIGHT · REMINDER",
    "email.dueLabel": "Due",
    "email.openCta": "Open in First Light →",
    "email.footer": "You're receiving this because you set a reminder. Manage email reminders in Settings.",
    "email.unsubscribe": "Unsubscribe from reminder emails",
    "sidebar.settings": "Settings",
  
    /* common */
    "common.save": "Save",
    "common.cancel": "Cancel",
    "common.delete": "Delete",
    "common.confirm": "Confirm",
    "common.loading": "Loading…",
    "common.add": "Add",
    "common.remove": "Remove",
    "common.edit": "Edit",
    "common.done": "Done",
    "common.yes": "Yes",
    "common.no": "No",
    "common.back": "Back",
    "common.next": "Next",
    "common.close": "Close",
    "common.apply": "Apply",
    "common.applyAll": "Apply all",
    "common.skip": "Skip",
    "common.tryAgain": "Try again",
    "common.aiDisabled": "AI is currently disabled.",
    "common.budgetReached": "Daily AI budget reached.",
    "common.unknown": "(unknown)",
    /* view */
    "view.tomorrow.subtitle": "What's next on the page.",
    "view.next7.subtitle": "Tasks due within the next week.",
    "view.calendar.subtitle": "Drag tasks across days.",
    "view.inbox.subtitle": "Tasks not assigned to a list.",
    "view.habits.subtitle": "A small thing, every day.",
    "view.settings.subtitle": "Account, preferences, data.",
    "view.tags.subtitle": "All tasks with this tag.",
    "view.pomodoro.subtitle": "One block. One thing.",
    "view.matrix.subtitle": "Sort by urgent vs. important.",
    "view.lists.subtitle": "Tasks in this list.",
    /* empty */
    "empty.noTasks": "No tasks yet.",
    "empty.nothingToShow": "Nothing to show.",
    "empty.pressQ": "Press q to add your first task.",
    "empty.allClear": "All clear.",
    "empty.noResults": "No results.",
    "empty.dropTasksHere": "Drop tasks here.",
    /* goal */
    "goal.title": "A goal",
    "goal.intro": "Write the outcome you want. AI breaks it into a project + tasks you can ship in order.",
    "goal.placeholder": "e.g. Ship the Q4 launch by Nov 30 with full email + social coverage",
    "goal.planIt": "Plan it",
    "goal.planning": "Planning…",
    "goal.cancel": "Cancel",
    "goal.back": "Back",
    "goal.cmdEnterHint": "to plan",
    "goal.steps": "steps",
    "goal.projectLabel": "Project",
    "goal.create": "Create",
    "goal.creating": "Creating…",
    "goal.remove": "Remove",
    "goal.todayLabel": "today",
    "goal.errBudget": "Daily goal-decompose budget reached.",
    "goal.errPlan": "Couldn't plan that goal — try again.",
    "goal.errCreate": "Couldn't create the plan",
    "goal.successAdded": "Goal planned: {n} added",
    /* reflect */
    "reflect.title": "Today, in retrospect",
    "reflect.reading": "Reading the day…",
    "reflect.carryHeading": "Carry to tomorrow",
    "reflect.rollAll": "Roll all →",
    "reflect.rollOne": "Roll to tomorrow",
    "reflect.dropHeading": "Worth dropping",
    "reflect.clearOne": "Clear",
    "reflect.notesHeading": "Notes to yourself",
    "reflect.notesPlaceholder": "One sentence about today, if you'd like.",
    "reflect.close": "Close",
    "reflect.toastRolled": "Rolled to tomorrow",
    "reflect.toastCleared": "Cleared from today",
    "reflect.toastSaved": "Saved",
    "reflect.errLoad": "Couldn't load reflection",
    "reflect.errSaveJournal": "Couldn't save journal",
    /* retro */
    "retro.kicker": "Weekly review",
    "retro.thisWeek": "This week",
    "retro.lastWeek": "Last week",
    "retro.nextWeek": "Next week",
    "retro.titleThisWeek": "This week, so far",
    "retro.titleLastWeek": "Last week's edition",
    "retro.titleNextWeek": "Next week, planned",
    "retro.updating": "Updating…",
    "retro.empty": "AI features aren't enabled on this server, or no data yet for this week.",
    "retro.weekOf": "Week of",
    "retro.onCalendar": "On the calendar",
    "retro.scheduled": "Scheduled",
    "retro.itemsOne": "item",
    "retro.itemsMany": "items",
    "retro.shipped": "Shipped",
    "retro.slipped": "Slipped",
    "retro.themes": "Themes",
    "retro.dropList": "Worth dropping",
    "retro.nextWeekPlan": "For next week",
    "retro.allDay": "All day",
    /* procrastination */
    "procrastination.title": "Stuck items",
    "procrastination.intro": "What's been sitting in the list with no movement.",
    "procrastination.scan": "Scan backlog",
    "procrastination.scanning": "Scanning…",
    "procrastination.allClear": "All clear.",
    "procrastination.errBudget": "Weekly procrastination budget reached.",
    "procrastination.errScan": "Couldn't scan your backlog.",
    "procrastination.verdictDrop": "drop",
    "procrastination.verdictSchedule": "schedule",
    "procrastination.verdictBreak": "break-down",
    "procrastination.apply": "Apply",
    "procrastination.skip": "Skip",
    /* planDay */
    "planDay.button": "Plan my day",
    "planDay.planning": "Planning…",
    "planDay.title": "Today",
    "planDay.reading": "Reading the day…",
    "planDay.empty": "Nothing on the plate today.",
    "planDay.allSet": "Nothing left — your day is set.",
    "planDay.applyAll": "Apply all",
    "planDay.close": "Close",
    "planDay.errBudget": "Daily plan-day budget reached. Try again tomorrow.",
    "planDay.errPlan": "Couldn't plan your day — try again.",
    "planDay.toastApplied": "Applied {n}.",
    /* todayAi */
    "todayAi.over": "over",
    "todayAi.planned": "planned",
    "todayAi.clearOverdue": "Clear {n} overdue",
    "todayAi.rescheduling": "Rescheduling…",
    "todayAi.modalTitle": "Reschedule",
    "todayAi.reading": "Reading the backlog…",
    "todayAi.empty": "Backlog cleared.",
    "todayAi.cleared": "Backlog cleared.",
    "todayAi.applyAll": "Apply all",
    "todayAi.close": "Close",
    "todayAi.errBudget": "Daily reschedule budget reached.",
    "todayAi.errReschedule": "Couldn't reschedule — try again.",
    "todayAi.toastNothingOverdue": "Nothing overdue — nice.",
    /* commandPalette */
    "commandPalette.placeholder": "Search tasks, lists, tags… or ask AI",
    "commandPalette.askAi": "Ask AI",
    "commandPalette.askAiHint": "Re-rank with AI (Cmd/Ctrl+Enter)",
    "commandPalette.aiMatches": "AI matches",
    "commandPalette.tasks": "Tasks",
    "commandPalette.lists": "Lists",
    "commandPalette.tags": "Tags",
    "commandPalette.done": "done",
    "commandPalette.noResults": "No results.",
    "commandPalette.errBudget": "Search budget reached.",
    "commandPalette.errSearch": "Couldn't run AI search.",
    /* quickAdd */
    "quickAdd.kicker": "Quick add",
    "quickAdd.placeholder": "Add a task — type or speak",
    "quickAdd.scanTitle": "Scan tasks from a photo or screenshot",
    "quickAdd.scanAria": "Scan tasks from an image",
    "quickAdd.chipTime": "Time",
    "quickAdd.chipRepeat": "Repeat",
    "quickAdd.chipReminder": "Reminder",
    "quickAdd.chipPriority": "Priority",
    "quickAdd.chipInbox": "Inbox",
    "quickAdd.chipTag": "Tag",
    "quickAdd.priorityHigh": "High",
    "quickAdd.priorityMedium": "Medium",
    "quickAdd.priorityLow": "Low",
    "quickAdd.priorityNone": "None",
    "quickAdd.repeatDaily": "Daily",
    "quickAdd.repeatWeekdays": "Weekdays",
    "quickAdd.repeatWeekly": "Weekly",
    "quickAdd.repeatMonthly": "Monthly",
    "quickAdd.repeatYearly": "Yearly",
    "quickAdd.repeatRepeats": "Repeats",
    "quickAdd.timeToday": "Today",
    "quickAdd.timeTomorrow": "Tomorrow",
    "quickAdd.miniSiftCaption": "The Sift · click to apply",
    "quickAdd.q1": "Do first",
    "quickAdd.q2": "Schedule",
    "quickAdd.q3": "Delegate",
    "quickAdd.q4": "Eliminate",
    "quickAdd.tagsHelpPrefix": "Type",
    "quickAdd.tagsHelpSuffix": "in the input above — insert “#” at cursor",
    "quickAdd.cancel": "cancel",
    "quickAdd.enterToAdd": "Enter to add · Esc to close",
    /* taskPanel */
    "taskPanel.markComplete": "Mark complete",
    "taskPanel.markIncomplete": "Mark incomplete",
    "taskPanel.delete": "Delete",
    "taskPanel.close": "Close",
    "taskPanel.done": "Done",
    "taskPanel.titlePlaceholder": "Task title",
    "taskPanel.starts": "Starts",
    "taskPanel.ends": "Ends",
    "taskPanel.due": "Due",
    "taskPanel.startPlaceholder": "Pick a start time",
    "taskPanel.duePlaceholder": "Pick a due time",
    "taskPanel.repeat": "Repeat",
    "taskPanel.recurNone": "Doesn't repeat",
    "taskPanel.recurDaily": "Daily",
    "taskPanel.recurEveryOtherDay": "Every other day",
    "taskPanel.recurWeekdays": "Weekdays (Mon–Fri)",
    "taskPanel.recurWeekends": "Weekends",
    "taskPanel.recurWeekly": "Weekly",
    "taskPanel.recurEveryOtherWeek": "Every other week",
    "taskPanel.recurMonthly": "Monthly",
    "taskPanel.recurEveryThreeMonths": "Every 3 months",
    "taskPanel.recurYearly": "Yearly",
    "taskPanel.recurCustom": "Custom",
    "taskPanel.recurNeedsDue": "Set a due date — recurrence creates the next occurrence when you complete the task.",
    "taskPanel.reminder": "Reminder",
    "taskPanel.reminderHelp": "Browser notification fires at this time while the app is open. Allow notifications when prompted.",
    "taskPanel.priority": "Priority",
    "taskPanel.list": "List",
    "taskPanel.inboxNoList": "Inbox (no list)",
    "taskPanel.shareGroup": "Share with group",
    "taskPanel.privateOnly": "Private — just me",
    "taskPanel.manageGroups": "Manage groups →",
    "taskPanel.assignedTo": "Assigned to",
    "taskPanel.unassigned": "Unassigned",
    "taskPanel.tags": "Tags",
    "taskPanel.subtasks": "Subtasks",
    "taskPanel.attachments": "Attachments",
    "taskPanel.aiShortcuts": "AI shortcuts",
    "taskPanel.notes": "Notes",
    "taskPanel.notesPlaceholder": "Add notes…",
    "taskPanel.created": "Created",
    "taskPanel.updated": "Updated",
    /* scan */
    "scan.kicker": "Scan tasks",
    "scan.title": "Read a photo, lift the to-dos.",
    "scan.takePhoto": "Take a photo",
    "scan.takePhotoHint": "Sticky note, whiteboard, calendar page",
    "scan.uploadImage": "Upload image",
    "scan.uploadImageHint": "Screenshot, photo from your library",
    "scan.reading": "Reading the image…",
    "scan.foundOne": "Found {n} task. Edit, uncheck, or hit Add when ready.",
    "scan.foundMany": "Found {n} tasks. Edit, uncheck, or hit Add when ready.",
    "scan.unreadable": "Nothing legible. Try a sharper photo, or upload a clearer image.",
    "scan.removeImage": "Remove image",
    "scan.cancel": "Cancel",
    "scan.adding": "Adding…",
    "scan.addOne": "Add {n} task",
    "scan.addMany": "Add {n} tasks",
    "scan.errNotImage": "That's not an image",
    "scan.errTooLarge": "Image too large — keep it under 6MB",
    "scan.errAiOff": "AI is off — set ANTHROPIC_API_KEY to enable",
    "scan.errNoTasks": "Couldn't see any tasks in that one",
    "scan.errFailed": "Scan failed",
    "scan.toastAddedOne": "Added 1 task",
    "scan.toastAddedMany": "Added {n} tasks",
    /* members */
    "members.shareTitle": "Share \"{name}\"",
    "members.shareIntro": "Invite by email. They'll see the list and its tasks in real time.",
    "members.invitePlaceholder": "someone@example.com",
    "members.invite": "Invite",
    "members.invited": "…",
    "members.heading": "Members",
    "members.empty": "No members yet.",
    "members.remove": "Remove",
    "members.ownerOnly": "Only the list owner can invite or remove members.",
    "members.toastAdded": "Added",
    "members.roleOwner": "owner",
    "members.roleMember": "member",
    /* createProject */
    "createProject.title": "New list",
    "createProject.intro": "A space for tasks of a kind.",
    "createProject.namePlaceholder": "e.g. Work, Reading, Studio",
    "createProject.colorLabel": "Color",
    "createProject.cancel": "Cancel",
    "createProject.create": "Create",
    "createProject.creating": "Creating…",
    "createProject.toastCreated": "\"{name}\" created",
    "createProject.errCreate": "Couldn't create list",
    /* dailyEdition */
    "dailyEdition.errLoad": "Daily Edition couldn't load.",
    "dailyEdition.tryAgain": "Try again",
    "dailyEdition.regenerate": "Regenerate edition",
    "dailyEdition.regenAria": "Regenerate today's edition",
    "dailyEdition.readMore": "Read more",
    /* kanban */
    "kanban.priorityHigh": "High",
    "kanban.priorityMedium": "Medium",
    "kanban.priorityLow": "Low",
    "kanban.priorityNone": "None",
    "kanban.dropHere": "Drop tasks here.",
    "kanban.quickAdd": "Quick add",
    /* shared */
    "shared.quickAdd": "Quick add",
    "shared.untitled": "(untitled)",
  },
  "zh-TW": {
    "auth.login.title": "歡迎回來",
    "auth.login.subtitle": "登入查看你的任務。",
    "auth.login.orEmail": "或使用電子郵件",
    "auth.login.emailPlaceholder": "you@example.com",
    "auth.login.passwordPlaceholder": "密碼",
    "auth.login.submit": "登入",
    "auth.login.magic": "用魔法連結登入",
    "auth.login.newHere": "新使用者？",
    "auth.login.createAccount": "建立帳號",
    "auth.signup.title": "建立你的帳號",
    "auth.signup.subtitle": "免費,不需信用卡。",
    "auth.signup.namePlaceholder": "你的名字",
    "auth.signup.passwordPlaceholder": "密碼(至少 6 位)",
    "auth.signup.submit": "註冊",
    "auth.signup.haveAccount": "已有帳號?",
    "auth.signup.login": "登入",
    "auth.signup.created": "帳號已建立,請查收驗證郵件。",
    "auth.shared.language": "語言",
    "auth.shared.close": "關閉",
    "auth.shared.signupTab": "註冊",
    "auth.shared.loginTab": "登入",
    "landing.kicker": "First Light · 一個沉靜的工作作業系統",
    "landing.heroLine1": "用心規劃,",
    "landing.heroLine2": "為目的而發光",
    "landing.heroBody": "任務、日曆、習慣與番茄鐘 — 跨裝置即時同步。每日的編輯式簡報,讓你掌握節奏,而非陷入焦灼。",
    "landing.signupCta": "免費開始",
    "landing.loginCta": "登入",
    "landing.ctaNote": "無需信用卡 · 不追蹤 · 即時同步",
    "landing.headerLogin": "登入",
    "landing.headerSignup": "開始使用",
    "landing.principlesKicker": "品牌理念",
    "landing.principlesHeading": "五個每日意圖。",
    "landing.principle1Title": "清晰",
    "landing.principle1Body": "清晰的思考,清晰的方向。",
    "landing.principle2Title": "專注",
    "landing.principle2Body": "一次只做一件事。",
    "landing.principle3Title": "前進",
    "landing.principle3Body": "微小步伐,創造改變。",
    "landing.principle4Title": "從容",
    "landing.principle4Body": "心思平靜,效率自然。",
    "landing.principle5Title": "光",
    "landing.principle5Body": "前行的靈感與動力。",
    "landing.footerCredit": "© First Light · 由 Next.js、Supabase 與 Tailwind 打造",
    "landing.footerSource": "GitHub 原始碼 →",
    "sidebar.addTask": "新增任務",
    "sidebar.search": "搜尋…",
    "sidebar.today": "今天",
    "sidebar.tomorrow": "明天",
    "sidebar.next7": "未來七日",
    "sidebar.inbox": "收件匣",
    "sidebar.calendar": "行事曆",
    "sidebar.eisenhower": "取捨",
    "sidebar.pomodoro": "專注",
    "sidebar.habits": "習慣",
    "sidebar.weeklyReview": "每週回顧",
    "sidebar.lists": "清單",
    "sidebar.tags": "標籤",
    "sidebar.noLists": "尚未建立清單。",
    "sidebar.noTags": "尚未有標籤 — 在任務標題中輸入 #tagname。",
    "sidebar.newList": "新清單",
    "sidebar.logout": "登出",
    "sidebar.next90": "未來 90 日",
    "sidebar.completed": "已完成",
    "view.next90.subtitle": "未來 90 天內到期的任務。",
    "view.completed.subtitle": "你已完成的事,最新優先。",
    "email.subject": "提醒 · {title}",
    "email.kicker": "FIRST LIGHT · 提醒",
    "email.dueLabel": "到期",
    "email.openCta": "在 First Light 開啟 →",
    "email.footer": "你收到這封信是因為你設定了提醒。可在設定中管理 email 提醒。",
    "email.unsubscribe": "取消訂閱提醒郵件",
    "sidebar.settings": "設定",
  
    /* common */
    "common.save": "儲存",
    "common.cancel": "取消",
    "common.delete": "刪除",
    "common.confirm": "確認",
    "common.loading": "載入中…",
    "common.add": "新增",
    "common.remove": "移除",
    "common.edit": "編輯",
    "common.done": "完成",
    "common.yes": "是",
    "common.no": "否",
    "common.back": "返回",
    "common.next": "下一步",
    "common.close": "關閉",
    "common.apply": "套用",
    "common.applyAll": "全部套用",
    "common.skip": "略過",
    "common.tryAgain": "重試",
    "common.aiDisabled": "目前未啟用 AI 功能。",
    "common.budgetReached": "本日 AI 額度已用完。",
    "common.unknown": "(未知)",
    /* view */
    "view.tomorrow.subtitle": "明天的版面。",
    "view.next7.subtitle": "未來一週內到期的任務。",
    "view.calendar.subtitle": "把任務拖到不同日期。",
    "view.inbox.subtitle": "尚未分到任何清單的任務。",
    "view.habits.subtitle": "每天一件小事。",
    "view.settings.subtitle": "帳號、偏好、資料。",
    "view.tags.subtitle": "帶有這個標籤的任務。",
    "view.pomodoro.subtitle": "一個番茄,一件事。",
    "view.matrix.subtitle": "按緊急與重要分類。",
    "view.lists.subtitle": "這個清單中的任務。",
    /* empty */
    "empty.noTasks": "還沒有任務。",
    "empty.nothingToShow": "沒有可顯示的內容。",
    "empty.pressQ": "按 q 新增第一個任務。",
    "empty.allClear": "全部處理完了。",
    "empty.noResults": "沒有結果。",
    "empty.dropTasksHere": "把任務放到這裡。",
    /* goal */
    "goal.title": "一個目標",
    "goal.intro": "寫下你想達成的結果。AI 會把它拆成一個專案與一連串可依序完成的任務。",
    "goal.placeholder": "例:11/30 前完成 Q4 上線,涵蓋 email 與社群推廣",
    "goal.planIt": "開始規劃",
    "goal.planning": "規劃中…",
    "goal.cancel": "取消",
    "goal.back": "返回",
    "goal.cmdEnterHint": "規劃",
    "goal.steps": "個步驟",
    "goal.projectLabel": "專案",
    "goal.create": "建立",
    "goal.creating": "建立中…",
    "goal.remove": "移除",
    "goal.todayLabel": "今天",
    "goal.errBudget": "今日的目標拆解額度已用完。",
    "goal.errPlan": "無法規劃這個目標,請再試一次。",
    "goal.errCreate": "無法建立計畫",
    "goal.successAdded": "目標已就緒:新增 {n} 項",
    /* reflect */
    "reflect.title": "今天,回望",
    "reflect.reading": "閱讀今天…",
    "reflect.carryHeading": "帶到明天",
    "reflect.rollAll": "全部延後 →",
    "reflect.rollOne": "延到明天",
    "reflect.dropHeading": "可以放下",
    "reflect.clearOne": "清除",
    "reflect.notesHeading": "寫給自己的筆記",
    "reflect.notesPlaceholder": "如果想寫,留下今天的一句話。",
    "reflect.close": "關閉",
    "reflect.toastRolled": "已延到明天",
    "reflect.toastCleared": "已從今天移除",
    "reflect.toastSaved": "已儲存",
    "reflect.errLoad": "無法載入回顧",
    "reflect.errSaveJournal": "無法儲存筆記",
    /* retro */
    "retro.kicker": "每週回顧",
    "retro.thisWeek": "本週",
    "retro.lastWeek": "上週",
    "retro.nextWeek": "下週",
    "retro.titleThisWeek": "本週,目前為止",
    "retro.titleLastWeek": "上週的版本",
    "retro.titleNextWeek": "下週,計畫中",
    "retro.updating": "更新中…",
    "retro.empty": "此伺服器尚未啟用 AI 功能,或本週還沒有資料。",
    "retro.weekOf": "本週",
    "retro.onCalendar": "行事曆上",
    "retro.scheduled": "已安排",
    "retro.itemsOne": "項",
    "retro.itemsMany": "項",
    "retro.shipped": "已交付",
    "retro.slipped": "未完成",
    "retro.themes": "主題",
    "retro.dropList": "可以放下",
    "retro.nextWeekPlan": "為下週",
    "retro.allDay": "整日",
    /* procrastination */
    "procrastination.title": "卡住的項目",
    "procrastination.intro": "在清單裡沒動靜的項目。",
    "procrastination.scan": "掃描待辦",
    "procrastination.scanning": "掃描中…",
    "procrastination.allClear": "全部處理完了。",
    "procrastination.errBudget": "本週掃描額度已用完。",
    "procrastination.errScan": "無法掃描你的待辦。",
    "procrastination.verdictDrop": "放下",
    "procrastination.verdictSchedule": "排程",
    "procrastination.verdictBreak": "拆解",
    "procrastination.apply": "套用",
    "procrastination.skip": "略過",
    /* planDay */
    "planDay.button": "規劃今天",
    "planDay.planning": "規劃中…",
    "planDay.title": "今天",
    "planDay.reading": "閱讀今天…",
    "planDay.empty": "今天沒什麼要忙的。",
    "planDay.allSet": "都安排好了 — 今天就這樣。",
    "planDay.applyAll": "全部套用",
    "planDay.close": "關閉",
    "planDay.errBudget": "今天的規劃額度已用完,明天再試。",
    "planDay.errPlan": "無法規劃你的今天,請再試一次。",
    "planDay.toastApplied": "已套用 {n} 項。",
    /* todayAi */
    "todayAi.over": "超出",
    "todayAi.planned": "已安排",
    "todayAi.clearOverdue": "清掉 {n} 件逾期",
    "todayAi.rescheduling": "重新排程中…",
    "todayAi.modalTitle": "重新排程",
    "todayAi.reading": "閱讀待辦中…",
    "todayAi.empty": "待辦清空了。",
    "todayAi.cleared": "待辦清空了。",
    "todayAi.applyAll": "全部套用",
    "todayAi.close": "關閉",
    "todayAi.errBudget": "今天的重新排程額度已用完。",
    "todayAi.errReschedule": "無法重新排程,請再試一次。",
    "todayAi.toastNothingOverdue": "沒有逾期 — 不錯。",
    /* commandPalette */
    "commandPalette.placeholder": "搜尋任務、清單、標籤…或問 AI",
    "commandPalette.askAi": "問 AI",
    "commandPalette.askAiHint": "用 AI 重新排序(Cmd/Ctrl+Enter)",
    "commandPalette.aiMatches": "AI 結果",
    "commandPalette.tasks": "任務",
    "commandPalette.lists": "清單",
    "commandPalette.tags": "標籤",
    "commandPalette.done": "已完成",
    "commandPalette.noResults": "沒有結果。",
    "commandPalette.errBudget": "搜尋額度已用完。",
    "commandPalette.errSearch": "無法執行 AI 搜尋。",
    /* quickAdd */
    "quickAdd.kicker": "快速新增",
    "quickAdd.placeholder": "新增任務 — 用打字或語音",
    "quickAdd.scanTitle": "從照片或截圖掃描任務",
    "quickAdd.scanAria": "從圖片掃描任務",
    "quickAdd.chipTime": "時間",
    "quickAdd.chipRepeat": "重複",
    "quickAdd.chipReminder": "提醒",
    "quickAdd.chipPriority": "優先度",
    "quickAdd.chipInbox": "收件匣",
    "quickAdd.chipTag": "標籤",
    "quickAdd.priorityHigh": "高",
    "quickAdd.priorityMedium": "中",
    "quickAdd.priorityLow": "低",
    "quickAdd.priorityNone": "無",
    "quickAdd.repeatDaily": "每日",
    "quickAdd.repeatWeekdays": "平日",
    "quickAdd.repeatWeekly": "每週",
    "quickAdd.repeatMonthly": "每月",
    "quickAdd.repeatYearly": "每年",
    "quickAdd.repeatRepeats": "重複中",
    "quickAdd.timeToday": "今天",
    "quickAdd.timeTomorrow": "明天",
    "quickAdd.miniSiftCaption": "取捨 · 點擊套用",
    "quickAdd.q1": "先做",
    "quickAdd.q2": "安排",
    "quickAdd.q3": "委派",
    "quickAdd.q4": "捨棄",
    "quickAdd.tagsHelpPrefix": "輸入",
    "quickAdd.tagsHelpSuffix": "於上方輸入 — 在游標處插入「#」",
    "quickAdd.cancel": "取消",
    "quickAdd.enterToAdd": "Enter 新增 · Esc 關閉",
    /* taskPanel */
    "taskPanel.markComplete": "標記為完成",
    "taskPanel.markIncomplete": "標記為未完成",
    "taskPanel.delete": "刪除",
    "taskPanel.close": "關閉",
    "taskPanel.done": "完成",
    "taskPanel.titlePlaceholder": "任務標題",
    "taskPanel.starts": "開始",
    "taskPanel.ends": "結束",
    "taskPanel.due": "到期",
    "taskPanel.startPlaceholder": "選擇開始時間",
    "taskPanel.duePlaceholder": "選擇到期時間",
    "taskPanel.repeat": "重複",
    "taskPanel.recurNone": "不重複",
    "taskPanel.recurDaily": "每日",
    "taskPanel.recurEveryOtherDay": "每兩天",
    "taskPanel.recurWeekdays": "平日(週一至週五)",
    "taskPanel.recurWeekends": "週末",
    "taskPanel.recurWeekly": "每週",
    "taskPanel.recurEveryOtherWeek": "每兩週",
    "taskPanel.recurMonthly": "每月",
    "taskPanel.recurEveryThreeMonths": "每三個月",
    "taskPanel.recurYearly": "每年",
    "taskPanel.recurCustom": "自訂",
    "taskPanel.recurNeedsDue": "請設定到期日 — 完成任務後會自動建立下一次。",
    "taskPanel.reminder": "提醒",
    "taskPanel.reminderHelp": "App 開啟時瀏覽器會在此時間通知你。請在提示時允許通知。",
    "taskPanel.priority": "優先度",
    "taskPanel.list": "清單",
    "taskPanel.inboxNoList": "收件匣(無清單)",
    "taskPanel.shareGroup": "與群組分享",
    "taskPanel.privateOnly": "私人 — 只給我",
    "taskPanel.manageGroups": "管理群組 →",
    "taskPanel.assignedTo": "指派給",
    "taskPanel.unassigned": "未指派",
    "taskPanel.tags": "標籤",
    "taskPanel.subtasks": "子任務",
    "taskPanel.attachments": "附件",
    "taskPanel.aiShortcuts": "AI 捷徑",
    "taskPanel.notes": "筆記",
    "taskPanel.notesPlaceholder": "新增筆記…",
    "taskPanel.created": "建立",
    "taskPanel.updated": "更新",
    /* scan */
    "scan.kicker": "掃描任務",
    "scan.title": "讀一張照片,把任務帶出來。",
    "scan.takePhoto": "拍張照片",
    "scan.takePhotoHint": "便利貼、白板、行事曆頁",
    "scan.uploadImage": "上傳圖片",
    "scan.uploadImageHint": "截圖、相簿中的照片",
    "scan.reading": "讀取圖片中…",
    "scan.foundOne": "找到 {n} 項任務。可編輯、取消勾選,或按新增。",
    "scan.foundMany": "找到 {n} 項任務。可編輯、取消勾選,或按新增。",
    "scan.unreadable": "看不清楚,試試更清晰的照片或圖片。",
    "scan.removeImage": "移除圖片",
    "scan.cancel": "取消",
    "scan.adding": "新增中…",
    "scan.addOne": "新增 {n} 項",
    "scan.addMany": "新增 {n} 項",
    "scan.errNotImage": "這不是圖片",
    "scan.errTooLarge": "圖片太大 — 請小於 6MB",
    "scan.errAiOff": "AI 已關閉 — 設定 ANTHROPIC_API_KEY 後可啟用",
    "scan.errNoTasks": "從這張圖看不到任何任務",
    "scan.errFailed": "掃描失敗",
    "scan.toastAddedOne": "已新增 1 項",
    "scan.toastAddedMany": "已新增 {n} 項",
    /* members */
    "members.shareTitle": "分享「{name}」",
    "members.shareIntro": "輸入 email 邀請。對方會即時看到清單與任務。",
    "members.invitePlaceholder": "someone@example.com",
    "members.invite": "邀請",
    "members.invited": "…",
    "members.heading": "成員",
    "members.empty": "還沒有成員。",
    "members.remove": "移除",
    "members.ownerOnly": "只有清單擁有者可以邀請或移除成員。",
    "members.toastAdded": "已加入",
    "members.roleOwner": "擁有者",
    "members.roleMember": "成員",
    /* createProject */
    "createProject.title": "新清單",
    "createProject.intro": "一處放同類任務的空間。",
    "createProject.namePlaceholder": "例:工作、閱讀、工作室",
    "createProject.colorLabel": "顏色",
    "createProject.cancel": "取消",
    "createProject.create": "建立",
    "createProject.creating": "建立中…",
    "createProject.toastCreated": "已建立「{name}」",
    "createProject.errCreate": "無法建立清單",
    /* dailyEdition */
    "dailyEdition.errLoad": "每日版面無法載入。",
    "dailyEdition.tryAgain": "重試",
    "dailyEdition.regenerate": "重新產生版面",
    "dailyEdition.regenAria": "重新產生今天的版面",
    "dailyEdition.readMore": "閱讀更多",
    /* kanban */
    "kanban.priorityHigh": "高",
    "kanban.priorityMedium": "中",
    "kanban.priorityLow": "低",
    "kanban.priorityNone": "無",
    "kanban.dropHere": "把任務放到這裡。",
    "kanban.quickAdd": "快速新增",
    /* shared */
    "shared.quickAdd": "快速新增",
    "shared.untitled": "(無標題)",
  },
  "zh-CN": {
    "auth.login.title": "欢迎回来",
    "auth.login.subtitle": "登录查看你的任务。",
    "auth.login.orEmail": "或使用电子邮件",
    "auth.login.emailPlaceholder": "you@example.com",
    "auth.login.passwordPlaceholder": "密码",
    "auth.login.submit": "登录",
    "auth.login.magic": "用魔法链接登录",
    "auth.login.newHere": "新用户?",
    "auth.login.createAccount": "创建账号",
    "auth.signup.title": "创建你的账号",
    "auth.signup.subtitle": "免费,无需信用卡。",
    "auth.signup.namePlaceholder": "你的名字",
    "auth.signup.passwordPlaceholder": "密码(至少 6 位)",
    "auth.signup.submit": "注册",
    "auth.signup.haveAccount": "已有账号?",
    "auth.signup.login": "登录",
    "auth.signup.created": "账号已创建,请查收验证邮件。",
    "auth.shared.language": "语言",
    "auth.shared.close": "关闭",
    "auth.shared.signupTab": "注册",
    "auth.shared.loginTab": "登录",
    "landing.kicker": "First Light · 一个沉静的工作操作系统",
    "landing.heroLine1": "用心规划,",
    "landing.heroLine2": "为目的而发光",
    "landing.heroBody": "任务、日历、习惯与番茄钟 — 跨设备实时同步。每日的编辑式简报,让你掌握节奏,而非陷入焦灼。",
    "landing.signupCta": "免费开始",
    "landing.loginCta": "登录",
    "landing.ctaNote": "无需信用卡 · 不追踪 · 实时同步",
    "landing.headerLogin": "登录",
    "landing.headerSignup": "开始使用",
    "landing.principlesKicker": "品牌理念",
    "landing.principlesHeading": "五个每日意图。",
    "landing.principle1Title": "清晰",
    "landing.principle1Body": "清晰的思考,清晰的方向。",
    "landing.principle2Title": "专注",
    "landing.principle2Body": "一次只做一件事。",
    "landing.principle3Title": "前进",
    "landing.principle3Body": "微小步伐,创造改变。",
    "landing.principle4Title": "从容",
    "landing.principle4Body": "心思平静,效率自然。",
    "landing.principle5Title": "光",
    "landing.principle5Body": "前行的灵感与动力。",
    "landing.footerCredit": "© First Light · 由 Next.js、Supabase 与 Tailwind 打造",
    "landing.footerSource": "GitHub 源码 →",
    "sidebar.addTask": "新增任务",
    "sidebar.search": "搜索…",
    "sidebar.today": "今天",
    "sidebar.tomorrow": "明天",
    "sidebar.next7": "未来七日",
    "sidebar.inbox": "收件箱",
    "sidebar.calendar": "日历",
    "sidebar.eisenhower": "取舍",
    "sidebar.pomodoro": "专注",
    "sidebar.habits": "习惯",
    "sidebar.weeklyReview": "每周回顾",
    "sidebar.lists": "清单",
    "sidebar.tags": "标签",
    "sidebar.noLists": "还没有清单。",
    "sidebar.noTags": "还没有标签 — 在任务标题中输入 #tagname。",
    "sidebar.newList": "新清单",
    "sidebar.logout": "退出",
    "sidebar.next90": "未来 90 日",
    "sidebar.completed": "已完成",
    "view.next90.subtitle": "未来 90 天内到期的任务。",
    "view.completed.subtitle": "你已完成的事,最新优先。",
    "email.subject": "提醒 · {title}",
    "email.kicker": "FIRST LIGHT · 提醒",
    "email.dueLabel": "到期",
    "email.openCta": "在 First Light 打开 →",
    "email.footer": "你收到这封信是因为你设置了提醒。可在设置中管理 email 提醒。",
    "email.unsubscribe": "取消订阅提醒邮件",
    "sidebar.settings": "设置",
  
    /* common */
    "common.save": "保存",
    "common.cancel": "取消",
    "common.delete": "删除",
    "common.confirm": "确认",
    "common.loading": "加载中…",
    "common.add": "添加",
    "common.remove": "移除",
    "common.edit": "编辑",
    "common.done": "完成",
    "common.yes": "是",
    "common.no": "否",
    "common.back": "返回",
    "common.next": "下一步",
    "common.close": "关闭",
    "common.apply": "应用",
    "common.applyAll": "全部应用",
    "common.skip": "跳过",
    "common.tryAgain": "重试",
    "common.aiDisabled": "目前未启用 AI 功能。",
    "common.budgetReached": "本日 AI 额度已用完。",
    "common.unknown": "(未知)",
    /* view */
    "view.tomorrow.subtitle": "明天的版面。",
    "view.next7.subtitle": "未来一周内到期的任务。",
    "view.calendar.subtitle": "把任务拖到不同日期。",
    "view.inbox.subtitle": "还没有分到清单的任务。",
    "view.habits.subtitle": "每天一件小事。",
    "view.settings.subtitle": "账号、偏好、数据。",
    "view.tags.subtitle": "带有这个标签的任务。",
    "view.pomodoro.subtitle": "一个番茄,一件事。",
    "view.matrix.subtitle": "按紧急与重要分类。",
    "view.lists.subtitle": "这个清单中的任务。",
    /* empty */
    "empty.noTasks": "还没有任务。",
    "empty.nothingToShow": "没有可显示的内容。",
    "empty.pressQ": "按 q 添加第一个任务。",
    "empty.allClear": "全部处理完了。",
    "empty.noResults": "没有结果。",
    "empty.dropTasksHere": "把任务拖到这里。",
    /* goal */
    "goal.title": "一个目标",
    "goal.intro": "写下你想达成的结果。AI 会把它拆成一个项目与一连串可按顺序完成的任务。",
    "goal.placeholder": "例:11/30 前完成 Q4 上线,涵盖邮件与社群推广",
    "goal.planIt": "开始规划",
    "goal.planning": "规划中…",
    "goal.cancel": "取消",
    "goal.back": "返回",
    "goal.cmdEnterHint": "规划",
    "goal.steps": "个步骤",
    "goal.projectLabel": "项目",
    "goal.create": "创建",
    "goal.creating": "创建中…",
    "goal.remove": "移除",
    "goal.todayLabel": "今天",
    "goal.errBudget": "今日的目标拆解额度已用完。",
    "goal.errPlan": "无法规划这个目标,请再试一次。",
    "goal.errCreate": "无法创建计划",
    "goal.successAdded": "目标已就绪:新增 {n} 项",
    /* reflect */
    "reflect.title": "今天,回望",
    "reflect.reading": "正在阅读今天…",
    "reflect.carryHeading": "带到明天",
    "reflect.rollAll": "全部延后 →",
    "reflect.rollOne": "延到明天",
    "reflect.dropHeading": "可以放下",
    "reflect.clearOne": "清除",
    "reflect.notesHeading": "写给自己的笔记",
    "reflect.notesPlaceholder": "如果想写,留下今天的一句话。",
    "reflect.close": "关闭",
    "reflect.toastRolled": "已延到明天",
    "reflect.toastCleared": "已从今天移除",
    "reflect.toastSaved": "已保存",
    "reflect.errLoad": "无法加载回顾",
    "reflect.errSaveJournal": "无法保存笔记",
    /* retro */
    "retro.kicker": "每周回顾",
    "retro.thisWeek": "本周",
    "retro.lastWeek": "上周",
    "retro.nextWeek": "下周",
    "retro.titleThisWeek": "本周,目前为止",
    "retro.titleLastWeek": "上周的版本",
    "retro.titleNextWeek": "下周,计划中",
    "retro.updating": "更新中…",
    "retro.empty": "此服务器尚未启用 AI 功能,或本周还没有数据。",
    "retro.weekOf": "本周",
    "retro.onCalendar": "日程上",
    "retro.scheduled": "已安排",
    "retro.itemsOne": "项",
    "retro.itemsMany": "项",
    "retro.shipped": "已交付",
    "retro.slipped": "未完成",
    "retro.themes": "主题",
    "retro.dropList": "可以放下",
    "retro.nextWeekPlan": "为下周",
    "retro.allDay": "全天",
    /* procrastination */
    "procrastination.title": "卡住的项目",
    "procrastination.intro": "在清单里没动静的项目。",
    "procrastination.scan": "扫描待办",
    "procrastination.scanning": "扫描中…",
    "procrastination.allClear": "全部处理完了。",
    "procrastination.errBudget": "本周扫描额度已用完。",
    "procrastination.errScan": "无法扫描你的待办。",
    "procrastination.verdictDrop": "放下",
    "procrastination.verdictSchedule": "排程",
    "procrastination.verdictBreak": "拆解",
    "procrastination.apply": "应用",
    "procrastination.skip": "跳过",
    /* planDay */
    "planDay.button": "规划今天",
    "planDay.planning": "规划中…",
    "planDay.title": "今天",
    "planDay.reading": "正在阅读今天…",
    "planDay.empty": "今天没什么要忙的。",
    "planDay.allSet": "都安排好了 — 今天就这样。",
    "planDay.applyAll": "全部应用",
    "planDay.close": "关闭",
    "planDay.errBudget": "今天的规划额度已用完,明天再试。",
    "planDay.errPlan": "无法规划你的今天,请再试一次。",
    "planDay.toastApplied": "已应用 {n} 项。",
    /* todayAi */
    "todayAi.over": "超出",
    "todayAi.planned": "已安排",
    "todayAi.clearOverdue": "清掉 {n} 件逾期",
    "todayAi.rescheduling": "重新排程中…",
    "todayAi.modalTitle": "重新排程",
    "todayAi.reading": "阅读待办中…",
    "todayAi.empty": "待办清空了。",
    "todayAi.cleared": "待办清空了。",
    "todayAi.applyAll": "全部应用",
    "todayAi.close": "关闭",
    "todayAi.errBudget": "今天的重新排程额度已用完。",
    "todayAi.errReschedule": "无法重新排程,请再试一次。",
    "todayAi.toastNothingOverdue": "没有逾期 — 不错。",
    /* commandPalette */
    "commandPalette.placeholder": "搜索任务、清单、标签…或问 AI",
    "commandPalette.askAi": "问 AI",
    "commandPalette.askAiHint": "用 AI 重新排序(Cmd/Ctrl+Enter)",
    "commandPalette.aiMatches": "AI 结果",
    "commandPalette.tasks": "任务",
    "commandPalette.lists": "清单",
    "commandPalette.tags": "标签",
    "commandPalette.done": "已完成",
    "commandPalette.noResults": "没有结果。",
    "commandPalette.errBudget": "搜索额度已用完。",
    "commandPalette.errSearch": "无法执行 AI 搜索。",
    /* quickAdd */
    "quickAdd.kicker": "快速添加",
    "quickAdd.placeholder": "添加任务 — 用打字或语音",
    "quickAdd.scanTitle": "从照片或截图扫描任务",
    "quickAdd.scanAria": "从图片扫描任务",
    "quickAdd.chipTime": "时间",
    "quickAdd.chipRepeat": "重复",
    "quickAdd.chipReminder": "提醒",
    "quickAdd.chipPriority": "优先级",
    "quickAdd.chipInbox": "收件箱",
    "quickAdd.chipTag": "标签",
    "quickAdd.priorityHigh": "高",
    "quickAdd.priorityMedium": "中",
    "quickAdd.priorityLow": "低",
    "quickAdd.priorityNone": "无",
    "quickAdd.repeatDaily": "每日",
    "quickAdd.repeatWeekdays": "工作日",
    "quickAdd.repeatWeekly": "每周",
    "quickAdd.repeatMonthly": "每月",
    "quickAdd.repeatYearly": "每年",
    "quickAdd.repeatRepeats": "重复中",
    "quickAdd.timeToday": "今天",
    "quickAdd.timeTomorrow": "明天",
    "quickAdd.miniSiftCaption": "取舍 · 点击应用",
    "quickAdd.q1": "先做",
    "quickAdd.q2": "安排",
    "quickAdd.q3": "委派",
    "quickAdd.q4": "舍弃",
    "quickAdd.tagsHelpPrefix": "输入",
    "quickAdd.tagsHelpSuffix": "于上方输入 — 在光标处插入「#」",
    "quickAdd.cancel": "取消",
    "quickAdd.enterToAdd": "Enter 添加 · Esc 关闭",
    /* taskPanel */
    "taskPanel.markComplete": "标记为完成",
    "taskPanel.markIncomplete": "标记为未完成",
    "taskPanel.delete": "删除",
    "taskPanel.close": "关闭",
    "taskPanel.done": "完成",
    "taskPanel.titlePlaceholder": "任务标题",
    "taskPanel.starts": "开始",
    "taskPanel.ends": "结束",
    "taskPanel.due": "到期",
    "taskPanel.startPlaceholder": "选择开始时间",
    "taskPanel.duePlaceholder": "选择到期时间",
    "taskPanel.repeat": "重复",
    "taskPanel.recurNone": "不重复",
    "taskPanel.recurDaily": "每日",
    "taskPanel.recurEveryOtherDay": "每两天",
    "taskPanel.recurWeekdays": "工作日(周一至周五)",
    "taskPanel.recurWeekends": "周末",
    "taskPanel.recurWeekly": "每周",
    "taskPanel.recurEveryOtherWeek": "每两周",
    "taskPanel.recurMonthly": "每月",
    "taskPanel.recurEveryThreeMonths": "每三个月",
    "taskPanel.recurYearly": "每年",
    "taskPanel.recurCustom": "自定",
    "taskPanel.recurNeedsDue": "请设置到期日 — 完成任务后会自动创建下一次。",
    "taskPanel.reminder": "提醒",
    "taskPanel.reminderHelp": "App 打开时浏览器会在该时间通知你。请在提示时允许通知。",
    "taskPanel.priority": "优先级",
    "taskPanel.list": "清单",
    "taskPanel.inboxNoList": "收件箱(无清单)",
    "taskPanel.shareGroup": "与群组分享",
    "taskPanel.privateOnly": "私人 — 只给我",
    "taskPanel.manageGroups": "管理群组 →",
    "taskPanel.assignedTo": "指派给",
    "taskPanel.unassigned": "未指派",
    "taskPanel.tags": "标签",
    "taskPanel.subtasks": "子任务",
    "taskPanel.attachments": "附件",
    "taskPanel.aiShortcuts": "AI 快捷",
    "taskPanel.notes": "笔记",
    "taskPanel.notesPlaceholder": "添加笔记…",
    "taskPanel.created": "创建",
    "taskPanel.updated": "更新",
    /* scan */
    "scan.kicker": "扫描任务",
    "scan.title": "读一张照片,把任务带出来。",
    "scan.takePhoto": "拍张照片",
    "scan.takePhotoHint": "便利贴、白板、日历页",
    "scan.uploadImage": "上传图片",
    "scan.uploadImageHint": "截图、相册中的照片",
    "scan.reading": "正在读取图片…",
    "scan.foundOne": "找到 {n} 项任务。可编辑、取消勾选,或按添加。",
    "scan.foundMany": "找到 {n} 项任务。可编辑、取消勾选,或按添加。",
    "scan.unreadable": "看不清楚,试试更清晰的照片或图片。",
    "scan.removeImage": "移除图片",
    "scan.cancel": "取消",
    "scan.adding": "添加中…",
    "scan.addOne": "添加 {n} 项",
    "scan.addMany": "添加 {n} 项",
    "scan.errNotImage": "这不是图片",
    "scan.errTooLarge": "图片太大 — 请小于 6MB",
    "scan.errAiOff": "AI 已关闭 — 设置 ANTHROPIC_API_KEY 后启用",
    "scan.errNoTasks": "从这张图看不到任何任务",
    "scan.errFailed": "扫描失败",
    "scan.toastAddedOne": "已添加 1 项",
    "scan.toastAddedMany": "已添加 {n} 项",
    /* members */
    "members.shareTitle": "分享「{name}」",
    "members.shareIntro": "输入 email 邀请。对方会实时看到清单与任务。",
    "members.invitePlaceholder": "someone@example.com",
    "members.invite": "邀请",
    "members.invited": "…",
    "members.heading": "成员",
    "members.empty": "还没有成员。",
    "members.remove": "移除",
    "members.ownerOnly": "只有清单所有者可以邀请或移除成员。",
    "members.toastAdded": "已加入",
    "members.roleOwner": "所有者",
    "members.roleMember": "成员",
    /* createProject */
    "createProject.title": "新清单",
    "createProject.intro": "一处放同类任务的空间。",
    "createProject.namePlaceholder": "例:工作、阅读、工作室",
    "createProject.colorLabel": "颜色",
    "createProject.cancel": "取消",
    "createProject.create": "创建",
    "createProject.creating": "创建中…",
    "createProject.toastCreated": "已创建「{name}」",
    "createProject.errCreate": "无法创建清单",
    /* dailyEdition */
    "dailyEdition.errLoad": "每日版面无法加载。",
    "dailyEdition.tryAgain": "重试",
    "dailyEdition.regenerate": "重新生成版面",
    "dailyEdition.regenAria": "重新生成今天的版面",
    "dailyEdition.readMore": "阅读更多",
    /* kanban */
    "kanban.priorityHigh": "高",
    "kanban.priorityMedium": "中",
    "kanban.priorityLow": "低",
    "kanban.priorityNone": "无",
    "kanban.dropHere": "把任务拖到这里。",
    "kanban.quickAdd": "快速添加",
    /* shared */
    "shared.quickAdd": "快速添加",
    "shared.untitled": "(无标题)",
  },
  ja: {
    "auth.login.title": "おかえりなさい",
    "auth.login.subtitle": "ログインしてタスクを開く。",
    "auth.login.orEmail": "またはメールで",
    "auth.login.emailPlaceholder": "you@example.com",
    "auth.login.passwordPlaceholder": "パスワード",
    "auth.login.submit": "ログイン",
    "auth.login.magic": "マジックリンクを送る",
    "auth.login.newHere": "初めての方は",
    "auth.login.createAccount": "アカウントを作成",
    "auth.signup.title": "アカウントを作成",
    "auth.signup.subtitle": "無料。クレジットカード不要。",
    "auth.signup.namePlaceholder": "お名前",
    "auth.signup.passwordPlaceholder": "パスワード(6文字以上)",
    "auth.signup.submit": "登録する",
    "auth.signup.haveAccount": "すでにアカウントをお持ちの方は",
    "auth.signup.login": "ログイン",
    "auth.signup.created": "アカウントを作成しました。受信箱をご確認ください。",
    "auth.shared.language": "言語",
    "auth.shared.close": "閉じる",
    "auth.shared.signupTab": "登録",
    "auth.shared.loginTab": "ログイン",
    "landing.kicker": "First Light · 静けさの中で進める仕事のためのOS",
    "landing.heroLine1": "意図を持って計画し、",
    "landing.heroLine2": "目的を持って光を当てる",
    "landing.heroBody": "タスク、カレンダー、習慣、ポモドーロ — すべてのデバイスでリアルタイムに同期。一日のリズムを整える、編集された朝のブリーフィング。",
    "landing.signupCta": "無料で始める",
    "landing.loginCta": "ログイン",
    "landing.ctaNote": "クレジットカード不要 · 追跡なし · リアルタイム同期",
    "landing.headerLogin": "ログイン",
    "landing.headerSignup": "始める",
    "landing.principlesKicker": "ブランド原則",
    "landing.principlesHeading": "毎日の五つの意図。",
    "landing.principle1Title": "明晰",
    "landing.principle1Body": "澄んだ思考、確かな方向。",
    "landing.principle2Title": "集中",
    "landing.principle2Body": "一度にひとつだけ。",
    "landing.principle3Title": "進歩",
    "landing.principle3Body": "小さな歩みが変化をつくる。",
    "landing.principle4Title": "静けさ",
    "landing.principle4Body": "穏やかな心、生産的な日々。",
    "landing.principle5Title": "光",
    "landing.principle5Body": "前へと導く、ささやかなひらめき。",
    "landing.footerCredit": "© First Light · Next.js、Supabase、Tailwindで構築",
    "landing.footerSource": "GitHub のソース →",
    "sidebar.addTask": "タスクを追加",
    "sidebar.search": "検索…",
    "sidebar.today": "今日",
    "sidebar.tomorrow": "明日",
    "sidebar.next7": "次の7日間",
    "sidebar.inbox": "受信箱",
    "sidebar.calendar": "カレンダー",
    "sidebar.eisenhower": "取捨",
    "sidebar.pomodoro": "集中",
    "sidebar.habits": "習慣",
    "sidebar.weeklyReview": "週次レビュー",
    "sidebar.lists": "リスト",
    "sidebar.tags": "タグ",
    "sidebar.noLists": "まだリストがありません。",
    "sidebar.noTags": "まだタグがありません — タスク名に #tagname と入力。",
    "sidebar.newList": "新しいリスト",
    "sidebar.logout": "ログアウト",
    "sidebar.next90": "次の90日",
    "sidebar.completed": "完了",
    "view.next90.subtitle": "今後90日以内に期限のタスク。",
    "view.completed.subtitle": "完了した作業 — 新しい順。",
    "email.subject": "リマインダー · {title}",
    "email.kicker": "FIRST LIGHT · リマインダー",
    "email.dueLabel": "期限",
    "email.openCta": "First Light で開く →",
    "email.footer": "リマインダーを設定したため送信されました。設定からメール通知を管理できます。",
    "email.unsubscribe": "リマインダーメールの配信を停止",
    "sidebar.settings": "設定",
  
    /* common */
    "common.save": "保存",
    "common.cancel": "キャンセル",
    "common.delete": "削除",
    "common.confirm": "確定",
    "common.loading": "読み込み中…",
    "common.add": "追加",
    "common.remove": "削除",
    "common.edit": "編集",
    "common.done": "完了",
    "common.yes": "はい",
    "common.no": "いいえ",
    "common.back": "戻る",
    "common.next": "次へ",
    "common.close": "閉じる",
    "common.apply": "適用",
    "common.applyAll": "すべて適用",
    "common.skip": "スキップ",
    "common.tryAgain": "もう一度",
    "common.aiDisabled": "AI機能は現在オフです。",
    "common.budgetReached": "本日のAI利用枠を使い切りました。",
    "common.unknown": "(不明)",
    /* view */
    "view.tomorrow.subtitle": "明日の予定。",
    "view.next7.subtitle": "今後7日以内が締め切りのタスク。",
    "view.calendar.subtitle": "タスクを日付にドラッグして配置。",
    "view.inbox.subtitle": "リスト未分類のタスク。",
    "view.habits.subtitle": "毎日の、小さな一歩。",
    "view.settings.subtitle": "アカウントと設定。",
    "view.tags.subtitle": "このタグが付いたタスク。",
    "view.pomodoro.subtitle": "ひと区切り、ひとつのこと。",
    "view.matrix.subtitle": "緊急度と重要度で振り分ける。",
    "view.lists.subtitle": "このリストのタスク。",
    /* empty */
    "empty.noTasks": "まだタスクはありません。",
    "empty.nothingToShow": "表示する項目はありません。",
    "empty.pressQ": "qキーで最初のタスクを追加。",
    "empty.allClear": "全部片付きました。",
    "empty.noResults": "見つかりませんでした。",
    "empty.dropTasksHere": "ここにタスクをドロップ。",
    /* goal */
    "goal.title": "ひとつの目標",
    "goal.intro": "達成したいゴールを書いてください。AIがプロジェクトと順に進められるタスクに分解します。",
    "goal.placeholder": "例:11月30日までにQ4ローンチ完了。メールとSNSも一通り。",
    "goal.planIt": "プランを作る",
    "goal.planning": "考え中…",
    "goal.cancel": "キャンセル",
    "goal.back": "戻る",
    "goal.cmdEnterHint": "で計画",
    "goal.steps": "ステップ",
    "goal.projectLabel": "プロジェクト",
    "goal.create": "作成",
    "goal.creating": "作成中…",
    "goal.remove": "削除",
    "goal.todayLabel": "今日",
    "goal.errBudget": "本日のゴール分解の利用枠を使い切りました。",
    "goal.errPlan": "ゴールを分解できませんでした。もう一度お試しください。",
    "goal.errCreate": "プランを作成できませんでした",
    "goal.successAdded": "ゴール完成:{n} 件追加",
    /* reflect */
    "reflect.title": "今日を、振り返って",
    "reflect.reading": "今日を読み込んでいます…",
    "reflect.carryHeading": "明日に持ち越し",
    "reflect.rollAll": "すべて持ち越し →",
    "reflect.rollOne": "明日へ持ち越し",
    "reflect.dropHeading": "手放してもよい",
    "reflect.clearOne": "外す",
    "reflect.notesHeading": "自分へのメモ",
    "reflect.notesPlaceholder": "今日について一文だけ、もしよければ。",
    "reflect.close": "閉じる",
    "reflect.toastRolled": "明日に持ち越しました",
    "reflect.toastCleared": "今日から外しました",
    "reflect.toastSaved": "保存しました",
    "reflect.errLoad": "振り返りを読み込めませんでした",
    "reflect.errSaveJournal": "メモを保存できませんでした",
    /* retro */
    "retro.kicker": "週次レビュー",
    "retro.thisWeek": "今週",
    "retro.lastWeek": "先週",
    "retro.nextWeek": "来週",
    "retro.titleThisWeek": "今週、ここまで",
    "retro.titleLastWeek": "先週のエディション",
    "retro.titleNextWeek": "来週の計画",
    "retro.updating": "更新中…",
    "retro.empty": "このサーバーではAI機能がオフ、もしくは今週のデータがまだありません。",
    "retro.weekOf": "週始まり",
    "retro.onCalendar": "カレンダー上",
    "retro.scheduled": "予定",
    "retro.itemsOne": "件",
    "retro.itemsMany": "件",
    "retro.shipped": "達成",
    "retro.slipped": "未達成",
    "retro.themes": "テーマ",
    "retro.dropList": "手放してもよい",
    "retro.nextWeekPlan": "来週へ",
    "retro.allDay": "終日",
    /* procrastination */
    "procrastination.title": "止まっている項目",
    "procrastination.intro": "リストでずっと動いていないもの。",
    "procrastination.scan": "棚卸しする",
    "procrastination.scanning": "確認中…",
    "procrastination.allClear": "全部片付きました。",
    "procrastination.errBudget": "今週の棚卸し利用枠を使い切りました。",
    "procrastination.errScan": "棚卸しを実行できませんでした。",
    "procrastination.verdictDrop": "手放す",
    "procrastination.verdictSchedule": "予定する",
    "procrastination.verdictBreak": "分解する",
    "procrastination.apply": "適用",
    "procrastination.skip": "スキップ",
    /* planDay */
    "planDay.button": "今日を組み立てる",
    "planDay.planning": "考え中…",
    "planDay.title": "今日",
    "planDay.reading": "今日を読み込んでいます…",
    "planDay.empty": "今日は予定なし。",
    "planDay.allSet": "完了。今日はここまで。",
    "planDay.applyAll": "すべて適用",
    "planDay.close": "閉じる",
    "planDay.errBudget": "本日の利用枠を使い切りました。明日もう一度お試しください。",
    "planDay.errPlan": "今日の組み立てに失敗しました。もう一度お試しください。",
    "planDay.toastApplied": "{n} 件を適用しました。",
    /* todayAi */
    "todayAi.over": "オーバー",
    "todayAi.planned": "予定",
    "todayAi.clearOverdue": "期限切れ {n} 件を片付ける",
    "todayAi.rescheduling": "再スケジュール中…",
    "todayAi.modalTitle": "再スケジュール",
    "todayAi.reading": "バックログを確認中…",
    "todayAi.empty": "バックログは空っぽ。",
    "todayAi.cleared": "バックログは空っぽ。",
    "todayAi.applyAll": "すべて適用",
    "todayAi.close": "閉じる",
    "todayAi.errBudget": "本日の再スケジュール枠を使い切りました。",
    "todayAi.errReschedule": "再スケジュールできませんでした。もう一度お試しください。",
    "todayAi.toastNothingOverdue": "期限切れなし、いいね。",
    /* commandPalette */
    "commandPalette.placeholder": "タスク・リスト・タグを検索…またはAIに聞く",
    "commandPalette.askAi": "AIに聞く",
    "commandPalette.askAiHint": "AIで並べ替え (Cmd/Ctrl+Enter)",
    "commandPalette.aiMatches": "AIによる候補",
    "commandPalette.tasks": "タスク",
    "commandPalette.lists": "リスト",
    "commandPalette.tags": "タグ",
    "commandPalette.done": "完了",
    "commandPalette.noResults": "見つかりませんでした。",
    "commandPalette.errBudget": "検索の利用枠を使い切りました。",
    "commandPalette.errSearch": "AI検索を実行できませんでした。",
    /* quickAdd */
    "quickAdd.kicker": "クイック追加",
    "quickAdd.placeholder": "タスクを追加 — 入力か音声で",
    "quickAdd.scanTitle": "写真や画面からタスクを読み取る",
    "quickAdd.scanAria": "画像からタスクを読み取る",
    "quickAdd.chipTime": "時間",
    "quickAdd.chipRepeat": "繰り返し",
    "quickAdd.chipReminder": "リマインダー",
    "quickAdd.chipPriority": "優先度",
    "quickAdd.chipInbox": "受信箱",
    "quickAdd.chipTag": "タグ",
    "quickAdd.priorityHigh": "高",
    "quickAdd.priorityMedium": "中",
    "quickAdd.priorityLow": "低",
    "quickAdd.priorityNone": "なし",
    "quickAdd.repeatDaily": "毎日",
    "quickAdd.repeatWeekdays": "平日",
    "quickAdd.repeatWeekly": "毎週",
    "quickAdd.repeatMonthly": "毎月",
    "quickAdd.repeatYearly": "毎年",
    "quickAdd.repeatRepeats": "繰り返し",
    "quickAdd.timeToday": "今日",
    "quickAdd.timeTomorrow": "明日",
    "quickAdd.miniSiftCaption": "取捨 · クリックで適用",
    "quickAdd.q1": "まずやる",
    "quickAdd.q2": "予定する",
    "quickAdd.q3": "任せる",
    "quickAdd.q4": "やめる",
    "quickAdd.tagsHelpPrefix": "上の入力欄に",
    "quickAdd.tagsHelpSuffix": "「#tagname」と入力 — カーソル位置に「#」を挿入",
    "quickAdd.cancel": "キャンセル",
    "quickAdd.enterToAdd": "Enterで追加 · Escで閉じる",
    /* taskPanel */
    "taskPanel.markComplete": "完了にする",
    "taskPanel.markIncomplete": "未完了に戻す",
    "taskPanel.delete": "削除",
    "taskPanel.close": "閉じる",
    "taskPanel.done": "完了",
    "taskPanel.titlePlaceholder": "タスク名",
    "taskPanel.starts": "開始",
    "taskPanel.ends": "終了",
    "taskPanel.due": "期限",
    "taskPanel.startPlaceholder": "開始時刻を選ぶ",
    "taskPanel.duePlaceholder": "期限を選ぶ",
    "taskPanel.repeat": "繰り返し",
    "taskPanel.recurNone": "繰り返さない",
    "taskPanel.recurDaily": "毎日",
    "taskPanel.recurEveryOtherDay": "1日おき",
    "taskPanel.recurWeekdays": "平日(月〜金)",
    "taskPanel.recurWeekends": "週末",
    "taskPanel.recurWeekly": "毎週",
    "taskPanel.recurEveryOtherWeek": "隔週",
    "taskPanel.recurMonthly": "毎月",
    "taskPanel.recurEveryThreeMonths": "3か月ごと",
    "taskPanel.recurYearly": "毎年",
    "taskPanel.recurCustom": "カスタム",
    "taskPanel.recurNeedsDue": "期限を設定してください。完了すると次回が自動で作られます。",
    "taskPanel.reminder": "リマインダー",
    "taskPanel.reminderHelp": "アプリが開いている間、その時刻にブラウザが通知します。許可ダイアログでオンにしてください。",
    "taskPanel.priority": "優先度",
    "taskPanel.list": "リスト",
    "taskPanel.inboxNoList": "受信箱(リストなし)",
    "taskPanel.shareGroup": "グループで共有",
    "taskPanel.privateOnly": "プライベート — 自分のみ",
    "taskPanel.manageGroups": "グループを管理 →",
    "taskPanel.assignedTo": "担当者",
    "taskPanel.unassigned": "未割り当て",
    "taskPanel.tags": "タグ",
    "taskPanel.subtasks": "サブタスク",
    "taskPanel.attachments": "添付",
    "taskPanel.aiShortcuts": "AIショートカット",
    "taskPanel.notes": "メモ",
    "taskPanel.notesPlaceholder": "メモを追加…",
    "taskPanel.created": "作成",
    "taskPanel.updated": "更新",
    /* scan */
    "scan.kicker": "タスクを読み取る",
    "scan.title": "写真を読み、ToDoを取り出す。",
    "scan.takePhoto": "写真を撮る",
    "scan.takePhotoHint": "付箋、ホワイトボード、カレンダー",
    "scan.uploadImage": "画像をアップロード",
    "scan.uploadImageHint": "スクリーンショット、写真ライブラリから",
    "scan.reading": "画像を読み込み中…",
    "scan.foundOne": "{n} 件のタスクが見つかりました。編集・チェック解除・追加でどうぞ。",
    "scan.foundMany": "{n} 件のタスクが見つかりました。編集・チェック解除・追加でどうぞ。",
    "scan.unreadable": "読み取れませんでした。もう少し鮮明な画像でお試しください。",
    "scan.removeImage": "画像を削除",
    "scan.cancel": "キャンセル",
    "scan.adding": "追加中…",
    "scan.addOne": "{n} 件追加",
    "scan.addMany": "{n} 件追加",
    "scan.errNotImage": "画像ではありません",
    "scan.errTooLarge": "画像が大きすぎます — 6MB以下にしてください",
    "scan.errAiOff": "AIはオフです — ANTHROPIC_API_KEYを設定してください",
    "scan.errNoTasks": "このイメージにはタスクが見当たりません",
    "scan.errFailed": "読み取りに失敗しました",
    "scan.toastAddedOne": "1 件追加しました",
    "scan.toastAddedMany": "{n} 件追加しました",
    /* members */
    "members.shareTitle": "「{name}」を共有",
    "members.shareIntro": "メールで招待。リストとタスクをリアルタイムで共有します。",
    "members.invitePlaceholder": "someone@example.com",
    "members.invite": "招待",
    "members.invited": "…",
    "members.heading": "メンバー",
    "members.empty": "メンバーはまだいません。",
    "members.remove": "削除",
    "members.ownerOnly": "リストのオーナーのみがメンバーを招待・削除できます。",
    "members.toastAdded": "追加しました",
    "members.roleOwner": "オーナー",
    "members.roleMember": "メンバー",
    /* createProject */
    "createProject.title": "新しいリスト",
    "createProject.intro": "同じ種類のタスクを置く場所。",
    "createProject.namePlaceholder": "例:仕事、読書、スタジオ",
    "createProject.colorLabel": "カラー",
    "createProject.cancel": "キャンセル",
    "createProject.create": "作成",
    "createProject.creating": "作成中…",
    "createProject.toastCreated": "「{name}」を作成しました",
    "createProject.errCreate": "リストを作成できませんでした",
    /* dailyEdition */
    "dailyEdition.errLoad": "Daily Editionを読み込めませんでした。",
    "dailyEdition.tryAgain": "もう一度",
    "dailyEdition.regenerate": "今日のエディションを再生成",
    "dailyEdition.regenAria": "今日のエディションを再生成",
    "dailyEdition.readMore": "もっと読む",
    /* kanban */
    "kanban.priorityHigh": "高",
    "kanban.priorityMedium": "中",
    "kanban.priorityLow": "低",
    "kanban.priorityNone": "なし",
    "kanban.dropHere": "ここにタスクをドロップ。",
    "kanban.quickAdd": "クイック追加",
    /* shared */
    "shared.quickAdd": "クイック追加",
    "shared.untitled": "(無題)",
  },
  ko: {
    "auth.login.title": "다시 오신 것을 환영합니다",
    "auth.login.subtitle": "로그인하여 작업을 확인하세요.",
    "auth.login.orEmail": "또는 이메일로",
    "auth.login.emailPlaceholder": "you@example.com",
    "auth.login.passwordPlaceholder": "비밀번호",
    "auth.login.submit": "로그인",
    "auth.login.magic": "매직 링크로 로그인",
    "auth.login.newHere": "처음 오셨나요?",
    "auth.login.createAccount": "계정 만들기",
    "auth.signup.title": "계정 만들기",
    "auth.signup.subtitle": "무료입니다. 카드가 필요 없습니다.",
    "auth.signup.namePlaceholder": "이름",
    "auth.signup.passwordPlaceholder": "비밀번호(6자 이상)",
    "auth.signup.submit": "가입하기",
    "auth.signup.haveAccount": "이미 계정이 있으신가요?",
    "auth.signup.login": "로그인",
    "auth.signup.created": "계정이 생성되었습니다. 받은 편지함을 확인하세요.",
    "auth.shared.language": "언어",
    "auth.shared.close": "닫기",
    "auth.shared.signupTab": "가입",
    "auth.shared.loginTab": "로그인",
    "landing.kicker": "First Light · 일을 차분하게 다루는 운영체제",
    "landing.heroLine1": "의도를 가지고 계획하고,",
    "landing.heroLine2": "목적을 향해 빛을 두다",
    "landing.heroBody": "할 일, 캘린더, 습관, 뽀모도로 — 모든 기기에서 실시간으로 동기화됩니다. 하루의 리듬을 잡아주는 매일의 에디토리얼 브리핑.",
    "landing.signupCta": "무료로 시작하기",
    "landing.loginCta": "로그인",
    "landing.ctaNote": "신용카드 불필요 · 추적 없음 · 실시간 동기화",
    "landing.headerLogin": "로그인",
    "landing.headerSignup": "시작하기",
    "landing.principlesKicker": "브랜드 원칙",
    "landing.principlesHeading": "매일의 다섯 가지 의도.",
    "landing.principle1Title": "명료",
    "landing.principle1Body": "명료한 사고, 명료한 방향.",
    "landing.principle2Title": "집중",
    "landing.principle2Body": "한 번에 하나씩.",
    "landing.principle3Title": "진보",
    "landing.principle3Body": "작은 걸음이 큰 변화를 만든다.",
    "landing.principle4Title": "평온",
    "landing.principle4Body": "평온한 마음, 충실한 하루.",
    "landing.principle5Title": "빛",
    "landing.principle5Body": "앞으로 나아가게 하는 영감.",
    "landing.footerCredit": "© First Light · Next.js, Supabase, Tailwind로 제작",
    "landing.footerSource": "GitHub 소스 →",
    "sidebar.addTask": "작업 추가",
    "sidebar.search": "검색…",
    "sidebar.today": "오늘",
    "sidebar.tomorrow": "내일",
    "sidebar.next7": "향후 7일",
    "sidebar.inbox": "받은편지함",
    "sidebar.calendar": "캘린더",
    "sidebar.eisenhower": "취사",
    "sidebar.pomodoro": "집중",
    "sidebar.habits": "습관",
    "sidebar.weeklyReview": "주간 리뷰",
    "sidebar.lists": "목록",
    "sidebar.tags": "태그",
    "sidebar.noLists": "아직 목록이 없습니다.",
    "sidebar.noTags": "아직 태그가 없습니다 — 작업 제목에 #tagname 입력.",
    "sidebar.newList": "새 목록",
    "sidebar.logout": "로그아웃",
    "sidebar.next90": "향후 90일",
    "sidebar.completed": "완료",
    "view.next90.subtitle": "앞으로 90일 이내 마감 작업.",
    "view.completed.subtitle": "완료한 작업 — 최신순.",
    "email.subject": "리마인더 · {title}",
    "email.kicker": "FIRST LIGHT · 리마인더",
    "email.dueLabel": "기한",
    "email.openCta": "First Light에서 열기 →",
    "email.footer": "리마인더를 설정해 발송된 메일입니다. 설정에서 이메일 알림을 관리할 수 있습니다.",
    "email.unsubscribe": "리마인더 이메일 수신 거부",
    "sidebar.settings": "설정",
  
    /* common */
    "common.save": "저장",
    "common.cancel": "취소",
    "common.delete": "삭제",
    "common.confirm": "확인",
    "common.loading": "불러오는 중…",
    "common.add": "추가",
    "common.remove": "제거",
    "common.edit": "편집",
    "common.done": "완료",
    "common.yes": "예",
    "common.no": "아니요",
    "common.back": "뒤로",
    "common.next": "다음",
    "common.close": "닫기",
    "common.apply": "적용",
    "common.applyAll": "전체 적용",
    "common.skip": "건너뛰기",
    "common.tryAgain": "다시 시도",
    "common.aiDisabled": "AI 기능이 꺼져 있습니다.",
    "common.budgetReached": "오늘의 AI 사용량이 모두 소진되었습니다.",
    "common.unknown": "(알 수 없음)",
    /* view */
    "view.tomorrow.subtitle": "내일 일정.",
    "view.next7.subtitle": "앞으로 일주일 내 마감 작업.",
    "view.calendar.subtitle": "작업을 다른 날짜로 끌어 옮기세요.",
    "view.inbox.subtitle": "어떤 목록에도 속하지 않은 작업.",
    "view.habits.subtitle": "매일의 작은 한 걸음.",
    "view.settings.subtitle": "계정과 환경설정.",
    "view.tags.subtitle": "이 태그의 모든 작업.",
    "view.pomodoro.subtitle": "한 블록, 한 가지.",
    "view.matrix.subtitle": "긴급함과 중요함으로 분류.",
    "view.lists.subtitle": "이 목록의 작업.",
    /* empty */
    "empty.noTasks": "아직 작업이 없습니다.",
    "empty.nothingToShow": "표시할 항목이 없습니다.",
    "empty.pressQ": "q를 눌러 첫 작업을 추가하세요.",
    "empty.allClear": "전부 정리되었습니다.",
    "empty.noResults": "결과가 없습니다.",
    "empty.dropTasksHere": "여기에 작업을 놓으세요.",
    /* goal */
    "goal.title": "하나의 목표",
    "goal.intro": "이루고 싶은 목표를 적어 보세요. AI가 프로젝트와 순서대로 진행할 수 있는 작업들로 나눠 드립니다.",
    "goal.placeholder": "예: 11월 30일까지 Q4 런칭 완료, 이메일·SNS까지",
    "goal.planIt": "계획 짜기",
    "goal.planning": "계획 짜는 중…",
    "goal.cancel": "취소",
    "goal.back": "뒤로",
    "goal.cmdEnterHint": "로 계획",
    "goal.steps": "단계",
    "goal.projectLabel": "프로젝트",
    "goal.create": "만들기",
    "goal.creating": "만드는 중…",
    "goal.remove": "제거",
    "goal.todayLabel": "오늘",
    "goal.errBudget": "오늘의 목표 분해 사용량이 모두 소진되었습니다.",
    "goal.errPlan": "목표를 정리하지 못했습니다. 다시 시도해 주세요.",
    "goal.errCreate": "계획을 만들지 못했습니다",
    "goal.successAdded": "목표 완료: {n}개 추가",
    /* reflect */
    "reflect.title": "오늘을 돌아보며",
    "reflect.reading": "오늘을 살펴보는 중…",
    "reflect.carryHeading": "내일로 이월",
    "reflect.rollAll": "전부 이월 →",
    "reflect.rollOne": "내일로 이월",
    "reflect.dropHeading": "내려놓아도 좋은 것",
    "reflect.clearOne": "비우기",
    "reflect.notesHeading": "스스로에게 남기는 메모",
    "reflect.notesPlaceholder": "원한다면 오늘에 대한 한 문장.",
    "reflect.close": "닫기",
    "reflect.toastRolled": "내일로 이월했습니다",
    "reflect.toastCleared": "오늘에서 비웠습니다",
    "reflect.toastSaved": "저장됨",
    "reflect.errLoad": "회고를 불러오지 못했습니다",
    "reflect.errSaveJournal": "메모를 저장하지 못했습니다",
    /* retro */
    "retro.kicker": "주간 리뷰",
    "retro.thisWeek": "이번 주",
    "retro.lastWeek": "지난주",
    "retro.nextWeek": "다음 주",
    "retro.titleThisWeek": "이번 주, 지금까지",
    "retro.titleLastWeek": "지난주의 에디션",
    "retro.titleNextWeek": "다음 주 계획",
    "retro.updating": "업데이트 중…",
    "retro.empty": "이 서버에서는 AI 기능이 꺼져 있거나 이번 주 데이터가 아직 없습니다.",
    "retro.weekOf": "주간 시작",
    "retro.onCalendar": "캘린더에",
    "retro.scheduled": "예정됨",
    "retro.itemsOne": "건",
    "retro.itemsMany": "건",
    "retro.shipped": "완료",
    "retro.slipped": "미완료",
    "retro.themes": "주제",
    "retro.dropList": "내려놓아도 좋은 것",
    "retro.nextWeekPlan": "다음 주를 위해",
    "retro.allDay": "종일",
    /* procrastination */
    "procrastination.title": "멈춰 있는 항목",
    "procrastination.intro": "목록에서 움직임이 없던 항목.",
    "procrastination.scan": "백로그 스캔",
    "procrastination.scanning": "확인 중…",
    "procrastination.allClear": "전부 정리되었습니다.",
    "procrastination.errBudget": "이번 주 백로그 스캔 사용량이 모두 소진되었습니다.",
    "procrastination.errScan": "백로그를 확인하지 못했습니다.",
    "procrastination.verdictDrop": "내려놓기",
    "procrastination.verdictSchedule": "일정에 넣기",
    "procrastination.verdictBreak": "쪼개기",
    "procrastination.apply": "적용",
    "procrastination.skip": "건너뛰기",
    /* planDay */
    "planDay.button": "오늘 정리하기",
    "planDay.planning": "계획 짜는 중…",
    "planDay.title": "오늘",
    "planDay.reading": "오늘을 살펴보는 중…",
    "planDay.empty": "오늘은 비어 있습니다.",
    "planDay.allSet": "다 정리됐어요 — 오늘은 이걸로.",
    "planDay.applyAll": "전체 적용",
    "planDay.close": "닫기",
    "planDay.errBudget": "오늘 사용량이 모두 소진되었습니다. 내일 다시 시도해 주세요.",
    "planDay.errPlan": "오늘을 정리하지 못했습니다. 다시 시도해 주세요.",
    "planDay.toastApplied": "{n}개 적용했습니다.",
    /* todayAi */
    "todayAi.over": "초과",
    "todayAi.planned": "예정",
    "todayAi.clearOverdue": "지난 {n}건 정리",
    "todayAi.rescheduling": "다시 일정 잡는 중…",
    "todayAi.modalTitle": "일정 다시 잡기",
    "todayAi.reading": "백로그를 확인하는 중…",
    "todayAi.empty": "백로그가 비었습니다.",
    "todayAi.cleared": "백로그가 비었습니다.",
    "todayAi.applyAll": "전체 적용",
    "todayAi.close": "닫기",
    "todayAi.errBudget": "오늘의 일정 재조정 사용량이 모두 소진되었습니다.",
    "todayAi.errReschedule": "일정을 다시 잡지 못했습니다. 다시 시도해 주세요.",
    "todayAi.toastNothingOverdue": "지난 일 없음 — 좋습니다.",
    /* commandPalette */
    "commandPalette.placeholder": "작업, 목록, 태그 검색… 또는 AI에 묻기",
    "commandPalette.askAi": "AI에 묻기",
    "commandPalette.askAiHint": "AI로 다시 정렬 (Cmd/Ctrl+Enter)",
    "commandPalette.aiMatches": "AI 일치 항목",
    "commandPalette.tasks": "작업",
    "commandPalette.lists": "목록",
    "commandPalette.tags": "태그",
    "commandPalette.done": "완료",
    "commandPalette.noResults": "결과가 없습니다.",
    "commandPalette.errBudget": "검색 사용량이 모두 소진되었습니다.",
    "commandPalette.errSearch": "AI 검색을 실행하지 못했습니다.",
    /* quickAdd */
    "quickAdd.kicker": "빠른 추가",
    "quickAdd.placeholder": "작업 추가 — 입력 또는 음성으로",
    "quickAdd.scanTitle": "사진이나 스크린샷에서 작업 읽어오기",
    "quickAdd.scanAria": "이미지에서 작업 읽어오기",
    "quickAdd.chipTime": "시간",
    "quickAdd.chipRepeat": "반복",
    "quickAdd.chipReminder": "리마인더",
    "quickAdd.chipPriority": "우선순위",
    "quickAdd.chipInbox": "받은편지함",
    "quickAdd.chipTag": "태그",
    "quickAdd.priorityHigh": "높음",
    "quickAdd.priorityMedium": "보통",
    "quickAdd.priorityLow": "낮음",
    "quickAdd.priorityNone": "없음",
    "quickAdd.repeatDaily": "매일",
    "quickAdd.repeatWeekdays": "평일",
    "quickAdd.repeatWeekly": "매주",
    "quickAdd.repeatMonthly": "매월",
    "quickAdd.repeatYearly": "매년",
    "quickAdd.repeatRepeats": "반복",
    "quickAdd.timeToday": "오늘",
    "quickAdd.timeTomorrow": "내일",
    "quickAdd.miniSiftCaption": "취사 · 클릭하여 적용",
    "quickAdd.q1": "먼저 하기",
    "quickAdd.q2": "일정 잡기",
    "quickAdd.q3": "위임",
    "quickAdd.q4": "버리기",
    "quickAdd.tagsHelpPrefix": "입력란에",
    "quickAdd.tagsHelpSuffix": "「#tagname」 입력 — 커서 위치에 「#」 삽입",
    "quickAdd.cancel": "취소",
    "quickAdd.enterToAdd": "Enter로 추가 · Esc로 닫기",
    /* taskPanel */
    "taskPanel.markComplete": "완료로 표시",
    "taskPanel.markIncomplete": "미완료로 표시",
    "taskPanel.delete": "삭제",
    "taskPanel.close": "닫기",
    "taskPanel.done": "완료",
    "taskPanel.titlePlaceholder": "작업 제목",
    "taskPanel.starts": "시작",
    "taskPanel.ends": "종료",
    "taskPanel.due": "마감",
    "taskPanel.startPlaceholder": "시작 시간 선택",
    "taskPanel.duePlaceholder": "마감 시간 선택",
    "taskPanel.repeat": "반복",
    "taskPanel.recurNone": "반복 안 함",
    "taskPanel.recurDaily": "매일",
    "taskPanel.recurEveryOtherDay": "이틀마다",
    "taskPanel.recurWeekdays": "평일(월~금)",
    "taskPanel.recurWeekends": "주말",
    "taskPanel.recurWeekly": "매주",
    "taskPanel.recurEveryOtherWeek": "격주",
    "taskPanel.recurMonthly": "매월",
    "taskPanel.recurEveryThreeMonths": "3개월마다",
    "taskPanel.recurYearly": "매년",
    "taskPanel.recurCustom": "사용자 지정",
    "taskPanel.recurNeedsDue": "마감일을 설정해 주세요 — 완료 시 다음 일정이 자동으로 만들어집니다.",
    "taskPanel.reminder": "리마인더",
    "taskPanel.reminderHelp": "앱이 열려 있을 때 해당 시각에 브라우저가 알려드립니다. 알림 권한을 허용해 주세요.",
    "taskPanel.priority": "우선순위",
    "taskPanel.list": "목록",
    "taskPanel.inboxNoList": "받은편지함(목록 없음)",
    "taskPanel.shareGroup": "그룹과 공유",
    "taskPanel.privateOnly": "비공개 — 나만",
    "taskPanel.manageGroups": "그룹 관리 →",
    "taskPanel.assignedTo": "담당자",
    "taskPanel.unassigned": "지정 안 됨",
    "taskPanel.tags": "태그",
    "taskPanel.subtasks": "하위 작업",
    "taskPanel.attachments": "첨부",
    "taskPanel.aiShortcuts": "AI 단축키",
    "taskPanel.notes": "메모",
    "taskPanel.notesPlaceholder": "메모 추가…",
    "taskPanel.created": "생성",
    "taskPanel.updated": "수정",
    /* scan */
    "scan.kicker": "작업 읽어오기",
    "scan.title": "사진을 읽어 할 일을 꺼내세요.",
    "scan.takePhoto": "사진 찍기",
    "scan.takePhotoHint": "포스트잇, 화이트보드, 캘린더",
    "scan.uploadImage": "이미지 업로드",
    "scan.uploadImageHint": "스크린샷, 사진 라이브러리에서",
    "scan.reading": "이미지 읽는 중…",
    "scan.foundOne": "{n}개 작업을 찾았습니다. 편집·체크 해제 또는 추가를 누르세요.",
    "scan.foundMany": "{n}개 작업을 찾았습니다. 편집·체크 해제 또는 추가를 누르세요.",
    "scan.unreadable": "읽을 수 없습니다. 더 또렷한 사진으로 시도해 주세요.",
    "scan.removeImage": "이미지 제거",
    "scan.cancel": "취소",
    "scan.adding": "추가 중…",
    "scan.addOne": "{n}개 추가",
    "scan.addMany": "{n}개 추가",
    "scan.errNotImage": "이미지가 아닙니다",
    "scan.errTooLarge": "이미지가 너무 큽니다 — 6MB 이하로 해주세요",
    "scan.errAiOff": "AI가 꺼져 있습니다 — ANTHROPIC_API_KEY를 설정해 주세요",
    "scan.errNoTasks": "이 이미지에서 작업을 찾지 못했습니다",
    "scan.errFailed": "스캔 실패",
    "scan.toastAddedOne": "1개 추가했습니다",
    "scan.toastAddedMany": "{n}개 추가했습니다",
    /* members */
    "members.shareTitle": "「{name}」 공유",
    "members.shareIntro": "이메일로 초대하세요. 목록과 작업을 실시간으로 공유합니다.",
    "members.invitePlaceholder": "someone@example.com",
    "members.invite": "초대",
    "members.invited": "…",
    "members.heading": "멤버",
    "members.empty": "아직 멤버가 없습니다.",
    "members.remove": "제거",
    "members.ownerOnly": "목록 소유자만 멤버를 초대하거나 제거할 수 있습니다.",
    "members.toastAdded": "추가됨",
    "members.roleOwner": "소유자",
    "members.roleMember": "멤버",
    /* createProject */
    "createProject.title": "새 목록",
    "createProject.intro": "비슷한 작업을 모아두는 공간.",
    "createProject.namePlaceholder": "예: 일, 독서, 스튜디오",
    "createProject.colorLabel": "색상",
    "createProject.cancel": "취소",
    "createProject.create": "만들기",
    "createProject.creating": "만드는 중…",
    "createProject.toastCreated": "「{name}」 만들었습니다",
    "createProject.errCreate": "목록을 만들지 못했습니다",
    /* dailyEdition */
    "dailyEdition.errLoad": "Daily Edition을 불러오지 못했습니다.",
    "dailyEdition.tryAgain": "다시 시도",
    "dailyEdition.regenerate": "오늘의 에디션 재생성",
    "dailyEdition.regenAria": "오늘의 에디션 재생성",
    "dailyEdition.readMore": "더 읽기",
    /* kanban */
    "kanban.priorityHigh": "높음",
    "kanban.priorityMedium": "보통",
    "kanban.priorityLow": "낮음",
    "kanban.priorityNone": "없음",
    "kanban.dropHere": "여기에 작업을 놓으세요.",
    "kanban.quickAdd": "빠른 추가",
    /* shared */
    "shared.quickAdd": "빠른 추가",
    "shared.untitled": "(제목 없음)",
  },
};

/**
 * Runtime override map populated by <I18nOverridesBootstrap/> from
 * site_content. Allows /admin/content (and inline-edit in /admin/design)
 * to surface translation overrides without a redeploy.
 *
 * Shape: overrides[locale][key] = "Custom translated string"
 */
const overrides: Partial<Record<LanguageCode, Record<string, string>>> = {};

export function setI18nOverrides(
  locale: LanguageCode,
  map: Record<string, string>
): void {
  overrides[locale] = map;
}

export function t(language: string | null | undefined, key: StringKey): string {
  const code = (LANGUAGES.find((l) => l.code === language)?.code ??
    DEFAULT_LANGUAGE) as LanguageCode;
  const localeOverrides = overrides[code];
  if (localeOverrides && localeOverrides[key]) return localeOverrides[key];
  return STRINGS[code][key] ?? STRINGS.en[key] ?? key;
}

/**
 * Returns the full hardcoded string map for the given locale. Used by
 * the Admin Content CMS to render the default-value column alongside
 * editable overrides. Falls back to English when the locale is unknown.
 */
export function getTranslations(
  language: string | null | undefined
): Record<StringKey, string> {
  const code = (LANGUAGES.find((l) => l.code === language)?.code ??
    DEFAULT_LANGUAGE) as LanguageCode;
  return STRINGS[code];
}

/* ----------------------------------------------------------------- */
/* localStorage-backed pre-login language preference.                */
/* ----------------------------------------------------------------- */

const LS_KEY = "fl.language";

export function readStoredLanguage(): LanguageCode {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE;
  try {
    const v = window.localStorage.getItem(LS_KEY);
    if (v && LANGUAGES.some((l) => l.code === v)) return v as LanguageCode;
  } catch {}
  // Fall back to browser language if it matches one of ours.
  if (typeof navigator !== "undefined") {
    const nav = navigator.language;
    if (nav?.startsWith("zh-TW") || nav?.startsWith("zh-Hant")) return "zh-TW";
    if (nav?.startsWith("zh"))     return "zh-CN";
    if (nav?.startsWith("ja"))     return "ja";
    if (nav?.startsWith("ko"))     return "ko";
  }
  return DEFAULT_LANGUAGE;
}

export function writeStoredLanguage(code: LanguageCode) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LS_KEY, code);
    // localStorage 'storage' events don't fire in the same tab, so we
    // broadcast a custom event for in-tab subscribers (useLanguage).
    window.dispatchEvent(new CustomEvent("fl.language.change", { detail: code }));
  } catch {}
}
