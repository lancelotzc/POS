# POS System Architecture Plan (POS 系統架構規劃)

本文件旨在規劃 POS (Point of Sale) 系統的整體架構與開發藍圖。在您確認並批准此架構前，我們不會進行任何實際的程式撰寫。確認後，將依據此架構產出後續的「程式製作步驟說明檔」。

## 1. 匯入的開發與 POS 領域技能 (SKILLS)

基於先前的開發經驗與系統需求，本次專案已準備好並將運用以下核心技能：
- **前端開發 (Frontend)**：React, Vite, Vanilla CSS (支援高質感 Glassmorphism 玻璃擬物設計), i18n (預設繁體中文)。
- **後端與基礎設施 (Backend & Infrastructure)**：Vercel (部署雲端環境與無伺服器 API), Supabase (PostgreSQL 資料庫、身分驗證與即時同步功能)。
- **POS 領域知識與 SaaS 架構 (Domain Knowledge & SaaS)**：
  - **多租戶架構 (Multi-tenant SaaS)**：支援三層式架構 (系統服務商 -> 連鎖品牌總部 -> 實體門店)。
  - **進階權限管理 (3-Tier RBAC)**：涵蓋 POS 系統商最高權限、總部管理員及門店操作員。
  - 結帳與購物車邏輯、庫存管理與盤點、電子發票整合 (如關貿)。
  - 離線操作與雲端同步機制 (Offline-first & Cloud Sync)。

## 2. 系統核心架構 (System Architecture)

為確保門市營運的穩定性與總部管理的擴充性，系統將採用**邊緣與雲端完全解耦 (Completely Decoupled Edge & Cloud)** 的架構。
**【核心設計原則】：完全獨立安裝**。地端 (POS Edge) 與雲端 (POS Cloud) 將打包為兩個完全獨立的專案與應用程式。地端實體店面部署時，**只需安裝地端程式，完全不需要安裝或依賴任何雲端的程式碼**。

### A. 雲端管理後台 (POS Cloud - SaaS 平台)
雲端總管理後台將透過瀏覽器登入，採用**多租戶架構 (Multi-tenant)**，供 **POS 系統商 (Super Admin)** 與 **連鎖品牌總部 (Tenant Admin)** 共同使用，系統將依據登入身分自動切換對應權限與可視範圍。

- **主要模組 (共 14 項)**：
  1. **登入與權限管理** (Login & Permission Management)
  2. **儀表板** (Dashboard)
  3. **總部管理** (HQ Management)
  4. **門店管理** (Store Management)
  5. **門店啟用 / 停用 / 有效期間** (Store License & Validity Control)
  6. **菜單 / 商品管理** (Menu & Product Management)
  7. **套餐 / 加料管理** (Combo & Modifier Management)
  8. **優惠 / 折扣管理** (Promotion & Discount Management)
  9. **會員管理** (Membership Management)
  10. **發票 / 字軌管理** (E-Invoice & Track Number Management)
  11. **報表中心** (Report Center)
  12. **庫存管理** (Inventory Management)
  13. **同步監控** (Sync Status Monitoring)
  14. **操作紀錄** (Audit Logs / Operation Records)

### B. 邊緣終端系統 (POS Edge)
負責門市第一線的結帳與日常營運，需具備**離線優先 (Offline-first)**能力，確保網路不穩時仍能正常結帳。
- **核心功能模組 (共 14 項)**：
  1. **員工登入 / PIN 快速登入** (Employee Login)
  2. **開班 / 交班** (Shift Open/Close)
  3. **餐飲模式 (F&B Mode)**：操作重點為「桌位、點餐、套餐、加料、出餐、出單」。**庫存方式：原物料庫存 (BOM/Ingredients)**。支援換桌、併桌、拆單等進階操作。
  4. **零售模式 (Retail Mode)**：操作重點為「掃碼、商品搜尋、快速結帳、退換貨」。**庫存方式：商品庫存 (Finished Goods)**。
     - **混合型支援 (Mixed Mode)**：系統允許「餐飲 + 零售商品」合併結帳，並雙軌並行扣減「原物料 + 商品」庫存。
     - *支援的多元營業型態 (Business Types & Flows)*：
       - **訂單類型**：內用、外帶、外送、預約、自取
       - **服務模式**：桌位、叫號
       - **結帳流程**：先付款、後付款
  5. **訂單管理** (Order Management)
  6. **結帳付款** (Checkout & Payment)
  7. **電子發票** (E-Invoice)
  8. **會員** (Membership)
  9. **售完管理** (Sold-out Management)
  10. **出單 / 補印** (Print / Reprint)
  11. **客顯** (Customer Display)
  12. **錢櫃** (Cash Drawer)
  13. **本地設定** (Local Settings)
  14. **同步狀態** (Sync Status)
  - *(底層架構支援：多機台併發控制、本地資料庫與雲端同步機制)*

