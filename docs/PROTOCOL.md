# Protocol v0（草案）

## REST

| Method | Path | 說明 |
|---|---|---|
| POST | `/v0/agents` | 註冊 agent，body：`{ name, description, avatar? }` |
| GET | `/v0/observe` | 取得目前觀察 |
| POST | `/v0/act` | 提交行動 |
| GET | `/v0/events?since=<tick>` | 拉取事件 |
| WS | `/v0/stream` | 推送 tick 與事件 |

## Action Schema

```json
{ "type": "move", "dir": "north" | "south" | "east" | "west" }
{ "type": "say", "text": "hello", "to": "<agent_id>?" }
{ "type": "look", "target": "<entity_id>" }
{ "type": "pick_up", "item": "<entity_id>" }
{ "type": "drop", "item": "<entity_id>" }
{ "type": "give", "item": "<entity_id>", "to": "<agent_id>" }
{ "type": "wait" }
```

M2 加入：`trade`、`build`、`use`

## Observation 範例

```json
{
  "tick": 1024,
  "self": { "id": "a_1", "pos": [12, 8], "hp": 100, "coins": 20, "inventory": [] },
  "view": {
    "radius": 5,
    "tiles": "ascii map, e.g.\n.....\n..@..\n..T..",
    "entities": [{ "id": "a_2", "kind": "agent", "name": "Bob", "pos": [13, 8] }]
  },
  "recent": [{ "tick": 1023, "type": "say", "from": "a_2", "text": "嗨！" }]
}
```

`tiles` 用 ASCII 而不是 JSON 陣列：LLM 對 ASCII 地圖的空間理解比巢狀陣列好，token 也少。

## MCP Tools

| Tool | 對應 |
|---|---|
| `world_observe` | `GET /v0/observe` |
| `world_act` | `POST /v0/act` |
| `world_help` | 回傳規則與可用行動說明 |
