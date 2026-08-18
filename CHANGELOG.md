# CHANGELOG

## 1.19.3-internal — 分組順序固定下來

- **修掉組別順序每次都跳動**：`Grouping.suggest` 產生的順序是對的（初階→中階→高階），但存進 `training_groups` 後畫面是從 IndexedDB 讀回、**照 id 排序**，而 `uid()` ＝ `Date.now()+Math.random().toString(36)` → 隨機後綴決定了組別順序。症狀是同一份週課表印兩次組別順序不同、分組頁卡片位置每次都變。
- 新增 `sort_order` 欄位：`suggest()` 產出即編號，`saveGroups()` 以卡片在畫面上的先後回寫，快速備課與示範資料也一併寫入。
- 新增 `groupsOf(dpId)` 作為唯一讀取入口（filter + 排序），全站 15 處讀取點改走這裡；依教練篩選的 2 處也套用排序。
- 舊資料沒有 `sort_order` 時，用 `GROUP_NAME_ORDER` 依組名的既定階梯排（幼兒→國小→…／低色帶→中色帶→高色帶／初階→中階→高階），認不出來的排後面再以組名比大小，保證穩定；教練下次儲存分組就會寫入正式順序。
- 測試：新增「分組順序穩定」回歸測試（sort_order 等於索引、DOM 卡片順序等於資料順序、來回切換頁面 3 次不變、課表單印出的組別順序與畫面一致）。既有的「組內分流 Level A/B/C」間歇性失敗一併解決，另把三處 `.gcard` 選擇器縮到 `#gResult` 底下，避免抓到備課頁/教練任務的同名卡片。

## 1.19.2-internal — 課表單版面修正

- **修掉表格欄位錯位**：課表單原本是三欄表頭配四欄分組列（`<th>` 只有 3 格、分組列有 4 格 `<td>`），瀏覽器自行補出第 4 欄，`width:14%/20%` 全部失效 → 名單欄留大片空白、課程內容欄被擠成一條。改用 `<colgroup>` 固定 4 欄（`table-layout:fixed`），非分組列的「內容」以 `colspan="2"` 橫跨，每列格數一律等於 4。
- **欄寬重新分配**：完整管理版 時段 15%／名單 24%／內容 46%／目標器材 15%；教練現場執行版不印名單，名單欄收到 7%，內容欄放大到 63%。
- **內容欄可讀性**：基本／腿法／品勢／對練改為逐項換行並對齊標籤，不再用「；」串成一段；A/B/C 組內分流獨立成區塊（虛線分隔、名單一行、練習內容另起一行）。學員名單改小級數灰字。
- **減少留白**：`.pday` 不再整塊 `page-break-inside:avoid`（整天課表塞不下就跳頁是留白主因），改為只保護單一列，表頭改 `<thead>` 跨頁重印。
- **時段標題不再寫死**：`0–10′ / 30–60′ / 85–90′` 改為呼叫 `timelineFor(classId)`，週六健身班（120 分）現在正確印出 `30–75′ / 75–115′ / 115–120′`，不再只印到第 90 分。
- **預覽與列印同一份樣式**：`previewPDF()` 原本用 JS 補行內樣式模擬列印外觀（會蓋掉表格樣式），改為共用同一份 CSS，畫面預覽即列印結果。
- 列印背景色加上 `print-color-adjust:exact`，存 PDF 不必再勾「背景圖形」；頁邊距 12mm → 11mm。

## 1.8.0-internal — 七步驟備課

- 備課流程由 5 步擴為 **7 步**：課程資料 / 確認人數 / 訓練分組 / 課程內容 / 教練任務 / 確認發布 / 課後紀錄。
- 新增 `view_classinfo`（步驟1：選今日班別、顯示時間/類型/主教練）與 `view_coachtasks`（步驟5：每組教練/助教/名單/目標/內容/器材/注意＋自動衝突檢查）。
- 今日工作台主 CTA 直接從步驟 1 進入；步驟完成狀態由 `planStepDone()` 計算。
- 上課模式（§四）補齊大按鈕：完成本階段 / 提前下一階段 / 延長 1・5 分鐘 / 上一階段 / 查看分組 / 傷勢紀錄 / 臨時紀錄；現場不顯示任何管理功能。

## 1.7.0-internal — 統一新增/修改

