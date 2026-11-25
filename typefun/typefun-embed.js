/* typefun-embed.js — kinetic type background for any element. Same engine as https://eugeneshemchuk.github.io/typefun/
 * Usage: <canvas data-typefun='{"effect":"swirl","text":"HELLO"}' style="position:absolute;inset:0;width:100%;height:100%"></canvas>
 *        <script src="https://eugeneshemchuk.github.io/typefun/typefun-embed.js" defer></script>
 * JS API: var fx = TypeFun.mount(canvasEl, params); fx.set({ink:"#fff"}); fx.destroy();
 * Canvas has pointer-events:none; the cursor is read from the window, so content on top stays clickable. MIT. */
(function () {
  var FONTS = {
    mono: "ui-monospace, SFMono-Regular, Menlo, monospace", courier: "'Courier New', Courier, monospace",
    helvetica: "'Helvetica Neue', Helvetica, Arial, sans-serif", impact: "Impact, 'Arial Black', sans-serif",
    georgia: "Georgia, serif", times: "'Times New Roman', Times, serif", futura: "Futura, 'Avenir Next', sans-serif",
    didot: "Didot, 'Bodoni 72', 'Bodoni MT', serif", rockwell: "Rockwell, 'American Typewriter', serif",
    marker: "'Marker Felt', 'Comic Sans MS', cursive", chalk: "Chalkduster, 'Bradley Hand', cursive",
    copperplate: "Copperplate, 'Copperplate Gothic Light', fantasy",
    system: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
  };
  var DEFAULTS = {
    text: "HELLO WORLD!", effect: "lookaway", font: "mono", size: 15, weight: 600, line: 1.55, spacing: 0,
    sizeMix: 0, caseMode: "upper", seed: 1,
    radius: 150, strength: 1, spring: .015, damping: .86, tilt: 0, regrow: 6, gravity: .45, pileMax: .5, calm: 2.5,
    guiltRate: 1, jitter: 0, wave: 0, breathe: 0, spin: 0, slide: 0, glitch: 0, trail: 0,
    flow: 0, flowSpeed: .5, palette: "rainbow", blobs: 0, bg: "#2b313a", ink: "#cdd2d8", guilt: "#ff4637"
  };
  var PALETTES = {
    sunset: ["#2d1b69", "#b0306a", "#ff6b3d", "#ffd23f"], electric: ["#00f0ff", "#7a5cff", "#ff2bd6"],
    mint: ["#0b3d3a", "#21c7a8", "#c8ffe9"], ember: ["#3a0a00", "#ff4d00", "#ffb000"],
    ocean: ["#022b4a", "#0a7cc2", "#5fe0e6", "#e8fbff"], mono: ["#444444", "#ffffff"],
    heat: ["#4f86ff", "#ffd23f", "#ff8a00", "#ff1500"]
  };
  function r(a, b) { return a + Math.random() * (b - a); }
  function rgb(h) { h = h.slice(1); return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)]; }
  function hslRgb(h, s, l) {
    s /= 100; l /= 100; var a = s * Math.min(l, 1 - l);
    function f(n) { var k = (n + h / 30) % 12; return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); }
    return [f(0), f(8), f(4)];
  }

  function mount(cv, params) {
    if (cv.__typefun) cv.__typefun.destroy();
    var S = Object.assign({}, DEFAULTS, params || {}); if (!FONTS[S.font]) S.font = "mono";
    var x = cv.getContext("2d"), alive = true, visible = true, raf = 0;
    var reduced = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    cv.style.pointerEvents = "none"; if (!cv.style.display) cv.style.display = "block";
    var palCache = {};
    function palette(t) {
      t = ((t % 1) + 1) % 1;
      if (S.palette === "rainbow" || !PALETTES[S.palette]) return hslRgb(t * 360, 85, 62);
      var st = palCache[S.palette] || (palCache[S.palette] = PALETTES[S.palette].map(rgb)), n = st.length;
      var f = t * n, i = Math.floor(f) % n, j = (i + 1) % n, u = f - Math.floor(f); u = u * u * (3 - 2 * u);
      return [st[i][0] + (st[j][0] - st[i][0]) * u, st[i][1] + (st[j][1] - st[i][1]) * u, st[i][2] + (st[j][2] - st[i][2]) * u];
    }
    var dpr, W, H, cw, ch, cols, N = 0, G, gs, grow, gx, gy, ox, oy, vx, vy, rot, vr, heat, state, born, fx, fy, fvx, fvy, fr, fvr, pile, heights, fontStr;
    var mouse = { x: -1e4, y: -1e4, on: false }, taps = [], prev = performance.now(), sec = 0, nextHeat = 0;
    var busy = 0, still = 0, lastX = 0, lastY = 0, rowGlitch = [], lastStyle = "", hcX = 0, hcY = 0, HW = {};
    function rnd(i) { var v = Math.sin((i + S.seed * 7.31) * 12.9898) * 43758.5453; return v - Math.floor(v); }

    function setup() {
      var rect = cv.getBoundingClientRect();
      dpr = Math.min(devicePixelRatio || 1, 2); W = Math.max(1, rect.width); H = Math.max(1, rect.height);
      cv.width = W * dpr; cv.height = H * dpr; x.setTransform(dpr, 0, 0, dpr, 0, 0);
      fontStr = S.weight + " " + S.size + "px " + FONTS[S.font]; x.font = fontStr; HW = {}; hcX = W / 2; hcY = H / 2;
      var t = (S.text || "").replace(/\s+/g, " ").trim() || " ";
      if (S.caseMode === "upper") t = t.toUpperCase(); else if (S.caseMode === "lower") t = t.toLowerCase();
      var P = t.length === 1 ? t : t + " ", L = P.length;  // one glyph repeats as a clean grid
      cw = Math.max(2, x.measureText("M").width + S.spacing); ch = Math.max(2, S.size * S.line); cols = Math.ceil(W / cw);
      var adv = {}, ax = [], ay = [], ag = [], as = [], ar = [], cx = 0, cy = S.size, row = 0, k = 0;
      while (cy < H + ch * 2 && k < 20000) {
        var c = P[k % L];
        if (S.caseMode === "mixed") c = rnd(k + 3) < .5 ? c.toLowerCase() : c.toUpperCase();
        var s = S.sizeMix ? Math.exp(S.sizeMix * 1.4 * (rnd(k) * 2 - 1)) : 1;
        if (adv[c] === undefined) adv[c] = x.measureText(c).width;
        var w = Math.max(1, adv[c] * s + S.spacing);
        if (cx + w > W + cw && cx > 0) { cx = 0; cy += ch; row++; continue; }
        ax.push(cx); ay.push(cy); ag.push(c); as.push(s); ar.push(row); cx += w; k++;
      }
      N = ax.length; G = ag; gs = Float32Array.from(as); grow = Int16Array.from(ar); gx = Float32Array.from(ax); gy = Float32Array.from(ay);
      resetPhysics(); if (reduced) render(0);
    }
    function resetPhysics() {
      ox = new Float32Array(N); oy = new Float32Array(N); vx = new Float32Array(N); vy = new Float32Array(N);
      rot = new Float32Array(N); vr = new Float32Array(N); heat = new Float32Array(N); state = new Uint8Array(N);
      born = new Float32Array(N).fill(-99); fx = new Float32Array(N); fy = new Float32Array(N); fvx = new Float32Array(N);
      fvy = new Float32Array(N); fr = new Float32Array(N); fvr = new Float32Array(N); pile = []; heights = new Float32Array(cols + 2);
      still = 0; busy = 0; taps = []; rowGlitch = [];
    }
    function local(e) {
      var b = cv.getBoundingClientRect(), px = e.clientX - b.left, py = e.clientY - b.top;
      return [px, py, px >= 0 && py >= 0 && px <= b.width && py <= b.height];
    }
    function onMove(e) { var p = local(e); mouse.x = p[0]; mouse.y = p[1]; mouse.on = p[2]; }
    function onDown(e) {
      var p = local(e); if (!p[2]) return; onMove(e);
      taps.push([p[0], p[1], sec]); if (taps.length > 8) taps.shift();
      if (S.effect === "explode") {
        var R = S.radius;
        for (var i = 0; i < N; i++) {
          var dx = gx[i] + ox[i] - p[0], dy = gy[i] + oy[i] - p[1], d = Math.hypot(dx, dy) + .01;
          if (d < R) { var f = (1 - d / R) * 38 * S.strength; vx[i] += dx / d * f * r(.6, 1.2); vy[i] += dy / d * f * r(.6, 1.2) - f * .3; vr[i] += r(-.6, .6) * (1 - d / R); }
        }
      }
    }
    function onLeave() { mouse.on = false; }
    function onUp(e) { if (e.pointerType !== "mouse") mouse.on = false; }
    addEventListener("pointermove", onMove, { passive: true }); addEventListener("pointerdown", onDown, { passive: true });
    addEventListener("pointerup", onUp, { passive: true }); document.addEventListener("pointerleave", onLeave);
    var ro = window.ResizeObserver ? new ResizeObserver(setup) : null; if (ro) ro.observe(cv); else addEventListener("resize", setup);
    var io = window.IntersectionObserver ? new IntersectionObserver(function (en) { visible = en[0].isIntersecting; }) : null; if (io) io.observe(cv);

    function heatOne() { var s = Math.floor(Math.random() * N), len = Math.floor(r(6, 30)); for (var k = 0; k < len && s + k < N; k++) heat[s + k] = Math.min(1, heat[s + k] + .5); }

    function frame(now) {
      if (!alive) return; raf = requestAnimationFrame(frame);
      var dt = Math.min(.05, (now - prev) / 1000); prev = now;
      if (!visible || !N || reduced || document.hidden) return;
      render(dt);
    }
    function render(dt) {
      sec += dt; var mode = S.effect, i;
      if (S.guiltRate > 0 && sec > nextHeat) { heatOne(); nextHeat = sec + Math.max(.3, 3.2 - sec / 60) / S.guiltRate; }
      for (i = 0; i < N; i++) heat[i] *= S.guiltRate > 0 ? 1 : .98;
      var sp = Math.hypot(mouse.x - lastX, mouse.y - lastY); lastX = mouse.x; lastY = mouse.y;
      var R = S.radius, pull = 0;
      if (mode === "closing") {
        busy = Math.min(1, busy + sp * .004);
        if (sp < 1) still += dt; else still = Math.max(0, still - dt * 4);
        if (still > S.calm) busy = Math.max(0, busy - dt * .35);
        R = S.radius * busy; pull = Math.max(0, Math.min(1, (still - S.calm - 2) / 6));
      }
      if (S.glitch > 0 && Math.random() < S.glitch * .25) rowGlitch.push([Math.floor(r(0, H / ch + 2)), r(-1, 1) * (40 + 200 * S.glitch), sec + r(.05, .3)]);
      rowGlitch = rowGlitch.filter(function (g) { return g[2] > sec; });
      var gOff = {}; rowGlitch.forEach(function (g) { gOff[g[0]] = g[1]; });

      x.setTransform(dpr, 0, 0, dpr, 0, 0);
      x.globalAlpha = S.trail > 0 ? 1 - S.trail : 1; x.fillStyle = S.bg; x.fillRect(0, 0, W, H);
      if (S.blobs > 0) {
        x.globalCompositeOperation = "lighter";
        var bh = sec * S.flowSpeed * 25, rad = Math.max(W, H) * .55;
        for (var b = 0; b < 4; b++) {
          var bx = W * (.5 + .45 * Math.sin(sec * .21 * (b + 1) + b * 2.1)), by = H * (.5 + .45 * Math.cos(sec * .17 * (b + 1.3) + b));
          var bc = palette(bh / 360 + b * .25).map(function (v) { return v | 0; }), gr = x.createRadialGradient(bx, by, 0, bx, by, rad);
          gr.addColorStop(0, "rgba(" + bc + "," + (S.blobs * .45 * (S.trail > 0 ? 1 - S.trail : 1)) + ")"); gr.addColorStop(1, "rgba(" + bc + ",0)");
          x.fillStyle = gr; x.fillRect(0, 0, W, H);
        }
        x.globalCompositeOperation = "source-over";
      }
      x.globalAlpha = 1; x.font = fontStr; x.textBaseline = "alphabetic"; lastStyle = "";

      var INK = rgb(S.ink), GU = rgb(S.guilt);
      if (mode === "rubble") for (var p = 0; p < pile.length; p++) { var q = pile[p]; draw(q[2], q[0], q[1], q[3], 1, 1, q[4], q[0], q[1]); }
      var mx = mouse.on ? mouse.x : -1e4, my = mouse.on ? mouse.y : -1e4, R2 = R * R, k8 = S.strength;
      var pad = cw * 3, W2 = W + pad, curW = S.weight, HS = null;
      if (mode === "heat") {                  // heat: field follows the pointer, wanders when there is none
        var htx = mouse.on ? mouse.x : W * (.5 + .32 * Math.sin(sec * .37)), hty = mouse.on ? mouse.y : H * (.5 + .3 * Math.sin(sec * .53 + 1));
        hcX += (htx - hcX) * (mouse.on ? .35 : .05); hcY += (hty - hcY) * (mouse.on ? .35 : .05);
        HS = [INK].concat(PALETTES[S.palette] ? (palCache[S.palette] || (palCache[S.palette] = PALETTES[S.palette].map(rgb)))
          : [hslRgb(200, 90, 60), hslRgb(120, 80, 55), hslRgb(55, 95, 58), hslRgb(25, 100, 55), hslRgb(0, 100, 50)]);
      }

      for (i = 0; i < N; i++) {
        var c = G[i], row = grow[i], s = gs[i], hx = gx[i], hy = gy[i];
        if (S.slide) { var dir = row % 2 ? 1 : -1; hx = ((hx + dir * S.slide * 40 * sec * (1 + (row % 3) * .35) + pad) % W2 + W2) % W2 - pad; }
        if (S.wave) { hx += Math.sin(gy[i] * .02 + sec * 1.1) * 14 * S.wave; hy += Math.cos(gx[i] * .015 + sec * .8) * 9 * S.wave; }
        if (gOff[row]) hx += gOff[row];
        if (S.breathe) s *= 1 + Math.sin(sec * 2 + i * .21) * .25 * S.breathe;

        if (mode === "rubble") {
          if (state[i] === 0) {
            var ddx = hx - mx, ddy = hy - S.size * .35 * s - my;
            if (c !== " " && ddx * ddx + ddy * ddy < R2) {
              state[i] = 1; fx[i] = hx; fy[i] = hy; var dd = Math.sqrt(ddx * ddx + ddy * ddy) + .01;
              fvx[i] = (ddx / dd * 3 + r(-1, 1)) * k8; fvy[i] = (ddy / dd * 2 - 2) * k8; fr[i] = 0; fvr[i] = r(-.15, .15);
              continue;
            }
            if (c === " ") continue;
            draw(c, hx, hy, spinOf(i), heat[i], Math.min(1, (sec - born[i]) / 1.5), s, hx, hy);
          } else if (state[i] === 1) {
            fvy[i] += S.gravity; fx[i] += fvx[i]; fy[i] += fvy[i]; fr[i] += fvr[i]; fvx[i] *= .99;
            if (fx[i] < 0) { fx[i] = 0; fvx[i] *= -.5; } if (fx[i] > W - cw) { fx[i] = W - cw; fvx[i] *= -.5; }
            var col = Math.max(0, Math.min(cols + 1, Math.round(fx[i] / cw))), floor = H - heights[col];
            if (fy[i] >= floor) {
              if (heights[col] < H * S.pileMax) { pile.push([fx[i], floor, c, fr[i] % .6, s]); heights[col] += S.size * .55 * s; }
              state[i] = 2; born[i] = sec;
            } else draw(c, fx[i], fy[i], fr[i], .6, 1, s, fx[i], fy[i]);
          } else if (sec - born[i] > S.regrow) { state[i] = 0; born[i] = sec; }
          continue;
        }
        if (mode === "heat") {
          if (c === " ") continue;
          var tq = Math.max(0, 1 - Math.hypot(hx + cw * .3 - hcX, hy - S.size * .35 * s - hcY) / R); tq = tq * tq * (3 - 2 * tq);
          fx[i] += (tq - fx[i]) * (dt ? .16 : 1); heatGlyph(c, hx, hy, fx[i], s);
          continue;
        }

        var px = hx + ox[i], py = hy - S.size * .35 * s + oy[i];
        var dx = px - mx, dy = py - my, d = Math.sqrt(dx * dx + dy * dy) + .001;
        if (mode !== "ripple" && mode !== "explode" && mode !== "none" && d < R) {
          var f = 1 - d / R; f = f * f;
          if (mode === "swirl") { vx[i] += (-dy / d * 3.2 + dx / d * 1.4) * f * 3 * k8; vy[i] += (dx / d * 3.2 + dy / d * 1.4) * f * 3 * k8; }
          else if (mode === "magnet") { vx[i] -= dx / d * f * 4 * k8; vy[i] -= dy / d * f * 4 * k8; }
          else { var m = mode === "closing" ? 7 : 9; vx[i] += dx / d * f * m * k8; vy[i] += dy / d * f * m * k8; }
        }
        if (pull > 0) { var hd = Math.hypot(hx - mx, hy - my); if (hd < 320) { var kk = pull * (1 - hd / 320) * .9 * k8; vx[i] -= dx / d * kk; vy[i] -= dy / d * kk; } }
        if (mode === "ripple") {
          for (var t = 0; t < taps.length; t++) {
            var age = sec - taps[t][2]; if (age > 3) continue;
            var tx = px - taps[t][0], ty = py - taps[t][1], td = Math.hypot(tx, ty) + .01, ringR = age * 520;
            var band = Math.exp(-Math.pow((td - ringR) / S.radius, 2)) * (1 - age / 3);
            if (band > .01) { vx[i] += tx / td * band * 5 * k8; vy[i] += ty / td * band * 5 * k8; }
          }
        }
        if (S.jitter) { var jj = S.jitter * (.3 + heat[i]) * 1.2; vx[i] += r(-.5, .5) * jj; vy[i] += r(-.5, .5) * jj; }
        vx[i] += -ox[i] * S.spring; vy[i] += -oy[i] * S.spring;
        vx[i] *= S.damping; vy[i] *= S.damping; ox[i] += vx[i]; oy[i] += vy[i];
        vr[i] += -rot[i] * S.spring * 2; vr[i] *= S.damping; rot[i] += vr[i];
        if (c === " ") continue;

        var off = Math.min(1, Math.hypot(ox[i], oy[i]) / (mode === "swirl" ? 140 : 90));
        var h = heat[i], alpha = 1, sc = s;
        if (mode === "lookaway" || mode === "swirl") alpha = 1 - off * (mode === "swirl" ? .75 : .85);
        if (mode === "magnet") { h = Math.max(h, off * .9); sc *= 1 + off * .6; }
        if (mode === "closing") {
          var near = Math.max(0, 1 - Math.hypot(hx + ox[i] - mx, hy + oy[i] - my) / 360);
          h = Math.max(h, Math.min(1, pull * near * 1.6 + Math.max(0, still - S.calm) / 30 * .3));
          if (h > .3) sc *= 1 + (h - .3) * .5;
        }
        var ang = rot[i] + spinOf(i) + (S.tilt && off > .05 ? Math.atan2(vy[i], vx[i]) * off * S.tilt : 0);
        var X = hx + ox[i], Y = hy + oy[i];
        if (gOff[row] && S.glitch) {
          x.globalCompositeOperation = "lighter";
          drawRaw(c, X - 4, Y, ang, sc, "rgba(255,0,80,.6)"); drawRaw(c, X + 4, Y, ang, sc, "rgba(0,220,255,.6)");
          x.globalCompositeOperation = "source-over";
        }
        draw(c, X, Y, ang, h, alpha, sc, X, Y);
      }
      x.setTransform(dpr, 0, 0, dpr, 0, 0);

      function heatGlyph(c, X, Y, t, s) {
        var wq = Math.round((S.weight + (900 - S.weight) * Math.min(1, t * S.strength)) / 25) * 25;
        var w0 = HW[c + "|" + S.weight];
        if (w0 === undefined) { x.font = fontStr; curW = S.weight; w0 = HW[c + "|" + S.weight] = x.measureText(c).width; }
        if (wq !== curW) { x.font = wq + " " + S.size + "px " + FONTS[S.font]; curW = wq; }
        var w1 = HW[c + "|" + wq]; if (w1 === undefined) w1 = HW[c + "|" + wq] = x.measureText(c).width;
        var n = HS.length - 1, f = Math.min(n - 1e-6, Math.max(0, t) * n), k = Math.floor(f), u = f - k, a = HS[k], b = HS[k + 1];
        drawRaw(c, X + (w0 - w1) / 2 * s, Y, 0, s, "rgb(" + ((a[0] + (b[0] - a[0]) * u) | 0) + "," + ((a[1] + (b[1] - a[1]) * u) | 0) + "," + ((a[2] + (b[2] - a[2]) * u) | 0) + ")");
      }
      function spinOf(j) { return S.spin ? Math.sin(sec * 1.7 + j * .73) * Math.PI * S.spin : 0; }
      function draw(ch_, X, Y, ang, h, a, sc, cx, cy) {
        var col = INK;
        if (S.flow > 0) {
          var fc = palette((cx / W) * .55 + (cy / H) * .25 + sec * S.flowSpeed * .17);
          col = [INK[0] + (fc[0] - INK[0]) * S.flow, INK[1] + (fc[1] - INK[1]) * S.flow, INK[2] + (fc[2] - INK[2]) * S.flow];
        }
        drawRaw(ch_, X, Y, ang, sc, "rgba(" + ((col[0] + (GU[0] - col[0]) * h) | 0) + "," + ((col[1] + (GU[1] - col[1]) * h) | 0) + "," +
          ((col[2] + (GU[2] - col[2]) * h) | 0) + "," + a.toFixed(2) + ")");
      }
    }
    function drawRaw(c, X, Y, ang, sc, style) {
      if (style !== lastStyle) { x.fillStyle = style; lastStyle = style; }
      sc = Math.round(sc * 16) / 16; ang = Math.round(ang * 24) / 24;
      if (ang || sc !== 1) { var co = Math.cos(ang) * sc * dpr, si = Math.sin(ang) * sc * dpr; x.setTransform(co, si, -si, co, X * dpr, Y * dpr); x.fillText(c, 0, 0); x.setTransform(dpr, 0, 0, dpr, 0, 0); }
      else x.fillText(c, X, Y);
    }

    setup(); raf = requestAnimationFrame(frame);
    var api = {
      set: function (p) { Object.assign(S, p); setup(); },
      destroy: function () {
        alive = false; cancelAnimationFrame(raf); if (ro) ro.disconnect(); else removeEventListener("resize", setup); if (io) io.disconnect();
        removeEventListener("pointermove", onMove); removeEventListener("pointerdown", onDown); removeEventListener("pointerup", onUp);
        document.removeEventListener("pointerleave", onLeave); delete cv.__typefun;
      }
    };
    cv.__typefun = api; return api;
  }

  function auto() {
    document.querySelectorAll("canvas[data-typefun]").forEach(function (el) {
      if (el.__typefun) return; var p = {}; try { p = JSON.parse(el.getAttribute("data-typefun") || "{}"); } catch (e) {}
      mount(el, p);
    });
  }
  window.TypeFun = { mount: mount, defaults: DEFAULTS };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", auto); else auto();
})();
