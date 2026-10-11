import type { Box } from './map';

const CSS = `
#hud { position: fixed; inset: 0; pointer-events: none; font-family: 'Barlow Condensed', 'Arial Narrow', sans-serif; font-weight: 600; color: #ece6d4;
  text-shadow: 0 1px 3px rgba(0,0,0,.8); user-select: none; font-variant-numeric: tabular-nums; }
#hud .vignette { position: absolute; inset: 0; opacity: 0; transition: opacity .15s;
  background: radial-gradient(ellipse at center, rgba(120,0,0,0) 35%, rgba(150,0,0,.55) 75%, rgba(90,0,0,.9) 100%); }
#hud .scope { position: absolute; inset: 0; display: none;
  background: radial-gradient(circle at center, transparent 0, transparent calc(min(46vh, 46vw)), rgba(0,0,0,.85) calc(min(46vh, 46vw) + 2px), #000 calc(min(46vh, 46vw) + 14px)); }
#hud .scope::before { content: ''; position: absolute; left: 50%; top: 50%; width: calc(min(92vh, 92vw)); height: calc(min(92vh, 92vw)); transform: translate(-50%, -50%);
  border-radius: 50%; box-shadow: inset 0 0 60px 18px rgba(0,0,0,.75); }
#hud .scope svg { position: absolute; left: 50%; top: 50%; width: calc(min(92vh, 92vw)); height: calc(min(92vh, 92vw)); transform: translate(-50%, -50%); }
#hud .scope .breath { position: absolute; left: 50%; bottom: 7vh; width: 160px; margin-left: -80px; height: 4px; background: rgba(255,255,255,.15); }
#hud .scope .breath i { display: block; height: 100%; background: #f2ecd8; }
#hud .scope .bh { position: absolute; left: 50%; bottom: calc(7vh + 10px); transform: translateX(-50%); font-size: 13px; letter-spacing: 2px; opacity: .8; }
#hud .xhair { position: absolute; left: 50%; top: 50%; }
#hud .xhair i { position: absolute; background: #f2ecd8; box-shadow: 0 0 0 1px rgba(0,0,0,.6); }
#hud .xhair .t, #hud .xhair .b { width: 2px; height: 9px; left: -1px; }
#hud .xhair .l, #hud .xhair .r { width: 9px; height: 2px; top: -1px; }
#hud .hit { position: absolute; left: 50%; top: 50%; width: 26px; height: 26px; margin: -13px; opacity: 0; }
#hud .hit::before, #hud .hit::after { content: ''; position: absolute; left: 12px; top: -2px; width: 2px; height: 30px;
  background: linear-gradient(#fff 0 35%, transparent 35% 65%, #fff 65%); transform: rotate(45deg); }
#hud .hit::after { transform: rotate(-45deg); }
#hud .hit.head { width: 34px; height: 34px; margin: -17px; }
#hud .hit.head::before, #hud .hit.head::after { left: 16px; height: 38px; background: linear-gradient(#ffd23a 0 35%, transparent 35% 65%, #ffd23a 65%); }
#hud .hit.kill::before, #hud .hit.kill::after { background: linear-gradient(#ff3b2a 0 35%, transparent 35% 65%, #ff3b2a 65%); }
#hud .wpanel { position: absolute; right: 28px; bottom: 24px; width: 340px; padding: 14px 18px 14px 40px; text-align: right;
  background: linear-gradient(90deg, rgba(8,7,8,0), rgba(8,7,8,.62) 28%); border-right: 3px solid #f2d36b; }
#hud .wpanel .wh { display: flex; justify-content: flex-end; align-items: baseline; gap: 10px; }
#hud .wpanel .w { font-size: 24px; letter-spacing: 2px; font-weight: 700; }
#hud .wpanel .mode { font-size: 12px; letter-spacing: 2px; padding: 1px 6px; border: 1px solid rgba(236,230,212,.45); opacity: .85; }
#hud .wpanel .n { font-size: 86px; line-height: .86; font-weight: 800; letter-spacing: -1px; transition: color .15s; }
#hud .wpanel .n small { font-size: 32px; opacity: .6; font-weight: 600; letter-spacing: 0; }
#hud .wpanel .n.low { color: #ff5a3a; }
#hud .wpanel .bullets { display: flex; gap: 2px; justify-content: flex-end; margin-top: 8px; height: 14px; }
#hud .wpanel .bullets b { flex: 0 0 4px; height: 14px; background: #e9d79a; border-radius: 1px; }
#hud .wpanel .bullets b.spent { background: rgba(255,255,255,.13); }
#hud .wpanel .bullets.belt { display: block; position: relative; background: rgba(255,255,255,.13); height: 8px; margin-top: 10px; }
#hud .wpanel .bullets.belt i { position: absolute; right: 0; top: 0; bottom: 0; background: #e9d79a; }
#hud .wpanel .rl { height: 4px; margin-top: 6px; background: rgba(255,255,255,.12); visibility: hidden; }
#hud .wpanel .rl i { display: block; height: 100%; width: 0; background: #7ec8ff; margin-left: auto; }
#hud .wpanel .rl.on { visibility: visible; }
#hud .wpanel .alt { font-size: 15px; letter-spacing: 1.5px; opacity: .55; margin-top: 8px; }
#hud .wpanel .alt b { opacity: 1; color: #f2d36b; font-weight: 700; }
#hud .equip { display: flex; justify-content: flex-end; gap: 16px; margin-top: 8px; font-size: 15px; letter-spacing: 1px; }
#hud .equip span { display: inline-flex; align-items: center; gap: 6px; }
#hud .equip svg { width: 20px; height: 20px; }
#hud .equip span b { color: #f2d36b; font-size: 20px; }
#hud .equip span.empty { opacity: .3; }
#hud .hp { position: absolute; left: 28px; bottom: 28px; width: 260px; }
#hud .hp .hn { font-size: 34px; font-weight: 800; line-height: 1; }
#hud .hp .hn small { font-size: 14px; letter-spacing: 3px; opacity: .6; margin-left: 6px; }
#hud .hp .hb { height: 8px; margin-top: 4px; background: rgba(255,255,255,.14); }
#hud .hp .hb i { display: block; height: 100%; background: #e9e3cf; transition: width .12s; }
#hud .hp.low .hb i { background: #ff5a3a; } #hud .hp.low .hn { color: #ff5a3a; }
#hud .rank { position: absolute; left: 50%; bottom: 10px; transform: translateX(-50%); width: min(520px, 60vw); text-align: center; font-size: 15px; }
#hud .rank .bar { height: 5px; background: rgba(0,0,0,.5); border: 1px solid rgba(255,255,255,.25); margin-top: 3px; }
#hud .rank .bar i { display: block; height: 100%; background: #e0b23c; width: 0; transition: width .4s; }
#hud .score { position: absolute; left: 196px; top: 16px; font-size: 18px; line-height: 1.1; }
#hud .score .big { font-size: 28px; }
#hud .feed { position: absolute; right: 20px; top: 16px; font-size: 17px; text-align: right; }
#hud .feed div { animation: feedIn .2s; }
#hud .feed .you { color: #9fd36b; }
#hud .feed .enemy { color: #ff6b4a; }
#hud .popups { position: absolute; left: 50%; top: 58%; transform: translateX(-50%); text-align: center; }
#hud .popups div { font-size: 23px; color: #f2d36b; animation: pop 1.2s forwards; }
#hud .popups div.hs { color: #ff9a5a; }
#hud .banner { position: absolute; left: 50%; top: 22%; transform: translateX(-50%); text-align: center; opacity: 0; transition: opacity .3s; }
#hud .banner .t { font-size: 36px; color: #f2d36b; letter-spacing: 3px; }
#hud .banner .s { font-size: 18px; }
#hud .streak { position: absolute; right: 36px; bottom: 272px; display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
#hud .sk-row { display: flex; gap: 6px; }
#hud .sk { position: relative; width: 46px; height: 46px; border: 1px solid rgba(236,230,212,.3); background: rgba(0,0,0,.45); display: grid; place-items: center;
  color: rgba(236,230,212,.45); overflow: hidden; }
#hud .sk i { position: absolute; left: 0; right: 0; bottom: 0; background: rgba(242,211,107,.18); transition: height .3s; }
#hud .sk svg { position: relative; }
#hud .sk b { position: absolute; right: 3px; bottom: 1px; font-size: 13px; }
#hud .sk em { position: absolute; left: 3px; top: 1px; font-style: normal; font-size: 12px; color: #f2d36b; }
#hud .sk.got { border-color: #f2d36b; color: #f2d36b; box-shadow: 0 0 12px rgba(242,211,107,.45); }
#hud .sk.got i { background: rgba(242,211,107,.28); }
#hud .sk.top { animation: skPulse 1.1s ease-in-out infinite; }
#hud .sk-use { font-size: 18px; letter-spacing: 1px; color: #f2d36b; }
#hud .sk-use.dim { color: #9fd36b; }
@keyframes skPulse { 50% { box-shadow: 0 0 22px rgba(242,211,107,.85); } }
/* kill streak counter */
#hud .kstreak { position: absolute; left: 50%; top: 66%; transform: translateX(-50%); text-align: center; pointer-events: none; }
#hud .kstreak div { font-size: 30px; letter-spacing: 3px; color: #ffcf5a; animation: kstreak 1.6s cubic-bezier(.2,.9,.3,1.2) forwards;
  text-shadow: 0 0 14px rgba(255,140,40,.7), 0 2px 4px #000; }
#hud .kstreak small { display: block; font-size: 14px; letter-spacing: 4px; color: #ece6d4; }
@keyframes kstreak { 0% { transform: scale(2.2); opacity: 0; filter: blur(4px) } 14% { transform: scale(1); opacity: 1; filter: none }
  80% { opacity: 1 } 100% { opacity: 0; transform: translateY(-14px) } }
/* killstreak earned card */
#hud .earn { position: absolute; right: 0; top: 34%; display: flex; align-items: center; gap: 16px; padding: 14px 40px 14px 22px;
  background: linear-gradient(90deg, rgba(0,0,0,0), rgba(20,14,6,.88) 18%); border-right: 4px solid #f2d36b; transform: translateX(110%); }
#hud .earn.show { animation: earnIn 3.4s cubic-bezier(.2,.9,.25,1) forwards; }
#hud .earn .ic { color: #f2d36b; filter: drop-shadow(0 0 10px rgba(242,211,107,.8)); animation: earnIcon 3.4s ease-out forwards; }
#hud .earn .k { font-size: 14px; letter-spacing: 4px; color: #9fd36b; }
#hud .earn .n { font-size: 38px; letter-spacing: 2px; color: #f2d36b; line-height: 1; }
#hud .earn .s { font-size: 15px; letter-spacing: 2px; }
@keyframes earnIn { 0% { transform: translateX(110%) } 10% { transform: translateX(-8px) } 14% { transform: translateX(0) } 86% { transform: translateX(0); opacity: 1 } 100% { transform: translateX(40px); opacity: 0 } }
@keyframes earnIcon { 0%, 10% { transform: scale(.4) rotate(-30deg) } 22% { transform: scale(1.25) rotate(6deg) } 32% { transform: none } }
/* system crash */
#hud .glitch { position: absolute; inset: 0; display: none; mix-blend-mode: screen; }
#hud .glitch.on { display: block; animation: glitchShake .12s steps(2) infinite; }
#hud .glitch::before { content: ''; position: absolute; inset: 0;
  background: repeating-linear-gradient(0deg, rgba(255,0,80,.25) 0 3px, transparent 3px 9px), repeating-linear-gradient(90deg, rgba(0,255,220,.18) 0 40px, transparent 40px 97px);
  animation: glitchBars .3s steps(3) infinite; }
#hud .glitch .term { position: absolute; left: 6%; top: 14%; font-family: 'Courier New', monospace; font-size: 15px; line-height: 1.5; color: #7dffb0;
  text-shadow: 0 0 6px #2aff7a; white-space: pre; opacity: .9; }
#hud .glitch .cnt { position: absolute; left: 50%; top: 52%; transform: translate(-50%, -50%); font-size: 220px; color: #fff; line-height: 1;
  text-shadow: -6px 0 #ff2a5a, 6px 0 #2ad4ff, 0 0 40px rgba(120,220,255,.8); }
#hud .glitch .cnt.tick { animation: crashTick 1s ease-out; }
@keyframes crashTick { 0% { transform: translate(-50%, -50%) scale(1.6); opacity: 0 } 15% { transform: translate(-50%, -50%) scale(1); opacity: 1 } 100% { opacity: .85 } }
#hud .wave { position: absolute; left: 50%; top: 50%; width: 10px; height: 10px; margin: -5px; border-radius: 50%; display: none;
  box-shadow: 0 0 0 6px #bfefff, 0 0 40px 20px rgba(120,220,255,.9), inset 0 0 40px 20px rgba(120,220,255,.6); }
#hud .wave.on { display: block; animation: waveOut 1.4s cubic-bezier(.2,.7,.3,1) forwards; }
#hud .wave::after { content: ''; position: fixed; inset: 0; background: radial-gradient(circle, rgba(220,245,255,.9), rgba(80,160,255,.35) 60%, transparent);
  animation: waveFlash 1.4s ease-out forwards; }
@keyframes waveOut { 0% { transform: scale(0) } 100% { transform: scale(320); opacity: 0 } }
@keyframes waveFlash { 0% { opacity: 0 } 12% { opacity: 1 } 100% { opacity: 0 } }
#hud .glitch .x { position: absolute; left: 50%; top: 22%; transform: translate(-50%, -50%); font-size: 54px; letter-spacing: 8px; color: #fff;
  text-shadow: -4px 0 #ff2a5a, 4px 0 #2ad4ff; }
@keyframes glitchBars { 0% { transform: translateY(0) } 33% { transform: translateY(-17px) } 66% { transform: translateY(23px) } }
@keyframes glitchShake { 0% { transform: translate(3px, -2px) } 100% { transform: translate(-4px, 3px) } }
/* interaction prompt + airstrike tablet */
#hud .prompt { position: absolute; left: 50%; top: 62%; transform: translateX(-50%); display: none; padding: 8px 16px; font-size: 20px; letter-spacing: 1.5px;
  background: rgba(10,8,6,.7); border: 1px solid rgba(242,211,107,.5); color: #f2ecd8; text-align: center; }
#hud .prompt i { display: block; height: 4px; margin-top: 6px; background: rgba(255,255,255,.15); }
#hud .prompt i b { display: block; height: 100%; background: #f2d36b; }
#hud .tablet { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); display: none; flex-direction: column; gap: 8px; padding: 16px 16px 12px;
  background: linear-gradient(160deg, #2a2a26, #141412); border: 2px solid #4a4a42; border-radius: 18px; box-shadow: 0 20px 60px rgba(0,0,0,.7), inset 0 0 0 6px #0a0a09; }
#hud .tablet canvas { width: min(440px, 70vh); height: min(440px, 70vh); border-radius: 6px; image-rendering: pixelated; box-shadow: inset 0 0 30px rgba(0,0,0,.6); }
#hud .tablet .tb-h { font-size: 20px; letter-spacing: 4px; color: #7dffb0; }
#hud .tablet .tb-f { font-size: 13px; letter-spacing: 1.5px; color: #c8c2b0; }
/* rank up */
#hud .rankup { position: absolute; left: 50%; top: 38%; width: 0; height: 0; display: none; }
#hud .rankup.show { display: block; }
#hud .rankup .rays { position: absolute; left: -260px; top: -260px; width: 520px; height: 520px; border-radius: 50%;
  background: repeating-conic-gradient(rgba(242,211,107,.22) 0 7deg, transparent 7deg 20deg);
  -webkit-mask: radial-gradient(circle, #000 20%, transparent 68%); mask: radial-gradient(circle, #000 20%, transparent 68%);
  animation: raysSpin 6s linear infinite, raysIn 4.2s ease-out forwards; }
#hud .rankup .flash { position: absolute; left: -150px; top: -150px; width: 300px; height: 300px; border-radius: 50%;
  background: radial-gradient(circle, rgba(255,250,220,.95), rgba(255,220,120,0) 65%); animation: rkFlash 4.2s ease-out forwards; }
#hud .rankup .bd { position: absolute; left: -64px; top: -64px; width: 128px; height: 128px; animation: rkBadge 4.2s cubic-bezier(.2,.9,.3,1.25) forwards; }
#hud .rankup .bd img { width: 128px; height: 128px; }
#hud .rankup .txt { position: absolute; left: -300px; width: 600px; top: 78px; text-align: center; animation: rkText 4.2s ease-out forwards; }
#hud .rankup .k { font-size: 18px; letter-spacing: 8px; color: #9fd36b; }
#hud .rankup .l { font-size: 56px; letter-spacing: 3px; color: #f2d36b; line-height: 1; text-shadow: 0 0 24px rgba(242,211,107,.6), 0 3px 6px #000; }
#hud .rankup .r { font-size: 22px; letter-spacing: 3px; }
#hud .rankup.minor { top: 30%; }
#hud .rankup.minor .rays { scale: .62; }
#hud .rankup.minor .l { font-size: 40px; }
#hud .rankup.minor .k { color: #7ec8ff; }
#hud .rankup .unl { width: 128px; height: 128px; display: grid; place-items: center; }
#hud .rankup .unl svg { width: 112px; height: 112px; filter: drop-shadow(0 0 14px rgba(126,200,255,.55)); }
#hud .rankup .unl .disc { width: 104px; height: 104px; border-radius: 50%; border: 3px solid #f2d36b; box-shadow: 0 0 24px rgba(242,211,107,.6), inset 0 0 18px rgba(0,0,0,.5); }
#hud .rankup .u { font-size: 15px; letter-spacing: 1px; color: #ece6d4; opacity: .85; margin-top: 6px; }
@keyframes raysSpin { to { transform: rotate(360deg) } }
@keyframes raysIn { 0% { opacity: 0; scale: .3 } 15% { opacity: 1; scale: 1 } 82% { opacity: 1 } 100% { opacity: 0; scale: 1.15 } }
@keyframes rkFlash { 0% { opacity: 0; scale: .2 } 8% { opacity: 1; scale: 1.4 } 30% { opacity: 0; scale: 2 } 100% { opacity: 0 } }
@keyframes rkBadge { 0% { transform: scale(3.2) rotate(-25deg); opacity: 0 } 12% { transform: scale(.9) rotate(4deg); opacity: 1 } 20% { transform: none }
  84% { transform: none; opacity: 1 } 100% { transform: translateY(-20px) scale(.9); opacity: 0 } }
@keyframes rkText { 0%, 12% { opacity: 0; transform: translateY(14px) } 24% { opacity: 1; transform: none } 84% { opacity: 1 } 100% { opacity: 0 } }
#hud .dmg { position: absolute; left: 50%; top: 50%; width: 0; height: 0; }
#hud .dmg i { position: absolute; left: -60px; top: -170px; width: 120px; height: 30px; border-radius: 50% 50% 0 0;
  border-top: 6px solid rgba(255,40,20,.85); opacity: 0; transition: opacity .6s; }
#hud .reload { position: absolute; left: 50%; top: 62%; transform: translateX(-50%); font-size: 20px; opacity: 0; }
#hud canvas.map { position: absolute; left: 16px; top: 16px; width: 168px; height: 168px; border: 2px solid rgba(232,226,208,.4);
  background: rgba(10,14,10,.55); }
#hud .dead { position: absolute; inset: 0; display: none; align-items: center; justify-content: center; flex-direction: column;
  background: rgba(60,0,0,.35); font-size: 25px; }
#hud .dead .t { font-size: 52px; color: #ff5a3a; letter-spacing: 4px; }
#hud .match { position: absolute; left: 50%; top: 12px; transform: translateX(-50%); display: flex; gap: 14px; align-items: center; font-size: 21px; }
#hud .match .a { color: #7ec8ff; } #hud .match .e { color: #ff6b4a; } #hud .match .clock { font-size: 18px; opacity: .85; }
#hud .match .bar { width: 110px; height: 6px; background: rgba(0,0,0,.5); border: 1px solid rgba(255,255,255,.2); }
#hud .match .bar i { display: block; height: 100%; }
#hud .tags { position: absolute; inset: 0; }
#hud .tags div { position: absolute; transform: translate(-50%, -100%); font-size: 15px; white-space: nowrap; }
#hud .tags .f { color: #7ec8ff; } #hud .tags .e { color: #ff5a3a; }
#hud .tags .f::after { content: ''; display: block; margin: 1px auto 0; width: 0; border: 5px solid transparent; border-top-color: #7ec8ff; }
#hud .board { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); background: rgba(8,8,10,.86);
  border: 1px solid rgba(232,226,208,.3); padding: 14px 18px; display: none; gap: 20px; font-size: 16px; }
#hud .board table { border-collapse: collapse; min-width: 300px; }
#hud .board th { text-align: left; font-weight: normal; opacity: .6; padding: 2px 10px; }
#hud .board td { padding: 2px 10px; font-variant-numeric: tabular-nums; }
#hud .board tr.me td { background: rgba(242,211,107,.18); }
#hud .board h3 { margin: 0 0 6px; font-weight: normal; font-size: 21px; }
#hud .end { position: absolute; inset: 0; display: none; align-items: center; justify-content: center; flex-direction: column;
  background: rgba(5,3,4,.82); pointer-events: auto; gap: 12px; }
#hud .end .t { font-size: 69px; letter-spacing: 6px; line-height: .9; }
#hud .end .win { color: #f2d36b; } #hud .end .lose { color: #ff5a3a; }
#hud .end button { font-family: inherit; font-size: 26px; letter-spacing: 4px; padding: 4px 34px; cursor: pointer;
  background: #f2d36b; color: #1a1210; border: none; box-shadow: 5px 5px 0 #6b1a10; }
#hud .picker { position: absolute; inset: 0; display: none; align-items: center; justify-content: center; flex-direction: column; gap: 18px;
  background: radial-gradient(ellipse at center, rgba(5,3,4,.55), rgba(5,3,4,.85)); pointer-events: auto; }
#hud .picker h2 { margin: 0; font-size: 44px; font-weight: 800; color: #f2d36b; letter-spacing: 2px; }
#hud .picker .sub { font-size: 17px; opacity: .75; font-family: 'Barlow', sans-serif; font-weight: 500; }
#hud .picker .cards { display: flex; gap: 14px; flex-wrap: wrap; justify-content: center; padding: 0 16px; }
#hud .picker button { all: unset; cursor: pointer; width: 230px; padding: 14px 16px; border: 1px solid rgba(232,226,208,.3); background: rgba(12,9,11,.85);
  display: flex; flex-direction: column; gap: 4px; box-sizing: border-box; transition: border-color .15s, transform .15s; }
#hud .picker button:hover, #hud .picker button:focus-visible { border-color: #f2d36b; transform: translateY(-3px); }
#hud .picker button .k { font-size: 14px; color: #f2d36b; letter-spacing: 2px; }
#hud .picker button b { font-size: 26px; font-weight: 800; letter-spacing: .5px; }
#hud .picker button span { font-family: 'Barlow', sans-serif; font-weight: 500; font-size: 13px; opacity: .75; line-height: 1.4; }
#hud .hint { position: absolute; left: 16px; top: 190px; font-size: 13px; opacity: .6; letter-spacing: 1px; }
#hud .dead .cls { font-size: 16px; opacity: .85; margin-top: 10px; font-family: 'Barlow', sans-serif; }
#hud .dead .cls b { color: #f2d36b; }
#hud .whiteout { position: absolute; inset: 0; background: #fff; opacity: 0; pointer-events: none; }
#hud .nade { position: absolute; left: 50%; top: 50%; width: 0; height: 0; }
#hud .nade i { position: absolute; left: -16px; top: -120px; width: 32px; height: 32px; border-radius: 50%; background: rgba(200,30,20,.85);
  color: #fff; font-style: normal; font-size: 16px; line-height: 32px; text-align: center; transform-origin: 16px 120px; }
#hud .count { position: absolute; left: 50%; top: 38%; transform: translate(-50%, -50%); font-size: 150px; font-weight: 800; color: #f2d36b;
  text-shadow: 0 6px 30px rgba(0,0,0,.7); display: none; }
#hud .count.on { display: block; animation: countPop .9s ease-out; }
#hud .count small { display: block; font-size: 20px; letter-spacing: 6px; text-align: center; color: #ece6d4; font-weight: 700; }
@keyframes countPop { 0% { transform: translate(-50%, -50%) scale(1.6) } 22% { transform: translate(-50%, -50%) scale(1) } 100% { transform: translate(-50%, -50%) scale(.92) } }
#hud .board td.bd { padding: 1px 4px; width: 30px; }
#hud .board td.lv { opacity: .7; font-size: 15px; white-space: nowrap; }
#hud .end .pcard { width: min(400px, 90vw); margin: 0; }
#hud .end { overflow-y: auto; padding: 24px 0; z-index: 5; background: rgba(5,3,4,.9); }
#hud .report { width: min(980px, calc(100vw - 32px)); display: flex; flex-direction: column; gap: 14px; animation: repIn .5s ease-out; }
#hud .report .rh { display: flex; gap: 22px; align-items: center; flex-wrap: wrap; }
#hud .report .rsub { font-size: 20px; letter-spacing: 2px; opacity: .8; margin-top: 6px; }
#hud .report .rstats { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; }
#hud .report .rstats div { background: rgba(255,255,255,.05); border: 1px solid rgba(232,226,208,.16); padding: 10px 12px; display: flex; flex-direction: column; }
#hud .report .rstats b { font-size: 34px; line-height: 1; color: #f2d36b; font-variant-numeric: tabular-nums; }
#hud .report .rstats span { font-size: 13px; letter-spacing: 2px; opacity: .65; margin-top: 4px; }
#hud .report .rcols { display: grid; grid-template-columns: 1.1fr 1fr; gap: 18px; }
#hud .report .rl { font-size: 14px; letter-spacing: 4px; opacity: .6; margin-bottom: 6px; }
#hud .report .xr { display: flex; justify-content: space-between; font-size: 18px; padding: 4px 0; border-bottom: 1px solid rgba(232,226,208,.1); }
#hud .report .xr b { color: #f2d36b; font-variant-numeric: tabular-nums; }
#hud .report .xr.tot { font-size: 24px; border-bottom: none; padding-top: 8px; }
#hud .report .promo { color: #9fd36b; font-size: 18px; letter-spacing: 2px; margin: 6px 0; }
#hud .report .rbar { position: relative; height: 10px; background: rgba(255,255,255,.1); margin-top: 6px; overflow: hidden; }
#hud .report .rbar i { position: absolute; left: 0; top: 0; bottom: 0; background: #f2d36b; animation: barIn 1.2s ease-out; }
#hud .report .rbar i.was { background: rgba(242,211,107,.35); z-index: 1; animation: none; }
#hud .report .rnext { font-size: 14px; opacity: .65; margin-top: 4px; letter-spacing: 1px; }
#hud .report .runl { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; max-height: 300px; overflow-y: auto; }
#hud .report .runl li { font-size: 16px; padding: 6px 10px; background: rgba(126,200,255,.08); border-left: 3px solid #7ec8ff; letter-spacing: .5px; }
#hud .report .runl li.none { border-left-color: rgba(232,226,208,.3); background: none; opacity: .6; }
@media (max-width: 760px) { #hud .report .rstats { grid-template-columns: repeat(3, 1fr); } #hud .report .rcols { grid-template-columns: 1fr; } }
@keyframes repIn { from { opacity: 0; transform: translateY(14px) } }
@keyframes barIn { from { width: 0 } }
@keyframes pop { 0% { transform: scale(1.4); opacity: 0 } 12% { transform: scale(1); opacity: 1 } 75% { opacity: 1 } 100% { opacity: 0; transform: translateY(-24px) } }
@keyframes feedIn { from { transform: translateX(20px); opacity: 0 } }
@keyframes blink { 50% { opacity: .4 } }
`;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent: HTMLElement, html = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  if (html) e.innerHTML = html;
  parent.appendChild(e);
  return e;
}

