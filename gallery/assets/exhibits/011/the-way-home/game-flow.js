/* Direct script loading keeps the entire game playable from file://, without a build or server. */
window.GAME_FLOW = {
  title: '回家的路上', start: 'v01', ending: 'END_HOME',
  chapters: ['游乐场', '广场', '摇摇车', '雨街', '便利店', '向光走'],
  nodes: {
    v01: { file: 'v01_playground_intro', chapter: 0, prompt: '天快黑了。要再待一会儿吗？',
      captions: [[0.35, 2.6, '我记得，我只是出来买东西。'], [2.8, 5.1, '但回家的路，好像变长了。']],
      choices: [{label:'坐跷跷板', detail:'再看一眼傍晚的天空', next:'v02', memory:'看过狗形云'}, {label:'回家', detail:'沿着路灯，继续往前', next:'v04', memory:'离开游乐场'}] },
    v02: { file: 'v02_seesaw_dog_cloud', chapter: 0, next:'v04', captions: [[0.6, 3.6, '小时候，总觉得云里住着什么。'], [4, 7.1, '它好像还记得我。']] },
    v04: { file: 'v04_square_intro', chapter: 1, prompt:'这首歌，你好像在哪里听过。',
      captions: [[0.5, 3.7, '走出游乐场，竟然又到了这里。'], [4, 6, '远处的音响，还在响。']],
      choices:[{label:'留下来听歌', detail:'熟悉的旋律，好像在等你', next:'v05', memory:'听过广场的歌'}, {label:'回家', detail:'有人还在等我吃饭', next:'v06', memory:'穿过广场'}] },
    v05: { file:'v05_square_dance', chapter:1, next:'v06', captions:[[0.5, 4, '这首歌，以前每天傍晚都在放。'], [4.3, 8.6, '听着听着，忽然很想回家。']] },
    v06: { file:'v06_square_to_rocking_car', chapter:2, prompt:'它没有投币，却轻轻晃了一下。',
      captions:[[0.5, 3, '广场边的摇摇车，居然还在。']],
      choices:[{label:'坐摇摇车', detail:'也许它知道回家的方向', next:'v07', memory:'坐过摇摇车'}, {label:'不坐摇摇车', detail:'这段路，还是自己走吧', next:'v09', memory:'独自走进雨里'}] },
    v07: { file:'v07_ride_rocking_car', chapter:2, next:'v09', captions:[[0.4, 2.7, '我还没有坐稳，它就出发了。'], [2.9, 5.2, '街道开始向身后流去。']] },
    v09: { file:'v09_rainy_street', chapter:3, prompt:'雨下起来了。那边还有一盏灯。',
      captions:[[0.4, 3, '这条街，比记忆里长了好多。']],
      choices:[{label:'进去避雨', detail:'推开便利店的门', next:'v10'}] },
    v10: { file:'v10_convenience_store_blackout', chapter:4, prompt:'灯灭了。黑暗里传来一声轻响。',
      captions:[[0.4, 2.8, '有人吗？']],
      choices:[{label:'四处摸索', detail:'沿着货架，慢慢往前', next:'v11'}] },
    v11: { file:'v11_search_in_dark', chapter:4, prompt:'墙的那一边，透出一点光。',
      captions:[[0.4, 3, '指尖碰到一扇门。门把手是温热的。']],
      choices:[{label:'向光源处走', detail:'这一次，好像认得这条路', next:'v12'}] },
    v12: { file:'v12_walk_toward_light', chapter:5, next:'END_HOME', captions:[[0.4, 2.8, '是家里的灯。'], [3, 5.1, '原来，我一直都记得回家的路。']] }
  }
};