- 手機浮動新增鈕（FAB）套用到學員/班別/教練/模板/熱身頁；桌機維持右上「＋新增」。
- 班別、教練卡片統一「編輯 / 複製 / 停用·啟用」。

## 1.6.0-internal — 依角色首頁

- 管理者總覽（尚未完成備課/等待發布/未填課後/學員資料問題/同步/備份）、主教練總覽（等待我確認/未完成課後/教練團留言）。
- 助教登入直接進「我的任務」；「更多」對助教隱藏所有管理功能。

## 1.5.0-internal — 首次設定精靈

- 系統無帳號時提供 4 步精靈（道館→班別→教練團→學員），只新增不覆蓋，完成後自動以新管理者登入。

## 1.4.0-internal — 資訊架構重整

- 導覽重整為 5 區：今日 / 本週 / 我的任務 / 課程庫 / 更多（管理中心）。
- 新增課程庫（模板/熱身/歷史/PDF）；管理功能收進「更多」。
- 今日工作台改為單一主 CTA；行動式狀態文案（草稿→尚未完成備課…）。

## 1.3.x-internal — 域規則與資料

- 每堂課教練上限 `MAX_COACHES_PER_CLASS=4`（後改為只提醒、不阻擋發布）。
- 5 雄麒預設班別（暑期/健身/選手/週六健身120分/黑帶培訓）＋冪等「建立雄麒預設班別」；暑期班季節性 2026-07-06~08-26。
- 熱身動作庫 `warmup_library`（DB v4，18 預設含 Tabata，歷史快照獨立於模板）。
- 出席確認 `attendance_records`（DB v5）＋年齡/程度/專項多維度統計（各自獨立、不相加）；分組只用已確認＋臨時到課。
- 示範資料改用雄麒 5 班；示範課程符合 4 教練上限可直接發布。

## 1.2.0-internal

- IndexedDB 版本升級為 `3`，新增 `sync_outbox`、`sync_conflicts`，並將 `edit_locks` 納入同步資料。
- `save()` / `remove()` 改為在同一個 IndexedDB transaction 內寫入正式資料與永久同步佇列。
- `SYNC._q` 記憶體佇列移除，改由 `sync_outbox` 持久保存，支援失敗重試、指數退避、失敗項目重新傳送。
- Google Apps Script 後端新增 `request_id` 去重、`_rev/base_rev` 衝突偵測與 409 conflict 回覆。
- 新增 `sync_conflicts` 衝突處理：顯示我的內容、雲端內容、修改者與時間，支援使用我的版本、使用雲端版本、合併後儲存。
- 同步資料新增 `_rev`、`base_rev`、`updated_by`、`updated_device`、`updated_at`。
- 課程編輯頁新增同步編輯鎖提示，10 分鐘無活動自動失效。
- 新增「快速備課」入口，可產生五階段初稿、分組 block、器材、安全提醒、助教任務與需加強學員提示。
- 首頁改為今日教練工作台，第一屏顯示下一堂課、預計人數、分組數、教練、備課完成率、異常、待同步與最近備份。
- PWA 更新流程改為有提示更新：發現新版本時顯示「系統已有新版本」，按「立即更新」才切換 Service Worker。
- Service Worker cache 升級為 `teampro-coplanning-v8`，保留 Network First 導覽與 Cache First 靜態資源。
- Modal 新增 focus trap，非危險 Modal 支援 Esc 關閉。
- 新增 Playwright 測試檔與 `tools/check-html-js.cjs` 語法檢查。

## 1.1.5-internal

- 學員管理新增批量選取與批量刪除。
- 可全選目前篩選結果、清除選取、刪除選取學員。
- 批量刪除會建立自動備份，要求管理者 PIN 與「確認刪除」文字確認。
- 批量刪除會同步從既有分組中移除被刪除學員 ID。
- Service Worker cache 升級為 `teampro-coplanning-v7`。

## 1.1.4-internal

- 新增「刪除示範學員」管理者操作，只刪除 `demo:true` 學員，正式匯入學員不受影響。
- 刪除示範學員前會自動備份，並需管理者 PIN 與「刪除示範」文字確認。
- 刪除後會同步從既有分組中移除示範學員 ID。
- Service Worker cache 升級為 `teampro-coplanning-v6`。

## 1.1.3-internal

- 匯入級別新增相容：`紅黑頭` 轉為 `黑頭`、`紅1線` 轉為 `紅一線`、`紅2線` 轉為 `紅二線`。
- Service Worker cache 升級為 `teampro-coplanning-v5`。

