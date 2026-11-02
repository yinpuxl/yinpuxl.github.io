// src/game/eventBus.ts
var EventBus = class {
  subs = /* @__PURE__ */ new Map();
  on(event, priority, fn) {
    const list = this.subs.get(event) ?? [];
    list.push({ priority, fn });
    this.subs.set(event, list);
    return () => this.off(event, fn);
  }
  off(event, fn) {
    const list = this.subs.get(event);
    if (!list) return;
    this.subs.set(event, list.filter((s) => s.fn !== fn));
  }
  emit(event, ctx) {
    const list = this.subs.get(event);
    if (!list) return;
    [...list].sort((a, b) => a.priority - b.priority).forEach((s) => s.fn(ctx));
  }
  clear() {
    this.subs.clear();
  }
};
var bus = new EventBus();
var EV = {
  combatStart: "combatStart",
  // { state }
  combatEnd: "combatEnd",
  // { state, victory }
  turnStart: "turnStart",
  // { state, side, creature }
  turnEnd: "turnEnd",
  // { state, side, creature }
  cardPlayed: "cardPlayed",
  // { state, card }
  potionUsed: "potionUsed",
  // { state, potion }
  drawCards: "drawCards",
  // { state, count } 视觉：抽牌动画
  energyChanged: "energyChanged",
  // { state, delta } 视觉：能量数字插值
  intentChanged: "intentChanged",
  // { state } 视觉：敌人意图变化
  modifyDamageDealt: "modifyDamageDealt",
  // { amount, source, target, attackType }
  modifyDamageTaken: "modifyDamageTaken",
  // { amount, source, target, attackType }
  damageDealt: "damageDealt",
  // { amount, source, target }
  blockGained: "blockGained",
  // { amount, target }
  hpLost: "hpLost",
  // { amount, target }
  statusApplied: "statusApplied",
  // { target, status, stacks }
  enemyDeath: "enemyDeath"
  // { state, enemy }
};

// src/game/powers.ts
var floor = Math.floor;
var POWERS = {
  strength: {
    id: "strength",
    name: "\u529B\u91CF",
    isDebuff: false,
    desc: "\u653B\u51FB\u4F24\u5BB3 +N",
    modifyDamageDealt: (ctx, n) => {
      ctx.amount += n;
    }
  },
  weak: {
    id: "weak",
    name: "\u865A\u5F31",
    isDebuff: true,
    desc: "\u653B\u51FB\u4F24\u5BB3 \xD70.75\uFF0C\u6BCF\u56DE\u5408\u7ED3\u675F -1",
    modifyDamageDealt: (ctx) => {
      ctx.amount = floor(ctx.amount * 0.75);
    },
    onTurnEnd: (ctx, n) => {
      ctx.creature.statuses.weak = Math.max(0, n - 1);
    }
  },
  vulnerable: {
    id: "vulnerable",
    name: "\u6613\u4F24",
    isDebuff: true,
    desc: "\u53D7\u5230\u7684\u653B\u51FB\u4F24\u5BB3 \xD71.5\uFF0C\u6BCF\u56DE\u5408\u7ED3\u675F -1",
    modifyDamageTaken: (ctx) => {
      ctx.amount = floor(ctx.amount * 1.5);
    },
    onTurnEnd: (ctx, n) => {
      ctx.creature.statuses.vulnerable = Math.max(0, n - 1);
    }
  },
  ritual: {
    id: "ritual",
    name: "\u4EEA\u5F0F",
    isDebuff: false,
    desc: "\u56DE\u5408\u5F00\u59CB\u65F6\u83B7\u5F97 N \u5C42\u529B\u91CF\uFF0C\u7136\u540E -1 \u5C42",
    onTurnStart: (ctx, n) => {
      ctx.creature.statuses.strength = (ctx.creature.statuses.strength ?? 0) + n;
      ctx.creature.statuses.ritual = Math.max(0, n - 1);
    }
  },
  metallicize: {
    id: "metallicize",
    name: "\u91D1\u5C5E\u5316",
    isDebuff: false,
    desc: "\u56DE\u5408\u7ED3\u675F\u65F6\u83B7\u5F97 N \u70B9\u683C\u6321",
    onTurnStart: (ctx, n) => {
      if (ctx.side === "player") ctx.state.player.block += n;
    }
  },
  demon_form: {
    id: "demon_form",
    name: "\u6076\u9B54\u5F62\u6001",
    isDebuff: false,
    desc: "\u56DE\u5408\u5F00\u59CB\u65F6\u83B7\u5F97 N \u5C42\u529B\u91CF",
    onTurnStart: (ctx, n) => {
      ctx.creature.statuses.strength = (ctx.creature.statuses.strength ?? 0) + n;
    }
  },
  entangled: {
    id: "entangled",
    name: "\u7F20\u7ED5",
    isDebuff: true,
    desc: "\u88AB\u7F51\u675F\u7F1A\uFF0C\u65E0\u6CD5\u6253\u51FA\u653B\u51FB\u724C",
    onTurnEnd: (ctx, n) => {
      ctx.creature.statuses.entangled = Math.max(0, n - 1);
    }
  }
};
function powerName(id) {
  return POWERS[id]?.name ?? id;
}
function installPowerSystem() {
  bus.on(EV.modifyDamageDealt, 10, (ctx) => {
    if (ctx.attackType !== "attack") return;
    for (const [pid, stacks] of Object.entries(ctx.source.statuses)) {
      if (stacks > 0) POWERS[pid]?.modifyDamageDealt?.(ctx, stacks);
    }
  });
  bus.on(EV.modifyDamageTaken, 20, (ctx) => {
    if (ctx.attackType !== "attack") return;
    for (const [pid, stacks] of Object.entries(ctx.target.statuses)) {
      if (stacks > 0) POWERS[pid]?.modifyDamageTaken?.(ctx, stacks);
    }
  });
  bus.on(EV.turnStart, 10, (ctx) => {
    for (const [pid, stacks] of Object.entries(ctx.creature.statuses)) {
      if (stacks > 0) POWERS[pid]?.onTurnStart?.(ctx, stacks);
    }
  });
  bus.on(EV.turnEnd, 10, (ctx) => {
    for (const [pid, stacks] of Object.entries(ctx.creature.statuses)) {
      if (stacks > 0) POWERS[pid]?.onTurnEnd?.(ctx, stacks);
    }
  });
}

// src/game/intent.ts
function weightedPick(items, weight, r) {
  const total = items.reduce((s, i) => s + weight(i), 0);
  let acc = 0;
  for (const it of items) {
    acc += weight(it);
    if (r * total <= acc) return it;
  }
  return items[items.length - 1];
}
function rollIntent(def, e, rng2) {
  if (!e.firstUsed && def.intent.first) {
    e.firstUsed = true;
    const moveId = def.intent.first.move;
    return { moveId, move: def.moves[moveId] };
  }
  e.firstUsed = true;
  const num = Math.floor(rng2() * 100);
  for (const rule of def.intent.rules) {
    if (num >= rule.roll[0] && num < rule.roll[1]) {
      for (const branch of rule.branches) {
        const b = branch.if;
        let ok = true;
        if (b) {
          if (b.last !== void 0) ok = e.history[e.history.length - 1] === b.last;
          if (ok && b.last_two !== void 0) {
            ok = e.history[e.history.length - 1] === b.last_two && e.history[e.history.length - 2] === b.last_two;
          }
          if (ok && b.not_in_history !== void 0) {
            ok = !e.history.includes(b.not_in_history);
          }
        }
        if (ok) {
          const pick = weightedPick(branch.options, (o) => o.weight, rng2());
          return { moveId: pick.move, move: def.moves[pick.move] };
        }
      }
    }
  }
  const first = def.intent.rules[0].branches[0].options[0];
  return { moveId: first.move, move: def.moves[first.move] };
}

// src/game/potions.ts
var POTION_SLOTS = 3;
var POTION_DEFS = {
  fire_potion: {
    id: "fire_potion",
    name: "\u706B\u7130\u836F\u6C34",
    rarity: "common",
    desc: "\u9020\u6210 20 \u70B9\u4F24\u5BB3\u3002",
    effects: [{ op: "damage", value: 20 }]
  },
  block_potion: {
    id: "block_potion",
    name: "\u683C\u6321\u836F\u6C34",
    rarity: "common",
    desc: "\u83B7\u5F97 12 \u70B9\u683C\u6321\u3002",
    effects: [{ op: "block", value: 12 }]
  },
  strength_potion: {
    id: "strength_potion",
    name: "\u529B\u91CF\u836F\u6C34",
    rarity: "common",
    desc: "\u83B7\u5F97 2 \u70B9\u529B\u91CF\u3002",
    effects: [{ op: "gain_status", status: "strength", stacks: 2 }]
  },
  weaken_potion: {
    id: "weaken_potion",
    name: "\u865A\u5F31\u836F\u6C34",
    rarity: "common",
    desc: "\u6240\u6709\u654C\u4EBA\u83B7\u5F97 3 \u5C42\u865A\u5F31\u3002",
    effects: [{ op: "apply_status_all", status: "weak", stacks: 3 }]
  }
};
var POTION_POOL = ["fire_potion", "block_potion", "strength_potion", "weaken_potion"];
function grantPotion(state, id) {
  if (state.potions.length >= POTION_SLOTS) {
    state.log.push({ text: "\u836F\u6C34\u69FD\u5DF2\u6EE1\uFF0C\u65E0\u6CD5\u643A\u5E26\u66F4\u591A\u836F\u6C34\u3002", cls: "system" });
    return false;
  }
  state.potions.push(id);
  state.log.push({ text: `\u83B7\u5F97\u4E86\u4E00\u74F6\u300C${POTION_DEFS[id].name}\u300D\u3002`, cls: "system" });
  return true;
}
function randomPotion() {
  return POTION_POOL[Math.floor(Math.random() * POTION_POOL.length)];
}

