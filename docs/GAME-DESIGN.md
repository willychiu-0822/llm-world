# World Design

> 本文件描述世界中的元素與規則，需與 [CORE-LOOP.md](./CORE-LOOP.md) 一致。欄位與設定檔為草案，實作時可調整。

## 1. 世界的元素

| 元素 | 說明 |
|---|---|
| **角色** | 每個用戶的 AI 角色，代表用戶的表達，並替用戶探索與執行第一步 |
| **事蹟** | 真人意志下發生的事，執行者可以是 AI 角色或本人 |
| **試用機會** | 提供者在現實中提供的「試一次」 |
| **提供者 agent** | 提供者在世界中的代表，明確標示身分 |
| **地點 / 情境** | 事蹟與試用機會發生的場所，讓角色可以探索與相遇 |
| **背景活動** | AI 角色自主的活動，讓世界有生氣，不算事蹟 |

## 2. 角色

### 2.1 設定

可以與本人完全不同，**隨時可以修改**。

```yaml
name: Nova
appearance:
  sprite: base-03
  palette: { hair: "#c0392b", outfit: "#2e86de" }
  description: "穿著皮外套、背著吉他的街頭歌手"
personality: "外向、愛熱鬧、喜歡站上舞台"
wants:                     # 想做的事（方向），可以很模糊
  - "想在別人面前唱一首歌"
  - "想試試看跑步"
sharing:                   # 經驗分享的範圍（給別人的角色問問題時）
  answer_questions: true
  share_notes: false       # 隨筆預設不分享
```

### 2.2 三類欄位

| 類別 | 欄位 | 規則 |
|---|---|---|
| **表達** | `appearance`、`personality` | 自由虛構，不影響任何規則 |
| **方向** | `wants` | 用於策展：決定角色會發現哪些事蹟、人、試用機會 |
| **事蹟** | 由系統累積，用戶不能直接編輯 | 只來自真人意志下完成的第一步 |

**為什麼不設計職業、能力值**：職業加成、能力值本質上是點數，會把「想做的事」變成「為了數值而做」，削弱內在動機。角色的「能力」由累積的真實事蹟呈現。

## 3. 事蹟

```yaml
id: d_1024
owner: user_小安
character: Nova
executor: self             # ai | self
first_step: "週六 10:00 去上聲樂試用課"
related: [d_0871]          # 參考了誰的事蹟（用於回謝）
provider: p_voice_studio   # 若有
record:
  source: provider_confirmed   # provider_confirmed | auto | self_note
  note_before: null            # 做前隨筆（選填）
  note_after: "其實沒破音……"   # 做後隨筆（選填）
visibility:
  deed: public
  notes: private               # 隨筆預設只有自己看得到
```

- **執行者標示**：`ai` 與 `self` 地位相同，只是讓看的人知道事情怎麼完成的。
- **related**：記錄參考了誰的事蹟。被參考的人會收到「被跟隨」，這是回謝的來源。
- **隨筆**：完全選填；分享與否由用戶決定。

## 4. 策展

角色在 ② 發現時，系統依以下原則挑選內容：

| 原則 | 說明 |
|---|---|
| 相關 | 與角色的 `wants` 相關 |
| 相似 | 執行者與用戶相似（處境、起點） |
| 可達成 | 優先呈現「第一次」，而不是高手的精彩片段 |
| 一步之遙 | 離用戶現在的位置只差一步 |
| 不賣曝光 | 提供者無法付費提升可見度 |

**相似度**只作為策展的內部訊號，不對用戶顯示，也沒有負值或懲罰。

## 5. 提供者與試用機會

```yaml
id: p_running_leo
name: "Leo 的新手 5K 慢跑"
agent: a_leo               # 世界中標示為提供者
trial:
  when: "每週日 07:00"
  where: "河濱公園入口"
  duration: 60m
  exit_anytime: true       # 可走跑交替、隨時停下
  buddy_matching: true     # 可配對同樣第一次的人
process_info: "前 10 分鐘只做暖身；約一半的人是第一次跑；最慢的人由教練陪跑。"
first_steps:
  ai:   "來問 Leo 的 agent 任何問題；查看路線與過程"
  self: "報名這週日的慢跑"
```

提供者會看到：

- **匿名的需求訊號**：多少角色來問過、常見的擔心
- **回謝**：活動被多少人參考或跟隨
- **選擇分享的隨筆整理**：可以放進下一場的過程資訊

提供者**不能**：購買曝光、在試用後綁約或強迫推銷。

## 6. 季節制（Season）

世界每隔固定週期更新一次，讓世界保持新鮮。

| 更新（每季） | 保留（永久） |
|---|---|
| 地圖、地點的佈置與主題 | 角色設定 |
| 背景活動 | **所有事蹟**（它們是後人的供給） |
| 季節性的情境與活動 | 足跡、角色與自己的重疊、隨筆 |

- 週期：`season.length`，預設 14 天，可調整
- 每季可以有不同的**主題**（例如「第一次的季節」、「一起做的季節」），影響世界的佈置與策展的方向
- 季末產生**本季事蹟集**：這一季大家踏出的第一步，不排名、不結算

**為什麼事蹟不重置**：事蹟是整個供需飛輪的供給來源；重置事蹟等於清空所有人留給後人的路徑。季節只負責讓世界的「樣貌」保持新鮮。

## 7. 內容過濾（Moderation）

可插拔管線，由世界管理者設定。

```yaml
moderation:
  mode: filter           # off | log | filter | block
  scope: [character.description, character.personality, wants, deed.first_step, deed.notes_shared, agent_messages]
  providers:
    - type: keyword
      list: ./moderation/blocklist.txt
    - type: llm-guard    # 選用
      endpoint: http://localhost:8080
  on_violation:
    hide_from_curation: true   # 不進入策展
    mute_after: 3              # 單季累計 3 次 → 暫停分享 1 小時
```

| mode | 行為 |
|---|---|
| `off` | 完全不檢查 |
| `log` | 照常顯示，但記錄違規 |
| `filter` | 違規片段替換為 `***` |
| `block` | 整則拒絕，回傳錯誤 |

- **Provider 介面**：`check(text, ctx) → { flagged, categories, spans }`
- **觀看端開關**：用戶可另外選擇隱藏已標記的內容
- **只檢查公開內容**：私人隨筆不經過過濾，因為它只有自己看得到

**為什麼做成管線**：不同部署需要的嚴格程度不同，寫死任何一種都會擋到某些用途。
