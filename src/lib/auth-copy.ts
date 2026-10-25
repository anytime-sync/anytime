import type { LanguageCode } from './i18n';
const en = {google:'Continue with Google',redirect:'Redirecting…',stay:'Stay signed in for 30 days',emailFirst:'Enter your email first',magicSent:'Check your inbox for a sign-in link',disclosure:'Google sign-in provides your name and email address to identify your account. Calendar access is requested separately when you connect Google Calendar.',termsIntro:'By creating an account you agree to our',terms:'Terms',and:'and',privacy:'Privacy Policy'};
type Copy = typeof en;
const copy:Record<LanguageCode,Copy> = {
  en,
  'zh-TW':{google:'使用 Google 繼續',redirect:'正在前往…',stay:'保持登入 30 天',emailFirst:'請先輸入電子郵件地址',magicSent:'請至信箱查看登入連結',disclosure:'使用 Google 登入會提供你的姓名與電子郵件地址，以識別帳戶。連結 Google 行事曆時，會另外要求行事曆存取權限。',termsIntro:'建立帳戶即表示你同意我們的',terms:'服務條款',and:'與',privacy:'隱私政策'},
  'zh-CN':{google:'使用 Google 继续',redirect:'正在前往…',stay:'保持登录 30 天',emailFirst:'请先输入电子邮件地址',magicSent:'请到邮箱查看登录链接',disclosure:'使用 Google 登录会提供你的姓名与电子邮件地址，以识别账户。连接 Google 日历时，会另外请求日历访问权限。',termsIntro:'创建账户即表示你同意我们的',terms:'服务条款',and:'与',privacy:'隐私政策'},
  ja:{google:'Google で続ける',redirect:'移動中…',stay:'30日間ログインを保持',emailFirst:'先にメールアドレスを入力してください',magicSent:'メールでログインリンクを確認してください',disclosure:'Google ログインでは、アカウント識別のため名前とメールアドレスを取得します。カレンダーへのアクセス許可は、Google カレンダー接続時に別途求められます。',termsIntro:'アカウントを作成すると、次の内容に同意したものとみなされます：',terms:'利用規約',and:'および',privacy:'プライバシーポリシー'},
  ko:{google:'Google로 계속하기',redirect:'이동 중…',stay:'30일 동안 로그인 유지',emailFirst:'먼저 이메일 주소를 입력하세요',magicSent:'이메일에서 로그인 링크를 확인하세요',disclosure:'Google 로그인은 계정 식별을 위해 이름과 이메일 주소를 제공합니다. 캘린더 접근 권한은 Google 캘린더 연결 시 별도로 요청합니다.',termsIntro:'계정을 만들면 다음에 동의하게 됩니다:',terms:'이용약관',and:'및',privacy:'개인정보처리방침'},
};
export function authCopy(lang:LanguageCode):Copy { return copy[lang] ?? en; }
