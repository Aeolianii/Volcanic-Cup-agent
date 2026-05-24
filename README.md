# AI Story Foundry

AI Story Foundry 鏄竴涓?AI 椹卞姩鐨勫浜轰簰鍔ㄥ彊浜嬪紩鎿庛€傜敤鎴疯緭鍏ユ晠浜嬪垱鎰忓悗锛岀郴缁熺敓鎴?Story Bible锛屽苟鍥寸粫 Story Bible 鏋勫缓鍔ㄦ€佽鍒欍€佸姩鎬?UI銆佸浜烘埧闂淬€丄I GM銆丄I NPC銆乄orld State 鍜屽缁撳眬娴佺▼銆?
## 蹇€熷紑濮?
```bash
npm install
npm run dev
```

璁块棶 `http://localhost:3000`銆?
鐢熶骇妯″紡鏈湴娴嬭瘯锛?
```bash
npm run build
npm run start
```

## 鎶€鏈爤

- Frontend: Next.js 14 + React 18 + TypeScript + Tailwind CSS
- Backend: Next.js API Routes
- Realtime: Socket.IO 棰勭暀
- Database: MVP 浣跨敤鍐呭瓨瀛樺偍锛屽悗缁彲鏇挎崲涓?PostgreSQL
- AI: Mock Provider + OpenAI-compatible Chat Completions Provider

## LLM Provider

搴旂敤鏀寔鍏煎 OpenAI Chat Completions 鐨勬ā鍨嬫湇鍔°€傚垱寤?`.env.local`锛?
```bash
DEEPSEEK_API_KEY=your_api_key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-pro
```

閰嶇疆 `DEEPSEEK_API_KEY` 鍚庯紝GM 鍙欎簨銆丯PC 瑙勫垝銆佺粨灞€鍙欎簨鍜岃嚜鐢辫鍔ㄨВ鏋愪細浼樺厛璋冪敤鐪熷疄妯″瀷銆侱emo 鏁呬簨鍦ㄦā鍨嬩笉鍙敤鏃跺厑璁镐娇鐢ㄥ厹搴曚互淇濊瘉鍙帺锛涘鍏ユ晠浜嬪湪 AI 澶辫触鏃朵細鏄庣‘鎻愮ず鏈敓鎴愶紝涓嶇敤妯℃澘鍓ф儏鍐掑厖鐪熷疄鐢熸垚銆?
## Demo 鏁呬簨锛氬け钀藉湥鏉箣澶?
鐐瑰嚮棣栭〉鐨?Demo 鏁呬簨锛屾垨璁块棶 `/generate?demo=true`锛屽彲浠ョ洿鎺ヤ綋楠岄缃晠浜嬨€?
- 绫诲瀷锛氳タ骞?+ 鏉冭皨 + 鎺ㄧ悊
- 鐜╁瑙掕壊锛氱帇瀛愩€佸湥濂炽€佸埡瀹€侀獞澹?- NPC锛氬ぇ娉曞笀銆佽€佸浗鐜嬨€佷富鏁?- 鏍稿績浜嬩欢锛氬湥鏉け绐冦€佸湥娈胯皟鏌ャ€佸湴涓嬬キ鍧涘彂鐜般€佸ぇ娉曞笀浠紡銆佺帇鍥藉姩涔?- 缁撳眬锛氱帇鍥藉緱鏁戙€佸彜绁炶嫃閱掋€佺帇鏉冨穿濉屻€佸埡瀹㈤潻鍛芥垚鍔?
## 鏍稿績鏋舵瀯鍘熷垯

1. Story Bible 鏄敮涓€鏁呬簨鏁版嵁婧愩€?2. World State 鏄敮涓€鐪熷疄涓栫晫鐘舵€佹簮銆?3. Rule Engine 鏄敮涓€鐘舵€佷慨鏀瑰叆鍙ｃ€?4. AI GM 鍙互璇诲彇瀹屾暣鏁呬簨鎽樿锛屼絾涓嶈兘鐩存帴淇敼 World State銆?5. AI NPC 鍙兘璇诲彇 Knowledge Filter 鐢熸垚鐨勫眬閮ㄨ閲庛€?6. 鐜╁ Chat銆丼uggested Actions銆丗ree Action 鏈€缁堥兘杞崲涓?StructuredAction銆?7. 鍓嶇 UI 涓嶇敱 AI 鐢熸垚浠ｇ爜锛岃€屾槸閫氳繃 Widget Registry 鏍规嵁 `ui_config` 鍔ㄦ€佹覆鏌撱€?
## 娓告垙杩愯娴佺▼

