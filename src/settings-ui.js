// 游戏配置编辑器：所有输入先进入当前账号草稿，保存与预览分别请求不同接口。
const configEditor = { owner: null, data: null, draft: null, baseline: null, category: 'base', busy: false, loading: false, serial: 0, fields: new Map(), widgets: new Map(), groups: new Map(), selectedGroups: {}, errors: {}, playerData: null, playerRequest: null, playerError: '', playerWidgets: [] };
const configCategories = { base: '基地', world: '世界', heroes: '英雄', daily: '日常与活动' };
const baseFamilies = [
  { id: 'construction', title: '建设', groups: ['building'] },
  { id: 'production', title: '生产', groups: ['factory', 'farm', 'gather', 'forge'] },
  { id: 'events', title: '事件', groups: ['resident', 'cargo', 'events'] },
  { id: 'foundation', title: '基础', groups: ['pet', 'museum', 'resources', 'gold'] },
];
const configLegacyGroups = new Map();
const familyGroups = new Map();
const configField = (key, label, kind = 'switch', options = {}) => ({ key, label, kind, ...options });
const configZeroHints={
 'gather.fishingGoldReserve':'0 表示不保留强化金币。','forge.materialReserve':'0 表示不保留普通材料。','forge.universalReserve':'0 表示不保留万能材料。','forge.goldReserve':'0 表示不保留金币。',
 'museum.stockThreshold':'0 表示关闭库存条件。','resources.keepAccelerators':'0 表示不保留加速器。','resources.diamondThreshold':'0 表示不保留钻石。','gold.times':'0 表示不自动付费点金。',
 'treasure.minDurabilityPercent':'0 表示不设比例门槛，零耐久仍需维修。','treasure.petrolReserve':'0 表示不保留汽油。','radar.minDurabilityPercent':'0 表示不设比例门槛，仍须有耐久。','radar.petrolReserve':'0 表示不保留汽油。',
 'pirateHunt.minDurabilityPercent':'0 表示不设比例门槛，仍须有耐久。','pirateHunt.petrolReserve':'0 表示不保留汽油。','cityWar.petrolReserve':'0 表示不保留汽油。','heroes.keepExp':'0 表示不保留英雄经验。',
 'trials.maxSingleCost':'0 表示禁止付费扫荡。','trials.dailyDiamondBudget':'0 表示禁止付费扫荡。'
};
const configGroups = [
  {id:'ad-rewards',title:'广告奖励',category:'daily',fields:[
    configField('ads.noPrivilege','无免广告权益时也领取','switch',{help:'默认关闭。开启后，没有免广告权益的账号也会提交广告申请，不播放视频，等待下方秒数后直接领奖。这不是游戏客户端的正常流程，服务器可能识别，存在账号处罚风险，请自行评估。试炼与走江助力的广告档也受此开关控制；有权益的账号不受影响。'}),
    configField('ads.waitSeconds','广告申请后等待','number',{unit:'秒',when:d=>d.ads.noPrivilege,help:'默认15秒，是挂机收益、英雄招募、工厂加速、藏品招募、广告商店、节庆礼包和雪球礼包都实测成功过的时长。5秒只在藏品招募上测通，广告商店3秒被拒。等待会占用账号操作队列，挂机每轮最多处理1次；服务器返回未完成时跳过该入口并冷却5分钟。'}),
    configField('schedule.afkAd','闯关挂机广告收益','switch',{help:'每天1次。游戏只在普通领取后的60秒内提供此入口，因此需同时开启“闯关挂机收益”，普通领取后立即执行。账号需有免广告权益，或开启上方“无权益时也领取”。'}),
    configField('schedule.adShop','广告商店资源','switch',{help:'按商品每日次数领取。账号需有免广告权益，或开启上方“无权益时也领取”。'}),
    configField('schedule.heroAdRecruit','英雄广告招募','switch',{help:'每天3次，不消耗招募券或钻石。账号需有免广告权益，或开启上方“无权益时也领取”。'}),
    configField('schedule.antiqueAdRecruit','藏品广告招募','switch',{help:'每天3次，不消耗招募券或钻石。账号需有免广告权益，或开启上方“无权益时也领取”。'}),
    configField('schedule.compassAdGift','龙王罗盘每日广告礼包','switch',{help:'每天1次，活动开放时可领。账号需有免广告权益，或开启上方“无权益时也领取”。'}),
    configField('schedule.adSpeedUpProduce','工厂生产广告加速','switch',{help:'每天3次，每次30分钟，优先剩余时间最长的生产队列，只加速已开工的目标，不使用加速器。遵守工厂禁用名单。账号需有免广告权益，或开启上方“无权益时也领取”。'}),
    configField('schedule.adSpeedUpBuilding','建筑升级广告加速','switch',{help:'每天3次，与博物馆展柜共用次数，每次30分钟，只加速施工中的建筑。遵守建筑禁用名单。尚未经真实账号验证，回读确认不到次数变化时不重复提交。账号需有免广告权益，或开启上方“无权益时也领取”。'}),
    configField('schedule.adSpeedUpMuseum','博物馆展柜广告加速','switch',{help:'与建筑升级共用每天3次，优先剩余时间更长的目标，到期后自动提交展柜完工。尚未经真实账号验证，回读确认不到次数变化时不重复提交。账号需有免广告权益，或开启上方“无权益时也领取”。'}),
  ]},
  {id:'military-week',title:'周期 · 军备竞赛',category:'daily',fields:[
    configField('schedule.armsRaceRewards','军备竞赛达标奖励与免费补给','switch',{help:'周期活动。按本人积分、房间等级、当日主题判断5档奖励；独立补给页只领标价为零的礼包。'}),
  ]},
  {id:'river-series',title:'限时 · 联动系列',category:'daily',fields:[
    configField('schedule.riverScore','走江踏浪 · 积分奖励'),configField('schedule.riverPass','走江踏浪 · 走江战令'),
    configField('schedule.riverHelp','走江助力 · 免费和广告礼包','switch',{help:'广告档要求当前渠道支持，且账号有免广告权益或已在“广告奖励”中开启无权益领取。'}),
    configField('schedule.festivalSign','酆都诡事 · 每日签到'),configField('schedule.festivalFreeGift','酆都诡事 · 免费特惠'),
    configField('schedule.festivalActiveRewards','酆都诡事 · 活跃奖励'),configField('schedule.edict','酆都法旨 · 解符'),configField('schedule.evilExpel','驱邪除祟 · 累计奖励'),
    configField('schedule.edictPass','酆都法旨 · 法旨战令','switch',{help:'默认开启。只领取积分已达标的档位，不消耗贡品；已购通行证时一并领取对应奖励。'}),
    configField('schedule.compassDaily','龙王罗盘 · 每日免费礼包'),configField('schedule.compassReward','龙王罗盘 · 积分奖励'),
    configField('schedule.compassSpin','龙王罗盘 · 自动抽取'),
    configField('eventActions.compassThreshold','铜钱达到多少开始抽取','number',{unit:'枚',help:'每轮先核对活动、道具单价与库存，默认10枚。'}),
    configField('eventActions.compassDrawCount','每批最多抽取','choice',{numeric:true,options:[[1,'1次'],[5,'5次'],[10,'10次'],[50,'50次']],help:'按实际铜钱和游戏支持的批次选择，每轮最多一批。'}),
  ]},
  {id:'merchant-week',title:'周期 · 海商王',category:'daily',fields:[
    configField('schedule.merchantTrade','根据商情自动走商','switch',{help:'周期活动。在贸易时段读取本港报价、船舱和联盟紧缺货情报，先买本港跌幅最大的可购商品，售罄时顺延，同跌幅优先整船折价金额较高的货物，再按所持商品找紧缺城池；无匹配商情时持货等待，到港有盈利才卖，再从当地选货。'}),
    configField('schedule.merchantRewards','领取战令、利润和联盟奖励','switch',{help:'按本期利润、战令分数、联盟任务进度和当日商情贡献领取已达成档。'}),
  ]},
  {id:'side-rewards',title:'漫剧 · 擂台赛 · 赛季宝箱',category:'daily',fields:[
    configField('schedule.comicDrama','漫剧观看与每日奖励','switch',{help:'默认开启。已解锁的集数每轮最多处理 10 集，并在每天领取 1 次每日奖励；当天没有新集时重看最后一集以满足领取条件。'}),
    configField('schedule.tournamentDailyGift','擂台赛每日礼包','switch',{help:'默认开启。只在擂台赛进行阶段按服务器记录每天领取 1 次，不参与投注和布阵。'}),
    configField('schedule.seasonChest','赛季宝箱用钥匙开启','switch',{help:'默认关闭。每箱消耗服务器指定的 3 把钥匙，每轮最多 5 箱，钥匙不足时等待，不花钻石，也不发起钥匙交换。钥匙在进入新赛季时清零，建议赛季内开启。'}),
  ]},
  {id:'beauty-contest',title:'限时 · 海上风采大赛',category:'daily',fields:[
    configField('schedule.beautyVotes','每天投给当前最高票选手','switch',{help:'限时活动，每天投够3票即停；已投票数计入目标，同票按编号升序选择。'}),
    configField('schedule.beautyGift','领取每日投票礼包'),
  ]},
  { id: 'building', title: '建筑', category: 'base', fields: [
    configField('building.enabled', '总开关'), configField('building.collect', '自动领取产出'), configField('building.build', '自动建造'),
    configField('building.upgrade', '自动升级'), configField('building.finish', '自动完工'),
    configField('building.supply', '缺料时为建筑备料', 'switch', { help: '为符合等级和前置条件的建造、升级补产材料，遵守工厂开关、禁用名单和需求优先级。' }),
    configField('building.disabledTypes', '禁止建筑', 'multi', { catalog: 'buildings', empty: '未选择，允许全部建筑', help: '所选类型不再自动建造、升级或备料；产出领取与已有施工的完工独立控制。' }),
    configField('building.speedUp', '自动加速', 'switch', { help: '只使用已有加速器，并遵守公共保留数量。' }),
    configField('building.keepBlueprints', '保留建筑蓝图数量', 'number', { unit: '张', help: '消耗后的蓝图数量不得低于此值，0 表示不保留。' }),
    configField('building.maxBuilds', '每轮最多建造', 'number', { unit: '座', help: '填 0 时本轮不新增建造。' }),
    configField('building.maxUpgrades', '每轮最多升级', 'number', { unit: '座', help: '包含为订单升级的工厂，填 0 时本轮不升级。' }),
  ] },
  { id: 'factory', title: '工厂', category: 'base', fields: [
    configField('factory.enabled', '总开关'), configField('factory.gain', '自动领取产品'), configField('factory.produce', '自动生产'),
    configField('factory.cooperateNative', '按需求调整游戏自动生产目标', 'switch', { help:'独立于普通自动排产，只调整游戏中已开启的自动生产目标，补齐种子及上游需求；保留正在生产队列，目标调整后回读确认并间隔至少60秒，不购买材料。' }),
    configField('factory.disabledTypes', '禁用工厂', 'multi', { catalog: 'factories', empty: '未选择，允许全部工厂', help: '控制台不再新增生产或加速，已完成产品仍按领取开关处理。游戏内已有的原生自动生产设置保持原状。' }),
    configField('factory.keepStock', '备货水位', 'number', { unit: '件 / 产品', help: '计入库存、待领取与在产数量，实际不超过游戏仓库上限。0 表示只为需求生产。' }),
    configField('factory.demandFirst', '按需优先生产'),
    configField('factory.demandPriority', '需求优先级', 'priority', { wide: true, help: '按列表顺序优先补料。勾选“工厂加速”后，会加速该来源仍缺少的在产物品；移除的来源不会自动补回。' }),
    configField('factory.speedUp', '自动加速生产', 'switch', { help: '与按来源加速独立；两种方式都遵守加速器保留量。' }),
    configField('factory.speedUpItems', '加速物品', 'multi', { catalog: 'materials', empty: '未选择，允许全部在产物品', when: d => d.factory.speedUp }),
  ] },
  { id: 'farm', title: '农田', category: 'base', fields: [
    configField('farm.enabled', '总开关'), configField('farm.harvest', '自动收割'),
    configField('farm.autoPlant', '自动种植', 'switch', { help: '按需求与现有种子安排作物；与自定义种植互斥，也可都关闭。' }),
    configField('farm.customPlant', '自定义种植', 'switch', { help: '开启后按下方顺序与水位种植，并暂停游戏内的自动种植。' }),
    configField('farm.crops', '种植优先级与备货水位', 'crops', { wide: true, when: d => d.farm.customPlant, help: '从上向下补足所需作物，计入田间预计产量。水位 0 表示不备货。' }),
    configField('farm.speedUp', '自动加速', 'switch', { help: '只催熟仍有需求的作物，遵守公共加速器保留量。' }),
  ] },
  { id: 'gather', title: '采集', category: 'base', fields: [
    configField('gather.fishing', '自动钓鱼', 'switch', { help: '钓具达到 2 级后，每轮一竿；鱼库存满时跳过。' }),
    configField('gather.fishBook','满仓继续开拓大鱼图鉴','switch',{when:d=>d.gather.fishing,help:'每轮最多一竿。图鉴集齐后自动关闭此项，常规钓鱼仍按仓储上限执行。'}),
    configField('gather.floaters', '自动打捞'), configField('gather.antiqueFloaters','打捞藏品宝箱'),
    configField('gather.continueWhenFull', '满仓继续打捞', 'switch', { help: '关闭时跳过仓库已满的原料。', when: d => d.gather.floaters }),
    configField('gather.diving', '自动潜水'),
    configField('gather.keyOpen', '钥匙开箱', 'switch', { help: '每轮潜水成功后最多使用 1 把现有保险箱钥匙，不会购买钥匙。', when: d => d.gather.diving }),
    configField('gather.salvage', '自动拾荒'),
    configField('gather.upgradeFishing', '钓鱼升级'), configField('gather.upgradeDiving', '潜水升级'), configField('gather.upgradeSalvage', '拾荒升级'),
    configField('gather.targetLevel', '目标等级', 'number', { unit: '级', help: '达到目标后停止强化和升级；仍需满足游戏建筑数量与等级条件。' }),
    configField('gather.fishingGoldReserve', '钓具强化后保留金币', 'number', { unit: '金币', when: d => d.gather.upgradeFishing }),
  ] },
  { id: 'resident', title: '居民需求', category: 'base', fields: [
    configField('resident.enabled', '自动满足'), configField('resident.skipCrops', '跳过农作物订单'), configField('resident.skipProduction', '跳过需生产的订单'),
    configField('resident.blockedMaterials', '不准消耗', 'multi', { catalog: 'materials', empty: '未选择，允许消耗所有材料', help: '订单包含所选材料时，不自动交付。' }),
    configField('resident.minExp', '最低经验', 'number', { help: '奖励低于此值或无法确认奖励时跳过，0 表示不限制。' }),
    configField('resident.minGold', '最低金币', 'number', { unit: '金币', help: '0 表示不限制。' }),
    configField('resident.reroll', '不达最低经验或金币时自动换单', 'switch', { help: '任一最低奖励不满足时自动换单，也用于跳过农作物、需生产及禁用材料等不符合条件的订单；达到每日上限不会换单。角色12级起可用，关闭时只跳过并保留原订单。' }),
    configField('resident.dailyCap', '每日满足上限', 'number', { unit: '单', help: '同时参考游戏今日完成数和本工具记录，0 表示不限。' }),
    configField('resident.rewards', '自动领取进度奖励'),
  ] },
  { id: 'cargo', title: '贸易港口', category: 'base', fields: [
    configField('cargo.enabled', '自动贸易'), configField('cargo.dailyLoadLimit', '每日装货上限', 'number', { unit: '次', help: '本工具每批装货请求计 1 次，收货不计；0 表示不限。北京时间每日零点重置。' }),
  ] },
  { id: 'events', title: '随机事件', category: 'base', fields: [
    configField('events.otherOption','其他随机事件默认选项','choice',{options:[[1,'第一个选项'],[2,'第二个选项']],numeric:true,help:'海上资源补给仍选建造居民房，居民离开仍选让他离开；其他已知事件按此选项处理，不把选项名称推断为收益高低。'}),
    configField('events.enabled', '自动处理', 'switch', { help: '海上资源补给选择“建造居民房”；居民离开选择“让他离开”；其他服务器事件按上方默认选项处理，不等待手选。' }),
  ] },
  { id: 'pet', title: '海兽培育室', category: 'base', fields: [
    configField('schedule.petCollect', '沿用原规则领取成熟海兽', 'switch', { help: '保留原挂机设置。开启海兽培育总开关后，改用本组领取、品质与用料参数。' }),
    configField('schedule.petBreed', '沿用原规则培育海兽', 'switch', { help: '每轮最多一只，最高橙色并保留一万金币。开启海兽培育总开关后，改用本组品种、品质与材料参数。' }),
    configField('pet.enabled', '总开关'), configField('pet.claim', '自动领取'), configField('pet.breed', '自动培育'),
    configField('pet.species', '培育种类', 'multi', { catalog: 'petSpecies', empty: '请选择要培育的海兽', when: d => d.pet.breed }),
    configField('pet.release','自动放生','switch',{help:'确认领取后扫描全部库存，只处理所选品质的闲置未养成对象。游戏客户端本地锁定名单不可读。'}),
    configField('pet.releaseQualities','处理品质','multi',{catalog:'petQualities',empty:'未选择，不处理',when:d=>d.pet.release}),
    configField('pet.quality', '培育品质上限', 'choice', { options: [['BLUE', '蓝色'], ['PURPLE', '紫色'], ['ORANGE', '橙色'], ['RED', '红色']], when: d => d.pet.breed, help: '在所选品质及以下，从材料足够的低品质开始尝试。' }),
    configField('pet.universal', '允许消耗万能基因', 'switch', { help: '仅在普通基因不足时，用对应的已有自选基因补足。', when: d => d.pet.breed }),
    configField('pet.feed', '自动喂养', 'switch', { help: '消耗服务器列出的喂养材料，加快当前培育。' }),
    configField('pet.advance', '自动进阶', 'switch', { help: '对已入驻的海兽投喂进阶材料；达到喂养和等级要求后进阶。' }),
  ] },
  { id: 'forge', title: '装备自动锻造', category: 'base', fields: [
    configField('forge.enabled', '自动锻造总开关', 'switch', { help: '开始挂机后生效，自动领取所选工厂已完成的装备，再安排下一件。下方选择“装备锻造”预览；不会开启游戏原生自动锻造。' }),
    configField('forge.buildingIds', '锻造工厂', 'multi', { catalog: 'forgeBuildings', empty: '请选择装备工厂' }),
    configField('forge.decompose','自动分解','switch',{help:'确认领取后扫描全部库存，只处理所选品质的闲置未养成对象。游戏客户端本地锁定名单不可读。'}),
    configField('forge.decomposeQualities','处理品质','multi',{catalog:'equipQualities',empty:'未选择，不处理',when:d=>d.forge.decompose}),
    configField('forge.recipeIds', '配方优先顺序', 'multi', { catalog: 'forgeRecipes', empty: '请选择锻造配方', help: '按勾选先后依次尝试，使用首个满足赛季、材料和预算的配方。产出装备和星级遵守游戏随机规则。' }),
    configField('forge.universal', '允许万能材料补足', 'switch', { help: '仅补实际不足的对应品质材料，不用来绕过普通材料保留量。' }),
    configField('forge.materialReserve', '普通材料保留量', 'number', { unit: '每种', help: '一次锻造后，每种消耗的普通材料不得低于此值。' }),
    configField('forge.universalReserve', '万能材料保留量', 'number', { unit: '每种', when: d => d.forge.universal }),
    configField('forge.goldReserve', '锻造后保留金币', 'number', { unit: '金币' }),
    configField('forge.dailyLimit', '每日锻造次数上限', 'number', { unit: '次', help: '至少1次；只计本工具下单，未知结果仍占额度。' }),
    configField('forge.dailyGoldLimit', '每日锻造金币预算', 'number', { unit: '金币', help: '至少1金币，跨轮和重启保留；不自动购买材料、不消耗钻石或加速器。' }),
    configField('forge.checkEverySeconds', '锻造检查间隔', 'number', { unit: '秒', help: '制作完成后正常领取，确认新装备入库再继续；领取不受新下单次数上限阻断。' }),
  ] },
  { id: 'museum', title: '博物馆探宝', category: 'base', fields: [
    configField('schedule.museumCollect', '沿用原规则领取探险奖励', 'switch', { help: '保留原挂机设置。开启本组自动探宝后，改用本组规则统一领取和派遣。' }),
    configField('schedule.museumExplore', '沿用原规则派遣探险', 'switch', { help: '每轮一队并预留订单材料。开启本组自动探宝后，改用本组地图、倍数与指南规则。' }),
    configField('museum.enabled', '自动探宝'), configField('museum.upgrade', '自动升级技能与展区'),
    configField('museum.factor', '常规探宝倍数', 'number', { unit: '倍', help: '可选 1–3 倍；未解锁时按当前最高可用倍数执行，保留已选设置。' }),
    configField('museum.materialFactor', '根据材料调整倍数'),
    configField('museum.factorMaterials', '命中材料名单', 'multi', { catalog: 'materials', empty: '未选择，仅检查库存阈值', when: d => d.museum.materialFactor }),
    configField('museum.stockThreshold', '库存阈值', 'number', { when: d => d.museum.materialFactor, help: '任一所需材料库存不高于此值时使用命中倍数；0 关闭库存条件。' }),
    configField('museum.matchedFactor', '命中时倍数', 'number', { unit: '倍', when: d => d.museum.materialFactor }),
    configField('museum.maps', '探宝地图', 'multi', { catalog: 'maps', empty: '未选择，不限制地图', help: '控制新派遣与指南使用；已经完成的探宝仍可领取。' }),
    configField('museum.useGuide', '使用探险指南'),
    configField('museum.dailyGuideLimit', '每日指南上限', 'number', { unit: '本', help: '每本缩短 30 分钟，填 0 表示不使用；保存配置或重启不会清零当日记录。' }),
  ] },
  { id: 'resources', title: '加速与钻石', category: 'base', fields: [
    configField('resources.keepAccelerators', '保留加速器数量', 'number', { unit: '个', help: '所有自动加速共用保留量，消耗后不得低于此值。' }),
    configField('resources.allowDiamonds', '允许自动消耗钻石'),
    configField('resources.diamondThreshold', '钻石保留阈值', 'number', { unit: '钻石', help: '本工具消费后余额不得低于此值。游戏内手动消费不受此开关限制。' }),
    configField('resources.diamondDailyLimit', '每日钻石使用量', 'number', { unit: '钻石', help: '0 表示禁止自动花钻石。统计启用本版本后的自动消费，升级前与游戏内手动消费不计入。北京时间零点重置；结果不明的已发送消费仍占额度。' }),
  ] },
  { id: 'gold', title: '每日点金', category: 'base', fields: [
    configField('gold.enabled', '每日付费点金'), configField('gold.times', '点金次数', 'number', { unit: '次 / 天', help: '按游戏当天已付费次数补足目标，包含手动次数；免费点金不计入。结果不明的请求保留次数与钻石额度。' }),
  ] },
  { id: 'treasure', title: '万吨巨轮', category: 'world', fields: [
    configField('treasure.enabled', '巨轮自动化总开关', 'switch', { help: '开始挂机后生效，独立于基地自动化。按所选舰队、参与模式和预算出征；耐久不足可先普通维修。不会召回、补油或修改编队。' }),
    configField('treasure.autoJoin', '常规自动参加', 'switch', { when:d=>!d.treasure.follow, help:'仅在未开启指定跟随时生效。开启跟随后，以名单为硬条件，不使用常规自动参加兜底。' }),
    configField('treasure.participationMode', '参与模式', 'radio', { options: [['untilFull', '打满就停'], ['always', '每次参与']], help: '打满就停：达到游戏今日领奖上限后不再派遣或维修。每次参与：领奖已满仍可参加，但不增加奖励次数，其他限制仍有效。' }),
    configField('treasure.repeatAttack', '反复攻占', 'switch', { help: '已确认出征后，被打回或返航且回到主城空闲时，可再次参与同一货轮。请求结果未知时继续等待确认。' }),
    configField('treasure.follow', '跟随指定玩家', 'switch', { help: '识别名单中正在前往货轮的舰队，也兼容当前守军。收到可识别的出发推送后会提前唤醒检查，发送前仍核对目标、预算、避战和舰队占用。历史排名、已返航或过期行军不会触发；未收到推送时按原检查间隔读取，不能保证同时抵达或必得奖励。' }),
    configField('treasure.fleetIds', '参与舰队', 'multi', { catalog: 'expeditionFleets', empty: '请选择参与舰队，空选不派遣', help: '只使用已建成、有英雄编队且实际空闲的舰队；行军、战斗、维修和驻外等占用会跳过。游戏自动作战开关开启不等于正在作战。' }),
    configField('treasure.followPlayerIds', '跟随名单', 'players', { when: d => d.treasure.follow, help: '从当前账号的盟友名单搜索多选，按选择顺序优先跟随。使用完整角色 ID 区分同名玩家；也可补充未列出的角色 ID。未列出的已选 ID 仍保留，需要时手动移除。' }),
    configField('treasure.followNames', '补充跟随昵称（可选）', 'names', { when: d => d.treasure.follow, help: '保留原有手填名单。每行一个完整昵称，角色 ID 名单优先；同名无法确认身份时跳过。', placeholder: '每行输入一位其他玩家的完整昵称' }),
    configField('treasure.rewardItems', '目标奖励', 'multi', { catalog: 'materials', empty: '不筛选奖励', help: '选择后只参加含任一所选奖励的万吨货轮；跟随模式也遵守此项。' }),
    configField('treasure.avoidNames', '避战玩家名称', 'names', { help: '每行填写一位玩家的完整昵称，按名称完全匹配，同名玩家都会避开。只判断货轮当前守军和战斗者；历史排名中已离开的玩家不会单独触发。避战优先于跟随。', placeholder: '每行输入一位玩家的完整昵称' }),
    configField('treasure.avoidPlayerIds', '已有避战角色 ID', 'names', { when: d => d.treasure.avoidPlayerIds.length > 0, help: '保留此前保存的精确角色 ID，每行一个。可删除不再需要的条目；新玩家请在上方填写名称。', placeholder: '每行一个已有的完整角色 ID' }),
    configField('treasure.allowHostile', '允许争夺其他联盟货轮', 'switch', { help: '默认关闭，只参与无人占领或本联盟货轮。开启后可能与其他联盟交战，跟随名单也受此开关约束。' }),
    configField('treasure.minDurabilityPercent', '最低舰队耐久', 'number', { unit: '%', help: '低于此比例时先维修；关闭自动维修则跳过。0 不设比例阈值，但零耐久仍需维修。未知耐久上限不会自动维修或出征。' }),
    configField('treasure.autoRepair', '耐久不足自动维修', 'switch', { help: '有符合条件的货轮时，按服务器报价普通维修至满耐久，完成后重新检查目标再派。不会使用钻石或加速维修。' }),
    configField('treasure.maxRepairCost', '单次维修汽油上限', 'number', { when: d => d.treasure.autoRepair, unit: '汽油', help: '0表示不限单次费用；非零上限超过时跳过，不分段修理。' }),
    configField('treasure.dailyRepairPetrolLimit', '每日维修汽油上限', 'number', { when: d => d.treasure.autoRepair, unit: '汽油', help: '0表示不限制每日维修费用；只计算巨轮普通维修，出征仍受每日出征上限和汽油保留量限制。未知维修结果继续占用预算。' }),
    configField('treasure.petrolReserve', '出征后保留汽油', 'number', { unit: '汽油', help: '每支舰队的出征费用读取游戏配置。结果未确认的派遣仍保留汽油预算。' }),
    configField('treasure.maxProgress', '巨轮整体进度阈值', 'number', { unit: '%', help: '货轮达到此占领进度后不再派遣，减少临近结束时白跑。' }),
    configField('treasure.personalProgressLimit', '个人进度上限', 'number', { unit: '%', help: '本人在单艘货轮的实际占领进度达到上限后，不再新派遣或为该货轮备战维修，反复攻占也不例外。0表示禁止新派遣。只读取实际个人进度，查询失败先等待核对；已出发、排队或驻守的舰队不会被强制召回。' }),
    configField('treasure.dailyDispatchLimit', '每日舰队出征上限', 'number', { unit: '次', help: '每次派遣一支舰队计 1 次，重复参与也计数；0 表示不限制工具次数，仍遵守参与模式。北京时间零点换日。' }),
    configField('treasure.checkEverySeconds', '检查间隔', 'number', { unit: '秒', help: '挂机运行时每 5–300 秒检查一次。保存配置不会开始挂机。' }),
  ] },
  { id:'radar',title:'联盟情报',category:'world',fields:[
    configField('schedule.radarAuto', '沿用原规则领奖与派遣', 'switch', { help: '保留原挂机设置，按战力余量20%与一万汽油保留量执行。开启联盟情报总开关后，改用本组舰队、类型与预算。' }),
    configField('schedule.radarRepair', '沿用原规则维修空闲舰队', 'switch', { help: '仅普通维修耐久低于80%的空闲舰队，并保留一万汽油。' }),
    configField('radar.enabled','联盟情报总开关'),
    configField('radar.fleetIds','情报参与舰队','multi',{catalog:'expeditionFleets',empty:'未选择，仅领取完成奖励',help:'使用空闲且已编队舰队；可与巨轮、城战、首杀共用舰队，只使用实际空闲且无待确认任务的舰队。'}),
    configField('radar.types','情报类型','multi',{catalog:'radarTypes',empty:'未选择，暂停新派遣'}),
    configField('radar.allowMaterials','允许交付难民情报材料','switch',{help:'仅使用现有足量材料，不购买，不交付钻石。'}),
    configField('radar.minDurabilityPercent','最低舰队耐久','number',{unit:'%'}),
    configField('radar.petrolReserve','出征后保留汽油','number',{unit:'汽油'}),
    configField('radar.dailyPetrolLimit','每日情报汽油预算','number',{unit:'汽油',help:'0表示不限制每日汽油用量；仍须满足实际库存和保留量，已完成奖励始终可领取。'}),
    configField('radar.checkEverySeconds','情报检查间隔','number',{unit:'秒'}),
  ] },
  { id:'pirate-sweep',title:'海盗日常扫荡',category:'world',fields:[
    configField('schedule.pirate','海盗日常扫荡','switch',{help:'使用游戏每日免费扫荡次数，三种海盗共用。无需舰队，不消耗汽油、耐久或钻石；日常任务完成后仍按剩余扫荡次数执行。'}),
    configField('pirateSweep.type','扫荡海盗种类','choice',{options:[['1','海盗先锋'],['2','海盗精锐'],['3','海盗头目']],help:'默认海盗先锋。自动使用所选种类已首杀的最高等级；地图暂时没有该等级目标时等待，不自动改种类或降级。'}),
  ]},
  { id: 'pirate-hunt', title: '海盗首杀', category: 'world', fields: [
    configField('pirateHunt.fleetIds','首杀参与舰队','multi',{catalog:'expeditionFleets',empty:'请选择首杀舰队',help:'每次只派一支空闲舰队。可与巨轮、城战、情报共用舰队；实际占用或结果待确认时跳过，不抢占任务。'}),
    configField('pirateHunt.types','海盗类型','multi',{catalog:'pirateTypes',empty:'所有类型',help:'从各类型本人尚未首杀的下一等级开始，优先较低等级；空选表示所有类型。'}),
    configField('pirateHunt.maxLevel','推进等级上限','number',{unit:'级',help:'0表示推进到游戏当前允许的等级。每次必须确认本人首杀记录更新后才推进下一级。'}),
    configField('pirateHunt.minDurabilityPercent','最低舰队耐久','number',{unit:'%',help:'低于阈值停止，不自动修理；零耐久或无法确认上限也不派遣。'}),
    configField('pirateHunt.petrolReserve','出征后保留汽油','number',{unit:'汽油'}),
    configField('pirateHunt.fuelBudget','本次推进汽油预算','number',{unit:'汽油',help:'一次开启推进期间的出征预算。0表示不限额；未知请求仍保留汽油占用，实际库存及保留量仍检查。'}),
    configField('pirateHunt.checkEverySeconds','战果检查间隔','number',{unit:'秒',help:'战败、汽油/耐久不足、阶段未开放、无合格目标或结果不明时停止；已出征舰队不会强制召回。'}),
  ] },
  { id: 'cityWar', title: '联盟/城战', category: 'world', fields: [
    configField('schedule.guildWelfare', '领取联盟福利礼包'),
    configField('schedule.guildTitleReward', '联盟每日职级礼包', 'switch', { help:'默认开启。按服务器提供的可领取职级核对每日礼包，不以当前职位替代；确认奖励回执及当日领取时间后才记为成功。' }),
    configField('schedule.worldOnlineRewards', '领取城战在线奖励', 'switch', { help: '在服务器城战时段内，按实际计时逐档领取免费在线奖励。独立于下方城战接续开关；默认关闭，保存后随挂机检查，不自动启动挂机。请求结果未知时等待计数确认，不重复领取。' }),
    configField('cityWar.enabled', '城战接续总开关', 'switch', { help: '按下方原生委任次数决定何时接续正常出战。下方预览范围选择“城战接续”；不会宣战或改变集结目标。' }),
    configField('cityWar.fleetIds', '城战参与舰队', 'multi', { catalog: 'expeditionFleets', empty: '请选择参与接续的舰队' }),
    configField('cityWar.nativeCommissionLimit', '原生委任次数', 'number', { unit: '次', help: '-1 表示按服务器 VIP 规则等待额度用尽（旧行为）；0 表示关闭所选舰队的原生委任，由工具立即接续；N 表示先让原生委任使用 N 次（不超过 VIP 额度），再关闭开关并由工具接续。' }),
    configField('cityWar.targetMode', '城战目标来源', 'choice', { options: [['alliance', '跟随联盟已宣战目标'], ['selected', '只进攻指定城市']], help: '决定允许进攻哪些城市，具体顺序由“城战目标优先”决定；不会进攻未宣战或己方城市。' }),
    configField('cityWar.targetPriority', '城战目标优先', 'choice', { options: [['fewestAllied', '按队数与距离选择'], ['original', '沿用集结／指定城市顺序']], help: '在目标来源允许的已宣战城市中，按本盟现场排队、正在交战和已同步在途舰队总数选城：以队数最少的城为基准，相差 0–9 队时选较近目标，差 10 队及以上时优先人少的城；本轮已安排的舰队也计入。多联盟同攻或数量无法确认时跳过该点，不把未知当作0人。发送前重新核对，不改变游戏原生委任选点。' }),
    configField('cityWar.cityRefs', '指定目标城市', 'multi', { catalog: 'cityTargets', empty: '请选择当前场景城市', when: d => d.cityWar.targetMode === 'selected', help: '只在勾选的城市中选择。启用队数与距离优先时按上述规则排序，勾选顺序仅作同条件时的次序；场景不匹配或未被本联盟宣战时跳过。' }),
    configField('cityWar.autoRepair', '耐久不足时维修', 'switch', { help: '仅正常维修；按服务器返回的完整维修报价核对汽油预算，维修完成后再出战。' }),
    configField('cityWar.repairBelowPercent', '低于此耐久比例先维修', 'number', { unit: '%', help: '还必须满足一次攻城的实际耐久消耗；已在行军、战斗、维修、驻外或其他任务中的舰队不被抢占。' }),
    configField('cityWar.maxRepairCost', '单次维修汽油上限', 'number', { unit: '汽油', when: d => d.cityWar.autoRepair, help: '0表示不限单次费用；超过非零预算就跳过整次，不假设可指定部分维修量。' }),
    configField('cityWar.petrolReserve', '出战或维修后保留汽油', 'number', { unit: '汽油' }),
    configField('cityWar.dailyPetrolLimit', '每日城战汽油预算', 'number', { unit: '汽油', help: '接续出战与工具维修共用，0表示不限额；未知请求继续占用，库存与保留量仍检查。' }),
    configField('cityWar.dailyDispatchLimit', '每日工具接续出战上限', 'number', { unit: '次', help: '至少1次，不包含游戏原生委任次数。原生额度按账号真实 VIP 规则读取，不固定为4；上方原生委任次数设为 0 时，工具会先关闭所选舰队的原生委任。' }),
    configField('cityWar.reserveDuringWar', '城战期间为所选舰队保留任务', 'switch', { help: '存在有效宣战目标的城战时段，巨轮不再派遣这些舰队；已在执行巨轮或其他任务的舰队等待空闲，不主动召回。' }),
    configField('cityWar.checkEverySeconds', '城战检查间隔', 'number', { unit: '秒' }),
  ] },
  { id: 'guild-orders', title: '联盟订单', category: 'world', fields: [
    configField('schedule.guildOrders', '自动提交联盟订单', 'switch', { help: '每轮最多提交一单，仅使用现有材料并预留其他订单用料。默认关闭。' }),
  ] },
  { id: 'equipment-legacy', title: '装备制造原有规则', category: 'heroes', fields: [
    configField('schedule.equipmentCollect', '领取完工装备', 'switch', { help: '保留原挂机设置。开启装备自动锻造后，由锻造模块统一领取。' }),
    configField('schedule.equipmentCraft', '空闲装备厂续产', 'switch', { help: '每轮一件，保留一万金币。开启装备自动锻造后，改用所选工厂、配方与每日预算。' }),
  ] },
  { id: 'heroes', title: '英雄养成', category: 'heroes', fields: [
    configField('heroes.enabled', '养成总开关'), configField('loop.heroes', '加入自动挂机', 'switch', { help: '关闭时仍可在“英雄”页手动按本配置执行养成。' }),
    configField('heroes.level', '允许升级'), configField('heroes.star', '允许升星'), configField('heroes.skill', '允许提升技能'),
    configField('heroes.heroIds', '培养英雄', 'multi', { catalog: 'heroes', empty: '未选择，允许全部已拥有英雄' }),
    configField('heroes.universal', '允许使用万能碎片'),
    configField('heroes.keepExp', '保留英雄经验', 'number'), configField('heroes.targetLevel', '目标等级', 'number', { unit: '级', help: '0 表示采用游戏当前允许的上限。' }),
    configField('heroes.targetStar', '目标星级', 'number', { unit: '星', help: '0 表示采用游戏上限。' }),
  ] },
  { id: 'antique', title: '藏品养成', category: 'heroes', fields: [
    configField('antique.enabled', '藏品养成总开关', 'switch', { help: '只在已有碎片、经验或金币足够时操作，不购买、不消耗钻石。结果未知时保留记录，不重复发送。' }),
    configField('antique.activate', '自动激活藏品', 'switch', { when: d => d.antique.enabled, help: '使用对应藏品碎片激活，稀有/史诗/传说/超凡分别需要 10/10/10/50 个碎片。万能碎片不会自动兑换。' }),
    configField('antique.activateQualities', '激活品质', 'multi', { catalog: 'antiqueQualities', empty: '未选择，不激活', when: d => d.antique.enabled && d.antique.activate }),
    configField('antique.star', '自动升星', 'switch', { when: d => d.antique.enabled, help: '按当前星级消耗对应颜色碎片；已激活藏品按品质和顺序处理。' }),
    configField('antique.starQualities', '升星品质', 'multi', { catalog: 'antiqueQualities', empty: '未选择，不升星', when: d => d.antique.enabled && d.antique.star }),
    configField('antique.targetStar', '升星目标星级', 'number', { unit: '星', when: d => d.antique.enabled && d.antique.star, help: '0 表示升到当前配置最高星级。' }),
    configField('antique.universal', '允许万能碎片补足升星', 'switch', { when: d => d.antique.enabled && d.antique.star, help: '只在普通碎片不足时使用；不会用于激活。' }),
    configField('antique.master', '自动提升藏品大师等级', 'switch', { when: d => d.antique.enabled, help: '消耗藏品大师徽章，并满足下一等级要求的总星级。' }),
    configField('antique.targetMasterLevel', '大师目标等级', 'number', { unit: '级', when: d => d.antique.enabled && d.antique.master, help: '0 表示升到当前配置最高等级。' }),
    configField('antique.suit', '自动激活/升级套装', 'switch', { when: d => d.antique.enabled, help: '普通套装需集齐本套装藏品；红色套装至少激活 2 件。升级消耗金币和对应颜色藏品经验。' }),
    configField('antique.suitQualities', '套装品质', 'multi', { catalog: 'antiqueQualities', empty: '未选择，不升级套装', when: d => d.antique.enabled && d.antique.suit }),
    configField('antique.goldReserve', '套装升级后保留金币', 'number', { unit: '金币', when: d => d.antique.enabled && d.antique.suit }),
    configField('antique.dailyGoldLimit', '每日套装金币预算', 'number', { unit: '金币', when: d => d.antique.enabled && d.antique.suit, help: '0 表示不限额；跨日重置，未确认的消耗仍占预算。' }),
    configField('antique.maxActions', '每轮最多执行动作', 'number', { unit: '项', help: '包含激活、升星、大师和套装升级。' }),
    configField('antique.checkEverySeconds', '藏品检查间隔', 'number', { unit: '秒' }),
  ] },
  { id: 'rewards', title: '任务与奖励', category: 'daily', fields: [
    configField('tasks.main', '领取主线奖励'), configField('tasks.branch', '领取支线奖励'), configField('tasks.achievements', '领取成就奖励'),
    configField('dailies.enabled', '日常总开关', 'switch', { help: '控制本组每日任务与奖励。基地页的付费点金独立设置。' }), configField('dailies.claimTasks', '领取每日任务奖励'),
    configField('dailies.claimDailyChest', '领取每日活跃宝箱'), configField('dailies.claimWeeklyChest', '领取每周活跃宝箱'), configField('dailies.claimGift', '领取每日免费赠礼'),
  ] },
  { id:'worldBoss',title:'世界Boss',category:'world',fields:[
    configField('worldBoss.enabled','每日首战自动派遣'),
    configField('worldBoss.fleetIds','首战可用舰队','multi',{catalog:'expeditionFleets',empty:'未选择，使用任意符合条件的空闲舰队',help:'每次仅派遣一队，遵守统一任务顺序和在途保护。'}),
    configField('worldBoss.minDurabilityPercent','最低耐久','number',{unit:'%',help:'0表示不设百分比门槛，仍须有耐久。'}),
    configField('worldBoss.petrolReserve','汽油保留量','number',{unit:'汽油',help:'0表示不保留，仍核对实际库存和其他任务待确认费用。'}),
  ]},
  { id:'fleet-dispatch',title:'舰队调度',category:'world',fields:[configField('fleetDispatch.priority','任务优先顺序','dispatchOrder',{wide:true,help:'从上到下检查，已出征舰队不抢占。有效城战时段预留优先；已启动首杀对较低优先级任务预留舰队，无目标后释放。巨轮跟随独立排序；当天世界Boss首战完成后释放舰队。'})]},
  { id: 'runtime', title: '运行安排', category: 'runtime', fields: [
    configField('loop.rounds', '运行轮数', 'number', { unit: '轮', help: '0 表示持续运行。此值用于下次开始挂机。' }),
    configField('loop.everySeconds', '每轮间隔', 'number', { unit: '秒', help: '保存后下一轮使用新间隔。已有到期领奖与生产检查仍按游戏状态调度。' }),
    configField('loop.tasks', '领取主线、支线与成就'), configField('loop.dailies', '日常行动与钻石点金', 'switch', { help: '控制英雄免费/招募券招募、免费点金、竞技场、海盗日常、折扣店及钻石点金。开启本项不会单独触发消费：钻石点金还需开启基地中的付费点金及钻石总开关，并满足次数、余额和预算限制。' }), configField('loop.world', '基地生产与收取', 'switch', { help: '控制建筑、工厂、居民订单、农田、贸易港、漂浮物与采集船等基地动作，各分项开关仍有效。不是整个挂机的总开关；暂停全部托管请用页面的“暂停托管”。' }),
  ] },
];

