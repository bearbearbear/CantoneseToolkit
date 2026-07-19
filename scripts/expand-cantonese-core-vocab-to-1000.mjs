import { readFile, writeFile } from "node:fs/promises";

const vocabUrl = new URL("../app/data/cantonese-core-vocab.json", import.meta.url);
const vocab = JSON.parse(await readFile(vocabUrl, "utf8"));
const columnIndex = Object.fromEntries(
  vocab.columns.map((column, index) => [column, index]),
);

const targetSize = 1000;
const existingMandarin = new Set(
  vocab.entries.map((entry) => entry[columnIndex.mandarin]),
);

const candidates = [];

function add(
  mandarin,
  cantonese,
  jyutping,
  category,
  pos = "phrase",
  type = "exact",
  priority = 84,
  confidence = 0.92,
  note = "",
) {
  candidates.push([
    mandarin,
    cantonese,
    jyutping,
    category,
    pos,
    type,
    priority,
    confidence,
    "manual-seed",
    note,
  ]);
}

function addVerbSet({
  mandarinVerb,
  cantoneseVerb,
  jyutpingVerb,
  items,
  type = "exact",
  priority = 84,
  confidence = 0.92,
}) {
  for (const [mandarinNoun, cantoneseNoun, jyutpingNoun, category] of items) {
    add(
      `${mandarinVerb}${mandarinNoun}`,
      `${cantoneseVerb}${cantoneseNoun}`,
      `${jyutpingVerb} ${jyutpingNoun}`,
      category,
      "verb_phrase",
      type,
      priority,
      confidence,
    );
  }
}

const mediaItems = [
  ["电视", "电视", "din6 si6", "tech"],
  ["电影", "戏", "hei3", "tech"],
  ["电视剧", "剧", "kek6", "tech"],
  ["新闻", "新闻", "san1 man4", "tech"],
  ["视频", "片", "pin2", "tech"],
  ["直播", "直播", "zik6 bo3", "tech"],
  ["网页", "网页", "mong5 jip6", "tech"],
  ["消息", "讯息", "seon3 sik1", "tech"],
  ["照片", "相", "soeng2", "tech"],
  ["地图", "地图", "dei6 tou4", "transit"],
  ["说明", "说明", "syut3 ming4", "daily"],
  ["评论", "留言", "lau4 jin4", "tech"],
  ["菜单", "餐牌", "caan1 paai2", "food"],
  ["说明书", "说明书", "syut3 ming4 syu1", "daily"],
  ["价格", "价钱", "gaa3 cin2", "shopping"],
];

const foodItems = [
  ["早餐", "早餐", "zou2 caan1", "food"],
  ["午饭", "午饭", "ng5 faan6", "food"],
  ["晚饭", "晚饭", "maan5 faan6", "food"],
  ["宵夜", "宵夜", "siu1 je6", "food"],
  ["粥", "粥", "zuk1", "food"],
  ["面", "面", "min6", "food"],
  ["云吞", "云吞", "wan4 tan1", "food"],
  ["点心", "点心", "dim2 sam1", "food"],
  ["烧鹅", "烧鹅", "siu1 ngo4", "food"],
  ["叉烧", "叉烧", "caa1 siu1", "food"],
  ["鸡蛋", "鸡蛋", "gai1 daan6", "food"],
  ["牛肉", "牛肉", "ngau4 juk6", "food"],
  ["猪肉", "猪肉", "zyu1 juk6", "food"],
  ["鱼", "鱼", "jyu4", "food"],
  ["虾", "虾", "haa1", "food"],
  ["水果", "生果", "saang1 gwo2", "food"],
  ["蔬菜", "菜", "coi3", "food"],
  ["甜品", "糖水", "tong4 seoi2", "food"],
  ["零食", "零食", "ling4 sik6", "food"],
  ["外卖", "外卖", "ngoi6 maai6", "food"],
];

const drinkItems = [
  ["水", "水", "seoi2", "food"],
  ["茶", "茶", "caa4", "food"],
  ["奶茶", "奶茶", "naai5 caa4", "food"],
  ["咖啡", "咖啡", "gaa3 fe1", "food"],
  ["果汁", "果汁", "gwo2 zap1", "food"],
  ["汽水", "汽水", "hei3 seoi2", "food"],
  ["啤酒", "啤酒", "be1 zau2", "food"],
  ["汤", "汤", "tong1", "food"],
  ["热水", "热水", "jit6 seoi2", "food"],
  ["冻水", "冻水", "dung3 seoi2", "food"],
  ["豆浆", "豆浆", "dau6 zoeng1", "food"],
  ["牛奶", "牛奶", "ngau4 naai5", "food"],
];

const shoppingItems = [
  ["菜", "餸", "sung3", "food"],
  ["水果", "生果", "saang1 gwo2", "food"],
  ["衣服", "衫", "saam1", "home"],
  ["鞋子", "鞋", "haai4", "home"],
  ["裤子", "裤", "fu3", "home"],
  ["裙子", "裙", "kwan4", "home"],
  ["外套", "褛", "lau1", "home"],
  ["票", "飞", "fei1", "shopping"],
  ["车票", "车飞", "ce1 fei1", "transit"],
  ["机票", "机票", "gei1 piu3", "transit"],
  ["礼物", "礼物", "lai5 mat6", "shopping"],
  ["手信", "手信", "sau2 seon3", "shopping"],
  ["药", "药", "joek6", "health"],
  ["日用品", "日用品", "jat6 jung6 ban2", "shopping"],
  ["家具", "家具", "gaa1 geoi1", "home"],
  ["电器", "电器", "din6 hei3", "home"],
  ["手机", "手机", "sau2 gei1", "tech"],
  ["电脑", "电脑", "din6 nou5", "tech"],
  ["充电器", "叉电器", "caa1 din6 hei3", "home"],
  ["雨伞", "遮", "ze1", "home"],
];

const peopleItems = [
  ["朋友", "朋友", "pang4 jau5", "people"],
  ["同事", "同事", "tung4 si6", "people"],
  ["家人", "屋企人", "uk1 kei2 jan4", "people"],
  ["老师", "老师", "lou5 si1", "work_school"],
  ["学生", "学生", "hok6 saang1", "work_school"],
  ["医生", "医生", "ji1 sang1", "health"],
  ["客服", "客服", "haak3 fuk6", "shopping"],
  ["经理", "经理", "ging1 lei5", "work_school"],
  ["老板", "老板", "lou5 baan2", "work_school"],
  ["司机", "司机", "si1 gei1", "transit"],
  ["服务员", "侍应", "si6 jing3", "food"],
  ["小孩", "细路仔", "sai3 lou6 zai2", "people"],
];

