import { ref as s, onMounted as h, resolveComponent as p, resolveDirective as ee, openBlock as z, createElementBlock as R, createElementVNode as E, createVNode as l, unref as V, withCtx as a, createTextVNode as u, withDirectives as le, createBlock as te, toDisplayString as w, createCommentVNode as M, createApp as ae } from "vue";
import ne, { ElMessageBox as oe, ElMessage as ie } from "element-plus";
import { Plus as se, Refresh as ue, VideoPlay as de, Clock as re, EditPen as pe, Delete as me } from "@element-plus/icons-vue";
import { get as T, del as ve, put as fe, post as S } from "@atlas/runtime";
const ce = (v, g) => {
  const d = v.__vccOpts || v;
  for (const [f, m] of g)
    d[f] = m;
  return d;
}, be = { class: "surface" }, ye = { class: "panel-header" }, Ve = { class: "preview" }, ge = {
  key: 0,
  class: "render-result"
}, _e = { class: "render-content" }, ke = {
  key: 0,
  class: "missing"
}, we = {
  __name: "App",
  props: { appId: { type: Number, required: !0 } },
  setup(v) {
    const g = v, d = s([]), f = s(!1), m = s(!1), _ = s(null), i = s({ name: "", category: "default", description: "", content: "", variables: "" }), A = s(!1), C = s(!1), B = s(null), $ = s(""), c = s(null), x = s(!1), j = s(null), q = s([]), b = () => `/api/apps/${g.appId}/plugins/prompts/ep`;
    async function U() {
      f.value = !0;
      try {
        d.value = await T(b() + "/list");
      } finally {
        f.value = !1;
      }
    }
    h(U);
    function F() {
      _.value = null, i.value = { name: "", category: "default", description: "", content: "", variables: "" }, m.value = !0;
    }
    function G(n) {
      _.value = n, i.value = {
        name: n.name,
        category: n.category,
        description: n.description,
        content: n.content,
        variables: (n.variables || []).map((e) => e.name).join(", ")
      }, m.value = !0;
    }
    async function H() {
      if (!i.value.name.trim() || !i.value.content.trim()) {
        ie.warning("请填写名称与内容");
        return;
      }
      A.value = !0;
      try {
        const n = i.value.variables.split(",").map((o) => o.trim()).filter(Boolean).map((o) => ({ name: o, description: "", required: !1 })), e = { ...i.value, variables: n };
        _.value ? await fe(`${b()}/update/${_.value.id}`, e) : await S(b() + "/create", e), m.value = !1, await U();
      } finally {
        A.value = !1;
      }
    }
    async function J(n) {
      try {
        await oe.confirm(`确认删除「${n.name}」？`, "删除提示词", { type: "error" }), await ve(`${b()}/delete/${n.id}`), await U();
      } catch {
      }
    }
    function K(n) {
      B.value = n, $.value = "", c.value = null, C.value = !0;
    }
    async function L() {
      const n = {};
      for (const e of $.value.split(`
`)) {
        const o = e.indexOf("=");
        o > 0 && (n[e.slice(0, o).trim()] = e.slice(o + 1).trim());
      }
      c.value = await S(`${b()}/render/${B.value.id}`, { variables: n });
    }
    async function Q(n) {
      j.value = n, q.value = await T(`${b()}/versions/${n.id}`), x.value = !0;
    }
    return (n, e) => {
      var O, P;
      const o = p("el-button"), r = p("el-table-column"), W = p("el-tag"), D = p("el-table"), y = p("el-input"), k = p("el-form-item"), X = p("el-form"), I = p("el-dialog"), Y = p("el-alert"), Z = ee("loading");
      return z(), R("div", be, [
        E("div", ye, [
          l(o, {
            type: "primary",
            size: "small",
            icon: V(se),
            onClick: F
          }, {
            default: a(() => [...e[12] || (e[12] = [
              u("新增提示词", -1)
            ])]),
            _: 1
          }, 8, ["icon"]),
          l(o, {
            icon: V(ue),
            size: "small",
            circle: "",
            loading: f.value,
            onClick: U
          }, null, 8, ["icon", "loading"])
        ]),
        le((z(), te(D, {
          data: d.value,
          "empty-text": "暂无提示词"
        }, {
          default: a(() => [
            l(r, {
              prop: "name",
              label: "名称",
              "min-width": "140"
            }),
            l(r, {
              prop: "category",
              label: "分类",
              width: "100"
            }),
            l(r, {
              label: "内容预览",
              "min-width": "220",
              "show-overflow-tooltip": ""
            }, {
              default: a(({ row: t }) => [
                E("span", Ve, w(t.content), 1)
              ]),
              _: 1
            }),
            l(r, {
              prop: "version",
              label: "版本",
              width: "70"
            }),
            l(r, {
              label: "启用",
              width: "80"
            }, {
              default: a(({ row: t }) => [
                l(W, {
                  size: "small",
                  type: t.enabled ? "success" : "info"
                }, {
                  default: a(() => [
                    u(w(t.enabled ? "启用" : "停用"), 1)
                  ]),
                  _: 2
                }, 1032, ["type"])
              ]),
              _: 1
            }),
            l(r, {
              label: "操作",
              width: "250",
              fixed: "right"
            }, {
              default: a(({ row: t }) => [
                l(o, {
                  size: "small",
                  icon: V(de),
                  onClick: (N) => K(t)
                }, {
                  default: a(() => [...e[13] || (e[13] = [
                    u("渲染", -1)
                  ])]),
                  _: 1
                }, 8, ["icon", "onClick"]),
                l(o, {
                  size: "small",
                  icon: V(re),
                  onClick: (N) => Q(t)
                }, {
                  default: a(() => [...e[14] || (e[14] = [
                    u("历史", -1)
                  ])]),
                  _: 1
                }, 8, ["icon", "onClick"]),
                l(o, {
                  size: "small",
                  icon: V(pe),
                  onClick: (N) => G(t)
                }, {
                  default: a(() => [...e[15] || (e[15] = [
                    u("编辑", -1)
                  ])]),
                  _: 1
                }, 8, ["icon", "onClick"]),
                l(o, {
                  size: "small",
                  type: "danger",
                  plain: "",
                  icon: V(me),
                  onClick: (N) => J(t)
                }, {
                  default: a(() => [...e[16] || (e[16] = [
                    u("删除", -1)
                  ])]),
                  _: 1
                }, 8, ["icon", "onClick"])
              ]),
              _: 1
            })
          ]),
          _: 1
        }, 8, ["data"])), [
          [Z, f.value]
        ]),
        l(I, {
          modelValue: m.value,
          "onUpdate:modelValue": e[6] || (e[6] = (t) => m.value = t),
          title: _.value ? "编辑提示词" : "新增提示词",
          width: "600"
        }, {
          footer: a(() => [
            l(o, {
              onClick: e[5] || (e[5] = (t) => m.value = !1)
            }, {
              default: a(() => [...e[17] || (e[17] = [
                u("取消", -1)
              ])]),
              _: 1
            }),
            l(o, {
              type: "primary",
              loading: A.value,
              onClick: H
            }, {
              default: a(() => [...e[18] || (e[18] = [
                u("保存", -1)
              ])]),
              _: 1
            }, 8, ["loading"])
          ]),
          default: a(() => [
            l(X, { "label-width": "80px" }, {
              default: a(() => [
                l(k, {
                  label: "名称",
                  required: ""
                }, {
                  default: a(() => [
                    l(y, {
                      modelValue: i.value.name,
                      "onUpdate:modelValue": e[0] || (e[0] = (t) => i.value.name = t)
                    }, null, 8, ["modelValue"])
                  ]),
                  _: 1
                }),
                l(k, { label: "分类" }, {
                  default: a(() => [
                    l(y, {
                      modelValue: i.value.category,
                      "onUpdate:modelValue": e[1] || (e[1] = (t) => i.value.category = t),
                      placeholder: "default"
                    }, null, 8, ["modelValue"])
                  ]),
                  _: 1
                }),
                l(k, { label: "描述" }, {
                  default: a(() => [
                    l(y, {
                      modelValue: i.value.description,
                      "onUpdate:modelValue": e[2] || (e[2] = (t) => i.value.description = t)
                    }, null, 8, ["modelValue"])
                  ]),
                  _: 1
                }),
                l(k, { label: "变量" }, {
                  default: a(() => [
                    l(y, {
                      modelValue: i.value.variables,
                      "onUpdate:modelValue": e[3] || (e[3] = (t) => i.value.variables = t),
                      placeholder: "逗号分隔，如 text,lang"
                    }, null, 8, ["modelValue"])
                  ]),
                  _: 1
                }),
                l(k, {
                  label: "内容",
                  required: ""
                }, {
                  default: a(() => [
                    l(y, {
                      modelValue: i.value.content,
                      "onUpdate:modelValue": e[4] || (e[4] = (t) => i.value.content = t),
                      type: "textarea",
                      rows: 6,
                      placeholder: "支持 {{变量}} 占位"
                    }, null, 8, ["modelValue"])
                  ]),
                  _: 1
                })
              ]),
              _: 1
            })
          ]),
          _: 1
        }, 8, ["modelValue", "title"]),
        l(I, {
          modelValue: C.value,
          "onUpdate:modelValue": e[9] || (e[9] = (t) => C.value = t),
          title: `渲染测试：${((O = B.value) == null ? void 0 : O.name) ?? ""}`,
          width: "560"
        }, {
          footer: a(() => [
            l(o, {
              onClick: e[8] || (e[8] = (t) => C.value = !1)
            }, {
              default: a(() => [...e[20] || (e[20] = [
                u("关闭", -1)
              ])]),
              _: 1
            }),
            l(o, {
              type: "primary",
              onClick: L
            }, {
              default: a(() => [...e[21] || (e[21] = [
                u("渲染", -1)
              ])]),
              _: 1
            })
          ]),
          default: a(() => [
            l(Y, {
              type: "info",
              closable: !1,
              title: "每行一个变量，格式 name=value",
              style: { "margin-bottom": "10px" }
            }),
            l(y, {
              modelValue: $.value,
              "onUpdate:modelValue": e[7] || (e[7] = (t) => $.value = t),
              type: "textarea",
              rows: 4,
              placeholder: "text=你好"
            }, null, 8, ["modelValue"]),
            c.value ? (z(), R("div", ge, [
              e[19] || (e[19] = E("div", { class: "render-title" }, "结果", -1)),
              E("pre", _e, w(c.value.content), 1),
              Object.keys(c.value.missingVariables).length ? (z(), R("div", ke, " 缺失变量：" + w(Object.keys(c.value.missingVariables).join(", ")), 1)) : M("", !0)
            ])) : M("", !0)
          ]),
          _: 1
        }, 8, ["modelValue", "title"]),
        l(I, {
          modelValue: x.value,
          "onUpdate:modelValue": e[11] || (e[11] = (t) => x.value = t),
          title: `版本历史：${((P = j.value) == null ? void 0 : P.name) ?? ""}`,
          width: "560"
        }, {
          footer: a(() => [
            l(o, {
              type: "primary",
              onClick: e[10] || (e[10] = (t) => x.value = !1)
            }, {
              default: a(() => [...e[22] || (e[22] = [
                u("关闭", -1)
              ])]),
              _: 1
            })
          ]),
          default: a(() => [
            l(D, {
              data: q.value,
              size: "small"
            }, {
              default: a(() => [
                l(r, {
                  prop: "version",
                  label: "版本",
                  width: "70"
                }),
                l(r, {
                  label: "内容",
                  "min-width": "260",
                  "show-overflow-tooltip": ""
                }, {
                  default: a(({ row: t }) => [
                    u(w(t.content), 1)
                  ]),
                  _: 1
                }),
                l(r, {
                  prop: "createdAt",
                  label: "时间",
                  width: "170"
                })
              ]),
              _: 1
            }, 8, ["data"])
          ]),
          _: 1
        }, 8, ["modelValue", "title"])
      ]);
    };
  }
}, Ce = /* @__PURE__ */ ce(we, [["__scopeId", "data-v-57ce404b"]]), Ee = {
  mount(v, g) {
    const d = ae(Ce, { appId: g.appId });
    return d.use(ne), d.mount(v), () => d.unmount();
  }
};
export {
  Ee as default
};
