/*
  Hero scene.
  What it says: an idea grows from a seed (intro), collaborators orbit it,
  and the founder approves them one at a time (nodes turn brass, link lights up).
  Interaction: pointer tilts the scene, hovering a node highlights it, scrolling
  rotates and lifts it. Reduced motion renders one static frame.
*/
(function () {
  var mount = document.getElementById("hero-3d");
  if (!mount || typeof THREE === "undefined") { if (mount) mount.classList.add("no-webgl"); return; }

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch (e) { mount.classList.add("no-webgl"); return; }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  mount.appendChild(renderer.domElement);

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  var root = new THREE.Group();
  scene.add(root);

  var INK = new THREE.Color("#F2F0E8");
  var DIM = new THREE.Color("#8F8E94");
  var BRASS = new THREE.Color("#E8A33D");

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  var rnd = mulberry32(11);

  /* ---------- Sprout as a point cloud ---------- */
  var pts = [];
  function push(x, y, z, c) { pts.push({ x: x, y: y, z: z, c: c }); }
  function stemAt(t) { return { x: 0.28 * Math.sin(t * 2.2), y: -2.6 + t * 3.5, z: 0.18 * Math.cos(t * 2.0) }; }

  var i, a, r, t, p;
  for (i = 0; i < 950; i++) {
    t = Math.pow(rnd(), 0.9); p = stemAt(t);
    a = rnd() * Math.PI * 2; r = 0.05 * (1 - 0.45 * t) * Math.sqrt(rnd());
    push(p.x + Math.cos(a) * r, p.y, p.z + Math.sin(a) * r, DIM.clone().lerp(INK, t));
  }
  function leaf(at, yaw, len, wid, lift, droop, n, tint) {
    var o = stemAt(at), dx = Math.cos(yaw), dz = Math.sin(yaw), sx = -dz, sz = dx, k, u, v, w;
    for (k = 0; k < n; k++) {
      u = Math.pow(rnd(), 0.85); v = rnd() * 2 - 1;
      w = Math.pow(Math.sin(Math.PI * u), 0.75) * wid;
      push(
        o.x + dx * u * len + sx * v * w,
        o.y + lift * Math.sin(u * Math.PI * 0.85) - droop * u * u + Math.abs(v) * w * 0.25,
        o.z + dz * u * len + sz * v * w,
        DIM.clone().lerp(INK, 0.35 + 0.65 * u).lerp(BRASS, tint * u * (1 - Math.abs(v)))
      );
    }
  }
  leaf(0.78, 0.35, 2.1, 0.55, 0.9, 0.5, 900, 0.25);
  leaf(0.78, Math.PI + 0.25, 1.9, 0.5, 0.8, 0.45, 800, 0.25);
  leaf(0.45, Math.PI * 0.5 + 0.2, 1.3, 0.36, 0.5, 0.3, 420, 0.1);
  leaf(0.35, -Math.PI * 0.5 + 0.1, 1.2, 0.34, 0.45, 0.3, 380, 0.1);
  function ball(cx, cy, cz, rad, n, col) {
    var k, th, ph, rr;
    for (k = 0; k < n; k++) {
      th = rnd() * Math.PI * 2; ph = Math.acos(2 * rnd() - 1); rr = rad * Math.cbrt(rnd());
      push(cx + rr * Math.sin(ph) * Math.cos(th), cy + rr * Math.sin(ph) * Math.sin(th), cz + rr * Math.cos(ph), col);
    }
  }
  ball(0, -2.72, 0, 0.2, 220, BRASS);          /* the seed */
  var crown = stemAt(1);
  ball(crown.x, crown.y + 0.1, crown.z, 0.16, 140, BRASS);

  pts.sort(function (m, n) { return m.y - n.y; });   /* bottom to top so draw range reads as growth */
  var N = pts.length, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  for (i = 0; i < N; i++) {
    pos[i * 3] = pts[i].x; pos[i * 3 + 1] = pts[i].y; pos[i * 3 + 2] = pts[i].z;
    col[i * 3] = pts[i].c.r; col[i * 3 + 1] = pts[i].c.g; col[i * 3 + 2] = pts[i].c.b;
  }
  var geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  var cloud = new THREE.Points(geo, new THREE.PointsMaterial({
    size: 0.05, vertexColors: true, transparent: true, opacity: 0.95, sizeAttenuation: true, depthWrite: false
  }));
  root.add(cloud);

  /* ---------- Collaborators ---------- */
  var center = new THREE.Vector3(crown.x, crown.y + 0.1, crown.z);
  var core = new THREE.Mesh(new THREE.SphereGeometry(0.12, 24, 24), new THREE.MeshBasicMaterial({ color: BRASS }));
  core.position.copy(center);
  root.add(core);

  var NODES = 6, nodes = [];
  var sphereGeo = new THREE.SphereGeometry(0.085, 20, 20);
  for (i = 0; i < NODES; i++) {
    var mesh = new THREE.Mesh(sphereGeo, new THREE.MeshBasicMaterial({ color: DIM.clone() }));
    root.add(mesh);
    nodes.push({
      mesh: mesh,
      radius: 2.0 + rnd() * 1.3,
      tilt: (rnd() - 0.5) * 1.1,
      speed: 0.12 + rnd() * 0.12,
      phase: (i / NODES) * Math.PI * 2,
      amount: 0,         /* 0 = pending, 1 = approved (eased) */
      hover: 0
    });
  }
  var linePos = new Float32Array(NODES * 6), lineCol = new Float32Array(NODES * 6);
  var lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute("position", new THREE.BufferAttribute(linePos, 3));
  lineGeo.setAttribute("color", new THREE.BufferAttribute(lineCol, 3));
  var lines = new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.8 }));
  root.add(lines);

  function placeNode(n, time) {
    var th = n.phase + time * n.speed;
    return {
      x: center.x + Math.cos(th) * n.radius,
      y: center.y + Math.sin(th) * n.radius * 0.55 * Math.cos(n.tilt) + Math.sin(th * 0.5) * 0.25,
      z: center.z + Math.sin(th) * n.radius * Math.cos(n.tilt) * 0.9
    };
  }

  /* ---------- Sizing ---------- */
  function resize() {
    var w = mount.clientWidth || 1, h = mount.clientHeight || 1;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.position.set(0, 0.15, w / h < 0.9 ? 11.5 : 9);
    camera.lookAt(0, -0.1, 0);
    camera.updateProjectionMatrix();
  }
  resize();
  if (window.ResizeObserver) new ResizeObserver(resize).observe(mount); else window.addEventListener("resize", resize);

  /* ---------- Pointer ---------- */
  var pointer = { x: 0, y: 0, tx: 0, ty: 0, inside: false };
  var ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), hovered = -1;
  if (!reduce) {
    mount.addEventListener("pointermove", function (e) {
      var rc = mount.getBoundingClientRect();
      ndc.x = ((e.clientX - rc.left) / rc.width) * 2 - 1;
      ndc.y = -((e.clientY - rc.top) / rc.height) * 2 + 1;
      pointer.tx = ndc.x; pointer.ty = ndc.y; pointer.inside = true;
    });
    mount.addEventListener("pointerleave", function () { pointer.tx = 0; pointer.ty = 0; pointer.inside = false; });
  }

  /* ---------- Frame ---------- */
  var INTRO = 2.4, tmpColor = new THREE.Color();
  function easeOut(x) { return 1 - Math.pow(1 - x, 3); }

  function frame(time) {
    var grow = reduce ? 1 : easeOut(Math.min(time / INTRO, 1));
    geo.setDrawRange(0, Math.max(1, Math.floor(N * grow)));

    var reveal = reduce ? 1 : Math.min(Math.max((time - INTRO * 0.8) / 0.9, 0), 1);
    var step = 0, approvedCount = 0;
    if (reduce) { approvedCount = 2; }
    else if (time > INTRO + 0.6) {
      step = Math.floor((time - INTRO - 0.6) / 1.7) % (NODES + 2);
      approvedCount = step <= NODES ? step : 0;
    }

    var scrollY = window.scrollY || 0;
    pointer.x += (pointer.tx - pointer.x) * 0.06;
    pointer.y += (pointer.ty - pointer.y) * 0.06;
    root.rotation.y = (reduce ? 0.35 : time * 0.1) + pointer.x * 0.4 + scrollY * 0.0016;
    root.rotation.x = -pointer.y * 0.16;
    root.position.y = Math.min(scrollY * 0.003, 1.4);

    if (!reduce && pointer.inside) {
      ray.setFromCamera(ndc, camera);
      var hit = ray.intersectObjects(nodes.map(function (n) { return n.mesh; }), false);
      hovered = hit.length ? nodes.findIndex(function (n) { return n.mesh === hit[0].object; }) : -1;
      mount.style.cursor = hovered > -1 ? "pointer" : "";
    } else { hovered = -1; }

    for (var k = 0; k < NODES; k++) {
      var n = nodes[k], q = placeNode(n, reduce ? 3 : time);
      n.amount += ((k < approvedCount ? 1 : 0) - n.amount) * 0.08;
      n.hover += ((k === hovered ? 1 : 0) - n.hover) * 0.15;
      n.mesh.position.set(q.x, q.y, q.z);
      n.mesh.scale.setScalar(reveal * (1 + n.hover * 0.9 + n.amount * 0.35));
      tmpColor.copy(DIM).lerp(INK, 0.35 + n.hover * 0.65).lerp(BRASS, n.amount);
      n.mesh.material.color.copy(tmpColor);

      linePos[k * 6] = center.x; linePos[k * 6 + 1] = center.y; linePos[k * 6 + 2] = center.z;
      linePos[k * 6 + 3] = q.x; linePos[k * 6 + 4] = q.y; linePos[k * 6 + 5] = q.z;
      var lc = new THREE.Color(0x3a3a42).lerp(BRASS, Math.max(n.amount, n.hover * 0.7)).multiplyScalar(reveal);
      lineCol[k * 6] = lineCol[k * 6 + 3] = lc.r;
      lineCol[k * 6 + 1] = lineCol[k * 6 + 4] = lc.g;
      lineCol[k * 6 + 2] = lineCol[k * 6 + 5] = lc.b;
    }
    lineGeo.attributes.position.needsUpdate = true;
    lineGeo.attributes.color.needsUpdate = true;
    core.scale.setScalar(grow > 0.9 ? 1 + 0.12 * Math.sin(time * 2.2) : 0.001);

    renderer.render(scene, camera);
  }

  if (reduce) { frame(10); return; }

  /* Loop only while the hero is on screen and the tab is visible. */
  var running = false, visible = true, start = performance.now();
  function loop(now) {
    if (!running) return;
    frame((now - start) / 1000);
    requestAnimationFrame(loop);
  }
  function sync() {
    var should = visible && !document.hidden;
    if (should && !running) { running = true; requestAnimationFrame(loop); }
    if (!should) running = false;
  }
  if (window.IntersectionObserver) {
    new IntersectionObserver(function (es) { visible = es[0].isIntersecting; sync(); }, { threshold: 0 }).observe(mount);
  }
  document.addEventListener("visibilitychange", sync);
  sync();
})();
