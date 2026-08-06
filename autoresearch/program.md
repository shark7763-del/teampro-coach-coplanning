# AutoResearch — 跆拳道訓練計畫自動改善迴圈

本檔是給 Agent 的指令。**只有教練（人類）能修改本檔**。

## 與 Karpathy AutoResearch 的關鍵差異

原版靠 `val_bpb` 這種又快又客觀的指標，可以無人過夜跑 100 輪。
本專案的品質有一半是專業判斷，且**系統內沒有 LLM**（快速備課是純規則＋模板），
因此改為雙層迴圈：

- **內層（全自動、每輪數秒）**：對 10 個固定案例產生課表 → 規則檢查器 → auto score。可連續跑很多輪。
- **外層（教練評分、低頻）**：每批 6 份 = 3 案例 × 2 版本，盲評配對。一週約 1–2 個真正的 keep 判決。

只做內層會優化出「檢查器全過但課表很爛」；只做外層則慢到無法迭代。

## 唯讀（不得修改）

- `autoresearch/benchmark/` — 固定案例
- `autoresearch/rubric/` — 評分定義與案例輪替表
- 現有 `tests/` 內的測試（只能增，不能刪改）

每輪開始與結束都必須跑 `node autoresearch/guard.mjs`；不通過即本輪作廢並回滾。

## 每輪流程

1. 讀 `autoresearch/experiments.tsv` 與目前 git 狀態
2. 提出一個可驗證的假設
3. **只改一個主要變因**
4. `node autoresearch/checker/run.mjs --tag=<round>` 對全部 10 案例重新產生
5. `node tools/check-html-js.cjs` 與 `npx playwright test` 必須全綠
6. 與 baseline 及目前最佳版本比較，**逐案例比對，不看平均**
7. 確實進步才 commit 保留；否則 `git reset --hard`
8. 結果寫入 `experiments.tsv`（**失敗與 crash 也要寫**）

## 硬性回滾條件

任一成立即回滾：課程總時間錯誤／階段缺漏／缺強度或組間休息／同課表矛盾／原本通過的測試失敗／
無法建置／手機版核心功能失效／只有平均分提高但特定案例退化／唯讀檔被更動。

尚不可自動檢測（需教練 Ground Truth）：年齡程度適配、傷病禁忌、賽前疲勞量。

## 紀律

- 實驗只在 `autoresearch/<tag>` 分支
- **不得 push main、不得部署正式網站**
- 不得刪除失敗測試、不得降低評分標準、不得只報告表現好的案例