1. AI GM 杈撳嚭褰撳墠鍓ф儏鍙欎簨銆?2. 鐜╁闃呰 NarrativePanel銆?3. 鐜╁鍙互鍦?ChatPanel 杩涜 RP 鍙戣█銆?4. 鐜╁鐐瑰嚮 Suggested Actions 鎴栧湪 FreeActionInput 杈撳叆鑷敱琛屽姩銆?5. Action Parser 灏嗚緭鍏ヨ浆鎹负 StructuredAction銆?6. Rule Engine 杩涜鏉冮檺銆侀闄┿€佹垚鍔熺巼鍜屽悗鏋滅粨绠椼€?7. World State Engine 搴旂敤鐘舵€佹洿鏂般€?8. Event Trigger System 妫€鏌ヤ簨浠惰Е鍙戙€?9. NPC Knowledge Filter 涓?NPC 鏋勯€犲眬閮ㄨ閲庛€?10. NPC Planner 鐢熸垚 NPC 琛屽姩鎻愭銆?11. NPC 琛屽姩杩涘叆 Rule Engine銆?12. Story Controller 鍒ゆ柇绔犺妭鎺ㄨ繘銆?13. Ending Judge 鍒ゆ柇缁撳眬銆?14. AI GM 鍩轰簬鏈€鏂扮姸鎬佺敓鎴愪笅涓€娈靛彊浜嬨€?
## API 璺敱

| 鏂规硶 | 璺緞 | 鎻忚堪 |
| --- | --- | --- |
| POST | `/api/stories/generate` | 鐢熸垚 Story Bible |
| POST | `/api/stories/validate` | 鏍￠獙 Story Bible |
| POST | `/api/rooms` | 鍒涘缓鎴块棿 |
| POST | `/api/rooms/:roomId/join` | 鍔犲叆鎴块棿 |
| POST | `/api/rooms/:roomId/select-role` | 閫夋嫨瑙掕壊 |
| POST | `/api/rooms/:roomId/start` | 寮€濮嬫晠浜?|
| GET | `/api/rooms/:roomId/state` | 鑾峰彇鎴块棿鐘舵€?|
| GET | `/api/rooms/:roomId/players/:playerId/view` | 鑾峰彇鐜╁瑙嗚 |
| POST | `/api/rooms/:roomId/chat` | 鎻愪氦 RP 鑱婂ぉ |
| POST | `/api/rooms/:roomId/actions` | 鎻愪氦姝ｅ紡琛屽姩 |
| POST | `/api/rooms/:roomId/npc-turn` | 鎵ц NPC 鍥炲悎 |
| POST | `/api/rooms/:roomId/endings/check` | 妫€鏌ョ粨灞€ |

## 椤圭洰缁撴瀯

```text
src/
  app/                 Next.js App Router 椤甸潰涓?API
  components/
    widgets/           娓告垙闈㈡澘缁勪欢
    ui/                UIBuilder 绛?UI 缁勮閫昏緫
  engine/              Story Bible銆丷ule Engine銆丄I GM銆丯PC銆佷簨浠跺拰缁撳眬閫昏緫
  registry/            Widget Registry 涓?Rule Pack Registry
  types/               TypeScript 绫诲瀷瀹氫箟
  mock/                Demo Story Bible 涓?Mock AI Provider
  lib/                 鎴块棿绠＄悊銆丄I Provider銆佸墠绔姸鎬?```

## 鐗堟湰鏇存柊

### v1.5 - 2026-05-24

#### NPC Agent 对抗行动系统

- 每个 NPC 现在拥有持久 Runtime State，包括目标层级、长期记忆、威胁评估、关系快照和自身 active modifiers。
- NPC 默认每 2 回合行动一次，按 `Observe -> Think -> Plan -> Act` 主动推进世界，而不是等待玩家触发。
- NPC Planner 只能读取 Knowledge Filter 生成的局部视野，不能读取完整 Story Bible、结局条件、未来章节或其他 NPC 秘密。

#### 规则结算与公平性

- NPC 行动必须先生成 proposal，再由 Rule Engine 转换为 StructuredAction 语义并审核结算。
- 成功率公式加入 NPC 干扰项和 35% 下限，NPC 可以误导、隐藏、延迟和伪造假证据，但不能永久删除关键线索。
- 增加 `max_consecutive_target = 2`，避免 NPC 无限锁定同一玩家。

#### 导入故事与玩家视图

- NPC Agent 不再依赖 Demo 固定指标或地点，会动态匹配导入故事中的进度、势力、压力、怀疑、稳定、信任等指标。
- 事件追踪面板只显示已解锁事件，避免玩家提前看到后续剧情节点。
- 已知事实和线索增加展示清洗，避免内部 id、英文调试文本和状态 key 泄露给玩家。

