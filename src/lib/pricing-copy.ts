import type { LanguageCode } from './i18n';
const en = {
  categories:{tasks:'Tasks',calendar:'Calendar',ai:'AI',review:'Review',data:'Your data',platform:'Platform'},
  feature:'Feature',included:'Included',excluded:'Not included',total:'features in total',legend:'A check means included; a lock means not included.',
  month:'month',checkout:'See checkout',free:'The core task planner, free to use.',plus:'Two-way Google Calendar sync.',pro:'Calendar sync, API/MCP access, and priority support.',
  freeItems:['Today, Tomorrow, Next 7 / 90 days, Inbox','Calendar with Google Calendar (read)','Lists, Tags, Habits, Notes, Focus','Email-to-inbox, push, daily digest','Export your data, anytime','Groups · free during beta'],
  plusItems:['Everything in Free','Two-way Google Calendar sync'],proItems:['Everything in Plus','Public API + MCP access','Priority support'],
};
type Copy = typeof en;
const copy: Record<LanguageCode,Copy> = {
  en,
  'zh-TW':{categories:{tasks:'任務',calendar:'行事曆',ai:'AI',review:'回顧',data:'你的資料',platform:'平台功能'},feature:'功能',included:'包含',excluded:'不包含',total:'項功能',legend:'勾選表示包含，鎖頭表示不包含。',month:'月',checkout:'前往結帳查看',free:'免費使用核心任務規劃工具。',plus:'Google 行事曆雙向同步。',pro:'行事曆同步、API/MCP 存取與優先支援。',freeItems:['今天、明天、未來 7／90 天、收件匣','行事曆與 Google 活動讀取','清單、標籤、習慣、筆記、專注計時','郵件轉任務、推播、每日摘要','隨時匯出資料','群組：測試期間免費'],plusItems:['包含 Free 的所有功能','Google 行事曆雙向同步'],proItems:['包含 Plus 的所有功能','公開 API 與 MCP 存取','優先支援']},
  'zh-CN':{categories:{tasks:'任务',calendar:'日历',ai:'AI',review:'回顾',data:'你的数据',platform:'平台功能'},feature:'功能',included:'包含',excluded:'不包含',total:'项功能',legend:'勾选表示包含，锁头表示不包含。',month:'月',checkout:'前往结账查看',free:'免费使用核心任务规划工具。',plus:'Google 日历双向同步。',pro:'日历同步、API/MCP 访问与优先支持。',freeItems:['今天、明天、未来 7／90 天、收件箱','日历与 Google 活动读取','清单、标签、习惯、笔记、专注计时','邮件转任务、推送、每日摘要','随时导出数据','群组：测试期间免费'],plusItems:['包含 Free 的所有功能','Google 日历双向同步'],proItems:['包含 Plus 的所有功能','公开 API 与 MCP 访问','优先支持']},
  ja:{categories:{tasks:'タスク',calendar:'カレンダー',ai:'AI',review:'振り返り',data:'データ',platform:'プラットフォーム'},feature:'機能',included:'利用可能',excluded:'対象外',total:'機能',legend:'チェックは利用可能、鍵は対象外を表します。',month:'月',checkout:'決済画面で確認',free:'基本のタスク管理を無料で利用できます。',plus:'Google カレンダー双方向同期。',pro:'カレンダー同期、API/MCP アクセス、優先サポート。',freeItems:['今日、明日、今後7日／90日、受信箱','カレンダーと Google の予定の閲覧','リスト、タグ、習慣、ノート、集中タイマー','メールからタスク作成、プッシュ通知、日次概要','いつでもデータをエクスポート','グループ：ベータ期間は無料'],plusItems:['Free のすべての機能','Google カレンダー双方向同期'],proItems:['Plus のすべての機能','公開 API と MCP アクセス','優先サポート']},
  ko:{categories:{tasks:'할 일',calendar:'캘린더',ai:'AI',review:'회고',data:'내 데이터',platform:'플랫폼'},feature:'기능',included:'포함',excluded:'미포함',total:'개 기능',legend:'체크는 포함, 자물쇠는 미포함을 뜻합니다.',month:'월',checkout:'결제 화면에서 확인',free:'기본 할 일 관리 도구를 무료로 이용하세요.',plus:'Google 캘린더 양방향 동기화.',pro:'캘린더 동기화, API/MCP 접근, 우선 지원.',freeItems:['오늘, 내일, 앞으로 7일/90일, 수신함','캘린더와 Google 일정 읽기','목록, 태그, 습관, 메모, 집중 타이머','이메일로 할 일 추가, 푸시 알림, 일일 요약','언제든 데이터 내보내기','그룹: 베타 기간 무료'],plusItems:['Free의 모든 기능','Google 캘린더 양방향 동기화'],proItems:['Plus의 모든 기능','공개 API와 MCP 접근','우선 지원']},
};
export function pricingCopy(lang: LanguageCode):Copy { return copy[lang] ?? en; }