export interface MapMarker {
  x: number;
  z: number;
  color: string;
}

export class Hud {
  readonly root: HTMLDivElement;
  private vignette: HTMLDivElement;
  private xhair: HTMLDivElement;
  private xh: HTMLElement[];
  private hit: HTMLDivElement;
  private ammoN: HTMLDivElement;
  private ammoW: HTMLDivElement;
  private modeEl!: HTMLSpanElement;
  private reloadBar!: HTMLElement;
  private altEl!: HTMLDivElement;
  private hpEl!: HTMLDivElement;
  private ammoKey = '';
  private hpKey = '';
  private bullets: HTMLDivElement;
  private rankText: HTMLDivElement;
  private rankBar: HTMLElement;
  private score: HTMLDivElement;
  private feed: HTMLDivElement;
  private popups: HTMLDivElement;
  private banner: HTMLDivElement;
  private streak: HTMLDivElement;
  private dmg: HTMLDivElement;
  private reload: HTMLDivElement;
  private dead: HTMLDivElement;
  private map: HTMLCanvasElement;
  private mapCtx: CanvasRenderingContext2D;
  private match: HTMLDivElement;
  private tagLayer: HTMLDivElement;
  private tagEls: HTMLDivElement[] = [];
  private board: HTMLDivElement;
  private end: HTMLDivElement;
  private picker: HTMLDivElement;
  private countEl: HTMLDivElement;
  private equipEl: HTMLDivElement;
  private white: HTMLDivElement;
  private nadeEl: HTMLDivElement;
  private scopeEl: HTMLDivElement;
  private breathBar: HTMLElement;
  private scopeOn = false;
  private kstreak: HTMLDivElement;
  private earn: HTMLDivElement;
  private glitchEl: HTMLDivElement;
  private waveEl!: HTMLDivElement;
  private promptEl!: HTMLDivElement;
  private tabletEl!: HTMLDivElement;
  private tabletCtx!: CanvasRenderingContext2D;
  private promptKey = '';
  private rankEl: HTMLDivElement;
  private whiteT = 0;
  private hitT = 0;
  private bannerT = 0;
  private dmgArcs: { e: HTMLElement; t: number; angle: number }[] = [];

