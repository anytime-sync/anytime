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
  | "auth.shared.language";

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
  } catch {}
}
