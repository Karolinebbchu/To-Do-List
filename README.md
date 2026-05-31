# 每日習慣追蹤器

一個純前端 SPA，使用 React + Tailwind CSS + Lucide React 構建，資料存於 `localStorage`，無需後端，可部署到任何靜態託管平台。

## 功能特色

- **每日清單**：自動顯示今天需要完成的習慣，點擊即可標記完成
- **設定目標**：新增習慣、選擇執行日期（週一至週日）、自訂提醒時間
- **雙重提醒**：瀏覽器原生推播通知 + 網頁內 Toast 提示框
- **統計圖表**：GitHub 貢獻圖風格、環形進度圖、各星期完成率長條圖
- **完全在地化**：所有資料存於 `localStorage`，重整頁面、關閉再開都不會遺失

## 快速開始

```bash
# 1. 安裝依賴
npm install

# 2. 本地開發（預設 http://localhost:5173）
npm run dev

# 3. 建構生產版本
npm run build
```

## 部署方式

### 部署到 Vercel（推薦）

1. 將專案推送到 GitHub
2. 在 [vercel.com](https://vercel.com) 連結 GitHub Repo
3. Framework Preset 選 **Vite**，直接部署即可

### 部署到 GitHub Pages

1. 修改 `vite.config.js`，將 `base` 改為你的 Repo 名稱：
   ```js
   base: '/your-repo-name/',
   ```
2. 安裝 gh-pages 套件：
   ```bash
   npm install --save-dev gh-pages
   ```
3. 在 `package.json` 新增 script：
   ```json
   "deploy": "npm run build && gh-pages -d dist"
   ```
4. 執行 `npm run deploy`

## 技術架構

| 技術 | 版本 | 用途 |
|------|------|------|
| React | 18 | UI 框架 |
| Vite | 5 | 建構工具 |
| Tailwind CSS | 3 | 樣式系統 |
| Lucide React | 0.441 | 圖標庫 |

## 資料結構

```js
// 任務物件（儲存於 localStorage）
{
  id: "abc123",           // 唯一 ID
  name: "早晨運動",        // 任務名稱
  targetDays: ["Mon", "Wed", "Fri"],  // 執行日期
  reminderTimes: ["07:00", "20:00"],  // 提醒時間
  history: {
    "2026-05-25": true,   // 完成紀錄
    "2026-05-22": true,
  }
}
```

## 注意事項

- 提醒功能需要**保持瀏覽器頁面開啟**（純前端無法後台推送）
- 瀏覽器通知需要使用者手動允許權限
- 使用無痕模式或清除瀏覽器資料會導致習慣紀錄遺失
