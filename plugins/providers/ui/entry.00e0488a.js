import { ref as p, onMounted as Y, resolveComponent as u, resolveDirective as Z, openBlock as v, createElementBlock as I, createElementVNode as P, createVNode as a, unref as C, withCtx as t, createTextVNode as d, withDirectives as ee, createBlock as x, toDisplayString as E, Fragment as B, renderList as D, createCommentVNode as le, createApp as ae } from "vue";
import te, { ElMessage as A, ElMessageBox as ne } from "element-plus";
import { Plus as oe, Refresh as ie, Connection as ue, EditPen as se, Delete as de } from "@element-plus/icons-vue";
import { get as z, put as K, post as N, del as re } from "@atlas/runtime";
const pe = (f, V) => {
  const s = f.__vccOpts || f;
  for (const [k, y] of V)
    s[k] = y;
  return s;
}, me = { class: "surface" }, ce = { class: "panel-header" }, ve = { class: "mono" }, fe = {
  __name: "App",
  props: { appId: { type: Number, required: !0 } },
  setup(f) {
    const V = f, s = p([]), k = p([]), y = p(!1), _ = p(!1), b = p(null), o = p({ name: "", providerType: "OPENAI_COMPATIBLE", baseUrl: "", apiKey: "", models: "" }), U = p(!1), T = p(null), r = () => `/api/apps/${V.appId}/plugins/providers/ep`;
    async function g() {
      y.value = !0;
      try {
        s.value = await z(r() + "/list");
      } finally {
        y.value = !1;
      }
    }
    Y(async () => {
      await g(), k.value = await z(r() + "/types");
    });
    function h() {
      b.value = null, o.value = { name: "", providerType: "OPENAI_COMPATIBLE", baseUrl: "", apiKey: "", models: "" }, _.value = !0;
    }
    function M(n) {
      b.value = n, o.value = {
        name: n.name,
        providerType: n.providerType,
        baseUrl: n.baseUrl,
        apiKey: "",
        models: (n.models || []).map((e) => e.modelId).join(`
`)
      }, _.value = !0;
    }
    async function O() {
      if (!o.value.name.trim() || !o.value.baseUrl.trim()) {
        A.warning("请填写名称与 base_url");
        return;
      }
      U.value = !0;
      try {
        const n = o.value.models.split(`
`).map((i) => i.trim()).filter(Boolean).map((i) => ({ modelId: i, contextTokens: null })), e = { ...o.value, models: n };
        b.value ? await K(`${r()}/update/${b.value.id}`, e) : await N(r() + "/create", e), _.value = !1, await g();
      } finally {
        U.value = !1;
      }
    }
    async function L(n) {
      try {
        await ne.confirm(`确认删除「${n.name}」？`, "删除供应商", { type: "error" }), await re(`${r()}/delete/${n.id}`), await g();
      } catch {
      }
    }
    async function q(n) {
      await K(`${r()}/default/${n.id}`), await g();
    }
    async function R(n) {
      await K(`${r()}/enabled/${n.id}`, { enabled: !n.enabled }), await g();
    }
    async function S(n) {
      T.value = n.id;
      try {
        const e = await N(`${r()}/test`, { baseUrl: n.baseUrl, apiKey: n.apiKey });
        e.success ? A.success(`连接成功（${e.latencyMs}ms）`) : A.error(`连接失败：${e.message}`);
      } finally {
        T.value = null;
      }
    }
    return (n, e) => {
      const i = u("el-button"), m = u("el-table-column"), j = u("el-tag"), F = u("el-switch"), G = u("el-table"), $ = u("el-input"), w = u("el-form-item"), H = u("el-option"), J = u("el-select"), Q = u("el-form"), W = u("el-dialog"), X = Z("loading");
      return v(), I("div", me, [
        P("div", ce, [
          a(i, {
            type: "primary",
            size: "small",
            icon: C(oe),
            onClick: h
          }, {
            default: t(() => [...e[7] || (e[7] = [
              d("新增供应商", -1)
            ])]),
            _: 1
          }, 8, ["icon"]),
          a(i, {
            icon: C(ie),
            size: "small",
            circle: "",
            loading: y.value,
            onClick: g
          }, null, 8, ["icon", "loading"])
        ]),
        ee((v(), x(G, {
          data: s.value,
          "empty-text": "暂无供应商"
        }, {
          default: t(() => [
            a(m, {
              prop: "name",
              label: "名称",
              "min-width": "120"
            }),
            a(m, {
              label: "类型",
              width: "160"
            }, {
              default: t(({ row: l }) => [
                P("code", ve, E(l.providerType), 1)
              ]),
              _: 1
            }),
            a(m, {
              label: "模型",
              "min-width": "160"
            }, {
              default: t(({ row: l }) => [
                (v(!0), I(B, null, D(l.models, (c) => (v(), I("div", {
                  key: c.modelId,
                  class: "model-chip"
                }, E(c.modelId), 1))), 128))
              ]),
              _: 1
            }),
            a(m, {
              label: "API Key",
              width: "100"
            }, {
              default: t(({ row: l }) => [
                d(E(l.apiKey ? "••••••••" : "未配置"), 1)
              ]),
              _: 1
            }),
            a(m, {
              label: "默认",
              width: "70"
            }, {
              default: t(({ row: l }) => [
                l.isDefault ? (v(), x(j, {
                  key: 0,
                  size: "small",
                  type: "warning"
                }, {
                  default: t(() => [...e[8] || (e[8] = [
                    d("默认", -1)
                  ])]),
                  _: 1
                })) : le("", !0)
              ]),
              _: 1
            }),
            a(m, {
              label: "启用",
              width: "80"
            }, {
              default: t(({ row: l }) => [
                a(F, {
                  "model-value": l.enabled,
                  onChange: (c) => R(l)
                }, null, 8, ["model-value", "onChange"])
              ]),
              _: 1
            }),
            a(m, {
              label: "操作",
              width: "220",
              fixed: "right"
            }, {
              default: t(({ row: l }) => [
                a(i, {
                  size: "small",
                  icon: C(ue),
                  loading: T.value === l.id,
                  onClick: (c) => S(l)
                }, {
                  default: t(() => [...e[9] || (e[9] = [
                    d("测试", -1)
                  ])]),
                  _: 1
                }, 8, ["icon", "loading", "onClick"]),
                a(i, {
                  size: "small",
                  icon: C(se),
                  onClick: (c) => M(l)
                }, {
                  default: t(() => [...e[10] || (e[10] = [
                    d("编辑", -1)
                  ])]),
                  _: 1
                }, 8, ["icon", "onClick"]),
                a(i, {
                  size: "small",
                  onClick: (c) => q(l)
                }, {
                  default: t(() => [...e[11] || (e[11] = [
                    d("默认", -1)
                  ])]),
                  _: 1
                }, 8, ["onClick"]),
                a(i, {
                  size: "small",
                  type: "danger",
                  plain: "",
                  icon: C(de),
                  onClick: (c) => L(l)
                }, {
                  default: t(() => [...e[12] || (e[12] = [
                    d("删除", -1)
                  ])]),
                  _: 1
                }, 8, ["icon", "onClick"])
              ]),
              _: 1
            })
          ]),
          _: 1
        }, 8, ["data"])), [
          [X, y.value]
        ]),
        a(W, {
          modelValue: _.value,
          "onUpdate:modelValue": e[6] || (e[6] = (l) => _.value = l),
          title: b.value ? "编辑供应商" : "新增供应商",
          width: "560"
        }, {
          footer: t(() => [
            a(i, {
              onClick: e[5] || (e[5] = (l) => _.value = !1)
            }, {
              default: t(() => [...e[13] || (e[13] = [
                d("取消", -1)
              ])]),
              _: 1
            }),
            a(i, {
              type: "primary",
              loading: U.value,
              onClick: O
            }, {
              default: t(() => [...e[14] || (e[14] = [
                d("保存", -1)
              ])]),
              _: 1
            }, 8, ["loading"])
          ]),
          default: t(() => [
            a(Q, { "label-width": "90px" }, {
              default: t(() => [
                a(w, {
                  label: "名称",
                  required: ""
                }, {
                  default: t(() => [
                    a($, {
                      modelValue: o.value.name,
                      "onUpdate:modelValue": e[0] || (e[0] = (l) => o.value.name = l)
                    }, null, 8, ["modelValue"])
                  ]),
                  _: 1
                }),
                a(w, { label: "类型" }, {
                  default: t(() => [
                    a(J, {
                      modelValue: o.value.providerType,
                      "onUpdate:modelValue": e[1] || (e[1] = (l) => o.value.providerType = l)
                    }, {
                      default: t(() => [
                        (v(!0), I(B, null, D(k.value, (l) => (v(), x(H, {
                          key: l,
                          label: l,
                          value: l
                        }, null, 8, ["label", "value"]))), 128))
                      ]),
                      _: 1
                    }, 8, ["modelValue"])
                  ]),
                  _: 1
                }),
                a(w, {
                  label: "Base URL",
                  required: ""
                }, {
                  default: t(() => [
                    a($, {
                      modelValue: o.value.baseUrl,
                      "onUpdate:modelValue": e[2] || (e[2] = (l) => o.value.baseUrl = l),
                      placeholder: "https://api.example.com/v1"
                    }, null, 8, ["modelValue"])
                  ]),
                  _: 1
                }),
                a(w, { label: "API Key" }, {
                  default: t(() => [
                    a($, {
                      modelValue: o.value.apiKey,
                      "onUpdate:modelValue": e[3] || (e[3] = (l) => o.value.apiKey = l),
                      type: "password",
                      "show-password": "",
                      placeholder: b.value ? "留空保持不变" : ""
                    }, null, 8, ["modelValue", "placeholder"])
                  ]),
                  _: 1
                }),
                a(w, { label: "模型 ID" }, {
                  default: t(() => [
                    a($, {
                      modelValue: o.value.models,
                      "onUpdate:modelValue": e[4] || (e[4] = (l) => o.value.models = l),
                      type: "textarea",
                      rows: 3,
                      placeholder: "每行一个模型 ID"
                    }, null, 8, ["modelValue"])
                  ]),
                  _: 1
                })
              ]),
              _: 1
            })
          ]),
          _: 1
        }, 8, ["modelValue", "title"])
      ]);
    };
  }
}, ye = /* @__PURE__ */ pe(fe, [["__scopeId", "data-v-f4b8ce3b"]]), we = {
  mount(f, V) {
    const s = ae(ye, { appId: V.appId });
    return s.use(te), s.mount(f), () => s.unmount();
  }
};
export {
  we as default
};