const placeItems = [
  ["家", "屋企", "uk1 kei2", "home"],
  ["公司", "公司", "gung1 si1", "work_school"],
  ["学校", "学校", "hok6 haau6", "work_school"],
  ["餐厅", "餐厅", "caan1 teng1", "food"],
  ["茶餐厅", "茶餐厅", "caa4 caan1 teng1", "food"],
  ["超市", "超市", "ciu1 si5", "shopping"],
  ["街市", "街市", "gaai1 si5", "shopping"],
  ["商场", "商场", "soeng1 coeng4", "shopping"],
  ["医院", "医院", "ji1 jyun2", "health"],
  ["药房", "药房", "joek6 fong4", "health"],
  ["银行", "银行", "ngan4 hong4", "shopping"],
  ["车站", "车站", "ce1 zaam6", "transit"],
  ["机场", "机场", "gei1 coeng4", "transit"],
  ["酒店", "酒店", "zau2 dim3", "transit"],
  ["厕所", "厕所", "ci3 so2", "home"],
  ["房间", "房", "fong2", "home"],
  ["厨房", "厨房", "cyu4 fong2", "home"],
  ["门口", "门口", "mun4 hau2", "home"],
];

addVerbSet({
  mandarinVerb: "看",
  cantoneseVerb: "睇",
  jyutpingVerb: "tai2",
  items: mediaItems,
  priority: 88,
  confidence: 0.95,
});
addVerbSet({
  mandarinVerb: "吃",
  cantoneseVerb: "食",
  jyutpingVerb: "sik6",
  items: foodItems,
  priority: 88,
  confidence: 0.95,
});
addVerbSet({
  mandarinVerb: "喝",
  cantoneseVerb: "饮",
  jyutpingVerb: "jam2",
  items: drinkItems,
  priority: 88,
  confidence: 0.95,
});
addVerbSet({
  mandarinVerb: "买",
  cantoneseVerb: "买",
  jyutpingVerb: "maai5",
  items: shoppingItems,
  priority: 84,
  confidence: 0.93,
});
addVerbSet({
  mandarinVerb: "找",
  cantoneseVerb: "搵",
  jyutpingVerb: "wan2",
  items: [...peopleItems, ...placeItems.slice(0, 8)],
  priority: 86,
  confidence: 0.94,
});
addVerbSet({
  mandarinVerb: "问",
  cantoneseVerb: "问",
  jyutpingVerb: "man6",
  items: peopleItems.slice(0, 10),
  priority: 76,
  confidence: 0.9,
});
addVerbSet({
  mandarinVerb: "带",
  cantoneseVerb: "带",
  jyutpingVerb: "daai3",
  items: [
    ["雨伞", "遮", "ze1", "home"],
    ["钥匙", "锁匙", "so2 si4", "home"],
    ["钱包", "银包", "ngan4 baau1", "shopping"],
    ["手机", "手机", "sau2 gei1", "tech"],
    ["电脑", "电脑", "din6 nou5", "tech"],
    ["行李", "行李", "hang4 lei5", "transit"],
    ["行李箱", "行李喼", "hang4 lei5 gip1", "transit"],
    ["孩子", "细路", "sai3 lou6", "people"],
  ],
  type: "contextual",
  priority: 78,
  confidence: 0.88,
});