完整更新日志见 [CHANGELOG.md](CHANGELOG.md)。
### v1.4 - 2026-05-24

#### AI GM 鎺ㄨ繘鎺ㄧ悊

- 鏂板 `progression_guidance` 涓婁笅鏂囷紝AI GM 浼氳鍙栨湭瑙﹀彂浜嬩欢銆佺己澶辨潯浠躲€佸叧閿寚鏍囧拰宸蹭娇鐢ㄨ鍔ㄦ潵鐢熸垚涓嬩竴姝ユ帹鑽愩€?- 鎺ㄨ崘琛屽姩蹇呴』鍥寸粫 World State 鐨勪簨浠堕摼缂哄彛锛屾垨鎵挎帴涓婁竴鎴愬姛琛屽姩褰㈡垚鍏宠仈浼樺娍銆?- LLM prompt 寮哄寲涓衡€滆兘鎺ㄨ繘浜嬩欢銆佹寚鏍囨垨缁撳眬鈥濈殑琛屽姩寤鸿锛屽噺灏戝鍏ユ晠浜嬮噷鐨勯噸澶嶆ā鏉挎寜閽€?
#### 閫氱敤 Rule Engine 鎺ㄨ繘

- Rule Engine 鑷姩璇嗗埆 Story Bible 涓殑杩涘害銆佺ǔ瀹氥€佸帇鍔?褰卞搷銆佷俊浠?鍏崇郴绫绘寚鏍囷紝涓嶅啀鍙€傞厤鍦ｆ澂 Demo銆?- 璋冩煡銆佷氦璋堛€佸叕寮€璇佹嵁銆佹緞娓呫€侀樆姝€佺ǔ瀹氬眬鍔裤€佽祫婧愬噯澶囧拰缁撳眬鏀舵潫琛屽姩浼氭寜瀵煎叆鏁呬簨鑷繁鐨勬寚鏍囨帹杩涖€?- 鏀舵潫绫昏鍔ㄤ細鍚戜紭鍏堢骇鏈€楂樼殑缁撳眬鏉′欢闈犳嫝锛屽府鍔╂晠浜嬭繘鍏ュ彲鍒ゅ畾缁撳眬鍖洪棿銆?
#### 琛屽姩鎴愬姛鐜囦笌杩炴惡浼樺娍

- 闄嶄綆楂橀闄╄鍔ㄩ棬妲涳紝骞朵繚鐣欎綆/涓闄╂垚鍔熺巼浼樺寲銆?- 鎴愬姛琛屽姩浼氳褰曞姩閲忋€佺洰鏍囬攣瀹氥€佺被鍒紭鍔垮拰宸插畬鎴愯鍔ㄧ鍚嶃€?- 璋冩煡鎴愬姛浼氬寮哄悗缁ぞ浜ゅ拰鏀挎不/鎸囨尌绫昏鍔紝璁┾€滃厛閾哄灚銆佸啀鎺ㄨ繘鈥濈殑琛屽姩閾炬洿鍙潬銆?
#### 鎺ㄨ崘琛屽姩涓庝簨浠舵帹杩?
- 鎺ㄨ崘琛屽姩浼氳繃婊や笂涓€琛屽姩鍜屽凡瀹屾垚琛屽姩锛屽苟鎸夋帹杩涗环鍊兼帓搴忋€?- 浜嬩欢鐨?`add_knowledge` 鏁堟灉浼氬悓姝ュ啓鍏ュ悗缁Е鍙戞墍闇€ flag锛岄伩鍏嶆嬁鍒扮嚎绱絾浜嬩欢閾炬柇寮€銆?- Demo 鍙粠鐪熺浉杩涘害 15 鎺ㄨ繘鍒?100锛涘鍏ユ晠浜嬪凡楠岃瘉鏍″洯瑷€鎯呬簨浠堕摼鍙繛缁帹杩涖€?
瀹屾暣鏇存柊鏃ュ織瑙?[CHANGELOG.md](CHANGELOG.md)銆?
### v1.3 - 2026-05-24

#### 闅愯棌鎸囨爣涓庢ā绯婂寲鍙嶉

