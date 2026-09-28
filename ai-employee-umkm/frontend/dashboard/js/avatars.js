// Karakter 3D prosedural (tanpa aset eksternal): staf duduk di meja, wajah menghadap kamera.
// Api: Avatars.create(role) -> { group, setWorking(bool), update(t) }
(function () {
  const T = window.THREE;
  if (!T) return;

  const mat = (color, o) => new T.MeshStandardMaterial(Object.assign({ color, roughness: 0.75, metalness: 0.05 }, o || {}));
  const shadow = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };
  const box = (w, h, d, m) => shadow(new T.Mesh(new T.BoxGeometry(w, h, d), m));
  const ball = (r, m) => shadow(new T.Mesh(new T.SphereGeometry(r, 24, 18), m));
  const tube = (rt, rb, h, m, seg) => shadow(new T.Mesh(new T.CylinderGeometry(rt, rb, h, seg || 24), m));

  // Kapsul menggantung ke bawah dari origin: ujung atas y=0, ujung bawah y=-len.
  function limb(r, len, m) {
    const pts = [];
    const s = 8;
    const yb = -Math.max(len - 2 * r, 0) - r;
    for (let i = 0; i <= s; i++) { const a = (i / s) * Math.PI / 2; pts.push(new T.Vector2(Math.sin(a) * r, yb - Math.cos(a) * r)); }
    for (let i = 0; i <= s; i++) { const a = (i / s) * Math.PI / 2; pts.push(new T.Vector2(Math.cos(a) * r, -r + Math.sin(a) * r)); }
    const g = new T.LatheGeometry(pts, 20);
    const dm = m.clone(); dm.side = T.DoubleSide;
    return shadow(new T.Mesh(g, dm));
  }

  const PROFILES = {
    cs:        { skin: 0xe8b894, shirt: 0x1f9d8a, hair: 0x2a1a12, rug: 0xcfeae5 },
    inventory: { skin: 0xc68a5e, shirt: 0x3a5bd9, hair: 0x1c1410, rug: 0xd6def7 },
    finance:   { skin: 0xf0c8a6, shirt: 0x8a4fd0, hair: 0x4a2c1a, rug: 0xe6d9f5 },
    marketing: { skin: 0xd9a47a, shirt: 0xe4572e, hair: 0x120d0a, rug: 0xf8dccf },
  };
  const PANTS = 0x2b3157;

  function buildDesk(g, p) {
    const wood = mat(0xc9a56a), leg = mat(0x8a6d3b);
    const rug = shadow(new T.Mesh(new T.CylinderGeometry(2.1, 2.1, 0.02, 48), mat(p.rug)));
    rug.position.set(0, 0.011, -0.5); g.add(rug);
    const top = box(2.6, 0.1, 1.3, wood); top.position.y = 0.95; g.add(top);
    [[-1.15, -0.5], [1.15, -0.5], [-1.15, 0.5], [1.15, 0.5]].forEach(([x, z]) => {
      const l = box(0.1, 0.9, 0.1, leg); l.position.set(x, 0.45, z); g.add(l);
    });
    // Laptop: layar menghadap staf (-z), punggung layar menghadap kamera dengan logo menyala saat bekerja.
    const base = box(0.7, 0.03, 0.5, mat(0x9aa1c4)); base.position.set(0, 1.035, -0.2); g.add(base);
    const lid = box(0.7, 0.45, 0.03, mat(0x9aa1c4)); lid.position.set(0, 1.27, 0.06); lid.rotation.x = 0.25; g.add(lid);
    const logoMat = new T.MeshStandardMaterial({ color: 0x444a70, emissive: 0x000000, roughness: 0.4 });
    const logo = shadow(new T.Mesh(new T.CircleGeometry(0.06, 20), logoMat));
    logo.position.set(0, 1.3, 0.083); logo.rotation.x = 0.25; g.add(logo);
    // Cangkir
    const mug = tube(0.07, 0.06, 0.13, mat(0xffffff), 16); mug.position.set(-0.95, 1.06, -0.3); g.add(mug);
    return logoMat;
  }

  function buildProps(g, role) {
    if (role === 'inventory') {
      const cardboard = mat(0xc8955a), tape = mat(0xe8d7b0);
      [[1.0, 1.1, 0.1, 0.5], [1.05, 1.5, -0.1, 0.4]].forEach(([x, y, z, s], i) => {
        const b = box(s + 0.2, 0.32, s, cardboard); b.position.set(x, i === 0 ? 1.16 : 1.48, z); g.add(b);
        const t = box(0.06, 0.005, s + 0.01, tape); t.position.set(x, (i === 0 ? 1.16 : 1.48) + 0.163, z); g.add(t);
      });
    } else if (role === 'finance') {
      const calc = box(0.24, 0.03, 0.34, mat(0x2b3157)); calc.position.set(0.9, 1.035, -0.3); g.add(calc);
      const disp = box(0.18, 0.005, 0.06, mat(0x7be0b0, { emissive: 0x2a8a60 })); disp.position.set(0.9, 1.055, -0.4); g.add(disp);
      [0.14, 0.26, 0.2, 0.36].forEach((h, i) => {
        const bar = box(0.08, h, 0.08, mat(i % 2 ? 0xf2a516 : 0x8a4fd0)); bar.position.set(-1.0 + i * 0.11, 1 + h / 2, 0.2); g.add(bar);
      });
    } else if (role === 'marketing') {
      const stand = box(0.05, 0.5, 0.05, mat(0x8a6d3b)); stand.position.set(1.0, 1.25, 0.1); g.add(stand);
      const board = box(0.6, 0.72, 0.03, mat(0xffffff)); board.position.set(1.0, 1.6, 0.1); g.add(board);
      [[0xe4572e, 0.16], [0xf2a516, -0.02], [0x1f9d8a, -0.2]].forEach(([c, y]) => {
        const s = box(0.44, 0.12, 0.035, mat(c)); s.position.set(1.0, 1.6 + y, 0.115); g.add(s);
      });
      const pal = tube(0.16, 0.16, 0.02, mat(0xe8d7b0), 24); pal.position.set(-0.85, 1.03, -0.15); g.add(pal);
      [0xe4572e, 0x3a5bd9, 0xf2a516].forEach((c, i) => { const d = ball(0.03, mat(c)); d.position.set(-0.9 + i * 0.07, 1.05, -0.15 + (i % 2) * 0.06); g.add(d); });
    } else {
      // Customer service: telepon meja kecil
      const ph = box(0.3, 0.06, 0.22, mat(0x2b3157)); ph.position.set(0.95, 1.06, -0.2); g.add(ph);
      const hs = box(0.24, 0.04, 0.05, mat(0x444a70)); hs.position.set(0.95, 1.11, -0.2); g.add(hs);
    }
  }

  // Rambut: tutup atas + cangkang belakang/samping (sektor depan dibiarkan terbuka agar wajah terlihat).
  function hairShell(head, hairMat) {
    const dm = hairMat.clone(); dm.side = T.DoubleSide;
    const top = shadow(new T.Mesh(new T.SphereGeometry(0.325, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.38), dm));
    const rear = shadow(new T.Mesh(new T.SphereGeometry(0.325, 28, 16, Math.PI / 2 + 0.9, Math.PI * 2 - 1.8, 0, Math.PI * 0.62), dm));
    [top, rear].forEach((m) => { m.position.set(0, 0.02, -0.02); head.add(m); });
  }

  function buildHeadwear(head, role, p) {
    const hair = mat(p.hair);
    if (role === 'cs') {
      hairShell(head, hair);
      const back = limb(0.17, 0.6, hair); back.position.set(0, 0.0, -0.2); head.add(back);
      const band = shadow(new T.Mesh(new T.TorusGeometry(0.34, 0.018, 8, 28, Math.PI), mat(0x222a55))); head.add(band);
      [-1, 1].forEach((s) => { const e = ball(0.075, mat(0x222a55)); e.scale.x = 0.55; e.position.set(s * 0.34, 0, 0); head.add(e); });
      const boom = box(0.012, 0.012, 0.2, mat(0x222a55)); boom.position.set(-0.3, -0.07, 0.15); boom.rotation.y = -0.4; head.add(boom);
      const tip = ball(0.022, mat(0xf2a516)); tip.position.set(-0.22, -0.09, 0.26); head.add(tip);
    } else if (role === 'inventory') {
      const hat = shadow(new T.Mesh(new T.SphereGeometry(0.34, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.4), mat(0xf2a516)));
      hat.position.set(0, 0.05, -0.02); head.add(hat);
      const brim = box(0.32, 0.02, 0.2, mat(0xf2a516)); brim.position.set(0, 0.17, 0.3); brim.rotation.x = 0.12; head.add(brim);
      const side = limb(0.1, 0.3, hair); [-1, 1].forEach((s) => { const h = side.clone(); h.position.set(s * 0.26, 0.1, -0.05); head.add(h); });
    } else if (role === 'finance') {
      hairShell(head, hair);
      const bun = ball(0.12, hair); bun.position.set(0, 0.34, -0.14); head.add(bun);
      [-1, 1].forEach((s) => {
        const ring = shadow(new T.Mesh(new T.TorusGeometry(0.058, 0.009, 8, 20), mat(0x222a55)));
        ring.position.set(s * 0.105, 0.03, 0.288); head.add(ring);
      });
      const bridge = box(0.05, 0.01, 0.01, mat(0x222a55)); bridge.position.set(0, 0.04, 0.292); head.add(bridge);
    } else {
      hairShell(head, hair);
      [-1, 1].forEach((s) => { const b = limb(0.1, 0.36, hair); b.position.set(s * 0.27, 0.0, -0.05); head.add(b); });
      const beret = ball(0.3, mat(0xe4572e)); beret.scale.set(1, 0.32, 1); beret.position.set(0.04, 0.3, 0); beret.rotation.z = -0.15; head.add(beret);
      const stem = ball(0.03, mat(0xe4572e)); stem.position.set(0.04, 0.41, 0); head.add(stem);
    }
  }

  function create(role) {
    const p = PROFILES[role] || PROFILES.cs;
    const g = new T.Group();
    const logoMat = buildDesk(g, p);
    buildProps(g, role);

    // Cincin status di lantai (berdenyut saat bekerja)
    const ringMat = new T.MeshBasicMaterial({ color: p.shirt, transparent: true, opacity: 0 });
    const ring = new T.Mesh(new T.TorusGeometry(0.95, 0.03, 8, 48), ringMat);
    ring.rotation.x = Math.PI / 2; ring.position.set(0, 0.03, -1.0); g.add(ring);

    // Staf (asal di lantai, pusat kursi)
    const person = new T.Group();
    person.position.set(0, 0, -1.0);
    g.add(person);

    const chairMat = mat(0x2b3157);
    const seat = box(0.72, 0.08, 0.7, chairMat); seat.position.y = 0.55; person.add(seat);
    const back = box(0.66, 0.62, 0.08, chairMat); back.position.set(0, 0.92, -0.36); person.add(back);
    const pole = tube(0.04, 0.04, 0.5, mat(0x9aa1c4), 12); pole.position.y = 0.27; person.add(pole);
    const foot = tube(0.36, 0.36, 0.04, mat(0x9aa1c4), 24); foot.position.y = 0.03; person.add(foot);

    const skin = mat(p.skin), shirt = mat(p.shirt), pants = mat(PANTS);

    // Kaki
    [-1, 1].forEach((s) => {
      const thigh = limb(0.11, 0.6, pants); thigh.position.set(s * 0.15, 0.7, 0); thigh.rotation.x = -Math.PI / 2; person.add(thigh);
      const shin = limb(0.085, 0.7, pants); shin.position.set(s * 0.15, 0.7, 0.56); shin.rotation.x = 0.1; person.add(shin);
      const shoe = box(0.15, 0.07, 0.3, mat(0x1c1f38)); shoe.position.set(s * 0.15, 0.04, 0.6); person.add(shoe);
    });

    // Badan
    const torso = limb(0.3, 1.0, shirt); torso.position.set(0, 1.62, 0); torso.scale.set(1.05, 1, 0.78); person.add(torso);
    const neck = tube(0.09, 0.09, 0.16, skin, 16); neck.position.y = 1.66; person.add(neck);

    // Kepala + wajah
    const head = new T.Group(); head.position.y = 1.9; person.add(head);
    const skull = ball(0.3, skin); skull.scale.set(1, 1.08, 1); head.add(skull);
    const eyeMat = mat(0x1a1a2e, { roughness: 0.3 });
    const eyes = [-1, 1].map((s) => { const e = ball(0.04, eyeMat); e.position.set(s * 0.1, 0.03, 0.265); head.add(e); return e; });
    [-1, 1].forEach((s) => { const b = box(0.09, 0.015, 0.02, mat(p.hair)); b.position.set(s * 0.1, 0.11, 0.275); head.add(b); });
    const nose = ball(0.033, mat(p.skin, { roughness: 0.6 })); nose.position.set(0, -0.03, 0.3); head.add(nose);
    const smile = shadow(new T.Mesh(new T.TorusGeometry(0.055, 0.008, 6, 14, Math.PI), mat(0x8a3b3b)));
    smile.rotation.z = Math.PI; smile.position.set(0, -0.06, 0.29); head.add(smile);
    buildHeadwear(head, role, p);

    // Lengan
    const arms = [-1, 1].map((s) => {
      const shoulder = new T.Group(); shoulder.position.set(s * 0.4, 1.52, 0); person.add(shoulder);
      const cap = ball(0.1, shirt); shoulder.add(cap);
      const upper = limb(0.085, 0.42, shirt); shoulder.add(upper);
      const elbow = new T.Group(); elbow.position.y = -0.36; shoulder.add(elbow);
      const fore = limb(0.075, 0.4, skin); elbow.add(fore);
      const hand = ball(0.07, skin); hand.position.y = -0.4; elbow.add(hand);
      return { shoulder, elbow };
    });

    const state = { working: false, blend: 0, phase: Math.random() * 6.28, blinkAt: 2 + Math.random() * 2 };
    let last = 0;

    return {
      group: g,
      // Posisi label nama di atas kepala (koordinat lokal grup meja).
      labelY: 2.85, labelZ: -1.0,
      setWorking(v) { state.working = Boolean(v); },
      update(t) {
        const dt = Math.min(Math.max(t - last, 0), 0.1); last = t;
        state.blend += ((state.working ? 1 : 0) - state.blend) * Math.min(dt * 6, 1);
        const b = state.blend, ph = state.phase;

        // Napas
        torso.scale.y = 1 + Math.sin(t * 1.6 + ph) * 0.012;
        // Kepala: menunduk & mengangguk saat kerja, menoleh santai saat idle
        head.rotation.x = 0.14 * b + Math.sin(t * 3 + ph) * 0.03 * b;
        head.rotation.y = (1 - b) * Math.sin(t * 0.5 + ph) * 0.3;
        // Lengan: pose mengetik, jari bergerak saat bekerja
        const typing = Math.sin(t * 15 + ph) * 0.07 * b;
        arms[0].shoulder.rotation.x = -0.5 + Math.sin(t * 1.2 + ph) * 0.02;
        arms[1].shoulder.rotation.x = -0.5 + Math.sin(t * 1.2 + ph + 1) * 0.02;
        arms[0].elbow.rotation.x = -0.85 + typing;
        arms[1].elbow.rotation.x = -0.85 - typing;
        arms[0].shoulder.rotation.z = -0.08; arms[1].shoulder.rotation.z = 0.08;
        // Kedip
        let blink = 1;
        if (t > state.blinkAt) { blink = 0.1; if (t > state.blinkAt + 0.13) { state.blinkAt = t + 2.5 + Math.random() * 2.5; blink = 1; } }
        eyes.forEach((e) => { e.scale.y = blink; });
        // Indikator kerja
        logoMat.emissive.setHex(b > 0.5 ? 0x1f9d8a : 0x000000);
        ringMat.opacity = b * (0.35 + 0.25 * Math.sin(t * 4));
        ring.scale.setScalar(1 + 0.04 * Math.sin(t * 4) * b);
      },
    };
  }

  window.Avatars = { create };
})();
