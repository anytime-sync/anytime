import type { LanguageCode } from './i18n';

const en = {
  welcome: 'Welcome to First Light', title: 'Start with one small task',
  subtitle: 'Choose something you would like to finish today.',
  action: 'Add tasks for today', detail: 'Add up to three tasks. One is enough to get started.',
  skip: 'Skip for now', close: 'Close', back: 'Back',
  tasksTitle: 'Your tasks for today', hint: 'Keep them small. You can change the date or time later.',
  examples: ['e.g. Draft the email', 'e.g. Read one chapter', 'e.g. Take a short walk'],
  adding: 'Adding…', add: 'Add to Today', saved: 'Tasks added to Today',
  error: 'Some tasks could not be saved. Saved tasks have been cleared; retry the remaining ones.',
};
type Copy = typeof en;
const copies: Record<LanguageCode, Copy> = {
  en,
  'zh-TW': {welcome:'歡迎使用 First Light',title:'從一件小事開始',subtitle:'選一件今天想完成的事。',action:'新增今天的任務',detail:'最多新增三件任務。先寫一件也可以。',skip:'暫時略過',close:'關閉',back:'返回',tasksTitle:'今天想完成的事',hint:'先從小事開始，稍後可以調整日期與時間。',examples:['例如：撰寫郵件','例如：讀完一個章節','例如：出門散步'],adding:'正在新增…',add:'加入今天',saved:'已加入今天的任務',error:'部分任務未能儲存。已儲存的欄位已清空，請重試其餘任務。'},
  'zh-CN': {welcome:'欢迎使用 First Light',title:'从一件小事开始',subtitle:'选一件今天想完成的事。',action:'添加今天的任务',detail:'最多添加三件任务。先写一件也可以。',skip:'暂时跳过',close:'关闭',back:'返回',tasksTitle:'今天想完成的事',hint:'先从小事开始，稍后可以调整日期和时间。',examples:['例如：撰写邮件','例如：读完一个章节','例如：出门散步'],adding:'正在添加…',add:'加入今天',saved:'已加入今天的任务',error:'部分任务未能保存。已保存的字段已清空，请重试其余任务。'},
  ja: {welcome:'First Lightへようこそ',title:'小さなタスクから始めましょう',subtitle:'今日終わらせたいことを選びましょう。',action:'今日のタスクを追加',detail:'最大3件まで追加できます。まずは1件でも大丈夫です。',skip:'今はスキップ',close:'閉じる',back:'戻る',tasksTitle:'今日やりたいこと',hint:'小さなことから。日時は後で変更できます。',examples:['例：メールの下書き','例：本を1章読む','例：少し散歩する'],adding:'追加中…',add:'今日に追加',saved:'今日のタスクに追加しました',error:'一部のタスクを保存できませんでした。保存済みの欄は空になっています。残りを再試行してください。'},
  ko: {welcome:'First Light에 오신 것을 환영합니다',title:'작은 할 일 하나부터 시작하세요',subtitle:'오늘 마치고 싶은 일을 선택하세요.',action:'오늘 할 일 추가',detail:'최대 3개를 추가할 수 있습니다. 하나만 적어도 좋습니다.',skip:'지금은 건너뛰기',close:'닫기',back:'뒤로',tasksTitle:'오늘 하고 싶은 일',hint:'작게 시작하세요. 날짜와 시간은 나중에 바꿀 수 있습니다.',examples:['예: 이메일 초안 작성','예: 책 한 장 읽기','예: 짧게 산책하기'],adding:'추가 중…',add:'오늘에 추가',saved:'오늘 할 일에 추가했습니다',error:'일부 할 일을 저장하지 못했습니다. 저장된 항목은 입력란에서 지워졌습니다. 남은 항목을 다시 시도하세요.'},
};
export function onboardingCopy(lang: LanguageCode): Copy { return copies[lang] ?? en; }
