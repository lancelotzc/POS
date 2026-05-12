# POS 系統程式製作步驟說明檔 (Development Task List)

本文件依據最終確認的《POS 系統架構規劃》所產出，將龐大的系統切分為可執行的開發階段。我們將依據此檢查表 (Checklist) 進行程式碼開發。

## Phase 1: 專案初始化與基礎設施 (Project Setup & Infra)
- [ ] 建立 `pos-cloud` 專案 (使用 React/Next.js/Vite，準備部署至 Vercel)
- [ ] 建立 `pos-edge` 專案 (使用 React/Vite，支援離線與 Local Master-Slave)
- [ ] 建立共用樣式庫 (Vanilla CSS, Glassmorphism UI) 與 i18n 多語系套件
- [ ] 建立與設定 Supabase 專案 (PostgreSQL, Authentication)

## Phase 2: 資料庫結構與 SaaS 多租戶 (DB Schema & Security)
- [ ] 實作三層式 RBAC 權限與多租戶關聯 (Tenants, Stores, Roles)
- [ ] 設定 Supabase Row Level Security (RLS) 確保資料隔離
- [ ] 建立菜單與基礎資料表 (Products, Categories, Combos, Modifiers)
- [ ] 建立進階庫存表 (Raw Materials, Products, Unit Conversions, Ledger)
- [ ] 建立訂單與支付表 (Orders, Order Items Snapshot, Payments)

## Phase 3: 雲端後台開發 (POS Cloud - Web Dashboard)
- [ ] 實作 登入與權限管理模組 (區分 Super Admin 與 Tenant Admin)
- [ ] 實作 總部管理與門店授權狀態控制 (License Control)
- [ ] 實作 菜單 / 套餐 / 加料管理模組 (總部絕對控制權)
- [ ] 實作 庫存管理模組 (全域檢視與彙整)
- [ ] 實作 儀表板、報表中心與其他 14 項核心模組

## Phase 4: 地端終端系統開發 (POS Edge - Local Terminal)
- [ ] 實作 地端主從架構 (Local Master-Slave WebSocket Server & Client)
- [ ] 實作 離線防衝撞機制 (門店代號 + 機台代號 + UUID 產生帳單號)
- [ ] 實作 員工登入與開/交班模組
- [ ] 實作 餐飲模式 (點餐、桌況鎖定、三大套餐邏輯、訂單快照)
- [ ] 實作 零售與混合模式 (條碼掃描、商品/原物料雙軌扣庫存)
- [ ] 實作 門店專屬「售完 (86)」管理模組
- [ ] 實作 多元支付手動登錄與結帳對帳防呆邏輯

## Phase 5: 雲地雙向同步機制 (Cloud-Edge Sync Engine)
- [ ] 實作 下發機制 (Cloud ➡️ Edge)：透過 Supabase Realtime 即時下發菜單、設定
- [ ] 實作 上傳機制 (Edge ➡️ Cloud)：背景定時上傳交易帳單、付款明細、庫存異動流水
- [ ] 實作 斷線重連機制與離線狀態提示 (Sync Status Indicator)

## Phase 6: 系統測試與交付 (Testing & Delivery)
- [ ] 模擬多機台併發搶桌與搶號測試
- [ ] 模擬斷網結帳與恢復連線同步測試
- [ ] 端到端 (E2E) 雙向完整性測試