const verbPhrases = [
  ["看一下", "睇下", "tai2 haa5"], ["看一看", "睇睇", "tai2 tai2"],
  ["看清楚", "睇清楚", "tai2 cing1 co2"], ["看不见", "睇唔到", "tai2 m4 dou2"],
  ["看到了", "睇到咗", "tai2 dou2 zo2"], ["看完", "睇完", "tai2 jyun4"],
  ["再看", "再睇", "zoi3 tai2"], ["别看", "唔好睇", "m4 hou2 tai2"],
  ["听一下", "听下", "teng1 haa5"], ["听不懂", "听唔明", "teng1 m4 ming4"],
  ["听到了", "听到咗", "teng1 dou2 zo2"], ["听清楚", "听清楚", "teng1 cing1 co2"],
  ["说一下", "讲下", "gong2 haa5"], ["说清楚", "讲清楚", "gong2 cing1 co2"],
  ["说完", "讲完", "gong2 jyun4"], ["再说", "再讲", "zoi3 gong2"],
  ["别说", "唔好讲", "m4 hou2 gong2"], ["乱说", "乱讲", "lyun6 gong2"],
  ["开玩笑", "讲笑", "gong2 siu3"], ["聊天儿", "倾偈", "king1 gai2"],
  ["问一下", "问下", "man6 haa5"], ["问清楚", "问清楚", "man6 cing1 co2"],
  ["答应", "应承", "jing3 sing4"], ["告诉我", "话我知", "waa6 ngo5 zi1"],
  ["告诉你", "话你知", "waa6 nei5 zi1"], ["通知我", "通知我", "tung1 zi1 ngo5"],
  ["打给我", "打畀我", "daa2 bei2 ngo5"], ["发给我", "发畀我", "faat3 bei2 ngo5"],
  ["给我看", "畀我睇", "bei2 ngo5 tai2"], ["给你看", "畀你睇", "bei2 nei5 tai2"],
  ["给我", "畀我", "bei2 ngo5"], ["给你", "畀你", "bei2 nei5"],
  ["给他", "畀佢", "bei2 keoi5"], ["给他们", "畀佢哋", "bei2 keoi5 dei6"],
  ["拿出来", "攞出来", "lo2 ceot1 lai4"], ["拿进去", "攞入去", "lo2 jap6 heoi3"],
  ["拿回来", "攞返嚟", "lo2 faan1 lai4"], ["拿过来", "攞过嚟", "lo2 gwo3 lai4"],
  ["放进去", "摆入去", "baai2 jap6 heoi3"], ["放出来", "摆出来", "baai2 ceot1 lai4"],
  ["放在这里", "摆喺呢度", "baai2 hai2 ni1 dou6"], ["放在那里", "摆喺嗰度", "baai2 hai2 go2 dou6"],
  ["收起来", "收埋", "sau1 maai4"], ["捡起来", "执起", "zap1 hei2"],
  ["扔掉", "掉咗佢", "diu6 zo2 keoi5"], ["丢掉", "掉咗佢", "diu6 zo2 keoi5"],
  ["弄坏", "整坏", "zing2 waai6"], ["弄丢", "整唔见", "zing2 m4 gin3"],
  ["修好", "整好", "zing2 hou2"], ["准备好", "准备好", "zeon2 bei6 hou2"],
  ["搞定", "搞掂", "gaau2 dim6"], ["处理", "处理", "cyu5 lei5"],
  ["试试", "试下", "si3 haa5"], ["试一下", "试下", "si3 haa5"],
  ["试试看", "试下睇", "si3 haa5 tai2"], ["试吃", "试食", "si3 sik6"],
  ["试喝", "试饮", "si3 jam2"], ["试用", "试用", "si3 jung6"],
  ["打开手机", "开手机", "hoi1 sau2 gei1"], ["打开电脑", "开电脑", "hoi1 din6 nou5"],
  ["打开门", "开门", "hoi1 mun4"], ["打开窗", "开窗", "hoi1 coeng1"],
  ["打开空调", "开冷气", "hoi1 laang5 hei3"], ["打开电视", "开电视", "hoi1 din6 si6"],
  ["关闭手机", "关手机", "gwaan1 sau2 gei1"], ["关闭电脑", "关电脑", "gwaan1 din6 nou5"],
  ["关闭空调", "关冷气", "gwaan1 laang5 hei3"], ["关闭电视", "关电视", "gwaan1 din6 si6"],
  ["关掉", "关咗", "gwaan1 zo2"], ["开着", "开住", "hoi1 zyu6"],
  ["关着", "关住", "gwaan1 zyu6"], ["等我", "等埋我", "dang2 maai4 ngo5"],
  ["等等我", "等埋我", "dang2 maai4 ngo5"], ["跟我来", "跟我嚟", "gan1 ngo5 lai4"],
  ["跟着我", "跟住我", "gan1 zyu6 ngo5"], ["跟上", "跟上", "gan1 soeng5"],
  ["走开", "行开", "haang4 hoi1"], ["过来", "过嚟", "gwo3 lai4"],
  ["过去", "过去", "gwo3 heoi3"], ["进去", "入去", "jap6 heoi3"],
  ["出来", "出来", "ceot1 lai4"], ["上去", "上去", "soeng5 heoi3"],
  ["下来", "落嚟", "lok6 lai4"], ["下来吧", "落嚟啦", "lok6 lai4 laa1"],
  ["坐下", "坐低", "co5 dai1"], ["站起来", "企起身", "kei5 hei2 san1"],
  ["坐在这里", "坐喺呢度", "co5 hai2 ni1 dou6"], ["坐在那里", "坐喺嗰度", "co5 hai2 go2 dou6"],
  ["排一下队", "排下队", "paai4 haa5 deoi2"], ["别插队", "唔好打尖", "m4 hou2 daa2 zim1"],
  ["等车", "等车", "dang2 ce1"], ["赶车", "赶车", "gon2 ce1"],
  ["赶时间", "赶时间", "gon2 si4 gaan3"], ["赶不上", "赶唔切", "gon2 m4 cit3"],
  ["来得及", "赶得切", "gon2 dak1 cit3"], ["来不及", "赶唔切", "gon2 m4 cit3"],
  ["坐下来", "坐低", "co5 dai1"], ["躺下", "瞓低", "fan3 dai1"],
  ["醒过来", "醒返", "sing2 faan1"], ["起来了", "起身啦", "hei2 san1 laa1"],
  ["睡着了", "瞓着咗", "fan3 zoek6 zo2"], ["睡醒了", "瞓醒咗", "fan3 seng2 zo2"],
  ["洗衣服", "洗衫", "sai2 saam1"], ["晒衣服", "晾衫", "long3 saam1"],
  ["收衣服", "收衫", "sau1 saam1"], ["折衣服", "摺衫", "zip3 saam1"],
  ["做饭", "煮饭", "zyu2 faan6"], ["煮菜", "煮餸", "zyu2 sung3"],
  ["洗碗", "洗碗", "sai2 wun2"], ["扫地", "扫地", "sou3 dei6"],
  ["拖地", "拖地", "to1 dei6"], ["擦桌子", "抹台", "maat3 toi2"],
  ["倒垃圾", "倒垃圾", "dou2 laap6 saap3"], ["换灯泡", "换灯胆", "wun6 dang1 daam2"],
  ["充电", "叉电", "caa1 din6"], ["没电", "冇电", "mou5 din6"],
  ["有电", "有电", "jau5 din6"], ["没网", "冇网", "mou5 mong5"],
  ["没信号", "冇讯号", "mou5 seon3 hou6"], ["信号不好", "讯号唔好", "seon3 hou6 m4 hou2"],
  ["网速慢", "网速慢", "mong5 cuk1 maan6"], ["连不上", "连唔到", "lin4 m4 dou2"],
  ["重新登录", "重新登入", "cung4 san1 dang1 jap6"], ["登不上", "登入唔到", "dang1 jap6 m4 dou2"],
  ["看错", "睇错", "tai2 co3"], ["听错", "听错", "teng1 co3"],
  ["说错", "讲错", "gong2 co3"], ["买错", "买错", "maai5 co3"],
  ["走错", "行错", "haang4 co3"], ["拿错", "攞错", "lo2 co3"],
  ["写错", "写错", "se2 co3"], ["打错", "打错", "daa2 co3"],
  ["记错", "记错", "gei3 co3"], ["弄错", "搞错", "gaau2 co3"],
];

for (const [mandarin, cantonese, jyutping] of verbPhrases) {
  add(mandarin, cantonese, jyutping, "verb", "verb_phrase", mandarin === "给我" || mandarin === "给你" ? "exact" : "exact", 86, 0.93);
}

