# TEST REPORT

版本：`1.1.2-internal`

## 已執行檢查

- `node --check` 檢查 `index.html` 內嵌 JavaScript：通過。
- `node --check sw.js`：通過。
- `DB.open()` 可重入與 `ensureDbReady()` 已加入，避免示範資料流程在 DB 尚未開啟時寫入。
- 匯入級別測試：`紅二線`、`黑頭`、`兩段` 均在 `BELTS` 清單內；舊值 `紅黑帶`、`二段`、`四段以上` 會自動轉換。
- 搜尋 `tp_user`：未再用於自動登入。
- 搜尋 `confirm(`：僅保留發布未完成課程時的提醒確認，不涉及刪除、清空、匯入、還原或雲端覆蓋。
- 搜尋 `replaceAll`：UI 對外流程走 `SYNC.replaceAll()`，內部 `_replaceAllUnsafe()` 需要 token。

## 登入測試

1. 登入後重新整理回到 PIN 頁：已由移除 `App.boot()` 的 `tp_user` 自動登入邏輯完成。
2. 最近登入帳號排第一：`tp_last_user` 用於排序與預選。
3. PIN 錯誤不可進入：`App.doLogin()` 會清空 PIN 並停留登入頁。
4. 登出後 PIN 清空：`App.logout()` 會清空 `#pinInput`。
5. 閒置 30 分鐘自動鎖定：已實作 timer；未實際等待 30 分鐘，依程式碼路徑檢查。

## 權限測試

1. 助教無法清空資料：`App.wipeAll()` 先檢查 `State.user.role === 'admin'`。
2. 主教練無法覆蓋雲端：`SYNC.replaceAll()` 先檢查管理者。
3. console 直接呼叫 `App.wipeAll()`：函式層會拒絕非管理者。
4. 管理者 PIN 錯誤不執行：`App.requireAdminPin()` 會留在 Modal 並顯示錯誤。

## 備份測試

1. 清空前自動備份：`App.wipeAll()` 先呼叫 `BackupManager.create()`。
2. 備份失敗停止清空：`BackupManager.create()` throw 時流程 return。
3. 最多保留 10 份：`BackupManager.cleanup()` 刪除第 11 份後的舊備份。
4. 下載 JSON：`BackupManager.download(id)` 產出 JSON Blob。
5. 還原備份：`BackupManager.restore(id)` 需管理者 PIN 與文字確認。
6. 還原前自動備份：還原流程使用 `backupReason:'還原前自動備份'`。

## 同步測試

1. 離線編輯顯示待同步筆數：`SYNC.pendingCount()` 與 pill 顯示已實作。
2. 恢復網路自動同步：`SYNC.bindNetwork()` 監聽 `online` 後執行 `_flush()` 與 `pull()`。
3. 同步成功清空待同步筆數：`_flush()` 成功後批次移出佇列。
4. `replaceAll` 必須管理者 PIN 與文字確認：已實作。
5. 同步失敗不影響本機資料：失敗時佇列回補，本機資料不清除。

## PWA 測試

1. `index.html` 更新採 Network First：`sw.js` 已改為 `networkFirst()`。
2. 舊 cache 移除：`activate` 刪除非 `teampro-coplanning-v2` cache。
3. 離線仍可開啟：導覽失敗時回 cache。
4. CDN 失敗不會讓 install 失敗：install 階段每個資源各自 `catch`。

## 原功能保留確認

- 備課、分組、週計畫、課後紀錄與 PDF 相關 view 未刪除。
- IndexedDB 原正式資料 store 名稱與資料格式保留。
- Google Apps Script 同步 URL 與同步機制保留。
- 單檔 `index.html` 架構保留。