// src/content/starter_kit.json
var starter_kit_default = {
  _meta: {
    purpose: "\u9636\u6BB5\u4E00\u5F00\u7BB1\u5305\uFF1A10 \u5F20\u94C1\u7532\u6218\u58EB\u5361 + 2 \u4E2A\u654C\u4EBA\uFF0C\u6570\u503C\u5168\u90E8\u6765\u81EA\u53CD\u7F16\u8BD1\u6E90\u7801\uFF08\u975E Wiki \u4F30\u7B97\uFF09",
    source: "decompiled/src/com/megacrit/cardcrawl/cards/red/*.java + monsters/exordium/*.java",
    effect_code_convention: {
      damage: "\u5355\u4F53\u4F24\u5BB3",
      damage_n: "\u6253 N \u6B21",
      damage_all: "\u5168\u4F53\u4F24\u5BB3",
      block: "\u83B7\u5F97\u683C\u6321",
      draw: "\u62BD\u724C",
      apply_status: "\u65BD\u52A0\u72B6\u6001",
      add_card: "\u628A\u5361\u52A0\u5165\u67D0\u5806",
      discard_top: "\u5F03\u724C\u5806\u9009\u5361\u7F6E\u9876\u62BD\u724C\u5806"
    },
    intent_format: {
      "intent.first.move": "\u7B2C\u4E00\u56DE\u5408\u56FA\u5B9A\u62DB\u5F0F",
      "intent.rules[].roll": "\u63B7\u9AB0\u533A\u95F4 [a,b)\uFF0Cnum=0..99",
      "branch.if.last": "\u4E0A\u4E00\u62DB\u662F\u8FD9\u4E2A\u624D\u9002\u7528",
      "branch.if.last_two": "\u524D\u4E24\u62DB\u90FD\u662F\u8FD9\u4E2A\u624D\u9002\u7528",
      "branch.else": "\u515C\u5E95\u5206\u652F",
      "options[].weight": "\u8BE5\u5206\u652F\u5185\u7684\u52A0\u6743\u6982\u7387"
    },
    notes: [
      "upgrade \u5B57\u6BB5 = \u5347\u7EA7\u540E\u7684\u53D8\u5316",
      "ascension \u5217\uFF1A\u9AD8\u96BE\u5EA6\uFF08\u8FDB\u9636\uFF09\u6570\u503C\uFF0C\u7F51\u9875\u7248\u7B2C\u4E00\u7248\u53EF\u5148\u5FFD\u7565"
    ]
  },
  cards: [
    {
      id: "Strike_R",
      name: "\u6253\u51FB",
      cost: 1,
      type: "attack",
      rarity: "basic",
      effects: [{ op: "damage", value: 6 }],
      upgrade: { damage: 9 },
      desc: "\u9020\u6210 !D! \u70B9\u4F24\u5BB3\u3002"
    },
    {
      id: "Defend_R",
      name: "\u9632\u5FA1",
      cost: 1,
      type: "skill",
      rarity: "basic",
      effects: [{ op: "block", value: 5 }],
      upgrade: { block: 8 },
      desc: "\u83B7\u5F97 !B! \u70B9\u683C\u6321\u3002"
    },
    {
      id: "Bash",
      name: "\u75DB\u51FB",
      cost: 2,
      type: "attack",
      rarity: "basic",
      effects: [
        { op: "damage", value: 8 },
        { op: "apply_status", status: "vulnerable", stacks: 2 }
      ],
      upgrade: { damage: 10, stacks: 3 },
      desc: "\u9020\u6210 !D! \u70B9\u4F24\u5BB3\u3002 NL \u65BD\u52A0 !M! \u5C42 \u6613\u4F24 \u3002"
    },
    {
      id: "Anger",
      name: "\u6124\u6012",
      cost: 0,
      type: "attack",
      rarity: "common",
      effects: [
        { op: "damage", value: 6 },
        { op: "add_card", card: "Anger", pile: "discard" }
      ],
      upgrade: { damage: 8 },
      desc: "\u9020\u6210 !D! \u70B9\u4F24\u5BB3\u3002 NL \u5C06\u4E00\u5F20 \u6124\u6012 \u52A0\u5165\u4F60\u7684\u5F03\u724C\u5806\u3002"
    },
    {
      id: "Cleave",
      name: "\u987A\u5288\u65A9",
      cost: 1,
      type: "attack",
      rarity: "common",
      effects: [{ op: "damage_all", value: 8 }],
      upgrade: { damage: 11 },
      desc: "\u5BF9\u6240\u6709\u654C\u4EBA\u9020\u6210 !D! \u70B9\u4F24\u5BB3\u3002"
    },
    {
      id: "Headbutt",
      name: "\u5934\u9524",
      cost: 1,
      type: "attack",
      rarity: "common",
      effects: [
        { op: "damage", value: 9 },
        { op: "discard_top" }
      ],
      upgrade: { damage: 12 },
      desc: "\u9020\u6210 !D! \u70B9\u4F24\u5BB3\u3002 NL \u5C06\u5F03\u724C\u5806\u4E2D\u7684\u4E00\u5F20\u724C\u653E\u5230\u62BD\u724C\u5806\u9876\u90E8\u3002"
    },
    {
      id: "Iron Wave",
      name: "\u94C1\u65A9\u6CE2",
      cost: 1,
      type: "attack",
      rarity: "common",
      effects: [
        { op: "damage", value: 5 },
        { op: "block", value: 5 }
      ],
      upgrade: { damage: 7, block: 7 },
      desc: "\u83B7\u5F97 !B! \u70B9\u683C\u6321\u3002 NL \u9020\u6210 !D! \u70B9\u4F24\u5BB3\u3002"
    },
    {
      id: "Pommel Strike",
      name: "\u5251\u67C4\u6253\u51FB",
      cost: 1,
      type: "attack",
      rarity: "common",
      effects: [
        { op: "damage", value: 9 },
        { op: "draw", value: 1 }
      ],
      upgrade: { damage: 10, draw: 2 },
      desc: "\u9020\u6210 !D! \u70B9\u4F24\u5BB3\u3002 NL \u62BD !M! \u5F20\u724C\u3002"
    },
    {
      id: "Shrug It Off",
      name: "\u8038\u80A9\u65E0\u89C6",
      cost: 1,
      type: "skill",
      rarity: "common",
      effects: [
        { op: "block", value: 8 },
        { op: "draw", value: 1 }
      ],
      upgrade: { block: 11 },
      desc: "\u83B7\u5F97 !B! \u70B9\u683C\u6321\u3002 NL \u62BD 1 \u5F20\u724C\u3002"
    },
    {
      id: "Twin Strike",
      name: "\u53CC\u91CD\u6253\u51FB",
      cost: 1,
      type: "attack",
      rarity: "common",
      effects: [{ op: "damage_n", value: 5, times: 2 }],
      upgrade: { damage: 7 },
      desc: "\u9020\u6210 !D! \u70B9\u4F24\u5BB3\u4E24\u6B21\u3002"
    }
  ],
  enemies: [
    {
      id: "Cultist",
      name: "\u90AA\u6559\u5F92",
      hp: [48, 54],
      ascension: { hp: [50, 56], ritual_stacks: 4 },
      moves: {
        incantation: { type: "buff", apply_status: { status: "ritual", stacks: 3 } },
        dark_strike: { type: "attack", damage: 6 }
      },
      intent: {
        first: { move: "incantation" },
        rules: [
          { roll: [0, 100], branches: [
            { else: true, options: [{ move: "dark_strike", weight: 1 }] }
          ] }
        ]
      },
      note: "\u5148\u624B\u4EEA\u5F0F +3 \u529B\u91CF/\u56DE\u5408\uFF0C\u6B64\u540E\u6BCF\u56DE\u5408\u6253 6"
    },
    {
      id: "JawWorm",
      name: "\u989A\u866B",
      hp: [40, 44],
      ascension: { hp: [42, 46], chomp_damage: 12, bellow_strength: 4 },
      moves: {
        chomp: { type: "attack", damage: 11 },
        thrash: { type: "attack_defend", damage: 7, block: 5 },
        bellow: { type: "defend_buff", block: 6, gain_strength: 3 }
      },
      intent: {
        first: { move: "chomp" },
        rules: [
          { roll: [0, 25], branches: [
            { if: { last: "chomp" }, options: [
              { move: "bellow", weight: 0.5625 },
              { move: "thrash", weight: 0.4375 }
            ] },
            { else: true, options: [{ move: "chomp", weight: 1 }] }
          ] },
          { roll: [25, 55], branches: [
            { if: { last_two: "thrash" }, options: [
              { move: "chomp", weight: 0.357 },
              { move: "bellow", weight: 0.643 }
            ] },
            { else: true, options: [{ move: "thrash", weight: 1 }] }
          ] },
          { roll: [55, 100], branches: [
            { if: { last: "bellow" }, options: [
              { move: "chomp", weight: 0.416 },
              { move: "thrash", weight: 0.584 }
            ] },
            { else: true, options: [{ move: "bellow", weight: 1 }] }
          ] }
        ]
      },
      note: "\u6BCF\u56DE\u5408\u63B7 num=0..99\uFF1Blast_move/last_two \u7EA6\u675F\u4F18\u5148\u4E8E\u6743\u91CD"
    },
    {
      id: "TheSpireGuardian",
      name: "\u5C16\u5854\u5B88\u536B",
      hp: [150, 160],
      moves: {
        chomp: { type: "attack", damage: 15 },
        thrash: { type: "attack_defend", damage: 10, block: 8 },
        bellow: { type: "defend_buff", block: 9, gain_strength: 3 }
      },
      intent: {
        first: { move: "chomp" },
        rules: [
          { roll: [0, 25], branches: [
            { if: { last: "chomp" }, options: [
              { move: "bellow", weight: 0.5625 },
              { move: "thrash", weight: 0.4375 }
            ] },
            { else: true, options: [{ move: "chomp", weight: 1 }] }
          ] },
          { roll: [25, 55], branches: [
            { if: { last_two: "thrash" }, options: [
              { move: "chomp", weight: 0.357 },
              { move: "bellow", weight: 0.643 }
            ] },
            { else: true, options: [{ move: "thrash", weight: 1 }] }
          ] },
          { roll: [55, 100], branches: [
            { if: { last: "bellow" }, options: [
              { move: "chomp", weight: 0.416 },
              { move: "thrash", weight: 0.584 }
            ] },
            { else: true, options: [{ move: "bellow", weight: 1 }] }
          ] }
        ]
      },
      note: "\u539F\u578B\u5360\u4F4D\u9996\u9886\uFF08\u57FA\u4E8E\u989A\u866B AI \u653E\u5927\u6570\u503C\uFF09"
    },
    {
      id: "LouseNormal",
      name: "\u8671\u866B",
      hp: [10, 15],
      moves: {
        bite: { type: "attack", damage: 6 },
        curl_up: { type: "buff", gain_strength: 3 }
      },
      intent: {
        rules: [
          { roll: [0, 25], branches: [
            { if: { last_two: "curl_up" }, options: [{ move: "bite", weight: 1 }] },
            { else: true, options: [{ move: "curl_up", weight: 1 }] }
          ] },
          { roll: [25, 100], branches: [
            { if: { last_two: "bite" }, options: [{ move: "curl_up", weight: 1 }] },
            { else: true, options: [{ move: "bite", weight: 1 }] }
          ] }
        ]
      },
      note: "\u54AC 5-7 \u53D6 6\uFF1B\u8737\u7F29 +3 \u529B\u91CF\u3002\u6570\u636E\u6765\u81EA LouseNormal.java"
    },
    {
      id: "FungiBeast",
      name: "\u771F\u83CC\u517D",
      hp: [22, 28],
      moves: {
        bite: { type: "attack", damage: 6 },
        grow: { type: "buff", gain_strength: 3 }
      },
      intent: {
        rules: [
          { roll: [0, 60], branches: [
            { if: { last_two: "bite" }, options: [{ move: "grow", weight: 1 }] },
            { else: true, options: [{ move: "bite", weight: 1 }] }
          ] },
          { roll: [60, 100], branches: [
            { if: { last: "grow" }, options: [{ move: "bite", weight: 1 }] },
            { else: true, options: [{ move: "grow", weight: 1 }] }
          ] }
        ]
      },
      note: "\u54AC 6\uFF1B\u6210\u957F +3 \u529B\u91CF\u3002\u6570\u636E\u6765\u81EA FungiBeast.java"
    },
    {
      id: "SlaverRed",
      name: "\u7EA2\u5974",
      hp: [46, 50],
      moves: {
        stab: { type: "attack", damage: 13 },
        entangle: { type: "buff", apply_status_player: { status: "entangled", stacks: 1 } },
        scrape: { type: "attack_debuff", damage: 8, apply_status_player: { status: "vulnerable", stacks: 2 } }
      },
      intent: {
        first: { move: "stab" },
        rules: [
          { roll: [0, 55], branches: [
            { if: { last_two: "stab" }, options: [{ move: "scrape", weight: 1 }] },
            { else: true, options: [{ move: "stab", weight: 1 }] }
          ] },
          { roll: [55, 75], branches: [
            { if: { last: "scrape" }, options: [{ move: "stab", weight: 1 }] },
            { else: true, options: [{ move: "scrape", weight: 1 }] }
          ] },
          { roll: [75, 100], branches: [
            { if: { not_in_history: "entangle" }, options: [{ move: "entangle", weight: 1 }] },
            { else: true, options: [{ move: "stab", weight: 1 }] }
          ] }
        ]
      },
      note: "\u523A\u51FB 13\uFF1B\u6293\u4F24 8+\u73A9\u5BB6 2 \u6613\u4F24\uFF1B\u7F20\u7ED5\u6BCF\u573A\u4E00\u6B21\uFF08\u4E0B\u56DE\u5408\u7981\u653B\u51FB\u724C\uFF09\u3002\u6570\u636E\u6765\u81EA SlaverRed.java"
    }
  ]
};

