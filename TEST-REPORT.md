# TEST REPORT

版本：`1.8.0-internal`

## 1.8.0 自動化測試（real-IndexedDB E2E）

以 Node `vm` + `fake-indexeddb` 對「真實 IndexedDB 資料層＋所有 view render」跑 **89/89 全數通過**（`scratchpad/e2e-real.js`），涵蓋：

- 核心手順：種子→出席→分組→五階段備課→討論→發布→課後銜接→PDF（無 undefined）。
- 資料相容：DB v3→v4→v5 遷移後既有 store 保留，新增 warmup_library / attendance_records。
- 域規則：4 教練上限偵測（toomany/dualrole/sameperson/inactive）、發布不硬擋（只警告）、saveGroups 允許但警告。
- 雄麒 5 班：冪等建立（0 新增 5 已存在）、週六 120 分、暑期班季節內外判斷。
- 熱身庫：18 預設含 Tabata、冪等、班別推薦、加入寫快照、歷史快照不受模板改動、自訂即時可用、平均分配=20。
- 出席：未點名退回名單、attendingFor 只含已確認＋臨時、多維度三軸各自總和=出席數。
- 角色首頁：管理者/主教練總覽可產生、助教無總覽且更多無管理項目。
- 首次精靈：建立道館/管理者/教練/所選班別/示範學員並自動登入（只新增不覆蓋）。
- 統一 CRUD：FAB 動作齊全、班別/教練可複製與停用。
- 七步驟：`classinfo,stats,groups,plan,coachtasks,publish,report` 且新步驟 view 正常 render。
- 上課模式：render、下一階段、延長分鐘。

每次改單檔後皆先跑 `node vm` 語法檢查（12 段全通過、無重複頂層宣告），再跑上述 E2E。

## 待補：Playwright 全瀏覽器互動測試（§十）

`tests/`＋`playwright.config.js` 已就位；瀏覽器層（點擊/PWA 更新/離線/PDF 列印）之完整 Playwright 套件為後續工作，目前由上述 89 項 node 自動化 + 手機實測覆蓋。

## 1.2.0 自動化測試（歷史）

## 自動化測試

新增 Playwright 測試：`tests/teampro-1.2.spec.js`

執行結果：`npm run test:e2e` 通過，6/6 passed。

覆蓋項目：

- 管理者登入。
- 重新整理後回到 PIN 頁。
- PIN 錯誤不可進入。
- 助教從 console 呼叫 `App.wipeAll()` 仍被拒絕。
- 離線編輯後 `sync_outbox` 持久化，重新整理後仍存在。
- 快速備課產生五階段初稿。
- 同步衝突 Modal 顯示我的內容與雲端內容。
- 360px 手機畫面檢查沒有水平溢出。

執行方式：

```bash
npm install
npm run check:js
npm run test:e2e
```

## 手動驗收建議

### 登入

- 登入後重新整理：應回到 PIN 登入頁。
- 最近登入帳號：應排第一並顯示「最近登入」。
- PIN 錯誤：不可進入系統，PIN 欄位清空。
- 登出：PIN 欄位清空。
- 閒置 30 分鐘：自動鎖定並顯示提示。

### 永久同步佇列

- 離線新增、修改、刪除正式資料後重新整理：`sync_outbox` 筆數仍存在。
- 恢復網路：自動 `_flush()` 與 `pull()`。
- 單筆失敗：該筆標記 `failed`，其他項目仍可繼續同步。
- 「重新傳送失敗項目」：失敗項目重新排入 `queued`。

### 衝突

- 兩個裝置修改同一筆同 `_rev` 資料：第一筆成功，第二筆收到 409。
- 衝突資料進入 `sync_conflicts`。
- 可選擇使用我的版本、使用雲端版本或合併後儲存。
- 討論留言以單筆新增方式同步，不整包覆蓋。

### 備份

- 清空、載入示範、匯入 JSON、覆蓋雲端、批量刪除、還原前均建立備份。
- 備份最多保留 10 份。
- 還原前後各 store 筆數應一致。

### PWA

- 更新 `index.html` 後，Service Worker 發現新版應顯示「系統已有新版本」。
- 按「立即更新」才切換新版。
- 舊 cache 自動移除。
- CDN 失敗不會導致 install 失敗。
- 離線時仍可開啟已快取頁面。

## 語法檢查

- `tools/check-html-js.cjs` 會抽出 `index.html` 的 inline script 並用 Node `vm.Script` 檢查 SyntaxError。
- `sw.js` 可用 `node --check sw.js` 檢查。

已執行：

- `npm run check:js`：通過。
- `node --check sw.js`：通過。
- `node --check tests/teampro-1.2.spec.js`：通過。
- `apps-script/Code.gs` 複製為暫存 `.js` 後 `node --check`：通過。

## 殘餘風險

- Apps Script 409 conflict 需要部署新版 `apps-script/Code.gs` 後才會生效。
- Playwright 需要先安裝 npm 依賴與瀏覽器 runtime。
