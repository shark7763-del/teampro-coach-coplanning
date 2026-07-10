# MIGRATION

## 1.1.5-internal -> 1.2.0-internal

### IndexedDB

- `DB_VER` 由 `2` 升級為 `3`。
- 新增 object store:
  - `sync_outbox`
  - `sync_conflicts`
- 新增同步資料 store:
  - `edit_locks`
- 原有 store 保留，不清除正式資料:
  - `settings`
  - `profiles`
  - `students`
  - `classes`
  - `weekly_plans`
  - `daily_plans`
  - `training_groups`
  - `lesson_blocks`
  - `discussions`
  - `post_class_reports`
  - `course_templates`
  - `audit_logs`
  - `backups`

### 資料欄位

同步資料會在下次儲存時自動補上:

- `_rev`
- `base_rev`
- `updated_by`
- `updated_device`
- `updated_at`

舊資料不需要手動轉換。第一次被修改時會從目前版本開始建立 `_rev`。

### Google Apps Script

請將 `apps-script/Code.gs` 部署為新版本。既有 `DB` 分頁會自動補欄位:

- `rev`
- `updated_by`
- `updated_at`

也會新增 `REQUEST_LOG` 分頁，用於 `request_id` 去重。

### 回復上一版本

1. 在 GitHub 找到上一版 commit。
2. 將 `index.html`、`sw.js`、`manifest.webmanifest`、`apps-script/Code.gs` 回復到上一版。
3. 重新部署 GitHub Pages。
4. 如已部署 Apps Script 1.2.0，可保留新欄位；上一版前端會忽略多出的試算表欄位。
5. 若需要完整資料回復，登入管理者後從「備份與還原」下載或還原升級前備份。

### GitHub Pages 部署

1. Commit 並 push 到 `main`。
2. 到 GitHub repository `shark7763-del/teampro-coach-coplanning`。
3. `Settings` -> `Pages`。
4. `Build and deployment` 選 `Deploy from a branch`。
5. Branch 選 `main`，資料夾選 `/root`。
6. 等 GitHub Pages 完成部署後，開啟 Pages URL。
7. 系統若顯示「系統已有新版本」，按「立即更新」。