// src/content/ironclad_cards.json
var ironclad_cards_default = {
  _meta: {
    source: "\u53CD\u7F16\u8BD1 use() \u6E90\u7801 + content/cards.json \u6570\u503C",
    note: "\u767D\u540D\u5355\u8F6C\u6362\uFF0C\u672A\u77E5 Action \u6574\u5361\u653E\u5F03\uFF1B\u672A\u8986\u76D6\u7684\u5361\u9700\u624B\u5DE5\u8F6C\u5199",
    count: 36
  },
  cards: [
    {
      id: "Anger",
      name: "\u6124\u6012",
      cost: 0,
      type: "attack",
      rarity: "common",
      desc: "\u9020\u6210 !D! \u70B9\u4F24\u5BB3\u3002 NL \u5728\u5F03\u724C\u5806\u653E\u5165\u4E00\u5F20\u6B64\u724C\u7684\u590D\u5236\u54C1\u3002",
      effects: [
        {
          op: "damage",
          value: 6
        },
        {
          op: "add_card",
          card: "Anger",
          pile: "discard"
        }
      ],
      exhaust: false,
      ethereal: false,
      upgrade: {
        damage_delta: 2,
        name: true
      }
    },
    {
      id: "Bash",
      name: "\u75DB\u51FB",
      cost: 2,
      type: "attack",
      rarity: "basic",
      desc: "\u9020\u6210 !D! \u70B9\u4F24\u5BB3\u3002 NL \u7ED9\u4E88 !M! \u5C42 \u6613\u4F24 \u3002",
      effects: [
        {
          op: "damage",
          value: 8
        },
        {
          op: "apply_status",
          status: "vulnerable",
          stacks: 2
        }
      ],
      exhaust: false,
      ethereal: false,
      upgrade: {
        damage_delta: 2,
        magic_delta: 1,
        name: true
      }
    },
    {
      id: "Blood for Blood",
      name: "\u4EE5\u8840\u8FD8\u8840",
      cost: 0,
      type: "attack",
      rarity: "uncommon",
      desc: "\u4F60\u6BCF\u5728\u6218\u6597\u4E2D\u5931\u53BB\u751F\u547D\u4E00\u6B21\uFF0C\u8FD9\u5F20\u724C\u7684\u8017\u80FD\u5C31\u51CF\u5C111 [R] \u3002 NL \u9020\u6210 !D! \u70B9\u4F24\u5BB3\u3002",
      effects: [
        {
          op: "damage",
          value: 18
        }
      ],
      exhaust: false,
      ethereal: false,
      upgrade: {
        damage_delta: 4,
        cost_to: 3,
        name: true
      }
    },
    {
      id: "Bloodletting",
      name: "\u653E\u8840",
      cost: 0,
      type: "skill",
      rarity: "uncommon",
      desc: "\u83B7\u5F97 [R] [R] \u3002 NL \u5931\u53BB 3 \u70B9\u751F\u547D\u3002",
      effects: [
        {
          op: "lose_hp",
          value: 3
        },
        {
          op: "gain_energy",
          value: 2
        }
      ],
      exhaust: false,
      ethereal: false,
      upgrade: {
        magic_delta: 1,
        name: true
      }
    },
    {
      id: "Bludgeon",
      name: "\u91CD\u9524",
      cost: 3,
      type: "attack",
      rarity: "rare",
      desc: "\u9020\u6210 !D! \u70B9\u4F24\u5BB3\u3002",
      effects: [
        {
          op: "damage",
          value: 32
        }
      ],
      exhaust: false,
      ethereal: false,
      upgrade: {
        damage_delta: 10,
        name: true
      }
    },
    {
      id: "Carnage",
      name: "\u6B8B\u6740",
      cost: 2,
      type: "attack",
      rarity: "uncommon",
      desc: " \u865A\u65E0 \u3002 NL \u9020\u6210 !D! \u70B9\u4F24\u5BB3\u3002",
      effects: [
        {
          op: "damage",
          value: 20
        }
      ],
      exhaust: false,
      ethereal: true,
      upgrade: {
        damage_delta: 8,
        name: true
      }
    },
    {
      id: "Clash",
      name: "\u4EA4\u950B",
      cost: 0,
      type: "attack",
      rarity: "common",
      desc: "\u53EA\u6709\u5728\u624B\u724C\u6BCF\u4E00\u5F20\u724C\u90FD\u662F\u653B\u51FB\u724C\u65F6\u624D\u80FD\u88AB\u6253\u51FA\u3002 NL \u9020\u6210 !D! \u70B9\u4F24\u5BB3\u3002",
      effects: [
        {
          op: "damage",
          value: 14
        }
      ],
      exhaust: false,
      ethereal: false,
      upgrade: {
        damage_delta: 4,
        name: true
      }
    },
    {
      id: "Cleave",
      name: "\u987A\u5288\u65A9",
      cost: 1,
      type: "attack",
      rarity: "common",
      desc: "\u5BF9\u6240\u6709\u654C\u4EBA\u9020\u6210 !D! \u70B9\u4F24\u5BB3\u3002",
      effects: [
        {
          op: "damage_all",
          value: 8
        }
      ],
      exhaust: false,
      ethereal: false,
      upgrade: {
        damage_delta: 3,
        name: true
      }
    },
    {
      id: "Clothesline",
      name: "\u91D1\u521A\u81C2",
      cost: 2,
      type: "attack",
      rarity: "common",
      desc: "\u9020\u6210 !D! \u70B9\u4F24\u5BB3\u3002 NL \u7ED9\u4E88 !M! \u5C42 \u865A\u5F31 \u3002",
      effects: [
        {
          op: "damage",
          value: 12
        },
        {
          op: "apply_status",
          status: "weak",
          stacks: 2
        }
      ],
      exhaust: false,
      ethereal: false,
      upgrade: {
        damage_delta: 2,
        magic_delta: 1,
        name: true
      }
    },
    {
      id: "Defend_R",
      name: "\u9632\u5FA1",
      cost: 1,
      type: "skill",
      rarity: "basic",
      desc: "\u83B7\u5F97 !B! \u70B9 \u683C\u6321 \u3002",
      effects: [
        {
          op: "block",
          value: 5
        }
      ],
      exhaust: false,
      ethereal: false,
      upgrade: {
        block_delta: 3,
        name: true
      }
    },
    {
      id: "Demon Form",
      name: "\u6076\u9B54\u5F62\u6001",
      cost: 3,
      type: "power",
      rarity: "rare",
      desc: "\u5728\u6BCF\u56DE\u5408\u5F00\u59CB\u65F6\u83B7\u5F97 NL !M! \u70B9 \u529B\u91CF \u3002",
      effects: [
        {
          op: "gain_status",
          status: "demon_form",
          stacks: 2
        }
      ],
      exhaust: false,
      ethereal: false,
      upgrade: {
        magic_delta: 1,
        name: true
      }
    },
    {
      id: "Disarm",
      name: "\u7F34\u68B0",
      cost: 1,
      type: "skill",
      rarity: "uncommon",
      desc: "\u4F7F\u654C\u4EBA\u5931\u53BB !M! \u70B9 \u529B\u91CF \u3002 NL \u6D88\u8017 \u3002",
      effects: [
        {
          op: "apply_status",
          status: "strength",
          stacks: 2
        }
      ],
      exhaust: true,
      ethereal: false,
      upgrade: {
        magic_delta: 1,
        name: true
      }
    },
    {
      id: "Ghostly Armor",
      name: "\u5E7D\u7075\u94E0\u7532",
      cost: 1,
      type: "skill",
      rarity: "uncommon",
      desc: " \u865A\u65E0 \u3002 NL \u83B7\u5F97 !B! \u70B9 \u683C\u6321 \u3002",
      effects: [
        {
          op: "block",
          value: 10
        }
      ],
      exhaust: false,
      ethereal: true,
      upgrade: {
        block_delta: 3,
        name: true
      }
    },
    {
      id: "Heavy Blade",
      name: "\u91CD\u5203",
      cost: 2,
      type: "attack",
      rarity: "common",
      desc: "\u9020\u6210 !D! \u70B9\u4F24\u5BB3\u3002 NL \u529B\u91CF \u5728 \u91CD\u5203 \u4E0A\u53D1\u6325 !M! \u500D\u6548\u679C\u3002",
      effects: [
        {
          op: "damage",
          value: 14
        }
      ],
      exhaust: false,
      ethereal: false,
      upgrade: {
        magic_delta: 2,
        name: true
      }
    },
    {
      id: "Hemokinesis",
      name: "\u5FA1\u8840\u672F",
      cost: 1,
      type: "attack",
      rarity: "uncommon",
      desc: "\u5931\u53BB !M! \u70B9\u751F\u547D\u3002 NL \u9020\u6210 !D! \u70B9\u4F24\u5BB3\u3002",
      effects: [
        {
          op: "lose_hp",
          value: 1
        },
        {
          op: "damage",
          value: 15
        }
      ],
      exhaust: false,
      ethereal: false,
      upgrade: {
        damage_delta: 5,
        name: true
      }
    },
    {
      id: "Immolate",
      name: "\u71D4\u796D",
      cost: 2,
      type: "attack",
      rarity: "rare",
      desc: "\u5BF9\u6240\u6709\u654C\u4EBA\u9020\u6210 !D! \u70B9\u4F24\u5BB3\u3002 NL \u5C06\u4E00\u5F20 *\u707C\u4F24 \u653E\u5165\u4F60\u7684\u5F03\u724C\u5806\u4E2D\u3002",
      effects: [
        {
          op: "damage_all",
          value: 21
        },
        {
          op: "add_card",
          card: "Burn",
          pile: "discard"
        }
      ],
      exhaust: false,
      ethereal: false,
      upgrade: {
        damage_delta: 7,
        name: true
      }
    },
    {
      id: "Impervious",
      name: "\u5CBF\u7136\u4E0D\u52A8",
      cost: 2,
      type: "skill",
      rarity: "rare",
      desc: "\u83B7\u5F97 !B! \u70B9 \u683C\u6321 \u3002 NL \u6D88\u8017 \u3002",
      effects: [
        {
          op: "block",
          value: 30
        }
      ],
      exhaust: true,
      ethereal: false,
      upgrade: {
        block_delta: 10,
        name: true
      }
    },
    {
      id: "Inflame",
      name: "\u71C3\u70E7",
      cost: 1,
      type: "power",
      rarity: "uncommon",
      desc: "\u83B7\u5F97 !M! \u70B9 \u529B\u91CF \u3002",
      effects: [
        {
          op: "gain_status",
          status: "strength",
          stacks: 2
        }
      ],
      exhaust: false,
      ethereal: false,
      upgrade: {
        magic_delta: 1,
        name: true
      }
    },
    {
      id: "Intimidate",
      name: "\u5A01\u5413",
      cost: 0,
      type: "skill",
      rarity: "uncommon",
      desc: "\u7ED9\u4E88\u6240\u6709\u654C\u4EBA !M! \u5C42 \u865A\u5F31 \u3002 NL \u6D88\u8017 \u3002",
      effects: [
        {
          op: "apply_status",
          status: "weak",
          stacks: 1
        }
      ],
      exhaust: true,
      ethereal: false,
      upgrade: {
        magic_delta: 1,
        name: true
      }
    },
    {
      id: "Iron Wave",
      name: "\u94C1\u65A9\u6CE2",
      cost: 1,
      type: "attack",
      rarity: "common",
      desc: "\u83B7\u5F97 !B! \u70B9 \u683C\u6321 \u3002 NL \u9020\u6210 !D! \u70B9\u4F24\u5BB3\u3002",
      effects: [
        {
          op: "block",
          value: 5
        },
        {
          op: "damage",
          value: 5
        }
      ],
      exhaust: false,
      ethereal: false,
      upgrade: {
        damage_delta: 2,
        block_delta: 2,
        name: true
      }
    },
    {
      id: "Metallicize",
      name: "\u91D1\u5C5E\u5316",
      cost: 1,
      type: "power",
      rarity: "uncommon",
      desc: "\u5728\u4F60\u7684\u56DE\u5408\u7ED3\u675F\u65F6\uFF0C\u83B7\u5F97 !M! \u70B9 \u683C\u6321 \u3002",
      effects: [
        {
          op: "gain_status",
          status: "metallicize",
          stacks: 3
        }
      ],
      exhaust: false,
      ethereal: false,
      upgrade: {
        magic_delta: 1,
        name: true
      }
    },
    {
      id: "Offering",
      name: "\u796D\u54C1",
      cost: 0,
      type: "skill",
      rarity: "rare",
      desc: "\u5931\u53BB 6 \u70B9\u751F\u547D\u3002 NL \u83B7\u5F97 [R] [R] \u3002 NL \u62BD !M! \u5F20\u724C\u3002 NL \u6D88\u8017 \u3002",
      effects: [
        {
          op: "lose_hp",
          value: 6
        },
        {
          op: "gain_energy",
          value: 2
        },
        {
          op: "draw",
          value: 3
        }
      ],
      exhaust: true,
      ethereal: false,
      upgrade: {
        magic_delta: 2,
        name: true
      }
    },
    {
      id: "Perfected Strike",
      name: "\u5B8C\u7F8E\u6253\u51FB",
      cost: 2,
      type: "attack",
      rarity: "common",
      desc: "\u9020\u6210 !D! \u70B9\u4F24\u5BB3\u3002 NL \u4F60\u6BCF\u6709\u4E00\u5F20\u540D\u5B57\u4E2D\u6709 \u6253\u51FB \u7684\u724C\uFF0C\u4F24\u5BB3+2\u3002",
      effects: [
        {
          op: "damage",
          value: 6
        }
      ],
      exhaust: false,
      ethereal: false,
      upgrade: {
        magic_delta: 1,
        name: true
      }
    },
    {
      id: "Pommel Strike",
      name: "\u5251\u67C4\u6253\u51FB",
      cost: 1,
      type: "attack",
      rarity: "common",
      desc: "\u9020\u6210 !D! \u70B9\u4F24\u5BB3\u3002 NL \u62BD !M! \u5F20\u724C\u3002",
      effects: [
        {
          op: "damage",
          value: 9
        },
        {
          op: "draw",
          value: 1
        }
      ],
      exhaust: false,
      ethereal: false,
      upgrade: {
        damage_delta: 1,
        magic_delta: 1,
        name: true
      }
    },
    {
      id: "Reckless Charge",
      name: "\u65E0\u8C0B\u51B2\u950B",
      cost: 0,
      type: "attack",
      rarity: "uncommon",
      desc: "\u9020\u6210 !D! \u70B9\u4F24\u5BB3\u3002 NL \u5C06\u4E00\u5F20 *\u6655\u7729 \u653E\u5165\u4F60\u7684\u62BD\u724C\u5806\u4E2D\u3002",
      effects: [
        {
          op: "damage",
          value: 7
        },
        {
          op: "add_card",
          card: "Dazed",
          pile: "draw"
        }
      ],
      exhaust: false,
      ethereal: false,
      upgrade: {
        damage_delta: 3,
        name: true
      }
    },
    {
      id: "Searing Blow",
      name: "\u707C\u70ED\u653B\u51FB",
      cost: 2,
      type: "attack",
      rarity: "uncommon",
      desc: "\u9020\u6210 !D! \u70B9\u4F24\u5BB3\u3002 NL \u80FD\u88AB\u591A\u6B21 \u5347\u7EA7 \u3002",
      effects: [
        {
          op: "damage",
          value: 12
        }
      ],
      exhaust: false,
      ethereal: false,
      upgrade: null
    },
    {
      id: "Seeing Red",
      name: "\u76DB\u6012",
      cost: 1,
      type: "skill",
      rarity: "uncommon",
      desc: "\u83B7\u5F97 [R] [R] \u3002 NL \u6D88\u8017 \u3002",
      effects: [
        {
          op: "gain_energy",
          value: 2
        }
      ],
      exhaust: true,
      ethereal: false,
      upgrade: {
        cost_to: 0,
        name: true
      }
    },
    {
      id: "Sentinel",
      name: "\u54E8\u536B",
      cost: 1,
      type: "skill",
      rarity: "uncommon",
      desc: "\u83B7\u5F97 !B! \u70B9 \u683C\u6321 \u3002 NL \u5982\u679C\u8FD9\u5F20\u724C\u88AB \u6D88\u8017 \uFF0C NL \u83B7\u5F97 [R] [R] \u3002",
      effects: [
        {
          op: "block",
          value: 5
        }
      ],
      exhaust: false,
      ethereal: false,
      upgrade: {
        block_delta: 3,
        name: true
      }
    },
    {
      id: "Shockwave",
      name: "\u9707\u8361\u6CE2",
      cost: 2,
      type: "skill",
      rarity: "uncommon",
      desc: "\u7ED9\u4E88\u6240\u6709\u654C\u4EBA !M! \u5C42 \u865A\u5F31 \u548C \u6613\u4F24 \u3002 NL \u6D88\u8017 \u3002",
      effects: [
        {
          op: "apply_status",
          status: "weak",
          stacks: 3
        },
        {
          op: "apply_status",
          status: "vulnerable",
          stacks: 3
        }
      ],
      exhaust: true,
      ethereal: false,
      upgrade: {
        magic_delta: 2,
        name: true
      }
    },
    {
      id: "Shrug It Off",
      name: "\u8038\u80A9\u65E0\u89C6",
      cost: 1,
      type: "skill",
      rarity: "common",
      desc: "\u83B7\u5F97 !B! \u70B9 \u683C\u6321 \u3002 NL \u62BD1\u5F20\u724C\u3002",
      effects: [
        {
          op: "block",
          value: 8
        },
        {
          op: "draw",
          value: 1
        }
      ],
      exhaust: false,
      ethereal: false,
      upgrade: {
        block_delta: 3,
        name: true
      }
    },
    {
      id: "Strike_R",
      name: "\u6253\u51FB",
      cost: 1,
      type: "attack",
      rarity: "basic",
      desc: "\u9020\u6210 !D! \u70B9\u4F24\u5BB3\u3002",
      effects: [
        {
          op: "damage",
          value: 6
        }
      ],
      exhaust: false,
      ethereal: false,
      upgrade: {
        damage_delta: 3,
        name: true
      }
    },
    {
      id: "Sword Boomerang",
      name: "\u98DE\u5251\u56DE\u65CB\u9556",
      cost: 1,
      type: "attack",
      rarity: "common",
      desc: "\u968F\u673A\u5BF9\u654C\u4EBA\u9020\u6210 !D! \u70B9\u4F24\u5BB3 !M! \u6B21\u3002",
      effects: [
        {
          op: "damage_n",
          value: 3,
          times: 3
        }
      ],
      exhaust: false,
      ethereal: false,
      upgrade: {
        magic_delta: 1,
        name: true
      }
    },
    {
      id: "Thunderclap",
      name: "\u95EA\u7535\u9739\u96F3",
      cost: 1,
      type: "attack",
      rarity: "common",
      desc: "\u5BF9\u6240\u6709\u654C\u4EBA\u9020\u6210 !D! \u70B9\u4F24\u5BB3\uFF0C\u7ED9\u4E881\u5C42 \u6613\u4F24 \u3002",
      effects: [
        {
          op: "damage_all",
          value: 4
        },
        {
          op: "apply_status",
          status: "vulnerable",
          stacks: 1
        }
      ],
      exhaust: false,
      ethereal: false,
      upgrade: {
        damage_delta: 3,
        name: true
      }
    },
    {
      id: "Twin Strike",
      name: "\u53CC\u91CD\u6253\u51FB",
      cost: 1,
      type: "attack",
      rarity: "common",
      desc: "\u9020\u6210 !D! \u70B9\u4F24\u5BB3\u4E24\u6B21\u3002",
      effects: [
        {
          op: "damage",
          value: 5
        },
        {
          op: "damage",
          value: 5
        }
      ],
      exhaust: false,
      ethereal: false,
      upgrade: {
        damage_delta: 2,
        name: true
      }
    },
    {
      id: "Uppercut",
      name: "\u4E0A\u52FE\u62F3",
      cost: 2,
      type: "attack",
      rarity: "uncommon",
      desc: "\u9020\u6210 !D! \u70B9\u4F24\u5BB3\u3002 NL \u7ED9\u4E88 !M! \u5C42 \u865A\u5F31 \u3002 NL \u7ED9\u4E88 !M! \u5C42 \u6613\u4F24 \u3002",
      effects: [
        {
          op: "damage",
          value: 13
        },
        {
          op: "apply_status",
          status: "weak",
          stacks: 1
        },
        {
          op: "apply_status",
          status: "vulnerable",
          stacks: 1
        }
      ],
      exhaust: false,
      ethereal: false,
      upgrade: {
        magic_delta: 1,
        name: true
      }
    },
    {
      id: "Wild Strike",
      name: "\u72C2\u91CE\u6253\u51FB",
      cost: 1,
      type: "attack",
      rarity: "common",
      desc: "\u9020\u6210 !D! \u70B9\u4F24\u5BB3\u3002 NL \u5C06\u4E00\u5F20 *\u4F24\u53E3 \u653E\u5165\u4F60\u7684\u62BD\u724C\u5806\u4E2D\u3002",
      effects: [
        {
          op: "damage",
          value: 12
        },
        {
          op: "add_card",
          card: "Wound",
          pile: "draw"
        }
      ],
      exhaust: false,
      ethereal: false,
      upgrade: {
        damage_delta: 5,
        name: true
      }
    }
  ]
};

// src/game/content.ts
var CARDS = starter_kit_default.cards;
var IRONCLAD_CARDS = ironclad_cards_default.cards;
var STATUS_CARDS = [
  {
    id: "Wound",
    name: "\u521B\u4F24",
    cost: -2,
    type: "status",
    rarity: "special",
    effects: [],
    desc: "\u4E0D\u80FD\u88AB\u6253\u51FA\u3002"
  },
  {
    id: "Dazed",
    name: "\u7729\u6655",
    cost: -2,
    type: "status",
    rarity: "special",
    effects: [],
    desc: "\u4E0D\u80FD\u88AB\u6253\u51FA\u3002"
  },
  {
    id: "Slimed",
    name: "\u9ECF\u6DB2",
    cost: -2,
    type: "status",
    rarity: "special",
    effects: [],
    desc: "\u4E0D\u80FD\u88AB\u6253\u51FA\u3002\uFF08\u539F\u578B\u7B80\u5316\uFF1A\u539F\u7248 1 \u8D39\u53EF\u6253\u51FA\u6D88\u8017\uFF09"
  },
  {
    id: "Burn",
    name: "\u707C\u70E7",
    cost: -2,
    type: "status",
    rarity: "special",
    effects: [],
    desc: "\u4E0D\u80FD\u88AB\u6253\u51FA\u3002"
  },
  {
    id: "Void",
    name: "\u865A\u7A7A",
    cost: -2,
    type: "status",
    rarity: "special",
    effects: [],
    desc: "\u4E0D\u80FD\u88AB\u6253\u51FA\u3002"
  }
];
var CARD_BY_ID = Object.fromEntries(
  [...CARDS, ...STATUS_CARDS, ...IRONCLAD_CARDS.filter((c) => !CARDS.some((s) => s.id === c.id))].map((c) => [c.id, c])
);
var ENEMY_DEFS = Object.fromEntries(
  starter_kit_default.enemies.map((e) => [e.id, e])
);
var BASE_DECK = [
  "Strike_R",
  "Strike_R",
  "Strike_R",
  "Strike_R",
  "Strike_R",
  "Defend_R",
  "Defend_R",
  "Defend_R",
  "Defend_R",
  "Bash"
];
var POOL_CARDS = IRONCLAD_CARDS.filter(
  (c) => c.cost >= 0 && c.rarity !== "basic" && c.rarity !== "rare"
);
var REWARD_POOL = POOL_CARDS.flatMap(
  (c) => c.rarity === "uncommon" ? [c.id] : [c.id, c.id]
);
var SHOP_POOL = POOL_CARDS.map((c) => c.id);
var MONSTER_POOL = [
  "Cultist",
  "JawWorm",
  "LouseNormal",
  "FungiBeast",
  "SlaverRed"
];

