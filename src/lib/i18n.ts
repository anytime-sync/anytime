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
  | "sidebar.logout";

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
    "sidebar.eisenhower": "Eisenhower",
    "sidebar.pomodoro": "Pomodoro",
    "sidebar.habits": "Habits",
    "sidebar.weeklyReview": "Weekly review",
    "sidebar.lists": "Lists",
    "sidebar.tags": "Tags",
    "sidebar.noLists": "No lists yet.",
    "sidebar.noTags": "No tags yet — type #tagname in a task title.",
    "sidebar.newList": "New list",
    "sidebar.logout": "Log out",
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
    "landing.heroLine2": "為目的而發光。",
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
    "sidebar.eisenhower": "艾森豪矩陣",
    "sidebar.pomodoro": "番茄鐘",
    "sidebar.habits": "習慣",
    "sidebar.weeklyReview": "每週回顧",
    "sidebar.lists": "清單",
    "sidebar.tags": "標籤",
    "sidebar.noLists": "尚未建立清單。",
    "sidebar.noTags": "尚未有標籤 — 在任務標題中輸入 #tagname。",
    "sidebar.newList": "新清單",
    "sidebar.logout": "登出",
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
    "landing.heroLine2": "为目的而发光。",
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
    "sidebar.eisenhower": "艾森豪威尔矩阵",
    "sidebar.pomodoro": "番茄钟",
    "sidebar.habits": "习惯",
    "sidebar.weeklyReview": "每周回顾",
    "sidebar.lists": "清单",
    "sidebar.tags": "标签",
    "sidebar.noLists": "还没有清单。",
    "sidebar.noTags": "还没有标签 — 在任务标题中输入 #tagname。",
    "sidebar.newList": "新清单",
    "sidebar.logout": "退出",
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
    "landing.heroLine2": "目的を持って光を当てる。",
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
    "sidebar.eisenhower": "アイゼンハワー",
    "sidebar.pomodoro": "ポモドーロ",
    "sidebar.habits": "習慣",
    "sidebar.weeklyReview": "週次レビュー",
    "sidebar.lists": "リスト",
    "sidebar.tags": "タグ",
    "sidebar.noLists": "まだリストがありません。",
    "sidebar.noTags": "まだタグがありません — タスク名に #tagname と入力。",
    "sidebar.newList": "新しいリスト",
    "sidebar.logout": "ログアウト",
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
    "landing.heroLine2": "목적을 향해 빛을 두다.",
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
    "sidebar.eisenhower": "아이젠하워",
    "sidebar.pomodoro": "뽀모도로",
    "sidebar.habits": "습관",
    "sidebar.weeklyReview": "주간 리뷰",
    "sidebar.lists": "목록",
    "sidebar.tags": "태그",
    "sidebar.noLists": "아직 목록이 없습니다.",
    "sidebar.noTags": "아직 태그가 없습니다 — 작업 제목에 #tagname 입력.",
    "sidebar.newList": "새 목록",
    "sidebar.logout": "로그아웃",
  },
};

export function t(language: string | null | undefined, key: StringKey): string {
  const code = (LANGUAGES.find((l) => l.code === language)?.code ??
    DEFAULT_LANGUAGE) as LanguageCode;
  return STRINGS[code][key] ?? STRINGS.en[key] ?? key;
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