## 3. 資料庫與資料同步機制 (Database & Sync)
- **邊緣端 (Edge)**：使用輕量級本地資料庫 (如 SQLite 或瀏覽器端 IndexedDB)，快取商品資訊並暫存離線訂單。
- **雲端基礎設施 (Cloud Infrastructure)**：
  - **代管環境 (Hosting)**：使用 **Vercel** 部署 `pos-cloud` 的 Web 介面與無伺服器 API (Serverless Functions)，確保高可用性與快速更新。
  - **資料庫與後端即時服務 (BaaS)**：使用 **Supabase** (基於 PostgreSQL) 作為核心資料庫與單一真實資料來源 (Single Source of Truth)，並利用其內建的 Auth 功能與 Realtime API 簡化開發。
- **同步機制 (Sync)**：
  - **資料上傳 (Edge -> Cloud)**：Edge 端具備「定時上傳 (Scheduled Upload)」機制，在背景定期透過 API 將 **「帳單 (Bills)」、「付款檔 (Payment Records)」與「發票檔 (Invoice Records)」** 等交易資料自動同步上傳至 Supabase，確保雲端擁有最完整的銷售與帳務紀錄。
  - **雲端下發 (Cloud -> Edge)**：雲端總部修改設定後，透過 Supabase 的即時推播 (Realtime) 或是啟動同步機制，將 **「菜單 (Menus)」、「付款方式 (Payment Methods)」、「口味與作法 (Flavors/Modifiers)」** 等營業基礎資料，自動下發並更新至地端的本地資料庫中。
- **多機台併發與防搶號機制 (Multi-Terminal Concurrency)**：
  - **帳單號與發票防衝撞**：採用「門店代號 + 機台代號 + 時間戳或流水序號 (例如：StoreA-M01-20231024-001)」的組合規則。確保即使在完全離線的情況下，多台 POS 同時結帳產生的帳單、付款與發票紀錄也**絕對不會重複 (防搶號)**。
  - **地端主從架構與桌況鎖定 (Local Master-Slave & Table Locking)**：**強烈建議並將採用「地端主機 (Local Master)」架構**。在多台 POS 的門店中，指定一台 POS 作為「主機 (Master)」，負責運行本地資料庫與 WebSocket 同步伺服器；其餘 POS 作為「子機 (Slave)」連線至主機。這能最完美解決搶號與桌況問題——當子機 A 點擊開桌，會統一由主機鎖定該桌號並同步給所有子機；所有帳單與發票號碼也由主機統一核發配發，從根本上杜絕搶桌與搶號衝突。

## 4. 核心資料權限與邊界控制 (Data Governance & Boundaries)
系統將嚴格區分「雲端總部」與「地端門店」的資料修改權限，以確保連鎖品牌的菜單與資料一致性：
- **總部絕對控制權 (Cloud Only)**：
  - 門店 **不可修改**：商品名稱、商品價格、商品分類、套餐內容、加料設定、商品上架/下架、稅別。
  - 以上所有營業基礎資料，均由「總部 (Tenant Admin)」在雲端後台統一設定，並單向覆蓋下發至門店。
- **門店在地營運權 (Edge Allowed)**：
  - 門店 **僅可修改**：「本店商品是否售完 (86)」以及「恢復可售」。
  - **售完狀態隔離**：售完狀態 (Sold-out Status) 為各門店的**獨立資料**（A 門店售完不影響 B 門店）。
  - **離線支援**：地端 POS 支援在「完全離線」狀態下快速設定商品售完，並在網路連線恢復後，自動將售完狀態同步回雲端。

## 5. 餐飲細部架構與訂單快照 (F&B Specifics & Order Snapshot)
針對餐飲模式極度複雜的點餐邏輯，系統在資料結構設計上將深度支援以下三種組合：

### 5.1 餐飲套餐架構 (Combo Architecture)
1. **固定套餐 (Fixed Combo)**：固定內容、固定金額，不可換菜。
2. **可部分換菜套餐 (Swappable Combo)**：有預設內容，可設定部分群組/項目允許替換，替換可設定加價或不加價。
3. **多選多套餐 (Multi-Choice Combo)**：固定底價，包含多個選擇類別（例如：主餐選1、飲料選2）。每種類別可設定最少/最多可選數量與可選餐點，餐點可獨立設定加價。總金額＝固定底價＋選項加價。