- 鏂板闅愯棌/鏉′欢鎸囨爣绯荤粺锛屽悗鍙拌褰曠湡瀹炴暟鍊硷紝鐜╁鍙欎簨涓互"鏆楁祦鍙樺寲"褰㈠紡鍛堢幇妯＄硦鍖栧弽棣堛€?- AI GM 涓婁笅鏂囬€氳繃 `implicit_effects` 浼犻€掗殣钘忔寚鏍囨晥鏋滐紝绂佹杈撳嚭闅愯棌鎸囨爣鍚嶇О鍜屽叿浣撴暟鍊笺€?- GM 鍙欎簨"灞€鍔垮彉鍖?浠呮樉绀哄叕寮€鎸囨爣锛岄殣钘忔寚鏍囦笉鍐嶆硠闇插埌鐜╁鏂囨湰銆?
#### 鎺ㄨ崘琛屽姩鐢熸垚鏀硅繘

- 瀵煎叆鏁呬簨鐨勬帹鑽愯鍔ㄥ繀椤绘潵鑷?AI锛岀粨鍚?Story Bible銆乄orld State銆佸綋鍓嶇珷鑺傚拰涓婁竴琛屽姩缁撴灉鐢熸垚锛屼笉鍐嶄娇鐢ㄦ湰鍦版ā鏉垮啋鍏呫€?- 寮哄寲 LLM 鎺ㄨ崘琛屽姩 prompt锛岃姹傚熀浜庡綋鍓嶅墽鎯呯敓鎴愶紝涓嶅緱閲嶅涓婁竴琛屽姩銆?- 淇鍏滃簳鍙欎簨璺緞婕忎紶 `lastAction` 瀵艰嚧鎺ㄨ崘琛屽姩閲嶅鐨勯棶棰橈紱鎻愪氦澶辫触鏃舵仮澶嶅師鍒楄〃銆?
#### Rule Engine 涓庤鍔ㄤ紭鍔跨郴缁?
- 鏂板琛屽姩浼樺娍鏈哄埗锛氭垚鍔熻鍔ㄥ悗绉疮鍔ㄩ噺銆佺洰鏍囬攣瀹氬拰绫诲埆浼樺娍锛屼负鍚庣画琛屽姩鎻愪緵楠伴潰鍔犳垚銆?- 璋冩暣椋庨櫓绛夌骇闃堝€硷紝鏁翠綋鎻愬崌琛屽姩鎴愬姛鐜囥€?- 璋冩煡绫诲拰绀句氦绫昏鍔ㄦ牴鎹柟娉曞拰鐩爣宸紓鍖栨帹杩涚湡鐩歌繘搴︺€?
#### 浜嬩欢鏁堟灉涓庣珷鑺傛帹杩?
- 浜嬩欢瑙﹀彂鍚庤嚜鍔ㄥ簲鐢ㄤ簨浠舵晥鏋滃埌 World State锛屾敮鎸佽缃爣璁般€佷慨鏀规寚鏍囥€佹坊鍔犵煡璇嗗拰鍒囨崲浣嶇疆銆?- 琛屽姩缁撶畻鍚庢鏌ョ珷鑺傛帹杩涙潯浠讹紝婊¤冻鏃惰嚜鍔ㄥ垏鎹㈢珷鑺傘€?
#### AI Provider 涓?GM 鍙欎簨

- 绉婚櫎 Mock Provider 鑷姩闄嶇骇閫昏緫锛孉I 澶辫触鏃舵槑纭繑鍥為敊璇€?- GM 鍙欎簨鏀圭敤涓ユ牸 JSON 瑙ｆ瀽锛屼笉鍐嶆彁渚?mock fallback銆?- AI GM 涓婁笅鏂囦腑鎸囨爣浣跨敤 Story Bible label 鎻愬崌鍙欎簨鍙鎬с€?
#### Demo锛氬け钀藉湥鏉箣澶?
- 淇杩介棶涓绘暀鎺ㄨ崘琛屽姩鏂囨锛屾敼涓?鍚戜富鏁欐牳瀵瑰ぇ娉曞笀璇存硶"骞舵惡甯︾嚎绱笂涓嬫枃銆?- 楠岃瘉鎺ㄨ崘琛屽姩鍒锋柊涓嶅啀閲嶅宸叉墽琛岀殑琛屽姩銆?
瀹屾暣鏇存柊鏃ュ織瑙?[CHANGELOG.md](CHANGELOG.md)銆?
### v1.2 - 2026-05-24

#### Story Bible 涓庢晠浜嬬敓鎴?
- 鐢熸垚鍐呭鏇磋创鍚堢帺瀹惰緭鍏ョ殑棰樻潗銆佷汉鐗╁叧绯诲拰涓栫晫璁惧畾锛屽噺灏戞牎鍥?瑷€鎯呯瓑鏁呬簨琚‖濂楄タ骞绘潈璋嬫ā鏉跨殑闂銆?- 寮哄寲 Story Bible 鏍￠獙锛岃鐩栬鑹茬洰鏍囥€丯PC 鐭ヨ瘑鑼冨洿銆乄idget 閰嶇疆銆佺粨灞€鏁伴噺鍜岃闂潈闄愩€?- Demo 鍙互浣跨敤鍙帺鍏滃簳锛涘鍏ユ晠浜?AI 澶辫触鏃舵槑纭彁绀烘湭鐢熸垚銆?
#### AI GM銆佽鍒欑粨绠椾笌 World State

