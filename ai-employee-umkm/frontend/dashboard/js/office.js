// Kantor virtual 3D (Three.js). Status staf dari API menggerakkan avatar (lihat avatars.js).
(function () {
  const container = document.getElementById('office3d');
  if (!window.THREE || !window.Avatars || !container) {
    if (container) container.innerHTML = `<p style="padding:24px">${window.I18N.t('dashboard.officeFailed')}</p>`;
    return;
  }
  const T = THREE;

  const scene = new T.Scene();
  scene.background = new T.Color(0xdfe3f4);
  const camera = new T.PerspectiveCamera(45, 1, 0.1, 100);
  const renderer = new T.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  scene.add(new T.HemisphereLight(0xffffff, 0x8892c8, 0.75));
  const sun = new T.DirectionalLight(0xffffff, 0.75);
  sun.position.set(6, 12, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -11; sun.shadow.camera.right = 11;
  sun.shadow.camera.top = 9; sun.shadow.camera.bottom = -9;
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 40;
  sun.shadow.bias = -0.0006;
  scene.add(sun);

  const std = (c, o) => new T.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.85 }, o || {}));
  const add = (geo, m, x, y, z, cast) => { const mesh = new T.Mesh(geo, m); mesh.position.set(x, y, z); mesh.receiveShadow = true; mesh.castShadow = Boolean(cast); scene.add(mesh); return mesh; };

  // Ruangan
  add(new T.BoxGeometry(16, 0.3, 11), std(0xf5f6fb), 0, -0.15, 0);
  add(new T.BoxGeometry(16, 4.6, 0.3), std(0x23306b), 0, 2.15, -5.5);
  add(new T.BoxGeometry(0.3, 4.6, 11), std(0x2c3a80), -8, 2.15, 0);
  // Jendela di dinding belakang
  [-5.2, 5.2].forEach((x) => {
    add(new T.BoxGeometry(2.6, 2.0, 0.08), std(0xbfe3ff, { emissive: 0x6fa8d8, emissiveIntensity: 0.5 }), x, 2.5, -5.32);
    add(new T.BoxGeometry(0.06, 2.0, 0.1), std(0xffffff), x, 2.5, -5.28);
  });
  // Papan nama
  const sc = document.createElement('canvas'); sc.width = 1024; sc.height = 192;
  const sctx = sc.getContext('2d');
  sctx.fillStyle = '#f2a516'; sctx.fillRect(0, 0, 1024, 192);
  sctx.fillStyle = '#161f4a'; sctx.font = '800 96px "Plus Jakarta Sans", Arial, sans-serif';
  sctx.textAlign = 'center'; sctx.textBaseline = 'middle'; sctx.fillText('OmniStaff AI', 512, 100);
  const signMesh = new T.Mesh(new T.PlaneGeometry(4.6, 0.86), new T.MeshBasicMaterial({ map: new T.CanvasTexture(sc) }));
  signMesh.position.set(0, 3.55, -5.32);
  scene.add(signMesh);
  // Tanaman
  [[-7.2, 4.4], [7.2, 4.4], [7.2, -4.4]].forEach(([x, z]) => {
    add(new T.CylinderGeometry(0.35, 0.28, 0.5, 16), std(0xc4633f), x, 0.25, z, true);
    [[0, 0.95, 0, 0.45], [0.2, 1.3, 0.1, 0.32], [-0.18, 1.25, -0.1, 0.34]].forEach(([dx, dy, dz, r]) => add(new T.SphereGeometry(r, 16, 12), std(0x2f9e6b), x + dx, dy, z + dz, true));
  });

  // Stasiun kerja
  const SPOTS = { cs: [-3.4, -1.0], inventory: [3.4, -1.0], finance: [-3.4, 2.7], marketing: [3.4, 2.7] };
  const stations = {};

  function makeLabel() {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 128;
    const texture = new T.CanvasTexture(canvas);
    const sprite = new T.Sprite(new T.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
    sprite.scale.set(3.4, 0.85, 1);
    sprite.renderOrder = 10;
    sprite.visible = false;
    return { canvas, texture, sprite };
  }

  function drawLabel(label, title, task, working) {
    const ctx = label.canvas.getContext('2d');
    ctx.clearRect(0, 0, 512, 128);
    ctx.fillStyle = 'rgba(22,31,74,0.92)';
    ctx.beginPath();
    ctx.moveTo(24, 4); ctx.lineTo(488, 4); ctx.quadraticCurveTo(508, 4, 508, 24);
    ctx.lineTo(508, 104); ctx.quadraticCurveTo(508, 124, 488, 124);
    ctx.lineTo(24, 124); ctx.quadraticCurveTo(4, 124, 4, 104); ctx.lineTo(4, 24); ctx.quadraticCurveTo(4, 4, 24, 4);
    ctx.fill();
    ctx.fillStyle = working ? '#5fe0c8' : '#b8c0e6';
    ctx.beginPath(); ctx.arc(34, 40, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '700 32px "Plus Jakarta Sans", Arial, sans-serif';
    ctx.fillText(title, 56, 50);
    ctx.fillStyle = '#d5daf3'; ctx.font = '400 26px "Plus Jakarta Sans", Arial, sans-serif';
    ctx.fillText(task.length > 30 ? task.slice(0, 29) + '…' : task, 24, 98);
    label.texture.needsUpdate = true;
  }

  Object.keys(SPOTS).forEach((id) => {
    const av = Avatars.create(id);
    av.group.position.set(SPOTS[id][0], 0, SPOTS[id][1]);
    av.group.userData.agentId = id;
    scene.add(av.group);
    const label = makeLabel();
    label.sprite.position.set(0, av.labelY, av.labelZ);
    av.group.add(label.sprite);
    stations[id] = { av, label, key: '', staff: null };
  });

  // Kamera orbit sederhana
  let angle = 0.3, pitch = 0.6, dist = 18, dragging = false, lastX = 0, lastY = 0;
  let selectedAgentId = null;
  const raycaster = new T.Raycaster();
  const pointer = new T.Vector2();
  function placeCamera() {
    camera.position.set(Math.sin(angle) * Math.cos(pitch) * dist, Math.sin(pitch) * dist, Math.cos(angle) * Math.cos(pitch) * dist);
    camera.lookAt(0, 1.1, 0.4);
  }
  function agentAt(clientX, clientY) {
    const rect = el.getBoundingClientRect();
    pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const groups = Object.values(stations).map((station) => station.av.group);
    const hit = raycaster.intersectObjects(groups, true)[0];
    let object = hit && hit.object;
    while (object && !object.userData.agentId) object = object.parent;
    return object ? object.userData.agentId : null;
  }
  function selectAgent(id) {
    const station = stations[id];
    if (!station) return;
    selectedAgentId = id;
    Object.entries(stations).forEach(([stationId, item]) => { item.label.sprite.visible = stationId === id; });
    const selectedStaff = station.staff || { id };
    if (window.OfficeInteraction) window.OfficeInteraction.open(selectedStaff);
    window.dispatchEvent(new CustomEvent('office:agent-selected', { detail: selectedStaff }));
  }
  const el = renderer.domElement;
  let pointerStartX = 0, pointerStartY = 0;
  el.addEventListener('pointerdown', (e) => {
    dragging = true;
    lastX = pointerStartX = e.clientX;
    lastY = pointerStartY = e.clientY;
    el.setPointerCapture(e.pointerId);
  });
  el.addEventListener('pointerup', (e) => {
    const wasClick = dragging && Math.hypot(e.clientX - pointerStartX, e.clientY - pointerStartY) < 6;
    dragging = false;
    if (wasClick) {
      const id = agentAt(e.clientX, e.clientY);
      if (id) selectAgent(id);
    }
  });
  el.addEventListener('pointermove', (e) => {
    if (!dragging) {
      el.style.cursor = agentAt(e.clientX, e.clientY) ? 'pointer' : 'grab';
      return;
    }
    angle -= (e.clientX - lastX) * 0.006;
    pitch = Math.min(1.3, Math.max(0.15, pitch + (e.clientY - lastY) * 0.005));
    lastX = e.clientX; lastY = e.clientY;
  });
  el.addEventListener('wheel', (e) => { e.preventDefault(); dist = Math.min(30, Math.max(9, dist + e.deltaY * 0.01)); }, { passive: false });

  function resize() {
    const w = container.clientWidth || 600, h = container.clientHeight || 400;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clock = new T.Clock();
  (function loop() {
    const t = reduced ? 0 : clock.getElapsedTime();
    Object.values(stations).forEach((s) => s.av.update(t));
    placeCamera();
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  })();

  window.OfficeScene = {
    select: selectAgent,
    clearSelection() {
      selectedAgentId = null;
      Object.values(stations).forEach((station) => { station.label.sprite.visible = false; });
      if (window.OfficeInteraction) window.OfficeInteraction.close();
      window.dispatchEvent(new CustomEvent('office:agent-selected', { detail: null }));
    },
    update(staffList) {
      staffList.forEach((s) => {
        const st = stations[s.id];
        if (!st) return;
        st.staff = s;
        const working = s.status === 'working';
        st.av.setWorking(working);
        const key = `${s.name}|${s.role}|${s.task}|${working}`;
        if (st.key !== key) { st.key = key; drawLabel(st.label, `${s.name} · ${s.role}`, s.task, working); }
        st.label.sprite.visible = selectedAgentId === s.id;
      });
    },
  };
})();
