;(()=>{const s=document.createElement('style');s.textContent=".muted[data-v-07c5edb7]{color:var(--atlas-muted)}.card-mode[data-v-07c5edb7]{min-height:96px}.card-grid[data-v-07c5edb7]{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;align-items:center}.card-metric[data-v-07c5edb7]{text-align:center}.metric-label[data-v-07c5edb7]{font-size:11px;color:var(--atlas-muted);margin-top:2px}.card-meta[data-v-07c5edb7]{grid-column:1 / -1;border-top:1px dashed var(--atlas-stroke);margin-top:6px;padding-top:6px;font-size:12px;line-height:1.7}.meta-host[data-v-07c5edb7]{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.meta-line[data-v-07c5edb7]{color:var(--atlas-text)}.card-empty[data-v-07c5edb7]{color:var(--atlas-muted);font-size:12px;text-align:center;padding:24px 0}.toolbar[data-v-07c5edb7]{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}.toolbar-left[data-v-07c5edb7]{display:flex;align-items:center;gap:12px}.updated[data-v-07c5edb7]{font-size:12px}.error-bar[data-v-07c5edb7]{background:#f56c6c1a;color:#f56c6c;border-radius:8px;padding:8px 12px;margin-bottom:12px;font-size:13px}.section[data-v-07c5edb7]{margin-bottom:16px}.section-title[data-v-07c5edb7]{font-weight:600;font-size:13px;margin-bottom:12px}.host-grid[data-v-07c5edb7]{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px 24px;font-size:13px}.host-item[data-v-07c5edb7]{display:flex;flex-direction:column;gap:2px;min-width:0}.host-item b[data-v-07c5edb7]{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.stat-grid[data-v-07c5edb7]{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;margin-bottom:16px}.stat-card[data-v-07c5edb7]{padding:16px;border-radius:12px}.stat-icon[data-v-07c5edb7]{font-size:20px;color:var(--atlas-accent);margin-bottom:10px}.stat-num[data-v-07c5edb7]{font-size:20px;font-weight:700}.stat-label[data-v-07c5edb7]{font-size:12px;color:var(--atlas-muted);margin-top:4px}.trend-grid[data-v-07c5edb7]{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px}.trend-name[data-v-07c5edb7]{font-size:12px;color:var(--atlas-muted);margin-bottom:8px}.trend[data-v-07c5edb7]{display:flex;align-items:flex-end;gap:2px;height:96px}.trend-col[data-v-07c5edb7]{flex:1;height:100%;display:flex;align-items:flex-end}.trend-bar[data-v-07c5edb7]{width:100%;min-height:2px;border-radius:2px 2px 0 0;opacity:.9}.grid-2[data-v-07c5edb7]{display:grid;grid-template-columns:1fr 1fr;gap:16px}.table-pager[data-v-07c5edb7]{display:flex;justify-content:flex-end;padding-top:10px}.empty[data-v-07c5edb7]{font-size:13px}\n";document.head.appendChild(s)})();import { computed as N, ref as _, onMounted as rt, onBeforeUnmount as ut, resolveComponent as k, openBlock as u, createElementBlock as m, createElementVNode as t, createVNode as o, toDisplayString as l, createCommentVNode as B, unref as I, withCtx as r, normalizeStyle as w, Fragment as et, renderList as st, createTextVNode as U, createApp as mt } from "vue";
import vt from "element-plus";
import { Refresh as pt, Cpu as _t, Histogram as ht, Odometer as ft, Monitor as gt, DataLine as yt } from "@element-plus/icons-vue";
import { get as V } from "@atlas/runtime";
const bt = (P, g) => {
  const h = P.__vccOpts || P;
  for (const [S, T] of g)
    h[S] = T;
  return h;
}, kt = {
  key: 0,
  class: "card-mode"
}, wt = {
  key: 0,
  class: "card-grid"
}, Pt = { class: "card-metric" }, xt = { class: "card-metric" }, Ct = { class: "card-metric" }, $t = { class: "card-meta" }, It = ["title"], St = { class: "meta-line" }, Tt = { class: "meta-line" }, Ft = { class: "meta-line muted" }, Mt = {
  key: 1,
  class: "card-empty"
}, Dt = {
  key: 1,
  class: "detail-mode"
}, At = { class: "toolbar" }, Nt = { class: "toolbar-left" }, Ut = {
  key: 0,
  class: "updated muted"
}, Et = {
  key: 0,
  class: "error-bar"
}, zt = {
  key: 1,
  class: "surface section"
}, Bt = { class: "host-grid" }, Vt = { class: "host-item" }, Rt = { class: "host-item" }, Lt = { class: "host-item" }, Ot = {
  key: 2,
  class: "stat-grid"
}, Zt = { class: "stat-card surface" }, Gt = { class: "stat-card surface" }, Ht = { class: "stat-label" }, Kt = { class: "stat-card surface" }, jt = { class: "stat-num" }, qt = { class: "stat-label" }, Jt = { class: "stat-card surface" }, Qt = { class: "stat-label" }, Wt = { class: "stat-card surface" }, Xt = { class: "stat-num" }, Yt = { class: "stat-label" }, te = { class: "surface section" }, ee = {
  key: 0,
  class: "trend-grid"
}, se = { class: "trend-name" }, ae = { class: "trend" }, le = ["title"], oe = {
  key: 1,
  class: "empty muted"
}, ne = { class: "grid-2" }, ie = { class: "surface section" }, ce = { class: "table-pager" }, de = { class: "surface section" }, re = { class: "table-pager" }, j = 10, q = 10, ue = {
  __name: "App",
  props: { appId: { type: Number, default: null }, mode: { type: String, default: "" } },
  setup(P) {
    const g = P, h = N(() => g.mode === "system-menu" || g.appId != null && g.appId !== void 0), S = () => `/api/apps/${Z.value ?? g.appId}/plugins/machine-monitor/ep`, T = _(!1), F = _(""), E = _(""), v = _(null), n = _(null), R = _([]), L = _([]), O = _(!0), Z = _(null);
    let G = null;
    const x = (s) => {
      if (s == null) return "—";
      const e = Number(s);
      return e >= 1073741824 ? `${(e / 1073741824).toFixed(2)} GB` : e >= 1048576 ? `${(e / 1048576).toFixed(1)} MB` : e >= 1024 ? `${(e / 1024).toFixed(1)} KB` : `${e} B`;
    }, J = (s) => {
      if (s == null) return "—";
      const e = Math.floor(s / 86400), i = Math.floor(s % 86400 / 3600), c = Math.floor(s % 3600 / 60);
      return e > 0 ? `${e}天${i}时` : i > 0 ? `${i}时${c}分` : `${c}分`;
    }, f = (s) => s == null ? "var(--atlas-muted)" : s >= 85 ? "#f56c6c" : s >= 60 ? "#e6a23c" : "#67c23a", H = (s) => s == null ? "—" : `${s}%`, K = { timeZone: "Asia/Shanghai", hour12: !1 }, at = (s) => {
      if (!s) return "—";
      const e = new Date(s);
      if (Number.isNaN(e.getTime())) return "—";
      const i = new Intl.DateTimeFormat("zh-CN", { ...K, month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(e), c = (y) => {
        var p;
        return ((p = i.find((d) => d.type === y)) == null ? void 0 : p.value) ?? "";
      };
      return `${c("month")}-${c("day")} ${c("hour")}:${c("minute")}`;
    }, lt = () => {
      const s = /* @__PURE__ */ new Date(), e = new Intl.DateTimeFormat("zh-CN", { ...K, hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(s), i = (c) => {
        var y;
        return ((y = e.find((p) => p.type === c)) == null ? void 0 : y.value) ?? "";
      };
      return `${i("hour")}:${i("minute")}:${i("second")}`;
    };
    async function z() {
      if (Z.value != null) return !0;
      try {
        const s = await V("/api/apps");
        if (s && s.length > 0)
          return Z.value = s[0].id, !0;
      } catch {
      }
      return !1;
    }
    async function Q() {
      if (!await z()) return;
      const s = S();
      try {
        const e = await V(s + "/status");
        v.value = e.host, n.value = e.sample, E.value = lt(), F.value = "";
      } catch (e) {
        F.value = e && e.message || "采集失败";
      }
    }
    async function W() {
      if (await z())
        try {
          R.value = await V(S() + "/history/24"), D.value = 1;
        } catch {
        }
    }
    async function X() {
      if (await z())
        try {
          L.value = await V(S() + "/processes"), A.value = 1;
        } catch {
        }
    }
    async function Y() {
      T.value = !0;
      try {
        await Q(), h.value && await Promise.all([W(), X()]);
      } finally {
        T.value = !1;
      }
    }
    const M = N(() => {
      const s = R.value;
      if (s.length === 0) return { cpu: [], mem: [], disk: [] };
      const e = Math.min(96, s.length), i = s.length / e, c = (y) => Array.from({ length: e }, (p, d) => {
        const C = s.slice(Math.floor(d * i), Math.floor((d + 1) * i)), $ = C.map((a) => a[y]).filter((a) => a != null);
        return $.length === 0 ? { v: null, ts: C[0].ts } : { v: $.reduce((a, b) => a + b, 0) / $.length, ts: C[0].ts };
      });
      return { cpu: c("cpu"), mem: c("memPercent"), disk: c("diskPercent") };
    }), ot = () => Math.max(1, ...M.value.cpu.map((s) => s.v ?? 0), ...M.value.mem.map((s) => s.v ?? 0), ...M.value.disk.map((s) => s.v ?? 0)), nt = (s) => s ? new Intl.DateTimeFormat("zh-CN", { ...K, hour: "2-digit", minute: "2-digit" }).format(new Date(s)) : "", D = _(1), tt = N(() => [...R.value].reverse()), it = N(() => tt.value.slice((D.value - 1) * j, D.value * j)), A = _(1), ct = N(() => L.value.slice((A.value - 1) * q, A.value * q));
    return rt(async () => {
      await Y(), G = setInterval(async () => {
        O.value && await z() && (await Q(), h.value && (/* @__PURE__ */ new Date()).getSeconds() % 60 === 0 && await Promise.all([W(), X()]));
      }, 5e3);
    }), ut(() => {
      G && clearInterval(G);
    }), (s, e) => {
      const i = k("el-progress"), c = k("el-switch"), y = k("el-button"), p = k("el-icon"), d = k("el-table-column"), C = k("el-table"), $ = k("el-pagination");
      return h.value ? (u(), m("div", Dt, [
        t("div", At, [
          t("div", Nt, [
            o(c, {
              modelValue: O.value,
              "onUpdate:modelValue": e[0] || (e[0] = (a) => O.value = a),
              "active-text": "自动刷新（5s）",
              size: "small"
            }, null, 8, ["modelValue"]),
            E.value ? (u(), m("span", Ut, "最近更新 " + l(E.value), 1)) : B("", !0)
          ]),
          o(y, {
            icon: I(pt),
            circle: "",
            loading: T.value,
            onClick: Y,
            title: "刷新"
          }, null, 8, ["icon", "loading"])
        ]),
        F.value ? (u(), m("div", Et, l(F.value), 1)) : B("", !0),
        v.value ? (u(), m("div", zt, [
          e[9] || (e[9] = t("div", { class: "section-title" }, "主机信息", -1)),
          t("div", Bt, [
            t("div", Vt, [
              e[6] || (e[6] = t("span", { class: "muted" }, "主机名", -1)),
              t("b", null, l(v.value.hostname), 1)
            ]),
            t("div", Rt, [
              e[7] || (e[7] = t("span", { class: "muted" }, "系统", -1)),
              t("b", null, l(v.value.platform) + " " + l(v.value.release) + "（" + l(v.value.arch) + "）", 1)
            ]),
            t("div", Lt, [
              e[8] || (e[8] = t("span", { class: "muted" }, "CPU", -1)),
              t("b", null, l(v.value.cores) + " 核 · " + l(v.value.cpuModel), 1)
            ])
          ])
        ])) : B("", !0),
        n.value ? (u(), m("div", Ot, [
          t("div", Zt, [
            o(p, { class: "stat-icon" }, {
              default: r(() => [
                o(I(_t))
              ]),
              _: 1
            }),
            t("div", {
              class: "stat-num",
              style: w({ color: f(n.value.cpu) })
            }, l(H(n.value.cpu)), 5),
            e[10] || (e[10] = t("div", { class: "stat-label" }, "CPU 使用率", -1))
          ]),
          t("div", Gt, [
            o(p, { class: "stat-icon" }, {
              default: r(() => [
                o(I(ht))
              ]),
              _: 1
            }),
            t("div", {
              class: "stat-num",
              style: w({ color: f(n.value.memPercent) })
            }, l(H(n.value.memPercent)), 5),
            t("div", Ht, "内存 " + l(x(n.value.memUsed)) + " / " + l(x(n.value.memTotal)), 1)
          ]),
          t("div", Kt, [
            o(p, { class: "stat-icon" }, {
              default: r(() => [
                o(I(ft))
              ]),
              _: 1
            }),
            t("div", jt, l(n.value.load1.toFixed(2)), 1),
            t("div", qt, "负载 1/5/15：" + l(n.value.load1.toFixed(2)) + " / " + l(n.value.load5.toFixed(2)) + " / " + l(n.value.load15.toFixed(2)), 1)
          ]),
          t("div", Jt, [
            o(p, { class: "stat-icon" }, {
              default: r(() => [
                o(I(gt))
              ]),
              _: 1
            }),
            t("div", {
              class: "stat-num",
              style: w({ color: f(n.value.diskPercent) })
            }, l(H(n.value.diskPercent)), 5),
            t("div", Qt, "磁盘 " + l(x(n.value.diskTotal)) + " · 剩余 " + l(x(n.value.diskFree)), 1)
          ]),
          t("div", Wt, [
            o(p, { class: "stat-icon" }, {
              default: r(() => [
                o(I(yt))
              ]),
              _: 1
            }),
            t("div", Xt, l(J(n.value.uptimeSeconds)), 1),
            t("div", Yt, "运行时长 · 进程 RSS " + l(x(n.value.rss)), 1)
          ])
        ])) : B("", !0),
        t("div", te, [
          e[11] || (e[11] = t("div", { class: "section-title" }, "近 24 小时趋势（分钟采样）", -1)),
          M.value.cpu.length ? (u(), m("div", ee, [
            (u(), m(et, null, st([["cpu", "CPU %", "cpu"], ["mem", "内存 %", "mem"], ["disk", "磁盘 %", "disk"]], (a) => t("div", {
              key: a[0],
              class: "trend-box"
            }, [
              t("div", se, l(a[1]), 1),
              t("div", ae, [
                (u(!0), m(et, null, st(M.value[a[2]], (b, dt) => (u(), m("div", {
                  key: dt,
                  class: "trend-col",
                  title: `${nt(b.ts)}：${b.v == null ? "—" : b.v.toFixed(1)}%`
                }, [
                  t("div", {
                    class: "trend-bar",
                    style: w({ height: `${(b.v ?? 0) / ot() * 100}%`, background: f(b.v) })
                  }, null, 4)
                ], 8, le))), 128))
              ])
            ])), 64))
          ])) : (u(), m("div", oe, "暂无历史数据（控制台卡片或定时数据集刷新会自动采样）"))
        ]),
        t("div", ne, [
          t("div", ie, [
            e[12] || (e[12] = t("div", { class: "section-title" }, "最近采样（北京时间）", -1)),
            o(C, {
              data: it.value,
              size: "small",
              "empty-text": "暂无"
            }, {
              default: r(() => [
                o(d, {
                  label: "时间",
                  width: "120"
                }, {
                  default: r(({ row: a }) => [
                    U(l(at(a.ts)), 1)
                  ]),
                  _: 1
                }),
                o(d, {
                  label: "CPU",
                  width: "70"
                }, {
                  default: r(({ row: a }) => [
                    t("span", {
                      style: w({ color: f(a.cpu) })
                    }, l(a.cpu) + "%", 5)
                  ]),
                  _: 1
                }),
                o(d, {
                  label: "内存",
                  width: "80"
                }, {
                  default: r(({ row: a }) => [
                    t("span", {
                      style: w({ color: f(a.memPercent) })
                    }, l(a.memPercent) + "%", 5)
                  ]),
                  _: 1
                }),
                o(d, {
                  label: "磁盘",
                  width: "70"
                }, {
                  default: r(({ row: a }) => [
                    U(l(a.diskPercent == null ? "—" : a.diskPercent + "%"), 1)
                  ]),
                  _: 1
                }),
                o(d, {
                  label: "负载",
                  width: "80"
                }, {
                  default: r(({ row: a }) => [
                    U(l(a.load1.toFixed(2)), 1)
                  ]),
                  _: 1
                })
              ]),
              _: 1
            }, 8, ["data"]),
            t("div", ce, [
              o($, {
                layout: "total, prev, pager, next",
                total: tt.value.length,
                "page-size": j,
                "current-page": D.value,
                small: "",
                onCurrentChange: e[1] || (e[1] = (a) => D.value = a)
              }, null, 8, ["total", "current-page"])
            ])
          ]),
          t("div", de, [
            e[13] || (e[13] = t("div", { class: "section-title" }, "Top 进程（按 CPU）", -1)),
            o(C, {
              data: ct.value,
              size: "small",
              "empty-text": "暂无"
            }, {
              default: r(() => [
                o(d, {
                  prop: "pid",
                  label: "PID",
                  width: "70"
                }),
                o(d, {
                  prop: "name",
                  label: "进程",
                  "min-width": "140",
                  "show-overflow-tooltip": ""
                }),
                o(d, {
                  label: "CPU",
                  width: "80"
                }, {
                  default: r(({ row: a }) => [
                    t("span", {
                      style: w({ color: f(a.cpu) })
                    }, l(a.cpu) + "%", 5)
                  ]),
                  _: 1
                }),
                o(d, {
                  label: "MEM",
                  width: "80"
                }, {
                  default: r(({ row: a }) => [
                    U(l(a.mem) + "%", 1)
                  ]),
                  _: 1
                }),
                o(d, {
                  label: "RSS",
                  width: "90"
                }, {
                  default: r(({ row: a }) => [
                    U(l(a.rssBytes == null ? "—" : x(a.rssBytes)), 1)
                  ]),
                  _: 1
                })
              ]),
              _: 1
            }, 8, ["data"]),
            t("div", re, [
              o($, {
                layout: "total, prev, pager, next",
                total: L.value.length,
                "page-size": q,
                "current-page": A.value,
                small: "",
                onCurrentChange: e[2] || (e[2] = (a) => A.value = a)
              }, null, 8, ["total", "current-page"])
            ])
          ])
        ])
      ])) : (u(), m("div", kt, [
        n.value && v.value ? (u(), m("div", wt, [
          t("div", Pt, [
            o(i, {
              type: "dashboard",
              width: 64,
              "stroke-width": 6,
              percentage: n.value.cpu,
              color: f(n.value.cpu)
            }, null, 8, ["percentage", "color"]),
            e[3] || (e[3] = t("div", { class: "metric-label" }, "CPU", -1))
          ]),
          t("div", xt, [
            o(i, {
              type: "dashboard",
              width: 64,
              "stroke-width": 6,
              percentage: n.value.memPercent,
              color: f(n.value.memPercent)
            }, null, 8, ["percentage", "color"]),
            e[4] || (e[4] = t("div", { class: "metric-label" }, "内存", -1))
          ]),
          t("div", Ct, [
            o(i, {
              type: "dashboard",
              width: 64,
              "stroke-width": 6,
              percentage: n.value.diskPercent ?? 0,
              color: f(n.value.diskPercent)
            }, null, 8, ["percentage", "color"]),
            e[5] || (e[5] = t("div", { class: "metric-label" }, "磁盘", -1))
          ]),
          t("div", $t, [
            t("div", {
              class: "meta-host",
              title: v.value.hostname
            }, l(v.value.hostname), 9, It),
            t("div", St, "负载 " + l(n.value.load1.toFixed(2)), 1),
            t("div", Tt, "运行 " + l(J(n.value.uptimeSeconds)), 1),
            t("div", Ft, l(E.value || "—"), 1)
          ])
        ])) : (u(), m("div", Mt, l(F.value || "正在采集指标…"), 1))
      ]));
    };
  }
}, me = /* @__PURE__ */ bt(ue, [["__scopeId", "data-v-07c5edb7"]]), fe = {
  mount(P, g) {
    const h = mt(me, { appId: g.appId, mode: g.mode });
    return h.use(vt), h.mount(P), () => h.unmount();
  }
};
export {
  fe as default
};