## 1.1.2-internal

- 更新級別/段位清單：白帶、黃帶、黃藍帶、藍帶、藍紅帶、紅帶、紅一線、紅二線、黑頭、一段、兩段、三段、四段。
- 匯入時相容舊名稱：`紅黑帶` 轉為 `黑頭`，`二段` 轉為 `兩段`，`四段以上` 轉為 `四段`。
- 更新預設能力分層與學員名單 CSV 範本。
- Service Worker cache 升級為 `teampro-coplanning-v4`。

## 1.1.1-internal

- 修正登入頁載入示範資料時，IndexedDB 尚未就緒可能造成 `Cannot read properties of null (reading 'transaction')`。
- `DB.open()` 改為可重入，並處理 blocked / versionchange / close。
- 新增 `ensureDbReady()`，在示範資料建立前強制確認 IndexedDB 已開啟。
- Service Worker cache 升級為 `teampro-coplanning-v3`，避免舊快取持續載入問題版本。

## 1.1.0-internal

- 取消 `tp_user` 自動登入，改用 `tp_last_user` 只記錄最近登入帳號。
- 新增 30 分鐘閒置自動鎖定：`App.startIdleLock()`、`App.resetIdleLock()`、`App.stopIdleLock()`、`App.lockForIdle()`。
- 新增管理者 PIN 安全驗證：`App.requireAdminPin(options)`。
- 新增 IndexedDB `backups` object store，資料庫版本由 `1` 升級為 `2`。
- 新增 `BackupManager.create/list/download/restore/remove/cleanup`。
- 清空全部資料、載入示範資料覆蓋、JSON 匯入覆蓋、還原備份、本機覆蓋雲端均需管理者 PIN 與文字確認。
- `SYNC.replaceAll()` 改為安全流程，實際 API 呼叫拆為受 token 保護的 `_replaceAllUnsafe()`。
- 同步狀態新增待同步筆數、最後同步時間、最後錯誤與網路離線顯示。
- `sw.js` 升級為 `teampro-coplanning-v2`，導覽與 `index.html` 採 Network First，靜態資源採 Cache First。
- 系統設定與更多頁面顯示 `APP_VERSION`。

## 修改過的主要函式

- `App.boot`
- `App.renderLogin`
- `App.doLogin`
- `App.logout`
- `App.startIdleLock`
- `App.resetIdleLock`
- `App.stopIdleLock`
- `App.lockForIdle`
- `App.requireAdminPin`
- `App.seedFromLogin`
- `App.wipeAll`
- `SYNC.pendingCount`
- `SYNC._flush`
- `SYNC.pull`
- `SYNC.replaceAll`
- `SYNC._replaceAllUnsafe`
- `SYNC.retryFailed`
- `SYNC.resolveConflict`
- `SYNC.showConflict`
- `SYNC.immediate`
- `SYNC.bindNetwork`
- `Views.view_quickplan`
- `Views.generateQuickPlan`
- `Views.quickCopyPrev`
- `Views.quickCopyLastWeek`
- `Views.quickApplyTemplate`
- `Views.quickCarryUnfinished`
- `touchEditLock`
- `currentEditLock`
- `Views.view_settings`
- `Views.cloudUpload`
- `Views.syncNow`
- `Views.importData`
- `Views.delStudent`
- `Views.delClass`
- `Views.delCoach`
- `Views.delTpl`
- `Views.lockPlan`
- `wipeData`

## IndexedDB

- `DB_VER`: `2` -> `3`
- 新增 object store: `sync_outbox`, `sync_conflicts`
- 新增同步資料 store: `edit_locks`
- `DB_VER`: `1` -> `2`
- 新增 object store: `backups`
- 正式資料 store 保持原資料格式不變。
- `DATA_STORES` 保留原有正式資料表，`STORES` 追加本機 `backups`。

## GitHub Pages 部署

1. 到 GitHub repository `shark7763-del/teampro-coach-coplanning`。
2. 開啟 `Settings` -> `Pages`。
3. `Build and deployment` 選 `Deploy from a branch`。
4. Branch 選 `main`，資料夾選 `/root`。
5. 儲存後等待 GitHub Pages 完成部署。
6. 部署完成後開啟 Pages URL，重新整理一次以取得新版 service worker。