  constructor() {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    this.root = el('div', '', document.body);
    this.root.id = 'hud';
    this.vignette = el('div', 'vignette', this.root);
    this.dmg = el('div', 'dmg', this.root);
    // mil-dot reticle: thick outer posts, fine centre cross, dots every 10 units
    const dots = [-40, -30, -20, -10, 10, 20, 30, 40]
      .map((d) => `<circle cx="${500 + d * 4}" cy="500" r="3.2"/><circle cx="500" cy="${500 + d * 4}" r="3.2"/>`)
      .join('');
    this.scopeEl = el('div', 'scope', this.root, `<svg viewBox="0 0 1000 1000" fill="#050505" stroke="#050505">
      <rect x="0" y="494" width="300" height="12"/><rect x="700" y="494" width="300" height="12"/><rect x="494" y="700" width="12" height="300"/><rect x="494" y="0" width="12" height="300"/>
      <line x1="300" y1="500" x2="700" y2="500" stroke-width="2"/><line x1="500" y1="300" x2="500" y2="700" stroke-width="2"/>${dots}</svg>
      <div class="bh">SHIFT · HOLD BREATH</div><div class="breath"><i></i></div>`);
    this.breathBar = this.scopeEl.querySelector('.breath i') as HTMLElement;
    this.xhair = el('div', 'xhair', this.root);
    this.xh = ['t', 'b', 'l', 'r'].map((c) => el('i', c, this.xhair));
    this.hit = el('div', 'hit', this.root);
    const ammo = el('div', 'wpanel', this.root);
    const wh = el('div', 'wh', ammo);
    this.modeEl = el('span', 'mode', wh);
    this.ammoW = el('div', 'w', wh);
    this.ammoN = el('div', 'n', ammo);
    this.bullets = el('div', 'bullets', ammo);
    this.reloadBar = el('i', '', el('div', 'rl', ammo));
    this.altEl = el('div', 'alt', ammo);
    this.equipEl = el('div', 'equip', ammo);
    this.hpEl = el('div', 'hp', this.root, '<div class="hn"></div><div class="hb"><i></i></div>');
    this.reload = el('div', 'reload', this.root, 'RELOADING');
    const rank = el('div', 'rank', this.root);
    rank.style.display = 'none';
    this.rankText = el('div', '', rank);
    this.rankBar = el('i', '', el('div', 'bar', rank));
    this.score = el('div', 'score', this.root);
    this.feed = el('div', 'feed', this.root);
    this.popups = el('div', 'popups', this.root);
    this.banner = el('div', 'banner', this.root);
    this.streak = el('div', 'streak', this.root);
    this.kstreak = el('div', 'kstreak', this.root);
    this.earn = el('div', 'earn', this.root);
    this.rankEl = el('div', 'rankup', this.root);
    this.glitchEl = el('div', 'glitch', this.root, '<div class="term"></div><div class="x">SYSTEM CRASH</div><div class="cnt"></div>');
    this.waveEl = el('div', 'wave', this.root);
    this.promptEl = el('div', 'prompt', this.root);
    this.tabletEl = el('div', 'tablet', this.root, '<div class="tb-h">AIRSTRIKE · SELECT SWEEP</div><canvas width="440" height="440"></canvas><div class="tb-f">MOUSE AIM · WHEEL / R ROTATE · [F] CONFIRM · [4] CANCEL</div>');
    this.tabletCtx = (this.tabletEl.querySelector('canvas') as HTMLCanvasElement).getContext('2d')!;
    this.dead = el('div', 'dead', this.root, '<div class="t">K.I.A.</div><div class="s"></div><div class="cls"></div>');
    this.tagLayer = el('div', 'tags', this.root);
    this.match = el('div', 'match', this.root);
    this.board = el('div', 'board', this.root);
    this.end = el('div', 'end', this.root);
    this.nadeEl = el('div', 'nade', this.root);
    this.white = el('div', 'whiteout', this.root);
    this.picker = el('div', 'picker', this.root);
    this.countEl = el('div', 'count', this.root);
    el('div', 'hint', this.root, 'TAB · SCOREBOARD');
    this.map = el('canvas', 'map', this.root);
    this.map.width = 168;
    this.map.height = 168;
    this.mapCtx = this.map.getContext('2d')!;
  }