- 鐜╁琛屽姩缁撴灉浼氳繘鍏?AI GM 涓婁笅鏂囷紝GM 鍙欎簨浼氱粨鍚?Rule Engine銆乄orld State銆佷簨浠跺拰鏂板鎯呮姤鐢熸垚鍏蜂綋鍙嶉銆?- 淇浜嬩欢 ID銆佺洰鏍囧埆鍚嶃€佹寚鏍?key銆佺帺瀹?ID 绛夊唴閮ㄥ弬鏁版硠闇插埌鐜╁鏂囨湰鐨勯棶棰樸€?- 缁熶竴瑙勮寖琛屽姩鐩爣锛屾敮鎸?NPC銆佽鑹层€佷簨浠躲€佸綋鍓嶄綅缃拰鍏宠仈鍦扮偣绛夌洰鏍囥€?- 鏀硅繘绀句氦銆佽皟鏌ャ€佽嚜鎴戞⒊鐞嗐€佺嚎绱€佹寚鏍囥€佸叧绯诲拰浜嬩欢缁撶畻锛岃琛屽姩缁撴灉鏇村叿浣撱€?
#### 鐜╁浜や簰涓庢€ц兘

- 鎺ㄨ崘琛屽姩鍜岃嚜鐢辫鍔ㄦ彁浜ゅ悗鏄剧ず鍗虫椂澶勭悊涓弽棣堛€?- 鎺ㄨ崘琛屽姩浼氭牴鎹渶鏂?World State 鍒锋柊锛岀偣鍑昏繃鐨勬棫琛屽姩浼氳杩囨护銆?- 淇鎺ㄨ崘琛屽姩鍒楄〃涓嶅疄鏃舵洿鏂扮殑闂锛氱偣鍑诲悗绔嬪嵆浠?UI 绉婚櫎鏃ц鍔紝缁撶畻瀹屾垚鍚庣敤鏂版帹鑽愭浛鎹紝澶辫触鏃舵仮澶嶅師鍒楄〃銆?- 琛屽姩缁撶畻鍚庡苟琛屾墽琛岀粨灞€鍒ゆ柇鍜?GM 鍙欎簨鐢熸垚锛屽噺灏戠瓑寰呫€?- 琛屽姩鍚庣殑 GM 鍙欎簨浣跨敤骞跺彂楂?token AI 璇锋眰锛屼紭鍏堥噰鐢ㄧ涓€涓悎娉?JSON 缁撴灉銆?
#### 鐜╁鐣岄潰

- 淇 GM 鍚嶇О琚鏄剧ず涓衡€滈€氱敤姹借溅鈥濄€?- 宸茬煡浜嬪疄鏀寔灞曞紑鏌ョ湅瀹屾暣鍒楄〃銆?- 浼樺寲琛屽姩闈㈡澘銆佽嚜鐢辫鍔ㄨ緭鍏ユ鍜?UI Builder 鐨勭鐢ㄣ€佸鐞嗕腑銆佹帹鑽愬埛鏂扮姸鎬併€?- 娓呯悊璇佹嵁銆佸凡鐭ヤ簨瀹炪€佽鑹蹭俊鎭拰鍙欎簨鏂囨湰涓殑鍐呴儴鍙傛暟銆?
#### Demo锛氬け钀藉湥鏉箣澶?
- 鎵撻€氬垱寤烘埧闂淬€侀€夎銆佸紑濮嬫晠浜嬨€佽鍔ㄦ彁浜ゃ€丟M 鍙欎簨銆佹帹鑽愬埛鏂般€佷簨浠惰Е鍙戝拰缁撳眬鍒ゆ柇闂幆銆?- 寮哄寲涓庡ぇ娉曞笀绛?NPC 浜よ皥鍚庣殑鍏蜂綋鍙嶉鍜屽悗缁嚎绱㈡柟鍚戙€?- 淇濈暀 Demo 鍏滃簳鍙欎簨锛岄伩鍏嶅鍏ユ晠浜嬭鍏滃簳妯℃澘姹℃煋銆?
瀹屾暣鏇存柊鏃ュ織瑙?[CHANGELOG.md](CHANGELOG.md)銆?
