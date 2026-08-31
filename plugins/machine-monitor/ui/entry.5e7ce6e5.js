;(()=>{const s=document.createElement('style');s.textContent=".muted[data-v-be0a4d6a]{color:var(--atlas-muted)}.card-mode[data-v-be0a4d6a]{min-height:96px}.card-grid[data-v-be0a4d6a]{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;align-items:center}.card-metric[data-v-be0a4d6a]{text-align:center}.metric-label[data-v-be0a4d6a]{font-size:11px;color:var(--atlas-muted);margin-top:2px}.card-meta[data-v-be0a4d6a]{grid-column:1 / -1;border-top:1px dashed var(--atlas-stroke);margin-top:6px;padding-top:6px;font-size:12px;line-height:1.7}.meta-host[data-v-be0a4d6a]{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.meta-line[data-v-be0a4d6a]{color:var(--atlas-text)}.card-empty[data-v-be0a4d6a]{color:var(--atlas-muted);font-size:12px;text-align:center;padding:24px 0}.toolbar[data-v-be0a4d6a]{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}.toolbar-left[data-v-be0a4d6a]{display:flex;align-items:center;gap:12px}.updated[data-v-be0a4d6a]{font-size:12px}.error-bar[data-v-be0a4d6a]{background:var(--atlas-danger-weak);color:var(--atlas-danger);border-radius:var(--atlas-r-s);padding:8px 12px;margin-bottom:12px;font-size:13px}.section[data-v-be0a4d6a]{margin-bottom:16px}.section-title[data-v-be0a4d6a]{font-weight:600;font-size:13px;margin-bottom:12px}.host-grid[data-v-be0a4d6a]{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px 24px;font-size:13px}.host-item[data-v-be0a4d6a]{display:flex;flex-direction:column;gap:2px;min-width:0}.host-item b[data-v-be0a4d6a]{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.stat-grid[data-v-be0a4d6a]{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;margin-bottom:16px}.stat-card[data-v-be0a4d6a]{padding:16px;border-radius:var(--atlas-r-m)}.stat-icon[data-v-be0a4d6a]{font-size:20px;color:var(--atlas-accent);margin-bottom:10px}.stat-num[data-v-be0a4d6a]{font-size:22px;font-weight:700;font-variant-numeric:tabular-nums}.stat-label[data-v-be0a4d6a]{font-size:12px;color:var(--atlas-muted);margin-top:4px}.trend-grid[data-v-be0a4d6a]{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px}.trend-name[data-v-be0a4d6a]{font-size:12px;color:var(--atlas-muted);margin-bottom:8px}.trend[data-v-be0a4d6a]{display:flex;align-items:flex-end;gap:2px;height:96px}.trend-col[data-v-be0a4d6a]{flex:1;height:100%;display:flex;align-items:flex-end}.trend-bar[data-v-be0a4d6a]{width:100%;min-height:2px;border-radius:2px 2px 0 0;opacity:.9}.grid-2[data-v-be0a4d6a]{display:grid;grid-template-columns:1fr 1fr;gap:16px}.table-pager[data-v-be0a4d6a]{display:flex;justify-content:flex-end;padding-top:10px}.empty[data-v-be0a4d6a]{font-size:13px}\n";document.head.appendChild(s)})();import { computed as A, ref as _, onMounted as mt, onBeforeUnmount as vt, resolveComponent as k, openBlock as u, createElementBlock as m, createElementVNode as t, createVNode as o, toDisplayString as l, createCommentVNode as B, unref as I, withCtx as d, normalizeStyle as w, Fragment as at, renderList as lt, createTextVNode as U, createApp as pt } from "vue";
import _t from "element-plus";
import { Refresh as ht, Cpu as ft, Histogram as gt, Odometer as yt, Monitor as bt, DataLine as kt } from "@element-plus/icons-vue";
import { get as V } from "@atlas/runtime";
const wt = (P, g) => {
  const h = P.__vccOpts || P;
  for (const [T, F] of g)
    h[T] = F;
  return h;
}, Pt = {
  key: 0,
  class: "card-mode"
}, Ct = {
  key: 0,
  class: "card-grid"
}, xt = { class: "card-metric" }, $t = { class: "card-metric" }, It = { class: "card-metric" }, Tt = { class: "card-meta" }, Ft = ["title"], Mt = { class: "meta-line" }, St = { class: "meta-line" }, Nt = { class: "meta-line muted" }, Dt = {
  key: 1,
  class: "card-empty"
}, At = {
  key: 1,
  class: "detail-mode"
}, Ut = { class: "toolbar" }, zt = { class: "toolbar-left" }, Et = {
  key: 0,
  class: "updated muted"
}, Bt = {
  key: 0,
  class: "error-bar"
}, Vt = {
  key: 1,
  class: "surface section"
}, Rt = { class: "host-grid" }, Lt = { class: "host-item" }, Ot = { class: "host-item" }, Zt = { class: "host-item" }, Gt = {
  key: 2,
  class: "stat-grid"
}, Ht = { class: "stat-card surface" }, Kt = { class: "stat-card surface" }, jt = { class: "stat-label" }, qt = { class: "stat-card surface" }, Jt = { class: "stat-num" }, Qt = { class: "stat-label" }, Wt = { class: "stat-card surface" }, Xt = { class: "stat-label" }, Yt = { class: "stat-card surface" }, te = { class: "stat-num" }, ee = { class: "stat-label" }, se = { class: "surface section" }, ae = {
  key: 0,
  class: "trend-grid"
}, le = { class: "trend-name" }, oe = { class: "trend" }, ne = ["title"], ie = {
  key: 1,
  class: "empty muted"
}, re = { class: "grid-2" }, ce = { class: "surface section" }, de = { class: "table-pager" }, ue = { class: "surface section" }, me = { class: "table-pager" }, q = 10, J = 10, ve = {
  __name: "App",
  props: { appId: { type: Number, default: null }, mode: { type: String, default: "" } },
  setup(P) {
    const g = P, h = A(() => g.mode === "system-menu" || g.appId != null && g.appId !== void 0), T = () => `/api/apps/${Z.value ?? g.appId}/plugins/machine-monitor/ep`, F = _(!1), M = _(""), z = _(""), v = _(null), n = _(null), R = _([]), L = _([]), O = _(!0), Z = _(null);
    let G = null;
    const H = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 }), C = (s) => {
      if (s == null) return "—";
      const e = Number(s);
      return e >= 1073741824 ? `${H.format(e / 1073741824)} GB` : e >= 1048576 ? `${H.format(e / 1048576)} MB` : e >= 1024 ? `${H.format(e / 1024)} KB` : `${e} B`;
    }, Q = (s) => {
      if (s == null) return "—";
      const e = Math.floor(s / 86400), i = Math.floor(s % 86400 / 3600), r = Math.floor(s % 3600 / 60);
      return e > 0 ? `${e}天${i}时` : i > 0 ? `${i}时${r}分` : `${r}分`;
    }, f = (s) => s == null ? "var(--atlas-muted)" : s >= 85 ? "var(--atlas-danger)" : s >= 60 ? "var(--atlas-warning)" : "var(--atlas-success)", K = (s) => s == null ? "—" : `${s}%`, j = { timeZone: "Asia/Shanghai", hour12: !1 }, ot = (s) => {
      if (!s) return "—";
      const e = new Date(s);
      if (Number.isNaN(e.getTime())) return "—";
      const i = new Intl.DateTimeFormat("zh-CN", { ...j, month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(e), r = (y) => {
        var p;
        return ((p = i.find((c) => c.type === y)) == null ? void 0 : p.value) ?? "";
      };
      return `${r("month")}-${r("day")} ${r("hour")}:${r("minute")}`;
    }, nt = () => {
      const s = /* @__PURE__ */ new Date(), e = new Intl.DateTimeFormat("zh-CN", { ...j, hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(s), i = (r) => {
        var y;
        return ((y = e.find((p) => p.type === r)) == null ? void 0 : y.value) ?? "";
      };
      return `${i("hour")}:${i("minute")}:${i("second")}`;
    };
    async function E() {
      if (Z.value != null) return !0;
      try {
        const s = await V("/api/apps");
        if (s && s.length > 0)
          return Z.value = s[0].id, !0;
      } catch {
      }
      return !1;
    }
    async function W() {
      if (!await E()) return;
      const s = T();
      try {
        const e = await V(s + "/status");
        v.value = e.host, n.value = e.sample, z.value = nt(), M.value = "";
      } catch (e) {
        M.value = e && e.message || "采集失败";
      }
    }
    async function X() {
      if (await E())
        try {
          R.value = await V(T() + "/history/24"), N.value = 1;
        } catch {
        }
    }
    async function Y() {
      if (await E())
        try {
          L.value = await V(T() + "/processes"), D.value = 1;
        } catch {
        }
    }
    async function tt() {
      F.value = !0;
      try {
        await W(), h.value && await Promise.all([X(), Y()]);
      } finally {
        F.value = !1;
      }
    }
    const S = A(() => {
      const s = R.value;
      if (s.length === 0) return { cpu: [], mem: [], disk: [] };
      const e = Math.min(96, s.length), i = s.length / e, r = (y) => Array.from({ length: e }, (p, c) => {
        const x = s.slice(Math.floor(c * i), Math.floor((c + 1) * i)), $ = x.map((a) => a[y]).filter((a) => a != null);
        return $.length === 0 ? { v: null, ts: x[0].ts } : { v: $.reduce((a, b) => a + b, 0) / $.length, ts: x[0].ts };
      });
      return { cpu: r("cpu"), mem: r("memPercent"), disk: r("diskPercent") };
    }), it = () => Math.max(1, ...S.value.cpu.map((s) => s.v ?? 0), ...S.value.mem.map((s) => s.v ?? 0), ...S.value.disk.map((s) => s.v ?? 0)), rt = (s) => s ? new Intl.DateTimeFormat("zh-CN", { ...j, hour: "2-digit", minute: "2-digit" }).format(new Date(s)) : "", N = _(1), et = A(() => [...R.value].reverse()), ct = A(() => et.value.slice((N.value - 1) * q, N.value * q)), D = _(1), dt = A(() => L.value.slice((D.value - 1) * J, D.value * J));
    let st = 0;
    return mt(async () => {
      await tt(), G = setInterval(async () => {
        st += 1, O.value && await E() && (await W(), h.value && st % 12 === 0 && await Promise.all([X(), Y()]));
      }, 5e3);
    }), vt(() => {
      G && clearInterval(G);
    }), (s, e) => {
      const i = k("el-progress"), r = k("el-switch"), y = k("el-button"), p = k("el-icon"), c = k("el-table-column"), x = k("el-table"), $ = k("el-pagination");
      return h.value ? (u(), m("div", At, [
        t("div", Ut, [
          t("div", zt, [
            o(r, {
              modelValue: O.value,
              "onUpdate:modelValue": e[0] || (e[0] = (a) => O.value = a),
              "active-text": "自动刷新（5s）",
              size: "small"
            }, null, 8, ["modelValue"]),
            z.value ? (u(), m("span", Et, "最近更新 " + l(z.value), 1)) : B("", !0)
          ]),
          o(y, {
            icon: I(ht),
            circle: "",
            "aria-label": "刷新监控数据",
            loading: F.value,
            onClick: tt,
            title: "刷新"
          }, null, 8, ["icon", "loading"])
        ]),
        M.value ? (u(), m("div", Bt, l(M.value), 1)) : B("", !0),
        v.value ? (u(), m("div", Vt, [
          e[9] || (e[9] = t("div", { class: "section-title" }, "主机信息", -1)),
          t("div", Rt, [
            t("div", Lt, [
              e[6] || (e[6] = t("span", { class: "muted" }, "主机名", -1)),
              t("b", null, l(v.value.hostname), 1)
            ]),
            t("div", Ot, [
              e[7] || (e[7] = t("span", { class: "muted" }, "系统", -1)),
              t("b", null, l(v.value.platform) + " " + l(v.value.release) + "（" + l(v.value.arch) + "）", 1)
            ]),
            t("div", Zt, [
              e[8] || (e[8] = t("span", { class: "muted" }, "CPU", -1)),
              t("b", null, l(v.value.cores) + " 核 · " + l(v.value.cpuModel), 1)
            ])
          ])
        ])) : B("", !0),
        n.value ? (u(), m("div", Gt, [
          t("div", Ht, [
            o(p, {
              class: "stat-icon",
              "aria-hidden": "true"
            }, {
              default: d(() => [
                o(I(ft))
              ]),
              _: 1
            }),
            t("div", {
              class: "stat-num",
              style: w({ color: f(n.value.cpu) })
            }, l(K(n.value.cpu)), 5),
            e[10] || (e[10] = t("div", { class: "stat-label" }, "CPU 使用率", -1))
          ]),
          t("div", Kt, [
            o(p, {
              class: "stat-icon",
              "aria-hidden": "true"
            }, {
              default: d(() => [
                o(I(gt))
              ]),
              _: 1
            }),
            t("div", {
              class: "stat-num",
              style: w({ color: f(n.value.memPercent) })
            }, l(K(n.value.memPercent)), 5),
            t("div", jt, "内存 " + l(C(n.value.memUsed)) + " / " + l(C(n.value.memTotal)), 1)
          ]),
          t("div", qt, [
            o(p, {
              class: "stat-icon",
              "aria-hidden": "true"
            }, {
              default: d(() => [
                o(I(yt))
              ]),
              _: 1
            }),
            t("div", Jt, l(n.value.load1.toFixed(2)), 1),
            t("div", Qt, "负载 1/5/15：" + l(n.value.load1.toFixed(2)) + " / " + l(n.value.load5.toFixed(2)) + " / " + l(n.value.load15.toFixed(2)), 1)
          ]),
          t("div", Wt, [
            o(p, {
              class: "stat-icon",
              "aria-hidden": "true"
            }, {
              default: d(() => [
                o(I(bt))
              ]),
              _: 1
            }),
            t("div", {
              class: "stat-num",
              style: w({ color: f(n.value.diskPercent) })
            }, l(K(n.value.diskPercent)), 5),
            t("div", Xt, "磁盘 " + l(C(n.value.diskTotal)) + " · 剩余 " + l(C(n.value.diskFree)), 1)
          ]),
          t("div", Yt, [
            o(p, {
              class: "stat-icon",
              "aria-hidden": "true"
            }, {
              default: d(() => [
                o(I(kt))
              ]),
              _: 1
            }),
            t("div", te, l(Q(n.value.uptimeSeconds)), 1),
            t("div", ee, "运行时长 · 进程 RSS " + l(C(n.value.rss)), 1)
          ])
        ])) : B("", !0),
        t("div", se, [
          e[11] || (e[11] = t("div", { class: "section-title" }, "近 24 小时趋势（分钟采样）", -1)),
          S.value.cpu.length ? (u(), m("div", ae, [
            (u(), m(at, null, lt([["cpu", "CPU %", "cpu"], ["mem", "内存 %", "mem"], ["disk", "磁盘 %", "disk"]], (a) => t("div", {
              key: a[0],
              class: "trend-box"
            }, [
              t("div", le, l(a[1]), 1),
              t("div", oe, [
                (u(!0), m(at, null, lt(S.value[a[2]], (b, ut) => (u(), m("div", {
                  key: ut,
                  class: "trend-col",
                  title: `${rt(b.ts)}：${b.v == null ? "—" : b.v.toFixed(1)}%`
                }, [
                  t("div", {
                    class: "trend-bar",
                    style: w({ height: `${(b.v ?? 0) / it() * 100}%`, background: f(b.v) })
                  }, null, 4)
                ], 8, ne))), 128))
              ])
            ])), 64))
          ])) : (u(), m("div", ie, "暂无历史数据（控制台卡片或定时数据集刷新会自动采样）"))
        ]),
        t("div", re, [
          t("div", ce, [
            e[12] || (e[12] = t("div", { class: "section-title" }, "最近采样（北京时间）", -1)),
            o(x, {
              data: ct.value,
              size: "small",
              "empty-text": "暂无"
            }, {
              default: d(() => [
                o(c, {
                  label: "时间",
                  width: "120"
                }, {
                  default: d(({ row: a }) => [
                    U(l(ot(a.ts)), 1)
                  ]),
                  _: 1
                }),
                o(c, {
                  label: "CPU",
                  width: "70"
                }, {
                  default: d(({ row: a }) => [
                    t("span", {
                      style: w({ color: f(a.cpu) })
                    }, l(a.cpu) + "%", 5)
                  ]),
                  _: 1
                }),
                o(c, {
                  label: "内存",
                  width: "80"
                }, {
                  default: d(({ row: a }) => [
                    t("span", {
                      style: w({ color: f(a.memPercent) })
                    }, l(a.memPercent) + "%", 5)
                  ]),
                  _: 1
                }),
                o(c, {
                  label: "磁盘",
                  width: "70"
                }, {
                  default: d(({ row: a }) => [
                    U(l(a.diskPercent == null ? "—" : a.diskPercent + "%"), 1)
                  ]),
                  _: 1
                }),
                o(c, {
                  label: "负载",
                  width: "80"
                }, {
                  default: d(({ row: a }) => [
                    U(l(a.load1.toFixed(2)), 1)
                  ]),
                  _: 1
                })
              ]),
              _: 1
            }, 8, ["data"]),
            t("div", de, [
              o($, {
                layout: "total, prev, pager, next",
                total: et.value.length,
                "page-size": q,
                "current-page": N.value,
                small: "",
                onCurrentChange: e[1] || (e[1] = (a) => N.value = a)
              }, null, 8, ["total", "current-page"])
            ])
          ]),
          t("div", ue, [
            e[13] || (e[13] = t("div", { class: "section-title" }, "Top 进程（按 CPU）", -1)),
            o(x, {
              data: dt.value,
              size: "small",
              "empty-text": "暂无"
            }, {
              default: d(() => [
                o(c, {
                  prop: "pid",
                  label: "PID",
                  width: "70"
                }),
                o(c, {
                  prop: "name",
                  label: "进程",
                  "min-width": "140",
                  "show-overflow-tooltip": ""
                }),
                o(c, {
                  label: "CPU",
                  width: "80"
                }, {
                  default: d(({ row: a }) => [
                    t("span", {
                      style: w({ color: f(a.cpu) })
                    }, l(a.cpu) + "%", 5)
                  ]),
                  _: 1
                }),
                o(c, {
                  label: "MEM",
                  width: "80"
                }, {
                  default: d(({ row: a }) => [
                    U(l(a.mem) + "%", 1)
                  ]),
                  _: 1
                }),
                o(c, {
                  label: "RSS",
                  width: "90"
                }, {
                  default: d(({ row: a }) => [
                    U(l(a.rssBytes == null ? "—" : C(a.rssBytes)), 1)
                  ]),
                  _: 1
                })
              ]),
              _: 1
            }, 8, ["data"]),
            t("div", me, [
              o($, {
                layout: "total, prev, pager, next",
                total: L.value.length,
                "page-size": J,
                "current-page": D.value,
                small: "",
                onCurrentChange: e[2] || (e[2] = (a) => D.value = a)
              }, null, 8, ["total", "current-page"])
            ])
          ])
        ])
      ])) : (u(), m("div", Pt, [
        n.value && v.value ? (u(), m("div", Ct, [
          t("div", xt, [
            o(i, {
              type: "dashboard",
              width: 64,
              "stroke-width": 6,
              percentage: n.value.cpu,
              color: f(n.value.cpu)
            }, null, 8, ["percentage", "color"]),
            e[3] || (e[3] = t("div", { class: "metric-label" }, "CPU", -1))
          ]),
          t("div", $t, [
            o(i, {
              type: "dashboard",
              width: 64,
              "stroke-width": 6,
              percentage: n.value.memPercent,
              color: f(n.value.memPercent)
            }, null, 8, ["percentage", "color"]),
            e[4] || (e[4] = t("div", { class: "metric-label" }, "内存", -1))
          ]),
          t("div", It, [
            o(i, {
              type: "dashboard",
              width: 64,
              "stroke-width": 6,
              percentage: n.value.diskPercent ?? 0,
              color: f(n.value.diskPercent)
            }, null, 8, ["percentage", "color"]),
            e[5] || (e[5] = t("div", { class: "metric-label" }, "磁盘", -1))
          ]),
          t("div", Tt, [
            t("div", {
              class: "meta-host",
              title: v.value.hostname
            }, l(v.value.hostname), 9, Ft),
            t("div", Mt, "负载 " + l(n.value.load1.toFixed(2)), 1),
            t("div", St, "运行 " + l(Q(n.value.uptimeSeconds)), 1),
            t("div", Nt, l(z.value || "—"), 1)
          ])
        ])) : (u(), m("div", Dt, l(M.value || "正在采集指标…"), 1))
      ]));
    };
  }
}, pe = /* @__PURE__ */ wt(ve, [["__scopeId", "data-v-be0a4d6a"]]), ye = {
  mount(P, g) {
    const h = pt(pe, { appId: g.appId, mode: g.mode });
    return h.use(_t), h.mount(P), () => h.unmount();
  }
};
export {
  ye as default
};