  setVisible(v: boolean) {
    this.root.style.display = v ? '' : 'none';
  }

  /** Full-screen sniper scope with the hold-breath meter. */
  scope(on: boolean, breath: number) {
    if (on !== this.scopeOn) {
      this.scopeOn = on;
      this.scopeEl.style.display = on ? 'block' : 'none';
    }
    if (on) this.breathBar.style.width = `${Math.round(breath * 100)}%`;
  }

  crosshair(spreadPx: number, ads: number, hidden: boolean) {
    this.xhair.style.opacity = hidden ? '0' : String(1 - ads);
    const g = 6 + spreadPx;
    const [t, b, l, r] = this.xh;
    t.style.top = `${-g - 9}px`;
    b.style.top = `${g}px`;
    l.style.left = `${-g - 9}px`;
    r.style.left = `${g}px`;
  }

  hitmarker(kill: boolean, head = false) {
    this.hit.classList.toggle('kill', kill);
    this.hit.classList.toggle('head', head);
    this.hitT = kill ? 0.35 : 0.2;
  }

  /**
   * Weapon panel: name and fire mode, a big round count over the reserve, the magazine
   * (one pip per round, or a belt bar for big mags), reload progress and the other weapon.
   */
  ammo(name: string, ammo: number, reserve: number, mag: number, reloading: boolean, info: { mode?: string; other?: string; reloadT?: number } = {}) {
    const key = `${name}|${ammo}|${reserve}|${mag}|${reloading}|${info.mode}|${info.other}|${Math.round((info.reloadT ?? -1) * 40)}`;
    if (key === this.ammoKey) return;
    this.ammoKey = key;
    this.ammoN.innerHTML = `${ammo}<small> / ${reserve}</small>`;
    this.ammoN.classList.toggle('low', ammo <= Math.max(1, mag * 0.2));
    this.ammoW.textContent = name;
    this.modeEl.textContent = info.mode ?? '';
    this.modeEl.style.display = info.mode ? '' : 'none';
    const belt = mag > 40;
    this.bullets.classList.toggle('belt', belt);
    if (belt) {
      if (this.bullets.childElementCount !== 1 || this.bullets.firstElementChild!.tagName !== 'I') this.bullets.innerHTML = '<i></i>';
      (this.bullets.firstElementChild as HTMLElement).style.width = `${(ammo / mag) * 100}%`;
    } else {
      if (this.bullets.childElementCount !== mag || this.bullets.firstElementChild?.tagName !== 'B') {
        this.bullets.innerHTML = '';
        for (let i = 0; i < mag; i++) el('b', '', this.bullets);
      }
      for (let i = 0; i < mag; i++) (this.bullets.children[i] as HTMLElement).className = i < mag - ammo ? 'spent' : '';
    }
    const rl = this.reloadBar.parentElement!;
    rl.classList.toggle('on', reloading);
    this.reloadBar.style.width = `${Math.max(0, Math.min(1, info.reloadT ?? 0)) * 100}%`;
    this.altEl.innerHTML = info.other ? `<b>[1/2]</b> ${info.other}` : '';
    this.reload.style.opacity = reloading ? '1' : ammo === 0 ? '1' : '0';
    this.reload.textContent = reloading ? 'RELOADING' : reserve > 0 ? 'PRESS [R] TO RELOAD' : 'NO AMMO';
  }

