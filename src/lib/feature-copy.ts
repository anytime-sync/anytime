import type { LanguageCode } from './i18n';
import type { FeatureSpec } from './plans';

// Each entry follows the stable feature ID, never the position in a plan.
const zhTW: Record<string, [string, string]> = {
  tasks_today:['今天','查看今天的任務，設定優先順序與時間。'],
  tasks_tomorrow:['明天','提前整理明天的工作。'],
  tasks_next7:['未來 7 天','一起查看未來一週的任務與行事曆活動。'],
  tasks_next90:['未來 90 天','查看未來 90 天到期的任務。'],
  tasks_inbox:['收件匣','集中收集尚未歸入清單的任務。'],
  tasks_lists:['清單','依專案整理任務，搭配篩選條件使用。'],
  tasks_tags:['標籤','跨清單分類與篩選任務。'],
  tasks_groups:['群組','將清單與標籤整合至共享工作空間。'],
  tasks_matrix:['優先順序矩陣','依緊急性與重要性整理任務。'],
  tasks_pomodoro:['專注計時器','為目前的任務計時並記錄專注時間。'],
  tasks_habits:['習慣','追蹤日常習慣與持續完成的紀錄。'],
  tasks_notes:['筆記','建立獨立筆記，或將筆記連結至任務。'],
  tasks_notes_to_task:['筆記轉任務','將筆記轉成連結的任務，也可將任務轉成筆記。'],
  tasks_completed:['已完成紀錄','搜尋與查看已完成的任務。'],
  cal_view:['行事曆檢視','以月、週或日檢視一起查看任務與活動。'],
  cal_gcal_read:['讀取 Google 行事曆','在任務旁查看 Google 行事曆活動。'],
  cal_drag:['拖曳調整時間','在支援的行事曆檢視中，拖曳任務與可編輯活動來調整時間。'],
  cal_gcal_write:['Google 行事曆雙向同步','建立與編輯 Google 行事曆活動。'],
  data_export:['匯出資料','下載任務、清單、標籤、習慣、專注時間及已儲存回顧的 JSON 資料。'],
  data_import:['匯入資料','支援從 TickTick、Todoist、ICS 與 CSV 匯入。'],
  data_inbox_email:['郵件轉任務','將郵件轉寄至私人專屬地址，加入收件匣。'],
  plat_push:['推播通知','透過支援的瀏覽器與 PWA 接收提醒。'],
  plat_email_digest:['每日郵件摘要','透過郵件查看每日待辦摘要。'],
  plat_email_reminders:['郵件提醒','為個別任務設定郵件提醒。'],
  plat_priority_support:['優先支援','優先處理 Pro 使用者的支援需求。'],
  plat_api_access:['公開 API 與 MCP','使用授權權杖連接相容的外部工具，讀取與編輯記錄。'],
};
const zhCN: Record<string, [string, string]> = {
  tasks_today:['今天','查看今天的任务，设置优先顺序与时间。'],tasks_tomorrow:['明天','提前整理明天的工作。'],tasks_next7:['未来 7 天','一起查看未来一周的任务与日历活动。'],tasks_next90:['未来 90 天','查看未来 90 天到期的任务。'],tasks_inbox:['收件箱','集中收集尚未归入清单的任务。'],tasks_lists:['清单','按项目整理任务，搭配筛选条件使用。'],tasks_tags:['标签','跨清单分类与筛选任务。'],tasks_groups:['群组','将清单与标签整合至共享工作空间。'],tasks_matrix:['优先顺序矩阵','按紧急性与重要性整理任务。'],tasks_pomodoro:['专注计时器','为当前任务计时并记录专注时间。'],tasks_habits:['习惯','追踪日常习惯与持续完成的记录。'],tasks_notes:['笔记','建立独立笔记，或将笔记关联至任务。'],tasks_notes_to_task:['笔记转任务','将笔记转成关联的任务，也可将任务转成笔记。'],tasks_completed:['已完成记录','搜索与查看已完成的任务。'],cal_view:['日历视图','以月、周或日视图一起查看任务与活动。'],cal_gcal_read:['读取 Google 日历','在任务旁查看 Google 日历活动。'],cal_drag:['拖动调整时间','在支持的日历视图中，拖动任务与可编辑活动来调整时间。'],cal_gcal_write:['Google 日历双向同步','创建与编辑 Google 日历活动。'],data_export:['导出数据','下载任务、清单、标签、习惯、专注时间及已保存回顾的 JSON 数据。'],data_import:['导入数据','支持从 TickTick、Todoist、ICS 与 CSV 导入。'],data_inbox_email:['邮件转任务','将邮件转发至私人专属地址，加入收件箱。'],plat_push:['推送通知','通过支持的浏览器与 PWA 接收提醒。'],plat_email_digest:['每日邮件摘要','通过邮件查看每日待办摘要。'],plat_email_reminders:['邮件提醒','为单个任务设置邮件提醒。'],plat_priority_support:['优先支持','优先处理 Pro 用户的支持需求。'],plat_api_access:['公开 API 与 MCP','使用授权令牌连接兼容的外部工具，读取与编辑记录。'],
};
const ja: Record<string, [string, string]> = {
  tasks_today:['今日','今日のタスク、優先度、日時を確認・設定します。'],tasks_tomorrow:['明日','明日の作業を前もって整理します。'],tasks_next7:['今後7日間','1週間のタスクとカレンダーの予定を確認します。'],tasks_next90:['今後90日間','今後90日間に期限を迎えるタスクを確認します。'],tasks_inbox:['受信箱','リストに分類していないタスクをまとめます。'],tasks_lists:['リスト','プロジェクト別にタスクを整理・絞り込みます。'],tasks_tags:['タグ','リストをまたいでタスクを分類・絞り込みます。'],tasks_groups:['グループ','リストとタグを共有ワークスペースにまとめます。'],tasks_matrix:['優先度マトリクス','緊急度と重要度でタスクを整理します。'],tasks_pomodoro:['集中タイマー','作業中のタスクに紐づけて集中時間を記録します。'],tasks_habits:['習慣','日々の習慣と継続記録を確認します。'],tasks_notes:['ノート','独立したノートやタスクに紐づくノートを作成します。'],tasks_notes_to_task:['ノートをタスクに変換','ノートとタスクを相互に変換・関連付けします。'],tasks_completed:['完了履歴','完了したタスクを検索・確認します。'],cal_view:['カレンダー表示','月・週・日単位でタスクと予定を表示します。'],cal_gcal_read:['Google カレンダーの閲覧','タスクと一緒に Google の予定を表示します。'],cal_drag:['ドラッグで日時変更','対応する表示でタスクや編集可能な予定を移動します。'],cal_gcal_write:['Google カレンダー双方向同期','Google の予定を作成・編集します。'],data_export:['データのエクスポート','タスク、リスト、タグ、習慣、集中時間、保存済み振り返りを JSON で取得します。'],data_import:['インポート','TickTick、Todoist、ICS、CSV から取り込みます。'],data_inbox_email:['メールからタスク作成','専用アドレスへの転送で受信箱に追加します。'],plat_push:['プッシュ通知','対応ブラウザーや PWA でリマインダーを受け取ります。'],plat_email_digest:['メールダイジェスト','その日のタスク概要をメールで確認します。'],plat_email_reminders:['メールリマインダー','タスクごとにメール通知を設定します。'],plat_priority_support:['優先サポート','Pro のお問い合わせを優先して対応します。'],plat_api_access:['公開 API と MCP','認証トークンで対応する外部ツールを接続し、記録を読み取り・編集します。'],
};
const ko: Record<string, [string, string]> = {
  tasks_today:['오늘','오늘 할 일의 우선순위와 시간을 설정합니다.'],tasks_tomorrow:['내일','내일 할 일을 미리 정리합니다.'],tasks_next7:['앞으로 7일','일주일의 할 일과 캘린더 일정을 함께 확인합니다.'],tasks_next90:['앞으로 90일','90일 이내에 마감되는 할 일을 확인합니다.'],tasks_inbox:['수신함','목록에 분류하지 않은 할 일을 모아둡니다.'],tasks_lists:['목록','프로젝트별로 할 일을 정리하고 필터링합니다.'],tasks_tags:['태그','여러 목록의 할 일을 분류하고 필터링합니다.'],tasks_groups:['그룹','목록과 태그를 공유 작업 공간에 모읍니다.'],tasks_matrix:['우선순위 매트릭스','긴급도와 중요도로 할 일을 정리합니다.'],tasks_pomodoro:['집중 타이머','진행 중인 할 일의 집중 시간을 기록합니다.'],tasks_habits:['습관','일상 습관과 연속 달성 기록을 확인합니다.'],tasks_notes:['메모','독립 메모를 만들거나 할 일에 연결합니다.'],tasks_notes_to_task:['메모를 할 일로 변환','메모와 할 일을 서로 변환하고 연결합니다.'],tasks_completed:['완료 기록','완료한 할 일을 검색하고 확인합니다.'],cal_view:['캘린더 보기','월·주·일 보기에서 할 일과 일정을 함께 확인합니다.'],cal_gcal_read:['Google 캘린더 읽기','할 일 옆에서 Google 일정을 확인합니다.'],cal_drag:['드래그로 일정 변경','지원되는 보기에서 할 일과 편집 가능한 일정을 이동합니다.'],cal_gcal_write:['Google 캘린더 양방향 동기화','Google 일정을 만들고 편집합니다.'],data_export:['데이터 내보내기','할 일, 목록, 태그, 습관, 집중 시간, 저장된 회고를 JSON으로 받습니다.'],data_import:['가져오기','TickTick, Todoist, ICS, CSV에서 가져옵니다.'],data_inbox_email:['이메일을 할 일로 변환','전용 주소로 전달한 이메일을 수신함에 추가합니다.'],plat_push:['푸시 알림','지원되는 브라우저와 PWA에서 알림을 받습니다.'],plat_email_digest:['이메일 요약','매일 할 일 요약을 이메일로 확인합니다.'],plat_email_reminders:['이메일 알림','할 일마다 이메일 알림을 설정합니다.'],plat_priority_support:['우선 지원','Pro 사용자의 지원 요청을 우선 처리합니다.'],plat_api_access:['공개 API와 MCP','인증 토큰으로 호환되는 외부 도구를 연결하여 기록을 읽고 편집합니다.'],
};
export const FEATURE_COPY = {'zh-TW':zhTW,'zh-CN':zhCN,ja,ko};
export function featureCopy(feature: FeatureSpec, lang: LanguageCode) {
  const entry = lang === 'en' ? undefined : FEATURE_COPY[lang]?.[feature.id];
  return entry ? {label:entry[0],description:entry[1]} : feature;
}
