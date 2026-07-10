# CHANGELOG

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
- `SYNC.immediate`
- `SYNC.bindNetwork`
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