  health(hp: number, max: number) {
    const v = Math.max(0, Math.ceil(hp));
    const key = `${v}|${max}`;
    if (key === this.hpKey) return;
    this.hpKey = key;
    (this.hpEl.querySelector('.hn') as HTMLElement).innerHTML = `${v}<small>HEALTH</small>`;
    (this.hpEl.querySelector('.hb i') as HTMLElement).style.width = `${(hp / max) * 100}%`;
    this.hpEl.classList.toggle('low', hp / max < 0.35);
  }

  rank(level: number, xpIn: number, xpNeed: number, next: string) {
    this.rankText.innerHTML = `LVL ${level} &nbsp;·&nbsp; ${xpIn} / ${xpNeed} XP${next ? ` &nbsp;·&nbsp; <span style="opacity:.7">NEXT: ${next}</span>` : ''}`;
    this.rankBar.style.width = `${Math.min(100, (xpIn / Math.max(1, xpNeed)) * 100)}%`;
  }

  scoreboard(kills: number, deaths: number, streak: number, matchXp: number) {
    this.score.innerHTML = `<div class="big">${matchXp} XP</div>K ${kills} &nbsp; D ${deaths}<br>STREAK ${streak}`;
  }

  killfeed(html: string) {
    const d = el('div', '', this.feed, html);
    setTimeout(() => d.remove(), 5000);
    while (this.feed.childElementCount > 5) this.feed.firstElementChild?.remove();
  }

