import { ref as c, onMounted as T, resolveComponent as f, resolveDirective as P, openBlock as w, createElementBlock as b, createElementVNode as C, createVNode as l, unref as k, withCtx as n, createTextVNode as s, withDirectives as S, createBlock as Y, toDisplayString as $, createApp as q } from "vue";
import K, { ElMessage as x, ElMessageBox as L } from "element-plus";
import { Refresh as j, Upload as G, Link as H, Delete as J } from "@element-plus/icons-vue";
import { get as Q, post as D, del as W } from "@atlas/runtime";
const X = (d, m) => {
  const a = d.__vccOpts || d;
  for (const [p, u] of m)
    a[p] = u;
  return a;
}, Z = { class: "surface" }, ee = { class: "panel-header" }, te = { class: "upload-box" }, le = { class: "upload-row" }, oe = {
  key: 0,
  class: "mono"
}, ne = {
  key: 1,
  class: "muted"
}, ae = {
  __name: "App",
  props: { appId: { type: Number, required: !0 } },
  setup(d) {
    const m = d, a = c([]), p = c(!1), u = c("default"), v = c(""), y = c([]), h = c(!1), g = () => `/api/apps/${m.appId}/plugins/model-files/ep`;
    async function _() {
      p.value = !0;
      try {
        a.value = await Q(g() + "/list");
      } finally {
        p.value = !1;
      }
    }
    T(_);
    function E(e) {
      y.value = e;
    }
    async function I() {
      if (!y.value.length) {
        x.warning("请选择文件");
        return;
      }
      h.value = !0;
      try {
        const e = new FormData();
        e.append("category", u.value), e.append("description", v.value);
        for (const t of y.value)
          e.append("files", t.raw, t.name);
        await D(g() + "/upload", e), x.success("上传成功"), y.value = [], u.value = "default", v.value = "", await _();
      } finally {
        h.value = !1;
      }
    }
    async function z(e) {
      try {
        await L.confirm(`确认删除「${e.name}」？`, "删除模型文件", { type: "error" }), await W(`${g()}/delete/${e.id}`), await _();
      } catch {
      }
    }
    async function R(e) {
      const t = await D(`${g()}/publish/${e.id}`);
      return x.success("已公开托管"), await _(), t;
    }
    function F(e) {
      return e.token ? `/api/files/${e.token}/download` : "";
    }
    function U(e) {
      return e >= 1048576 ? `${(e / 1048576).toFixed(1)} MB` : e >= 1024 ? `${(e / 1024).toFixed(1)} KB` : `${e} B`;
    }
    return (e, t) => {
      const r = f("el-button"), V = f("el-input"), A = f("el-upload"), i = f("el-table-column"), M = f("el-tag"), N = f("el-table"), O = P("loading");
      return w(), b("div", Z, [
        C("div", ee, [
          l(r, {
            icon: k(j),
            size: "small",
            circle: "",
            loading: p.value,
            onClick: _
          }, null, 8, ["icon", "loading"])
        ]),
        C("div", te, [
          C("div", le, [
            l(V, {
              modelValue: u.value,
              "onUpdate:modelValue": t[0] || (t[0] = (o) => u.value = o),
              placeholder: "分类（default）",
              style: { width: "160px" }
            }, null, 8, ["modelValue"]),
            l(V, {
              modelValue: v.value,
              "onUpdate:modelValue": t[1] || (t[1] = (o) => v.value = o),
              placeholder: "描述（可选）",
              style: { width: "220px" }
            }, null, 8, ["modelValue"]),
            l(A, {
              "auto-upload": !1,
              "on-change": E,
              multiple: "",
              "show-file-list": !0
            }, {
              default: n(() => [
                l(r, {
                  type: "primary",
                  icon: k(G),
                  plain: ""
                }, {
                  default: n(() => [...t[2] || (t[2] = [
                    s("选择文件", -1)
                  ])]),
                  _: 1
                }, 8, ["icon"])
              ]),
              _: 1
            }),
            l(r, {
              type: "primary",
              loading: h.value,
              onClick: I
            }, {
              default: n(() => [...t[3] || (t[3] = [
                s("上传", -1)
              ])]),
              _: 1
            }, 8, ["loading"])
          ])
        ]),
        S((w(), Y(N, {
          data: a.value,
          "empty-text": "暂无模型文件"
        }, {
          default: n(() => [
            l(i, {
              prop: "name",
              label: "名称",
              "min-width": "140"
            }),
            l(i, {
              prop: "category",
              label: "分类",
              width: "100"
            }),
            l(i, {
              prop: "kind",
              label: "类型",
              width: "90"
            }, {
              default: n(({ row: o }) => [
                l(M, {
                  size: "small",
                  type: o.kind === "DIRECTORY" ? "warning" : "info"
                }, {
                  default: n(() => [
                    s($(o.kind === "DIRECTORY" ? "目录" : "文件"), 1)
                  ]),
                  _: 2
                }, 1032, ["type"])
              ]),
              _: 1
            }),
            l(i, {
              label: "大小",
              width: "100"
            }, {
              default: n(({ row: o }) => [
                s($(U(o.totalSize)), 1)
              ]),
              _: 1
            }),
            l(i, {
              prop: "version",
              label: "版本",
              width: "70"
            }),
            l(i, {
              prop: "downloadCount",
              label: "下载",
              width: "80"
            }),
            l(i, {
              label: "公开链接",
              "min-width": "160"
            }, {
              default: n(({ row: o }) => [
                o.token ? (w(), b("code", oe, $(o.token.slice(0, 12)) + "…", 1)) : (w(), b("span", ne, "未托管"))
              ]),
              _: 1
            }),
            l(i, {
              label: "操作",
              width: "200",
              fixed: "right"
            }, {
              default: n(({ row: o }) => [
                l(r, {
                  size: "small",
                  onClick: (B) => R(o)
                }, {
                  default: n(() => [...t[4] || (t[4] = [
                    s("托管", -1)
                  ])]),
                  _: 1
                }, 8, ["onClick"]),
                l(r, {
                  size: "small",
                  type: "primary",
                  plain: "",
                  icon: k(H),
                  onClick: (B) => e.window.open(F(o), "_blank")
                }, {
                  default: n(() => [...t[5] || (t[5] = [
                    s("下载", -1)
                  ])]),
                  _: 1
                }, 8, ["icon", "onClick"]),
                l(r, {
                  size: "small",
                  type: "danger",
                  plain: "",
                  icon: k(J),
                  onClick: (B) => z(o)
                }, {
                  default: n(() => [...t[6] || (t[6] = [
                    s("删除", -1)
                  ])]),
                  _: 1
                }, 8, ["icon", "onClick"])
              ]),
              _: 1
            })
          ]),
          _: 1
        }, 8, ["data"])), [
          [O, p.value]
        ])
      ]);
    };
  }
}, ie = /* @__PURE__ */ X(ae, [["__scopeId", "data-v-26942f65"]]), re = {
  mount(d, m) {
    const a = q(ie, { appId: m.appId });
    return a.use(K), a.mount(d), () => a.unmount();
  }
};
export {
  re as default
};