// src/game/engine.ts
var rng = Math.random;
function randInt(min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}
function log(state, text, cls) {
  state.log.push({ text, cls });
  if (state.log.length > 200) state.log.splice(0, state.log.length - 200);
}
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function tidy(statuses) {
  for (const k of Object.keys(statuses)) {
    if (statuses[k] <= 0) delete statuses[k];
  }
}
function dealDamage(state, sourceSide, sourceStatuses, targetSide, targetStatuses, baseAmount, attackType) {
  const ctx = {
    amount: Math.max(0, Math.floor(baseAmount)),
    source: { side: sourceSide, statuses: sourceStatuses },
    target: { side: targetSide, statuses: targetStatuses },
    attackType,
    state
  };
  bus.emit(EV.modifyDamageDealt, ctx);
  bus.emit(EV.modifyDamageTaken, ctx);
  ctx.amount = Math.max(0, Math.floor(ctx.amount));
  if (attackType === "attack") {
    if (targetSide === "player" && state.player.block > 0) {
      const absorbed = Math.min(state.player.block, ctx.amount);
      state.player.block -= absorbed;
      ctx.amount -= absorbed;
      if (absorbed > 0) log(state, `\u683C\u6321\u5438\u6536\u4E86 ${absorbed} \u70B9\u4F24\u5BB3\u3002`, "status");
    } else if (targetSide === "enemy") {
      const enemy = state.enemies.find((e) => e.statuses === targetStatuses);
      if (enemy && enemy.block > 0) {
        const absorbed = Math.min(enemy.block, ctx.amount);
        enemy.block -= absorbed;
        ctx.amount -= absorbed;
        if (absorbed > 0) log(state, `${enemy.name} \u7684\u683C\u6321\u5438\u6536\u4E86 ${absorbed} \u70B9\u4F24\u5BB3\u3002`, "status");
      }
    }
  }
  if (ctx.amount <= 0) return 0;
  if (targetSide === "player") {
    state.player.hp = Math.max(0, state.player.hp - ctx.amount);
  } else {
    const enemy = state.enemies.find((e) => e.statuses === targetStatuses);
    if (enemy) enemy.hp = Math.max(0, enemy.hp - ctx.amount);
  }
  bus.emit(EV.damageDealt, { amount: ctx.amount, sourceSide, targetSide });
  bus.emit(EV.hpLost, { amount: ctx.amount, targetSide });
  return ctx.amount;
}
function applyStatus(state, targetSide, targetStatuses, status, stacks) {
  targetStatuses[status] = (targetStatuses[status] ?? 0) + stacks;
  const who = targetSide === "player" ? "\u4F60" : state.enemies.find((e) => e.statuses === targetStatuses)?.name;
  log(state, `${who} \u83B7\u5F97\u4E86 ${stacks} \u5C42 ${powerName(status)}\u3002`, "status");
  bus.emit(EV.statusApplied, { targetSide, status, stacks });
  tidy(targetStatuses);
}
function draw(state, n) {
  for (let i = 0; i < n; i++) {
    if (state.hand.length >= 10) break;
    if (state.drawPile.length === 0) {
      if (state.discardPile.length === 0) break;
      state.drawPile = shuffle(state.discardPile);
      state.discardPile = [];
    }
    state.hand.push(state.drawPile.pop());
  }
}
function drawCards(state, n) {
  draw(state, n);
  if (n > 0) bus.emit(EV.drawCards, { state, count: n });
}
function resolveEffects(state, ops) {
  for (const op of ops) {
    switch (op.op) {
      case "damage":
      case "damage_all": {
        for (const enemy of state.enemies) {
          const dealt = dealDamage(
            state,
            "player",
            state.player.statuses,
            "enemy",
            enemy.statuses,
            op.value,
            "attack"
          );
          log(state, `${enemy.name} \u53D7\u5230\u4E86 ${dealt} \u70B9\u4F24\u5BB3\u3002`, "player");
        }
        break;
      }
      case "damage_n": {
        const enemy = state.enemies[0];
        if (!enemy) break;
        let total = 0;
        for (let i = 0; i < op.times; i++) {
          total += dealDamage(
            state,
            "player",
            state.player.statuses,
            "enemy",
            enemy.statuses,
            op.value,
            "attack"
          );
        }
        log(state, `${enemy.name} \u53D7\u5230\u4E86 ${total} \u70B9\u4F24\u5BB3\u3002`, "player");
        break;
      }
      case "block": {
        state.player.block += op.value;
        log(state, `\u4F60\u83B7\u5F97\u4E86 ${op.value} \u70B9\u683C\u6321\u3002`, "player");
        bus.emit(EV.blockGained, { amount: op.value, targetSide: "player" });
        break;
      }
      case "draw":
        drawCards(state, op.value);
        break;
      case "add_card":
        if (op.pile === "discard") state.discardPile.push(op.card);
        else state.drawPile.push(op.card);
        break;
      case "discard_top": {
        if (state.discardPile.length > 0) {
          const top = state.discardPile.pop();
          state.drawPile.push(top);
          log(state, "\u5C06\u5F03\u724C\u5806\u9876\u7684\u4E00\u5F20\u724C\u653E\u56DE\u4E86\u62BD\u724C\u5806\u9876\u90E8\u3002", "system");
        }
        break;
      }
      case "apply_status": {
        const enemy = state.enemies[0];
        if (enemy) applyStatus(state, "enemy", enemy.statuses, op.status, op.stacks);
        break;
      }
      case "gain_status": {
        state.player.statuses[op.status] = (state.player.statuses[op.status] ?? 0) + op.stacks;
        log(state, `\u4F60\u83B7\u5F97\u4E86 ${op.stacks} \u5C42 ${powerName(op.status)}\u3002`, "status");
        break;
      }
      case "gain_energy": {
        state.player.energy += op.value;
        bus.emit(EV.energyChanged, { state, delta: op.value });
        log(state, `\u4F60\u83B7\u5F97\u4E86 ${op.value} \u70B9\u80FD\u91CF\u3002`, "player");
        break;
      }
      case "heal": {
        const healed = Math.min(op.value, state.player.maxHp - state.player.hp);
        state.player.hp += healed;
        log(state, `\u4F60\u56DE\u590D\u4E86 ${healed} \u70B9\u751F\u547D\u3002`, "player");
        break;
      }
      case "lose_hp": {
        state.player.hp = Math.max(0, state.player.hp - op.value);
        log(state, `\u4F60\u5931\u53BB\u4E86 ${op.value} \u70B9\u751F\u547D\u3002`, "player");
        if (state.player.hp <= 0) combatEnd(state, false);
        break;
      }
    }
  }
}
function spawnEnemy(def, spec) {
  const hp = Math.round(randInt(def.hp[0], def.hp[1]) * spec.hpMult);
  return {
    id: def.id,
    name: def.name,
    hp,
    maxHp: hp,
    block: 0,
    statuses: {},
    intent: null,
    history: [],
    firstUsed: false,
    dmgMult: spec.dmgMult
  };
}
function startCombat(state, spec) {
  state.encounter = spec;
  state.phase = "combat";
  state.turn = "player";
  state.turnCount = 0;
  state.player.block = 0;
  state.player.energy = state.player.maxEnergy;
  state.drawPile = shuffle([...state.deck]);
  state.hand = [];
  state.discardPile = [];
  state.exhaustPile = [];
  state.rewards = null;
  const def = ENEMY_DEFS[spec.enemyId];
  const enemy = spawnEnemy(def, spec);
  enemy.intent = rollIntent(def, enemy, rng);
  state.enemies = [enemy];
  log(state, `\u2014\u2014 \u6218\u6597\u5F00\u59CB\uFF1A${def.name}${spec.kind === "elite" ? "\uFF08\u7CBE\u82F1\uFF09" : spec.kind === "boss" ? "\uFF08\u9996\u9886\uFF09" : ""} \u2014\u2014`, "system");
  startPlayerTurn(state);
  bus.emit(EV.combatStart, { state });
}
function startPlayerTurn(state) {
  state.turn = "player";
  state.turnCount += 1;
  state.player.block = 0;
  state.player.energy = state.player.maxEnergy;
  bus.emit(EV.turnStart, { state, side: "player", creature: { side: "player", statuses: state.player.statuses } });
  tidy(state.player.statuses);
  drawCards(state, 5);
  log(state, `\u2014\u2014 \u7B2C ${state.turnCount} \u56DE\u5408 \xB7 \u4F60\u7684\u56DE\u5408 \u2014\u2014`, "system");
}
function playCard(state, cardId) {
  if (state.phase !== "combat" || state.turn !== "player") return;
  const idx = state.hand.indexOf(cardId);
  if (idx < 0) return;
  const card = CARD_BY_ID[cardId];
  if (!card || card.cost < 0 || state.player.energy < card.cost) {
    if (card && card.cost < 0) log(state, `\u300C${card.name}\u300D\u65E0\u6CD5\u88AB\u6253\u51FA\u3002`, "status");
    return;
  }
  if ((state.player.statuses.entangled ?? 0) > 0 && card.type === "attack") {
    log(state, "\u88AB\u7F51\u7F20\u7ED5\uFF0C\u65E0\u6CD5\u6253\u51FA\u653B\u51FB\u724C\uFF01", "status");
    return;
  }
  state.player.energy -= card.cost;
  bus.emit(EV.energyChanged, { state, delta: -card.cost });
  log(state, `\u4F60\u6253\u51FA\u4E86\u300C${card.name}\u300D\u3002`, "player");
  bus.emit(EV.cardPlayed, { state, card });
  resolveEffects(state, card.effects);
  state.hand.splice(idx, 1);
  if (card.exhaust) state.exhaustPile.push(cardId);
  else state.discardPile.push(cardId);
  const alive = state.enemies.filter((e) => e.hp > 0);
  for (const dead of state.enemies.filter((e) => e.hp <= 0)) {
    log(state, `${dead.name} \u88AB\u51FB\u8D25\u4E86\uFF01`, "system");
    bus.emit(EV.enemyDeath, { state, enemy: dead });
  }
  state.enemies = alive;
  if (state.enemies.length === 0) {
    combatEnd(state, true);
  }
}
function usePotion(state, potionId) {
  if (state.phase !== "combat" || state.turn !== "player") return;
  const idx = state.potions.indexOf(potionId);
  if (idx < 0) return;
  const def = POTION_DEFS[potionId];
  if (!def) return;
  state.potions.splice(idx, 1);
  log(state, `\u4F60\u559D\u4E0B\u4E86\u300C${def.name}\u300D\u3002`, "player");
  bus.emit(EV.potionUsed, { state, potion: def });
  for (const fx of def.effects) {
    switch (fx.op) {
      case "damage": {
        const enemy = state.enemies[0];
        if (enemy) {
          const dealt = dealDamage(
            state,
            "player",
            state.player.statuses,
            "enemy",
            enemy.statuses,
            fx.value,
            "potion"
          );
          log(state, `${enemy.name} \u53D7\u5230\u4E86 ${dealt} \u70B9\u4F24\u5BB3\u3002`, "player");
        }
        break;
      }
      case "block":
        state.player.block += fx.value;
        log(state, `\u4F60\u83B7\u5F97\u4E86 ${fx.value} \u70B9\u683C\u6321\u3002`, "player");
        break;
      case "gain_status":
        state.player.statuses[fx.status] = (state.player.statuses[fx.status] ?? 0) + fx.stacks;
        log(state, `\u4F60\u83B7\u5F97\u4E86 ${fx.stacks} \u5C42 ${powerName(fx.status)}\u3002`, "status");
        break;
      case "apply_status_all":
        for (const enemy of state.enemies) {
          applyStatus(state, "enemy", enemy.statuses, fx.status, fx.stacks);
        }
        break;
    }
  }
  const alive = state.enemies.filter((e) => e.hp > 0);
  state.enemies = alive;
  if (state.enemies.length === 0) combatEnd(state, true);
}
function combatEnd(state, victory) {
  bus.emit(EV.combatEnd, { state, victory });
  if (!victory) {
    state.phase = "defeat";
    log(state, "\u4F60\u5012\u4E0B\u4E86\u2026\u2026", "system");
    return;
  }
  const gold = state.encounter?.gold ?? 0;
  state.gold += gold;
  log(state, `\u83B7\u5F97\u4E86 ${gold} \u91D1\u5E01\u3002`, "system");
  if (state.encounter && (state.encounter.kind === "elite" || state.encounter.kind === "boss")) {
    const relic = randomRelicNotOwned(state);
    if (relic) addRelic(state, relic);
  }
  if (Math.random() < 0.4) {
    grantPotion(state, randomPotion());
  }
  if (state.encounter?.kind === "boss") {
    state.phase = "victory";
    log(state, "\u4F60\u51FB\u8D25\u4E86\u9996\u9886\uFF0C\u6740\u7A7F\u4E86\u5C16\u5854\uFF01", "system");
    return;
  }
  state.rewards = shuffle([...REWARD_POOL]).slice(0, 3);
  state.phase = "reward";
  log(state, "\u6218\u6597\u80DC\u5229\uFF01\u9009\u62E9\u4E00\u5F20\u5361\u724C\u52A0\u5165\u4F60\u7684\u724C\u7EC4\u3002", "system");
}
function pickReward(state, cardId) {
  if (state.phase !== "reward" || !state.rewards?.includes(cardId)) return;
  state.deck.push(cardId);
  const card = CARD_BY_ID[cardId];
  log(state, `\u300C${card.name}\u300D\u52A0\u5165\u4E86\u4F60\u7684\u724C\u7EC4\u3002`, "system");
  state.rewards = null;
  state.phase = "map";
  log(state, "\u4F60\u56DE\u5230\u4E86\u5730\u56FE\u4E0A\uFF0C\u7EE7\u7EED\u6500\u767B\u3002", "system");
}
function endPlayerTurn(state) {
  if (state.phase !== "combat" || state.turn !== "player") return;
  state.turn = "enemy";
  bus.emit(EV.turnEnd, { state, side: "player", creature: { side: "player", statuses: state.player.statuses } });
  tidy(state.player.statuses);
  state.discardPile.push(...state.hand);
  state.hand = [];
  enemyPhase(state);
}
function enemyPhase(state) {
  for (const enemy of state.enemies) {
    enemy.block = 0;
    const ref = { side: "enemy", statuses: enemy.statuses };
    bus.emit(EV.turnStart, { state, side: "enemy", creature: ref });
    tidy(enemy.statuses);
    const intent = enemy.intent;
    if (intent) {
      const mv = intent.move;
      enemy.history.push(intent.moveId);
      log(state, `${enemy.name} \u4F7F\u7528\u4E86\u300C${moveName(enemy, intent.moveId)}\u300D\u3002`, "enemy");
      if (mv.damage) {
        const times = mv.times ?? 1;
        let total = 0;
        for (let i = 0; i < times; i++) {
          total += dealDamage(
            state,
            "enemy",
            enemy.statuses,
            "player",
            state.player.statuses,
            Math.round(mv.damage * enemy.dmgMult),
            "attack"
          );
        }
        log(state, `\u4F60\u53D7\u5230\u4E86 ${total} \u70B9\u4F24\u5BB3\u3002`, "enemy");
      }
      if (mv.block) {
        enemy.block += Math.round(mv.block * enemy.dmgMult);
        bus.emit(EV.blockGained, { amount: mv.block, targetSide: "enemy" });
      }
      if (mv.gain_strength) {
        applyStatus(state, "enemy", enemy.statuses, "strength", mv.gain_strength);
      }
      if (mv.apply_status) {
        applyStatus(state, "enemy", enemy.statuses, mv.apply_status.status, mv.apply_status.stacks);
      }
      if (mv.apply_status_player) {
        applyStatus(state, "player", state.player.statuses, mv.apply_status_player.status, mv.apply_status_player.stacks);
      }
    }
    bus.emit(EV.turnEnd, { state, side: "enemy", creature: ref });
    tidy(enemy.statuses);
    if (state.player.hp <= 0) {
      combatEnd(state, false);
      return;
    }
  }
  for (const enemy of state.enemies) {
    enemy.intent = rollIntent(ENEMY_DEFS[enemy.id], enemy, rng);
  }
  bus.emit(EV.intentChanged, { state });
  startPlayerTurn(state);
}
function moveName(enemy, moveId) {
  const labels = {
    chomp: "\u5543\u54AC",
    thrash: "\u62CD\u6253",
    bellow: "\u5486\u54EE",
    incantation: "\u541F\u5531",
    dark_strike: "\u6697\u5F71\u6253\u51FB"
  };
  return labels[moveId] ?? moveId;
}