  popup(text: string, cls = '') {
    const d = el('div', cls, this.popups, text);
    setTimeout(() => d.remove(), 1200);
  }

  private bannerQueue: [string, string, number][] = [];
  /** Big centre banner; queues behind one that's still showing so unlocks don't overwrite each other. */
  showBanner(title: string, sub: string, secs = 3) {
    if (this.bannerT > 0.4) {
      if (this.bannerQueue.length < 6) this.bannerQueue.push([title, sub, secs]);
      return;
    }
    this.banner.innerHTML = `<div class="t">${title}</div><div class="s">${sub}</div>`;
    this.bannerT = secs;
  }

  clearBanners() {
    this.bannerQueue = [];
    this.bannerT = 0;
  }

  private streakKey = '';
  /** Killstreak rail; rebuilt only when its key changes. */
  streakInfo(key: string, build: () => string) {
    if (key === this.streakKey) return;
    this.streakKey = key;
    this.streak.innerHTML = build();
  }

  /** "3 KILL STREAK" pop under the crosshair. */
  streakCount(n: number) {
    this.kstreak.innerHTML = `<div>${n} KILL STREAK<small>${n >= 10 ? 'UNSTOPPABLE' : n >= 5 ? 'RAMPAGE' : 'KEEP GOING'}</small></div>`;
  }

