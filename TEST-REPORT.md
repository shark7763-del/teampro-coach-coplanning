# TEST REPORT

版本：`1.2.0-internal`

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