// src/game/relics.ts
function log2(state, text) {
  state.log.push({ text, cls: "relic" });
  if (state.log.length > 200) state.log.splice(0, state.log.length - 200);
}
var RELIC_DEFS = {
  burning_blood: {
    id: "burning_blood",
    name: "\u71C3\u70E7\u4E4B\u8840",
    tier: "starter",
    desc: "\u5728\u6218\u6597\u7ED3\u675F\u65F6\uFF0C\u56DE\u590D 6 \u70B9\u751F\u547D\u3002",
    on: {
      [EV.combatEnd]: (ctx, state) => {
        if (!ctx.victory) return;
        const heal = Math.min(6, state.player.maxHp - state.player.hp);
        if (heal <= 0) return;
        state.player.hp += heal;
        log2(state, `\u71C3\u70E7\u4E4B\u8840 \u56DE\u590D\u4E86 ${heal} \u70B9\u751F\u547D\u3002`);
      }
    }
  },
  vajra: {
    id: "vajra",
    name: "\u91D1\u521A\u6775",
    tier: "common",
    desc: "\u5728\u6BCF\u573A\u6218\u6597\u5F00\u59CB\u65F6\uFF0C\u83B7\u5F97 1 \u70B9\u529B\u91CF\u3002",
    on: {
      [EV.combatStart]: (_, state) => {
        state.player.statuses.strength = (state.player.statuses.strength ?? 0) + 1;
        log2(state, "\u91D1\u521A\u6775 \u4F7F\u4F60\u83B7\u5F97 1 \u70B9\u529B\u91CF\u3002");
      }
    }
  },
  anchor: {
    id: "anchor",
    name: "\u951A",
    tier: "common",
    desc: "\u6BCF\u573A\u6218\u6597\u5F00\u59CB\u65F6\u83B7\u5F97 10 \u70B9\u683C\u6321\u3002",
    on: {
      [EV.combatStart]: (_, state) => {
        state.player.block += 10;
        log2(state, "\u951A \u4F7F\u4F60\u83B7\u5F97 10 \u70B9\u683C\u6321\u3002");
      }
    }
  },
  ink_bottle: {
    id: "ink_bottle",
    name: "\u58A8\u6C34\u74F6",
    tier: "uncommon",
    desc: "\u6BCF\u6253\u51FA 10 \u5F20\u724C\uFF0C\u62BD 1 \u5F20\u724C\u3002",
    on: {
      [EV.cardPlayed]: (_, state) => {
        state.relicCounters.ink_bottle = (state.relicCounters.ink_bottle ?? 0) + 1;
        if (state.relicCounters.ink_bottle % 10 === 0) {
          drawCards(state, 1);
          log2(state, `\u58A8\u6C34\u74F6\uFF08${state.relicCounters.ink_bottle}/10\uFF09\uFF1A\u62BD 1 \u5F20\u724C\u3002`);
        }
      }
    }
  },
  pen_nib: {
    id: "pen_nib",
    name: "\u94A2\u7B14\u5C16",
    tier: "common",
    desc: "\u4F60\u6BCF\u6253\u51FA\u7684\u7B2C 10 \u5F20\u653B\u51FB\u724C\u5C06\u4F1A\u9020\u6210\u53CC\u500D\u4F24\u5BB3\u3002",
    on: {
      [EV.cardPlayed]: (ctx, state) => {
        if (ctx.card.type !== "attack") return;
        state.relicCounters.pen_nib = (state.relicCounters.pen_nib ?? 0) + 1;
        if (state.relicCounters.pen_nib >= 10) {
          state.relicCounters.pen_nib = 0;
          state.relicCounters.pen_nib_charge = 1;
          log2(state, "\u94A2\u7B14\u5C16 \u5DF2\u5145\u80FD\uFF1A\u4E0B\u4E00\u51FB\u53CC\u500D\u4F24\u5BB3\uFF01");
        }
      },
      [EV.modifyDamageDealt]: (ctx, state) => {
        if (!state.relicCounters.pen_nib_charge) return;
        if (ctx.source.side !== "player" || ctx.attackType !== "attack") return;
        ctx.amount *= 2;
        state.relicCounters.pen_nib_charge = 0;
        log2(state, "\u94A2\u7B14\u5C16 \u89E6\u53D1\u4E86\u53CC\u500D\u4F24\u5BB3\uFF01");
      }
    }
  },
  orichalcum: {
    id: "orichalcum",
    name: "\u5965\u5229\u54C8\u94A2",
    tier: "common",
    desc: "\u5982\u679C\u4F60\u5728\u56DE\u5408\u7ED3\u675F\u65F6\u6CA1\u6709\u4EFB\u4F55\u683C\u6321\uFF0C\u83B7\u5F97 6 \u70B9\u683C\u6321\u3002",
    on: {
      [EV.turnEnd]: (ctx, state) => {
        if (ctx.side !== "player") return;
        if (state.player.block === 0) {
          state.player.block += 6;
          log2(state, "\u5965\u5229\u54C8\u94A2 \u4F7F\u4F60\u83B7\u5F97 6 \u70B9\u683C\u6321\u3002");
        }
      }
    }
  },
  blood_vial: {
    id: "blood_vial",
    name: "\u8840\u74F6",
    tier: "common",
    desc: "\u5728\u6BCF\u573A\u6218\u6597\u5F00\u59CB\u65F6\uFF0C\u56DE\u590D 2 \u70B9\u751F\u547D\u3002",
    on: {
      [EV.combatStart]: (_, state) => {
        const heal = Math.min(2, state.player.maxHp - state.player.hp);
        if (heal <= 0) return;
        state.player.hp += heal;
        log2(state, `\u8840\u74F6 \u56DE\u590D\u4E86 ${heal} \u70B9\u751F\u547D\u3002`);
      }
    }
  },
  bag_of_marbles: {
    id: "bag_of_marbles",
    name: "\u5F39\u73E0\u888B",
    tier: "common",
    desc: "\u5728\u6BCF\u573A\u6218\u6597\u5F00\u59CB\u65F6\uFF0C\u6240\u6709\u654C\u4EBA\u83B7\u5F97 1 \u5C42\u6613\u4F24\u3002",
    on: {
      [EV.combatStart]: (_, state) => {
        for (const enemy of state.enemies) {
          enemy.statuses.vulnerable = (enemy.statuses.vulnerable ?? 0) + 1;
        }
        log2(state, "\u5F39\u73E0\u888B \u4F7F\u6240\u6709\u654C\u4EBA\u83B7\u5F97 1 \u5C42\u6613\u4F24\u3002");
      }
    }
  },
  lantern: {
    id: "lantern",
    name: "\u706F\u7B3C",
    tier: "common",
    desc: "\u5728\u6BCF\u573A\u6218\u6597\u5F00\u59CB\u65F6\uFF0C\u83B7\u5F97 1 \u70B9\u80FD\u91CF\u3002",
    on: {
      [EV.combatStart]: (_, state) => {
        state.player.energy += 1;
        log2(state, "\u706F\u7B3C \u4F7F\u4F60\u83B7\u5F97 1 \u70B9\u80FD\u91CF\u3002");
      }
    }
  },
  shuriken: {
    id: "shuriken",
    name: "\u624B\u91CC\u5251",
    tier: "uncommon",
    desc: "\u4F60\u5728\u4E00\u4E2A\u56DE\u5408\u5185\u6BCF\u6253\u51FA 3 \u5F20\u653B\u51FB\u724C\uFF0C\u5C31\u83B7\u5F97 1 \u70B9\u529B\u91CF\u3002",
    on: {
      [EV.cardPlayed]: (ctx, state) => {
        if (ctx.card.type !== "attack") return;
        state.relicCounters.shuriken = (state.relicCounters.shuriken ?? 0) + 1;
        if (state.relicCounters.shuriken >= 3) {
          state.relicCounters.shuriken = 0;
          state.player.statuses.strength = (state.player.statuses.strength ?? 0) + 1;
          log2(state, "\u624B\u91CC\u5251 \u4F7F\u4F60\u83B7\u5F97 1 \u70B9\u529B\u91CF\u3002");
        }
      },
      [EV.turnStart]: (ctx, state) => {
        if (ctx.side === "player") state.relicCounters.shuriken = 0;
      }
    }
  }
};
var RELIC_POOL = [
  "vajra",
  "anchor",
  "ink_bottle",
  "pen_nib",
  "orichalcum",
  "blood_vial",
  "bag_of_marbles",
  "lantern",
  "shuriken"
];
function relicPrice(id) {
  const def = RELIC_DEFS[id];
  if (def.price) return def.price;
  const base = def.tier === "uncommon" ? 175 : 150;
  return Math.max(50, Math.round(base * (0.85 + Math.random() * 0.4) / 5) * 5);
}
function randomRelicNotOwned(state) {
  const candidates = RELIC_POOL.filter((id) => !state.relics.includes(id));
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}
function addRelic(state, id) {
  if (state.relics.includes(id)) return;
  state.relics.push(id);
  const def = RELIC_DEFS[id];
  log2(state, `\u83B7\u5F97\u4E86\u9057\u7269\u300C${def.name}\u300D\uFF1A${def.desc}`);
}
function installRelics() {
  const dispatch = (evt) => (ctx) => {
    const state = ctx.state;
    if (!state) return;
    for (const id of state.relics) {
      const hook = RELIC_DEFS[id]?.on?.[evt];
      if (hook) hook(ctx, state);
    }
  };
  for (const evt of [EV.combatStart, EV.combatEnd, EV.cardPlayed, EV.turnEnd, EV.modifyDamageDealt]) {
    bus.on(evt, 30, dispatch(evt));
  }
}