const socialPhrases = [
  ["久等了", "等咗好耐", "dang2 zo2 hou2 noi6"], ["让你久等了", "要你等咗好耐", "jiu3 nei5 dang2 zo2 hou2 noi6"],
  ["不好意思打扰了", "唔好意思打扰晒", "m4 hou2 ji3 si1 daa2 jiu2 saai3"],
  ["麻烦再说一遍", "唔该再讲多次", "m4 goi1 zoi3 gong2 do1 ci3"],
  ["你说什么", "你讲咩", "nei5 gong2 me1"], ["你在说什么", "你讲紧咩", "nei5 gong2 gan2 me1"],
  ["我听不懂", "我听唔明", "ngo5 teng1 m4 ming4"], ["我看不懂", "我睇唔明", "ngo5 tai2 m4 ming4"],
  ["慢一点", "慢啲", "maan6 di1"], ["快一点", "快啲", "faai3 di1"],
  ["大声一点", "大声啲", "daai6 seng1 di1"], ["小声一点", "细声啲", "sai3 seng1 di1"],
  ["再来一次", "再嚟多次", "zoi3 lai4 do1 ci3"], ["等会儿说", "阵间讲", "zan6 gaan1 gong2"],
  ["我先看看", "我睇下先", "ngo5 tai2 haa5 sin1"], ["我想想", "我谂下", "ngo5 lam2 haa5"],
  ["我明白了", "我明白喇", "ngo5 ming4 baak6 laa3"], ["我懂了", "我明喇", "ngo5 ming4 laa3"],
  ["我不懂", "我唔明", "ngo5 m4 ming4"], ["我不会说", "我唔识讲", "ngo5 m4 sik1 gong2"],
  ["我不会写", "我唔识写", "ngo5 m4 sik1 se2"], ["我不会用", "我唔识用", "ngo5 m4 sik1 jung6"],
  ["你会说吗", "你识唔识讲", "nei5 sik1 m4 sik1 gong2"], ["你知道吗", "你知唔知", "nei5 zi1 m4 zi1"],
  ["你要不要", "你要唔要", "nei5 jiu3 m4 jiu3"], ["你想不想", "你想唔想", "nei5 soeng2 m4 soeng2"],
  ["有没有空", "得唔得闲", "dak1 m4 dak1 haan4"], ["有时间吗", "有冇时间", "jau5 mou5 si4 gaan3"],
  ["你在哪里", "你喺边度", "nei5 hai2 bin1 dou6"], ["我在这里", "我喺呢度", "ngo5 hai2 ni1 dou6"],
  ["我在路上", "我喺路上", "ngo5 hai2 lou6 soeng6"], ["我快到了", "我就到", "ngo5 zau6 dou3"],
  ["我到了", "我到咗", "ngo5 dou3 zo2"], ["我走了", "我走先", "ngo5 zau2 sin1"],
  ["你先走", "你走先", "nei5 zau2 sin1"], ["别急", "唔使急", "m4 sai2 gap1"],
  ["不用急", "唔使急", "m4 sai2 gap1"], ["别担心", "唔使担心", "m4 sai2 daam1 sam1"],
  ["没事的", "冇事嘅", "mou5 si6 ge3"], ["有事吗", "有咩事", "jau5 me1 si6"],
  ["什么事", "咩事", "me1 si6"], ["有道理", "有道理", "jau5 dou6 lei5"],
  ["说得对", "讲得啱", "gong2 dak1 ngaam1"], ["你说得对", "你讲得啱", "nei5 gong2 dak1 ngaam1"],
  ["不一定", "唔一定", "m4 jat1 ding6"], ["可能吧", "可能啦", "ho2 nang4 laa1"],
  ["应该可以", "应该得", "jing1 goi1 dak1"], ["应该不行", "应该唔得", "jing1 goi1 m4 dak1"],
  ["没听过", "未听过", "mei6 teng1 gwo3"], ["没看过", "未睇过", "mei6 tai2 gwo3"],
  ["没去过", "未去过", "mei6 heoi3 gwo3"], ["没吃过", "未食过", "mei6 sik6 gwo3"],
  ["我也是", "我都係", "ngo5 dou1 hai6"], ["我也要", "我都要", "ngo5 dou1 jiu3"],
  ["我不要", "我唔要", "ngo5 m4 jiu3"], ["我不想去", "我唔想去", "ngo5 m4 soeng2 heoi3"],
  ["我想回家", "我想返屋企", "ngo5 soeng2 faan1 uk1 kei2"],
  ["你先说", "你讲先", "nei5 gong2 sin1"], ["我先说", "我讲先", "ngo5 gong2 sin1"],
  ["轮到你", "到你", "dou3 nei5"], ["轮到我", "到我", "dou3 ngo5"],
  ["慢慢来", "慢慢嚟", "maan6 maan6 lai4"], ["不用客气", "唔使客气", "m4 sai2 haak3 hei3"],
  ["多谢帮忙", "多谢帮手", "do1 ze6 bong1 sau2"], ["谢谢帮忙", "多谢帮手", "do1 ze6 bong1 sau2"],
  ["拜托你", "唔该你", "m4 goi1 nei5"], ["麻烦帮我", "唔该帮我", "m4 goi1 bong1 ngo5"],
];

for (const [mandarin, cantonese, jyutping] of socialPhrases) {
  add(mandarin, cantonese, jyutping, "social", "phrase", "exact", 86, 0.93);
}

const foodPhrases = [
  ["我要点菜", "我要叫餸", "ngo5 jiu3 giu3 sung3"], ["我要结账", "我要埋单", "ngo5 jiu3 maai4 daan1"],
  ["请结账", "唔该埋单", "m4 goi1 maai4 daan1"], ["打包带走", "打包拎走", "daa2 baau1 ling1 zau2"],
  ["在这里吃", "喺度食", "hai2 dou6 sik6"], ["带走吃", "拎走食", "ling1 zau2 sik6"],
  ["少放点糖", "少甜", "siu2 tim4"], ["不要冰", "走冰", "zau2 bing1"],
  ["少放点冰", "少冰", "siu2 bing1"], ["多放点冰", "多冰", "do1 bing1"],
  ["不要辣", "唔辣", "m4 laat6"], ["少放点辣", "少辣", "siu2 laat6"],
  ["多放点辣", "多辣", "do1 laat6"], ["不要葱", "走葱", "zau2 cung1"],
  ["不要香菜", "走芫茜", "zau2 jyun4 sai1"], ["不要酱", "走酱", "zau2 zoeng3"],
  ["加饭", "加饭", "gaa1 faan6"], ["加面", "加面", "gaa1 min6"],
  ["加冰", "加冰", "gaa1 bing1"], ["加糖", "加糖", "gaa1 tong4"],
  ["热的", "热嘅", "jit6 ge3"], ["冷的", "冻嘅", "dung3 ge3"],
  ["大杯", "大杯", "daai6 bui1"], ["小杯", "细杯", "sai3 bui1"],
  ["中杯", "中杯", "zung1 bui1"], ["一份", "一份", "jat1 fan6"],
  ["两份", "两份", "loeng5 fan6"], ["这个好吃", "呢个好食", "ni1 go3 hou2 sik6"],
  ["这个难吃", "呢个难食", "ni1 go3 naan4 sik6"], ["太甜了", "太甜啦", "taai3 tim4 laa1"],
  ["太咸了", "太咸啦", "taai3 haam4 laa1"], ["太辣了", "太辣啦", "taai3 laat6 laa1"],
  ["不够热", "唔够热", "m4 gau3 jit6"], ["不够冷", "唔够冻", "m4 gau3 dung3"],
  ["有位置吗", "有冇位", "jau5 mou5 wai2"], ["几个人", "几多位", "gei2 do1 wai2"],
  ["两个人", "两位", "loeng5 wai2"], ["一个人", "一位", "jat1 wai2"],
  ["等位", "等位", "dang2 wai2"], ["订位", "订位", "deng6 wai2"],
  ["菜单给我", "餐牌畀我", "caan1 paai2 bei2 ngo5"],
  ["水给我", "水畀我", "seoi2 bei2 ngo5"], ["还要什么", "仲要咩", "zung6 jiu3 me1"],
  ["不要了", "唔要啦", "m4 jiu3 laa1"], ["够了", "够啦", "gau3 laa1"],
  ["吃饱了", "食饱咗", "sik6 baau2 zo2"], ["还没吃", "未食", "mei6 sik6"],
  ["吃完了", "食完喇", "sik6 jyun4 laa3"], ["喝完了", "饮完喇", "jam2 jyun4 laa3"],
  ["剩下的", "净低嘅", "zing6 dai1 ge3"], ["这个菜", "呢个餸", "ni1 go3 sung3"],
];
for (const [mandarin, cantonese, jyutping] of foodPhrases) {
  add(mandarin, cantonese, jyutping, "food", "phrase", "exact", 86, 0.93);
}

