;(()=>{const s=document.createElement('style');s.textContent=".muted[data-v-b18ed316]{color:var(--atlas-muted)}.card-mode[data-v-b18ed316]{min-height:96px}.card-grid[data-v-b18ed316]{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;align-items:center}.card-metric[data-v-b18ed316]{text-align:center}.metric-label[data-v-b18ed316]{font-size:11px;color:var(--atlas-muted);margin-top:2px}.card-meta[data-v-b18ed316]{grid-column:1 / -1;border-top:1px dashed var(--atlas-stroke);margin-top:6px;padding-top:6px;font-size:12px;line-height:1.7}.meta-host[data-v-b18ed316]{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.meta-line[data-v-b18ed316]{color:var(--atlas-text)}.card-empty[data-v-b18ed316]{color:var(--atlas-muted);font-size:12px;text-align:center;padding:24px 0}.toolbar[data-v-b18ed316]{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}.toolbar-left[data-v-b18ed316]{display:flex;align-items:center;gap:12px}.updated[data-v-b18ed316]{font-size:12px}.error-bar[data-v-b18ed316]{background:var(--atlas-danger-weak);color:var(--atlas-danger);border-radius:var(--atlas-r-s);padding:8px 12px;margin-bottom:12px;font-size:13px}.section[data-v-b18ed316]{margin-bottom:16px}.section-title[data-v-b18ed316]{font-weight:600;font-size:13px;margin-bottom:12px}.host-grid[data-v-b18ed316]{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px 24px;font-size:13px}.host-item[data-v-b18ed316]{display:flex;flex-direction:column;gap:2px;min-width:0}.host-item b[data-v-b18ed316]{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.stat-grid[data-v-b18ed316]{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;margin-bottom:16px}.stat-card[data-v-b18ed316]{padding:16px;border-radius:var(--atlas-r-m)}.stat-icon[data-v-b18ed316]{font-size:20px;color:var(--atlas-accent);margin-bottom:10px}.stat-num[data-v-b18ed316]{font-size:22px;font-weight:700;font-variant-numeric:tabular-nums}.stat-label[data-v-b18ed316]{font-size:12px;color:var(--atlas-muted);margin-top:4px}.trend-grid[data-v-b18ed316]{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px}.trend-name[data-v-b18ed316]{font-size:12px;color:var(--atlas-muted);margin-bottom:8px}.trend[data-v-b18ed316]{display:flex;align-items:flex-end;gap:2px;height:96px}.trend-col[data-v-b18ed316]{flex:1;height:100%;display:flex;align-items:flex-end}.trend-bar[data-v-b18ed316]{width:100%;min-height:2px;border-radius:2px 2px 0 0;opacity:.9}.trend-latest[data-v-b18ed316]{font-size:11px;margin-top:6px}.grid-2[data-v-b18ed316]{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}@media (max-width: 720px){.grid-2[data-v-b18ed316]{grid-template-columns:1fr}.grid-2[data-v-b18ed316] .el-table{width:100%}.section[data-v-b18ed316]{min-width:0;overflow:hidden}.section[data-v-b18ed316] .el-table{max-width:100%}.toolbar[data-v-b18ed316]{flex-wrap:wrap;gap:8px}.toolbar-left[data-v-b18ed316]{flex-wrap:wrap}.host-grid[data-v-b18ed316]{grid-template-columns:1fr}}.table-pager[data-v-b18ed316]{display:flex;justify-content:flex-end;padding-top:10px}.empty[data-v-b18ed316]{font-size:13px}\n";document.head.appendChild(s)})();import { computed as U, ref as p, onMounted as _t, onBeforeUnmount as ht, resolveComponent as k, openBlock as u, createElementBlock as m, createElementVNode as e, createVNode as n, toDisplayString as l, createCommentVNode as V, withCtx as r, unref as T, normalizeStyle as $, Fragment as it, renderList as rt, createTextVNode as z, createApp as ft } from "vue";
import gt from "element-plus";
import { Refresh as yt, Cpu as bt, Histogram as kt, Odometer as wt, Monitor as Pt, DataLine as $t } from "@element-plus/icons-vue";
import { get as R } from "@atlas/runtime";
const Ct = (C, g) => {
  const _ = C.__vccOpts || C;
  for (const [F, S] of g)
    _[F] = S;
  return _;
}, xt = {
  key: 0,
  class: "card-mode"
}, It = {
  key: 0,
  class: "card-grid"
}, Tt = { class: "card-metric" }, Ft = { class: "card-metric" }, St = { class: "card-metric" }, Mt = { class: "card-meta" }, At = ["title"], Nt = { class: "meta-line" }, Dt = { class: "meta-line" }, Ut = { class: "meta-line muted" }, zt = {
  key: 1,
  class: "card-empty"
}, Et = {
  key: 1,
  class: "detail-mode"
}, Bt = { class: "toolbar" }, Vt = { class: "toolbar-left" }, Rt = {
  key: 0,
  class: "updated muted"
}, Lt = {
  key: 0,
  class: "error-bar"
}, Ot = {
  key: 1,
  class: "surface section"
}, Zt = { class: "host-grid" }, Gt = { class: "host-item" }, qt = { class: "host-item" }, Ht = { class: "host-item" }, Kt = {
  key: 2,
  class: "stat-grid"
}, jt = { class: "stat-card surface" }, Jt = { class: "stat-card surface" }, Qt = { class: "stat-label" }, Wt = { class: "stat-card surface" }, Xt = { class: "stat-num" }, Yt = { class: "stat-label" }, te = { class: "stat-card surface" }, ee = { class: "stat-label" }, ae = { class: "stat-card surface" }, se = { class: "stat-num" }, le = { class: "stat-label" }, oe = { class: "surface section" }, ne = {
  key: 0,
  class: "trend-grid"
}, ie = { class: "trend-name" }, re = ["aria-label"], ce = ["title"], de = { class: "trend-latest muted" }, ue = {
  key: 1,
  class: "empty muted"
}, me = { class: "grid-2" }, ve = { class: "surface section" }, pe = { class: "table-pager" }, _e = { class: "surface section" }, he = { class: "table-pager" }, Q = 10, W = 10, fe = {
  __name: "App",
  props: { appId: { type: Number, default: null }, mode: { type: String, default: "" } },
  setup(C) {
    const g = C, _ = U(() => g.mode === "system-menu" || g.appId != null && g.appId !== void 0), F = () => `/api/apps/${G.value ?? g.appId}/plugins/machine-monitor/ep`, S = p(!1), M = p(""), E = p(""), v = p(null), o = p(null), L = p([]), O = p([]), Z = p(!0), G = p(null);
    let q = null;
    const H = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 }), x = (a) => {
      if (a == null) return "—";
      const t = Number(a);
      return t >= 1073741824 ? `${H.format(t / 1073741824)} GB` : t >= 1048576 ? `${H.format(t / 1048576)} MB` : t >= 1024 ? `${H.format(t / 1024)} KB` : `${t} B`;
    }, X = (a) => {
      if (a == null) return "—";
      const t = Math.floor(a / 86400), i = Math.floor(a % 86400 / 3600), c = Math.floor(a % 3600 / 60);
      return t > 0 ? `${t}天${i}时` : i > 0 ? `${i}时${c}分` : `${c}分`;
    }, h = (a) => a == null ? "var(--atlas-muted)" : a >= 85 ? "var(--atlas-danger)" : a >= 60 ? "var(--atlas-warning)" : "var(--atlas-success)", K = (a) => a == null ? "—" : `${a}%`, j = { timeZone: "Asia/Shanghai", hour12: !1 }, ct = (a) => {
      if (!a) return "—";
      const t = new Date(a);
      if (Number.isNaN(t.getTime())) return "—";
      const i = new Intl.DateTimeFormat("zh-CN", { ...j, month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(t), c = (y) => {
        var P;
        return ((P = i.find((f) => f.type === y)) == null ? void 0 : P.value) ?? "";
      };
      return `${c("month")}-${c("day")} ${c("hour")}:${c("minute")}`;
    }, dt = () => {
      const a = /* @__PURE__ */ new Date(), t = new Intl.DateTimeFormat("zh-CN", { ...j, hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(a), i = (c) => {
        var y;
        return ((y = t.find((P) => P.type === c)) == null ? void 0 : y.value) ?? "";
      };
      return `${i("hour")}:${i("minute")}:${i("second")}`;
    };
    async function B() {
      if (G.value != null) return !0;
      try {
        const a = await R("/api/apps"), t = Array.isArray(a) ? a : (a == null ? void 0 : a.rows) ?? [];
        if (t.length > 0)
          return G.value = t[0].id, !0;
      } catch {
      }
      return !1;
    }
    let J = 0;
    async function Y() {
      if (!await B()) return;
      const a = F(), t = ++J;
      try {
        const i = await R(a + "/status");
        if (t !== J) return;
        v.value = i.host, o.value = i.sample, E.value = dt(), M.value = "";
      } catch (i) {
        t === J && (M.value = i && i.message || "采集失败");
      }
    }
    async function tt() {
      if (await B())
        try {
          L.value = await R(F() + "/history/24"), A.value = 1;
        } catch {
        }
    }
    async function et() {
      if (await B())
        try {
          O.value = await R(F() + "/processes"), N.value = 1;
        } catch {
        }
    }
    async function at() {
      S.value = !0;
      try {
        await Y(), _.value && await Promise.all([tt(), et()]);
      } finally {
        S.value = !1;
      }
    }
    const w = U(() => {
      const a = L.value;
      if (a.length === 0) return { cpu: [], mem: [], disk: [] };
      const t = Math.min(96, a.length), i = a.length / t, c = (y) => Array.from({ length: t }, (P, f) => {
        const d = a.slice(Math.floor(f * i), Math.floor((f + 1) * i)), I = d.map((b) => b[y]).filter((b) => b != null);
        return I.length === 0 ? { v: null, ts: d[0].ts } : { v: I.reduce((b, s) => b + s, 0) / I.length, ts: d[0].ts };
      });
      return { cpu: c("cpu"), mem: c("memPercent"), disk: c("diskPercent") };
    }), ut = () => Math.max(1, ...w.value.cpu.map((a) => a.v ?? 0), ...w.value.mem.map((a) => a.v ?? 0), ...w.value.disk.map((a) => a.v ?? 0)), st = (a) => a ? new Intl.DateTimeFormat("zh-CN", { ...j, hour: "2-digit", minute: "2-digit" }).format(new Date(a)) : "", lt = (a) => {
      const t = w.value[a] ?? [];
      for (let i = t.length - 1; i >= 0; i -= 1)
        if (t[i].v != null) return `${st(t[i].ts)} ${t[i].v.toFixed(1)}%`;
      return "暂无采样";
    }, A = p(1), ot = U(() => [...L.value].reverse()), mt = U(() => ot.value.slice((A.value - 1) * Q, A.value * Q)), N = p(1), vt = U(() => O.value.slice((N.value - 1) * W, N.value * W));
    let nt = 0;
    return _t(async () => {
      await at(), q = setInterval(async () => {
        nt += 1, Z.value && await B() && (await Y(), _.value && nt % 12 === 0 && await Promise.all([tt(), et()]));
      }, 5e3);
    }), ht(() => {
      q && clearInterval(q);
    }), (a, t) => {
      const i = k("el-progress"), c = k("el-switch"), y = k("el-button"), P = k("el-tooltip"), f = k("el-icon"), d = k("el-table-column"), I = k("el-table"), b = k("el-pagination");
      return _.value ? (u(), m("div", Et, [
        e("div", Bt, [
          e("div", Vt, [
            n(c, {
              modelValue: Z.value,
              "onUpdate:modelValue": t[0] || (t[0] = (s) => Z.value = s),
              "active-color": "var(--atlas-accent)",
              "active-text": "自动刷新（5s）",
              size: "small",
              "aria-label": "切换自动刷新"
            }, null, 8, ["modelValue"]),
            E.value ? (u(), m("span", Rt, "最近更新 " + l(E.value), 1)) : V("", !0)
          ]),
          n(P, {
            content: "刷新监控数据",
            placement: "top"
          }, {
            default: r(() => [
              n(y, {
                icon: T(yt),
                circle: "",
                "aria-label": "刷新监控数据",
                loading: S.value,
                onClick: at
              }, null, 8, ["icon", "loading"])
            ]),
            _: 1
          })
        ]),
        M.value ? (u(), m("div", Lt, l(M.value), 1)) : V("", !0),
        v.value ? (u(), m("div", Ot, [
          t[9] || (t[9] = e("div", { class: "section-title" }, "主机信息", -1)),
          e("div", Zt, [
            e("div", Gt, [
              t[6] || (t[6] = e("span", { class: "muted" }, "主机名", -1)),
              e("b", null, l(v.value.hostname), 1)
            ]),
            e("div", qt, [
              t[7] || (t[7] = e("span", { class: "muted" }, "系统", -1)),
              e("b", null, l(v.value.platform) + " " + l(v.value.release) + "（" + l(v.value.arch) + "）", 1)
            ]),
            e("div", Ht, [
              t[8] || (t[8] = e("span", { class: "muted" }, "CPU", -1)),
              e("b", null, l(v.value.cores) + " 核 · " + l(v.value.cpuModel), 1)
            ])
          ])
        ])) : V("", !0),
        o.value ? (u(), m("div", Kt, [
          e("div", jt, [
            n(f, {
              class: "stat-icon",
              "aria-hidden": "true"
            }, {
              default: r(() => [
                n(T(bt))
              ]),
              _: 1
            }),
            e("div", {
              class: "stat-num",
              style: $({ color: h(o.value.cpu) })
            }, l(K(o.value.cpu)), 5),
            t[10] || (t[10] = e("div", { class: "stat-label" }, "CPU 使用率", -1))
          ]),
          e("div", Jt, [
            n(f, {
              class: "stat-icon",
              "aria-hidden": "true"
            }, {
              default: r(() => [
                n(T(kt))
              ]),
              _: 1
            }),
            e("div", {
              class: "stat-num",
              style: $({ color: h(o.value.memPercent) })
            }, l(K(o.value.memPercent)), 5),
            e("div", Qt, "内存 " + l(x(o.value.memUsed)) + " / " + l(x(o.value.memTotal)), 1)
          ]),
          e("div", Wt, [
            n(f, {
              class: "stat-icon",
              "aria-hidden": "true"
            }, {
              default: r(() => [
                n(T(wt))
              ]),
              _: 1
            }),
            e("div", Xt, l(o.value.load1.toFixed(2)), 1),
            e("div", Yt, "负载 1/5/15：" + l(o.value.load1.toFixed(2)) + " / " + l(o.value.load5.toFixed(2)) + " / " + l(o.value.load15.toFixed(2)), 1)
          ]),
          e("div", te, [
            n(f, {
              class: "stat-icon",
              "aria-hidden": "true"
            }, {
              default: r(() => [
                n(T(Pt))
              ]),
              _: 1
            }),
            e("div", {
              class: "stat-num",
              style: $({ color: h(o.value.diskPercent) })
            }, l(K(o.value.diskPercent)), 5),
            e("div", ee, "磁盘 " + l(x(o.value.diskTotal)) + " · 剩余 " + l(x(o.value.diskFree)), 1)
          ]),
          e("div", ae, [
            n(f, {
              class: "stat-icon",
              "aria-hidden": "true"
            }, {
              default: r(() => [
                n(T($t))
              ]),
              _: 1
            }),
            e("div", se, l(X(o.value.uptimeSeconds)), 1),
            e("div", le, "运行时长 · 进程 RSS " + l(x(o.value.rss)), 1)
          ])
        ])) : V("", !0),
        e("div", oe, [
          t[11] || (t[11] = e("div", { class: "section-title" }, "近 24 小时趋势（分钟采样）", -1)),
          w.value.cpu.length ? (u(), m("div", ne, [
            (u(), m(it, null, rt([["cpu", "CPU %", "cpu"], ["mem", "内存 %", "mem"], ["disk", "磁盘 %", "disk"]], (s) => e("div", {
              key: s[0],
              class: "trend-box"
            }, [
              e("div", ie, l(s[1]), 1),
              e("div", {
                class: "trend",
                role: "img",
                "aria-label": `近 24 小时 ${s[1]} 趋势图，共 ${w.value[s[2]].length} 个采样点，最新 ${lt(s[2])}`
              }, [
                (u(!0), m(it, null, rt(w.value[s[2]], (D, pt) => (u(), m("div", {
                  key: pt,
                  class: "trend-col",
                  title: `${st(D.ts)}：${D.v == null ? "—" : D.v.toFixed(1)}%`
                }, [
                  e("div", {
                    class: "trend-bar",
                    style: $({ height: `${(D.v ?? 0) / ut() * 100}%`, background: h(D.v) })
                  }, null, 4)
                ], 8, ce))), 128))
              ], 8, re),
              e("div", de, l(lt(s[2])), 1)
            ])), 64))
          ])) : (u(), m("div", ue, "暂无历史数据（控制台卡片或定时数据集刷新会自动采样）"))
        ]),
        e("div", me, [
          e("div", ve, [
            t[12] || (t[12] = e("div", { class: "section-title" }, "最近采样（北京时间）", -1)),
            n(I, {
              data: mt.value,
              size: "small",
              "empty-text": "暂无采样记录"
            }, {
              default: r(() => [
                n(d, {
                  label: "时间",
                  width: "120"
                }, {
                  default: r(({ row: s }) => [
                    z(l(ct(s.ts)), 1)
                  ]),
                  _: 1
                }),
                n(d, {
                  label: "CPU",
                  width: "70"
                }, {
                  default: r(({ row: s }) => [
                    e("span", {
                      style: $({ color: h(s.cpu) })
                    }, l(s.cpu) + "%", 5)
                  ]),
                  _: 1
                }),
                n(d, {
                  label: "内存",
                  width: "80"
                }, {
                  default: r(({ row: s }) => [
                    e("span", {
                      style: $({ color: h(s.memPercent) })
                    }, l(s.memPercent) + "%", 5)
                  ]),
                  _: 1
                }),
                n(d, {
                  label: "磁盘",
                  width: "70"
                }, {
                  default: r(({ row: s }) => [
                    z(l(s.diskPercent == null ? "—" : s.diskPercent + "%"), 1)
                  ]),
                  _: 1
                }),
                n(d, {
                  label: "负载",
                  width: "80"
                }, {
                  default: r(({ row: s }) => [
                    z(l(s.load1.toFixed(2)), 1)
                  ]),
                  _: 1
                })
              ]),
              _: 1
            }, 8, ["data"]),
            e("div", pe, [
              n(b, {
                layout: "total, prev, pager, next",
                total: ot.value.length,
                "page-size": Q,
                "current-page": A.value,
                small: "",
                onCurrentChange: t[1] || (t[1] = (s) => A.value = s)
              }, null, 8, ["total", "current-page"])
            ])
          ]),
          e("div", _e, [
            t[13] || (t[13] = e("div", { class: "section-title" }, "Top 进程（按 CPU）", -1)),
            n(I, {
              data: vt.value,
              size: "small",
              "empty-text": "暂无进程数据"
            }, {
              default: r(() => [
                n(d, {
                  prop: "pid",
                  label: "PID",
                  width: "70"
                }),
                n(d, {
                  prop: "name",
                  label: "进程",
                  "min-width": "140",
                  "show-overflow-tooltip": ""
                }),
                n(d, {
                  label: "CPU",
                  width: "80"
                }, {
                  default: r(({ row: s }) => [
                    e("span", {
                      style: $({ color: h(s.cpu) })
                    }, l(s.cpu) + "%", 5)
                  ]),
                  _: 1
                }),
                n(d, {
                  label: "MEM",
                  width: "80"
                }, {
                  default: r(({ row: s }) => [
                    z(l(s.mem) + "%", 1)
                  ]),
                  _: 1
                }),
                n(d, {
                  label: "RSS",
                  width: "90"
                }, {
                  default: r(({ row: s }) => [
                    z(l(s.rssBytes == null ? "—" : x(s.rssBytes)), 1)
                  ]),
                  _: 1
                })
              ]),
              _: 1
            }, 8, ["data"]),
            e("div", he, [
              n(b, {
                layout: "total, prev, pager, next",
                total: O.value.length,
                "page-size": W,
                "current-page": N.value,
                small: "",
                onCurrentChange: t[2] || (t[2] = (s) => N.value = s)
              }, null, 8, ["total", "current-page"])
            ])
          ])
        ])
      ])) : (u(), m("div", xt, [
        o.value && v.value ? (u(), m("div", It, [
          e("div", Tt, [
            n(i, {
              type: "dashboard",
              width: 64,
              "stroke-width": 6,
              percentage: o.value.cpu,
              color: h(o.value.cpu),
              "aria-label": `CPU 使用率 ${o.value.cpu}%`
            }, null, 8, ["percentage", "color", "aria-label"]),
            t[3] || (t[3] = e("div", { class: "metric-label" }, "CPU", -1))
          ]),
          e("div", Ft, [
            n(i, {
              type: "dashboard",
              width: 64,
              "stroke-width": 6,
              percentage: o.value.memPercent,
              color: h(o.value.memPercent),
              "aria-label": `内存使用率 ${o.value.memPercent}%`
            }, null, 8, ["percentage", "color", "aria-label"]),
            t[4] || (t[4] = e("div", { class: "metric-label" }, "内存", -1))
          ]),
          e("div", St, [
            n(i, {
              type: "dashboard",
              width: 64,
              "stroke-width": 6,
              percentage: o.value.diskPercent ?? 0,
              color: h(o.value.diskPercent),
              "aria-label": `磁盘使用率 ${o.value.diskPercent ?? 0}%`
            }, null, 8, ["percentage", "color", "aria-label"]),
            t[5] || (t[5] = e("div", { class: "metric-label" }, "磁盘", -1))
          ]),
          e("div", Mt, [
            e("div", {
              class: "meta-host",
              title: v.value.hostname
            }, l(v.value.hostname), 9, At),
            e("div", Nt, "负载 " + l(o.value.load1.toFixed(2)), 1),
            e("div", Dt, "运行 " + l(X(o.value.uptimeSeconds)), 1),
            e("div", Ut, l(E.value || "—"), 1)
          ])
        ])) : (u(), m("div", zt, l(M.value || "正在采集指标…"), 1))
      ]));
    };
  }
}, ge = /* @__PURE__ */ Ct(fe, [["__scopeId", "data-v-b18ed316"]]), Pe = {
  mount(C, g) {
    const _ = ft(ge, { appId: g.appId, mode: g.mode });
    return _.use(gt), _.mount(C), () => _.unmount();
  }
};
export {
  Pe as default
};