// src/game/mapGen.ts
var MAP_FLOORS = 15;
var BASE_WEIGHTS = {
  monster: 45,
  event: 22,
  elite: 8,
  shop: 5,
  rest: 12,
  treasure: 8
};
var SLOT_COUNT = 6;
function pickWeighted(items, r) {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let acc = 0;
  for (const [it, w] of items) {
    acc += w;
    if (r * total <= acc) return it;
  }
  return items[items.length - 1][0];
}
function nodeCountFor(floor2) {
  if (floor2 === 0) return 1;
  if (floor2 === MAP_FLOORS - 1) return 3;
  return 3 + Math.floor(Math.random() * 3);
}
function typeForFloor(floor2) {
  if (floor2 === 0) return "monster";
  const entries = Object.entries(BASE_WEIGHTS);
  const eligible = entries.filter(([t]) => {
    if (t === "elite") return floor2 >= 4 && floor2 < MAP_FLOORS - 1;
    return true;
  });
  return pickWeighted(eligible, Math.random());
}
function validateConstraints({ nodes, edges }) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  for (const e of edges) {
    const a = byId.get(e.from), b = byId.get(e.to);
    if (a.type === "rest" && b.type === "rest") return false;
  }
  const hasOut = new Set(edges.map((e) => e.from));
  for (const n of nodes) {
    if (n.type === "boss") continue;
    if (!hasOut.has(n.id)) return false;
    if (n.type === "elite" && n.floor < 4) return false;
    const eliteInFloor = nodes.filter((x) => x.floor === n.floor && x.type === "elite").length;
    if (eliteInFloor > 1) return false;
    const restInFloor = nodes.filter((x) => x.floor === n.floor && x.type === "rest").length;
    if (restInFloor > 1) return false;
  }
  return true;
}
function generateMap() {
  let result = generateMapOnce();
  for (let attempt = 0; attempt < 200 && !validateConstraints(result); attempt++) {
    result = generateMapOnce();
  }
  return result;
}
function generateMapOnce() {
  const nodes = [];
  const floors = [];
  for (let f = 0; f < MAP_FLOORS; f++) {
    const count = nodeCountFor(f);
    const slots = shuffle2([...Array(SLOT_COUNT).keys()]).slice(0, count).sort((a, b) => a - b);
    const row = [];
    let restPlaced = false;
    let elitePlaced = false;
    for (const slot of slots) {
      let type = typeForFloor(f);
      if (type === "elite" && elitePlaced) type = "monster";
      if (type === "rest" && (restPlaced || row.some((n) => n.type === "rest" && Math.abs(n.x - slot) === 1))) {
        type = "monster";
      }
      if (type === "rest") restPlaced = true;
      if (type === "elite") elitePlaced = true;
      const node = {
        id: `f${f}n${row.length}`,
        floor: f,
        x: slot,
        y: 0,
        // 渲染时按 floor 计算
        type
      };
      row.push(node);
    }
    nodes.push(...row);
    floors.push(row);
  }
  const boss = { id: "boss", floor: MAP_FLOORS, x: 2.5, y: 0, type: "boss" };
  nodes.push(boss);
  floors.push([boss]);
  const edges = [];
  const edgeSet = /* @__PURE__ */ new Set();
  const addEdge = (from, to, force = false) => {
    const key = `${from.id}->${to.id}`;
    if (edgeSet.has(key)) return;
    if (!force && from.type === "rest" && to.type === "rest") return;
    edgeSet.add(key);
    edges.push({ from: from.id, to: to.id });
  };
  for (let f = 0; f < floors.length - 1; f++) {
    const cur = floors[f];
    const next = floors[f + 1];
    for (const node of cur) {
      const sorted = [...next].sort((a, b) => Math.abs(a.x - node.x) - Math.abs(b.x - node.x));
      const take = 1 + (Math.random() < 0.45 ? 1 : 0);
      let added = 0;
      for (const t of sorted) {
        if (added >= take) break;
        const before = edgeSet.size;
        addEdge(node, t);
        if (edgeSet.size > before) added++;
      }
    }
  }
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const fromMap = /* @__PURE__ */ new Map();
  const toMap = /* @__PURE__ */ new Map();
  for (const e of edges) {
    ;
    (fromMap.get(e.from) ?? fromMap.set(e.from, []).get(e.from)).push(e.to);
    (toMap.get(e.to) ?? toMap.set(e.to, []).get(e.to)).push(e.from);
  }
  const reachableFromStart = (() => {
    const seen = /* @__PURE__ */ new Set([floors[0][0].id]);
    const queue = [floors[0][0].id];
    while (queue.length) {
      const cur = queue.pop();
      for (const t of fromMap.get(cur) ?? []) {
        if (!seen.has(t)) {
          seen.add(t);
          queue.push(t);
        }
      }
    }
    return seen;
  })();
  const reachesBoss = (() => {
    const seen = /* @__PURE__ */ new Set(["boss"]);
    const queue = ["boss"];
    while (queue.length) {
      const cur = queue.pop();
      for (const t of toMap.get(cur) ?? []) {
        if (!seen.has(t)) {
          seen.add(t);
          queue.push(t);
        }
      }
    }
    return seen;
  })();
  for (const node of nodes) {
    if (node.id === "boss") continue;
    if (!reachableFromStart.has(node.id) && node.floor > 0) {
      const prev = floors[node.floor - 1].filter((n) => reachableFromStart.has(n.id));
      const nonRest = prev.filter((n) => n.type !== "rest");
      const cand = nonRest.length > 0 ? nonRest : prev;
      if (cand.length) {
        const nearest = [...cand].sort((a, b) => Math.abs(a.x - node.x) - Math.abs(b.x - node.x))[0];
        addEdge(nearest, node, nonRest.length === 0);
        reachableFromStart.add(node.id);
      }
    }
    if (!reachesBoss.has(node.id) && node.floor < MAP_FLOORS) {
      const next = floors[node.floor + 1].filter((n) => reachesBoss.has(n.id));
      const nonRest = next.filter((n) => n.type !== "rest");
      const cand = nonRest.length > 0 ? nonRest : next;
      if (cand.length) {
        const nearest = [...cand].sort((a, b) => Math.abs(a.x - node.x) - Math.abs(b.x - node.x))[0];
        addEdge(node, nearest, nonRest.length === 0);
        reachesBoss.add(node.id);
      }
    }
  }
  return { nodes, edges };
}
function shuffle2(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// src/game/shop.ts
var RARITY_PRICE = {
  basic: 30,
  common: 45,
  uncommon: 68,
  rare: 99
};
function rollShopOffers(count = 3) {
  const pool = [...SHOP_POOL];
  const picks = [];
  while (picks.length < count && pool.length > 0) {
    const i = Math.floor(Math.random() * pool.length);
    picks.push(pool.splice(i, 1)[0]);
  }
  return picks.map((id) => {
    const card = CARD_BY_ID[id];
    const base = RARITY_PRICE[card.rarity] ?? 45;
    const price = Math.max(10, Math.round(base * (0.85 + Math.random() * 0.4) / 5) * 5);
    return { id, price };
  });
}
function rollRelicOffer(owned) {
  const candidates = RELIC_POOL.filter((id2) => !owned.includes(id2));
  if (candidates.length === 0) return null;
  const id = candidates[Math.floor(Math.random() * candidates.length)];
  return { id, price: relicPrice(id) };
}
function rollPotionOffer() {
  const id = POTION_POOL[Math.floor(Math.random() * POTION_POOL.length)];
  const price = Math.max(30, Math.round(60 * (0.85 + Math.random() * 0.4) / 5) * 5);
  return { id, price };
}

// src/game/events.ts
var EVENT_POOL = [
  {
    id: "wanderer",
    name: "\u6D41\u6D6A\u8005",
    text: "\u4E00\u4E2A\u8863\u886B\u8934\u891B\u7684\u6D41\u6D6A\u8005\u5750\u5728\u8DEF\u8FB9\uFF0C\u5411\u4F60\u4F38\u51FA\u624B\u3002",
    options: [
      {
        label: "\u7ED9\u4ED6 20 \u91D1\u5E01\uFF08\u83B7\u5F97\u4E00\u5F20\u968F\u673A\u5361\u724C\uFF09",
        need_gold: 20,
        effects: [{ op: "gold", value: -20 }, { op: "card" }]
      },
      { label: "\u65E0\u89C6\u4ED6\uFF0C\u7EE7\u7EED\u8D76\u8DEF", effects: [] }
    ]
  },
  {
    id: "old_well",
    name: "\u53E4\u4E95",
    text: "\u5C16\u5854\u6DF1\u5904\u7ADF\u7136\u6709\u4E00\u53E3\u53E4\u4E95\uFF0C\u4E95\u6C34\u5E7D\u6DF1\uFF0C\u5012\u6620\u7740\u4F60\u7684\u8138\u3002",
    options: [
      { label: "\u6253\u4E00\u6876\u6C34\u559D\uFF08\u56DE\u590D 10 \u70B9\u751F\u547D\uFF09", effects: [{ op: "hp", value: 10 }] },
      { label: "\u6254\u8FDB 10 \u679A\u91D1\u5E01\u8BB8\u613F\uFF08\u83B7\u5F97 25 \u91D1\u5E01\uFF09", need_gold: 10, effects: [{ op: "gold", value: 15 }] },
      { label: "\u79BB\u5F00", effects: [] }
    ]
  },
  {
    id: "shrines",
    name: "\u4E09\u5EA7\u795E\u50CF",
    text: "\u4E09\u5EA7\u795E\u50CF\u5E76\u6392\u800C\u7ACB\uFF0C\u4E00\u5EA7\u5FAE\u7B11\uFF0C\u4E00\u5EA7\u6012\u76EE\uFF0C\u4E00\u5EA7\u5782\u6CEA\u3002",
    options: [
      { label: "\u5411\u5FAE\u7B11\u7684\u795E\u50CF\u7948\u7977\uFF08\u56DE\u590D 8 \u70B9\u751F\u547D\uFF09", effects: [{ op: "hp", value: 8 }] },
      { label: "\u5411\u6012\u76EE\u7684\u795E\u50CF\u7948\u7977\uFF08\u5931\u53BB 8 \u70B9\u751F\u547D\uFF0C\u83B7\u5F97 40 \u91D1\u5E01\uFF09", effects: [{ op: "hp", value: -8 }, { op: "gold", value: 40 }] },
      { label: "\u5411\u5782\u6CEA\u7684\u795E\u50CF\u7948\u7977\uFF08\u83B7\u5F97\u4E00\u5F20\u968F\u673A\u5361\u724C\uFF09", effects: [{ op: "card" }] }
    ]
  },
  {
    id: "merchant_deal",
    name: "\u795E\u79D8\u5546\u4EBA",
    text: "\u4E00\u4E2A\u5546\u4EBA\u62E6\u4F4F\u4F60\uFF1A\u300C\u670B\u53CB\uFF0C\u6211\u770B\u4F60\u9AA8\u9ABC\u60CA\u5947\uFF0C\u505A\u4E2A\u4EA4\u6613\u5982\u4F55\uFF1F\u300D",
    options: [
      { label: "\u7528 15 \u91D1\u5E01\u6362\u4E00\u5F20\u968F\u673A\u5361\u724C", need_gold: 15, effects: [{ op: "gold", value: -15 }, { op: "card" }] },
      { label: "\u7528 8 \u70B9\u751F\u547D\u6362 35 \u91D1\u5E01", effects: [{ op: "hp", value: -8 }, { op: "gold", value: 35 }] },
      { label: "\u5A49\u62D2", effects: [] }
    ]
  }
];
function pickEvent() {
  return EVENT_POOL[Math.floor(Math.random() * EVENT_POOL.length)];
}

// src/game/run.ts
function log3(state, text, cls = "system") {
  state.log.push({ text, cls });
  if (state.log.length > 200) state.log.splice(0, state.log.length - 200);
}
function rollGold(floor2, kind) {
  if (kind === "boss") return 100;
  const base = Math.round((12 + floor2 * 3) * (0.9 + Math.random() * 0.3));
  return kind === "elite" ? Math.round(base * 1.8) : base;
}
function randomCard() {
  return REWARD_POOL[Math.floor(Math.random() * REWARD_POOL.length)];
}
function newRun() {
  const map = generateMap();
  const start = map.nodes.find((n) => n.floor === 0);
  const state = {
    phase: "map",
    turn: "player",
    turnCount: 0,
    encounter: null,
    floor: 0,
    gold: 99,
    // 起始金币（与原版一致）
    player: { hp: 80, maxHp: 80, block: 0, energy: 3, maxEnergy: 3, statuses: {} },
    deck: [...BASE_DECK],
    drawPile: [],
    hand: [],
    discardPile: [],
    exhaustPile: [],
    enemies: [],
    rewards: null,
    map: { nodes: map.nodes, edges: map.edges, currentId: start.id, visited: [start.id] },
    shop: null,
    event: null,
    modalText: null,
    relics: ["burning_blood"],
    // 铁甲战士起始遗物
    relicCounters: {},
    potions: [],
    log: []
  };
  log3(state, `\u2014\u2014 \u65B0\u7684\u6500\u767B\u5F00\u59CB\u4E86\uFF1A\u5171 ${MAP_FLOORS} \u5C42 + \u9996\u9886 \u2014\u2014`);
  return state;
}
function advance(state, node) {
  state.map.currentId = node.id;
  if (!state.map.visited.includes(node.id)) state.map.visited.push(node.id);
  state.floor = node.floor;
}
function enterNode(state, nodeId) {
  if (state.phase !== "map") return;
  const cur = state.map.nodes.find((n) => n.id === state.map.currentId);
  const node = state.map.nodes.find((n) => n.id === nodeId);
  if (!node) return;
  const connected = state.map.edges.some((e) => e.from === cur.id && e.to === nodeId);
  if (node.floor !== cur.floor + 1 || !connected) return;
  advance(state, node);
  switch (node.type) {
    case "monster": {
      const spec = {
        enemyId: MONSTER_POOL[Math.floor(Math.random() * MONSTER_POOL.length)],
        hpMult: 1 + 0.08 * (node.floor - 1),
        dmgMult: 1,
        kind: "monster",
        gold: rollGold(node.floor, "monster")
      };
      startCombat(state, spec);
      break;
    }
    case "elite": {
      const spec = {
        enemyId: MONSTER_POOL[Math.floor(Math.random() * MONSTER_POOL.length)],
        hpMult: 1.5 + 0.08 * (node.floor - 1),
        dmgMult: 1.1,
        kind: "elite",
        gold: rollGold(node.floor, "elite")
      };
      startCombat(state, spec);
      break;
    }
    case "boss":
      startCombat(state, {
        enemyId: "TheSpireGuardian",
        hpMult: 1,
        dmgMult: 1,
        kind: "boss",
        gold: rollGold(node.floor, "boss")
      });
      break;
    case "rest": {
      const heal = Math.min(24, state.player.maxHp - state.player.hp);
      state.player.hp += heal;
      state.modalText = `\u4F60\u5728\u8425\u706B\u65C1\u4F11\u606F\uFF0C\u56DE\u590D\u4E86 ${heal} \u70B9\u751F\u547D\u3002`;
      log3(state, `\u8425\u706B\uFF1A\u56DE\u590D\u4E86 ${heal} \u70B9\u751F\u547D\u3002`);
      state.phase = "rest";
      break;
    }
    case "treasure": {
      const cardId = randomCard();
      state.deck.push(cardId);
      state.modalText = `\u4F60\u6253\u5F00\u5B9D\u7BB1\uFF0C\u83B7\u5F97\u4E86\u300C${CARD_BY_ID[cardId].name}\u300D\uFF01`;
      log3(state, `\u5B9D\u7BB1\uFF1A\u83B7\u5F97\u300C${CARD_BY_ID[cardId].name}\u300D\u3002`);
      state.phase = "treasure";
      break;
    }
    case "shop": {
      state.shop = {
        cards: rollShopOffers(3),
        relic: rollRelicOffer(state.relics),
        potion: rollPotionOffer()
      };
      state.phase = "shop";
      log3(state, "\u4F60\u8D70\u8FDB\u4E86\u5546\u5E97\u3002");
      break;
    }
    case "event": {
      state.event = { event: pickEvent() };
      state.phase = "event";
      log3(state, "\u4F60\u9047\u5230\u4E86\u4E00\u4E2A\u4E8B\u4EF6\u3002");
      break;
    }
  }
}
function closeOverlay(state) {
  if (state.phase === "rest" || state.phase === "treasure") {
    state.modalText = null;
    state.phase = "map";
  }
}
function buyCard(state, cardId) {
  if (state.phase !== "shop" || !state.shop) return;
  const offer = state.shop.cards.find((o) => o.id === cardId);
  if (!offer || state.gold < offer.price) return;
  state.gold -= offer.price;
  state.deck.push(cardId);
  state.shop.cards = state.shop.cards.filter((o) => o.id !== cardId);
  log3(state, `\u8D2D\u4E70\u4E86\u300C${CARD_BY_ID[cardId].name}\u300D\uFF08-${offer.price} \u91D1\u5E01\uFF09\u3002`);
}
function buyRelic(state) {
  if (state.phase !== "shop" || !state.shop?.relic) return;
  const offer = state.shop.relic;
  if (state.gold < offer.price) return;
  state.gold -= offer.price;
  addRelic(state, offer.id);
  state.shop.relic = null;
  log3(state, `\u8D2D\u4E70\u4E86\u9057\u7269\uFF08-${offer.price} \u91D1\u5E01\uFF09\u3002`);
}
function buyPotion(state) {
  if (state.phase !== "shop" || !state.shop?.potion) return;
  const offer = state.shop.potion;
  if (state.gold < offer.price) return;
  state.gold -= offer.price;
  grantPotion(state, offer.id);
  state.shop.potion = null;
  log3(state, `\u8D2D\u4E70\u4E86\u836F\u6C34\uFF08-${offer.price} \u91D1\u5E01\uFF09\u3002`);
}
function leaveShop(state) {
  state.shop = null;
  state.phase = "map";
}
function pickEventOption(state, index) {
  if (state.phase !== "event" || !state.event) return;
  const opt = state.event.event.options[index];
  if (!opt) return;
  if (opt.need_gold && state.gold < opt.need_gold) return;
  for (const fx of opt.effects) {
    switch (fx.op) {
      case "hp":
        state.player.hp = Math.min(state.player.maxHp, Math.max(0, state.player.hp + fx.value));
        log3(state, `\u751F\u547D ${fx.value >= 0 ? "+" : ""}${fx.value}\uFF08\u5F53\u524D ${state.player.hp}\uFF09\u3002`);
        break;
      case "gold":
        state.gold = Math.max(0, state.gold + fx.value);
        log3(state, `\u91D1\u5E01 ${fx.value >= 0 ? "+" : ""}${fx.value}\uFF08\u5F53\u524D ${state.gold}\uFF09\u3002`);
        break;
      case "card": {
        const cardId = randomCard();
        state.deck.push(cardId);
        log3(state, `\u83B7\u5F97\u300C${CARD_BY_ID[cardId].name}\u300D\u3002`);
        break;
      }
    }
  }
  state.event = null;
  if (state.player.hp <= 0) {
    state.phase = "defeat";
    log3(state, "\u4F60\u5012\u4E0B\u4E86\u2026\u2026", "system");
    return;
  }
  state.phase = "map";
}

// src/game/save.ts
var SAVE_KEY = "sts-web:save";
var SAVE_VERSION = 1;
var memStore = /* @__PURE__ */ new Map();
var storage = typeof localStorage !== "undefined" ? localStorage : {
  getItem: (k) => memStore.get(k) ?? null,
  setItem: (k, v) => {
    memStore.set(k, v);
  },
  removeItem: (k) => {
    memStore.delete(k);
  }
};
function serializeSave(state) {
  const file = { version: SAVE_VERSION, savedAt: (/* @__PURE__ */ new Date()).toISOString(), state };
  return JSON.stringify(file);
}
function validateState(s) {
  if (typeof s !== "object" || s === null) return false;
  const o = s;
  const p = o.player;
  const m = o.map;
  return typeof o.phase === "string" && typeof p === "object" && p !== null && typeof p.hp === "number" && typeof m === "object" && m !== null && Array.isArray(m.nodes) && Array.isArray(m.edges) && Array.isArray(o.deck) && Array.isArray(o.potions) && Array.isArray(o.relics) && Array.isArray(o.log);
}
function parseSave(text) {
  try {
    const file = JSON.parse(text);
    if (file.version !== SAVE_VERSION) return null;
    if (!validateState(file.state)) return null;
    if (!Array.isArray(file.state.exhaustPile)) file.state.exhaustPile = [];
    return file.state;
  } catch {
    return null;
  }
}
function saveGame(state) {
  try {
    storage.setItem(SAVE_KEY, serializeSave(state));
  } catch (e) {
    console.warn("\u81EA\u52A8\u5B58\u6863\u5931\u8D25\uFF08\u5B58\u50A8\u4E0D\u53EF\u7528\u6216\u5DF2\u6EE1\uFF09", e);
  }
}
function loadGame() {
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (!raw) return null;
    const state = parseSave(raw);
    if (!state) {
      storage.removeItem(SAVE_KEY);
      return null;
    }
    return state;
  } catch {
    return null;
  }
}
function clearSave() {
  try {
    storage.removeItem(SAVE_KEY);
  } catch {
  }
}