const shoppingPhrases = [
  ["这个多少钱", "呢个几多钱", "ni1 go3 gei2 do1 cin2"],
  ["能便宜点吗", "可唔可以平啲", "ho2 m4 ho2 ji5 peng4 di1"],
  ["有没有便宜一点的", "有冇平啲嘅", "jau5 mou5 peng4 di1 ge3"],
  ["有没有大一点的", "有冇大啲嘅", "jau5 mou5 daai6 di1 ge3"],
  ["有没有小一点的", "有冇细啲嘅", "jau5 mou5 sai3 di1 ge3"],
  ["有没有别的颜色", "有冇第二只色", "jau5 mou5 dai6 ji6 zek3 sik1"],
  ["我试一下", "我试下", "ngo5 si3 haa5"], ["可以试穿吗", "可唔可以试身", "ho2 m4 ho2 ji5 si3 san1"],
  ["在哪里付款", "喺边度畀钱", "hai2 bin1 dou6 bei2 cin2"],
  ["可以刷卡吗", "可唔可以拍卡", "ho2 m4 ho2 ji5 paak3 kaa1"],
  ["可以扫码吗", "可唔可以扫码", "ho2 m4 ho2 ji5 sou3 maa5"],
  ["有没有发票", "有冇单", "jau5 mou5 daan1"], ["有没有收据", "有冇收据", "jau5 mou5 sau1 geoi3"],
  ["可以退货吗", "可唔可以退货", "ho2 m4 ho2 ji5 teoi3 fo3"],
  ["可以换货吗", "可唔可以换货", "ho2 m4 ho2 ji5 wun6 fo3"],
  ["质量怎么样", "质素点样", "zat1 sou3 dim2 joeng6"],
  ["这个牌子", "呢个牌子", "ni1 go3 paai4 zi2"],
  ["太贵了吧", "太贵啦啩", "taai3 gwai3 laa1 gwaa3"],
  ["便宜很多", "平好多", "peng4 hou2 do1"], ["贵很多", "贵好多", "gwai3 hou2 do1"],
  ["买一送一", "买一送一", "maai5 jat1 sung3 jat1"],
  ["有折扣吗", "有冇折", "jau5 mou5 zit3"], ["会员价", "会员价", "wui6 jyun4 gaa3"],
  ["原价", "原价", "jyun4 gaa3"], ["特价", "特价", "dak6 gaa3"],
  ["网上买", "网上买", "mong5 soeng6 maai5"], ["店里买", "铺头买", "pou3 tau2 maai5"],
  ["送货上门", "送货上门", "sung3 fo3 soeng5 mun4"],
  ["什么时候到", "几时到", "gei2 si4 dou3"], ["今天能到吗", "今日到唔到", "gam1 jat6 dou3 m4 dou3"],
  ["明天能到吗", "听日到唔到", "ting1 jat6 dou3 m4 dou3"],
  ["地址写错了", "地址写错咗", "dei6 zi2 se2 co3 zo2"],
  ["电话号码错了", "电话号码错咗", "din6 waa2 hou6 maa5 co3 zo2"],
  ["我要这个", "我要呢个", "ngo5 jiu3 ni1 go3"],
  ["不要这个", "唔要呢个", "m4 jiu3 ni1 go3"],
  ["我要那个", "我要嗰个", "ngo5 jiu3 go2 go3"],
  ["拿这个", "攞呢个", "lo2 ni1 go3"], ["拿那个", "攞嗰个", "lo2 go2 go3"],
  ["帮我装起来", "帮我袋起佢", "bong1 ngo5 doi2 hei2 keoi5"],
  ["要袋子吗", "要唔要袋", "jiu3 m4 jiu3 doi2"],
  ["不用袋子", "唔使袋", "m4 sai2 doi2"],
  ["有现货吗", "有冇现货", "jau5 mou5 jin6 fo3"],
  ["卖完了", "卖晒", "maai6 saai3"], ["买完了", "买完喇", "maai5 jyun4 laa3"],
];
for (const [mandarin, cantonese, jyutping] of shoppingPhrases) {
  add(mandarin, cantonese, jyutping, "shopping", "phrase", "exact", 84, 0.92);
}

const transitPhrases = [
  ["怎么去", "点去", "dim2 heoi3"], ["怎么坐车", "点搭车", "dim2 daap3 ce1"],
  ["坐几号车", "搭几号车", "daap3 gei2 hou6 ce1"], ["在哪下车", "喺边度落车", "hai2 bin1 dou6 lok6 ce1"],
  ["下一站", "下一站", "haa6 jat1 zaam6"], ["上一站", "上一站", "soeng6 jat1 zaam6"],
  ["到站了", "到站喇", "dou3 zaam6 laa3"], ["过站了", "过咗站", "gwo3 zo2 zaam6"],
  ["坐过站", "搭过站", "daap3 gwo3 zaam6"], ["换乘地铁", "转港铁", "zyun2 gong2 tit3"],
  ["换乘巴士", "转巴士", "zyun2 baa1 si2"], ["坐出租车", "搭的士", "daap3 dik1 si2"],
  ["打出租车", "截的士", "zit6 dik1 si2"], ["叫车", "叫车", "giu3 ce1"],
  ["停车场", "停车场", "ting4 ce1 coeng4"], ["这里停车", "呢度泊车", "ni1 dou6 paak3 ce1"],
  ["不能停车", "唔可以泊车", "m4 ho2 ji5 paak3 ce1"],
  ["前面左转", "前面转左", "cin4 min6 zyun2 zo2"],
  ["前面右转", "前面转右", "cin4 min6 zyun2 jau6"],
  ["一直走", "一直行", "jat1 zik6 haang4"], ["往前走", "向前行", "hoeng3 cin4 haang4"],
  ["往回走", "行返转头", "haang4 faan1 zyun3 tau4"],
  ["过对面", "过对面", "gwo3 deoi3 min6"], ["在对面", "喺对面", "hai2 deoi3 min6"],
  ["在旁边", "喺隔离", "hai2 gaak3 lei4"], ["很远吗", "远唔远", "jyun5 m4 jyun5"],
  ["很近吗", "近唔近", "gan6 m4 gan6"], ["要多久", "要几耐", "jiu3 gei2 noi6"],
  ["多久到", "几耐到", "gei2 noi6 dou3"], ["快到了", "就到", "zau6 dou3"],
  ["还没到", "未到", "mei6 dou3"], ["已经到了", "已经到咗", "ji5 ging1 dou3 zo2"],
  ["票怎么买", "飞点买", "fei1 dim2 maai5"], ["在哪买票", "喺边度买飞", "hai2 bin1 dou6 maai5 fei1"],
  ["单程票", "单程飞", "daan1 cing4 fei1"], ["往返票", "来回飞", "loi4 wui4 fei1"],
  ["车来了", "车嚟咗", "ce1 lai4 zo2"], ["车走了", "车走咗", "ce1 zau2 zo2"],
  ["车很多", "好多车", "hou2 do1 ce1"], ["人很多", "好多人", "hou2 do1 jan4"],
  ["太挤了", "太逼啦", "taai3 bik1 laa1"], ["小心车", "小心车", "siu2 sam1 ce1"],
  ["小心台阶", "小心梯级", "siu2 sam1 tai1 kap1"],
  ["扶手在哪里", "扶手喺边度", "fu4 sau2 hai2 bin1 dou6"],
  ["入口在哪里", "入口喺边度", "jap6 hau2 hai2 bin1 dou6"],
  ["出口在哪里", "出口喺边度", "ceot1 hau2 hai2 bin1 dou6"],
  ["厕所在哪里", "厕所喺边度", "ci3 so2 hai2 bin1 dou6"],
  ["行李放哪里", "行李摆边度", "hang4 lei5 baai2 bin1 dou6"],
  ["帮我叫车", "帮我叫车", "bong1 ngo5 giu3 ce1"],
  ["去机场", "去机场", "heoi3 gei1 coeng4"], ["去酒店", "去酒店", "heoi3 zau2 dim3"],
  ["去车站", "去车站", "heoi3 ce1 zaam6"], ["去码头", "去码头", "heoi3 maa5 tau4"],
];
for (const [mandarin, cantonese, jyutping] of transitPhrases) {
  add(mandarin, cantonese, jyutping, "transit", "phrase", "exact", 84, 0.92);
}

