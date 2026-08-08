;(()=>{const s=document.createElement('style');s.textContent=".muted[data-v-abb17173]{color:var(--aibase-muted)}.card-mode[data-v-abb17173]{min-height:96px}.card-grid[data-v-abb17173]{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;align-items:center}.card-metric[data-v-abb17173]{text-align:center}.metric-label[data-v-abb17173]{font-size:11px;color:var(--aibase-muted);margin-top:2px}.card-meta[data-v-abb17173]{grid-column:1 / -1;border-top:1px dashed var(--aibase-stroke);margin-top:6px;padding-top:6px;font-size:12px;line-height:1.7}.meta-host[data-v-abb17173]{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.meta-line[data-v-abb17173]{color:var(--aibase-text)}.card-empty[data-v-abb17173]{color:var(--aibase-muted);font-size:12px;text-align:center;padding:24px 0}.toolbar[data-v-abb17173]{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}.toolbar-left[data-v-abb17173]{display:flex;align-items:center;gap:12px}.updated[data-v-abb17173]{font-size:12px}.error-bar[data-v-abb17173]{background:#f56c6c1a;color:#f56c6c;border-radius:8px;padding:8px 12px;margin-bottom:12px;font-size:13px}.section[data-v-abb17173]{margin-bottom:16px}.section-title[data-v-abb17173]{font-weight:600;font-size:13px;margin-bottom:12px}.host-grid[data-v-abb17173]{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px 24px;font-size:13px}.host-item[data-v-abb17173]{display:flex;flex-direction:column;gap:2px;min-width:0}.host-item b[data-v-abb17173]{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.stat-grid[data-v-abb17173]{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;margin-bottom:16px}.stat-card[data-v-abb17173]{padding:16px;border-radius:12px}.stat-icon[data-v-abb17173]{font-size:20px;color:var(--aibase-accent);margin-bottom:10px}.stat-num[data-v-abb17173]{font-size:20px;font-weight:700}.stat-label[data-v-abb17173]{font-size:12px;color:var(--aibase-muted);margin-top:4px}.trend-grid[data-v-abb17173]{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px}.trend-name[data-v-abb17173]{font-size:12px;color:var(--aibase-muted);margin-bottom:8px}.trend[data-v-abb17173]{display:flex;align-items:flex-end;gap:2px;height:96px}.trend-col[data-v-abb17173]{flex:1;height:100%;display:flex;align-items:flex-end}.trend-bar[data-v-abb17173]{width:100%;min-height:2px;border-radius:2px 2px 0 0;opacity:.9}.grid-2[data-v-abb17173]{display:grid;grid-template-columns:1fr 1fr;gap:16px}.empty[data-v-abb17173]{font-size:13px}\n";document.head.appendChild(s)})();import { computed as O, ref as f, onMounted as ee, onBeforeUnmount as te, resolveComponent as x, openBlock as d, createElementBlock as r, createElementVNode as e, createVNode as n, toDisplayString as l, createCommentVNode as A, unref as C, withCtx as c, normalizeStyle as b, Fragment as W, renderList as X, createTextVNode as I, createApp as se } from "vue";
import le from "element-plus";
import { Refresh as ae, Cpu as oe, Histogram as ne, Odometer as ce, Monitor as ie, DataLine as de } from "@element-plus/icons-vue";
import { get as T } from "@atlas/runtime";
const re = (g, h) => {
  const m = g.__vccOpts || g;
  for (const [M, $] of h)
    m[M] = $;
  return m;
}, ue = {
  key: 0,
  class: "card-mode"
}, ve = {
  key: 0,
  class: "card-grid"
}, me = { class: "card-metric" }, pe = { class: "card-metric" }, _e = { class: "card-metric" }, he = { class: "card-meta" }, fe = ["title"], ye = { class: "meta-line" }, be = { class: "meta-line" }, ge = { class: "meta-line muted" }, ke = {
  key: 1,
  class: "card-empty"
}, we = {
  key: 1,
  class: "detail-mode"
}, Pe = { class: "toolbar" }, xe = { class: "toolbar-left" }, Ce = {
  key: 0,
  class: "updated muted"
}, Me = {
  key: 0,
  class: "error-bar"
}, $e = {
  key: 1,
  class: "surface section"
}, Se = { class: "host-grid" }, Fe = { class: "host-item" }, Ie = { class: "host-item" }, Ue = { class: "host-item" }, Be = {
  key: 2,
  class: "stat-grid"
}, Ae = { class: "stat-card surface" }, Te = { class: "stat-card surface" }, De = { class: "stat-label" }, Ne = { class: "stat-card surface" }, Ve = { class: "stat-num" }, ze = { class: "stat-label" }, Ee = { class: "stat-card surface" }, Le = { class: "stat-label" }, Re = { class: "stat-card surface" }, Oe = { class: "stat-num" }, He = { class: "stat-label" }, Ge = { class: "surface section" }, Ke = {
  key: 0,
  class: "trend-grid"
}, je = { class: "trend-name" }, qe = { class: "trend" }, Je = ["title"], Qe = {
  key: 1,
  class: "empty muted"
}, We = { class: "grid-2" }, Xe = { class: "surface section" }, Ye = { class: "surface section" }, Ze = {
  __name: "App",
  props: { appId: { type: Number, default: null }, mode: { type: String, default: "" } },
  setup(g) {
    const h = g, m = O(() => h.mode === "system-menu" || h.appId != null && h.appId !== void 0), M = () => `/api/apps/${V.value ?? h.appId}/plugins/machine-monitor/ep`, $ = f(!1), S = f(""), U = f(""), u = f(null), o = f(null), D = f([]), H = f([]), N = f(!0), V = f(null);
    let z = null;
    const k = (s) => {
      if (s == null) return "—";
      const t = Number(s);
      return t >= 1073741824 ? `${(t / 1073741824).toFixed(2)} GB` : t >= 1048576 ? `${(t / 1048576).toFixed(1)} MB` : t >= 1024 ? `${(t / 1024).toFixed(1)} KB` : `${t} B`;
    }, G = (s) => {
      if (s == null) return "—";
      const t = Math.floor(s / 86400), _ = Math.floor(s % 86400 / 3600), y = Math.floor(s % 3600 / 60);
      return t > 0 ? `${t}天${_}时` : _ > 0 ? `${_}时${y}分` : `${y}分`;
    }, p = (s) => s == null ? "var(--aibase-muted)" : s >= 85 ? "#f56c6c" : s >= 60 ? "#e6a23c" : "#67c23a", E = (s) => s == null ? "—" : `${s}%`;
    async function B() {
      if (V.value != null) return !0;
      try {
        const s = await T("/api/apps");
        if (s && s.length > 0)
          return V.value = s[0].id, !0;
      } catch {
      }
      return !1;
    }
    async function K() {
      if (!await B()) return;
      const s = M();
      try {
        const t = await T(s + "/status");
        u.value = t.host, o.value = t.sample, U.value = (/* @__PURE__ */ new Date()).toLocaleTimeString("zh-CN", { hour12: !1 }), S.value = "";
      } catch (t) {
        S.value = t && t.message || "采集失败";
      }
    }
    async function j() {
      if (await B())
        try {
          D.value = await T(M() + "/history/24");
        } catch {
        }
    }
    async function q() {
      if (await B())
        try {
          H.value = await T(M() + "/processes");
        } catch {
        }
    }
    async function J() {
      $.value = !0;
      try {
        await K(), m.value && await Promise.all([j(), q()]);
      } finally {
        $.value = !1;
      }
    }
    const F = O(() => {
      const s = D.value;
      if (s.length === 0) return { cpu: [], mem: [], disk: [] };
      const t = Math.min(96, s.length), _ = s.length / t, y = (L) => Array.from({ length: t }, (w, i) => {
        const P = s.slice(Math.floor(i * _), Math.floor((i + 1) * _)), a = P.map((v) => v[L]).filter((v) => v != null);
        return a.length === 0 ? { v: null, ts: P[0].ts } : { v: a.reduce((v, R) => v + R, 0) / a.length, ts: P[0].ts };
      });
      return { cpu: y("cpu"), mem: y("memPercent"), disk: y("diskPercent") };
    }), Y = () => Math.max(1, ...F.value.cpu.map((s) => s.v ?? 0), ...F.value.mem.map((s) => s.v ?? 0), ...F.value.disk.map((s) => s.v ?? 0)), Q = (s) => s ? s.slice(11, 16) : "", Z = O(() => D.value.slice(-20).reverse());
    return ee(async () => {
      await J(), z = setInterval(async () => {
        N.value && await B() && (await K(), m.value && (/* @__PURE__ */ new Date()).getSeconds() % 60 === 0 && await Promise.all([j(), q()]));
      }, 5e3);
    }), te(() => {
      z && clearInterval(z);
    }), (s, t) => {
      const _ = x("el-progress"), y = x("el-switch"), L = x("el-button"), w = x("el-icon"), i = x("el-table-column"), P = x("el-table");
      return m.value ? (d(), r("div", we, [
        e("div", Pe, [
          e("div", xe, [
            n(y, {
              modelValue: N.value,
              "onUpdate:modelValue": t[0] || (t[0] = (a) => N.value = a),
              "active-text": "自动刷新（5s）",
              size: "small"
            }, null, 8, ["modelValue"]),
            U.value ? (d(), r("span", Ce, "最近更新 " + l(U.value), 1)) : A("", !0)
          ]),
          n(L, {
            icon: C(ae),
            circle: "",
            loading: $.value,
            onClick: J,
            title: "刷新"
          }, null, 8, ["icon", "loading"])
        ]),
        S.value ? (d(), r("div", Me, l(S.value), 1)) : A("", !0),
        u.value ? (d(), r("div", $e, [
          t[7] || (t[7] = e("div", { class: "section-title" }, "主机信息", -1)),
          e("div", Se, [
            e("div", Fe, [
              t[4] || (t[4] = e("span", { class: "muted" }, "主机名", -1)),
              e("b", null, l(u.value.hostname), 1)
            ]),
            e("div", Ie, [
              t[5] || (t[5] = e("span", { class: "muted" }, "系统", -1)),
              e("b", null, l(u.value.platform) + " " + l(u.value.release) + "（" + l(u.value.arch) + "）", 1)
            ]),
            e("div", Ue, [
              t[6] || (t[6] = e("span", { class: "muted" }, "CPU", -1)),
              e("b", null, l(u.value.cores) + " 核 · " + l(u.value.cpuModel), 1)
            ])
          ])
        ])) : A("", !0),
        o.value ? (d(), r("div", Be, [
          e("div", Ae, [
            n(w, { class: "stat-icon" }, {
              default: c(() => [
                n(C(oe))
              ]),
              _: 1
            }),
            e("div", {
              class: "stat-num",
              style: b({ color: p(o.value.cpu) })
            }, l(E(o.value.cpu)), 5),
            t[8] || (t[8] = e("div", { class: "stat-label" }, "CPU 使用率", -1))
          ]),
          e("div", Te, [
            n(w, { class: "stat-icon" }, {
              default: c(() => [
                n(C(ne))
              ]),
              _: 1
            }),
            e("div", {
              class: "stat-num",
              style: b({ color: p(o.value.memPercent) })
            }, l(E(o.value.memPercent)), 5),
            e("div", De, "内存 " + l(k(o.value.memUsed)) + " / " + l(k(o.value.memTotal)), 1)
          ]),
          e("div", Ne, [
            n(w, { class: "stat-icon" }, {
              default: c(() => [
                n(C(ce))
              ]),
              _: 1
            }),
            e("div", Ve, l(o.value.load1.toFixed(2)), 1),
            e("div", ze, "负载 1/5/15：" + l(o.value.load1.toFixed(2)) + " / " + l(o.value.load5.toFixed(2)) + " / " + l(o.value.load15.toFixed(2)), 1)
          ]),
          e("div", Ee, [
            n(w, { class: "stat-icon" }, {
              default: c(() => [
                n(C(ie))
              ]),
              _: 1
            }),
            e("div", {
              class: "stat-num",
              style: b({ color: p(o.value.diskPercent) })
            }, l(E(o.value.diskPercent)), 5),
            e("div", Le, "磁盘 " + l(k(o.value.diskTotal)) + " · 剩余 " + l(k(o.value.diskFree)), 1)
          ]),
          e("div", Re, [
            n(w, { class: "stat-icon" }, {
              default: c(() => [
                n(C(de))
              ]),
              _: 1
            }),
            e("div", Oe, l(G(o.value.uptimeSeconds)), 1),
            e("div", He, "运行时长 · 进程 RSS " + l(k(o.value.rss)), 1)
          ])
        ])) : A("", !0),
        e("div", Ge, [
          t[9] || (t[9] = e("div", { class: "section-title" }, "近 24 小时趋势（分钟采样）", -1)),
          F.value.cpu.length ? (d(), r("div", Ke, [
            (d(), r(W, null, X([["cpu", "CPU %", "cpu"], ["mem", "内存 %", "mem"], ["disk", "磁盘 %", "disk"]], (a) => e("div", {
              key: a[0],
              class: "trend-box"
            }, [
              e("div", je, l(a[1]), 1),
              e("div", qe, [
                (d(!0), r(W, null, X(F.value[a[2]], (v, R) => (d(), r("div", {
                  key: R,
                  class: "trend-col",
                  title: `${Q(v.ts)}：${v.v == null ? "—" : v.v.toFixed(1)}%`
                }, [
                  e("div", {
                    class: "trend-bar",
                    style: b({ height: `${(v.v ?? 0) / Y() * 100}%`, background: p(v.v) })
                  }, null, 4)
                ], 8, Je))), 128))
              ])
            ])), 64))
          ])) : (d(), r("div", Qe, "暂无历史数据（控制台卡片或定时数据集刷新会自动采样）"))
        ]),
        e("div", We, [
          e("div", Xe, [
            t[10] || (t[10] = e("div", { class: "section-title" }, "最近采样", -1)),
            n(P, {
              data: Z.value,
              size: "small",
              "empty-text": "暂无"
            }, {
              default: c(() => [
                n(i, {
                  label: "时间",
                  width: "90"
                }, {
                  default: c(({ row: a }) => [
                    I(l(Q(a.ts)), 1)
                  ]),
                  _: 1
                }),
                n(i, {
                  label: "CPU",
                  width: "70"
                }, {
                  default: c(({ row: a }) => [
                    e("span", {
                      style: b({ color: p(a.cpu) })
                    }, l(a.cpu) + "%", 5)
                  ]),
                  _: 1
                }),
                n(i, {
                  label: "内存",
                  width: "80"
                }, {
                  default: c(({ row: a }) => [
                    e("span", {
                      style: b({ color: p(a.memPercent) })
                    }, l(a.memPercent) + "%", 5)
                  ]),
                  _: 1
                }),
                n(i, {
                  label: "磁盘",
                  width: "70"
                }, {
                  default: c(({ row: a }) => [
                    I(l(a.diskPercent == null ? "—" : a.diskPercent + "%"), 1)
                  ]),
                  _: 1
                }),
                n(i, {
                  label: "负载",
                  width: "80"
                }, {
                  default: c(({ row: a }) => [
                    I(l(a.load1.toFixed(2)), 1)
                  ]),
                  _: 1
                })
              ]),
              _: 1
            }, 8, ["data"])
          ]),
          e("div", Ye, [
            t[11] || (t[11] = e("div", { class: "section-title" }, "Top 进程（按 CPU）", -1)),
            n(P, {
              data: H.value,
              size: "small",
              "empty-text": "暂无"
            }, {
              default: c(() => [
                n(i, {
                  prop: "pid",
                  label: "PID",
                  width: "70"
                }),
                n(i, {
                  prop: "name",
                  label: "进程",
                  "min-width": "140",
                  "show-overflow-tooltip": ""
                }),
                n(i, {
                  label: "CPU",
                  width: "80"
                }, {
                  default: c(({ row: a }) => [
                    e("span", {
                      style: b({ color: p(a.cpu) })
                    }, l(a.cpu) + "%", 5)
                  ]),
                  _: 1
                }),
                n(i, {
                  label: "MEM",
                  width: "80"
                }, {
                  default: c(({ row: a }) => [
                    I(l(a.mem) + "%", 1)
                  ]),
                  _: 1
                }),
                n(i, {
                  label: "RSS",
                  width: "90"
                }, {
                  default: c(({ row: a }) => [
                    I(l(a.rssBytes == null ? "—" : k(a.rssBytes)), 1)
                  ]),
                  _: 1
                })
              ]),
              _: 1
            }, 8, ["data"])
          ])
        ])
      ])) : (d(), r("div", ue, [
        o.value && u.value ? (d(), r("div", ve, [
          e("div", me, [
            n(_, {
              type: "dashboard",
              width: 64,
              "stroke-width": 6,
              percentage: o.value.cpu,
              color: p(o.value.cpu)
            }, null, 8, ["percentage", "color"]),
            t[1] || (t[1] = e("div", { class: "metric-label" }, "CPU", -1))
          ]),
          e("div", pe, [
            n(_, {
              type: "dashboard",
              width: 64,
              "stroke-width": 6,
              percentage: o.value.memPercent,
              color: p(o.value.memPercent)
            }, null, 8, ["percentage", "color"]),
            t[2] || (t[2] = e("div", { class: "metric-label" }, "内存", -1))
          ]),
          e("div", _e, [
            n(_, {
              type: "dashboard",
              width: 64,
              "stroke-width": 6,
              percentage: o.value.diskPercent ?? 0,
              color: p(o.value.diskPercent)
            }, null, 8, ["percentage", "color"]),
            t[3] || (t[3] = e("div", { class: "metric-label" }, "磁盘", -1))
          ]),
          e("div", he, [
            e("div", {
              class: "meta-host",
              title: u.value.hostname
            }, l(u.value.hostname), 9, fe),
            e("div", ye, "负载 " + l(o.value.load1.toFixed(2)), 1),
            e("div", be, "运行 " + l(G(o.value.uptimeSeconds)), 1),
            e("div", ge, l(U.value || "—"), 1)
          ])
        ])) : (d(), r("div", ke, l(S.value || "正在采集指标…"), 1))
      ]));
    };
  }
}, et = /* @__PURE__ */ re(Ze, [["__scopeId", "data-v-abb17173"]]), ot = {
  mount(g, h) {
    const m = se(et, { appId: h.appId, mode: h.mode });
    return m.use(le), m.mount(g), () => m.unmount();
  }
};
export {
  ot as default
};
