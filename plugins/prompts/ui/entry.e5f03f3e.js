;(()=>{const s=document.createElement('style');s.textContent=".filter-bar[data-v-5fee9758]{display:flex;align-items:center;gap:8px;margin-bottom:12px;flex-wrap:wrap}.spacer[data-v-5fee9758]{flex:1}.search[data-v-5fee9758]{width:200px}.name-cell[data-v-5fee9758]{display:flex;align-items:center;gap:6px;min-width:0}.name-cell .main[data-v-5fee9758]{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.desc[data-v-5fee9758]{font-size:12px;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:320px}.preview[data-v-5fee9758]{color:var(--aibase-muted);font-size:13px}.var-chips[data-v-5fee9758]{display:flex;flex-wrap:wrap;gap:4px}.var-editor[data-v-5fee9758]{width:100%;display:flex;flex-direction:column;gap:6px}.var-row[data-v-5fee9758]{display:flex;align-items:center;gap:8px}.var-name[data-v-5fee9758]{flex:1}.render-vars[data-v-5fee9758]{display:flex;flex-direction:column;gap:8px;margin-bottom:12px}.render-var-row[data-v-5fee9758]{display:flex;align-items:center;gap:10px}.render-var-name[data-v-5fee9758]{width:120px;font-size:13px;font-family:monospace;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.render-var-name.required[data-v-5fee9758]{color:#f56c6c}.star[data-v-5fee9758]{margin-left:2px}.render-result[data-v-5fee9758]{background:var(--aibase-bg);border-radius:8px;padding:12px}.render-title[data-v-5fee9758]{font-size:12px;color:var(--aibase-muted);margin-bottom:6px}.render-content[data-v-5fee9758]{margin:0;white-space:pre-wrap;font-size:13px}.missing[data-v-5fee9758]{color:#f56c6c;font-size:12px;margin-top:6px}.muted[data-v-5fee9758]{color:var(--aibase-muted)}\n";document.head.appendChild(s)})();import { ref as s, computed as J, onMounted as ze, resolveComponent as m, resolveDirective as Ue, openBlock as i, createElementBlock as p, createElementVNode as f, createVNode as t, withCtx as a, Fragment as N, renderList as j, createBlock as R, createTextVNode as o, toDisplayString as v, unref as b, withDirectives as qe, createCommentVNode as E, normalizeClass as Re, withKeys as Ee, createApp as he } from "vue";
import Ae, { ElMessageBox as oe, ElMessage as F } from "element-plus";
import { Search as Le, Plus as ie, Refresh as Se, VideoPlay as Te, Clock as Be, EditPen as Ie, Delete as se, Back as Ne } from "@element-plus/icons-vue";
import { get as ue, put as de, del as je, post as Q } from "@atlas/runtime";
const De = (w, h) => {
  const _ = w.__vccOpts || w;
  for (const [C, V] of h)
    _[C] = V;
  return _;
}, Oe = { class: "surface" }, Pe = { class: "filter-bar" }, Fe = { class: "name-cell" }, Me = { class: "main" }, Ke = {
  key: 0,
  class: "desc muted"
}, Ge = { class: "preview" }, He = { class: "var-chips" }, Je = { class: "var-editor" }, Qe = { class: "render-vars" }, We = {
  key: 0,
  class: "star"
}, Xe = {
  key: 0,
  class: "render-result"
}, Ye = { class: "render-content" }, Ze = {
  key: 0,
  class: "missing"
}, el = { class: "preview" }, ll = {
  __name: "App",
  props: { appId: { type: Number, required: !0 } },
  setup(w) {
    const h = w, _ = s([]), C = s(!1), V = s(!1), A = s(null), M = s(!1), D = s(!1), O = s(null), L = s({}), $ = s(null), K = s(!1), S = s(!1), T = s(null), W = s([]), G = s(""), B = s(""), k = () => `/api/apps/${h.appId}/plugins/prompts/ep`, X = J(() => ["全部", ...[...new Set(_.value.map((n) => n.category))].sort()]), re = J(() => {
      const n = G.value.trim().toLowerCase();
      return _.value.filter((e) => B.value && B.value !== "全部" && e.category !== B.value ? !1 : n ? e.name.toLowerCase().includes(n) || e.content.toLowerCase().includes(n) || (e.description || "").toLowerCase().includes(n) : !0);
    }), x = s([]);
    async function z() {
      C.value = !0;
      try {
        _.value = await ue(k() + "/list");
      } finally {
        C.value = !1;
      }
    }
    ze(z);
    const Y = () => ({ name: "", category: "default", description: "", content: "", enabled: !0 });
    function me() {
      A.value = null, u.value = Y(), x.value = [], V.value = !0;
    }
    function ve(n) {
      A.value = n, u.value = { name: n.name, category: n.category, description: n.description, content: n.content, enabled: n.enabled }, x.value = (n.variables || []).map((e) => ({ name: e.name, required: !!e.required })), V.value = !0;
    }
    const u = s(Y());
    async function ce() {
      if (!u.value.name.trim() || !u.value.content.trim()) {
        F.warning("请填写名称与内容");
        return;
      }
      const n = x.value.map((e) => ({ name: e.name.trim(), description: "", required: e.required })).filter((e) => e.name);
      M.value = !0;
      try {
        const e = { ...u.value, variables: n };
        A.value ? await de(`${k()}/update/${A.value.id}`, e) : await Q(k() + "/create", e), V.value = !1, await z(), F.success("已保存");
      } finally {
        M.value = !1;
      }
    }
    async function pe(n) {
      try {
        await oe.confirm(`确认删除「${n.name}」？`, "删除提示词", { type: "error" }), await je(`${k()}/delete/${n.id}`), await z(), F.success("已删除");
      } catch {
      }
    }
    async function fe(n) {
      await de(`${k()}/update/${n.id}`, { enabled: !n.enabled }), await z();
    }
    function _e(n, e) {
      const y = /* @__PURE__ */ new Set();
      for (const c of n.matchAll(/\{\{\s*([\w.-]+)\s*\}\}/g)) y.add(c[1]);
      for (const c of e || []) c.name && y.add(c.name);
      return [...y];
    }
    function ye(n) {
      O.value = n;
      const e = _e(n.content, n.variables), y = {};
      for (const c of n.variables || []) c.name && (y[c.name] = "");
      for (const c of e) y[c] === void 0 && (y[c] = "");
      L.value = y, $.value = null, D.value = !0;
    }
    const Z = J(() => {
      var n;
      return new Set((((n = O.value) == null ? void 0 : n.variables) || []).filter((e) => e.required).map((e) => e.name));
    });
    async function ee() {
      K.value = !0;
      try {
        $.value = await Q(`${k()}/render/${O.value.id}`, { variables: L.value });
      } finally {
        K.value = !1;
      }
    }
    async function ge(n) {
      T.value = n, W.value = await ue(`${k()}/versions/${n.id}`), S.value = !0;
    }
    async function be(n) {
      try {
        await oe.confirm(`确认将「${T.value.name}」恢复到 v${n.version}？将生成新版本 ${T.value.version + 1}。`, "恢复版本", { type: "warning" }), await Q(`${k()}/restore/${T.value.id}`, { version: n.version }), S.value = !1, await z(), F.success("已恢复");
      } catch {
      }
    }
    function Ve(n) {
      return n ? n.replace("T", " ").slice(0, 16) : "";
    }
    return (n, e) => {
      var ae, ne;
      const y = m("el-radio-button"), c = m("el-radio-group"), U = m("el-input"), r = m("el-button"), I = m("el-tag"), g = m("el-table-column"), le = m("el-switch"), te = m("el-table"), q = m("el-form-item"), ke = m("el-option"), we = m("el-select"), Ce = m("el-checkbox"), $e = m("el-form"), H = m("el-dialog"), xe = Ue("loading");
      return i(), p("div", Oe, [
        f("div", Pe, [
          t(c, {
            modelValue: B.value,
            "onUpdate:modelValue": e[0] || (e[0] = (l) => B.value = l),
            size: "small"
          }, {
            default: a(() => [
              (i(!0), p(N, null, j(X.value, (l) => (i(), R(y, {
                key: l,
                value: l
              }, {
                default: a(() => [
                  o(v(l), 1)
                ]),
                _: 2
              }, 1032, ["value"]))), 128))
            ]),
            _: 1
          }, 8, ["modelValue"]),
          e[15] || (e[15] = f("div", { class: "spacer" }, null, -1)),
          t(U, {
            modelValue: G.value,
            "onUpdate:modelValue": e[1] || (e[1] = (l) => G.value = l),
            class: "search",
            "prefix-icon": b(Le),
            placeholder: "搜索名称 / 内容",
            clearable: ""
          }, null, 8, ["modelValue", "prefix-icon"]),
          t(r, {
            type: "primary",
            size: "small",
            icon: b(ie),
            onClick: me
          }, {
            default: a(() => [...e[14] || (e[14] = [
              o("新增提示词", -1)
            ])]),
            _: 1
          }, 8, ["icon"]),
          t(r, {
            icon: b(Se),
            size: "small",
            circle: "",
            loading: C.value,
            onClick: z
          }, null, 8, ["icon", "loading"])
        ]),
        qe((i(), R(te, {
          data: re.value,
          "empty-text": "暂无提示词"
        }, {
          default: a(() => [
            t(g, {
              label: "名称",
              "min-width": "140"
            }, {
              default: a(({ row: l }) => [
                f("div", Fe, [
                  f("span", Me, v(l.name), 1),
                  l.category !== "default" ? (i(), R(I, {
                    key: 0,
                    size: "small",
                    effect: "plain"
                  }, {
                    default: a(() => [
                      o(v(l.category), 1)
                    ]),
                    _: 2
                  }, 1024)) : E("", !0)
                ]),
                l.description ? (i(), p("div", Ke, v(l.description), 1)) : E("", !0)
              ]),
              _: 1
            }),
            t(g, {
              label: "内容预览",
              "min-width": "220",
              "show-overflow-tooltip": ""
            }, {
              default: a(({ row: l }) => [
                f("span", Ge, v(l.content), 1)
              ]),
              _: 1
            }),
            t(g, {
              label: "变量",
              "min-width": "150"
            }, {
              default: a(({ row: l }) => [
                f("div", He, [
                  l.variables.length ? E("", !0) : (i(), R(I, {
                    key: 0,
                    size: "small",
                    type: "info",
                    effect: "plain"
                  }, {
                    default: a(() => [...e[16] || (e[16] = [
                      o("无", -1)
                    ])]),
                    _: 1
                  })),
                  (i(!0), p(N, null, j(l.variables, (d) => (i(), R(I, {
                    key: d.name,
                    size: "small",
                    type: d.required ? "danger" : "info",
                    effect: "plain"
                  }, {
                    default: a(() => [
                      o(v(d.name) + v(d.required ? " *" : ""), 1)
                    ]),
                    _: 2
                  }, 1032, ["type"]))), 128))
                ])
              ]),
              _: 1
            }),
            t(g, {
              label: "版本",
              width: "80",
              align: "center"
            }, {
              default: a(({ row: l }) => [
                t(I, {
                  size: "small",
                  type: "warning",
                  effect: "plain"
                }, {
                  default: a(() => [
                    o("v" + v(l.version), 1)
                  ]),
                  _: 2
                }, 1024)
              ]),
              _: 1
            }),
            t(g, {
              label: "启用",
              width: "80"
            }, {
              default: a(({ row: l }) => [
                t(le, {
                  "model-value": l.enabled,
                  onChange: (d) => fe(l)
                }, null, 8, ["model-value", "onChange"])
              ]),
              _: 1
            }),
            t(g, {
              label: "操作",
              width: "250",
              fixed: "right"
            }, {
              default: a(({ row: l }) => [
                t(r, {
                  size: "small",
                  icon: b(Te),
                  onClick: (d) => ye(l)
                }, {
                  default: a(() => [...e[17] || (e[17] = [
                    o("渲染", -1)
                  ])]),
                  _: 1
                }, 8, ["icon", "onClick"]),
                t(r, {
                  size: "small",
                  icon: b(Be),
                  onClick: (d) => ge(l)
                }, {
                  default: a(() => [...e[18] || (e[18] = [
                    o("历史", -1)
                  ])]),
                  _: 1
                }, 8, ["icon", "onClick"]),
                t(r, {
                  size: "small",
                  icon: b(Ie),
                  onClick: (d) => ve(l)
                }, {
                  default: a(() => [...e[19] || (e[19] = [
                    o("编辑", -1)
                  ])]),
                  _: 1
                }, 8, ["icon", "onClick"]),
                t(r, {
                  size: "small",
                  type: "danger",
                  plain: "",
                  icon: b(se),
                  onClick: (d) => pe(l)
                }, {
                  default: a(() => [...e[20] || (e[20] = [
                    o("删除", -1)
                  ])]),
                  _: 1
                }, 8, ["icon", "onClick"])
              ]),
              _: 1
            })
          ]),
          _: 1
        }, 8, ["data"])), [
          [xe, C.value]
        ]),
        t(H, {
          modelValue: V.value,
          "onUpdate:modelValue": e[9] || (e[9] = (l) => V.value = l),
          title: A.value ? "编辑提示词" : "新增提示词",
          width: "640"
        }, {
          footer: a(() => [
            t(r, {
              onClick: e[8] || (e[8] = (l) => V.value = !1)
            }, {
              default: a(() => [...e[23] || (e[23] = [
                o("取消", -1)
              ])]),
              _: 1
            }),
            t(r, {
              type: "primary",
              loading: M.value,
              onClick: ce
            }, {
              default: a(() => [...e[24] || (e[24] = [
                o("保存", -1)
              ])]),
              _: 1
            }, 8, ["loading"])
          ]),
          default: a(() => [
            t($e, { "label-width": "80px" }, {
              default: a(() => [
                t(q, {
                  label: "名称",
                  required: ""
                }, {
                  default: a(() => [
                    t(U, {
                      modelValue: u.value.name,
                      "onUpdate:modelValue": e[2] || (e[2] = (l) => u.value.name = l)
                    }, null, 8, ["modelValue"])
                  ]),
                  _: 1
                }),
                t(q, { label: "分类" }, {
                  default: a(() => [
                    t(we, {
                      modelValue: u.value.category,
                      "onUpdate:modelValue": e[3] || (e[3] = (l) => u.value.category = l),
                      "allow-create": "",
                      filterable: "",
                      "default-first-option": "",
                      style: { width: "240px" }
                    }, {
                      default: a(() => [
                        (i(!0), p(N, null, j(X.value.filter((l) => l !== "全部"), (l) => (i(), R(ke, {
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
                t(q, { label: "描述" }, {
                  default: a(() => [
                    t(U, {
                      modelValue: u.value.description,
                      "onUpdate:modelValue": e[4] || (e[4] = (l) => u.value.description = l),
                      placeholder: "一句话说明用途（列表展示）"
                    }, null, 8, ["modelValue"])
                  ]),
                  _: 1
                }),
                t(q, { label: "变量" }, {
                  default: a(() => [
                    f("div", Je, [
                      (i(!0), p(N, null, j(x.value, (l, d) => (i(), p("div", {
                        key: d,
                        class: "var-row"
                      }, [
                        t(U, {
                          modelValue: l.name,
                          "onUpdate:modelValue": (P) => l.name = P,
                          size: "small",
                          placeholder: "变量名，如 text",
                          class: "var-name"
                        }, null, 8, ["modelValue", "onUpdate:modelValue"]),
                        t(Ce, {
                          modelValue: l.required,
                          "onUpdate:modelValue": (P) => l.required = P,
                          size: "small"
                        }, {
                          default: a(() => [...e[21] || (e[21] = [
                            o("必填", -1)
                          ])]),
                          _: 1
                        }, 8, ["modelValue", "onUpdate:modelValue"]),
                        t(r, {
                          size: "small",
                          text: "",
                          type: "danger",
                          icon: b(se),
                          onClick: (P) => x.value.splice(d, 1)
                        }, null, 8, ["icon", "onClick"])
                      ]))), 128)),
                      t(r, {
                        size: "small",
                        plain: "",
                        icon: b(ie),
                        onClick: e[5] || (e[5] = (l) => x.value.push({ name: "", required: !1 }))
                      }, {
                        default: a(() => [...e[22] || (e[22] = [
                          o("添加变量", -1)
                        ])]),
                        _: 1
                      }, 8, ["icon"])
                    ])
                  ]),
                  _: 1
                }),
                t(q, {
                  label: "内容",
                  required: ""
                }, {
                  default: a(() => [
                    t(U, {
                      modelValue: u.value.content,
                      "onUpdate:modelValue": e[6] || (e[6] = (l) => u.value.content = l),
                      type: "textarea",
                      rows: 7,
                      placeholder: "支持 {{变量}} 占位"
                    }, null, 8, ["modelValue"])
                  ]),
                  _: 1
                }),
                t(q, { label: "启用" }, {
                  default: a(() => [
                    t(le, {
                      modelValue: u.value.enabled,
                      "onUpdate:modelValue": e[7] || (e[7] = (l) => u.value.enabled = l)
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
        t(H, {
          modelValue: D.value,
          "onUpdate:modelValue": e[11] || (e[11] = (l) => D.value = l),
          title: `渲染测试：${((ae = O.value) == null ? void 0 : ae.name) ?? ""}`,
          width: "600"
        }, {
          footer: a(() => [
            t(r, {
              onClick: e[10] || (e[10] = (l) => D.value = !1)
            }, {
              default: a(() => [...e[26] || (e[26] = [
                o("关闭", -1)
              ])]),
              _: 1
            }),
            t(r, {
              type: "primary",
              loading: K.value,
              onClick: ee
            }, {
              default: a(() => [...e[27] || (e[27] = [
                o("渲染", -1)
              ])]),
              _: 1
            }, 8, ["loading"])
          ]),
          default: a(() => [
            f("div", Qe, [
              (i(!0), p(N, null, j(Object.keys(L.value), (l) => (i(), p("div", {
                key: l,
                class: "render-var-row"
              }, [
                f("span", {
                  class: Re(["render-var-name", { required: Z.value.has(l) }])
                }, [
                  o(v(l), 1),
                  Z.value.has(l) ? (i(), p("span", We, "*")) : E("", !0)
                ], 2),
                t(U, {
                  modelValue: L.value[l],
                  "onUpdate:modelValue": (d) => L.value[l] = d,
                  size: "small",
                  placeholder: `{{${l}}}`,
                  onKeyup: Ee(ee, ["enter"])
                }, null, 8, ["modelValue", "onUpdate:modelValue", "placeholder"])
              ]))), 128))
            ]),
            $.value ? (i(), p("div", Xe, [
              e[25] || (e[25] = f("div", { class: "render-title" }, "结果", -1)),
              f("pre", Ye, v($.value.content), 1),
              Object.keys($.value.missingVariables).length ? (i(), p("div", Ze, " 缺失必填变量：" + v(Object.keys($.value.missingVariables).join(", ")), 1)) : E("", !0)
            ])) : E("", !0)
          ]),
          _: 1
        }, 8, ["modelValue", "title"]),
        t(H, {
          modelValue: S.value,
          "onUpdate:modelValue": e[13] || (e[13] = (l) => S.value = l),
          title: `版本历史：${((ne = T.value) == null ? void 0 : ne.name) ?? ""}`,
          width: "640"
        }, {
          footer: a(() => [
            t(r, {
              type: "primary",
              onClick: e[12] || (e[12] = (l) => S.value = !1)
            }, {
              default: a(() => [...e[29] || (e[29] = [
                o("关闭", -1)
              ])]),
              _: 1
            })
          ]),
          default: a(() => [
            t(te, {
              data: W.value,
              size: "small",
              "empty-text": "暂无历史版本"
            }, {
              default: a(() => [
                t(g, {
                  label: "版本",
                  width: "90"
                }, {
                  default: a(({ row: l }) => [
                    t(I, {
                      size: "small",
                      type: "warning",
                      effect: "plain"
                    }, {
                      default: a(() => [
                        o("v" + v(l.version), 1)
                      ]),
                      _: 2
                    }, 1024)
                  ]),
                  _: 1
                }),
                t(g, {
                  label: "内容",
                  "min-width": "260",
                  "show-overflow-tooltip": ""
                }, {
                  default: a(({ row: l }) => [
                    f("span", el, v(l.content), 1)
                  ]),
                  _: 1
                }),
                t(g, {
                  label: "时间",
                  width: "150"
                }, {
                  default: a(({ row: l }) => [
                    o(v(Ve(l.createdAt)), 1)
                  ]),
                  _: 1
                }),
                t(g, {
                  label: "操作",
                  width: "100",
                  fixed: "right"
                }, {
                  default: a(({ row: l }) => [
                    t(r, {
                      size: "small",
                      icon: b(Ne),
                      onClick: (d) => be(l)
                    }, {
                      default: a(() => [...e[28] || (e[28] = [
                        o("恢复", -1)
                      ])]),
                      _: 1
                    }, 8, ["icon", "onClick"])
                  ]),
                  _: 1
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
}, tl = /* @__PURE__ */ De(ll, [["__scopeId", "data-v-5fee9758"]]), sl = {
  mount(w, h) {
    const _ = he(tl, { appId: h.appId });
    return _.use(Ae), _.mount(w), () => _.unmount();
  }
};
export {
  sl as default
};