const homeHealthWork = [
  ["家里有人", "屋企有人", "uk1 kei2 jau5 jan4", "home"], ["家里没人", "屋企冇人", "uk1 kei2 mou5 jan4", "home"],
  ["回到家", "返到屋企", "faan1 dou3 uk1 kei2", "home"], ["在家里", "喺屋企", "hai2 uk1 kei2", "home"],
  ["不在家", "唔喺屋企", "m4 hai2 uk1 kei2", "home"], ["房间很小", "间房好细", "gaan1 fong2 hou2 sai3", "home"],
  ["空调很冷", "冷气好冻", "laang5 hei3 hou2 dung3", "home"], ["冰箱坏了", "雪柜坏咗", "syut3 gwai6 waai6 zo2", "home"],
  ["钥匙丢了", "锁匙唔见咗", "so2 si4 m4 gin3 zo2", "home"], ["伞忘带了", "遮唔记得带", "ze1 m4 gei3 dak1 daai3", "home"],
  ["衣服湿了", "衫湿咗", "saam1 sap1 zo2", "home"], ["鞋子脏了", "鞋污糟咗", "haai4 wu1 zou1 zo2", "home"],
  ["洗手", "洗手", "sai2 sau2", "health"], ["洗干净", "洗干净", "sai2 gon1 zeng6", "home"],
  ["头很痛", "头好痛", "tau4 hou2 tung3", "health"], ["肚子很痛", "肚好痛", "tou5 hou2 tung3", "health"],
  ["牙很痛", "牙好痛", "ngaa4 hou2 tung3", "health"], ["喉咙不舒服", "喉咙唔舒服", "hau4 lung4 m4 syu1 fuk6", "health"],
  ["我感冒了", "我伤风", "ngo5 soeng1 fung1", "health"], ["我发烧了", "我发烧", "ngo5 faat3 siu1", "health"],
  ["我要看医生", "我要睇医生", "ngo5 jiu3 tai2 ji1 sang1", "health"], ["我要买药", "我要买药", "ngo5 jiu3 maai5 joek6", "health"],
  ["吃了药", "食咗药", "sik6 zo2 joek6", "health"], ["还没吃药", "未食药", "mei6 sik6 joek6", "health"],
  ["身体不舒服", "身体唔舒服", "san1 tai2 m4 syu1 fuk6", "health"], ["睡得不好", "瞓得唔好", "fan3 dak1 m4 hou2", "health"],
  ["睡得很好", "瞓得好好", "fan3 dak1 hou2 hou2", "health"], ["工作很忙", "返工好忙", "faan1 gung1 hou2 mong4", "work_school"],
  ["今天放假", "今日放假", "gam1 jat6 fong3 gaa3", "work_school"], ["明天上班", "听日返工", "ting1 jat6 faan1 gung1", "work_school"],
  ["我要请假", "我要请假", "ngo5 jiu3 ceng2 gaa3", "work_school"], ["我要加班", "我要加班", "ngo5 jiu3 gaa1 baan1", "work_school"],
  ["会议几点", "会议几点", "wui6 ji5 gei2 dim2", "work_school"], ["发邮件", "发电邮", "faat3 din6 jau4", "work_school"],
  ["回邮件", "覆电邮", "fuk1 din6 jau4", "work_school"], ["打印文件", "打印文件", "daa2 jan3 man4 gin2", "work_school"],
  ["交报告", "交报告", "gaau1 bou3 gou3", "work_school"], ["写作业", "做功课", "zou6 gung1 fo3", "work_school"],
  ["做功课", "做功课", "zou6 gung1 fo3", "work_school"], ["上课", "上堂", "soeng5 tong4", "work_school"],
  ["下课", "落堂", "lok6 tong4", "work_school"], ["听课", "听书", "teng1 syu1", "work_school"],
  ["复习", "温书", "wan1 syu1", "work_school"], ["考试通过", "考到", "haau2 dou2", "work_school"],
  ["考试没过", "肥佬", "fei4 lou2", "work_school"], ["迟到了", "迟到咗", "ci4 dou3 zo2", "work_school"],
  ["赶作业", "赶功课", "gon2 gung1 fo3", "work_school"], ["赶报告", "赶报告", "gon2 bou3 gou3", "work_school"],
];
for (const [mandarin, cantonese, jyutping, category] of homeHealthWork) {
  add(mandarin, cantonese, jyutping, category, "phrase", mandarin.includes("没人") || mandarin.includes("丢") ? "exact" : "exact", 82, 0.91);
}

