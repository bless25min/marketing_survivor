# 行銷倖存者 (Marketing Survivor) 📈🧟

在這個瞬息萬變的數位行銷戰場上，只有最強的行銷人能活下來！
**Marketing Survivor** 是一款結合了 **Roguelite 生存** 與 **數位行銷梗** 的網頁遊戲。扮演一名數位行銷人員，利用你的專業技能（武器）對抗無窮無盡的流量、潛在客戶與市場挑戰！

![Game Screenshot](https://via.placeholder.com/800x450?text=Marketing+Survivor+Gameplay)

## 🎮 遊戲特色

### ⚔️ 行銷武器庫
將行銷手段轉化為強力武器，擊退貪婪的怪物：
- **📝 內容飛刀 (Content)**：基礎但可靠的行銷手段，發射內容打擊敵人。
- **💣 病毒炸彈 (Viral Bomb)**：製造話題引爆市場，對範圍內敵人造成巨大傷害。
- **📧 電子報連射 (Newsletter)**：像垃圾郵件一樣無孔不入，自動追蹤並打擊最近的目標。
- **🛡️ SEO 光環**：建立品牌防護網，持續對接近的敵人造成傷害。
- **🌈 漏斗力場 (Funnel)**：建立銷售漏斗，將敵人吸入並轉化（造成傷害）。

### 🗺️ 沉浸式戰場
- **數位防火牆**：地圖四周設有帥氣的紅色呼吸燈邊界 (3000 x 3000)，象徵市場的極限。
- **動態生成**：怪物會根據你的位置在視野外生成，讓你時刻處於被包圍的緊張感中。
- **視覺回饋**：完整的傷害數字、爆擊特效與血條顯示。

### 📱 全平台支援
- **電腦版**：精準的鍵鼠操作，享受割草快感。
- **手機版**：優化的 **虛擬搖桿 (Virtual Joystick)** 與觸控介面，隨時隨地都能進行行銷戰鬥。

---

## 🕹️ 操作方式

### 💻 電腦版 (Desktop)
- **移動**：`W` `A` `S` `D` 或 `方向鍵`
- **瞄準**：滑鼠游標移動
- **確認 / 互動**：滑鼠左鍵

### 📱 手機版 (Mobile)
- **移動**：觸控螢幕左半部並拖曳（虛擬搖桿）
- **選單互動**：直接點擊按鈕
- **防誤觸機制**：優化的 Pointer Events 處理，防止在激動時誤觸選單。

---

## 🛠️ 技術架構
本專案使用原生技術構建，追求極致效能與相容性：
- **核心**：HTML5 Canvas + Vanilla JavaScript (ES6+)
- **輸入處理**：Unified Pointer Events (統一處理滑鼠與觸控)
- **部署**：Cloudflare Pages / Wrangler

## 🚀 如何開始
1. **下載專案**
   ```bash
   git clone https://github.com/your-repo/marketing_survivor.git
   ```
2. **啟動遊戲**
   - 直接用瀏覽器開啟 `public/index.html`。
   - 或使用 VS Code 的 **Live Server** 套件執行以獲得最佳體驗。

## 👨‍💻 開發者筆記
- 遊戲核心邏輯位於 `public/js/game.js`。
- 渲染與視覺特效位於 `public/js/renderer.js`。
- 實體與互動邏輯位於 `public/js/utils.js` 與 `js/entities.js`。

---
*Powered by Deepmind Antigravity & The Marketing Team*