function configGet(key) { return key.split('.').reduce((value, part) => value?.[part], configEditor.draft); }
function configSet(key, value) {
  const [group, field] = key.split('.');
  configEditor.draft[group][field] = value;configEditor.previewSummary=null;
  if (key === 'farm.autoPlant' && value) configEditor.draft.farm.customPlant = false;
  if (key === 'farm.customPlant' && value) configEditor.draft.farm.autoPlant = false;
  delete configEditor.errors[key];
  configEditor.widgets.get(key)?.clearError?.();configRenderUsage();
  if ($('config-preview-result').childNodes.length) clear($('config-preview-result')).append(el('p', 'config-help', '草稿已更改，请重新预览计划。'));
  if ($('config-message').dataset.kind === 'success') configMessage('');
  configUpdateVisibility();
  configUpdateState();
}
function configIsDirty() { return !!configEditor.draft && JSON.stringify(configEditor.draft) !== JSON.stringify(configEditor.baseline); }
function configVisible() { return !$('tab-settings').classList.contains('hidden'); }
function configMessage(text, kind = 'info') {
  const node = $('config-message'); node.textContent = text || ''; node.hidden = !text; node.dataset.kind = kind;
}
function configBusy(value) {
  configEditor.busy = value;
  for (const id of ['config-save', 'config-import', 'config-export', 'config-reload', 'config-preview']) $(id).disabled = value || configEditor.loading || !configEditor.draft;
  $('config-save').setAttribute('aria-busy', String(value));
}
function configUpdateState() {
  const dirty = configIsDirty();
  const node = $('config-state'); node.dataset.dirty = String(dirty);
  node.textContent = configEditor.loading ? '正在载入…' : configEditor.busy ? '正在处理…' : dirty ? '有未保存更改' : configEditor.data?.revision ? '配置已保存' : '尚未保存，当前沿用原有挂机开关';
  $('config-save').disabled = configEditor.busy || configEditor.loading || !configEditor.draft || (!dirty && !!configEditor.data?.revision);
  const at = configEditor.data?.savedAt;
  $('config-saved-time').textContent = at ? '上次保存：' + new Date(at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }) : '';
}
function configRevealTab(tab) {
  const bar = tab.parentElement, item = tab.getBoundingClientRect(), bounds = bar.getBoundingClientRect();
  if (!bounds.width || !item.width) return;
  if (item.left < bounds.left + 4) bar.scrollLeft -= bounds.left + 4 - item.left;
  else if (item.right > bounds.right - 4) bar.scrollLeft += item.right - bounds.right + 4;
}
function configActivate(category, focus = false, writeHash = true) {
  if (!Object.hasOwn(configCategories, category)) return;
  closeHelpTip(false);
  const changed = category !== configEditor.category;
  if (changed) clear($('config-preview-result'));
  configEditor.category = category;
  for (const node of document.querySelectorAll('[data-config-tab]')) {
    const selected = node.dataset.configTab === category;
    node.setAttribute('aria-selected', String(selected)); node.tabIndex = selected ? 0 : -1;
    if (selected) { if (focus) node.focus({ preventScroll: true }); configRevealTab(node); }
  }
  for (const node of document.querySelectorAll('[data-config-panel]')) node.hidden = node.dataset.configPanel !== category;
  const choices = [...configEditor.groups.values()].filter(group => group.category === category);
  const selected = choices.find(group => group.id === configEditor.selectedGroups[category]) || choices[0];
  if (selected) configActivateGroup(selected.id, false, writeHash, changed);
}
function configActivateGroup(id, focus = false, writeHash = true, forcePreview = false) {
  const group = configEditor.groups.get(id);
  if (!group || group.category !== configEditor.category) return;
  closeHelpTip(false);
  const changed = configEditor.selectedGroups[group.category] !== id;
  configEditor.selectedGroups[group.category] = id;
  const panel = $('config-panel-' + group.category);
  const family = baseFamilies.find(item => item.groups.includes(id));
  if (family) {
    familyGroups.set(family.id, id);
    $('config-base-sections').setAttribute('aria-labelledby', 'config-family-' + family.id);
    for (const tab of panel.querySelectorAll('[data-config-family]')) {
      const selected = tab.dataset.configFamily === family.id;
      tab.setAttribute('aria-selected', String(selected)); tab.tabIndex = selected ? 0 : -1;
    }
  }
  for (const tab of panel.querySelectorAll('[data-config-group]')) {
    tab.hidden = !!family && !family.groups.includes(tab.dataset.configGroup);
    const selected = tab.dataset.configGroup === id;
    tab.setAttribute('aria-selected', String(selected)); tab.tabIndex = selected ? 0 : -1;
    if (selected) { if (focus) tab.focus({ preventScroll: true }); configRevealTab(tab); }
  }
  for (const section of panel.querySelectorAll('.config-section')) section.hidden = section.id !== 'config-group-' + id;
  if (changed || forcePreview) {
    clear($('config-preview-result'));
    $('config-preview-scope').value = 'module:'+id;
  }
  configRenderUsage();
  if (writeHash && configVisible()) history.replaceState(history.state, '', '#config-group-' + id);
}
function configApplyHash() {
  let id;
  try { id = decodeURIComponent(location.hash.replace(/^#config-group-/, '')); } catch { return; }
  if(id==='runtime'){document.querySelector('#tabs [data-tab=idle]').click();return;}
  id = configLegacyGroups.get(id) || id;
  if (!location.hash.startsWith('#config-group-') || !configEditor.groups.has(id)) return;
  const group = configEditor.groups.get(id);
  configActivate(group.category, false, false); configActivateGroup(id, false, false);
}
function configUpdateVisibility() {
  if (!configEditor.draft) return;
  for (const [key, widget] of configEditor.widgets) {
    widget.row.hidden = !!widget.spec.when && !widget.spec.when(configEditor.draft) && !configEditor.errors[key];
    if (widget.spec.kind === 'switch') configPaintSwitch(widget.control, !!configGet(key));
  }
}
function configPaintSwitch(button, checked) {
  button.setAttribute('aria-checked', String(checked)); button.dataset.state = checked ? 'checked' : 'unchecked';
  for (const thumb of button.querySelectorAll('[data-state]')) thumb.dataset.state = button.dataset.state;
}
function configButton(text, onClick, extra = '') {
  const button = el('button', 'config-small-button ' + extra, text); button.type = 'button'; button.onclick = onClick; return button;
}

function configRender() {
  closeHelpTip(false);
  clear($('config-preview-result'));
  configEditor.fields.clear(); configEditor.widgets.clear(); configEditor.groups.clear(); configEditor.playerWidgets = [];
  const root = clear($('config-fields'));
  const groups = configGroups.map(group => ({ ...group, fields: [...group.fields] }));
  const mapped = new Set(configEditor.data.rules?.mappedTasks ?? []);
  const staticFields=new Set(groups.flatMap(g=>g.fields.map(f=>f.key)));
  const tasks = (configEditor.data.tasks ?? []).filter(task => !mapped.has(task.key)&&!staticFields.has('schedule.'+task.key)).map(task => ['freeRecruit', 'ticketRecruit'].includes(task.key) ? { ...task, group: '招募' } : task);
  const destinations = { '联盟': ['cityWar', '联盟/城战'], '海面': ['building', '建筑'], '领奖': ['rewards', '任务与领奖'],
    '周期活动': ['daily-weekly', '周期活动'], '限时活动': ['daily-events', '限时活动'], '藏品': ['daily-collections', '日常招募'],
    '招募': ['daily-collections', '日常招募'], '日常': ['daily-actions', '日常行动'], '挑战': ['daily-challenges', '挑战与扫荡'] };
  configLegacyGroups.clear();
  [...new Set(tasks.map(task => task.group))].forEach((name, index) => {
    const [id, title] = destinations[name] || ['daily-other', '其他项目'];
    configLegacyGroups.set('schedule-' + (configGroups.length + index), id);
    let group = groups.find(item => item.id === id);
    if (!group) { group = { id, title, category: 'daily', fields: [] }; groups.push(group); }
    for (const task of tasks.filter(task => task.group === name)) if (!group.fields.some(field => field.key === 'schedule.' + task.key)) group.fields.push(configField('schedule.' + task.key, task.label, 'switch', task.key === 'heroRecruitRewards' ? { help: '只领取本赛季已达标的英雄累计招募奖励，不消耗招募券或钻石。与藏品领奖分别控制，不受日常行动开关控制，暂停托管时停止。' } : {}));
  });
  groups.find(g => g.id === 'rewards').title = '任务与领奖';
  const trialGroup = groups.find(g => g.id === 'daily-challenges');
  if (trialGroup) trialGroup.fields.push(
    configField('trials.ads', '试炼免广告扫荡', 'switch', { help:'渠道开放且该副本广告次数有剩余时执行，账号需有免广告权益或已在“广告奖励”中开启无权益领取。当前配置每副本每天1次，不花钻石。先完成普通首轮免费扫荡。' }),
    configField('trials.paid', '试炼钻石扫荡', 'switch', { help:'普通首轮免费之后才执行付费扫荡；还需开启“基础→加速与钻石”中的钻石总开关，并遵守保留量与全局每日预算。新开关默认关闭。' }),
    configField('trials.raidIds', '自动额外扫荡副本', 'multi', { catalog:'trialRaids', empty:'未选择，不安排自动额外扫荡', help:'选择自动免广告与钻石扫荡的副本。原有首轮免费扫荡和挑战页的单次扫荡入口保持独立；单次操作仍遵守各项费用与预算限制。' }),
    configField('trials.paidPerRaidLimit', '每副本每日钻石扫荡上限', 'number', { unit:'次', help:'仅统计本工具的付费扫荡；同时遵守游戏基础、VIP和有效月卡次数限制。0禁止钻石扫荡。' }),
    configField('trials.maxSingleCost', '单次钻石费用上限', 'number', { unit:'钻石', help:'当前普通付费档为50钻，实际费用以游戏最新配置为准，超过此值不执行。' }),
    configField('trials.dailyDiamondBudget', '试炼每日钻石预算', 'number', { unit:'钻石', help:'三个副本共用，也计入全局每日钻石用量。结果未知仍保留额度，跨日未知请求先核对，不重复发送。' }),
  );
  const movedFields = new Set(configEditor.data.rules?.controlFields ?? []);
  movedFields.add('loop.rounds'); movedFields.add('loop.everySeconds');
  for (const group of groups) {
    group.controlGroup = group.id==='pirate-hunt'?'世界':configEditor.data.rules?.controlGroups?.[group.fields.find(field=>movedFields.has(field.key))?.key] ?? '总控制';
    group.controlKeys=group.fields.map(field=>field.key);
    group.movedCount = group.fields.filter(field=>movedFields.has(field.key)).length;
    group.movedHelp = group.fields.filter(field=>movedFields.has(field.key) && field.help).map(field=>field.label + '：' + field.help);
    group.fields = group.fields.filter(field=>!movedFields.has(field.key));
    configEditor.groups.set(group.id, group);
  }
  const scopeSelect=$('config-preview-scope');
  for(const opt of [...scopeSelect.options])if(!['base','daily','activity'].includes(opt.value))opt.remove();
  for(const group of groups)scopeSelect.add(new Option(group.title,'module:'+group.id));
  for (const [category, label] of Object.entries(configCategories)) {
    const panel = el('div'); panel.id = 'config-panel-' + category; panel.dataset.configPanel = category; panel.setAttribute('role', 'tabpanel'); panel.setAttribute('aria-labelledby', 'config-tab-' + category);
    const selected = groups.filter(group => group.category === category);
    let groupHost = panel;
    if (category === 'base') {
      const families = el('div', 'config-families'); families.setAttribute('role', 'tablist'); families.setAttribute('aria-label', '基地分类');
      baseFamilies.forEach((family, index) => {
        const tab = el('button', '', family.title); tab.type = 'button'; tab.id = 'config-family-' + family.id; tab.dataset.configFamily = family.id; tab.setAttribute('role', 'tab'); tab.setAttribute('aria-selected', 'false'); tab.setAttribute('aria-controls', 'config-base-sections');
        const activate = () => configActivateGroup(familyGroups.get(family.id) || family.groups[0]); tab.onclick = activate;
        tab.onkeydown = event => { const i = event.key === 'ArrowRight' ? (index + 1) % 4 : event.key === 'ArrowLeft' ? (index + 3) % 4 : event.key === 'Home' ? 0 : event.key === 'End' ? 3 : null;
          if (i != null) { event.preventDefault(); const next = baseFamilies[i]; configActivateGroup(familyGroups.get(next.id) || next.groups[0]); families.children[i].focus(); } };
        families.append(tab);
      }); panel.append(families); groupHost = el('div'); groupHost.id = 'config-base-sections'; groupHost.setAttribute('role', 'tabpanel'); panel.append(groupHost);
    }
    const tabs = el('div', 'config-subtabs'); tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', label + '分组');
    for (const group of selected) {
      const tab = el('button', '', group.title); tab.type = 'button'; tab.id = 'config-subtab-' + group.id; tab.dataset.configGroup = group.id;
      tab.setAttribute('role', 'tab'); tab.setAttribute('aria-controls', 'config-group-' + group.id); tab.setAttribute('aria-selected', 'false'); tab.tabIndex = -1;
      tab.onclick = () => configActivateGroup(group.id);
      tab.onkeydown = event => {
        if (event.altKey || event.ctrlKey || event.metaKey) return;
        const family = baseFamilies.find(item => item.groups.includes(configEditor.selectedGroups[category]));
        const choices = category === 'base' && family ? selected.filter(item => family.groups.includes(item.id)) : selected;
        const at = choices.findIndex(item => item.id === configEditor.selectedGroups[category]);
        const next = event.key === 'ArrowRight' ? (at + 1) % choices.length : event.key === 'ArrowLeft' ? (at + choices.length - 1) % choices.length : event.key === 'Home' ? 0 : event.key === 'End' ? choices.length - 1 : null;
        if (next !== null) { event.preventDefault(); event.stopPropagation(); configActivateGroup(choices[next].id, true); }
      };
      tabs.append(tab);
    }
    groupHost.append(tabs);
    for (const group of selected) {
      const section = el('section', 'config-section'); section.id = 'config-group-' + group.id; section.setAttribute('role', 'tabpanel'); section.setAttribute('aria-labelledby', 'config-subtab-' + group.id);
      const heading = el('div', 'config-group-heading title-with-help'); const title = el('h3', '', group.title); title.id = section.id + '-title'; heading.append(title);

      section.append(heading);
      if (group.movedHelp.length) section.append(el('p', 'config-help', group.movedHelp.join(' ')));
      if (group.movedCount || group.id === 'pirate-hunt') {
        const jump=el('button','config-small-button','前往挂机设置');jump.type='button';
        jump.onclick=()=>{document.querySelector('#tabs [data-tab="idle"]').click();const tab=[...document.querySelectorAll('[data-idle-group]')].find(x=>x.textContent===group.controlGroup);tab?.click();if(group.controlGroup==='总控制'){document.querySelector('[aria-label="挂机设置分组"]').scrollIntoView({block:'center'});}};
        const note=el('div','config-help','模块总开关在挂机页，细项在本组设置。');note.append(jump);section.append(note);
      }
      for (const spec of group.fields) { const field = { ...spec, category, groupId: group.id }; configEditor.fields.set(spec.key, field); section.append(configRenderField(field)); }
      groupHost.append(section);
    }
    root.append(panel);
  }
  configActivate(configEditor.category, false, false);
  scopeSelect.value='module:'+configEditor.selectedGroups[configEditor.category];
  configApplyHash(); configUpdateVisibility(); configUpdateState(); configRenderUsage();
  if (!configEditor.playerData && configGet('treasure.followPlayerIds').length) void configRefreshPlayers();
}

function configRenderField(spec) {
  if(spec.kind==='number'){
    const rule=configEditor.data.rules?.numbers?.[spec.key];
    const meaning=rule?.min>0?'0不可用，最小值为'+rule.min+'。':configZeroHints[spec.key];
    if(meaning&&!/0\s*(?:表示|禁止|时|关闭|不设)/.test(spec.help??''))spec={...spec,help:[spec.help,meaning].filter(Boolean).join(' ')};
  }

  const row = el('div', 'config-row' + (spec.wide ? ' is-wide' : '')); row.dataset.kind = spec.kind;
  const id = 'config-field-' + spec.key.replaceAll('.', '-');
  const name = el('div', 'config-label-line'); const label = el('label', 'config-label', spec.label); label.htmlFor = id; name.append(label);
  if (spec.help) { const help = el('span', '', spec.help); help.id = id + '-help'; help.hidden = true; name.append(makeHelpTip(spec.label, spec.help), help); }
  const box = el('div', 'config-control'); const error = el('div', 'config-field-error'); error.id = id + '-error'; error.hidden = true;
  let control;
  if (spec.kind === 'switch') {
    control = $('config-switch-template').content.firstElementChild.cloneNode(true); control.id = id; control.type = 'button';
    control.setAttribute('aria-label', spec.label); configPaintSwitch(control, !!configGet(spec.key));
    control.onclick = () => { configSet(spec.key, !configGet(spec.key)); };
    box.append(control);
  } else if (spec.kind === 'number') {
    const line = el('div', 'config-number'); control = el('input'); control.type = 'number'; control.required = true; control.step = '1';
    const rule = configEditor.data.rules?.numbers?.[spec.key] ?? { min: 0, max: 1000000000 };
    control.min = String(rule.min); control.max = String(rule.max); control.id = id; control.value = String(configGet(spec.key)); control.dataset.configNumber = spec.key;
    control.oninput = () => { configSet(spec.key, control.value === '' ? null : Number(control.value)); };
    line.append(control); if (spec.unit) line.append(el('span', '', spec.unit)); box.append(line);

  } else if (spec.kind === 'names') {
    control = el('textarea', 'config-input'); control.id = id; control.rows = 2; control.maxLength = 3600;
    control.placeholder = spec.placeholder || '每行一项'; control.value = configGet(spec.key).join('\n'); control.spellcheck = false;
    control.oninput = () => configSet(spec.key, control.value.split(/\r?\n/).map(value => value.trim()).filter(Boolean)); box.append(control);
  } else if (spec.kind === 'choice') {
    control = el('select', 'config-select'); control.id = id;
    for (const [value, text] of spec.options) { const option = el('option', '', text); option.value = value; control.append(option); }
    control.value = configGet(spec.key); control.onchange = () => configSet(spec.key, spec.numeric ? Number(control.value) : control.value); box.append(control);
  } else if (spec.kind === 'radio') {
    control = el('div', 'config-radio'); control.id = id; control.setAttribute('role', 'radiogroup'); control.setAttribute('aria-label', spec.label); control.tabIndex = -1;
    for (const [value, text] of spec.options) {
      const option = el('label', 'config-option'); const input = el('input'); input.type = 'radio'; input.name = id; input.value = value; input.checked = configGet(spec.key) === value;
      input.onchange = () => { if (input.checked) configSet(spec.key, value); }; option.append(input, el('span', '', text)); control.append(option);
    }
    box.append(control);
  } else if (spec.kind === 'players') {
    control = configPlayerPicker(spec, id); box.append(control);
  } else if (spec.kind === 'multi') {
    control = configMultiselect(spec, id); box.append(control);
  } else if (spec.kind === 'dispatchOrder') {
    control = el('div'); control.id=id;
    const paint=()=>{clear(control);const values=configGet(spec.key);values.forEach((value,index)=>{
      const line=el('div','config-dispatch-row');const label=({cityWar:'城战接续',pirateHunt:'单独启动的首杀',treasure:'巨轮普通参战',follow:'巨轮跟随',worldBoss:'世界Boss首战',radar:'联盟情报'})[value];line.append(el('span','config-order-num',String(index+1)),el('span','config-order-name',label));const actions=el('div','config-order-tools');
      for(const [offset,text] of [[-1,'上移'],[1,'下移']]){const button=configButton(text,()=>{const next=[...values];[next[index],next[index+offset]]=[next[index+offset],next[index]];configSet(spec.key,next);paint();});button.disabled=index+offset<0||index+offset>=values.length;button.setAttribute('aria-label',label+text);actions.append(button);}line.append(actions);control.append(line);
    });};paint();box.append(control);
  } else if (spec.kind === 'priority') {
    control = configPriorityEditor(spec, id); box.append(control);
  } else if (spec.kind === 'crops') {
    control = configCropEditor(spec, id); box.append(control);
  }
  if (control) {
    control.dataset.configKey = spec.key;
    control.setAttribute('aria-describedby', (spec.help ? id + '-help ' : '') + id + '-error');
  }
  box.append(error); row.append(name, box);
  const widget = { row, control, error, spec, clearError() { error.hidden = true; error.textContent = ''; control?.removeAttribute('aria-invalid'); } };
  configEditor.widgets.set(spec.key, widget);
  return row;
}

function configRenderUsage() {
  const group=configEditor.groups.get(configEditor.selectedGroups[configEditor.category]),preview=configEditor.previewSummary;
  const relevant=(configEditor.runtime?.controls??[]).filter(c=>group?.controlKeys?.includes(c.key));
  const active=relevant.filter(c=>c.enabled&&!/^(控制项|分组控制)/.test(c.observation?.text??''));
  const success=active.filter(c=>c.observation?.state==='ok').length,waiting=active.filter(c=>c.observation?.state==='waiting').length,pending=active.filter(c=>['pending','error'].includes(c.observation?.state)).length;
  const usePreview=preview?.group===group?.id&&preview?.scope===$('config-preview-scope').value;
  const type=usePreview?preview.scopeLabel:group?.title||'当前模块';
  const unseen=active.filter(c=>!c.observation?.checkedAt).length;
  let progress=active.length?(unseen===active.length?'尚无执行检查记录':'最近结果：成功 '+success+' 项 · 等待 '+waiting+' 项 · 未确认/失败 '+pending+' 项'+(unseen?' · 未检查 '+unseen+' 项':'')):relevant.length?'当前未开启具体执行项目':'尚无执行记录';
  const actualProgress=usePreview?(preview.notes??[]).find(text=>/今日已用|已领至|已领取至|今日.*已完成|当前进度/.test(text)):null;
  if(actualProgress)progress=actualProgress;else if(active.length===1&&active[0].observation?.checkedAt)progress=active[0].observation.text;
  const notes=usePreview?[...(preview.notes??[]),...(preview.dispatch?.fleets??[]).map(f=>f.reason).filter(Boolean)]:relevant.flatMap(c=>[...(c.blockedBy?.map(name=>'需开启'+name)??[]),...(['waiting','error','pending'].includes(c.observation?.state)?[c.observation.text]:[])]);
  const reasons=[...new Set(notes.filter(n=>/不足|已达|已用完|未开启|未开放|未同步|待确认|不能|不允许|不在|尚未|禁用|禁止|关闭|缺少|缺料|等待|失败|受限/.test(n)))];
  const root=clear($('config-usage'));
  root.append(el('div','','任务类型：'+type),el('div','','进度：'+progress+(usePreview?'；本次'+(preview.viewOnly?'只读查看':preview.actions.length+'项待执行（仅预览）'):'')),el('div','','受限：'+(reasons.length?reasons.slice(0,3).join('；')+(reasons.length>3?'；其余见下方条件':''):usePreview?'无已报限制':'预览后核对')));
}

async function configLoad(force = false) {
  if (configEditor.busy || configEditor.loading) return;
  if (!current) { configMessage('请先添加或选择账号。'); return; }
  if (!force && configEditor.owner === current && configIsDirty()) return;
  const account = current, version = ++configEditor.serial;
  configEditor.loading = true; configBusy(true); configMessage(''); configUpdateState();
  try {
    const [data,runtime]=await Promise.all([call('/api/settings'),call('/api/loop').catch(()=>null)]);
    if (account !== current || version !== configEditor.serial) return;
    if(!force&&configEditor.owner===account&&configEditor.draft&&
      (configIsDirty() || (data.revision===configEditor.data?.revision && data.baseRevision===configEditor.data?.baseRevision && JSON.stringify(data.settings)===JSON.stringify(configEditor.baseline) && JSON.stringify(data.catalog)===JSON.stringify(configEditor.data.catalog)))){
      configEditor.runtime=runtime;configEditor.data.usage=data.usage;configEditor.data.pendingUsage=data.pendingUsage;
      configRenderUsage();return;
    }
    configEditor.runtime=runtime;configEditor.previewSummary=null;
    configEditor.owner = account; configEditor.data = data; configEditor.draft = structuredClone(data.settings); configEditor.baseline = structuredClone(data.settings); configEditor.errors = {};
    configEditor.playerData = null; configEditor.playerRequest = null; configEditor.playerError = '';
    $('config-account-name').textContent = (accounts.find(row => row.id === account)?.title || '当前账号') + '的游戏配置';
    configRender();
  } catch (error) { if (account === current && version === configEditor.serial) configMessage(error.message, 'error'); }
  finally {
    if (version === configEditor.serial) { configEditor.loading = false; configBusy(false); configUpdateState(); }
  }
}

function configMayChangeAccount(next) {
  if (next === current) return true;
  if (configEditor.busy) { configMessage('当前配置正在处理，请完成后再切换账号。'); return false; }
  return !configIsDirty() || window.confirm('当前账号有未保存的配置。切换账号会丢弃这份草稿，是否继续？');
}
function configAccountChanged() {
  resetWorldMap();resetActivityRanks();
  if (configEditor.owner === current) return;
  configEditor.serial++; configEditor.owner = null; configEditor.data = null; configEditor.draft = null; configEditor.baseline = null; configEditor.loading = false; configEditor.errors = {};
  configEditor.runtime=null;configEditor.previewSummary=null;
  configEditor.playerData = null; configEditor.playerRequest = null; configEditor.playerError = ''; configEditor.playerWidgets = [];
  clear($('config-fields')).append(el('p', 'config-empty', '正在切换账号配置…')); clear($('config-preview-result')); clear($('config-usage')); configBusy(false); configUpdateState();
  if (configVisible()) void configLoad(true);
}

function configErrors(error) {
  configEditor.errors = error.fields ?? {};
  configMessage(error.message, 'error');
  let first;
  for (const [key, text] of Object.entries(configEditor.errors)) {
    const lookup = key === 'factory.speedUpSources' ? 'factory.demandPriority' : key;
    const widget = configEditor.widgets.get(lookup);
    if (!widget) continue;
    widget.row.hidden = false; widget.error.textContent = text; widget.error.hidden = false; widget.control?.setAttribute('aria-invalid', 'true'); first ??= widget;
  }
  if (first) { configActivate(first.spec.category); configActivateGroup(first.spec.groupId); first.control?.focus?.(); first.row.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
  else $('config-message').scrollIntoView({ block: 'nearest' });
}

function configCheckForm() {
  for (const [key, widget] of configEditor.widgets) {
    for (const input of widget.row.querySelectorAll('input[type=number]')) {
      if (!input.checkValidity()) {
        configEditor.errors[key] = '请填写有效整数，并遵守输入范围。'; widget.row.hidden = false;
        configActivate(widget.spec.category); configActivateGroup(widget.spec.groupId); widget.control?.setAttribute('aria-invalid', 'true'); widget.error.textContent = configEditor.errors[key]; widget.error.hidden = false;
        input.focus(); input.reportValidity(); return false;
      }
    }
  }
  return true;
}

async function configRefreshPlayers() {
  const account = configEditor.owner, serial = configEditor.serial;
  if (!account || !configEditor.draft) return;
  if (configEditor.playerRequest?.account === account && configEditor.playerRequest.serial === serial) return configEditor.playerRequest.promise;
  const job = { account, serial, promise: null };
  configEditor.playerRequest = job; configEditor.playerError = '';
  for (const paint of configEditor.playerWidgets) paint();
  job.promise = (async () => {
    try {
      const data = await call('/api/settings/players');
      if (account !== current || account !== configEditor.owner || serial !== configEditor.serial) return;
      configEditor.playerData = data;
    } catch (error) {
      if (account === current && serial === configEditor.serial) configEditor.playerError = error.message;
    } finally {
      if (configEditor.playerRequest === job) { configEditor.playerRequest = null; for (const paint of configEditor.playerWidgets) paint(); }
    }
  })();
  return job.promise;
}

function configPlayerPicker(spec, id) {
  const root = el('div', 'config-player-picker'); root.id = id; root.tabIndex = -1; root.setAttribute('role', 'group'); root.setAttribute('aria-label', spec.label);
  const selected = el('div', 'config-player-tags');
  const details = el('details', 'config-multi'); const summary = el('summary', '', '选择盟友'); summary.setAttribute('aria-label', '选择' + spec.label); details.append(summary);
  const panel = el('div', 'config-multi-panel'); const search = el('input', 'config-input'); search.type = 'search'; search.placeholder = '搜索昵称或角色 ID'; search.setAttribute('aria-label', '搜索' + spec.label);
  const status = el('p', 'config-help'); status.setAttribute('role', 'status');
  const list = el('div', 'config-option-list');
  const refresh = configButton('刷新盟友名单', () => { void configRefreshPlayers(); }); refresh.setAttribute('aria-label', '刷新' + spec.label + '盟友名单');
  const manual = el('div', 'config-add'); const input = el('input', 'config-input'); input.type = 'text'; input.inputMode = 'numeric'; input.maxLength = 19; input.placeholder = '补充完整角色 ID'; input.setAttribute('aria-label', '补充' + spec.label + '角色ID');
  const manualError = el('p', 'config-field-error'); manualError.hidden = true;
  const limit = spec.key === 'treasure.followPlayerIds' ? 30 : 100;
  function change(value, checked) {
    const values = configGet(spec.key);
    if (checked && !values.includes(value) && values.length >= limit) { manualError.textContent = '最多选择' + limit + '位玩家'; manualError.hidden = false; paint(); return; }
    configSet(spec.key, checked ? [...new Set([...values, value])] : values.filter(item => item !== value)); manualError.hidden = true; paint();
  }
  const add = configButton('添加 ID', () => {
    const value = input.value.trim();
    if (!/^[1-9]\d{0,18}$/.test(value) || BigInt(value) > (1n << 63n) - 1n) { manualError.textContent = '请输入完整的正整数角色 ID，不能使用科学计数法'; manualError.hidden = false; input.focus(); return; }
    change(value, true); if (configGet(spec.key).includes(value)) input.value = '';
  }); add.setAttribute('aria-label', '添加' + spec.label + '角色ID');
  manual.append(input, add);
  function paintList() {
    const focusId = list.contains(document.activeElement) ? document.activeElement.value : null;
    const scrollTop = list.scrollTop;
    clear(list);
    const query = search.value.trim().toLocaleLowerCase(), values = configGet(spec.key);
    const matches = (configEditor.playerData?.members ?? []).filter(member => (member.name + ' ' + member.id).toLocaleLowerCase().includes(query));
    for (const member of matches) {
      const option = el('label', 'config-option'); const check = el('input'); check.type = 'checkbox'; check.value = member.id; check.checked = values.includes(member.id); check.onchange = () => change(member.id, check.checked);
      const label = el('span'); label.append(el('span', 'config-player-name', member.name), el('small', 'config-help', 'ID ' + member.id + (member.online ? ' · 在线' : '')));
      option.append(check, label); list.append(option);
      if (member.id === focusId) check.focus({ preventScroll: true });
    }
    if (configEditor.playerData && !matches.length) list.append(el('p', 'config-help', query ? '没有匹配的盟友，可改用完整角色 ID 或补充昵称。' : '当前没有可选择的盟友，已排除自己及联盟黑名单。'));
    list.scrollTop = scrollTop;
  }
  function paint() {
    const values = configGet(spec.key), members = configEditor.playerData?.members ?? [];
    if (!values) return;
    clear(selected);
    for (const value of values) {
      const member = members.find(row => row.id === value);
      const duplicateName = member && members.filter(row => row.name === member.name).length > 1;
      const name = member ? member.name + (duplicateName ? '（' + value + '）' : '') : '角色 ' + value;
      const tag = el('span', 'config-player-tag'); const text = el('span', '', name); text.title = '角色 ID：' + value;
      const remove = configButton('移除', () => { change(value, false); summary.focus(); }, 'remove'); remove.setAttribute('aria-label', '从' + spec.label + '移除' + name);
      tag.append(text, remove); selected.append(tag);
    }
    selected.hidden = !values.length;
    summary.textContent = values.length ? '选择盟友 · 已选 ' + values.length + ' 位' : '选择盟友';
    refresh.disabled = !!configEditor.playerRequest; refresh.textContent = configEditor.playerRequest ? '正在读取…' : '刷新盟友名单';
    const data = configEditor.playerData;
    status.textContent = configEditor.playerError || (configEditor.playerRequest ? '正在读取盟友…' : data?.reason || (data ? (data.guildName || '当前联盟') + ' · 可选 ' + members.length + ' 位盟友' : '尚未读取盟友名单'));
    if (details.open) paintList();
  }
  search.oninput = paintList;
  details.ontoggle = () => { if (details.open) { paintList(); if (!configEditor.playerData) void configRefreshPlayers(); search.focus(); } };
  details.onkeydown = event => { if (event.key === 'Escape') { details.open = false; summary.focus(); event.stopPropagation(); } };
  panel.append(search, status, list, refresh, manual, manualError); details.append(panel); root.append(selected, details);
  configEditor.playerWidgets.push(paint); paint(); return root;
}

function configMultiselect(spec, id) {
  const root = el('details', 'config-multi'); root.id = id; root.setAttribute('aria-label', spec.label); root.tabIndex = -1;
  const summary = el('summary'); summary.setAttribute('aria-label', spec.label); root.append(summary);
  const panel = el('div', 'config-multi-panel');
  const search = el('input', 'config-input'); search.type = 'search'; search.placeholder = '搜索' + spec.label; search.setAttribute('aria-label', '搜索' + spec.label);
  const list = el('div', 'config-option-list'); const foot = el('div', 'config-select-foot');
  const count = el('span'); let limit = 120;
  const more = configButton('显示更多选项', () => { limit += 120; paintList(); });
  const all = () => {
    const options = [...(configEditor.data.catalog[spec.catalog] ?? [])];
    for (const value of configGet(spec.key)) if (!options.some(item => item.value === value)) options.unshift({ value, label: value + '（当前配置中未找到）' });
    return options;
  };
  function paintSummary() {
    const values = configGet(spec.key), options = all();
    const names = values.map(value => options.find(item => item.value === value)?.label || value);
    summary.textContent = names.length ? names.slice(0, 2).join('、') + (names.length > 2 ? ' 等 ' + names.length + ' 项' : '') : spec.empty || '请选择';
  }
  function paintList() {
    const oldScroll = list.scrollTop; clear(list);
    const query = search.value.trim().toLocaleLowerCase();
    const matches = all().filter(item => (item.label + ' ' + item.value).toLocaleLowerCase().includes(query));
    const selected = new Set(configGet(spec.key));
    for (const item of matches.slice(0, limit)) {
      const label = el('label', 'config-option'); const input = el('input'); input.type = 'checkbox'; input.checked = selected.has(item.value);
      input.onchange = () => {
        const values = configGet(spec.key);
        configSet(spec.key, input.checked ? [...values, item.value] : values.filter(value => value !== item.value));
        paintSummary(); count.textContent = '已选 ' + configGet(spec.key).length + ' 项 · 匹配 ' + matches.length + ' 项';
      };
      label.append(input, el('span', '', item.label)); list.append(label);
    }
    if (!matches.length) list.append(el('p', 'config-help', '没有匹配项，试试其他名称。'));
    count.textContent = '已选 ' + selected.size + ' 项 · 匹配 ' + matches.length + ' 项';
    more.hidden = matches.length <= limit; list.scrollTop = oldScroll;
  }
  search.oninput = () => { limit = 120; paintList(); };
  root.ontoggle = () => { if (root.open) { paintList(); search.focus(); } };
  root.onkeydown = event => { if (event.key === 'Escape') { root.open = false; summary.focus(); event.stopPropagation(); } };
  foot.append(count, configButton('清空选择', () => { configSet(spec.key, []); paintSummary(); paintList(); }));
  panel.append(search, list, more, foot); root.append(panel); paintSummary(); return root;
}

function configPriorityEditor(spec, id) {
  const root = el('div'); root.id = id; root.tabIndex = -1; root.setAttribute('role', 'group'); root.setAttribute('aria-label', spec.label);
  const options = configEditor.data.catalog.demandSources ?? [];
  function paint(focusKey, direction) {
    clear(root); const values = configGet(spec.key); const list = el('ol', 'config-order-list'); let focus;
    values.forEach((value, index) => {
      const label = options.find(item => item.value === value)?.label || value;
      const row = el('li', 'config-order-row'); row.append(el('span', 'config-order-num', String(index + 1)), el('span', 'config-order-name', label));
      const tools = el('div', 'config-order-tools');
      const speed = el('label', 'config-option'); const check = el('input'); check.type = 'checkbox'; check.checked = configGet('factory.speedUpSources').includes(value); check.setAttribute('aria-label', label + '工厂加速');
      check.onchange = () => { const current = configGet('factory.speedUpSources'); configSet('factory.speedUpSources', check.checked ? [...current, value] : current.filter(item => item !== value)); };
      speed.append(check, el('span', '', '工厂加速'));
      const move = offset => { const next = [...values]; [next[index], next[index + offset]] = [next[index + offset], next[index]]; configSet(spec.key, next); paint(value, offset); };
      const up = configButton('上移', () => move(-1)); up.disabled = index === 0; up.setAttribute('aria-label', label + '上移');
      const down = configButton('下移', () => move(1)); down.disabled = index === values.length - 1; down.setAttribute('aria-label', label + '下移');
      const remove = configButton('移除', () => { configSet(spec.key, values.filter(item => item !== value)); configSet('factory.speedUpSources', configGet('factory.speedUpSources').filter(item => item !== value)); paint(); }, 'remove'); remove.setAttribute('aria-label', '移除' + label);
      tools.append(speed, up, down, remove); row.append(tools); list.append(row);
      if (value === focusKey) focus = direction === -1 ? up : down;
    });
    if (!values.length) list.append(el('li', 'config-empty', '尚未选择需求来源。当前只按备货水位生产。'));
    const add = el('div', 'config-add'); const select = el('select', 'config-select'); select.setAttribute('aria-label', '添加需求来源');
    const available = options.filter(item => !values.includes(item.value));
    const blank = el('option', '', available.length ? '选择要添加的需求来源' : '已添加全部来源'); blank.value = ''; select.append(blank);
    for (const item of available) { const option = el('option', '', item.label); option.value = item.value; select.append(option); }
    const button = configButton('添加', () => { if (select.value) { configSet(spec.key, [...values, select.value]); paint(); } }); button.setAttribute('aria-label', '添加所选需求来源'); button.disabled = true;
    select.disabled = !available.length; select.onchange = () => { button.disabled = !select.value; };
    add.append(select, button); root.append(list, add); if (focus && !focus.disabled) focus.focus();
  }
  paint(); return root;
}

function configCropEditor(spec, id) {
  const root = el('div'); root.id = id; root.tabIndex = -1; root.setAttribute('role', 'group'); root.setAttribute('aria-label', spec.label);
  const options = configEditor.data.catalog.crops ?? [];
  function paint() {
    clear(root); const values = configGet(spec.key); const list = el('ol', 'config-order-list');
    values.forEach((value, index) => {
      const name = options.find(item => item.value === value.id)?.label || value.id;
      const row = el('li', 'config-order-row'); row.append(el('span', 'config-order-num', String(index + 1)), el('span', 'config-order-name', name));
      const tools = el('div', 'config-order-tools'); const quantity = el('label', 'config-crop-quantity');
      const input = el('input'); input.type = 'number'; input.min = '0'; input.max = '100000'; input.step = '1'; input.required = true; input.value = value.target == null ? '' : String(value.target); input.setAttribute('aria-label', name + '备货数量');
      input.oninput = () => { const next = configGet(spec.key).map(item => ({ ...item })); next[index].target = input.value === '' ? null : Number(input.value); configSet(spec.key, next); };
      quantity.append(input, el('span', 'config-help', '件'));
      const move = delta => { const next = [...configGet(spec.key)]; [next[index], next[index + delta]] = [next[index + delta], next[index]]; configSet(spec.key, next); paint(); };
      const up = configButton('上移', () => move(-1)); up.disabled = index === 0; up.setAttribute('aria-label', name + '上移');
      const down = configButton('下移', () => move(1)); down.disabled = index === values.length - 1; down.setAttribute('aria-label', name + '下移');
      const remove = configButton('移除', () => { configSet(spec.key, configGet(spec.key).filter(item => item.id !== value.id)); paint(); }, 'remove'); remove.setAttribute('aria-label', '移除作物' + name);
      tools.append(quantity, up, down, remove); row.append(tools); list.append(row);
    });
    if (!values.length) list.append(el('li', 'config-empty', '添加作物，设置备货数量，再调整种植顺序。'));
    const add = el('div', 'config-add'); const select = el('select', 'config-select'); select.setAttribute('aria-label', '选择作物');
    const available = options.filter(item => !values.some(row => row.id === item.value));
    const blank = el('option', '', available.length ? '选择作物' : '已添加全部作物'); blank.value = ''; select.append(blank);
    for (const item of available) { const option = el('option', '', item.label); option.value = item.value; select.append(option); }
    const button = configButton('添加作物', () => { if (select.value) { configSet(spec.key, [...configGet(spec.key), { id: select.value, target: 0 }]); paint(); } }); button.disabled = true;
    select.disabled = !available.length; select.onchange = () => { button.disabled = !select.value; };
    add.append(select, button); root.append(list, add);
  }
  paint(); return root;
}

async function configSave(event) {
  event?.preventDefault();
  if (!configEditor.draft || configEditor.busy || configEditor.owner !== current || !configCheckForm()) return;
  const account = current, text = JSON.stringify(configEditor.draft);
  configBusy(true); configMessage(''); configUpdateState();
  try {
    const data = await call('/api/settings', { method: 'POST', body: JSON.stringify({ settings: JSON.parse(text), revision: configEditor.data.revision, baseRevision: configEditor.data.baseRevision }) });
    if (account !== current) return;
    const edited = JSON.stringify(configEditor.draft) !== text;
    configEditor.data = data; configEditor.baseline = structuredClone(data.settings);
    if (!edited) {
      const normalized=JSON.stringify(data.settings)!==text;
      configEditor.draft=structuredClone(data.settings);configEditor.errors={};
      if(normalized){
        const sent=JSON.parse(text);
        for(const [key,widget] of configEditor.widgets){
          const old=key.split('.').reduce((v,k)=>v?.[k],sent);
          if(JSON.stringify(old)!==JSON.stringify(configGet(key)))widget.row.replaceWith(configRenderField(widget.spec));
        }
      }
      configUpdateVisibility();
    }
    configRenderUsage(); configMessage(edited ? '已保存提交时的配置。保存期间新增的更改仍在草稿中，请再次保存。' : '配置已保存。不会自动开始挂机。', 'success');
    if (!data.running) {
      const prior=loopFieldDefaults;
      if(!prior||$('loop-rounds').value===String(prior.rounds))$('loop-rounds').value=data.settings.loop.rounds;
      if(!prior||$('loop-every').value===String(prior.seconds))$('loop-every').value=data.settings.loop.everySeconds;
      loopFieldDefaults={rounds:data.settings.loop.rounds,seconds:data.settings.loop.everySeconds};
    }
  } catch (error) { if (account === current) configErrors(error); }
  finally { if (account === current) { configBusy(false); configUpdateState(); } }
}

async function configImportFile(event) {
  const file = event.target.files?.[0]; event.target.value = '';
  if (!file || !configEditor.draft || configEditor.busy) return;
  if (file.size > 262144) { configMessage('配置文件不能超过 256 KB。', 'error'); return; }
  const account = current, original = JSON.stringify(configEditor.draft);
  configBusy(true); configUpdateState();
  try {
    let document;
    try { document = JSON.parse(await file.text()); } catch { throw new Error('文件不是有效 JSON，请选择本工具导出的配置文件。'); }
    const data = await call('/api/settings/validate', { method: 'POST', body: JSON.stringify({ document }) });
    if (account !== current) return;
    if (JSON.stringify(configEditor.draft) !== original) { configMessage('导入期间草稿发生了更改，已保留当前草稿。需要替换时请再次导入。'); return; }
    configEditor.draft = data.settings; configEditor.errors = {}; configRender();
    configMessage('配置已导入草稿。请检查各项设置，点击“保存配置”后才会生效。', 'info');
  } catch (error) { if (account === current) configErrors(error); }
  finally { if (account === current) { configBusy(false); configUpdateState(); } }
}

async function configExport() {
  if (!configEditor.draft || configEditor.busy || !configCheckForm()) return;
  const account = current, draft = structuredClone(configEditor.draft);
  configBusy(true); configUpdateState();
  try {
    const data = await call('/api/settings/validate', { method: 'POST', body: JSON.stringify({ settings: draft }) });
    if (account !== current) return;
    const exported = { format: 'crazywaterworld-automation', version: 1, settings: data.settings };
    const blob = new Blob([JSON.stringify(exported, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = '疯狂水世界-游戏配置.json'; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    configMessage('已导出当前草稿，仅包含游戏配置，不含账号、登录凭据和当日用量。', 'success');
  } catch (error) { if (account === current) configErrors(error); }
  finally { if (account === current) { configBusy(false); configUpdateState(); } }
}

async function configPreview() {
  if (!configEditor.draft || configEditor.busy || !configCheckForm()) return;
  const account = current, original = JSON.stringify(configEditor.draft), category = configEditor.category, group = configEditor.selectedGroups[category], scope = $('config-preview-scope').value;
  const contextChanged = () => JSON.stringify(configEditor.draft) !== original || category !== configEditor.category || group !== configEditor.selectedGroups[category] || scope !== $('config-preview-scope').value;
  configBusy(true); configUpdateState(); $('config-preview').textContent = '读取真实状态…';
  try {
    const selected=scope.startsWith('module:')?configEditor.groups.get(scope.slice(7)):null;
    const dedicated={treasure:'world',radar:'radar','fleet-dispatch':'fleetDispatch','pirate-sweep':'pirateSweep','pirate-hunt':'pirateHunt',worldBoss:'worldBoss',cityWar:'cityWar',forge:'forge',antique:'antique',heroes:'heroes',runtime:'runtime'};
    const runtime=await call('/api/loop');
    const source=selected?dedicated[selected.id]:scope;
    let data;
    if(source){
      data=await call('/api/settings/preview',{method:'POST',body:JSON.stringify({settings:JSON.parse(original),category:source})});
    }else{
      const controls=runtime.controls.filter(c=>selected.controlKeys.includes(c.key));
      data={groupRows:controls,fields:selected.fields,scopeLabel:selected.title,checkedAt:new Date().toISOString(),usage:configEditor.data.usage,viewOnly:true,actions:[],notes:[]};
      if(selected.category==='base' && selected.id!=='resources'){
        const plan=await call('/api/settings/preview',{method:'POST',body:JSON.stringify({settings:JSON.parse(original),category:'base'})});
        const bases={building:['build','finishUpgrade','speedUpUpgrade','buildSupply','challengeField','giveUpField'],factory:['startProduce','gainFactory','collectProduct','speedUpProduce','nativeProduce'],farm:['farm'],resident:['finishOrder','denyOrder','checkResidentOrders'],cargo:['cargo','cargoLoad','cargoClaim'],gold:['paidGold'],gather:['autoDive','diveEnhance','autoSalvage','salvageEnhance','autoFish','fishEnhance','floaters','antiqueFloaters']};
        data.moduleActions=plan.actions.filter(a=>a.setting?.split('.')[0]===selected.id || bases[selected.id]?.includes(a.kind));
        data.usage=plan.usage;
      }
      if(['daily-actions','daily-challenges','rewards'].includes(selected.id)){
        const plan=await call('/api/settings/preview',{method:'POST',body:JSON.stringify({settings:JSON.parse(original),category:'daily'})});
        const isTrial=a=>['trialPaidSweep','trialAdSweep'].includes(a.kind);
        data.moduleActions=plan.actions.filter(a=>selected.id==='daily-actions'?a.kind==='daily':selected.id==='daily-challenges'?isTrial(a):a.kind!=='daily'&&!isTrial(a));
        data.usage=plan.usage;
      }
      const activityNames={'merchant-week':['海商王'],'military-week':['军备竞赛'],'beauty-contest':['海上风采大赛'],'river-series':['走江踏浪','龙王罗盘','酆都法旨']};
      if(activityNames[selected.id]){
        const stats=await call('/api/activity-statistics?refresh=1');
        data.moduleActivities=stats.items.filter(r=>activityNames[selected.id].includes(r.name));
      }

    }
    if (account !== current) return;
    if (contextChanged()) { clear($('config-preview-result')); configMessage('草稿、分组或预览范围已变化，请重新预览。'); return; }
    configEditor.runtime=runtime;configEditor.data.usage=data.usage;if(data.pendingUsage)configEditor.data.pendingUsage=data.pendingUsage;configEditor.previewSummary={...data,group,scope};configRenderUsage();
    const root = clear($('config-preview-result'));
    if(data.groupRows){
      root.append(el('h4','',data.scopeLabel+' · 草稿与运行状态'));
      if(data.moduleActions)root.append(data.moduleActions.length?table(['拟执行动作','消耗'],data.moduleActions.map(a=>[a.label,a.costs.map(c=>c.name+' ×'+c.num).join('、')||'—'])):el('p','dim','当前无可排动作'));
      if(data.moduleActivities)root.append(data.moduleActivities.length?table(['活动','状态','进度'],data.moduleActivities.map(r=>[r.name,r.status,r.progress])):el('p','dim','尚无对应活动数据'));
      if(data.fields.length)root.append(table(['参数','草稿值'],data.fields.map(f=>{
        const value=configGet(f.key);
        return [f.label,typeof value==='boolean'?(value?'开':'关'):Array.isArray(value)?value.map(v=>typeof v==='object'?JSON.stringify(v):String(v)).join('、')||'未选':String(value??'未配置')];
      })));
      if(data.groupRows.length)root.append(table(['功能','最近进度','执行条件'],data.groupRows.map(c=>[c.label,c.progress,c.condition])));
      root.append(el('p','dim','只读 · 运行状态取自已保存配置'));
      return;
    }
    if(data.dispatch){if(data.dispatch.fuel!==undefined)root.append(el('p','config-help','汽油库存 '+(data.dispatch.fuel??'未同步')+' · 待确认占用 '+(data.dispatch.pending??'未同步')));root.append(table(['舰队','状态'],(data.dispatch.fleets??[]).map(f=>[f.name||f.buildingId,f.reason||'当前可用'])));}
    root.append(el('p', 'config-help', (data.scopeLabel || '当前分类') + (data.viewOnly ? ' · 只读' : ' · 可排 '+data.actions.length+' 项') + ' 检查时间：' + new Date(data.checkedAt).toLocaleTimeString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })));
    if (data.treasure) {
      const state = data.treasure;
      root.append(el('p', 'config-help', `读到 ${data.counts?.treasures ?? 0} 艘万吨货轮、${data.counts?.fleets ?? 0} 支舰队；汽油 ${state.fuel ?? '未确认'}，每队费用 ${state.fuelPerFleet ?? '未确认'}；今日领奖 ${state.todayRewardTimes ?? '未确认'} / ${state.rewardLimit ?? '未确认'}。`));
      const mode = el('p', 'config-help title-with-help', '参与模式：' + (state.participationMode === 'always' ? '每次参与' : '打满就停'));
      mode.append(makeHelpTip('当前参与模式', state.participationMode === 'always' ? '领奖已满仍可参加，其他限制照常生效；不会增加游戏奖励次数。' : '领奖已满后不再派遣或维修。')); root.append(mode);
      if (state.targets?.length) root.append(table(['货轮', '本人实际进度 / 上限', '参与条件'], state.targets.map(target => [target.label,
        (target.personalProgress == null ? '未确认' : target.personalProgress + '%') + ' / ' + (target.personalProgressLimit ?? '?') + '%', target.reason || '满足目标条件'])));
      if (state.fleets?.length) root.append(table(['舰队', '实际状态 / 耐久', '游戏自动作战', '舰队条件'], state.fleets.map(fleet => [
        fleet.name, fleet.state + (fleet.durability != null ? ' · ' + fleet.durability + '/' + (fleet.maxDura ?? '?') : ''),
        fleet.autoFight == null ? '未取得' : fleet.autoFight ? '开启' : '关闭', fleet.reason || '满足',
      ])));
    }
    if (data.cityWar) {
      const state = data.cityWar;
      root.append(el('p', 'config-help', '原生每队每日委任额度：' + (state.nativeLimit ?? '未确认') + '；本工具原生委任设置：' +
        (state.nativeCommissionLimit === -1 ? '按 VIP 规则' : state.nativeCommissionLimit === 0 ? '关闭原生委任' : (state.nativeCommissionLimit ?? '?') + ' 次') +
        '；汽油 ' + (state.fuel ?? '未确认') + '。' +
        (state.startTime && state.endTime ? '服务器城战时段：' + new Date(state.startTime * 1000).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }) + ' 至 ' + new Date(state.endTime * 1000).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }) : '尚未取得有效城战时段。')));
      if (state.fleets?.length) root.append(table(['舰队', '实际状态', '今日原生委任', '接续条件'], state.fleets.map(f => [f.name, f.state, (f.used ?? '?') + ' / ' + (f.limit ?? '?'), f.reason || '满足舰队条件'])));
      if (state.targets?.length) root.append(table(['已宣战目标', '本盟排队/交战 + 在途', '单队汽油', '目标标记'], state.targets.map(t => {
        const total = t.alliedCount == null || t.transitCount == null ? null : t.alliedCount + t.transitCount;
        return [t.name, t.alliedCount == null ? (t.countReason || '未确认')
          : t.alliedCount + ' 队' + (t.transitCount == null ? ' + 在途未确认' : ' + ' + t.transitCount + ' 在途 = ' + total + ' 队'),
          String(t.petrol), t.assemble ? '联盟集结' : '已宣战'];
      })));
    }
    if (data.onlineReward) {
      const state = data.onlineReward;
      root.append(el('p', 'config-help', '城战在线奖励：已领 ' + (state.claimed ?? '未确认') + ' 档；' + (state.ready ? '第 ' + state.stage + ' 档可领取' : state.reason || '暂无可领取档位')));
    }
    if (data.forge) {
      const state = data.forge;
      root.append(el('p', 'config-help', '当前赛季 ' + (state.season ?? '未确认') + ' · 锻造等级 ' + (state.forgeLevel ?? '未确认') + ' · 金币 ' + (state.gold ?? '未确认')));
      if (state.factories?.length) root.append(table(['工厂', '当前状态', '原生自动锻造', '工具检查'], state.factories.map(f => [f.buildingId, f.state, f.nativeAuto ? '开启' : '关闭', f.reason || '满足'])));
    }
    if (data.antique) {
      const state = data.antique;
      root.append(el('p', 'config-help', '已激活藏品 ' + (state.count ?? '未确认') + ' 件 · 套装 ' + (state.suits ?? '未确认') + ' 套 · 大师等级 ' + (state.masterLv ?? '未确认') + ' · 金币 ' + (state.gold ?? '未确认')));
    }
    const list = el('ol', 'config-preview-list');
    for (const action of data.actions) { const row = el('li', '', action.label); if (action.costs.length) row.append(el('span', 'config-preview-cost', '消耗：' + action.costs.map(cost => cost.name + ' ×' + cost.num).join('、'))); list.append(row); }
    root.append(list);
    if (data.notes.length) { const details = el('details'); details.open = !!data.viewOnly; details.append(el('summary', '', (data.viewOnly ? '状态说明（' : '查看跳过原因与条件（') + data.notes.length + '）')); const notes = el('ul'); for (const text of data.notes) notes.append(el('li', '', text)); details.append(notes); root.append(details); }
    configMessage(data.viewOnly ? '已读取状态说明，没有执行游戏动作。' : '已读取真实状态并计算计划，没有执行游戏动作。', 'success');
  } catch (error) {
    if (account === current) {
      if (contextChanged()) { clear($('config-preview-result')); configMessage('草稿、分组或预览范围已变化，请重新预览。'); }
      else {clear($('config-preview-result')).append(el('p','bad','预览未完成：'+error.message));configErrors(error);}
    }
  }
  finally { if (account === current) { configBusy(false); configUpdateState(); $('config-preview').textContent = '只读预览'; } }
}

$('config-form').onsubmit = configSave;
$('config-import').onclick = () => { if (!configEditor.busy) $('config-file').click(); };
$('config-file').onchange = configImportFile;
$('config-export').onclick = configExport;
$('config-preview').onclick = configPreview;
$('config-preview-scope').onchange = () => {const value=$('config-preview-scope').value;if(value.startsWith('module:')){const g=configEditor.groups.get(value.slice(7));if(g){configActivate(g.category,false,false);configActivateGroup(g.id,false,true,true);}}configEditor.previewSummary=null;clear($('config-preview-result'));configRenderUsage();};
$('config-reload').onclick = () => { if (!configIsDirty() || window.confirm('重新载入会丢弃当前未保存的配置草稿，是否继续？')) void configLoad(true); };
for (const tab of document.querySelectorAll('[data-config-tab]')) {
  tab.onclick = () => configActivate(tab.dataset.configTab);
  tab.onkeydown = event => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const keys = Object.keys(configCategories), at = keys.indexOf(configEditor.category);
    const next = event.key === 'ArrowRight' ? (at + 1) % keys.length : event.key === 'ArrowLeft' ? (at + keys.length - 1) % keys.length : event.key === 'Home' ? 0 : event.key === 'End' ? keys.length - 1 : null;
    if (next != null) { event.preventDefault(); configActivate(keys[next], true); }
  };
}
window.addEventListener('hashchange', () => {
  if (!location.hash.startsWith('#config-group-')) return;
  if (current && !configVisible()) document.querySelector('#tabs [data-tab="settings"]').click();
  if (configVisible() && configEditor.owner === current && configEditor.data) configApplyHash();
});
window.addEventListener('beforeunload', event => { if (configIsDirty()) { event.preventDefault(); event.returnValue = ''; } });