const stateAndAdverbs = [
  ["非常好", "好好", "hou2 hou2"], ["非常漂亮", "好靓", "hou2 leng3"],
  ["非常便宜", "好平", "hou2 peng4"], ["非常贵", "好贵", "hou2 gwai3"],
  ["非常冷", "好冻", "hou2 dung3"], ["非常热", "好热", "hou2 jit6"],
  ["非常累", "好攰", "hou2 gui6"], ["非常忙", "好忙", "hou2 mong4"],
  ["有点冷", "有啲冻", "jau5 di1 dung3"], ["有点热", "有啲热", "jau5 di1 jit6"],
  ["有点累", "有啲攰", "jau5 di1 gui6"], ["有点忙", "有啲忙", "jau5 di1 mong4"],
  ["有点贵", "有啲贵", "jau5 di1 gwai3"], ["有点远", "有啲远", "jau5 di1 jyun5"],
  ["有点慢", "有啲慢", "jau5 di1 maan6"], ["有点奇怪", "有啲奇怪", "jau5 di1 kei4 gwaai3"],
  ["太冷", "太冻", "taai3 dung3"], ["太热", "太热", "taai3 jit6"],
  ["太累", "太攰", "taai3 gui6"], ["太远", "太远", "taai3 jyun5"],
  ["太慢", "太慢", "taai3 maan6"], ["太小", "太细", "taai3 sai3"],
  ["挺好", "几好", "gei2 hou2"], ["挺漂亮", "几靓", "gei2 leng3"],
  ["挺便宜", "几平", "gei2 peng4"], ["挺远", "几远", "gei2 jyun5"],
  ["挺近", "几近", "gei2 gan6"], ["挺快", "几快", "gei2 faai3"],
  ["挺慢", "几慢", "gei2 maan6"], ["挺累", "几攰", "gei2 gui6"],
  ["不太好", "唔系几好", "m4 hai6 gei2 hou2"], ["不太贵", "唔算好贵", "m4 syun3 hou2 gwai3"],
  ["不太远", "唔算远", "m4 syun3 jyun5"], ["不太冷", "唔算冻", "m4 syun3 dung3"],
  ["越来越好", "越嚟越好", "jyut6 lai4 jyut6 hou2"],
  ["越来越贵", "越嚟越贵", "jyut6 lai4 jyut6 gwai3"],
  ["越来越冷", "越嚟越冻", "jyut6 lai4 jyut6 dung3"],
  ["越来越忙", "越嚟越忙", "jyut6 lai4 jyut6 mong4"],
  ["越来越累", "越嚟越攰", "jyut6 lai4 jyut6 gui6"],
  ["一点也不", "一点都唔", "jat1 dim2 dou1 m4"],
  ["一点也不好", "一点都唔好", "jat1 dim2 dou1 m4 hou2"],
  ["一点也不贵", "一点都唔贵", "jat1 dim2 dou1 m4 gwai3"],
];
for (const [mandarin, cantonese, jyutping] of stateAndAdverbs) {
  add(mandarin, cantonese, jyutping, "adjective", "phrase", "exact", 82, 0.91);
}

const functionPatterns = [
  ["正在吃", "食紧", "sik6 gan2"], ["正在喝", "饮紧", "jam2 gan2"],
  ["正在看", "睇紧", "tai2 gan2"], ["正在说", "讲紧", "gong2 gan2"],
  ["正在听", "听紧", "teng1 gan2"], ["正在写", "写紧", "se2 gan2"],
  ["正在做", "做紧", "zou6 gan2"], ["正在等", "等紧", "dang2 gan2"],
  ["正在走", "行紧", "haang4 gan2"], ["正在买", "买紧", "maai5 gan2"],
  ["吃了饭", "食咗饭", "sik6 zo2 faan6"], ["喝了水", "饮咗水", "jam2 zo2 seoi2"],
  ["看了电影", "睇咗戏", "tai2 zo2 hei3"], ["买了东西", "买咗嘢", "maai5 zo2 je5"],
  ["去了哪里", "去咗边", "heoi3 zo2 bin1"], ["来了没有", "嚟咗未", "lai4 zo2 mei6"],
  ["吃过饭", "食过饭", "sik6 gwo3 faan6"], ["去过香港", "去过香港", "heoi3 gwo3 hoeng1 gong2"],
  ["比我高", "高过我", "gou1 gwo3 ngo5"], ["比你便宜", "平过你", "peng4 gwo3 nei5"],
  ["比这里远", "远过呢度", "jyun5 gwo3 ni1 dou6"], ["比那里近", "近过嗰度", "gan6 gwo3 go2 dou6"],
  ["没有那么贵", "冇咁贵", "mou5 gam3 gwai3"], ["没有那么远", "冇咁远", "mou5 gam3 jyun5"],
  ["没有那么冷", "冇咁冻", "mou5 gam3 dung3"], ["没有那么难", "冇咁难", "mou5 gam3 naan4"],
  ["这么说", "咁讲", "gam2 gong2"], ["这么做", "咁做", "gam2 zou6"],
  ["这么走", "咁行", "gam2 haang4"], ["这么贵", "咁贵", "gam3 gwai3"],
  ["这么远", "咁远", "gam3 jyun5"], ["这么冷", "咁冻", "gam3 dung3"],
  ["那么说", "咁讲", "gam2 gong2"], ["那么做", "咁做", "gam2 zou6"],
  ["哪有", "边有", "bin1 jau5"], ["哪会", "边会", "bin1 wui5"],
  ["怎么可能", "点可能", "dim2 ho2 nang4"], ["为什么不", "点解唔", "dim2 gaai2 m4"],
  ["能不能帮我", "可唔可以帮我", "ho2 m4 ho2 ji5 bong1 ngo5"],
  ["可不可以给我", "可唔可以畀我", "ho2 m4 ho2 ji5 bei2 ngo5"],
];
for (const [mandarin, cantonese, jyutping] of functionPatterns) {
  add(mandarin, cantonese, jyutping, "function", "pattern", "exact", 86, 0.92);
}