  private earnQueue: [string, string, string][] = [];
  private earnT = 0;
  /** Killstreak ready: a card slides in from the right with the streak's icon. */
  streakEarned(name: string, icon: string, sub = 'PRESS [4] TO CALL IN') {
    if (this.earnT > 0) {
      this.earnQueue.push([name, icon, sub]);
      return;
    }
    this.earn.innerHTML = `<div class="ic">${icon}</div><div><div class="k">KILLSTREAK READY</div><div class="n">${name}</div><div class="s">${sub}</div></div>`;
    this.earn.classList.remove('show');
    void this.earn.offsetWidth; // restart the animation
    this.earn.classList.add('show');
    this.earnT = 3.4;
  }

  /** System Crash: 'hack' takes over the screen, 'count' shows 5..1, 'wave' fires the electric wave, null clears. */
  crash(mode: 'hack' | 'count' | 'wave' | null, n = 0) {
    const cnt = this.glitchEl.querySelector('.cnt') as HTMLElement;
    if (mode === null) {
      this.glitchEl.classList.remove('on');
      this.waveEl.classList.remove('on');
      return;
    }
    if (mode === 'hack') {
      this.glitchEl.classList.add('on');
      const lines = ['> root@deadpixel:~# inject --payload=crash.bin', '> bypassing match server ......... OK', '> overwriting enemy session keys .. OK', '> arming electromagnetic purge .... OK', '> T-MINUS'];
      (this.glitchEl.querySelector('.term') as HTMLElement).textContent = lines.join('\n');
      cnt.textContent = '';
    } else if (mode === 'count') {
      cnt.textContent = String(n);
      cnt.classList.remove('tick');
      void cnt.offsetWidth;
      cnt.classList.add('tick');
    } else {
      cnt.textContent = '';
      this.waveEl.classList.remove('on');
      void this.waveEl.offsetWidth;
      this.waveEl.classList.add('on');
    }
  }

  /** Context prompt above the ammo counter, with an optional hold-progress bar. */
  prompt(text: string | null, progress = -1) {
    const key = text ? `${text}|${progress < 0 ? '' : Math.round(progress * 20)}` : '';
    if (key === this.promptKey) return;
    this.promptKey = key;
    this.promptEl.style.display = text ? 'block' : 'none';
    if (text) this.promptEl.innerHTML = `${text}${progress >= 0 ? `<i><b style="width:${Math.min(100, progress * 100)}%"></b></i>` : ''}`;
  }

  /** Airstrike tablet; `draw` paints the map each frame, null closes it. */
  tablet(draw: ((ctx: CanvasRenderingContext2D, w: number) => void) | null) {
    this.tabletEl.style.display = draw ? 'flex' : 'none';
    if (draw) draw(this.tabletCtx, 440);
  }

  private rankQueue: [string, string, string, string, string, boolean][] = [];
  private rankT = 0;
  /**
   * Promotion: rays, flash, the new badge slamming in, then level, rank and unlocks.
   * Also used (smaller, quicker) for attachment and camo unlocks mid-match.
   */
  rankUp(badge: string, level: string, rank: string, unlocks: string, kicker = 'PROMOTED', minor = false) {
    if (this.rankT > 0) {
      this.rankQueue.push([badge, level, rank, unlocks, kicker, minor]);
      return;
    }
    this.rankEl.innerHTML = `<div class="rays"></div><div class="flash"></div><div class="bd">${badge}</div>
      <div class="txt"><div class="k">${kicker}</div><div class="l">${level}</div><div class="r">${rank}</div>${unlocks ? `<div class="u">${minor ? unlocks : `UNLOCKED · ${unlocks}`}</div>` : ''}</div>`;
    this.rankEl.classList.remove('show');
    this.rankEl.classList.toggle('minor', minor);
    void this.rankEl.offsetWidth;
    this.rankEl.classList.add('show');
    this.rankT = 4.2;
  }

  clearOverlays() {
    this.earnQueue = [];
    this.rankQueue = [];
    this.earnT = this.rankT = 0;
    this.earn.classList.remove('show');
    this.rankEl.classList.remove('show');
    this.glitchEl.classList.remove('on');
    this.waveEl.classList.remove('on');
    this.kstreak.innerHTML = '';
    this.prompt(null);
    this.tablet(null);
  }

  damageFrom(angle: number) {
    const e = el('i', '', this.dmg);
    e.style.transformOrigin = '60px 170px';
    this.dmgArcs.push({ e, t: 1.2, angle });
  }

  deadScreen(show: boolean, text = '', classHtml = '') {
    this.dead.style.display = show ? 'flex' : 'none';
    if (!show) return;
    (this.dead.querySelector('.s') as HTMLElement).textContent = text;
    const c = this.dead.querySelector('.cls') as HTMLElement;
    if (c.innerHTML !== classHtml) c.innerHTML = classHtml;
  }

  /** Choose-class overlay; cards are [title, detail] pairs. */
  classPicker(cards: [string, string][] | null, onPick?: (i: number) => void, title = 'CHOOSE CLASS', sub = '') {
    this.picker.style.display = cards ? 'flex' : 'none';
    if (!cards) return;
    this.picker.innerHTML = `<h2>${title}</h2><div class="sub">${sub}</div><div class="cards">${cards
      .map(([t, d], i) => `<button type="button" data-i="${i}"><span class="k">[${i + 1}]</span><b>${t}</b><span>${d}</span></button>`)
      .join('')}</div>`;
    this.picker.querySelectorAll<HTMLButtonElement>('button').forEach((b) => b.addEventListener('click', () => onPick?.(Number(b.dataset.i))));
  }

  equipment(frags: number, tac: number, tacName: string) {
    const frag = '<svg viewBox="0 0 20 20"><circle cx="10" cy="12" r="6" fill="#c9c2a8"/><rect x="8" y="3" width="5" height="4" fill="#c9c2a8"/><path d="M13 4l4-2" stroke="#c9c2a8" stroke-width="1.6"/></svg>';
    const can = '<svg viewBox="0 0 20 20"><rect x="5" y="4" width="10" height="14" rx="2" fill="#9fb0b8"/><rect x="7" y="2" width="6" height="3" fill="#9fb0b8"/></svg>';
    const html = `<span class="${frags ? '' : 'empty'}">${frag}[G] <b>${frags}</b></span><span class="${tac ? '' : 'empty'}">${can}[Q] ${tacName} <b>${tac}</b></span>`;
    if (this.equipEl.innerHTML !== html) this.equipEl.innerHTML = html;
  }

  /** Stun flash: 0..1 strength. */
  flash(k: number) {
    this.whiteT = Math.max(this.whiteT, k * 2.2);
  }

  /** Danger markers for live frags near the player (screen rotation angles). */
  grenades(angles: number[]) {
    while (this.nadeEl.childElementCount < angles.length) el('i', '', this.nadeEl, '!');
    [...this.nadeEl.children].forEach((c, i) => {
      const e = c as HTMLElement;
      e.style.display = i < angles.length ? '' : 'none';
      if (i < angles.length) e.style.transform = `rotate(${angles[i]}rad)`;
    });
  }

