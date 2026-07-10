# CHANGELOG

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
