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

export type StringKey =
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
  | "view.today.heading"
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
  | "sidebar.notes"
  | "sidebar.features"
  | "view.next90.subtitle"
  | "view.bucket.noDate"
  | "view.completed.subtitle"
  | "sidebar.settings"
  | "sidebar.groups"
  | "sidebar.goals"
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
  | "dailyEdition.rateLimited"
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
  | "shared.untitled"
  | "view.matrix.title"
  | "view.matrix.dragHint"
  | "view.matrix.planWeek"
  | "view.matrix.planning"
  | "view.matrix.q1Label"
  | "view.matrix.q1Subtitle"
  | "view.matrix.q2Label"
  | "view.matrix.q2Subtitle"
  | "view.matrix.q3Label"
  | "view.matrix.q3Subtitle"
  | "view.matrix.q4Label"
  | "view.matrix.q4Subtitle"
  | "view.matrix.dropHere"
  | "view.matrix.yourWeek"
  | "view.matrix.itemsOne"
  | "view.matrix.itemsMany"
  | "view.matrix.readingList"
  | "view.matrix.allClear"
  | "view.matrix.applyTitle"
  | "view.matrix.skipTitle"
  | "view.matrix.planAria"
  | "view.matrix.toastNoTasks"
  | "view.matrix.errBudget"
  | "view.matrix.errPlan"
  | "view.matrix.appliedOne"
  | "view.matrix.appliedMany"
  | "view.pomodoro.sessionsToday"
  | "view.pomodoro.modeFocus"
  | "view.pomodoro.modeShortBreak"
  | "view.pomodoro.modeLongBreak"
  | "view.pomodoro.start"
  | "view.pomodoro.pause"
  | "view.pomodoro.reset"
  | "view.pomodoro.stop"
  | "view.pomodoro.workingOn"
  | "view.pomodoro.noneOption"
  | "view.pomodoro.toastFocusComplete"
  | "view.pomodoro.toastBreakDone"
  | "view.habits.thisWeek"
  | "view.habits.lastWeek"
  | "view.habits.nextWeekRange"
  | "view.habits.weekRange"
  | "view.habits.aria.prevWeek"
  | "view.habits.aria.nextWeek"
  | "view.habits.aria.thisWeek"
  | "view.habits.streakHeader"
  | "view.habits.emptyText"
  | "view.habits.emptyHint"
  | "view.habits.intro"
  | "view.habits.newHabit"
  | "view.habits.newHabitCta"
  | "view.habits.namePlaceholder"
  | "view.habits.create"
  | "view.habits.tooltipLogged"
  | "view.habits.tooltipLog"
  | "view.habits.streakDays"
  | "view.habits.noStreak"
  | "view.habits.deleteAria"
  | "view.habits.deleteTitle"
  | "view.habits.deleteConfirm"
  | "view.settings.heading"
  | "view.settings.subheader"
  | "view.settings.section.account"
  | "view.settings.section.language"
  | "view.settings.section.dayCapacity"
  | "view.settings.section.aiFeatures"
  | "view.settings.section.notifications"
  | "view.settings.section.calendarSync"
  | "view.settings.section.inbox"
  | "view.settings.inbox.description"
  | "view.settings.inbox.address"
  | "view.settings.inbox.generate"
  | "view.settings.inbox.generating"
  | "view.settings.inbox.rotate"
  | "view.settings.inbox.rotateConfirm"
  | "view.settings.inbox.copy"
  | "view.settings.inbox.copied"
  | "view.settings.inbox.copyAria"
  | "view.settings.inbox.lastReceived"
  | "view.settings.inbox.noEmails"
  | "view.settings.inbox.toast.generated"
  | "view.settings.inbox.toast.rotated"
  | "view.settings.inbox.toast.copyFailed"
  | "view.settings.section.import"
  | "view.settings.section.yourData"
  | "view.settings.section.danger"
  | "view.settings.section.legal"
  | "view.settings.row.name"
  | "view.settings.row.email"
  | "view.settings.row.session"
  | "view.settings.row.signOut"
  | "view.settings.row.displayLanguage"
  | "view.settings.row.dailyCapacity"
  | "view.settings.row.energyPeak"
  | "view.settings.row.to"
  | "view.settings.row.minutesPerDay"
  | "view.settings.row.from"
  | "view.settings.row.file"
  | "view.settings.row.export"
  | "view.settings.row.documents"
  | "view.settings.row.deleteAccount"
  | "view.settings.row.subscribe"
  | "view.settings.langHelp"
  | "view.settings.toggle.aiEnabled"
  | "view.settings.toggle.aiEnabledHint"
  | "view.settings.toggle.dailyEdition"
  | "view.settings.toggle.dailyEditionHint"
  | "view.settings.toggle.smartEisenhower"
  | "view.settings.toggle.smartEisenhowerHint"
  | "view.settings.toggle.voiceCapture"
  | "view.settings.toggle.voiceCaptureHint"
  | "view.settings.toggle.emailReminders"
  | "view.settings.toggle.emailRemindersHint"
  | "view.settings.toggle.dailyDigest"
  | "view.settings.toggle.dailyDigestHint"
  | "view.settings.toggle.emailBroadcasts"
  | "view.settings.toggle.emailBroadcastsHint"
  | "view.settings.toggle.pushNotifications"
  | "view.settings.toggle.pushHint"
  | "view.settings.toggle.pushUnsupported"
  | "view.settings.toast.nameUpdated"
  | "view.settings.toast.couldntSave"
  | "view.settings.toast.pushOn"
  | "view.settings.toast.pushOff"
  | "view.settings.toast.pushBlocked"
  | "view.settings.toast.pushUnsupported"
  | "view.settings.toast.pushFailed"
  | "view.settings.toast.exportDownloaded"
  | "view.settings.toast.couldntExport"
  | "view.settings.toast.importedOne"
  | "view.settings.toast.importedMany"
  | "view.settings.toast.importFailed"
  | "view.settings.toast.typeEmail"
  | "view.settings.toast.accountDeleted"
  | "view.settings.toast.couldntDelete"
  | "view.settings.toast.calEnabled"
  | "view.settings.toast.calDisabled"
  | "view.settings.toast.calRotated"
  | "view.settings.toast.calCopied"
  | "view.settings.toast.calEnableErr"
  | "view.settings.toast.calRotateErr"
  | "view.settings.toast.calDisableErr"
  | "view.settings.delete.button"
  | "view.settings.delete.warning"
  | "view.settings.delete.confirmCancel"
  | "view.settings.delete.confirmAction"
  | "view.settings.import.format.ticktick"
  | "view.settings.import.format.todoist"
  | "view.settings.import.format.ics"
  | "view.settings.import.format.generic"
  | "view.settings.import.importing"
  | "view.settings.import.help"
  | "view.settings.exportButton"
  | "view.settings.exportHelp"
  | "view.settings.cal.loading"
  | "view.settings.cal.copy"
  | "view.settings.cal.copied"
  | "view.settings.cal.copyAria"
  | "view.settings.cal.rotate"
  | "view.settings.cal.disable"
  | "view.settings.cal.enable"
  | "view.settings.cal.generating"
  | "view.settings.cal.howSubscribe"
  | "view.settings.cal.body"
  | "view.settings.cal.androidNote"
  | "view.settings.cal.notifBlocked.title"
  | "view.settings.cal.notifBlocked.body"
  | "view.settings.privacyPolicy"
  | "view.settings.termsOfService"
  | "view.settings.placeholder.yourName"
  | "view.groups.heading"
  | "view.groups.subtitle"
  | "view.groups.namePlaceholder"
  | "view.groups.create"
  | "view.groups.pendingInvites"
  | "view.groups.unknownGroup"
  | "view.groups.accept"
  | "view.groups.decline"
  | "view.groups.approveSend"
  | "view.groups.revoke"
  | "view.groups.awaiting"
  | "view.groups.needsApproval"
  | "view.groups.yourGroups"
  | "view.groups.noGroups"
  | "view.groups.loading"
  | "view.groups.roleOwner"
  | "view.groups.roleMember"
  | "view.groups.unknownMember"
  | "view.groups.inviteMember"
  | "view.groups.rename"
  | "view.groups.delete"
  | "view.groups.send"
  | "view.groups.cancel"
  | "view.groups.save"
  | "view.groups.invitePlaceholder"
  | "view.groups.groupPlaceholder"
  | "view.groups.deleteConfirm"
  | "view.groups.toast.inviteCreated"
  | "view.groups.toast.inviteFailed"
  | "view.groups.toast.createFailed"
  | "view.groups.toast.deleteFailed"
  | "view.groups.toast.renameFailed"
  | "view.groups.toast.actionFailed"
  | "view.groups.toast.couldntInvite"
  | "view.groups.toast.renamed"
  | "view.groups.toast.deleted"
  | "view.groups.toast.approved"
  | "view.groups.toast.revoked"
  | "view.groups.toast.declined"
  | "view.groups.toast.joined"
  | "view.groups.toast.acceptShort"
  | "view.groups.toast.approveShort"
  | "view.groups.toast.declineShort"
  | "view.groups.toast.revokeShort"
  | "view.groups.actionApprove"
  | "view.groups.actionDecline"
  | "view.groups.actionAccept"
  | "view.groups.actionRevoke"
  | "view.calendar.today"
  | "view.calendar.weekday.mon"
  | "view.calendar.weekday.tue"
  | "view.calendar.weekday.wed"
  | "view.calendar.weekday.thu"
  | "view.calendar.weekday.fri"
  | "view.calendar.weekday.sat"
  | "view.calendar.weekday.sun"
  | "view.calendar.aria.prevDay"
  | "view.calendar.aria.nextDay"
  | "view.calendar.openDay"
  | "view.calendar.nothingScheduled"
  | "view.calendar.completedCount"
  | "sidebar.notifications"
  | "sidebar.notifications.aria"
  | "sidebar.notifications.markAllRead"
  | "sidebar.notifications.markRead"
  | "sidebar.notifications.dismiss"
  | "sidebar.notifications.allCaught"
  | "aiActions.findTimeTooltip"
  | "aiActions.prepMeetingTooltip"
  | "aiActions.estimatedTooltip"
  | "aiActions.scheduleTooltip"
  | "antiOverload.full"
  | "attachments.dropHere"
  | "attachments.loading"
  | "attachments.deleteAria"
  | "attachments.delete"
  | "dateTimePicker.pick"
  | "dateTimePicker.prevMonth"
  | "dateTimePicker.nextMonth"
  | "dayTimeline.allDay"
  | "inlineTaskInput.enterHint"
  | "languagePicker.choose"
  | "quickAdd.exampleTomorrow9am"
  | "quickAdd.exampleEveryMonday"
  | "quickAdd.exampleRemind30m"
  | "quickAdd.kbHint"
  | "reminders.enable"
  | "tagItem.color"
  | "tagItem.changeColor"
  | "tagItem.deleteTag"
  | "sidebar.reflect"
  | "sidebar.toggle"
  | "sidebar.planGoal"
  | "sidebar.reflectAria"
  | "sidebar.toggleTheme"
  | "subtasks.loading"
  | "subtasks.newPlaceholder"
  | "subtasks.deleteAria"
  | "tagEditor.colorHint"
  | "taskItem.repeats"
  | "taskItem.subtasks"
  | "taskItem.estimated"
  | "taskList.sortByDate"
  | "taskList.loading"
  | "taskList.emptyHint"
  | "taskList.revertSort"
  | "view.list.shareAria"
  | "view.list.kanbanHint"
  | "view.tag.subtitle"
  /* ribbon */
  | "ribbon.streak"
  | "ribbon.habits"
  | "ribbon.q1"
  /* comments */
  | "comments.header"
  | "comments.placeholder"
  | "comments.send"
  | "comments.edit"
  | "comments.delete"
  | "comments.cancel"
  | "comments.save"
  | "comments.empty"
  | "comments.loading"
  | "comments.deleteConfirm"
  | "comments.editedSuffix"
  /* group activity */
  | "activity.title"
  | "activity.subtitle"
  | "activity.empty"
  | "activity.loading"
  | "activity.link"
  | "activity.kind.taskCreated"
  | "activity.kind.taskCompleted"
  | "activity.kind.taskReopened"
  | "activity.kind.taskAssigned"
  | "activity.kind.taskShared"
  | "activity.kind.taskDeleted"
  | "activity.kind.taskCommented"
  /* morning copilot — round E */
  | "copilot.kickerSuffix"
  | "copilot.askLabel"
  | "copilot.askApply"
  | "copilot.askSkip"
  | "copilot.actionsLabel"
  | "copilot.actionDefer"
  | "copilot.actionDrop"
  | "copilot.actionBatch"
  | "copilot.actionReschedule"
  | "copilot.snooze"
  | "copilot.dismiss"
  | "copilot.apply"
  | "copilot.applying"
  | "copilot.empty"
  | "copilot.errLoad"
  | "copilot.tryAgain"
  | "copilot.appliedToast"
  | "view.settings.section.gcal"
  | "view.settings.gcal.description"
  | "view.settings.gcal.connect"
  | "view.settings.gcal.connectedAs"
  | "view.settings.gcal.lastSync"
  | "view.settings.gcal.lastSyncRelative"
  | "view.settings.gcal.never"
  | "view.settings.gcal.syncNow"
  | "view.settings.gcal.syncing"
  | "view.settings.gcal.disconnect"
  | "view.settings.gcal.disconnectConfirm"
  | "view.settings.gcal.connectErrPrefix"
  | "view.settings.gcal.toast.connected"
  | "view.settings.gcal.toast.synced"
  | "view.settings.gcal.toast.syncErr"
  | "view.settings.gcal.toast.disconnected"
  | "view.settings.gcal.toast.disconnectErr"
  | "view.gcal.chip.allDay"
  | "view.gcal.chip.untitled"
  | "view.today.events.heading";

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
    "landing.footerCredit": "© 2026 First Light. All rights reserved.",
    "landing.footerSource": "Source on GitHub →",
    "sidebar.addTask": "Add task",
    "sidebar.search": "Search…",
    "sidebar.today": "Today",
    "view.today.heading": "Today's Agenda",
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
    "sidebar.notes": "Notes",
    "sidebar.features": "Features",
    "view.next90.subtitle": "Tasks due in the next 90 days.",
    "view.bucket.noDate": "No date",
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
    "view.inbox.subtitle": "Every active task, across every list.",
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
    "retro.titleLastWeek": "Last week, in review",
    "retro.titleNextWeek": "Next week, ahead",
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
    "dailyEdition.rateLimited": "You've hit today's AI cap. The Daily Edition will be back tomorrow.",
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
    "view.matrix.title": "The Sift",
    "view.matrix.dragHint": "Drag tasks between quadrants to change urgency × importance.",
    "view.matrix.planWeek": "Plan my week",
    "view.matrix.planning": "Planning…",
    "view.matrix.q1Label": "Do first",
    "view.matrix.q1Subtitle": "Urgent · Important",
    "view.matrix.q2Label": "Schedule",
    "view.matrix.q2Subtitle": "Not urgent · Important",
    "view.matrix.q3Label": "Delegate",
    "view.matrix.q3Subtitle": "Urgent · Not important",
    "view.matrix.q4Label": "Eliminate",
    "view.matrix.q4Subtitle": "Not urgent · Not important",
    "view.matrix.dropHere": "Drop tasks here.",
    "view.matrix.yourWeek": "Your week",
    "view.matrix.itemsOne": "item",
    "view.matrix.itemsMany": "items",
    "view.matrix.readingList": "Reading the whole list…",
    "view.matrix.allClear": "All clear — your week is already on track.",
    "view.matrix.applyTitle": "Apply",
    "view.matrix.skipTitle": "Skip",
    "view.matrix.planAria": "AI plans the next 7 days as a coherent whole",
    "view.matrix.toastNoTasks": "No open tasks to plan in the next 7 days.",
    "view.matrix.errBudget": "Daily plan-week budget reached. Try again tomorrow.",
    "view.matrix.errPlan": "Couldn't plan your week — try again.",
    "view.matrix.appliedOne": "Applied {n} suggestion.",
    "view.matrix.appliedMany": "Applied {n} suggestions.",
    "view.pomodoro.sessionsToday": "{n} focus sessions today.",
    "view.pomodoro.modeFocus": "Focus",
    "view.pomodoro.modeShortBreak": "Short break",
    "view.pomodoro.modeLongBreak": "Long break",
    "view.pomodoro.start": "Start",
    "view.pomodoro.pause": "Pause",
    "view.pomodoro.reset": "Reset",
    "view.pomodoro.stop": "Stop",
    "view.pomodoro.workingOn": "Working on",
    "view.pomodoro.noneOption": "— None —",
    "view.pomodoro.toastFocusComplete": "Focus complete — take a break!",
    "view.pomodoro.toastBreakDone": "Break done — back to focus.",
    "view.habits.thisWeek": "This week · {range}",
    "view.habits.lastWeek": "Last week · {range}",
    "view.habits.nextWeekRange": "Next week · {range}",
    "view.habits.weekRange": "{range}",
    "view.habits.aria.prevWeek": "Previous week",
    "view.habits.aria.nextWeek": "Next week",
    "view.habits.aria.thisWeek": "This week",
    "view.habits.streakHeader": "Streak",
    "view.habits.emptyText": "No habits yet. Tap New habit to add one — try \"Read 20 min\", \"Meditate\", or \"Drink 8 cups water\".",
    "view.habits.emptyHint": "Click any day cell to log a completion. Future days stay locked.",
    "view.habits.intro": "A habit is a tiny daily action you want to keep showing up for. Log each day you complete it; the streak resets only when you skip a day. Click </ > above to review past or upcoming weeks.",
    "view.habits.newHabit": "New habit",
    "view.habits.newHabitCta": "+ New habit",
    "view.habits.namePlaceholder": "e.g. Read 20 minutes",
    "view.habits.create": "Create",
    "view.habits.tooltipLogged": "Logged {date} — click to remove",
    "view.habits.tooltipLog": "Click to log {date}",
    "view.habits.streakDays": "{n} day streak",
    "view.habits.noStreak": "No active streak",
    "view.habits.deleteAria": "Delete habit {name}",
    "view.habits.deleteTitle": "Delete habit \"{name}\"",
    "view.habits.deleteConfirm": "Delete habit \"{name}\"? This hides it from the list. Past logs are preserved.",
    "view.settings.heading": "Settings",
    "view.settings.subheader": "Account, preferences, and data.",
    "view.settings.section.account": "Account",
    "view.settings.section.language": "Language",
    "view.settings.section.dayCapacity": "Day capacity",
    "view.settings.section.aiFeatures": "AI features",
    "view.settings.section.notifications": "Notifications",
    "view.settings.section.calendarSync": "Calendar sync",
    "view.settings.section.inbox": "Email to task",
    "view.settings.inbox.description": "Forward any email to this address — the subject becomes the task title and the body becomes the notes.",
    "view.settings.inbox.address": "Address",
    "view.settings.inbox.generate": "Generate address",
    "view.settings.inbox.generating": "Generating…",
    "view.settings.inbox.rotate": "Rotate",
    "view.settings.inbox.rotateConfirm": "Rotate the address? The old one will stop working immediately.",
    "view.settings.inbox.copy": "Copy",
    "view.settings.inbox.copied": "Copied",
    "view.settings.inbox.copyAria": "Copy address",
    "view.settings.inbox.lastReceived": "Last received {time}",
    "view.settings.inbox.noEmails": "No emails received yet.",
    "view.settings.inbox.toast.generated": "Address generated",
    "view.settings.inbox.toast.rotated": "Address rotated — the old one no longer works",
    "view.settings.inbox.toast.copyFailed": "Couldn't copy — please copy manually",
    "view.settings.section.import": "Import",
    "view.settings.section.yourData": "Your data",
    "view.settings.section.danger": "Danger zone",
    "view.settings.section.legal": "Legal",
    "view.settings.row.name": "Name",
    "view.settings.row.email": "Email",
    "view.settings.row.session": "Session",
    "view.settings.row.signOut": "Sign out",
    "view.settings.row.displayLanguage": "Display language",
    "view.settings.row.dailyCapacity": "Daily capacity",
    "view.settings.row.energyPeak": "Energy peak",
    "view.settings.row.to": "to",
    "view.settings.row.minutesPerDay": "minutes / day",
    "view.settings.row.from": "From",
    "view.settings.row.file": "File",
    "view.settings.row.export": "Export",
    "view.settings.row.documents": "Documents",
    "view.settings.row.deleteAccount": "Delete account",
    "view.settings.row.subscribe": "Subscribe",
    "view.settings.langHelp": "UI labels, AI-generated briefings, and date formats follow this language.",
    "view.settings.toggle.aiEnabled": "AI enabled",
    "view.settings.toggle.aiEnabledHint": "Master switch — turn off to disable everything below.",
    "view.settings.toggle.dailyEdition": "Daily Edition briefing",
    "view.settings.toggle.dailyEditionHint": "Editorial morning brief on the Today page.",
    "view.settings.toggle.smartEisenhower": "Smart Eisenhower auto-suggest",
    "view.settings.toggle.smartEisenhowerHint": "AI · suggest button on the matrix proposes moves.",
    "view.settings.toggle.voiceCapture": "Voice capture",
    "view.settings.toggle.voiceCaptureHint": "Microphone button on every Add Task input.",
    "view.settings.toggle.emailReminders": "Email reminders",
    "view.settings.toggle.emailRemindersHint": "When a task's reminder time is reached, send an email to your inbox.",
    "view.settings.toggle.dailyDigest": "Daily digest email",
    "view.settings.toggle.dailyDigestHint": "A short editorial brief at 7am: today's priorities, overdue items, and your streak.",
    "view.settings.toggle.emailBroadcasts": "Product updates & announcements",
    "view.settings.toggle.emailBroadcastsHint": "Occasional emails about new features, tips, and important updates. You can turn this off in Settings anytime.",
    "view.settings.toggle.pushNotifications": "Push notifications",
    "view.settings.toggle.pushHint": "Browser-native notifications even when the tab is closed. (PWA recommended on iOS.)",
    "view.settings.toggle.pushUnsupported": "Not supported on this device or browser.",
    "view.settings.toast.nameUpdated": "Name updated",
    "view.settings.toast.couldntSave": "Couldn't save",
    "view.settings.toast.pushOn": "Push notifications on",
    "view.settings.toast.pushOff": "Push notifications off",
    "view.settings.toast.pushBlocked": "Browser blocked notifications. See the hint below.",
    "view.settings.toast.pushUnsupported": "Push isn't supported on this device",
    "view.settings.toast.pushFailed": "Couldn't subscribe to push",
    "view.settings.toast.exportDownloaded": "Export downloaded",
    "view.settings.toast.couldntExport": "Couldn't export",
    "view.settings.toast.importedOne": "Imported {n} task",
    "view.settings.toast.importedMany": "Imported {n} tasks",
    "view.settings.toast.importFailed": "Import failed",
    "view.settings.toast.typeEmail": "Type your email to confirm",
    "view.settings.toast.accountDeleted": "Account deleted",
    "view.settings.toast.couldntDelete": "Couldn't delete",
    "view.settings.toast.calEnabled": "Calendar subscription enabled",
    "view.settings.toast.calDisabled": "Subscription disabled",
    "view.settings.toast.calRotated": "New URL minted",
    "view.settings.toast.calCopied": "Couldn't copy — please copy manually",
    "view.settings.toast.calEnableErr": "Couldn't enable subscription",
    "view.settings.toast.calRotateErr": "Couldn't rotate URL",
    "view.settings.toast.calDisableErr": "Couldn't disable subscription",
    "view.settings.delete.button": "Delete my account",
    "view.settings.delete.warning": "This permanently removes your account, every task, every list, every attachment, every AI edition. It can't be undone. Type your email to confirm.",
    "view.settings.delete.confirmCancel": "Cancel",
    "view.settings.delete.confirmAction": "Delete forever",
    "view.settings.import.format.ticktick": "TickTick CSV",
    "view.settings.import.format.todoist": "Todoist CSV",
    "view.settings.import.format.ics": "Apple Reminders / Calendar (.ics)",
    "view.settings.import.format.generic": "Generic CSV (title, due, list, completed)",
    "view.settings.import.importing": "Importing…",
    "view.settings.import.help": "Up to 1,000 rows per upload. Existing tasks aren't touched; imports are added on top.",
    "view.settings.exportButton": "Download as JSON",
    "view.settings.exportHelp": "A complete copy of your tasks, lists, tags, habits, Pomodoro sessions, attachments, and AI editions/retros. Used for portability and GDPR access requests.",
    "view.settings.cal.loading": "Loading…",
    "view.settings.cal.copy": "Copy",
    "view.settings.cal.copied": "Copied",
    "view.settings.cal.copyAria": "Copy URL",
    "view.settings.cal.rotate": "Rotate URL",
    "view.settings.cal.disable": "Disable",
    "view.settings.cal.enable": "Enable calendar subscription",
    "view.settings.cal.generating": "Generating…",
    "view.settings.cal.howSubscribe": "How to subscribe",
    "view.settings.cal.body": "Read-only feed. Apple Calendar, Google Calendar, Outlook, and any other ICS-compatible app can subscribe — your tasks and meetings will appear alongside your other calendars and refresh automatically (typically every 15 minutes to a few hours, depending on the app). Edits made in those calendars don't flow back to First Light. Two-way Google Calendar sync is on the roadmap.",
    "view.settings.cal.androidNote": "On Android, subscribe in Google Calendar (web) — your phone's calendar will pick it up automatically through your Google account.",
    "view.settings.cal.notifBlocked.title": "Notifications are blocked for this site.",
    "view.settings.cal.notifBlocked.body": "Click the lock icon left of the URL → Site settings → set Notifications to Allow, then reload the page and toggle this on again.",
    "view.settings.privacyPolicy": "Privacy Policy",
    "view.settings.termsOfService": "Terms of Service",
    "view.settings.placeholder.yourName": "Your name",
    "view.groups.heading": "Groups",
    "sidebar.groups": "Groups",
    "sidebar.goals": "Goals",
    "view.groups.subtitle": "Share tasks with people you trust. Owners approve every invite before it goes out.",
    "view.groups.namePlaceholder": "New group name",
    "view.groups.create": "Create",
    "view.groups.pendingInvites": "Pending invites ({n})",
    "view.groups.unknownGroup": "(unknown group)",
    "view.groups.accept": "Accept",
    "view.groups.decline": "Decline",
    "view.groups.approveSend": "Approve & send",
    "view.groups.revoke": "Revoke",
    "view.groups.awaiting": "Awaiting acceptance — ",
    "view.groups.needsApproval": "Needs your approval — ",
    "view.groups.yourGroups": "Your groups",
    "view.groups.noGroups": "No groups yet — create one above.",
    "view.groups.loading": "Loading…",
    "view.groups.roleOwner": "owner",
    "view.groups.roleMember": "member",
    "view.groups.unknownMember": "(unknown)",
    "view.groups.inviteMember": "Invite member",
    "view.groups.rename": "Rename",
    "view.groups.delete": "Delete",
    "view.groups.send": "Send",
    "view.groups.cancel": "Cancel",
    "view.groups.save": "Save",
    "view.groups.invitePlaceholder": "invitee@example.com",
    "view.groups.groupPlaceholder": "Group name",
    "view.groups.deleteConfirm": "Delete the group \"{name}\"? Tasks shared into it stay, but the share link is broken. This cannot be undone.",
    "view.groups.toast.inviteCreated": "Invite created for {email} (awaiting your approval)",
    "view.groups.toast.inviteFailed": "Invite failed",
    "view.groups.toast.createFailed": "Create failed",
    "view.groups.toast.deleteFailed": "Delete failed",
    "view.groups.toast.renameFailed": "Rename failed",
    "view.groups.toast.actionFailed": "Action failed",
    "view.groups.toast.couldntInvite": "Couldn't {action} invite",
    "view.groups.toast.renamed": "Renamed",
    "view.groups.toast.deleted": "Group deleted",
    "view.groups.toast.approved": "Invite approved — sent to invitee",
    "view.groups.toast.revoked": "Invite revoked",
    "view.groups.toast.declined": "Invite declined",
    "view.groups.toast.joined": "Joined the group",
    "view.groups.toast.acceptShort": "Joined",
    "view.groups.toast.approveShort": "Approved",
    "view.groups.toast.declineShort": "Declined",
    "view.groups.toast.revokeShort": "Revoked",
    "view.groups.actionApprove": "approve",
    "view.groups.actionDecline": "decline",
    "view.groups.actionAccept": "accept",
    "view.groups.actionRevoke": "revoke",
    "view.calendar.today": "Today",
    "view.calendar.weekday.mon": "Mon",
    "view.calendar.weekday.tue": "Tue",
    "view.calendar.weekday.wed": "Wed",
    "view.calendar.weekday.thu": "Thu",
    "view.calendar.weekday.fri": "Fri",
    "view.calendar.weekday.sat": "Sat",
    "view.calendar.weekday.sun": "Sun",
    "view.calendar.aria.prevDay": "Previous day",
    "view.calendar.aria.nextDay": "Next day",
    "view.calendar.openDay": "Open {date}",
    "view.calendar.nothingScheduled": "Nothing scheduled for this day.",
    "view.calendar.completedCount": "Completed · {n}",
    "sidebar.notifications": "Notifications",
    "sidebar.notifications.aria": "Notifications ({n} unread)",
    "sidebar.notifications.markAllRead": "Mark all read",
    "sidebar.notifications.markRead": "Mark read",
    "sidebar.notifications.dismiss": "Dismiss",
    "sidebar.notifications.allCaught": "You're all caught up.",
    "shared.quickAdd": "Quick add",
    "shared.untitled": "(untitled)",
    "aiActions.findTimeTooltip": "AI suggests 3 time slots in the next 7 days",
    "aiActions.prepMeetingTooltip": "AI drafts a brief agenda + questions",
    "aiActions.estimatedTooltip": "AI-estimated wall-clock time",
    "aiActions.scheduleTooltip": "Schedule",
    "antiOverload.full": "Today is full.",
    "attachments.dropHere": "Drop files here or",
    "attachments.loading": "Loading attachments…",
    "attachments.deleteAria": "delete attachment",
    "attachments.delete": "Delete",
    "dateTimePicker.pick": "Pick date & time",
    "dateTimePicker.prevMonth": "Previous month",
    "dateTimePicker.nextMonth": "Next month",
    "dayTimeline.allDay": "All day",
    "inlineTaskInput.enterHint": "Enter to add",
    "languagePicker.choose": "Choose language",
    "quickAdd.exampleTomorrow9am": "tomorrow 9am",
    "quickAdd.exampleEveryMonday": "every Monday",
    "quickAdd.exampleRemind30m": "remind me 30m before",
    "quickAdd.kbHint": "Enter ↵ · Esc",
    "reminders.enable": "Enable browser reminders",
    "tagItem.color": "Color",
    "tagItem.changeColor": "Change color",
    "tagItem.deleteTag": "Delete tag",
    "sidebar.reflect": "Reflect",
    "sidebar.toggle": "Toggle sidebar",
    "sidebar.planGoal": "Plan a goal as a project + tasks",
    "sidebar.reflectAria": "Today, in retrospect",
    "sidebar.toggleTheme": "Toggle theme",
    "subtasks.loading": "Loading subtasks…",
    "subtasks.newPlaceholder": "New subtask…",
    "subtasks.deleteAria": "delete subtask",
    "tagEditor.colorHint": "Pick a color, or just press Enter for a random one.",
    "taskItem.repeats": "Repeats",
    "taskItem.subtasks": "Subtasks",
    "taskItem.estimated": "Estimated",
    "taskList.sortByDate": "Sort by date",
    "taskList.loading": "Loading…",
    "taskList.emptyHint": "Nothing here yet. Add your first task above.",
    "taskList.revertSort": "Revert to sort by due date",
    "view.list.shareAria": "Share list",
    "view.list.kanbanHint": "Drag cards between columns to change priority.",
    "view.tag.subtitle": "All tasks with this tag.",
    "ribbon.streak": "day streak",
    "ribbon.habits": "habits today",
    "ribbon.q1": "urgent + important",
    "comments.header": "Comments",
    "comments.placeholder": "Write a comment… use @ to mention",
    "comments.send": "Send",
    "comments.edit": "Edit",
    "comments.delete": "Delete",
    "comments.cancel": "Cancel",
    "comments.save": "Save",
    "comments.empty": "No comments yet.",
    "comments.loading": "Loading…",
    "comments.deleteConfirm": "Delete this comment?",
    "comments.editedSuffix": "edited",
    "activity.title": "Activity",
    "activity.subtitle": "Recent activity in this group.",
    "activity.empty": "No activity yet.",
    "activity.loading": "Loading…",
    "activity.link": "Activity",
    "activity.kind.taskCreated": "added a task",
    "activity.kind.taskCompleted": "completed a task",
    "activity.kind.taskReopened": "reopened a task",
    "activity.kind.taskAssigned": "assigned a task",
    "activity.kind.taskShared": "shared a task here",
    "activity.kind.taskDeleted": "removed a task",
    "activity.kind.taskCommented": "commented on a task",
    /* morning copilot — round E */
    "copilot.kickerSuffix": "",
    "copilot.askLabel": "A question for you",
    "copilot.askApply": "Apply suggestions",
    "copilot.askSkip": "Skip for now",
    "copilot.actionsLabel": "Suggested moves",
    "copilot.actionDefer": "Defer to tomorrow",
    "copilot.actionDrop": "Lower priority",
    "copilot.actionBatch": "Group together",
    "copilot.actionReschedule": "Move out",
    "copilot.snooze": "Snooze for tomorrow",
    "copilot.dismiss": "Dismiss",
    "copilot.apply": "Apply",
    "copilot.applying": "Applying…",
    "copilot.empty": "Quiet morning. The day is open.",
    "copilot.errLoad": "Couldn't load this morning's brief.",
    "copilot.tryAgain": "Try again",
    "copilot.appliedToast": "Plan applied · {n} tasks adjusted",
    "view.settings.section.gcal": "Google Calendar",
    "view.settings.gcal.description": "Read your Google Calendar events into First Light. We render them on Today and Calendar so you can plan around what's already booked. Read-only — we never modify events on Google's side.",
    "view.settings.gcal.connect": "Connect Google Calendar",
    "view.settings.gcal.connectedAs": "Connected as",
    "view.settings.gcal.lastSync": "Last synced",
    "view.settings.gcal.lastSyncRelative": "{when}",
    "view.settings.gcal.never": "Never",
    "view.settings.gcal.syncNow": "Sync now",
    "view.settings.gcal.syncing": "Syncing…",
    "view.settings.gcal.disconnect": "Disconnect",
    "view.settings.gcal.disconnectConfirm": "Disconnect Google Calendar? Your synced events will be removed from First Light. The calendar itself stays untouched.",
    "view.settings.gcal.connectErrPrefix": "Couldn't connect:",
    "view.settings.gcal.toast.connected": "Google Calendar connected",
    "view.settings.gcal.toast.synced": "Calendar synced",
    "view.settings.gcal.toast.syncErr": "Couldn't sync calendar",
    "view.settings.gcal.toast.disconnected": "Google Calendar disconnected",
    "view.settings.gcal.toast.disconnectErr": "Couldn't disconnect",
    "view.gcal.chip.allDay": "All day",
    "view.gcal.chip.untitled": "Untitled event",
    "view.today.events.heading": "On your calendar today",
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
    "landing.footerCredit": "© 2026 First Light · 保留所有權利",
    "landing.footerSource": "GitHub 原始碼 →",
    "sidebar.addTask": "新增任務",
    "sidebar.search": "搜尋…",
    "sidebar.today": "今日",
    "view.today.heading": "今日",
    "sidebar.tomorrow": "明日",
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
    "sidebar.notes": "笔记",
    "sidebar.features": "功能",
    "view.next90.subtitle": "未來 90 天內到期的任務。",
    "view.bucket.noDate": "未排定日期",
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
    "view.tomorrow.subtitle": "明日的版面。",
    "view.next7.subtitle": "未來一週內到期的任務。",
    "view.calendar.subtitle": "把任務拖到不同日期。",
    "view.inbox.subtitle": "所有清單中所有進行中的任務。",
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
    "retro.titleLastWeek": "上週,回顧",
    "retro.titleNextWeek": "下週,展望",
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
    "dailyEdition.rateLimited": "今日 AI 使用量已達上限，明日再試。",
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
    "view.matrix.title": "取捨",
    "view.matrix.dragHint": "拖曳任務於四個象限之間,調整緊急 × 重要的取捨。",
    "view.matrix.planWeek": "規劃這一週",
    "view.matrix.planning": "規劃中…",
    "view.matrix.q1Label": "先做",
    "view.matrix.q1Subtitle": "緊急 · 重要",
    "view.matrix.q2Label": "安排",
    "view.matrix.q2Subtitle": "不緊急 · 重要",
    "view.matrix.q3Label": "委派",
    "view.matrix.q3Subtitle": "緊急 · 不重要",
    "view.matrix.q4Label": "捨棄",
    "view.matrix.q4Subtitle": "不緊急 · 不重要",
    "view.matrix.dropHere": "把任務拖到這裡。",
    "view.matrix.yourWeek": "你的一週",
    "view.matrix.itemsOne": "項",
    "view.matrix.itemsMany": "項",
    "view.matrix.readingList": "閱讀整個任務清單…",
    "view.matrix.allClear": "都清乾淨了 — 這一週已經就緒。",
    "view.matrix.applyTitle": "套用",
    "view.matrix.skipTitle": "略過",
    "view.matrix.planAria": "AI 一次規劃未來 7 天的整體節奏",
    "view.matrix.toastNoTasks": "未來 7 天內沒有待規劃的任務。",
    "view.matrix.errBudget": "今日的週規劃額度已用完,明天再試。",
    "view.matrix.errPlan": "無法規劃你的這一週,請再試一次。",
    "view.matrix.appliedOne": "已套用 {n} 項建議。",
    "view.matrix.appliedMany": "已套用 {n} 項建議。",
    "view.pomodoro.sessionsToday": "今天完成 {n} 個專注時段。",
    "view.pomodoro.modeFocus": "專注",
    "view.pomodoro.modeShortBreak": "小休",
    "view.pomodoro.modeLongBreak": "大休",
    "view.pomodoro.start": "開始",
    "view.pomodoro.pause": "暫停",
    "view.pomodoro.reset": "重設",
    "view.pomodoro.stop": "停止",
    "view.pomodoro.workingOn": "正在處理",
    "view.pomodoro.noneOption": "— 無 —",
    "view.pomodoro.toastFocusComplete": "專注完成 — 該休息了!",
    "view.pomodoro.toastBreakDone": "休息結束 — 回到專注。",
    "view.habits.thisWeek": "本週 · {range}",
    "view.habits.lastWeek": "上週 · {range}",
    "view.habits.nextWeekRange": "下週 · {range}",
    "view.habits.weekRange": "{range}",
    "view.habits.aria.prevWeek": "上一週",
    "view.habits.aria.nextWeek": "下一週",
    "view.habits.aria.thisWeek": "本週",
    "view.habits.streakHeader": "連續",
    "view.habits.emptyText": "還沒有習慣。按「新增習慣」開始一個 — 試試「閱讀 20 分鐘」、「冥想」或「喝 8 杯水」。",
    "view.habits.emptyHint": "點擊任一天的格子記錄完成。未來的日子會保持鎖定。",
    "view.habits.intro": "習慣是一件你想每天持續做的小事。完成的日子打勾即可;只有當你跳過一天時連續紀錄才會歸零。點擊上方的 </ > 可以回顧過去或預覽未來的週。",
    "view.habits.newHabit": "新增習慣",
    "view.habits.newHabitCta": "+ 新增習慣",
    "view.habits.namePlaceholder": "例:閱讀 20 分鐘",
    "view.habits.create": "建立",
    "view.habits.tooltipLogged": "{date} 已記錄 — 點擊取消",
    "view.habits.tooltipLog": "點擊以記錄 {date}",
    "view.habits.streakDays": "連續 {n} 天",
    "view.habits.noStreak": "目前無連續紀錄",
    "view.habits.deleteAria": "刪除習慣 {name}",
    "view.habits.deleteTitle": "刪除習慣「{name}」",
    "view.habits.deleteConfirm": "刪除習慣「{name}」?它會從清單中隱藏,過去的紀錄仍會保留。",
    "view.settings.heading": "設定",
    "view.settings.subheader": "帳號、偏好與資料。",
    "view.settings.section.account": "帳號",
    "view.settings.section.language": "語言",
    "view.settings.section.dayCapacity": "每日容量",
    "view.settings.section.aiFeatures": "AI 功能",
    "view.settings.section.notifications": "通知",
    "view.settings.section.calendarSync": "行事曆同步",
    "view.settings.section.inbox": "電子郵件轉任務",
    "view.settings.inbox.description": "將任何電子郵件轉寄到這個地址 — 主旨會成為任務標題,內文會成為備註。",
    "view.settings.inbox.address": "地址",
    "view.settings.inbox.generate": "產生地址",
    "view.settings.inbox.generating": "產生中…",
    "view.settings.inbox.rotate": "重設",
    "view.settings.inbox.rotateConfirm": "要重設地址嗎?舊地址將立即停止運作。",
    "view.settings.inbox.copy": "複製",
    "view.settings.inbox.copied": "已複製",
    "view.settings.inbox.copyAria": "複製地址",
    "view.settings.inbox.lastReceived": "最近收到於 {time}",
    "view.settings.inbox.noEmails": "尚未收到任何郵件。",
    "view.settings.inbox.toast.generated": "地址已產生",
    "view.settings.inbox.toast.rotated": "地址已重設 — 舊地址不再有效",
    "view.settings.inbox.toast.copyFailed": "無法自動複製,請手動複製",
    "view.settings.section.import": "匯入",
    "view.settings.section.yourData": "你的資料",
    "view.settings.section.danger": "危險區",
    "view.settings.section.legal": "法律",
    "view.settings.row.name": "姓名",
    "view.settings.row.email": "電子郵件",
    "view.settings.row.session": "工作階段",
    "view.settings.row.signOut": "登出",
    "view.settings.row.displayLanguage": "顯示語言",
    "view.settings.row.dailyCapacity": "每日可用時間",
    "view.settings.row.energyPeak": "高效時段",
    "view.settings.row.to": "至",
    "view.settings.row.minutesPerDay": "分鐘 / 天",
    "view.settings.row.from": "來源",
    "view.settings.row.file": "檔案",
    "view.settings.row.export": "匯出",
    "view.settings.row.documents": "文件",
    "view.settings.row.deleteAccount": "刪除帳號",
    "view.settings.row.subscribe": "訂閱",
    "view.settings.langHelp": "介面文字、AI 生成的簡報與日期格式都會遵循這個語言。",
    "view.settings.toggle.aiEnabled": "啟用 AI",
    "view.settings.toggle.aiEnabledHint": "總開關 — 關閉後下方功能全部停用。",
    "view.settings.toggle.dailyEdition": "每日簡報",
    "view.settings.toggle.dailyEditionHint": "今日頁面上的編輯式早晨簡報。",
    "view.settings.toggle.smartEisenhower": "AI 取捨自動建議",
    "view.settings.toggle.smartEisenhowerHint": "AI · 取捨頁面上的建議按鈕會提出位置調整。",
    "view.settings.toggle.voiceCapture": "語音輸入",
    "view.settings.toggle.voiceCaptureHint": "每個新增任務輸入框旁的麥克風按鈕。",
    "view.settings.toggle.emailReminders": "Email 提醒",
    "view.settings.toggle.emailRemindersHint": "任務提醒時間到時,寄一封 email 到你的信箱。",
    "view.settings.toggle.dailyDigest": "每日簡報郵件",
    "view.settings.toggle.emailBroadcasts": "產品更新與公告",
    "view.settings.toggle.emailBroadcastsHint": "不定期的新功能、使用技巧和重要更新通知。你可以隨時在設定中關閉。",
    "view.settings.toggle.dailyDigestHint": "每天早上 7 點寄出簡短編輯式版面：今日要事、順延任務與你的連續紀錄。",
    "view.settings.toggle.pushNotifications": "推播通知",
    "view.settings.toggle.pushHint": "即使分頁關閉,瀏覽器仍可推送通知。(iOS 建議使用 PWA。)",
    "view.settings.toggle.pushUnsupported": "此裝置或瀏覽器不支援。",
    "view.settings.toast.nameUpdated": "姓名已更新",
    "view.settings.toast.couldntSave": "無法儲存",
    "view.settings.toast.pushOn": "已開啟推播通知",
    "view.settings.toast.pushOff": "已關閉推播通知",
    "view.settings.toast.pushBlocked": "瀏覽器封鎖了通知,請參考下方說明。",
    "view.settings.toast.pushUnsupported": "此裝置不支援推播",
    "view.settings.toast.pushFailed": "無法訂閱推播",
    "view.settings.toast.exportDownloaded": "已下載匯出檔",
    "view.settings.toast.couldntExport": "無法匯出",
    "view.settings.toast.importedOne": "已匯入 {n} 項任務",
    "view.settings.toast.importedMany": "已匯入 {n} 項任務",
    "view.settings.toast.importFailed": "匯入失敗",
    "view.settings.toast.typeEmail": "請輸入你的 email 以確認",
    "view.settings.toast.accountDeleted": "帳號已刪除",
    "view.settings.toast.couldntDelete": "無法刪除",
    "view.settings.toast.calEnabled": "已啟用行事曆訂閱",
    "view.settings.toast.calDisabled": "已停用訂閱",
    "view.settings.toast.calRotated": "已產生新網址",
    "view.settings.toast.calCopied": "無法自動複製,請手動複製",
    "view.settings.toast.calEnableErr": "無法啟用訂閱",
    "view.settings.toast.calRotateErr": "無法更新網址",
    "view.settings.toast.calDisableErr": "無法停用訂閱",
    "view.settings.delete.button": "刪除我的帳號",
    "view.settings.delete.warning": "這會永久刪除你的帳號,以及所有任務、清單、附件與 AI 簡報。無法復原。請輸入你的 email 以確認。",
    "view.settings.delete.confirmCancel": "取消",
    "view.settings.delete.confirmAction": "永久刪除",
    "view.settings.import.format.ticktick": "TickTick CSV",
    "view.settings.import.format.todoist": "Todoist CSV",
    "view.settings.import.format.ics": "Apple 提醒事項 / 行事曆 (.ics)",
    "view.settings.import.format.generic": "通用 CSV(標題、到期、清單、完成)",
    "view.settings.import.importing": "匯入中…",
    "view.settings.import.help": "每次最多 1,000 列。現有任務不會被覆寫,匯入內容會疊加上去。",
    "view.settings.exportButton": "下載為 JSON",
    "view.settings.exportHelp": "完整備份你的任務、清單、標籤、習慣、番茄鐘記錄、附件以及 AI 簡報與週回顧。用於資料攜帶與 GDPR 存取要求。",
    "view.settings.cal.loading": "載入中…",
    "view.settings.cal.copy": "複製",
    "view.settings.cal.copied": "已複製",
    "view.settings.cal.copyAria": "複製網址",
    "view.settings.cal.rotate": "更換網址",
    "view.settings.cal.disable": "停用",
    "view.settings.cal.enable": "啟用行事曆訂閱",
    "view.settings.cal.generating": "產生中…",
    "view.settings.cal.howSubscribe": "如何訂閱",
    "view.settings.cal.body": "唯讀訂閱。Apple 行事曆、Google 日曆、Outlook 等支援 ICS 的應用程式都能訂閱 — 你的任務與會議會與其他行事曆一起顯示,並自動更新(視應用而定,通常每 15 分鐘至數小時)。在這些行事曆中的編輯不會回寫到 First Light。雙向 Google 同步在開發中。",
    "view.settings.cal.androidNote": "在 Android 上,於 Google 日曆網頁版訂閱 — 手機上的日曆會透過你的 Google 帳號自動同步。",
    "view.settings.cal.notifBlocked.title": "此網站的通知被封鎖了。",
    "view.settings.cal.notifBlocked.body": "點擊網址左方的鎖頭圖示 → 網站設定 → 將「通知」設為「允許」,接著重新載入頁面並再次開啟此選項。",
    "view.settings.privacyPolicy": "隱私權政策",
    "view.settings.termsOfService": "服務條款",
    "view.settings.placeholder.yourName": "你的名字",
    "view.groups.heading": "群組",
    "sidebar.groups": "群組",
    "sidebar.goals": "目標",
    "view.groups.subtitle": "與你信任的人共享任務。每一則邀請都需由群組擁有者批准後才會寄出。",
    "view.groups.namePlaceholder": "新群組名稱",
    "view.groups.create": "建立",
    "view.groups.pendingInvites": "待處理邀請({n})",
    "view.groups.unknownGroup": "(未知群組)",
    "view.groups.accept": "接受",
    "view.groups.decline": "婉拒",
    "view.groups.approveSend": "批准並寄出",
    "view.groups.revoke": "撤回",
    "view.groups.awaiting": "等待對方接受 — ",
    "view.groups.needsApproval": "需要你的批准 — ",
    "view.groups.yourGroups": "你的群組",
    "view.groups.noGroups": "尚未有任何群組 — 在上方建立一個。",
    "view.groups.loading": "載入中…",
    "view.groups.roleOwner": "擁有者",
    "view.groups.roleMember": "成員",
    "view.groups.unknownMember": "(未知)",
    "view.groups.inviteMember": "邀請成員",
    "view.groups.rename": "重新命名",
    "view.groups.delete": "刪除",
    "view.groups.send": "送出",
    "view.groups.cancel": "取消",
    "view.groups.save": "儲存",
    "view.groups.invitePlaceholder": "invitee@example.com",
    "view.groups.groupPlaceholder": "群組名稱",
    "view.groups.deleteConfirm": "刪除群組「{name}」?其中的任務仍會保留,但共享連結會失效。無法復原。",
    "view.groups.toast.inviteCreated": "已為 {email} 建立邀請(待你批准)",
    "view.groups.toast.inviteFailed": "邀請失敗",
    "view.groups.toast.createFailed": "建立失敗",
    "view.groups.toast.deleteFailed": "刪除失敗",
    "view.groups.toast.renameFailed": "重新命名失敗",
    "view.groups.toast.actionFailed": "操作失敗",
    "view.groups.toast.couldntInvite": "無法{action}邀請",
    "view.groups.toast.renamed": "已重新命名",
    "view.groups.toast.deleted": "群組已刪除",
    "view.groups.toast.approved": "邀請已批准 — 已寄給對方",
    "view.groups.toast.revoked": "邀請已撤回",
    "view.groups.toast.declined": "已婉拒邀請",
    "view.groups.toast.joined": "已加入群組",
    "view.groups.toast.acceptShort": "已加入",
    "view.groups.toast.approveShort": "已批准",
    "view.groups.toast.declineShort": "已婉拒",
    "view.groups.toast.revokeShort": "已撤回",
    "view.groups.actionApprove": "批准",
    "view.groups.actionDecline": "婉拒",
    "view.groups.actionAccept": "接受",
    "view.groups.actionRevoke": "撤回",
    "view.calendar.today": "今天",
    "view.calendar.weekday.mon": "週一",
    "view.calendar.weekday.tue": "週二",
    "view.calendar.weekday.wed": "週三",
    "view.calendar.weekday.thu": "週四",
    "view.calendar.weekday.fri": "週五",
    "view.calendar.weekday.sat": "週六",
    "view.calendar.weekday.sun": "週日",
    "view.calendar.aria.prevDay": "前一天",
    "view.calendar.aria.nextDay": "後一天",
    "view.calendar.openDay": "開啟 {date}",
    "view.calendar.nothingScheduled": "今天沒有任何排程。",
    "view.calendar.completedCount": "已完成 · {n}",
    "sidebar.notifications": "通知",
    "sidebar.notifications.aria": "通知(未讀 {n})",
    "sidebar.notifications.markAllRead": "全部標為已讀",
    "sidebar.notifications.markRead": "標為已讀",
    "sidebar.notifications.dismiss": "略過",
    "sidebar.notifications.allCaught": "你已全部跟上。",
    "shared.quickAdd": "快速新增",
    "shared.untitled": "(無標題)",
    "aiActions.findTimeTooltip": "AI 從未來 7 天找出 3 個可用時段",
    "aiActions.prepMeetingTooltip": "AI 幫你擬一份簡短議程與提問",
    "aiActions.estimatedTooltip": "AI 預估的實際所需時間",
    "aiActions.scheduleTooltip": "排入此時段",
    "antiOverload.full": "今天滿了。",
    "attachments.dropHere": "拖放檔案到這裡，或",
    "attachments.loading": "載入附件中…",
    "attachments.deleteAria": "刪除附件",
    "attachments.delete": "刪除",
    "dateTimePicker.pick": "選擇日期與時間",
    "dateTimePicker.prevMonth": "上個月",
    "dateTimePicker.nextMonth": "下個月",
    "dayTimeline.allDay": "整天",
    "inlineTaskInput.enterHint": "按 Enter 新增",
    "languagePicker.choose": "選擇語言",
    "quickAdd.exampleTomorrow9am": "明天 9 點",
    "quickAdd.exampleEveryMonday": "每週一",
    "quickAdd.exampleRemind30m": "30 分鐘前提醒",
    "quickAdd.kbHint": "Enter ↵ · Esc",
    "reminders.enable": "啟用瀏覽器提醒",
    "tagItem.color": "顏色",
    "tagItem.changeColor": "更改顏色",
    "tagItem.deleteTag": "刪除標籤",
    "sidebar.reflect": "回顧",
    "sidebar.toggle": "切換側邊欄",
    "sidebar.planGoal": "把目標拆成清單 + 任務",
    "sidebar.reflectAria": "回顧今天",
    "sidebar.toggleTheme": "切換主題",
    "subtasks.loading": "載入子任務中…",
    "subtasks.newPlaceholder": "新增子任務…",
    "subtasks.deleteAria": "刪除子任務",
    "tagEditor.colorHint": "選一個顏色，或直接按 Enter 隨機挑一個。",
    "taskItem.repeats": "重複",
    "taskItem.subtasks": "子任務",
    "taskItem.estimated": "預估時間",
    "taskList.sortByDate": "依日期排序",
    "taskList.loading": "載入中…",
    "taskList.emptyHint": "還沒有任務。在上方輸入第一個吧。",
    "taskList.revertSort": "回到日期排序",
    "view.list.shareAria": "分享清單",
    "view.list.kanbanHint": "在欄位之間拖曳卡片以調整優先順序。",
    "view.tag.subtitle": "帶有這個標籤的所有任務。",
    "ribbon.streak": "天連續",
    "ribbon.habits": "今日習慣",
    "ribbon.q1": "急且重要",
    "comments.header": "留言",
    "comments.placeholder": "寫下留言… 用 @ 來提及成員",
    "comments.send": "送出",
    "comments.edit": "編輯",
    "comments.delete": "刪除",
    "comments.cancel": "取消",
    "comments.save": "儲存",
    "comments.empty": "還沒有留言。",
    "comments.loading": "載入中…",
    "comments.deleteConfirm": "確定刪除這則留言？",
    "comments.editedSuffix": "已編輯",
    "activity.title": "動態",
    "activity.subtitle": "這個群組最近的動態。",
    "activity.empty": "還沒有任何動態。",
    "activity.loading": "載入中…",
    "activity.link": "動態",
    "activity.kind.taskCreated": "新增了一個任務",
    "activity.kind.taskCompleted": "完成了一個任務",
    "activity.kind.taskReopened": "重新開啟了一個任務",
    "activity.kind.taskAssigned": "指派了一個任務",
    "activity.kind.taskShared": "把任務分享到這裡",
    "activity.kind.taskDeleted": "移除了一個任務",
    "activity.kind.taskCommented": "在任務中留言",
    /* morning copilot — round E */
    "copilot.kickerSuffix": "",
    "copilot.askLabel": "給你的一個提問",
    "copilot.askApply": "採納建議",
    "copilot.askSkip": "先略過",
    "copilot.actionsLabel": "建議的調整",
    "copilot.actionDefer": "延到明天",
    "copilot.actionDrop": "降低優先",
    "copilot.actionBatch": "合併處理",
    "copilot.actionReschedule": "順延",
    "copilot.snooze": "明天再看",
    "copilot.dismiss": "關閉",
    "copilot.apply": "採納",
    "copilot.applying": "執行中…",
    "copilot.empty": "平靜的早晨。今日尚為一張白紙。",
    "copilot.errLoad": "無法載入今日簡報。",
    "copilot.tryAgain": "重試",
    "copilot.appliedToast": "已套用 · 調整 {n} 件任務",
    "view.settings.section.gcal": "Google 日曆",
    "view.settings.gcal.description": "把 Google 日曆上的活動讀進 First Light。我們會把它顯示在「今天」與「日曆」頁面，方便你避開已經排好的時段。唯讀模式 — 我們不會在 Google 端修改任何活動。",
    "view.settings.gcal.connect": "連結 Google 日曆",
    "view.settings.gcal.connectedAs": "已連結帳號",
    "view.settings.gcal.lastSync": "上次同步",
    "view.settings.gcal.lastSyncRelative": "{when}",
    "view.settings.gcal.never": "從未",
    "view.settings.gcal.syncNow": "立即同步",
    "view.settings.gcal.syncing": "同步中…",
    "view.settings.gcal.disconnect": "解除連結",
    "view.settings.gcal.disconnectConfirm": "要解除 Google 日曆的連結嗎？同步過來的活動會從 First Light 移除，原始日曆不會受到影響。",
    "view.settings.gcal.connectErrPrefix": "無法連結：",
    "view.settings.gcal.toast.connected": "已連結 Google 日曆",
    "view.settings.gcal.toast.synced": "日曆已同步",
    "view.settings.gcal.toast.syncErr": "無法同步日曆",
    "view.settings.gcal.toast.disconnected": "已解除 Google 日曆連結",
    "view.settings.gcal.toast.disconnectErr": "無法解除連結",
    "view.gcal.chip.allDay": "整天",
    "view.gcal.chip.untitled": "未命名活動",
    "view.today.events.heading": "今天的行事曆活動",
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
    "landing.footerCredit": "© 2026 First Light · 保留所有权利",
    "landing.footerSource": "GitHub 源码 →",
    "sidebar.addTask": "新增任务",
    "sidebar.search": "搜索…",
    "sidebar.today": "今日",
    "view.today.heading": "今日",
    "sidebar.tomorrow": "明日",
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
    "sidebar.notes": "筆記",
    "sidebar.features": "功能",
    "view.next90.subtitle": "未来 90 天内到期的任务。",
    "view.bucket.noDate": "未排日期",
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
    "view.tomorrow.subtitle": "明日的版面。",
    "view.next7.subtitle": "未来一周内到期的任务。",
    "view.calendar.subtitle": "把任务拖到不同日期。",
    "view.inbox.subtitle": "所有清单中所有进行中的任务。",
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
    "retro.titleLastWeek": "上周,回顾",
    "retro.titleNextWeek": "下周,展望",
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
    "dailyEdition.rateLimited": "今日 AI 使用量已达上限，明日再试。",
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
    "view.matrix.title": "取舍",
    "view.matrix.dragHint": "在四个象限之间拖动任务,调整紧急 × 重要的取舍。",
    "view.matrix.planWeek": "规划这一周",
    "view.matrix.planning": "规划中…",
    "view.matrix.q1Label": "先做",
    "view.matrix.q1Subtitle": "紧急 · 重要",
    "view.matrix.q2Label": "安排",
    "view.matrix.q2Subtitle": "不紧急 · 重要",
    "view.matrix.q3Label": "委派",
    "view.matrix.q3Subtitle": "紧急 · 不重要",
    "view.matrix.q4Label": "舍弃",
    "view.matrix.q4Subtitle": "不紧急 · 不重要",
    "view.matrix.dropHere": "把任务拖到这里。",
    "view.matrix.yourWeek": "你的一周",
    "view.matrix.itemsOne": "项",
    "view.matrix.itemsMany": "项",
    "view.matrix.readingList": "阅读整个任务清单…",
    "view.matrix.allClear": "都清干净了 — 这一周已经就绪。",
    "view.matrix.applyTitle": "套用",
    "view.matrix.skipTitle": "略过",
    "view.matrix.planAria": "AI 一次规划未来 7 天的整体节奏",
    "view.matrix.toastNoTasks": "未来 7 天内没有待规划的任务。",
    "view.matrix.errBudget": "今天的周规划额度已用完,明天再试。",
    "view.matrix.errPlan": "无法规划你的这一周,请再试一次。",
    "view.matrix.appliedOne": "已套用 {n} 项建议。",
    "view.matrix.appliedMany": "已套用 {n} 项建议。",
    "view.pomodoro.sessionsToday": "今天完成 {n} 个专注时段。",
    "view.pomodoro.modeFocus": "专注",
    "view.pomodoro.modeShortBreak": "小憩",
    "view.pomodoro.modeLongBreak": "长休",
    "view.pomodoro.start": "开始",
    "view.pomodoro.pause": "暂停",
    "view.pomodoro.reset": "重置",
    "view.pomodoro.stop": "停止",
    "view.pomodoro.workingOn": "正在处理",
    "view.pomodoro.noneOption": "— 无 —",
    "view.pomodoro.toastFocusComplete": "专注完成 — 该休息了!",
    "view.pomodoro.toastBreakDone": "休息结束 — 回到专注。",
    "view.habits.thisWeek": "本周 · {range}",
    "view.habits.lastWeek": "上周 · {range}",
    "view.habits.nextWeekRange": "下周 · {range}",
    "view.habits.weekRange": "{range}",
    "view.habits.aria.prevWeek": "上一周",
    "view.habits.aria.nextWeek": "下一周",
    "view.habits.aria.thisWeek": "本周",
    "view.habits.streakHeader": "连续",
    "view.habits.emptyText": "还没有习惯。点击「新增习惯」开始一个 — 试试「阅读 20 分钟」「冥想」或「喝 8 杯水」。",
    "view.habits.emptyHint": "点击任一天的格子记录完成。未来的日子保持锁定。",
    "view.habits.intro": "习惯是一件你想每天坚持做的小事。完成的日子打勾即可;只有当你跳过一天时连续记录才会归零。点击上方的 </ > 可以回顾过去或预览未来的周。",
    "view.habits.newHabit": "新增习惯",
    "view.habits.newHabitCta": "+ 新增习惯",
    "view.habits.namePlaceholder": "例:阅读 20 分钟",
    "view.habits.create": "创建",
    "view.habits.tooltipLogged": "{date} 已记录 — 点击取消",
    "view.habits.tooltipLog": "点击以记录 {date}",
    "view.habits.streakDays": "连续 {n} 天",
    "view.habits.noStreak": "目前无连续记录",
    "view.habits.deleteAria": "删除习惯 {name}",
    "view.habits.deleteTitle": "删除习惯「{name}」",
    "view.habits.deleteConfirm": "删除习惯「{name}」?它会从列表中隐藏,过去的记录仍会保留。",
    "view.settings.heading": "设置",
    "view.settings.subheader": "账号、偏好与数据。",
    "view.settings.section.account": "账号",
    "view.settings.section.language": "语言",
    "view.settings.section.dayCapacity": "每日容量",
    "view.settings.section.aiFeatures": "AI 功能",
    "view.settings.section.notifications": "通知",
    "view.settings.section.calendarSync": "日历同步",
    "view.settings.section.inbox": "邮件转任务",
    "view.settings.inbox.description": "将任何邮件转发到这个地址 — 主题会成为任务标题,正文会成为备注。",
    "view.settings.inbox.address": "地址",
    "view.settings.inbox.generate": "生成地址",
    "view.settings.inbox.generating": "生成中…",
    "view.settings.inbox.rotate": "重置",
    "view.settings.inbox.rotateConfirm": "要重置地址吗?旧地址将立即停止工作。",
    "view.settings.inbox.copy": "复制",
    "view.settings.inbox.copied": "已复制",
    "view.settings.inbox.copyAria": "复制地址",
    "view.settings.inbox.lastReceived": "最近收到于 {time}",
    "view.settings.inbox.noEmails": "尚未收到任何邮件。",
    "view.settings.inbox.toast.generated": "地址已生成",
    "view.settings.inbox.toast.rotated": "地址已重置 — 旧地址不再有效",
    "view.settings.inbox.toast.copyFailed": "无法自动复制,请手动复制",
    "view.settings.section.import": "导入",
    "view.settings.section.yourData": "你的数据",
    "view.settings.section.danger": "危险区",
    "view.settings.section.legal": "法律",
    "view.settings.row.name": "姓名",
    "view.settings.row.email": "电子邮件",
    "view.settings.row.session": "会话",
    "view.settings.row.signOut": "退出登录",
    "view.settings.row.displayLanguage": "显示语言",
    "view.settings.row.dailyCapacity": "每日可用时间",
    "view.settings.row.energyPeak": "高效时段",
    "view.settings.row.to": "至",
    "view.settings.row.minutesPerDay": "分钟 / 天",
    "view.settings.row.from": "来源",
    "view.settings.row.file": "文件",
    "view.settings.row.export": "导出",
    "view.settings.row.documents": "文件",
    "view.settings.row.deleteAccount": "删除账号",
    "view.settings.row.subscribe": "订阅",
    "view.settings.langHelp": "界面文字、AI 生成的简报与日期格式都会遵循该语言。",
    "view.settings.toggle.aiEnabled": "启用 AI",
    "view.settings.toggle.aiEnabledHint": "总开关 — 关闭后下方功能全部停用。",
    "view.settings.toggle.dailyEdition": "每日简报",
    "view.settings.toggle.dailyEditionHint": "今日页面上的编辑式早晨简报。",
    "view.settings.toggle.smartEisenhower": "AI 取舍自动建议",
    "view.settings.toggle.smartEisenhowerHint": "AI · 取舍页面上的建议按钮会提出位置调整。",
    "view.settings.toggle.voiceCapture": "语音输入",
    "view.settings.toggle.voiceCaptureHint": "每个新增任务输入框旁的麦克风按钮。",
    "view.settings.toggle.emailReminders": "邮件提醒",
    "view.settings.toggle.emailRemindersHint": "任务提醒时间到时,发一封邮件到你的邮箱。",
    "view.settings.toggle.dailyDigest": "每日简报邮件",
    "view.settings.toggle.dailyDigestHint": "每天早上 7 点发送简短编辑式版面：今日要事、顺延任务与你的连续记录。",
    "view.settings.toggle.emailBroadcasts": "产品更新与公告",
    "view.settings.toggle.emailBroadcastsHint": "不定期的新功能、使用技巧和重要更新通知。你可以随时在设置中关闭。",
    "view.settings.toggle.pushNotifications": "推送通知",
    "view.settings.toggle.pushHint": "即使标签关闭,浏览器仍可推送通知。(iOS 建议使用 PWA。)",
    "view.settings.toggle.pushUnsupported": "此设备或浏览器不支持。",
    "view.settings.toast.nameUpdated": "姓名已更新",
    "view.settings.toast.couldntSave": "无法保存",
    "view.settings.toast.pushOn": "已开启推送通知",
    "view.settings.toast.pushOff": "已关闭推送通知",
    "view.settings.toast.pushBlocked": "浏览器已拦截通知,请参考下方说明。",
    "view.settings.toast.pushUnsupported": "此设备不支持推送",
    "view.settings.toast.pushFailed": "无法订阅推送",
    "view.settings.toast.exportDownloaded": "已下载导出文件",
    "view.settings.toast.couldntExport": "无法导出",
    "view.settings.toast.importedOne": "已导入 {n} 项任务",
    "view.settings.toast.importedMany": "已导入 {n} 项任务",
    "view.settings.toast.importFailed": "导入失败",
    "view.settings.toast.typeEmail": "请输入你的邮箱以确认",
    "view.settings.toast.accountDeleted": "账号已删除",
    "view.settings.toast.couldntDelete": "无法删除",
    "view.settings.toast.calEnabled": "已启用日历订阅",
    "view.settings.toast.calDisabled": "已停用订阅",
    "view.settings.toast.calRotated": "已生成新网址",
    "view.settings.toast.calCopied": "无法自动复制,请手动复制",
    "view.settings.toast.calEnableErr": "无法启用订阅",
    "view.settings.toast.calRotateErr": "无法更新网址",
    "view.settings.toast.calDisableErr": "无法停用订阅",
    "view.settings.delete.button": "删除我的账号",
    "view.settings.delete.warning": "这会永久删除你的账号,以及所有任务、清单、附件与 AI 简报。无法撤销。请输入你的邮箱以确认。",
    "view.settings.delete.confirmCancel": "取消",
    "view.settings.delete.confirmAction": "永久删除",
    "view.settings.import.format.ticktick": "TickTick CSV",
    "view.settings.import.format.todoist": "Todoist CSV",
    "view.settings.import.format.ics": "Apple 提醒事项 / 日历 (.ics)",
    "view.settings.import.format.generic": "通用 CSV(标题、到期、清单、完成)",
    "view.settings.import.importing": "导入中…",
    "view.settings.import.help": "每次最多 1,000 行。现有任务不会被覆盖,导入内容会叠加上去。",
    "view.settings.exportButton": "下载为 JSON",
    "view.settings.exportHelp": "完整备份你的任务、清单、标签、习惯、番茄钟记录、附件以及 AI 简报与周回顾。用于数据可携与 GDPR 访问请求。",
    "view.settings.cal.loading": "加载中…",
    "view.settings.cal.copy": "复制",
    "view.settings.cal.copied": "已复制",
    "view.settings.cal.copyAria": "复制网址",
    "view.settings.cal.rotate": "更换网址",
    "view.settings.cal.disable": "停用",
    "view.settings.cal.enable": "启用日历订阅",
    "view.settings.cal.generating": "生成中…",
    "view.settings.cal.howSubscribe": "如何订阅",
    "view.settings.cal.body": "只读订阅。Apple 日历、Google 日历、Outlook 等支持 ICS 的应用都可以订阅 — 你的任务和会议会和其他日历一起显示,并自动刷新(视应用而定,通常每 15 分钟到几个小时)。在这些日历中的编辑不会回传到 First Light。双向 Google 同步在路线图中。",
    "view.settings.cal.androidNote": "在 Android 上,在 Google 日历网页版订阅 — 手机日历会通过你的 Google 账号自动同步。",
    "view.settings.cal.notifBlocked.title": "此网站的通知被屏蔽了。",
    "view.settings.cal.notifBlocked.body": "点击网址左侧的锁形图标 → 网站设置 → 将「通知」设为「允许」,然后重新加载页面并再次开启该选项。",
    "view.settings.privacyPolicy": "隐私政策",
    "view.settings.termsOfService": "服务条款",
    "view.settings.placeholder.yourName": "你的名字",
    "view.groups.heading": "群组",
    "sidebar.groups": "群组",
    "sidebar.goals": "目标",
    "view.groups.subtitle": "和你信任的人共享任务。每条邀请都需由群组所有者批准后才会发出。",
    "view.groups.namePlaceholder": "新群组名称",
    "view.groups.create": "创建",
    "view.groups.pendingInvites": "待处理邀请({n})",
    "view.groups.unknownGroup": "(未知群组)",
    "view.groups.accept": "接受",
    "view.groups.decline": "婉拒",
    "view.groups.approveSend": "批准并发出",
    "view.groups.revoke": "撤回",
    "view.groups.awaiting": "等待对方接受 — ",
    "view.groups.needsApproval": "需要你的批准 — ",
    "view.groups.yourGroups": "你的群组",
    "view.groups.noGroups": "还没有群组 — 在上方建一个。",
    "view.groups.loading": "加载中…",
    "view.groups.roleOwner": "所有者",
    "view.groups.roleMember": "成员",
    "view.groups.unknownMember": "(未知)",
    "view.groups.inviteMember": "邀请成员",
    "view.groups.rename": "重命名",
    "view.groups.delete": "删除",
    "view.groups.send": "发送",
    "view.groups.cancel": "取消",
    "view.groups.save": "保存",
    "view.groups.invitePlaceholder": "invitee@example.com",
    "view.groups.groupPlaceholder": "群组名称",
    "view.groups.deleteConfirm": "删除群组「{name}」?其中的任务仍会保留,但共享链接会失效。无法撤销。",
    "view.groups.toast.inviteCreated": "已为 {email} 创建邀请(待你批准)",
    "view.groups.toast.inviteFailed": "邀请失败",
    "view.groups.toast.createFailed": "创建失败",
    "view.groups.toast.deleteFailed": "删除失败",
    "view.groups.toast.renameFailed": "重命名失败",
    "view.groups.toast.actionFailed": "操作失败",
    "view.groups.toast.couldntInvite": "无法{action}邀请",
    "view.groups.toast.renamed": "已重命名",
    "view.groups.toast.deleted": "群组已删除",
    "view.groups.toast.approved": "邀请已批准 — 已发给对方",
    "view.groups.toast.revoked": "邀请已撤回",
    "view.groups.toast.declined": "已婉拒邀请",
    "view.groups.toast.joined": "已加入群组",
    "view.groups.toast.acceptShort": "已加入",
    "view.groups.toast.approveShort": "已批准",
    "view.groups.toast.declineShort": "已婉拒",
    "view.groups.toast.revokeShort": "已撤回",
    "view.groups.actionApprove": "批准",
    "view.groups.actionDecline": "婉拒",
    "view.groups.actionAccept": "接受",
    "view.groups.actionRevoke": "撤回",
    "view.calendar.today": "今天",
    "view.calendar.weekday.mon": "周一",
    "view.calendar.weekday.tue": "周二",
    "view.calendar.weekday.wed": "周三",
    "view.calendar.weekday.thu": "周四",
    "view.calendar.weekday.fri": "周五",
    "view.calendar.weekday.sat": "周六",
    "view.calendar.weekday.sun": "周日",
    "view.calendar.aria.prevDay": "前一天",
    "view.calendar.aria.nextDay": "后一天",
    "view.calendar.openDay": "打开 {date}",
    "view.calendar.nothingScheduled": "今天没有任何排期。",
    "view.calendar.completedCount": "已完成 · {n}",
    "sidebar.notifications": "通知",
    "sidebar.notifications.aria": "通知(未读 {n})",
    "sidebar.notifications.markAllRead": "全部标为已读",
    "sidebar.notifications.markRead": "标为已读",
    "sidebar.notifications.dismiss": "忽略",
    "sidebar.notifications.allCaught": "你已全部跟上。",
    "shared.quickAdd": "快速添加",
    "shared.untitled": "(无标题)",
    "aiActions.findTimeTooltip": "AI 从未来 7 天里挑出 3 个可用时段",
    "aiActions.prepMeetingTooltip": "AI 帮你拟一份简短议程和提问",
    "aiActions.estimatedTooltip": "AI 预估的实际所需时间",
    "aiActions.scheduleTooltip": "排到这个时段",
    "antiOverload.full": "今天满了。",
    "attachments.dropHere": "拖放文件到这里，或",
    "attachments.loading": "正在加载附件…",
    "attachments.deleteAria": "删除附件",
    "attachments.delete": "删除",
    "dateTimePicker.pick": "选择日期和时间",
    "dateTimePicker.prevMonth": "上个月",
    "dateTimePicker.nextMonth": "下个月",
    "dayTimeline.allDay": "全天",
    "inlineTaskInput.enterHint": "按 Enter 添加",
    "languagePicker.choose": "选择语言",
    "quickAdd.exampleTomorrow9am": "明天 9 点",
    "quickAdd.exampleEveryMonday": "每周一",
    "quickAdd.exampleRemind30m": "30 分钟前提醒",
    "quickAdd.kbHint": "Enter ↵ · Esc",
    "reminders.enable": "启用浏览器提醒",
    "tagItem.color": "颜色",
    "tagItem.changeColor": "更改颜色",
    "tagItem.deleteTag": "删除标签",
    "sidebar.reflect": "回顾",
    "sidebar.toggle": "切换侧边栏",
    "sidebar.planGoal": "把目标拆成清单和任务",
    "sidebar.reflectAria": "回顾今天",
    "sidebar.toggleTheme": "切换主题",
    "subtasks.loading": "正在加载子任务…",
    "subtasks.newPlaceholder": "新建子任务…",
    "subtasks.deleteAria": "删除子任务",
    "tagEditor.colorHint": "挑一个颜色，或直接按 Enter 随机选一个。",
    "taskItem.repeats": "重复",
    "taskItem.subtasks": "子任务",
    "taskItem.estimated": "预估时间",
    "taskList.sortByDate": "按日期排序",
    "taskList.loading": "加载中…",
    "taskList.emptyHint": "还没有任务。在上方输入第一个吧。",
    "taskList.revertSort": "改回按日期排序",
    "view.list.shareAria": "分享清单",
    "view.list.kanbanHint": "在列之间拖动卡片以调整优先级。",
    "view.tag.subtitle": "带这个标签的所有任务。",
    "ribbon.streak": "天连续",
    "ribbon.habits": "今日习惯",
    "ribbon.q1": "紧急且重要",
    "comments.header": "评论",
    "comments.placeholder": "写下评论… 用 @ 来提及成员",
    "comments.send": "发送",
    "comments.edit": "编辑",
    "comments.delete": "删除",
    "comments.cancel": "取消",
    "comments.save": "保存",
    "comments.empty": "还没有评论。",
    "comments.loading": "加载中…",
    "comments.deleteConfirm": "确定删除这条评论?",
    "comments.editedSuffix": "已编辑",
    "activity.title": "动态",
    "activity.subtitle": "这个群组最近的动态。",
    "activity.empty": "还没有任何动态。",
    "activity.loading": "加载中…",
    "activity.link": "动态",
    "activity.kind.taskCreated": "添加了一个任务",
    "activity.kind.taskCompleted": "完成了一个任务",
    "activity.kind.taskReopened": "重新打开了一个任务",
    "activity.kind.taskAssigned": "指派了一个任务",
    "activity.kind.taskShared": "把任务分享到这里",
    "activity.kind.taskDeleted": "删除了一个任务",
    "activity.kind.taskCommented": "在任务上发表了评论",
    /* morning copilot — round E */
    "copilot.kickerSuffix": "",
    "copilot.askLabel": "给你的一个提问",
    "copilot.askApply": "采纳建议",
    "copilot.askSkip": "先略过",
    "copilot.actionsLabel": "建议的调整",
    "copilot.actionDefer": "延到明天",
    "copilot.actionDrop": "降低优先",
    "copilot.actionBatch": "合并处理",
    "copilot.actionReschedule": "顺延",
    "copilot.snooze": "明天再看",
    "copilot.dismiss": "关闭",
    "copilot.apply": "采纳",
    "copilot.applying": "执行中…",
    "copilot.empty": "平静的早晨。今天还是一张白纸。",
    "copilot.errLoad": "无法加载今日简报。",
    "copilot.tryAgain": "重试",
    "copilot.appliedToast": "已应用 · 调整 {n} 件任务",
    "view.settings.section.gcal": "Google 日历",
    "view.settings.gcal.description": "把 Google 日历的事件同步到 First Light。我们会显示在「今天」和「日历」页面，方便你避开已排好的时间。只读模式 — 我们不会在 Google 端修改任何事件。",
    "view.settings.gcal.connect": "连接 Google 日历",
    "view.settings.gcal.connectedAs": "已连接账号",
    "view.settings.gcal.lastSync": "上次同步",
    "view.settings.gcal.lastSyncRelative": "{when}",
    "view.settings.gcal.never": "从未",
    "view.settings.gcal.syncNow": "立即同步",
    "view.settings.gcal.syncing": "同步中…",
    "view.settings.gcal.disconnect": "解除连接",
    "view.settings.gcal.disconnectConfirm": "要解除 Google 日历的连接吗？已同步的事件会从 First Light 删除，原始日历不会受到影响。",
    "view.settings.gcal.connectErrPrefix": "无法连接：",
    "view.settings.gcal.toast.connected": "已连接 Google 日历",
    "view.settings.gcal.toast.synced": "日历已同步",
    "view.settings.gcal.toast.syncErr": "无法同步日历",
    "view.settings.gcal.toast.disconnected": "已解除 Google 日历连接",
    "view.settings.gcal.toast.disconnectErr": "无法解除连接",
    "view.gcal.chip.allDay": "全天",
    "view.gcal.chip.untitled": "未命名事件",
    "view.today.events.heading": "今天的日历事件",
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
    "landing.footerCredit": "© 2026 First Light · 無断複写・転載を禁じます",
    "landing.footerSource": "GitHub のソース →",
    "sidebar.addTask": "タスクを追加",
    "sidebar.search": "検索…",
    "sidebar.today": "今日",
    "view.today.heading": "今日の予定",
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
    "sidebar.notes": "ノート",
    "sidebar.features": "機能",
    "view.next90.subtitle": "今後90日以内に期限のタスク。",
    "view.bucket.noDate": "日付なし",
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
    "view.inbox.subtitle": "すべてのリストの進行中タスク。",
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
    "retro.titleLastWeek": "先週、振り返り",
    "retro.titleNextWeek": "来週、これから",
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
    "dailyEdition.rateLimited": "今日の AI 利用上限に達しました。明日また読めます。",
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
    "view.matrix.title": "シフト",
    "view.matrix.dragHint": "緊急度 × 重要度を変えるには、タスクを各象限へドラッグします。",
    "view.matrix.planWeek": "今週をプランする",
    "view.matrix.planning": "プラン中…",
    "view.matrix.q1Label": "まず取り組む",
    "view.matrix.q1Subtitle": "緊急 · 重要",
    "view.matrix.q2Label": "予定する",
    "view.matrix.q2Subtitle": "緊急ではない · 重要",
    "view.matrix.q3Label": "任せる",
    "view.matrix.q3Subtitle": "緊急 · 重要ではない",
    "view.matrix.q4Label": "やめる",
    "view.matrix.q4Subtitle": "緊急ではない · 重要ではない",
    "view.matrix.dropHere": "ここにタスクをドロップ。",
    "view.matrix.yourWeek": "今週のプラン",
    "view.matrix.itemsOne": "件",
    "view.matrix.itemsMany": "件",
    "view.matrix.readingList": "リスト全体を読み込み中…",
    "view.matrix.allClear": "すべて整いました — 今週はもう順調です。",
    "view.matrix.applyTitle": "適用",
    "view.matrix.skipTitle": "スキップ",
    "view.matrix.planAria": "AI が今後 7 日間をまとめてプランします",
    "view.matrix.toastNoTasks": "今後 7 日間にプランするタスクがありません。",
    "view.matrix.errBudget": "本日のプラン作成枠を使い切りました。明日また試してください。",
    "view.matrix.errPlan": "今週のプランを作れませんでした。もう一度お試しください。",
    "view.matrix.appliedOne": "{n} 件の提案を適用しました。",
    "view.matrix.appliedMany": "{n} 件の提案を適用しました。",
    "view.pomodoro.sessionsToday": "今日の集中セッション {n} 回。",
    "view.pomodoro.modeFocus": "集中",
    "view.pomodoro.modeShortBreak": "小休憩",
    "view.pomodoro.modeLongBreak": "長休憩",
    "view.pomodoro.start": "スタート",
    "view.pomodoro.pause": "一時停止",
    "view.pomodoro.reset": "リセット",
    "view.pomodoro.stop": "停止",
    "view.pomodoro.workingOn": "取り組む",
    "view.pomodoro.noneOption": "— なし —",
    "view.pomodoro.toastFocusComplete": "集中完了 — 一息つきましょう。",
    "view.pomodoro.toastBreakDone": "休憩終了 — 集中に戻ります。",
    "view.habits.thisWeek": "今週 · {range}",
    "view.habits.lastWeek": "先週 · {range}",
    "view.habits.nextWeekRange": "来週 · {range}",
    "view.habits.weekRange": "{range}",
    "view.habits.aria.prevWeek": "先週へ",
    "view.habits.aria.nextWeek": "来週へ",
    "view.habits.aria.thisWeek": "今週",
    "view.habits.streakHeader": "連続",
    "view.habits.emptyText": "まだ習慣がありません。「新しい習慣」をタップして始めましょう — 例:「20 分読書」「瞑想」「水を 8 杯」。",
    "view.habits.emptyHint": "日付セルをタップして完了を記録します。未来の日はロックされます。",
    "view.habits.intro": "習慣とは、毎日ちょっと続けたい小さな行動のこと。できた日にチェックを入れるだけ — スキップした日があると連続記録だけリセットされます。上の </ > で過去や来週を見直せます。",
    "view.habits.newHabit": "新しい習慣",
    "view.habits.newHabitCta": "+ 新しい習慣",
    "view.habits.namePlaceholder": "例:20 分読書",
    "view.habits.create": "作成",
    "view.habits.tooltipLogged": "{date} を記録済み — タップで取り消し",
    "view.habits.tooltipLog": "{date} を記録",
    "view.habits.streakDays": "{n} 日連続",
    "view.habits.noStreak": "現在の連続なし",
    "view.habits.deleteAria": "習慣「{name}」を削除",
    "view.habits.deleteTitle": "習慣「{name}」を削除",
    "view.habits.deleteConfirm": "習慣「{name}」を削除しますか?一覧から外れますが、過去の記録は残ります。",
    "view.settings.heading": "設定",
    "view.settings.subheader": "アカウント、設定、データ。",
    "view.settings.section.account": "アカウント",
    "view.settings.section.language": "言語",
    "view.settings.section.dayCapacity": "1 日のキャパ",
    "view.settings.section.aiFeatures": "AI 機能",
    "view.settings.section.notifications": "通知",
    "view.settings.section.calendarSync": "カレンダー同期",
    "view.settings.section.inbox": "メールからタスク",
    "view.settings.inbox.description": "このアドレスにメールを転送すると、件名がタスクのタイトルに、本文がメモになります。",
    "view.settings.inbox.address": "アドレス",
    "view.settings.inbox.generate": "アドレスを生成",
    "view.settings.inbox.generating": "生成中…",
    "view.settings.inbox.rotate": "再生成",
    "view.settings.inbox.rotateConfirm": "アドレスを再生成しますか?古いアドレスは直ちに無効になります。",
    "view.settings.inbox.copy": "コピー",
    "view.settings.inbox.copied": "コピーしました",
    "view.settings.inbox.copyAria": "アドレスをコピー",
    "view.settings.inbox.lastReceived": "最終受信 {time}",
    "view.settings.inbox.noEmails": "まだメールを受信していません。",
    "view.settings.inbox.toast.generated": "アドレスを生成しました",
    "view.settings.inbox.toast.rotated": "アドレスを再生成しました — 古いアドレスは無効になりました",
    "view.settings.inbox.toast.copyFailed": "コピーできませんでした。手動でコピーしてください",
    "view.settings.section.import": "インポート",
    "view.settings.section.yourData": "あなたのデータ",
    "view.settings.section.danger": "危険ゾーン",
    "view.settings.section.legal": "法的事項",
    "view.settings.row.name": "名前",
    "view.settings.row.email": "メール",
    "view.settings.row.session": "セッション",
    "view.settings.row.signOut": "サインアウト",
    "view.settings.row.displayLanguage": "表示言語",
    "view.settings.row.dailyCapacity": "1 日の作業時間",
    "view.settings.row.energyPeak": "ピークタイム",
    "view.settings.row.to": "から",
    "view.settings.row.minutesPerDay": "分 / 日",
    "view.settings.row.from": "形式",
    "view.settings.row.file": "ファイル",
    "view.settings.row.export": "エクスポート",
    "view.settings.row.documents": "ドキュメント",
    "view.settings.row.deleteAccount": "アカウント削除",
    "view.settings.row.subscribe": "購読",
    "view.settings.langHelp": "UI のラベル、AI による要約、日付フォーマットがこの言語になります。",
    "view.settings.toggle.aiEnabled": "AI を有効化",
    "view.settings.toggle.aiEnabledHint": "メインスイッチ — オフにすると下の機能はすべて無効になります。",
    "view.settings.toggle.dailyEdition": "デイリーエディション",
    "view.settings.toggle.dailyEditionHint": "Today ページに表示される編集者風の朝のブリーフ。",
    "view.settings.toggle.smartEisenhower": "スマート・アイゼンハワー提案",
    "view.settings.toggle.smartEisenhowerHint": "AI · マトリクス上の「提案」ボタンが移動を提案します。",
    "view.settings.toggle.voiceCapture": "音声入力",
    "view.settings.toggle.voiceCaptureHint": "タスク追加欄に表示されるマイクボタン。",
    "view.settings.toggle.emailReminders": "メール通知",
    "view.settings.toggle.emailRemindersHint": "タスクのリマインド時刻になったら、メールでお知らせします。",
    "view.settings.toggle.dailyDigest": "デイリーブリーフメール",
    "view.settings.toggle.dailyDigestHint": "毎朝 7 時に短い紙面を配信：本日の優先項目、持ち越し、連続記録。",
    "view.settings.toggle.emailBroadcasts": "製品アップデートとお知らせ",
    "view.settings.toggle.emailBroadcastsHint": "新機能、ヒント、重要なアップデートに関するメール。設定からいつでもオフにできます。",
    "view.settings.toggle.pushNotifications": "プッシュ通知",
    "view.settings.toggle.pushHint": "タブを閉じていてもブラウザから届く通知。(iOS は PWA 推奨。)",
    "view.settings.toggle.pushUnsupported": "このデバイスまたはブラウザでは利用できません。",
    "view.settings.toast.nameUpdated": "名前を更新しました",
    "view.settings.toast.couldntSave": "保存できませんでした",
    "view.settings.toast.pushOn": "プッシュ通知をオンにしました",
    "view.settings.toast.pushOff": "プッシュ通知をオフにしました",
    "view.settings.toast.pushBlocked": "ブラウザが通知をブロックしました。下のヒントを参照してください。",
    "view.settings.toast.pushUnsupported": "このデバイスはプッシュ通知に対応していません",
    "view.settings.toast.pushFailed": "プッシュ通知を登録できませんでした",
    "view.settings.toast.exportDownloaded": "エクスポートをダウンロードしました",
    "view.settings.toast.couldntExport": "エクスポートできませんでした",
    "view.settings.toast.importedOne": "{n} 件のタスクを取り込みました",
    "view.settings.toast.importedMany": "{n} 件のタスクを取り込みました",
    "view.settings.toast.importFailed": "インポートに失敗しました",
    "view.settings.toast.typeEmail": "確認のためメールアドレスを入力してください",
    "view.settings.toast.accountDeleted": "アカウントを削除しました",
    "view.settings.toast.couldntDelete": "削除できませんでした",
    "view.settings.toast.calEnabled": "カレンダー購読を有効にしました",
    "view.settings.toast.calDisabled": "購読を停止しました",
    "view.settings.toast.calRotated": "新しい URL を発行しました",
    "view.settings.toast.calCopied": "コピーできませんでした。手動でコピーしてください",
    "view.settings.toast.calEnableErr": "購読を有効にできませんでした",
    "view.settings.toast.calRotateErr": "URL を更新できませんでした",
    "view.settings.toast.calDisableErr": "購読を停止できませんでした",
    "view.settings.delete.button": "アカウントを削除",
    "view.settings.delete.warning": "アカウント、すべてのタスク・リスト・添付・AI ブリーフが完全に削除されます。元には戻せません。確認のためメールを入力してください。",
    "view.settings.delete.confirmCancel": "キャンセル",
    "view.settings.delete.confirmAction": "完全に削除",
    "view.settings.import.format.ticktick": "TickTick CSV",
    "view.settings.import.format.todoist": "Todoist CSV",
    "view.settings.import.format.ics": "Apple リマインダー / カレンダー (.ics)",
    "view.settings.import.format.generic": "汎用 CSV(タイトル、期限、リスト、完了)",
    "view.settings.import.importing": "インポート中…",
    "view.settings.import.help": "1 回につき最大 1,000 行。既存のタスクは変更せず、上に追加します。",
    "view.settings.exportButton": "JSON でダウンロード",
    "view.settings.exportHelp": "タスク・リスト・タグ・習慣・ポモドーロ記録・添付ファイル・AI ブリーフと週次レトロをまとめて書き出します。データ移行や GDPR の開示請求に。",
    "view.settings.cal.loading": "読み込み中…",
    "view.settings.cal.copy": "コピー",
    "view.settings.cal.copied": "コピーしました",
    "view.settings.cal.copyAria": "URL をコピー",
    "view.settings.cal.rotate": "URL を更新",
    "view.settings.cal.disable": "無効化",
    "view.settings.cal.enable": "カレンダー購読を有効にする",
    "view.settings.cal.generating": "生成中…",
    "view.settings.cal.howSubscribe": "購読方法",
    "view.settings.cal.body": "読み取り専用フィード。Apple カレンダー、Google カレンダー、Outlook など ICS 対応アプリで購読できます — タスクや予定がほかのカレンダーと並んで表示され、アプリに応じて 15 分〜数時間ごとに自動更新されます。これらのカレンダー側での編集は First Light には反映されません。Google との双方向同期は開発予定です。",
    "view.settings.cal.androidNote": "Android では Google カレンダー (Web) で購読してください — Google アカウント経由でスマホのカレンダーに自動で同期されます。",
    "view.settings.cal.notifBlocked.title": "このサイトの通知はブロックされています。",
    "view.settings.cal.notifBlocked.body": "URL 左側の鍵アイコン → サイトの設定 → 「通知」を「許可」に → ページを再読み込みして、もう一度オンにしてください。",
    "view.settings.privacyPolicy": "プライバシーポリシー",
    "view.settings.termsOfService": "利用規約",
    "view.settings.placeholder.yourName": "名前",
    "view.groups.heading": "グループ",
    "sidebar.groups": "グループ",
    "sidebar.goals": "ゴール",
    "view.groups.subtitle": "信頼できる人とタスクを共有します。招待はオーナーの承認後に送られます。",
    "view.groups.namePlaceholder": "新しいグループ名",
    "view.groups.create": "作成",
    "view.groups.pendingInvites": "保留中の招待({n})",
    "view.groups.unknownGroup": "(不明なグループ)",
    "view.groups.accept": "参加",
    "view.groups.decline": "辞退",
    "view.groups.approveSend": "承認して送信",
    "view.groups.revoke": "取り消し",
    "view.groups.awaiting": "受諾待ち — ",
    "view.groups.needsApproval": "あなたの承認待ち — ",
    "view.groups.yourGroups": "あなたのグループ",
    "view.groups.noGroups": "まだグループがありません — 上で作成してください。",
    "view.groups.loading": "読み込み中…",
    "view.groups.roleOwner": "オーナー",
    "view.groups.roleMember": "メンバー",
    "view.groups.unknownMember": "(不明)",
    "view.groups.inviteMember": "メンバーを招待",
    "view.groups.rename": "名前を変更",
    "view.groups.delete": "削除",
    "view.groups.send": "送信",
    "view.groups.cancel": "キャンセル",
    "view.groups.save": "保存",
    "view.groups.invitePlaceholder": "invitee@example.com",
    "view.groups.groupPlaceholder": "グループ名",
    "view.groups.deleteConfirm": "グループ「{name}」を削除しますか?共有済みのタスクは残りますが、共有は切れます。元には戻せません。",
    "view.groups.toast.inviteCreated": "{email} 宛の招待を作成しました(承認待ち)",
    "view.groups.toast.inviteFailed": "招待に失敗しました",
    "view.groups.toast.createFailed": "作成に失敗しました",
    "view.groups.toast.deleteFailed": "削除に失敗しました",
    "view.groups.toast.renameFailed": "名前変更に失敗しました",
    "view.groups.toast.actionFailed": "操作に失敗しました",
    "view.groups.toast.couldntInvite": "招待を{action}できませんでした",
    "view.groups.toast.renamed": "名前を変更しました",
    "view.groups.toast.deleted": "グループを削除しました",
    "view.groups.toast.approved": "招待を承認しました — 送信済み",
    "view.groups.toast.revoked": "招待を取り消しました",
    "view.groups.toast.declined": "招待を辞退しました",
    "view.groups.toast.joined": "グループに参加しました",
    "view.groups.toast.acceptShort": "参加しました",
    "view.groups.toast.approveShort": "承認しました",
    "view.groups.toast.declineShort": "辞退しました",
    "view.groups.toast.revokeShort": "取り消しました",
    "view.groups.actionApprove": "承認",
    "view.groups.actionDecline": "辞退",
    "view.groups.actionAccept": "参加",
    "view.groups.actionRevoke": "取り消し",
    "view.calendar.today": "今日",
    "view.calendar.weekday.mon": "月",
    "view.calendar.weekday.tue": "火",
    "view.calendar.weekday.wed": "水",
    "view.calendar.weekday.thu": "木",
    "view.calendar.weekday.fri": "金",
    "view.calendar.weekday.sat": "土",
    "view.calendar.weekday.sun": "日",
    "view.calendar.aria.prevDay": "前の日",
    "view.calendar.aria.nextDay": "次の日",
    "view.calendar.openDay": "{date} を開く",
    "view.calendar.nothingScheduled": "この日に予定はありません。",
    "view.calendar.completedCount": "完了 · {n}",
    "sidebar.notifications": "通知",
    "sidebar.notifications.aria": "通知(未読 {n})",
    "sidebar.notifications.markAllRead": "すべて既読にする",
    "sidebar.notifications.markRead": "既読にする",
    "sidebar.notifications.dismiss": "閉じる",
    "sidebar.notifications.allCaught": "未読はもうありません。",
    "shared.quickAdd": "クイック追加",
    "shared.untitled": "(無題)",
    "aiActions.findTimeTooltip": "今後7日間からAIが3つの候補時間を提案",
    "aiActions.prepMeetingTooltip": "AIがアジェンダと質問の下書きを作成",
    "aiActions.estimatedTooltip": "AIが見積もった所要時間",
    "aiActions.scheduleTooltip": "この時間に入れる",
    "antiOverload.full": "今日はいっぱいです。",
    "attachments.dropHere": "ここにファイルをドロップ、または",
    "attachments.loading": "添付ファイルを読み込み中…",
    "attachments.deleteAria": "添付ファイルを削除",
    "attachments.delete": "削除",
    "dateTimePicker.pick": "日時を選択",
    "dateTimePicker.prevMonth": "前の月",
    "dateTimePicker.nextMonth": "次の月",
    "dayTimeline.allDay": "終日",
    "inlineTaskInput.enterHint": "Enterで追加",
    "languagePicker.choose": "言語を選択",
    "quickAdd.exampleTomorrow9am": "明日 9時",
    "quickAdd.exampleEveryMonday": "毎週月曜",
    "quickAdd.exampleRemind30m": "30分前にリマインド",
    "quickAdd.kbHint": "Enter ↵ · Esc",
    "reminders.enable": "ブラウザ通知を有効にする",
    "tagItem.color": "色",
    "tagItem.changeColor": "色を変更",
    "tagItem.deleteTag": "タグを削除",
    "sidebar.reflect": "振り返り",
    "sidebar.toggle": "サイドバーを切り替え",
    "sidebar.planGoal": "目標をリストとタスクに分解",
    "sidebar.reflectAria": "今日を振り返る",
    "sidebar.toggleTheme": "テーマを切り替え",
    "subtasks.loading": "サブタスクを読み込み中…",
    "subtasks.newPlaceholder": "新しいサブタスク…",
    "subtasks.deleteAria": "サブタスクを削除",
    "tagEditor.colorHint": "色を選ぶか、Enterでランダムに決まります。",
    "taskItem.repeats": "繰り返し",
    "taskItem.subtasks": "サブタスク",
    "taskItem.estimated": "見積もり時間",
    "taskList.sortByDate": "日付順",
    "taskList.loading": "読み込み中…",
    "taskList.emptyHint": "まだ何もありません。上から最初のタスクを追加してください。",
    "taskList.revertSort": "日付順に戻す",
    "view.list.shareAria": "リストを共有",
    "view.list.kanbanHint": "カードを列の間でドラッグして優先度を変更。",
    "view.tag.subtitle": "このタグが付いたすべてのタスク。",
    "ribbon.streak": "日連続",
    "ribbon.habits": "今日の習慣",
    "ribbon.q1": "緊急かつ重要",
    "comments.header": "コメント",
    "comments.placeholder": "コメントを書く… @ でメンション",
    "comments.send": "送信",
    "comments.edit": "編集",
    "comments.delete": "削除",
    "comments.cancel": "キャンセル",
    "comments.save": "保存",
    "comments.empty": "まだコメントはありません。",
    "comments.loading": "読み込み中…",
    "comments.deleteConfirm": "このコメントを削除しますか？",
    "comments.editedSuffix": "編集済み",
    "activity.title": "アクティビティ",
    "activity.subtitle": "このグループの最近の動き。",
    "activity.empty": "まだアクティビティはありません。",
    "activity.loading": "読み込み中…",
    "activity.link": "アクティビティ",
    "activity.kind.taskCreated": "タスクを追加しました",
    "activity.kind.taskCompleted": "タスクを完了しました",
    "activity.kind.taskReopened": "タスクを再開しました",
    "activity.kind.taskAssigned": "タスクを割り当てました",
    "activity.kind.taskShared": "タスクをここに共有しました",
    "activity.kind.taskDeleted": "タスクを削除しました",
    "activity.kind.taskCommented": "タスクにコメントしました",
    /* morning copilot — round E */
    "copilot.kickerSuffix": "",
    "copilot.askLabel": "ひとつ問いかけ",
    "copilot.askApply": "提案を採用",
    "copilot.askSkip": "あとで",
    "copilot.actionsLabel": "おすすめの調整",
    "copilot.actionDefer": "明日に延期",
    "copilot.actionDrop": "優先度を下げる",
    "copilot.actionBatch": "まとめる",
    "copilot.actionReschedule": "先送り",
    "copilot.snooze": "明日にもう一度",
    "copilot.dismiss": "閉じる",
    "copilot.apply": "採用",
    "copilot.applying": "実行中…",
    "copilot.empty": "静かな朝。今日はまだ白紙です。",
    "copilot.errLoad": "今日のブリーフを読み込めませんでした。",
    "copilot.tryAgain": "再試行",
    "copilot.appliedToast": "適用しました · {n} 件のタスクを調整",
    "view.settings.section.gcal": "Google カレンダー",
    "view.settings.gcal.description": "Google カレンダーの予定を First Light に読み込みます。「今日」と「カレンダー」のページに表示されるので、すでに入っている予定を避けて計画できます。読み取り専用 — Google 側の予定は変更しません。",
    "view.settings.gcal.connect": "Google カレンダーを接続",
    "view.settings.gcal.connectedAs": "接続中のアカウント",
    "view.settings.gcal.lastSync": "最終同期",
    "view.settings.gcal.lastSyncRelative": "{when}",
    "view.settings.gcal.never": "まだ同期していません",
    "view.settings.gcal.syncNow": "今すぐ同期",
    "view.settings.gcal.syncing": "同期中…",
    "view.settings.gcal.disconnect": "切断",
    "view.settings.gcal.disconnectConfirm": "Google カレンダーとの接続を解除しますか？同期した予定は First Light から削除されます。元のカレンダーには影響しません。",
    "view.settings.gcal.connectErrPrefix": "接続できませんでした：",
    "view.settings.gcal.toast.connected": "Google カレンダーを接続しました",
    "view.settings.gcal.toast.synced": "カレンダーを同期しました",
    "view.settings.gcal.toast.syncErr": "カレンダーを同期できませんでした",
    "view.settings.gcal.toast.disconnected": "Google カレンダーを切断しました",
    "view.settings.gcal.toast.disconnectErr": "切断できませんでした",
    "view.gcal.chip.allDay": "終日",
    "view.gcal.chip.untitled": "無題の予定",
    "view.today.events.heading": "今日のカレンダーの予定",
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
    "landing.footerCredit": "© 2026 First Light · 모든 권리 보유",
    "landing.footerSource": "GitHub 소스 →",
    "sidebar.addTask": "작업 추가",
    "sidebar.search": "검색…",
    "sidebar.today": "오늘",
    "view.today.heading": "오늘 일정",
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
    "sidebar.notes": "노트",
    "sidebar.features": "기능",
    "view.next90.subtitle": "앞으로 90일 이내 마감 작업.",
    "view.bucket.noDate": "날짜 없음",
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
    "view.inbox.subtitle": "모든 목록의 진행 중 작업.",
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
    "retro.titleLastWeek": "지난주, 돌아보기",
    "retro.titleNextWeek": "다음 주, 앞으로",
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
    "dailyEdition.rateLimited": "오늘의 AI 사용 한도에 도달했어요. 내일 다시 손길을 주세요.",
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
    "view.matrix.title": "정리하기",
    "view.matrix.dragHint": "사분면 사이로 드래그해 긴급도와 중요도를 조정하세요.",
    "view.matrix.planWeek": "이번 주 계획하기",
    "view.matrix.planning": "계획 중…",
    "view.matrix.q1Label": "먼저 하기",
    "view.matrix.q1Subtitle": "긴급 · 중요",
    "view.matrix.q2Label": "예약하기",
    "view.matrix.q2Subtitle": "긴급하지 않음 · 중요",
    "view.matrix.q3Label": "위임하기",
    "view.matrix.q3Subtitle": "긴급 · 중요하지 않음",
    "view.matrix.q4Label": "버리기",
    "view.matrix.q4Subtitle": "긴급하지 않음 · 중요하지 않음",
    "view.matrix.dropHere": "여기에 작업을 놓으세요.",
    "view.matrix.yourWeek": "이번 주",
    "view.matrix.itemsOne": "항목",
    "view.matrix.itemsMany": "항목",
    "view.matrix.readingList": "전체 목록을 살펴보는 중…",
    "view.matrix.allClear": "모두 정리됐어요 — 이번 주는 이미 순항 중입니다.",
    "view.matrix.applyTitle": "적용",
    "view.matrix.skipTitle": "건너뛰기",
    "view.matrix.planAria": "AI가 향후 7일을 한 번에 계획합니다",
    "view.matrix.toastNoTasks": "앞으로 7일 동안 계획할 작업이 없습니다.",
    "view.matrix.errBudget": "오늘의 주간 계획 한도를 모두 썼어요. 내일 다시 시도하세요.",
    "view.matrix.errPlan": "이번 주 계획을 만들지 못했어요. 다시 시도해 주세요.",
    "view.matrix.appliedOne": "{n}개의 제안을 적용했습니다.",
    "view.matrix.appliedMany": "{n}개의 제안을 적용했습니다.",
    "view.pomodoro.sessionsToday": "오늘 집중 세션 {n}회.",
    "view.pomodoro.modeFocus": "집중",
    "view.pomodoro.modeShortBreak": "짧은 휴식",
    "view.pomodoro.modeLongBreak": "긴 휴식",
    "view.pomodoro.start": "시작",
    "view.pomodoro.pause": "일시정지",
    "view.pomodoro.reset": "재설정",
    "view.pomodoro.stop": "정지",
    "view.pomodoro.workingOn": "진행 중",
    "view.pomodoro.noneOption": "— 없음 —",
    "view.pomodoro.toastFocusComplete": "집중 완료 — 잠시 쉬어요.",
    "view.pomodoro.toastBreakDone": "휴식 끝 — 다시 집중.",
    "view.habits.thisWeek": "이번 주 · {range}",
    "view.habits.lastWeek": "지난주 · {range}",
    "view.habits.nextWeekRange": "다음 주 · {range}",
    "view.habits.weekRange": "{range}",
    "view.habits.aria.prevWeek": "지난주",
    "view.habits.aria.nextWeek": "다음 주",
    "view.habits.aria.thisWeek": "이번 주",
    "view.habits.streakHeader": "연속",
    "view.habits.emptyText": "아직 습관이 없어요. 「새 습관」을 눌러 시작해 보세요 — 예: '20분 독서', '명상', '물 8잔 마시기'.",
    "view.habits.emptyHint": "원하는 날짜 칸을 눌러 완료로 기록하세요. 미래 날짜는 잠겨 있습니다.",
    "view.habits.intro": "습관은 매일 조금씩 이어가고 싶은 작은 행동입니다. 한 날 완료할 때마다 기록하세요 — 하루 거를 때만 연속 기록이 끊깁니다. 위의 </ > 로 지난주나 다음 주를 살펴볼 수 있어요.",
    "view.habits.newHabit": "새 습관",
    "view.habits.newHabitCta": "+ 새 습관",
    "view.habits.namePlaceholder": "예: 20분 독서",
    "view.habits.create": "만들기",
    "view.habits.tooltipLogged": "{date} 기록됨 — 클릭해 취소",
    "view.habits.tooltipLog": "{date} 기록하기",
    "view.habits.streakDays": "{n}일 연속",
    "view.habits.noStreak": "연속 기록 없음",
    "view.habits.deleteAria": "습관 {name} 삭제",
    "view.habits.deleteTitle": "습관 \"{name}\" 삭제",
    "view.habits.deleteConfirm": "습관 \"{name}\" 을(를) 삭제할까요? 목록에서 숨겨지고 지난 기록은 보존됩니다.",
    "view.settings.heading": "설정",
    "view.settings.subheader": "계정, 환경 설정, 데이터.",
    "view.settings.section.account": "계정",
    "view.settings.section.language": "언어",
    "view.settings.section.dayCapacity": "하루 용량",
    "view.settings.section.aiFeatures": "AI 기능",
    "view.settings.section.notifications": "알림",
    "view.settings.section.calendarSync": "캘린더 동기화",
    "view.settings.section.inbox": "이메일로 작업 만들기",
    "view.settings.inbox.description": "이 주소로 이메일을 전달하면 — 제목이 작업 제목이 되고 본문이 메모가 됩니다.",
    "view.settings.inbox.address": "주소",
    "view.settings.inbox.generate": "주소 생성",
    "view.settings.inbox.generating": "생성 중…",
    "view.settings.inbox.rotate": "재발급",
    "view.settings.inbox.rotateConfirm": "주소를 재발급할까요? 이전 주소는 즉시 동작을 멈춥니다.",
    "view.settings.inbox.copy": "복사",
    "view.settings.inbox.copied": "복사됨",
    "view.settings.inbox.copyAria": "주소 복사",
    "view.settings.inbox.lastReceived": "최근 수신 {time}",
    "view.settings.inbox.noEmails": "아직 받은 이메일이 없습니다.",
    "view.settings.inbox.toast.generated": "주소가 생성되었습니다",
    "view.settings.inbox.toast.rotated": "주소가 재발급되었습니다 — 이전 주소는 더 이상 작동하지 않습니다",
    "view.settings.inbox.toast.copyFailed": "복사하지 못했어요. 직접 복사해 주세요",
    "view.settings.section.import": "가져오기",
    "view.settings.section.yourData": "내 데이터",
    "view.settings.section.danger": "위험 영역",
    "view.settings.section.legal": "법적 고지",
    "view.settings.row.name": "이름",
    "view.settings.row.email": "이메일",
    "view.settings.row.session": "세션",
    "view.settings.row.signOut": "로그아웃",
    "view.settings.row.displayLanguage": "표시 언어",
    "view.settings.row.dailyCapacity": "하루 가용 시간",
    "view.settings.row.energyPeak": "집중 피크",
    "view.settings.row.to": "~",
    "view.settings.row.minutesPerDay": "분 / 일",
    "view.settings.row.from": "형식",
    "view.settings.row.file": "파일",
    "view.settings.row.export": "내보내기",
    "view.settings.row.documents": "문서",
    "view.settings.row.deleteAccount": "계정 삭제",
    "view.settings.row.subscribe": "구독",
    "view.settings.langHelp": "UI 라벨, AI 생성 브리핑, 날짜 형식이 이 언어를 따릅니다.",
    "view.settings.toggle.aiEnabled": "AI 사용",
    "view.settings.toggle.aiEnabledHint": "전체 스위치 — 끄면 아래 기능이 모두 꺼집니다.",
    "view.settings.toggle.dailyEdition": "데일리 에디션 브리핑",
    "view.settings.toggle.dailyEditionHint": "오늘 페이지에 표시되는 편집형 아침 브리핑.",
    "view.settings.toggle.smartEisenhower": "스마트 아이젠하워 자동 제안",
    "view.settings.toggle.smartEisenhowerHint": "AI · 매트릭스의 제안 버튼이 이동을 제시합니다.",
    "view.settings.toggle.voiceCapture": "음성 입력",
    "view.settings.toggle.voiceCaptureHint": "작업 추가 입력란에 표시되는 마이크 버튼.",
    "view.settings.toggle.emailReminders": "이메일 알림",
    "view.settings.toggle.emailRemindersHint": "작업 알림 시각이 되면 메일함으로 안내가 발송됩니다.",
    "view.settings.toggle.dailyDigest": "데일리 다이제스트 이메일",
    "view.settings.toggle.dailyDigestHint": "매일 오전 7시에 짧은 지면을 보내드려요: 오늘의 우선순위, 이월 작업, 연속 기록.",
    "view.settings.toggle.emailBroadcasts": "제품 업데이트 및 공지",
    "view.settings.toggle.emailBroadcastsHint": "새 기능, 팁, 중요 업데이트에 관한 이메일입니다. 설정에서 언제든 끌 수 있습니다.",
    "view.settings.toggle.pushNotifications": "푸시 알림",
    "view.settings.toggle.pushHint": "탭을 닫아도 브라우저에서 알림이 도착합니다. (iOS는 PWA 권장.)",
    "view.settings.toggle.pushUnsupported": "이 기기나 브라우저에서 사용할 수 없습니다.",
    "view.settings.toast.nameUpdated": "이름을 업데이트했어요",
    "view.settings.toast.couldntSave": "저장하지 못했어요",
    "view.settings.toast.pushOn": "푸시 알림을 켰어요",
    "view.settings.toast.pushOff": "푸시 알림을 껐어요",
    "view.settings.toast.pushBlocked": "브라우저에서 알림이 차단됐어요. 아래 안내를 확인하세요.",
    "view.settings.toast.pushUnsupported": "이 기기는 푸시 알림을 지원하지 않습니다",
    "view.settings.toast.pushFailed": "푸시 알림을 등록하지 못했어요",
    "view.settings.toast.exportDownloaded": "내보내기 파일을 받았어요",
    "view.settings.toast.couldntExport": "내보낼 수 없었어요",
    "view.settings.toast.importedOne": "{n}개의 작업을 가져왔어요",
    "view.settings.toast.importedMany": "{n}개의 작업을 가져왔어요",
    "view.settings.toast.importFailed": "가져오기에 실패했어요",
    "view.settings.toast.typeEmail": "확인을 위해 이메일을 입력하세요",
    "view.settings.toast.accountDeleted": "계정이 삭제되었습니다",
    "view.settings.toast.couldntDelete": "삭제하지 못했어요",
    "view.settings.toast.calEnabled": "캘린더 구독을 켰어요",
    "view.settings.toast.calDisabled": "구독을 중지했어요",
    "view.settings.toast.calRotated": "새 URL을 발급했어요",
    "view.settings.toast.calCopied": "복사하지 못했어요. 직접 복사해 주세요",
    "view.settings.toast.calEnableErr": "구독을 켤 수 없었어요",
    "view.settings.toast.calRotateErr": "URL을 갱신할 수 없었어요",
    "view.settings.toast.calDisableErr": "구독을 중지할 수 없었어요",
    "view.settings.delete.button": "내 계정 삭제",
    "view.settings.delete.warning": "이 작업은 계정과 모든 작업·목록·첨부·AI 브리핑을 영구적으로 지웁니다. 되돌릴 수 없습니다. 확인을 위해 이메일을 입력하세요.",
    "view.settings.delete.confirmCancel": "취소",
    "view.settings.delete.confirmAction": "영구 삭제",
    "view.settings.import.format.ticktick": "TickTick CSV",
    "view.settings.import.format.todoist": "Todoist CSV",
    "view.settings.import.format.ics": "Apple 미리 알림 / 캘린더 (.ics)",
    "view.settings.import.format.generic": "범용 CSV (제목, 기한, 목록, 완료)",
    "view.settings.import.importing": "가져오는 중…",
    "view.settings.import.help": "한 번에 최대 1,000행. 기존 작업은 그대로 두고 그 위에 추가됩니다.",
    "view.settings.exportButton": "JSON으로 다운로드",
    "view.settings.exportHelp": "작업, 목록, 태그, 습관, 포모도로 기록, 첨부, AI 브리핑/회고를 모두 내려받습니다. 이전이나 GDPR 열람 요청에 사용하세요.",
    "view.settings.cal.loading": "불러오는 중…",
    "view.settings.cal.copy": "복사",
    "view.settings.cal.copied": "복사됨",
    "view.settings.cal.copyAria": "URL 복사",
    "view.settings.cal.rotate": "URL 갱신",
    "view.settings.cal.disable": "비활성화",
    "view.settings.cal.enable": "캘린더 구독 켜기",
    "view.settings.cal.generating": "생성 중…",
    "view.settings.cal.howSubscribe": "구독하는 방법",
    "view.settings.cal.body": "읽기 전용 피드입니다. Apple 캘린더, Google 캘린더, Outlook 등 ICS를 지원하는 모든 앱에서 구독할 수 있어요 — 작업과 일정이 다른 캘린더와 함께 표시되고, 앱에 따라 15분에서 몇 시간 간격으로 자동 새로고침됩니다. 이런 캘린더에서 한 수정 사항은 First Light로 돌아오지 않습니다. Google 양방향 동기화는 로드맵에 있습니다.",
    "view.settings.cal.androidNote": "Android에서는 Google 캘린더(웹)로 구독하면 — 휴대전화 캘린더가 Google 계정을 통해 자동으로 받아옵니다.",
    "view.settings.cal.notifBlocked.title": "이 사이트의 알림이 차단되어 있습니다.",
    "view.settings.cal.notifBlocked.body": "주소창 왼쪽의 자물쇠 아이콘 → 사이트 설정 → \"알림\"을 \"허용\"으로 변경한 뒤, 페이지를 새로 고쳐 다시 켜세요.",
    "view.settings.privacyPolicy": "개인정보 처리방침",
    "view.settings.termsOfService": "이용 약관",
    "view.settings.placeholder.yourName": "이름",
    "view.groups.heading": "그룹",
    "sidebar.groups": "그룹",
    "sidebar.goals": "목표",
    "view.groups.subtitle": "신뢰하는 사람과 작업을 공유합니다. 초대는 그룹 소유자가 승인한 뒤에 발송됩니다.",
    "view.groups.namePlaceholder": "새 그룹 이름",
    "view.groups.create": "만들기",
    "view.groups.pendingInvites": "보류 중인 초대({n})",
    "view.groups.unknownGroup": "(알 수 없는 그룹)",
    "view.groups.accept": "수락",
    "view.groups.decline": "거절",
    "view.groups.approveSend": "승인 후 전송",
    "view.groups.revoke": "철회",
    "view.groups.awaiting": "수락 대기 — ",
    "view.groups.needsApproval": "승인 필요 — ",
    "view.groups.yourGroups": "내 그룹",
    "view.groups.noGroups": "아직 그룹이 없습니다 — 위에서 만들어 보세요.",
    "view.groups.loading": "불러오는 중…",
    "view.groups.roleOwner": "소유자",
    "view.groups.roleMember": "멤버",
    "view.groups.unknownMember": "(알 수 없음)",
    "view.groups.inviteMember": "멤버 초대",
    "view.groups.rename": "이름 변경",
    "view.groups.delete": "삭제",
    "view.groups.send": "보내기",
    "view.groups.cancel": "취소",
    "view.groups.save": "저장",
    "view.groups.invitePlaceholder": "invitee@example.com",
    "view.groups.groupPlaceholder": "그룹 이름",
    "view.groups.deleteConfirm": "그룹 \"{name}\" 을(를) 삭제할까요? 공유된 작업은 남지만 공유 링크는 끊깁니다. 되돌릴 수 없습니다.",
    "view.groups.toast.inviteCreated": "{email} 에 대한 초대를 만들었어요 (승인 대기)",
    "view.groups.toast.inviteFailed": "초대에 실패했어요",
    "view.groups.toast.createFailed": "만들기에 실패했어요",
    "view.groups.toast.deleteFailed": "삭제에 실패했어요",
    "view.groups.toast.renameFailed": "이름 변경에 실패했어요",
    "view.groups.toast.actionFailed": "작업에 실패했어요",
    "view.groups.toast.couldntInvite": "초대를 {action}할 수 없었어요",
    "view.groups.toast.renamed": "이름을 바꿨어요",
    "view.groups.toast.deleted": "그룹을 삭제했어요",
    "view.groups.toast.approved": "초대를 승인했어요 — 상대에게 발송됨",
    "view.groups.toast.revoked": "초대를 철회했어요",
    "view.groups.toast.declined": "초대를 거절했어요",
    "view.groups.toast.joined": "그룹에 참여했어요",
    "view.groups.toast.acceptShort": "참여함",
    "view.groups.toast.approveShort": "승인함",
    "view.groups.toast.declineShort": "거절함",
    "view.groups.toast.revokeShort": "철회함",
    "view.groups.actionApprove": "승인",
    "view.groups.actionDecline": "거절",
    "view.groups.actionAccept": "수락",
    "view.groups.actionRevoke": "철회",
    "view.calendar.today": "오늘",
    "view.calendar.weekday.mon": "월",
    "view.calendar.weekday.tue": "화",
    "view.calendar.weekday.wed": "수",
    "view.calendar.weekday.thu": "목",
    "view.calendar.weekday.fri": "금",
    "view.calendar.weekday.sat": "토",
    "view.calendar.weekday.sun": "일",
    "view.calendar.aria.prevDay": "이전 날",
    "view.calendar.aria.nextDay": "다음 날",
    "view.calendar.openDay": "{date} 열기",
    "view.calendar.nothingScheduled": "이 날 잡힌 일정이 없습니다.",
    "view.calendar.completedCount": "완료 · {n}",
    "sidebar.notifications": "알림",
    "sidebar.notifications.aria": "알림(읽지 않음 {n})",
    "sidebar.notifications.markAllRead": "모두 읽음 표시",
    "sidebar.notifications.markRead": "읽음 표시",
    "sidebar.notifications.dismiss": "닫기",
    "sidebar.notifications.allCaught": "모두 확인했어요.",
    "shared.quickAdd": "빠른 추가",
    "shared.untitled": "(제목 없음)",
    "aiActions.findTimeTooltip": "AI가 앞으로 7일 안에서 시간 후보 3개를 제안",
    "aiActions.prepMeetingTooltip": "AI가 간단한 안건과 질문을 작성",
    "aiActions.estimatedTooltip": "AI가 추정한 실제 소요 시간",
    "aiActions.scheduleTooltip": "이 시간으로 잡기",
    "antiOverload.full": "오늘은 가득 찼어요.",
    "attachments.dropHere": "여기에 파일을 끌어다 놓거나",
    "attachments.loading": "첨부 파일 불러오는 중…",
    "attachments.deleteAria": "첨부 파일 삭제",
    "attachments.delete": "삭제",
    "dateTimePicker.pick": "날짜와 시간 선택",
    "dateTimePicker.prevMonth": "이전 달",
    "dateTimePicker.nextMonth": "다음 달",
    "dayTimeline.allDay": "종일",
    "inlineTaskInput.enterHint": "Enter로 추가",
    "languagePicker.choose": "언어 선택",
    "quickAdd.exampleTomorrow9am": "내일 9시",
    "quickAdd.exampleEveryMonday": "매주 월요일",
    "quickAdd.exampleRemind30m": "30분 전에 알림",
    "quickAdd.kbHint": "Enter ↵ · Esc",
    "reminders.enable": "브라우저 알림 켜기",
    "tagItem.color": "색상",
    "tagItem.changeColor": "색상 변경",
    "tagItem.deleteTag": "태그 삭제",
    "sidebar.reflect": "회고",
    "sidebar.toggle": "사이드바 전환",
    "sidebar.planGoal": "목표를 리스트와 작업으로 분해",
    "sidebar.reflectAria": "오늘을 돌아보기",
    "sidebar.toggleTheme": "테마 전환",
    "subtasks.loading": "하위 작업 불러오는 중…",
    "subtasks.newPlaceholder": "새 하위 작업…",
    "subtasks.deleteAria": "하위 작업 삭제",
    "tagEditor.colorHint": "색을 고르거나 Enter를 눌러 무작위로 정하세요.",
    "taskItem.repeats": "반복",
    "taskItem.subtasks": "하위 작업",
    "taskItem.estimated": "예상 시간",
    "taskList.sortByDate": "날짜순",
    "taskList.loading": "불러오는 중…",
    "taskList.emptyHint": "아직 아무것도 없어요. 위에서 첫 작업을 추가하세요.",
    "taskList.revertSort": "다시 날짜순으로",
    "view.list.shareAria": "리스트 공유",
    "view.list.kanbanHint": "카드를 열 사이로 끌어 우선순위를 변경.",
    "view.tag.subtitle": "이 태그가 붙은 모든 작업.",
    "ribbon.streak": "일 연속",
    "ribbon.habits": "오늘의 습관",
    "ribbon.q1": "긴급 + 중요",
    "comments.header": "댓글",
    "comments.placeholder": "댓글 작성… @ 로 멘션",
    "comments.send": "보내기",
    "comments.edit": "수정",
    "comments.delete": "삭제",
    "comments.cancel": "취소",
    "comments.save": "저장",
    "comments.empty": "아직 댓글이 없습니다.",
    "comments.loading": "불러오는 중…",
    "comments.deleteConfirm": "이 댓글을 삭제할까요?",
    "comments.editedSuffix": "수정됨",
    "activity.title": "활동",
    "activity.subtitle": "이 그룹의 최근 활동.",
    "activity.empty": "아직 활동이 없습니다.",
    "activity.loading": "불러오는 중…",
    "activity.link": "활동",
    "activity.kind.taskCreated": "작업을 추가했습니다",
    "activity.kind.taskCompleted": "작업을 완료했습니다",
    "activity.kind.taskReopened": "작업을 다시 열었습니다",
    "activity.kind.taskAssigned": "작업을 배정했습니다",
    "activity.kind.taskShared": "작업을 여기에 공유했습니다",
    "activity.kind.taskDeleted": "작업을 제거했습니다",
    "activity.kind.taskCommented": "작업에 댓글을 남겼습니다",
    /* morning copilot — round E */
    "copilot.kickerSuffix": "",
    "copilot.askLabel": "한 가지 질문",
    "copilot.askApply": "제안 적용",
    "copilot.askSkip": "나중에",
    "copilot.actionsLabel": "제안된 조정",
    "copilot.actionDefer": "내일로 미루기",
    "copilot.actionDrop": "우선순위 낮추기",
    "copilot.actionBatch": "묶어서 처리",
    "copilot.actionReschedule": "뒤로 미루기",
    "copilot.snooze": "내일 다시 보기",
    "copilot.dismiss": "닫기",
    "copilot.apply": "적용",
    "copilot.applying": "적용 중…",
    "copilot.empty": "조용한 아침. 오늘은 아직 백지입니다.",
    "copilot.errLoad": "오늘의 브리프를 불러오지 못했습니다.",
    "copilot.tryAgain": "다시 시도",
    "copilot.appliedToast": "적용됨 · {n}개 작업 조정",
    "view.settings.section.gcal": "Google 캘린더",
    "view.settings.gcal.description": "Google 캘린더의 일정을 First Light로 가져옵니다. ‘오늘’과 ‘캘린더’ 페이지에 표시되어 이미 잡힌 일정을 피해 계획할 수 있어요. 읽기 전용 — Google 쪽 일정은 변경하지 않습니다.",
    "view.settings.gcal.connect": "Google 캘린더 연결",
    "view.settings.gcal.connectedAs": "연결된 계정",
    "view.settings.gcal.lastSync": "마지막 동기화",
    "view.settings.gcal.lastSyncRelative": "{when}",
    "view.settings.gcal.never": "동기화한 적 없음",
    "view.settings.gcal.syncNow": "지금 동기화",
    "view.settings.gcal.syncing": "동기화 중…",
    "view.settings.gcal.disconnect": "연결 해제",
    "view.settings.gcal.disconnectConfirm": "Google 캘린더 연결을 해제할까요? 동기화된 일정은 First Light에서 삭제되지만 원본 캘린더는 그대로 유지됩니다.",
    "view.settings.gcal.connectErrPrefix": "연결할 수 없습니다:",
    "view.settings.gcal.toast.connected": "Google 캘린더가 연결되었습니다",
    "view.settings.gcal.toast.synced": "캘린더를 동기화했습니다",
    "view.settings.gcal.toast.syncErr": "캘린더를 동기화할 수 없습니다",
    "view.settings.gcal.toast.disconnected": "Google 캘린더 연결을 해제했습니다",
    "view.settings.gcal.toast.disconnectErr": "연결을 해제할 수 없습니다",
    "view.gcal.chip.allDay": "종일",
    "view.gcal.chip.untitled": "제목 없는 일정",
    "view.today.events.heading": "오늘 캘린더 일정",
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