// src/game/pileView.ts
var RARITY_ORDER = ["common", "uncommon", "rare", "basic", "special", "status", "curse"];
function shuffle3(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function buildDrawPileGroups(drawPile) {
  const groups = /* @__PURE__ */ new Map();
  for (const id of drawPile) {
    const r = CARD_BY_ID[id]?.rarity ?? "special";
    (groups.get(r) ?? groups.set(r, []).get(r)).push(id);
  }
  const out = [];
  for (const r of RARITY_ORDER) {
    const g = groups.get(r);
    if (g) out.push({ rarity: r, cards: shuffle3(g) });
  }
  for (const r of [...groups.keys()].sort()) {
    if (!RARITY_ORDER.includes(r)) out.push({ rarity: r, cards: shuffle3(groups.get(r)) });
  }
  return out;
}
function buildDeckSummary(piles) {
  const counts = /* @__PURE__ */ new Map();
  for (const id of [...piles.draw, ...piles.hand, ...piles.discard, ...piles.exhaust]) {
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return [...counts.entries()].map(([id, count]) => ({ id, count })).sort((a, b) => CARD_BY_ID[a.id].name.localeCompare(CARD_BY_ID[b.id].name, "zh"));
}

// test-smoke.ts
installPowerSystem();
installRelics();
var failures = 0;
function assert(cond, msg) {
  if (!cond) {
    failures++;
    console.error("  \u2717 FAIL:", msg);
  } else {
    console.log("  \u2713", msg);
  }
}
function combatState(enemyId = "Cultist") {
  const s = newRun();
  startCombat(s, { enemyId, hpMult: 1, dmgMult: 1, kind: "monster", gold: 0 });
  return s;
}
{
  const s = combatState();
  const enemy = s.enemies[0];
  const hpBefore = enemy.hp;
  s.hand = ["Bash", "Strike_R", "Defend_R"];
  s.player.energy = 3;
  playCard(s, "Bash");
  assert(enemy.statuses.vulnerable === 2, `\u75DB\u51FB\u65BD\u52A0 2 \u5C42\u6613\u4F24\uFF08\u5B9E\u9645 ${enemy.statuses.vulnerable}\uFF09`);
  assert(hpBefore - enemy.hp === 8, `\u75DB\u51FB\u9020\u6210 8 \u70B9\u4F24\u5BB3\uFF08\u5B9E\u9645 ${hpBefore - enemy.hp}\uFF09`);
}
{
  const s = combatState();
  const enemy = s.enemies[0];
  enemy.statuses.vulnerable = 2;
  const hpBefore = enemy.hp;
  s.hand = ["Strike_R"];
  s.player.energy = 3;
  playCard(s, "Strike_R");
  assert(hpBefore - enemy.hp === 9, `\u6613\u4F24\u4E0B\u6253\u51FB\u9020\u6210 9 \u70B9\u4F24\u5BB3\uFF08\u5B9E\u9645 ${hpBefore - enemy.hp}\uFF09`);
}
{
  const s = combatState();
  const enemy = s.enemies[0];
  s.hand = [];
  s.turn = "player";
  endPlayerTurn(s);
  assert(enemy.statuses.ritual === 3, `\u541F\u5531\u540E\u4EEA\u5F0F 3 \u5C42\uFF08\u5B9E\u9645 ${enemy.statuses.ritual}\uFF09`);
  endPlayerTurn(s);
  assert((enemy.statuses.strength ?? 0) === 3, `\u4EEA\u5F0F\u8F6C 3 \u5C42\u529B\u91CF\uFF08\u5B9E\u9645 ${enemy.statuses.strength}\uFF09`);
  assert(80 - s.player.hp === 9, `\u6697\u5F71\u6253\u51FB 6+3 = 9 \u4F24\u5BB3\uFF08\u5B9E\u9645 ${80 - s.player.hp}\uFF09`);
}
{
  const s = combatState();
  s.player.hp = 1;
  s.hand = [];
  s.turn = "player";
  endPlayerTurn(s);
  endPlayerTurn(s);
  assert(s.phase === "defeat", `\u6218\u8D25\u8DEF\u5F84\uFF08\u5B9E\u9645 ${s.phase}\uFF09`);
}
{
  const s = combatState();
  s.player.hp = 50;
  s.enemies[0].hp = 1;
  s.hand = ["Strike_R"];
  s.player.energy = 3;
  playCard(s, "Strike_R");
  assert(s.phase === "reward", `\u51FB\u6740\u8FDB\u5165\u5956\u52B1\uFF08\u5B9E\u9645 ${s.phase}\uFF09`);
  assert(s.player.hp === 56, `\u71C3\u70E7\u4E4B\u8840\u56DE\u590D 6\uFF08\u5B9E\u9645 ${s.player.hp}\uFF09`);
  assert(s.gold === 99 + (s.encounter?.gold ?? 0), "\u91D1\u5E01\u7ED3\u7B97");
  const deckBefore = s.deck.length;
  pickReward(s, s.rewards[0]);
  assert(s.phase === "map" && s.deck.length === deckBefore + 1, "\u9009\u5B8C\u5956\u52B1\u56DE\u5230\u5730\u56FE\u4E14\u724C\u7EC4 +1");
}
{
  const s = newRun();
  startCombat(s, { enemyId: "TheSpireGuardian", hpMult: 1, dmgMult: 1, kind: "boss", gold: 100 });
  s.enemies[0].hp = 1;
  s.hand = ["Strike_R"];
  s.player.energy = 3;
  playCard(s, "Strike_R");
  assert(s.phase === "victory", `\u51FB\u6740\u9996\u9886 \u2192 \u901A\u5173\uFF08\u5B9E\u9645 ${s.phase}\uFF09`);
}
{
  let ok = true;
  const problems = [];
  for (let i = 0; i < 300; i++) {
    const { nodes, edges } = generateMap();
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const floors = new Set(nodes.map((n) => n.floor));
    const start = nodes.find((n) => n.floor === 0);
    if (nodes.filter((n) => n.floor === 0).length !== 1 || start.type !== "monster") {
      problems.push(`\u8D77\u70B9\u5C42\u5F02\u5E38 @${i}`);
      ok = false;
      break;
    }
    if (nodes.filter((n) => n.type === "boss").length !== 1) {
      problems.push(`\u9996\u9886\u6570\u91CF\u5F02\u5E38 @${i}`);
      ok = false;
      break;
    }
    for (let f = 0; f <= MAP_FLOORS; f++) {
      if (!floors.has(f)) {
        problems.push(`\u7F3A\u7B2C ${f} \u5C42 @${i}`);
        ok = false;
        break;
      }
    }
    const seen = /* @__PURE__ */ new Set([start.id]);
    const queue = [start.id];
    while (queue.length) {
      const cur = queue.pop();
      for (const e of edges) {
        if (e.from === cur && !seen.has(e.to)) {
          seen.add(e.to);
          queue.push(e.to);
        }
      }
    }
    if (seen.size !== nodes.length) {
      problems.push(`\u5B64\u5C9B\u8282\u70B9 @${i}: ${nodes.filter((n) => !seen.has(n.id)).map((n) => n.id).join(",")}`);
      ok = false;
      break;
    }
    const back = /* @__PURE__ */ new Set(["boss"]);
    const q2 = ["boss"];
    while (q2.length) {
      const cur = q2.pop();
      for (const e of edges) {
        if (e.to === cur && !back.has(e.from)) {
          back.add(e.from);
          q2.push(e.from);
        }
      }
    }
    if (back.size !== nodes.length) {
      problems.push(`\u5230\u4E0D\u4E86\u9996\u9886\u7684\u8282\u70B9 @${i}`);
      ok = false;
      break;
    }
    for (const n of nodes) {
      if (n.type === "elite" && n.floor < 4) {
        problems.push(`\u7CBE\u82F1\u51FA\u73B0\u5728\u7B2C ${n.floor + 1} \u5C42 @${i}`);
        ok = false;
      }
      const eliteInFloor = nodes.filter((x) => x.floor === n.floor && x.type === "elite").length;
      if (eliteInFloor > 1) {
        problems.push(`\u4E00\u5C42\u591A\u4E2A\u7CBE\u82F1 @${i}`);
        ok = false;
      }
      const restInFloor = nodes.filter((x) => x.floor === n.floor && x.type === "rest").length;
      if (restInFloor > 1) {
        problems.push(`\u4E00\u5C42\u591A\u4E2A\u8425\u706B @${i}`);
        ok = false;
      }
    }
    for (const e of edges) {
      const a = byId.get(e.from), b = byId.get(e.to);
      if (a.type === "rest" && b.type === "rest") {
        problems.push(`\u8425\u706B\u8FDE\u8425\u706B @${i}`);
        ok = false;
      }
    }
    if (!ok) break;
  }
  assert(ok, `300 \u5F20\u5730\u56FE\u5168\u90E8\u901A\u8FC7\u9A8C\u8BC1${problems.length ? `\uFF1A${problems[0]}` : ""}`);
}
function fakeNode(s, type) {
  const cur = s.map.nodes.find((n) => n.id === s.map.currentId);
  const node = { id: `fake-${type}`, floor: cur.floor + 1, x: 0, y: 0, type };
  s.map.nodes.push(node);
  s.map.edges.push({ from: cur.id, to: node.id });
  return node.id;
}
{
  const s = newRun();
  s.player.hp = 20;
  const id = fakeNode(s, "rest");
  enterNode(s, id);
  assert(s.player.hp === 44, `\u8425\u706B\u56DE\u590D 24 \u70B9\uFF08\u5B9E\u9645 ${s.player.hp}\uFF09`);
  assert(s.phase === "rest", "\u8425\u706B\u5F39\u7A97\u9636\u6BB5");
  closeOverlay(s);
  assert(s.phase === "map", "\u5173\u95ED\u8425\u706B\u5F39\u7A97\u56DE\u5230\u5730\u56FE");
}
{
  const s = newRun();
  const deckBefore = s.deck.length;
  enterNode(s, fakeNode(s, "treasure"));
  assert(s.deck.length === deckBefore + 1, "\u5B9D\u7BB1\u83B7\u5F97\u4E00\u5F20\u5361");
  closeOverlay(s);
  assert(s.phase === "map", "\u5173\u95ED\u5B9D\u7BB1\u5F39\u7A97\u56DE\u5230\u5730\u56FE");
}
{
  const s = newRun();
  enterNode(s, fakeNode(s, "shop"));
  assert(s.phase === "shop" && s.shop.cards.length === 3, "\u5546\u5E97\u4E0A\u67B6 3 \u4EF6\u5361\u724C\u5546\u54C1");
  const offer = s.shop.cards[0];
  const goldBefore = s.gold;
  buyCard(s, offer.id);
  assert(s.gold === goldBefore - offer.price, `\u8D2D\u4E70\u6263\u6B3E\uFF08-${offer.price}\uFF09`);
  assert(s.deck.length === 11 && s.shop.cards.length === 2, "\u8D2D\u4E70\u540E\u5165\u724C\u7EC4\u4E14\u5546\u54C1\u4E0B\u67B6");
  leaveShop(s);
  assert(s.phase === "map", "\u79BB\u5F00\u5546\u5E97\u56DE\u5230\u5730\u56FE");
}
{
  const s = newRun();
  enterNode(s, fakeNode(s, "event"));
  assert(s.phase === "event" && s.event !== null, "\u8FDB\u5165\u4E8B\u4EF6\u9636\u6BB5");
  pickEventOption(s, 0);
  assert(s.phase === "map", "\u4E8B\u4EF6\u9009\u9879\u7ED3\u7B97\u540E\u56DE\u5230\u5730\u56FE");
}
{
  const s = newRun();
  s.gold = 10;
  enterNode(s, fakeNode(s, "event"));
  const opt = s.event.event.options[0];
  if (opt.need_gold && opt.need_gold > s.gold) {
    pickEventOption(s, 0);
    assert(s.phase === "event", "\u91D1\u5E01\u4E0D\u8DB3\u65F6\u9009\u9879\u88AB\u62D2\u7EDD");
  }
  closeOverlay(s);
}
{
  const s = newRun();
  s.relics.push("vajra");
  startCombat(s, { enemyId: "Cultist", hpMult: 1, dmgMult: 1, kind: "monster", gold: 0 });
  assert((s.player.statuses.strength ?? 0) === 1, "\u91D1\u521A\u6775\uFF1A\u5F00\u5C40 +1 \u529B\u91CF");
}
{
  const s = newRun();
  s.relics.push("anchor");
  startCombat(s, { enemyId: "Cultist", hpMult: 1, dmgMult: 1, kind: "monster", gold: 0 });
  assert(s.player.block === 10, "\u951A\uFF1A\u5F00\u5C40 +10 \u683C\u6321\uFF08\u5728\u56DE\u5408\u91CD\u7F6E\u4E4B\u540E\u751F\u6548\uFF09");
}
{
  const s = newRun();
  s.relics.push("orichalcum");
  startCombat(s, { enemyId: "Cultist", hpMult: 1, dmgMult: 1, kind: "monster", gold: 0 });
  const enemy = s.enemies[0];
  enemy.firstUsed = true;
  enemy.intent = { moveId: "dark_strike", move: { type: "attack", damage: 6 } };
  s.hand = [];
  s.turn = "player";
  endPlayerTurn(s);
  assert(s.player.hp === 80, "\u5965\u5229\u54C8\u94A2\uFF1A\u56DE\u5408\u7ED3\u675F\u65E0\u683C\u6321\u65F6 +6\uFF0C\u5B8C\u5168\u6321\u4F4F 6 \u70B9\u653B\u51FB");
}
{
  const s = newRun();
  s.relics.push("ink_bottle");
  s.relicCounters.ink_bottle = 9;
  startCombat(s, { enemyId: "Cultist", hpMult: 1, dmgMult: 1, kind: "monster", gold: 0 });
  s.hand = ["Strike_R"];
  s.player.energy = 3;
  playCard(s, "Strike_R");
  assert(s.hand.length === 1, "\u58A8\u6C34\u74F6\uFF1A\u7B2C 10 \u5F20\u724C\u62BD 1");
}
{
  const s = newRun();
  s.relics.push("pen_nib");
  s.relicCounters.pen_nib = 9;
  startCombat(s, { enemyId: "Cultist", hpMult: 1, dmgMult: 1, kind: "monster", gold: 0 });
  const enemy = s.enemies[0];
  const hpBefore = enemy.hp;
  s.hand = ["Strike_R"];
  s.player.energy = 3;
  playCard(s, "Strike_R");
  assert(hpBefore - enemy.hp === 12, `\u94A2\u7B14\u5C16\uFF1A\u7B2C 10 \u5F20\u653B\u51FB\u724C\u53CC\u500D\u4F24\u5BB3\uFF08\u5B9E\u9645 ${hpBefore - enemy.hp}\uFF09`);
}
{
  const s = newRun();
  startCombat(s, { enemyId: "Cultist", hpMult: 1.5, dmgMult: 1.1, kind: "elite", gold: 40 });
  s.enemies[0].hp = 1;
  s.hand = ["Strike_R"];
  s.player.energy = 3;
  playCard(s, "Strike_R");
  assert(s.phase === "reward" && s.relics.length === 2, `\u7CBE\u82F1\u6389\u843D\u9057\u7269\uFF08\u73B0\u6709 ${s.relics.join(",")}\uFF09`);
}
{
  const s = newRun();
  s.gold = 500;
  enterNode(s, fakeNode(s, "shop"));
  assert(s.shop.relic !== null, "\u5546\u5E97\u6709\u9057\u7269\u8D27\u67B6");
  const price = s.shop.relic.price;
  buyRelic(s);
  assert(s.relics.length === 2, `\u8D2D\u4E70\u9057\u7269\u6210\u529F\uFF08\u73B0\u6709 ${s.relics.join(",")}\uFF09`);
  assert(s.gold === 500 - price, "\u9057\u7269\u6263\u6B3E\u6B63\u786E");
  assert(s.shop.relic === null, "\u9057\u7269\u552E\u51FA\u540E\u4E0B\u67B6");
}
{
  const s = newRun();
  startCombat(s, { enemyId: "Cultist", hpMult: 1, dmgMult: 1, kind: "monster", gold: 0 });
  const enemy = s.enemies[0];
  enemy.statuses.vulnerable = 2;
  s.player.statuses.strength = 5;
  s.potions = ["fire_potion"];
  const hpBefore = enemy.hp;
  usePotion(s, "fire_potion");
  assert(hpBefore - enemy.hp === 20, `\u706B\u7130\u836F\u6C34 20 \u76F4\u4F24\uFF0C\u65E0\u89C6\u529B\u91CF/\u6613\u4F24\uFF08\u5B9E\u9645 ${hpBefore - enemy.hp}\uFF09`);
  assert(s.potions.length === 0, "\u836F\u6C34\u7528\u540E\u6D88\u8017");
}
{
  const s = newRun();
  startCombat(s, { enemyId: "Cultist", hpMult: 1, dmgMult: 1, kind: "monster", gold: 0 });
  s.potions = ["block_potion"];
  usePotion(s, "block_potion");
  assert(s.player.block === 12, "\u683C\u6321\u836F\u6C34 +12 \u683C\u6321");
}
{
  const s = newRun();
  startCombat(s, { enemyId: "Cultist", hpMult: 1, dmgMult: 1, kind: "monster", gold: 0 });
  s.potions = ["strength_potion"];
  usePotion(s, "strength_potion");
  assert((s.player.statuses.strength ?? 0) === 2, "\u529B\u91CF\u836F\u6C34 +2 \u529B\u91CF");
}
{
  const s = newRun();
  startCombat(s, { enemyId: "Cultist", hpMult: 1, dmgMult: 1, kind: "monster", gold: 0 });
  s.potions = ["weaken_potion"];
  usePotion(s, "weaken_potion");
  assert(s.enemies[0].statuses.weak === 3, "\u865A\u5F31\u836F\u6C34\u7ED9\u6240\u6709\u654C\u4EBA 3 \u5C42\u865A\u5F31");
}
{
  const s = newRun();
  startCombat(s, { enemyId: "Cultist", hpMult: 1, dmgMult: 1, kind: "monster", gold: 0 });
  s.potions = ["fire_potion"];
  s.turn = "enemy";
  usePotion(s, "fire_potion");
  assert(s.potions.length === 1, "\u654C\u4EBA\u56DE\u5408\u4E0D\u80FD\u7528\u836F\u6C34");
}
{
  const s = newRun();
  for (const id of ["fire_potion", "block_potion", "strength_potion", "weaken_potion"]) {
    grantPotion(s, id);
  }
  assert(s.potions.length === 3, "\u836F\u6C34\u69FD\u4E0A\u9650 3");
}
{
  const s = newRun();
  startCombat(s, { enemyId: "Cultist", hpMult: 1, dmgMult: 1, kind: "monster", gold: 0 });
  s.enemies[0].hp = 15;
  s.potions = ["fire_potion"];
  usePotion(s, "fire_potion");
  assert(s.phase === "reward", "\u836F\u6C34\u51FB\u6740\u4E5F\u80FD\u7ED3\u7B97\u80DC\u5229");
}
{
  const s = newRun();
  s.gold = 500;
  enterNode(s, fakeNode(s, "shop"));
  assert(s.shop.potion !== null, "\u5546\u5E97\u6709\u836F\u6C34\u8D27\u67B6");
  const price = s.shop.potion.price;
  buyPotion(s);
  assert(s.potions.length === 1, `\u8D2D\u4E70\u836F\u6C34\u6210\u529F\uFF08${s.potions[0]}\uFF09`);
  assert(s.gold === 500 - price, "\u836F\u6C34\u6263\u6B3E\u6B63\u786E");
}
{
  clearSave();
  assert(loadGame() === null, "\u65E0\u5B58\u6863\u65F6\u8FD4\u56DE null");
  const s = newRun();
  s.gold = 321;
  saveGame(s);
  const loaded = loadGame();
  assert(loaded !== null && loaded.gold === 321, "\u5B58\u8BFB\u6863\u5F80\u8FD4\u4E00\u81F4");
  assert(loaded.map.currentId === s.map.currentId && loaded.floor === s.floor, "\u5730\u56FE\u8FDB\u5EA6\u4FDD\u7559");
  assert(loaded.relics.join(",") === s.relics.join(","), "\u9057\u7269\u4FDD\u7559");
}
{
  assert(parseSave("not json") === null, "\u975E JSON \u5B58\u6863\u88AB\u62D2\u7EDD");
  assert(parseSave(JSON.stringify({ version: 99, state: {} })) === null, "\u7248\u672C\u4E0D\u7B26\u88AB\u62D2\u7EDD");
  assert(parseSave(JSON.stringify({ version: 1, state: { nope: true } })) === null, "\u7ED3\u6784\u6821\u9A8C\u62D2\u7EDD");
  assert(validateState(newRun()) === true, "\u5408\u6CD5\u72B6\u6001\u901A\u8FC7\u6821\u9A8C");
  clearSave();
  saveGame(newRun());
  assert(loadGame() !== null, "\u6E05\u6863\u540E\u53EF\u91CD\u65B0\u5B58\u6863");
}
{
  const s = newRun();
  s.player.hp = 55;
  const text = serializeSave(s);
  const back = parseSave(text);
  assert(back.player.hp === 55 && back.deck.length === 10, "\u5BFC\u51FA JSON \u5B57\u7B26\u4E32\u53EF\u91CD\u65B0\u5BFC\u5165");
}
{
  const all = Object.values(CARD_BY_ID).filter((c) => c.cost >= 0);
  const noop = [];
  for (const card of all) {
    const s = newRun();
    startCombat(s, { enemyId: "Cultist", hpMult: 1, dmgMult: 1, kind: "monster", gold: 0 });
    s.hand = [card.id];
    s.player.energy = 99;
    const snap = () => JSON.stringify({
      ehp: s.enemies[0].hp,
      block: s.player.block,
      hp: s.player.hp,
      energy: s.player.energy,
      hand: s.hand.length,
      draw: s.drawPile.length,
      discard: s.discardPile.length,
      est: s.enemies[0].statuses,
      pst: s.player.statuses
    });
    const before = snap();
    playCard(s, card.id);
    if (snap() === before) noop.push(card.id);
  }
  assert(noop.length === 0, `\u5168\u90E8 ${all.length} \u5F20\u5361\u6253\u51FA\u90FD\u6709\u5B9E\u9645\u6548\u679C${noop.length ? `\uFF08\u65E0\u6548\u679C: ${noop.join(",")}\uFF09` : ""}`);
}
{
  const s = newRun();
  s.player.hp = 60;
  s.relics.push("blood_vial");
  startCombat(s, { enemyId: "Cultist", hpMult: 1, dmgMult: 1, kind: "monster", gold: 0 });
  assert(s.player.hp === 62, "\u8840\u74F6\uFF1A\u5F00\u5C40\u56DE 2");
}
{
  const s = newRun();
  s.relics.push("bag_of_marbles");
  startCombat(s, { enemyId: "Cultist", hpMult: 1, dmgMult: 1, kind: "monster", gold: 0 });
  assert(s.enemies[0].statuses.vulnerable === 1, "\u5F39\u73E0\u888B\uFF1A\u654C\u4EBA\u5F00\u5C40 1 \u6613\u4F24");
}
{
  const s = newRun();
  s.relics.push("lantern");
  startCombat(s, { enemyId: "Cultist", hpMult: 1, dmgMult: 1, kind: "monster", gold: 0 });
  assert(s.player.energy === 4, "\u706F\u7B3C\uFF1A\u5F00\u5C40 +1 \u80FD\u91CF");
}
{
  const s = newRun();
  s.relics.push("shuriken");
  startCombat(s, { enemyId: "Cultist", hpMult: 1, dmgMult: 1, kind: "monster", gold: 0 });
  s.hand = ["Strike_R", "Strike_R", "Strike_R"];
  s.player.energy = 99;
  playCard(s, "Strike_R");
  playCard(s, "Strike_R");
  assert((s.player.statuses.strength ?? 0) === 0, "\u624B\u91CC\u5251\uFF1A2 \u5F20\u653B\u51FB\u4E0D\u89E6\u53D1");
  playCard(s, "Strike_R");
  assert((s.player.statuses.strength ?? 0) === 1, "\u624B\u91CC\u5251\uFF1A\u7B2C 3 \u5F20\u653B\u51FB +1 \u529B\u91CF");
}
{
  for (const enemyId of ["LouseNormal", "FungiBeast", "SlaverRed"]) {
    const s = newRun();
    startCombat(s, { enemyId, hpMult: 1, dmgMult: 1, kind: "monster", gold: 0 });
    let guard = 0;
    while (guard++ < 300) {
      if (s.phase !== "combat") break;
      if (s.turn === "player") {
        const entangled = (s.player.statuses.entangled ?? 0) > 0;
        const affordable = s.hand.filter((id) => CARD_BY_ID[id] && CARD_BY_ID[id].cost >= 0).filter((id) => !entangled || CARD_BY_ID[id].type !== "attack").filter((id) => CARD_BY_ID[id].cost <= s.player.energy);
        if (affordable.length > 0) playCard(s, affordable[0]);
        else endPlayerTurn(s);
      }
    }
    assert(s.phase === "reward" || s.phase === "defeat", `${enemyId} \u6218\u6597\u80FD\u5230\u8FBE\u7EC8\u5C40\uFF08\u5B9E\u9645 ${s.phase}\uFF09`);
    assert(guard < 300, `${enemyId} \u6218\u6597\u65E0\u6B7B\u5FAA\u73AF`);
  }
}
{
  const s = newRun();
  startCombat(s, { enemyId: "Cultist", hpMult: 1, dmgMult: 1, kind: "monster", gold: 0 });
  s.hand = ["Seeing Red"];
  s.player.energy = 99;
  playCard(s, "Seeing Red");
  assert(s.exhaustPile.includes("Seeing Red") && !s.discardPile.includes("Seeing Red"), "\u6D88\u8017\u724C\u8FDB\u5165\u6D88\u8017\u5806");
  startCombat(s, { enemyId: "Cultist", hpMult: 1, dmgMult: 1, kind: "monster", gold: 0 });
  assert(s.exhaustPile.length === 0, "\u65B0\u6218\u6597\u6D88\u8017\u5806\u91CD\u7F6E");
}
{
  const drawPile = ["Anger", "Cleave", "Bash", "Uppercut", "Shrug It Off"];
  const original = [...drawPile];
  const flat = buildDrawPileGroups(drawPile).flatMap((g) => g.cards);
  assert(drawPile.join(",") === original.join(","), "\u771F\u5B9E\u62BD\u724C\u5806\u987A\u5E8F\u672A\u88AB\u4FEE\u6539");
  const rarities = flat.map((id) => CARD_BY_ID[id].rarity);
  assert(
    rarities.join(",") === "common,common,common,uncommon,basic",
    `\u6309\u7A00\u6709\u5EA6\u5206\u7EC4\u6392\u5E8F\uFF08\u5B9E\u9645 ${rarities}\uFF09`
  );
  assert(
    flat.slice(0, 3).sort().join(",") === ["Anger", "Cleave", "Shrug It Off"].sort().join(","),
    "\u7EC4\u5185\u662F\u968F\u673A\u6253\u4E71\uFF08\u5185\u5BB9\u4E0D\u53D8\uFF09"
  );
  let varied = false;
  for (let i = 0; i < 20; i++) {
    const g2 = buildDrawPileGroups(drawPile).flatMap((x) => x.cards);
    if (g2.join(",") !== flat.join(",")) {
      varied = true;
      break;
    }
  }
  assert(varied, "\u7EC4\u5185\u987A\u5E8F\u968F\u673A\uFF08\u591A\u6B21\u5FEB\u7167\u6709\u53D8\u5316\uFF09");
}
{
  const summary = buildDeckSummary({
    draw: ["Strike_R", "Strike_R"],
    hand: ["Defend_R"],
    discard: ["Bash"],
    exhaust: []
  });
  const strike = summary.find((c) => c.id === "Strike_R");
  assert(strike.count === 2, "\u5B8C\u6574\u724C\u7EC4\u6309\u5361\u540D\u8BA1\u6570\uFF08\u6253\u51FB \xD72\uFF09");
  const names = summary.map((c) => CARD_BY_ID[c.id].name);
  const sorted = [...names].sort((a, b) => a.localeCompare(b, "zh"));
  assert(names.join(",") === sorted.join(","), `\u5B8C\u6574\u724C\u7EC4\u6309\u4E2D\u6587\u540D\u6392\u5E8F\uFF08\u5B9E\u9645 ${names.join(",")}\uFF09`);
}
{
  const s = newRun();
  const raw = JSON.parse(serializeSave(s));
  delete raw.state.exhaustPile;
  const back = parseSave(JSON.stringify(raw));
  assert(back !== null && Array.isArray(back.exhaustPile), "\u8001\u5B58\u6863\u81EA\u52A8\u8865\u9F50 exhaustPile");
}
{
  const outcomes = {};
  let bossReached = 0;
  const stuck = [];
  for (let i = 0; i < 200; i++) {
    const s = newRun();
    let guard = 0;
    let ended = false;
    while (guard++ < 4e3 && !ended) {
      switch (s.phase) {
        case "map": {
          const cur = s.map.nodes.find((n) => n.id === s.map.currentId);
          const next = s.map.nodes.filter(
            (n) => n.floor === cur.floor + 1 && s.map.edges.some((e) => e.from === cur.id && e.to === n.id)
          );
          if (next.length === 0) {
            stuck.push(`no-next @${cur.id}`);
            ended = true;
            break;
          }
          const pick = next.find((n) => n.type === "rest") ?? next.find((n) => n.type !== "elite") ?? next[0];
          const before = s.map.currentId;
          enterNode(s, pick.id);
          if (s.phase === "map" && s.map.currentId === before) {
            stuck.push(`enterNode-fail @${pick.id} from ${cur.id}`);
            ended = true;
          }
          break;
        }
        case "rest":
        case "treasure":
          closeOverlay(s);
          break;
        case "shop": {
          if (s.shop.relic && s.gold >= s.shop.relic.price) {
            buyRelic(s);
          } else {
            const affordable = s.shop.cards.find((o) => s.gold >= o.price);
            if (affordable) buyCard(s, affordable.id);
            else leaveShop(s);
          }
          break;
        }
        case "event": {
          const idx = s.event.event.options.findIndex((o) => !o.need_gold || s.gold >= o.need_gold);
          pickEventOption(s, idx >= 0 ? idx : s.event.event.options.length - 1);
          break;
        }
        case "combat": {
          if (s.turn === "player") {
            if (s.player.hp < 30 && s.potions.length > 0) {
              usePotion(s, s.potions[0]);
              break;
            }
            const entangled = (s.player.statuses.entangled ?? 0) > 0;
            const playable = s.hand.map((id) => ({ id, def: CARD_BY_ID[id] })).filter((c) => c.def && c.def.cost >= 0).filter((c) => !entangled || c.def.type !== "attack").filter((c) => c.def.cost <= s.player.energy).sort((a, b) => score(b.def) - score(a.def));
            if (playable.length > 0) playCard(s, playable[0].id);
            else endPlayerTurn(s);
          } else {
            stuck.push(`combat-turn-enemy`);
            ended = true;
          }
          break;
        }
        case "reward":
          pickReward(s, s.rewards[0]);
          break;
        default:
          ended = true;
      }
      if (s.encounter?.kind === "boss") bossReached++;
    }
    if (!ended) {
      failures++;
      stuck.push(`timeout @phase=${s.phase} cur=${s.map.currentId} floor=${s.floor}`);
    }
    outcomes[s.phase] = (outcomes[s.phase] ?? 0) + 1;
  }
  console.log("  200 \u5C40\u8D70\u7EBF\u7ED3\u679C:", JSON.stringify(outcomes));
  if (stuck.length) console.log("  \u5361\u6B7B\u8BB0\u5F55:", stuck.slice(0, 5).join(" | "));
  assert(bossReached > 0, `bot \u62B5\u8FBE\u8FC7\u9996\u9886\uFF08${bossReached} \u6B21\uFF09`);
  assert((outcomes.victory ?? 0) > 0, "bot \u81F3\u5C11\u901A\u5173\u4E00\u5C40");
  assert(Object.keys(outcomes).every((k) => k === "victory" || k === "defeat"), "\u6BCF\u5C40\u90FD\u5230\u8FBE\u7EC8\u5C40");
  assert(stuck.length === 0, "200 \u5C40\u8D70\u7EBF\u65E0\u5361\u6B7B");
}
function score(def) {
  return def.effects.reduce((s, e) => {
    if (e.op === "damage") return s + (e.value ?? 0);
    if (e.op === "damage_n") return s + (e.value ?? 0) * (e.times ?? 1);
    if (e.op === "damage_all") return s + (e.value ?? 0);
    if (e.op === "block") return s + (e.value ?? 0) * 0.8;
    return s + 1;
  }, 0);
}
console.log(failures === 0 ? "\n\u5168\u90E8\u901A\u8FC7 \u2705" : `
${failures} \u9879\u5931\u8D25 \u274C`);
process.exit(failures === 0 ? 0 : 1);