const extraNouns = [
  ["个人资料", "个人资料", "go3 jan4 zi1 liu6", "tech"], ["身份证", "身份证", "san1 fan6 zing3", "daily"],
  ["回乡证", "回乡证", "wui4 hoeng1 zing3", "daily"], ["证件照", "证件相", "zing3 gin2 soeng2", "daily"],
  ["照片打印", "晒相", "saai3 soeng2", "tech"], ["理发", "剪头发", "zin2 tau4 faat3", "daily"],
  ["发型", "发型", "faat3 jing4", "daily"], ["洗头", "洗头", "sai2 tau4", "daily"],
  ["剪短一点", "剪短啲", "zin2 dyun2 di1", "daily"], ["修一下", "修下", "sau1 haa5", "daily"],
  ["健身房", "健身室", "gin6 san1 sat1", "daily"], ["电影院", "戏院", "hei3 jyun2", "tech"],
  ["游泳池", "泳池", "wing6 ci4", "daily"], ["公园", "公园", "gung1 jyun2", "daily"],
  ["便利店", "便利店", "bin6 lei6 dim3", "shopping"], ["杂货店", "士多", "si6 do1", "shopping"],
  ["面包店", "面包店", "min6 baau1 dim3", "shopping"], ["药妆店", "药妆店", "joek6 zong1 dim3", "shopping"],
  ["洗衣店", "洗衣店", "sai2 ji1 dim3", "shopping"], ["邮局", "邮政局", "jau4 zing3 guk6", "daily"],
  ["派出所", "差馆", "caai1 gun2", "daily"], ["消防局", "消防局", "siu1 fong4 guk6", "daily"],
  ["急诊", "急症室", "gap1 zing3 sat1", "health"], ["门诊", "门诊", "mun4 can2", "health"],
  ["挂号", "登记", "dang1 gei3", "health"], ["排号", "攞筹", "lo2 cau4", "daily"],
  ["叫号", "叫筹", "giu3 cau4", "daily"], ["号码牌", "筹", "cau4", "daily"],
  ["零钱", "散纸", "saan2 zi2", "shopping"], ["硬币", "银仔", "ngan4 zai2", "shopping"],
  ["纸币", "纸币", "zi2 bai6", "shopping"], ["押金", "按金", "on3 gam1", "shopping"],
  ["房东", "业主", "jip6 zyu2", "home"], ["租客", "租客", "zou1 haak3", "home"],
  ["水费", "水费", "seoi2 fai3", "home"], ["电费", "电费", "din6 fai3", "home"],
  ["管理费", "管理费", "gun2 lei5 fai3", "home"], ["按门铃", "㩒门钟", "gam6 mun4 zung1", "home"],
  ["门铃", "门钟", "mun4 zung1", "home"], ["按钮", "掣", "zai3", "home"],
  ["按钮开关", "开关掣", "hoi1 gwaan1 zai3", "home"], ["电灯开关", "灯掣", "dang1 zai3", "home"],
  ["水管", "水喉", "seoi2 hau4", "home"], ["煤气", "煤气", "mui4 hei3", "home"],
  ["厨房纸", "厨房纸", "cyu4 fong2 zi2", "home"], ["保鲜膜", "保鲜纸", "bou2 sin1 zi2", "home"],
  ["塑料袋", "胶袋", "gaau1 doi2", "shopping"], ["塑料瓶", "胶樽", "gaau1 zeon1", "shopping"],
  ["瓶子", "樽", "zeon1", "shopping"], ["罐子", "罐", "gun3", "shopping"],
  ["盒子", "盒", "hap6", "shopping"], ["袋子", "袋", "doi2", "shopping"],
  ["杯子", "杯", "bui1", "food"], ["碗", "碗", "wun2", "food"],
  ["筷子", "筷子", "faai3 zi2", "food"], ["勺子", "匙羹", "ci4 gang1", "food"],
  ["叉子", "叉", "caa1", "food"], ["盘子", "碟", "dip6", "food"],
  ["纸杯", "纸杯", "zi2 bui1", "food"], ["吸管", "饮管", "jam2 gun2", "food"],
];
for (const [mandarin, cantonese, jyutping, category] of extraNouns) {
  add(mandarin, cantonese, jyutping, category, "noun", "exact", 80, 0.9);
}

const errandPhrases = [
  ["办理手续", "办手续", "baan6 sau2 zuk6", "daily"], ["填表", "填表", "tin4 biu2", "daily"],
  ["排队取号", "排队攞筹", "paai4 deoi2 lo2 cau4", "daily"], ["等叫号", "等叫筹", "dang2 giu3 cau4", "daily"],
  ["复印身份证", "影印身份证", "jing2 jan3 san1 fan6 zing3", "daily"],
  ["拍证件照", "影证件相", "jing2 zing3 gin2 soeng2", "daily"],
  ["交资料", "交资料", "gaau1 zi1 liu6", "daily"], ["补资料", "补资料", "bou2 zi1 liu6", "daily"],
  ["拿号码牌", "攞筹", "lo2 cau4", "daily"], ["等结果", "等结果", "dang2 git3 gwo2", "daily"],
  ["改时间", "改时间", "goi2 si4 gaan3", "time"], ["改地址", "改地址", "goi2 dei6 zi2", "daily"],
  ["改名字", "改名", "goi2 meng2", "daily"], ["写名字", "写名", "se2 meng2", "daily"],
  ["写地址", "写地址", "se2 dei6 zi2", "daily"], ["签这里", "喺呢度签名", "hai2 ni1 dou6 cim1 meng2", "daily"],
  ["签那里", "喺嗰度签名", "hai2 go2 dou6 cim1 meng2", "daily"],
  ["盖章", "盖印", "koi3 jan3", "daily"], ["复核", "覆核", "fuk1 hat6", "daily"],
  ["确认一下", "确认下", "kok3 jing6 haa5", "daily"], ["取消预约", "取消预约", "ceoi2 siu1 jyu6 joek3", "daily"],
  ["重新预约", "重新预约", "cung4 san1 jyu6 joek3", "daily"],
  ["预约时间", "预约时间", "jyu6 joek3 si4 gaan3", "daily"],
  ["预约成功", "预约成功", "jyu6 joek3 sing4 gung1", "daily"],
  ["预约失败", "预约失败", "jyu6 joek3 sat1 baai6", "daily"],
  ["资料不齐", "资料唔齐", "zi1 liu6 m4 cai4", "daily"],
  ["资料错了", "资料错咗", "zi1 liu6 co3 zo2", "daily"],
  ["名字错了", "名错咗", "meng2 co3 zo2", "daily"],
  ["地址错了", "地址错咗", "dei6 zi2 co3 zo2", "daily"],
  ["时间错了", "时间错咗", "si4 gaan3 co3 zo2", "time"],
  ["再检查一下", "再检查下", "zoi3 gim2 caa4 haa5", "daily"],
  ["麻烦检查一下", "唔该检查下", "m4 goi1 gim2 caa4 haa5", "daily"],
  ["等通知", "等通知", "dang2 tung1 zi1", "daily"],
  ["收到通知", "收到通知", "sau1 dou2 tung1 zi1", "daily"],
  ["没有收到", "冇收到", "mou5 sau1 dou2", "daily"],
  ["还没收到", "未收到", "mei6 sau1 dou2", "daily"],
  ["需要多久", "要几耐", "jiu3 gei2 noi6", "time"],
  ["今天办不了", "今日办唔到", "gam1 jat6 baan6 m4 dou2", "daily"],
  ["明天再来", "听日再嚟", "ting1 jat6 zoi3 lai4", "time"],
  ["下午再来", "下昼再嚟", "haa6 zau3 zoi3 lai4", "time"],
];
for (const [mandarin, cantonese, jyutping, category] of errandPhrases) {
  add(mandarin, cantonese, jyutping, category, "phrase", "exact", 82, 0.91);
}

const appended = [];
for (const entry of candidates) {
  const mandarin = entry[columnIndex.mandarin];
  const cantonese = entry[columnIndex.cantonese];
  if (vocab.entries.length >= targetSize) {
    break;
  }
  if (!mandarin || !cantonese || mandarin === cantonese) {
    continue;
  }
  if (existingMandarin.has(mandarin)) {
    continue;
  }
  existingMandarin.add(mandarin);
  vocab.entries.push(entry);
  appended.push(mandarin);
}

if (vocab.entries.length !== targetSize) {
  throw new Error(
    `Expected ${targetSize} entries after expansion, got ${vocab.entries.length}. Appended ${appended.length}.`,
  );
}

vocab.metadata.targetSize = String(targetSize);
vocab.metadata.description =
  "普通话到粤语口语高频差异词表。已去除普通话/粤语写法完全相同的条目，保留日常高频差异词和短语。";

await writeFile(vocabUrl, `${JSON.stringify(vocab, null, 2)}\n`);
console.log(`Appended ${appended.length} entries; total ${vocab.entries.length}.`);