### 5.2 加料與選項設定 (Modifiers & Options)
支援多維度的附屬選項，包含且不限於：**冰量、甜度、加料、尺寸、醬料、其他客製化選項**。

### 5.3 訂單歷史快照 (Order Snapshot)
**【核心交易原則】：絕對禁止關聯異動影響歷史帳單。**
當訂單成立結帳時，系統將把當下的「商品名稱、套餐明細、加料選項、價格、稅別與折扣」進行**快照 (Snapshot) 封裝**並寫入訂單明細表 (Order Items)。這確保了即使未來總部大幅修改菜單價格或刪除商品，過去的歷史訂單與營收報表也絕對不會發生變動或破圖。

### 5.4 訂單生命週期與狀態機 (Order Lifecycle & State Machine)
為了精確追蹤門店營運與出餐流程，系統將建立嚴格的訂單與付款狀態機：
1. **訂單類型 (Order Type)**：內用、外帶、外送、自取、預約、零售。
2. **訂單狀態 (Order Status)**：
   - 推進流程：草稿 ➡️ 已確認 ➡️ 製作中 ➡️ 可取餐/出餐 ➡️ 已完成。
   - 異常流程：已取消、已作廢。
3. **付款狀態 (Payment Status)**：
   - 正向流程：未付款 ➡️ 部分付款 ➡️ 已付款。
   - 逆向流程：部分退款、已退款、作廢。

### 5.5 多元支付與混合付款機制 (Payment Methods & Split Tender)
系統第一版 (Phase 1) 必須支援**「混合付款 (Split Tender)」**（例如：一筆訂單同時使用現金＋信用卡結帳）。
為加速初期上線，第一版的所有外部支付串接先採**「手動登錄 (Manual Entry)」**，後續再升級為 API 系統自動串接。

1. **支援的付款方式**：
   現金、信用卡 (手動)、LINE Pay (手動)、街口支付 (手動)、禮券、儲值金 (依版本設定啟用)、外送平台已付款、其他預留方式。
2. **對帳與防呆機制 (Reconciliation Records)**：
   當使用手動登錄結帳時，為確保日後對帳與退款的準確性，系統必須強制或引導記錄必要的對帳欄位，這些資料將獨立寫入**支付交易明細表 (Payment Records)**：
   - **信用卡**：需記錄 交易序號 / 授權碼 / 卡號末四碼。
   - **LINE Pay / 街口支付**：需記錄 手機端或端末機的 交易編號。
   - **外送平台已付款**：需記錄 平台名稱 / 平台訂單號。
   - **其他方式**：需記錄 付款備註或參考編號。

## 6. 進階庫存管理架構 (Advanced Inventory Architecture)
庫存模組的啟用權限由 **POS 系統商 (Super Admin)** 控制，可針對單一連鎖總部或特定門店獨立開啟或關閉。
庫存系統支援餐飲(原物料)、零售(單一商品)與混合模式，精確對應實際營運情境。

### 6.1 庫存核心功能與生命週期
- **基礎架構**：原物料主檔、商品庫存、單位設定、**單位換算 (Unit Conversion)**、**配方 / BOM 表**。
- **銷售扣減邏輯**：完美支援**「加料扣庫存」**與**「套餐扣庫存」**。
- **門店後勤作業**：進貨入庫、盤點、報廢、手動調整。
- **警示與追蹤**：安全庫存設定、低庫存警示、無刪改權限的**庫存異動流水帳 (Inventory Ledger)**。

### 6.2 庫存狀態防呆與邊界設計
- **庫存不足銷售策略** (依設定)：
  1. 不檢查 (無視庫存直接結帳)。
  2. 提醒但可銷售 (畫面跳出警告，允許變為負庫存)。
  3. 強制阻擋銷售 (反灰無法點選，徹底阻擋)。
- **【核心架構原則】：地端為即時真實來源**
  - **地端 (Edge)** 是庫存計算與扣減的「即時來源」。點餐當下即刻在 Edge 本地資料庫扣減庫存，確保 Offline 運作下庫存阻擋機制的絕對即時性與準確性。
  - **雲端 (Cloud)** 則為「彙整查詢來源」。地端背景定時將庫存異動流水 (Ledger) 上傳至 Supabase，雲端透過聚合流水帳來呈現總部的全域庫存報表。