  /** Big pre-match countdown; null hides it. */
  countdown(text: string | null) {
    if (!text) {
      this.countEl.className = 'count';
      return;
    }
    this.countEl.innerHTML = text === 'GO' ? 'GO!' : `${text}<small>MATCH STARTING</small>`;
    this.countEl.className = 'count';
    void this.countEl.offsetWidth; // restart the pop animation
    this.countEl.className = 'count on';
  }

  matchBar(html: string) {
    if (this.match.innerHTML !== html) this.match.innerHTML = html;
  }

  /** Name tags in screen pixels. */
  tags(list: { x: number; y: number; text: string; friendly: boolean }[]) {
    while (this.tagEls.length < list.length) this.tagEls.push(el('div', '', this.tagLayer));
    this.tagEls.forEach((e, i) => {
      const t = list[i];
      if (!t) {
        e.style.display = 'none';
        return;
      }
      e.style.display = '';
      e.className = t.friendly ? 'f' : 'e';
      e.textContent = t.text;
      e.style.left = `${t.x}px`;
      e.style.top = `${t.y}px`;
    });
  }

  private boardShown = false;
  private boardKey = '';
  /** Only touches the DOM when visibility or the board contents (by key) change. */
  scoreboardTable(show: boolean, key = '', build?: () => string) {
    if (show !== this.boardShown) {
      this.boardShown = show;
      this.board.style.display = show ? 'flex' : 'none';
    }
    if (show && build && key !== this.boardKey) {
      this.boardKey = key;
      this.board.innerHTML = build();
    }
  }

  endScreen(html: string | null, onContinue?: () => void) {
    this.end.style.display = html ? 'flex' : 'none';
    if (!html) return;
    this.end.innerHTML = html + '<button type="button">CONTINUE</button>';
    this.end.querySelector('button')!.addEventListener('click', () => onContinue?.());
  }

  update(dt: number, health: number, attackerAngle: (a: number) => number) {
    this.hitT -= dt;
    this.hit.style.opacity = this.hitT > 0 ? '1' : '0';
    this.whiteT = Math.max(0, this.whiteT - dt);
    this.white.style.opacity = String(Math.min(1, this.whiteT));
    if (this.earnT > 0) {
      this.earnT -= dt;
      if (this.earnT <= 0 && this.earnQueue.length) this.streakEarned(...this.earnQueue.shift()!);
    }
    if (this.rankT > 0) {
      this.rankT -= dt;
      if (this.rankT <= 0) {
        this.rankEl.classList.remove('show');
        if (this.rankQueue.length) this.rankUp(...this.rankQueue.shift()!);
      }
    }
    this.bannerT -= dt;
    if (this.bannerT <= 0 && this.bannerQueue.length) {
      const [t, s, secs] = this.bannerQueue.shift()!;
      this.showBanner(t, s, secs);
    }
    this.banner.style.opacity = this.bannerT > 0 ? '1' : '0';
    this.vignette.style.opacity = String(Math.min(1, ((100 - health) / 100) * 1.3));
    for (const a of this.dmgArcs) {
      a.t -= dt;
      a.e.style.opacity = String(Math.max(0, Math.min(1, a.t)));
      a.e.style.transform = `rotate(${attackerAngle(a.angle)}rad)`;
    }
    this.dmgArcs = this.dmgArcs.filter((a) => {
      if (a.t <= 0) a.e.remove();
      return a.t > 0;
    });
  }

  /** Rotating radar: player-up, enemies shown when they fire or during SWEEP. */
  minimap(boxes: Box[], half: number, px: number, pz: number, yaw: number, enemies: MapMarker[], sweepK: number) {
    const c = this.mapCtx;
    const S = 168;
    const scale = 2.6; // px per metre
    c.clearRect(0, 0, S, S);
    c.save();
    c.translate(S / 2, S / 2);
    c.rotate(yaw);
    c.scale(scale, scale);
    c.translate(-px, -pz);
    c.fillStyle = 'rgba(190,200,170,0.45)';
    for (const b of boxes) {
      if (b.max.y < 0.5 || b.max.x - b.min.x > half) continue;
      c.fillRect(b.min.x, b.min.z, b.max.x - b.min.x, b.max.z - b.min.z);
    }
    c.strokeStyle = 'rgba(190,200,170,0.7)';
    c.lineWidth = 0.6;
    c.strokeRect(-half, -half, half * 2, half * 2);
    for (const e of enemies) {
      c.fillStyle = e.color;
      c.beginPath();
      c.arc(e.x, e.z, 1.1, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
    if (sweepK > 0) {
      c.strokeStyle = `rgba(160,255,120,${0.5 * sweepK})`;
      c.beginPath();
      c.arc(S / 2, S / 2, ((performance.now() / 8) % 120) + 4, 0, Math.PI * 2);
      c.stroke();
    }
    // player arrow
    c.fillStyle = '#f2e9c8';
    c.beginPath();
    c.moveTo(S / 2, S / 2 - 7);
    c.lineTo(S / 2 + 5, S / 2 + 5);
    c.lineTo(S / 2, S / 2 + 2);
    c.lineTo(S / 2 - 5, S / 2 + 5);
    c.fill();
  }
}

/** Emblem for an attachment unlock: a hexagon with a glyph for the part type. */
export function attachIcon(kind: 'optic' | 'muzzle' | 'under' | 'mag' | 'sidearm'): string {
  const glyph = {
    optic: '<circle cx="64" cy="64" r="22" fill="none" stroke="#e8f4ff" stroke-width="6"/><path d="M64 34v16M64 78v16M34 64h16M78 64h16" stroke="#e8f4ff" stroke-width="5"/>',
    muzzle: '<rect x="30" y="52" width="68" height="24" rx="5" fill="#e8f4ff"/><path d="M44 52v24M58 52v24M72 52v24" stroke="#1d3550" stroke-width="4"/><rect x="96" y="58" width="10" height="12" fill="#e8f4ff"/>',
    under: '<rect x="30" y="38" width="68" height="14" rx="3" fill="#e8f4ff"/><path d="M56 52h18l-4 42h-12z" fill="#e8f4ff"/>',
    mag: '<path d="M50 30h28l-2 22c6 14 10 28 6 44H52c-4-16 0-30-2-44z" fill="#e8f4ff"/><path d="M54 40h20" stroke="#1d3550" stroke-width="4"/>',
    sidearm: '<path d="M30 44h66v16H60l-6 30H40l4-30H30z" fill="#e8f4ff"/>',
  }[kind];
  return `<div class="unl"><svg viewBox="0 0 128 128"><path d="M64 6l52 29v58l-52 29-52-29V35z" fill="#1d3550" stroke="#7ec8ff" stroke-width="5"/>${glyph}</svg></div>`;
}

/** Emblem for a camo unlock: the camo itself in a gold ring. */
export const camoIcon = (swatch: string) => `<div class="unl"><div class="disc" style="background:${swatch}"></div></div>`;
