;(()=>{const s=document.createElement('style');s.textContent=".filter-bar[data-v-9f045a98]{display:flex;align-items:center;gap:8px;margin-bottom:12px;flex-wrap:wrap}.spacer[data-v-9f045a98]{flex:1}.search[data-v-9f045a98]{width:200px}.name-cell[data-v-9f045a98]{display:flex;align-items:center;gap:6px;min-width:0}.name-cell .main[data-v-9f045a98]{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.desc[data-v-9f045a98]{font-size:12px;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:320px}.preview[data-v-9f045a98]{color:var(--atlas-muted);font-size:13px}.var-chips[data-v-9f045a98]{display:flex;flex-wrap:wrap;gap:4px}.var-editor[data-v-9f045a98]{width:100%;display:flex;flex-direction:column;gap:6px}.var-row[data-v-9f045a98]{display:flex;align-items:center;gap:8px}.var-name[data-v-9f045a98]{flex:1}.render-vars[data-v-9f045a98]{display:flex;flex-direction:column;gap:8px;margin-bottom:12px}.render-var-row[data-v-9f045a98]{display:flex;align-items:center;gap:10px}.render-var-name[data-v-9f045a98]{width:120px;font-size:13px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.render-var-name.required[data-v-9f045a98]{color:var(--atlas-danger)}.star[data-v-9f045a98]{margin-left:2px}.render-result[data-v-9f045a98]{background:var(--atlas-bg);border-radius:var(--atlas-r-s);padding:12px}.render-title[data-v-9f045a98]{font-size:12px;color:var(--atlas-muted);margin-bottom:6px}.render-content[data-v-9f045a98]{margin:0;white-space:pre-wrap;font-size:13px}.missing[data-v-9f045a98]{color:var(--atlas-danger);font-size:12px;margin-top:6px}.muted[data-v-9f045a98]{color:var(--atlas-muted)}\n";document.head.appendChild(s)})();import { ref as s, computed as H, onMounted as Ue, resolveComponent as m, resolveDirective as qe, openBlock as i, createElementBlock as f, createElementVNode as y, createVNode as t, withCtx as a, Fragment as S, renderList as B, createBlock as h, createTextVNode as o, toDisplayString as c, unref as g, withDirectives as he, createCommentVNode as N, normalizeClass as Ne, withKeys as Te, createApp as Re } from "vue";
import Ee, { ElMessageBox as oe, ElMessage as P } from "element-plus";
import { Search as Ae, Plus as ie, Refresh as De, VideoPlay as Ie, Clock as Le, EditPen as Se, Delete as se, Back as Be } from "@element-plus/icons-vue";
import { get as ue, put as re, del as Fe, post as J } from "@atlas/runtime";
const je = (w, T) => {
  const _ = w.__vccOpts || w;
  for (const [$, V] of T)
    _[$] = V;
  return _;
}, Oe = { class: "surface" }, Pe = { class: "filter-bar" }, Me = { class: "name-cell" }, Ke = { class: "main" }, Ze = {
  key: 0,
  class: "desc muted"
}, Ge = { class: "preview" }, He = { class: "var-chips" }, Je = { class: "var-editor" }, Qe = { class: "render-vars" }, We = {
  key: 0,
  class: "star"
}, Xe = {
  key: 0,
  class: "render-result"
}, Ye = { class: "render-content" }, el = {
  key: 0,
  class: "missing"
}, ll = { class: "preview" }, tl = {
  __name: "App",
  props: { appId: { type: Number, required: !0 } },
  setup(w) {
    const T = w, _ = s([]), $ = s(!1), V = s(!1), R = s(null), M = s(!1), F = s(!1), j = s(null), E = s({}), C = s(null), K = s(!1), A = s(!1), D = s(null), Q = s([]), Z = s(""), I = s(""), k = () => `/api/apps/${T.appId}/plugins/prompts/ep`, W = H(() => ["全部", ...[...new Set(_.value.map((n) => n.category))].sort()]), de = H(() => {
      const n = Z.value.trim().toLowerCase();
      return _.value.filter((e) => I.value && I.value !== "全部" && e.category !== I.value ? !1 : n ? e.name.toLowerCase().includes(n) || e.content.toLowerCase().includes(n) || (e.description || "").toLowerCase().includes(n) : !0);
    }), z = s([]);
    async function x() {
      $.value = !0;
      try {
        _.value = await ue(k() + "/list");
      } finally {
        $.value = !1;
      }
    }
    Ue(x);
    const X = () => ({ name: "", category: "default", description: "", content: "", enabled: !0 });
    function me() {
      R.value = null, u.value = X(), z.value = [], V.value = !0;
    }
    function ce(n) {
      R.value = n, u.value = { name: n.name, category: n.category, description: n.description, content: n.content, enabled: n.enabled }, z.value = (n.variables || []).map((e) => ({ name: e.name, required: !!e.required })), V.value = !0;
    }
    const u = s(X());
    async function pe() {
      if (!u.value.name.trim() || !u.value.content.trim()) {
        P.warning("请填写名称与内容");
        return;
      }
      const n = z.value.map((e) => ({ name: e.name.trim(), description: "", required: e.required })).filter((e) => e.name);
      M.value = !0;
      try {
        const e = { ...u.value, variables: n };
        R.value ? await re(`${k()}/update/${R.value.id}`, e) : await J(k() + "/create", e), V.value = !1, await x(), P.success("已保存");
      } finally {
        M.value = !1;
      }
    }
    async function ve(n) {
      try {
        await oe.confirm(`确认删除「${n.name}」？`, "删除提示词", { type: "error" }), await Fe(`${k()}/delete/${n.id}`), await x(), P.success("已删除");
      } catch {
      }
    }
    async function fe(n) {
      await re(`${k()}/update/${n.id}`, { enabled: !n.enabled }), await x();
    }
    function ye(n, e) {
      const p = /* @__PURE__ */ new Set();
      for (const v of n.matchAll(/\{\{\s*([\w.-]+)\s*\}\}/g)) p.add(v[1]);
      for (const v of e || []) v.name && p.add(v.name);
      return [...p];
    }
    function _e(n) {
      j.value = n;
      const e = ye(n.content, n.variables), p = {};
      for (const v of n.variables || []) v.name && (p[v.name] = "");
      for (const v of e) p[v] === void 0 && (p[v] = "");
      E.value = p, C.value = null, F.value = !0;
    }
    const Y = H(() => {
      var n;
      return new Set((((n = j.value) == null ? void 0 : n.variables) || []).filter((e) => e.required).map((e) => e.name));
    });
    async function ee() {
      K.value = !0;
      try {
        C.value = await J(`${k()}/render/${j.value.id}`, { variables: E.value });
      } finally {
        K.value = !1;
      }
    }
    async function be(n) {
      D.value = n, Q.value = await ue(`${k()}/versions/${n.id}`), A.value = !0;
    }
    async function ge(n) {
      try {
        await oe.confirm(`确认将「${D.value.name}」恢复到 v${n.version}？将生成新版本 ${D.value.version + 1}。`, "恢复版本", { type: "warning" }), await J(`${k()}/restore/${D.value.id}`, { version: n.version }), A.value = !1, await x(), P.success("已恢复");
      } catch {
      }
    }
    const Ve = new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: !1 });
    function ke(n) {
      if (!n) return "";
      const e = n.includes("T") ? n : `${n.replace(" ", "T")}Z`, p = new Date(e);
      return Number.isNaN(p.getTime()) ? n : Ve.format(p);
    }
    return (n, e) => {
      var ae, ne;
      const p = m("el-radio-button"), v = m("el-radio-group"), U = m("el-input"), d = m("el-button"), L = m("el-tag"), b = m("el-table-column"), le = m("el-switch"), te = m("el-table"), q = m("el-form-item"), we = m("el-option"), $e = m("el-select"), Ce = m("el-checkbox"), ze = m("el-form"), G = m("el-dialog"), xe = qe("loading");
      return i(), f("div", Oe, [
        y("div", Pe, [
          t(v, {
            modelValue: I.value,
            "onUpdate:modelValue": e[0] || (e[0] = (l) => I.value = l),
            size: "small"
          }, {
            default: a(() => [
              (i(!0), f(S, null, B(W.value, (l) => (i(), h(p, {
                key: l,
                value: l
              }, {
                default: a(() => [
                  o(c(l), 1)
                ]),
                _: 2
              }, 1032, ["value"]))), 128))
            ]),
            _: 1
          }, 8, ["modelValue"]),
          e[15] || (e[15] = y("div", { class: "spacer" }, null, -1)),
          t(U, {
            modelValue: Z.value,
            "onUpdate:modelValue": e[1] || (e[1] = (l) => Z.value = l),
            class: "search",
            "prefix-icon": g(Ae),
            placeholder: "搜索名称 / 内容…",
            clearable: ""
          }, null, 8, ["modelValue", "prefix-icon"]),
          t(d, {
            type: "primary",
            size: "small",
            icon: g(ie),
            onClick: me
          }, {
            default: a(() => [...e[14] || (e[14] = [
              o("新增提示词", -1)
            ])]),
            _: 1
          }, 8, ["icon"]),
          t(d, {
            icon: g(De),
            size: "small",
            circle: "",
            "aria-label": "刷新列表",
            loading: $.value,
            onClick: x
          }, null, 8, ["icon", "loading"])
        ]),
        he((i(), h(te, {
          data: de.value,
          "empty-text": "暂无提示词"
        }, {
          default: a(() => [
            t(b, {
              label: "名称",
              "min-width": "140"
            }, {
              default: a(({ row: l }) => [
                y("div", Me, [
                  y("span", Ke, c(l.name), 1),
                  l.category !== "default" ? (i(), h(L, {
                    key: 0,
                    size: "small",
                    effect: "plain"
                  }, {
                    default: a(() => [
                      o(c(l.category), 1)
                    ]),
                    _: 2
                  }, 1024)) : N("", !0)
                ]),
                l.description ? (i(), f("div", Ze, c(l.description), 1)) : N("", !0)
              ]),
              _: 1
            }),
            t(b, {
              label: "内容预览",
              "min-width": "220",
              "show-overflow-tooltip": ""
            }, {
              default: a(({ row: l }) => [
                y("span", Ge, c(l.content), 1)
              ]),
              _: 1
            }),
            t(b, {
              label: "变量",
              "min-width": "150"
            }, {
              default: a(({ row: l }) => [
                y("div", He, [
                  l.variables.length ? N("", !0) : (i(), h(L, {
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
                  (i(!0), f(S, null, B(l.variables, (r) => (i(), h(L, {
                    key: r.name,
                    size: "small",
                    type: r.required ? "danger" : "info",
                    effect: "plain"
                  }, {
                    default: a(() => [
                      o(c(r.name) + c(r.required ? " *" : ""), 1)
                    ]),
                    _: 2
                  }, 1032, ["type"]))), 128))
                ])
              ]),
              _: 1
            }),
            t(b, {
              label: "版本",
              width: "80",
              align: "center"
            }, {
              default: a(({ row: l }) => [
                t(L, {
                  size: "small",
                  type: "warning",
                  effect: "plain"
                }, {
                  default: a(() => [
                    o("v" + c(l.version), 1)
                  ]),
                  _: 2
                }, 1024)
              ]),
              _: 1
            }),
            t(b, {
              label: "启用",
              width: "80"
            }, {
              default: a(({ row: l }) => [
                t(le, {
                  "model-value": l.enabled,
                  "aria-label": `${l.enabled ? "停用" : "启用"} ${l.name}`,
                  onChange: (r) => fe(l)
                }, null, 8, ["model-value", "aria-label", "onChange"])
              ]),
              _: 1
            }),
            t(b, {
              label: "操作",
              width: "250",
              fixed: "right"
            }, {
              default: a(({ row: l }) => [
                t(d, {
                  size: "small",
                  icon: g(Ie),
                  onClick: (r) => _e(l)
                }, {
                  default: a(() => [...e[17] || (e[17] = [
                    o("渲染", -1)
                  ])]),
                  _: 1
                }, 8, ["icon", "onClick"]),
                t(d, {
                  size: "small",
                  icon: g(Le),
                  onClick: (r) => be(l)
                }, {
                  default: a(() => [...e[18] || (e[18] = [
                    o("历史", -1)
                  ])]),
                  _: 1
                }, 8, ["icon", "onClick"]),
                t(d, {
                  size: "small",
                  icon: g(Se),
                  onClick: (r) => ce(l)
                }, {
                  default: a(() => [...e[19] || (e[19] = [
                    o("编辑", -1)
                  ])]),
                  _: 1
                }, 8, ["icon", "onClick"]),
                t(d, {
                  size: "small",
                  type: "danger",
                  plain: "",
                  icon: g(se),
                  onClick: (r) => ve(l)
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
          [xe, $.value]
        ]),
        t(G, {
          modelValue: V.value,
          "onUpdate:modelValue": e[9] || (e[9] = (l) => V.value = l),
          title: R.value ? "编辑提示词" : "新增提示词",
          width: "640"
        }, {
          footer: a(() => [
            t(d, {
              onClick: e[8] || (e[8] = (l) => V.value = !1)
            }, {
              default: a(() => [...e[23] || (e[23] = [
                o("取消", -1)
              ])]),
              _: 1
            }),
            t(d, {
              type: "primary",
              loading: M.value,
              onClick: pe
            }, {
              default: a(() => [...e[24] || (e[24] = [
                o("保存", -1)
              ])]),
              _: 1
            }, 8, ["loading"])
          ]),
          default: a(() => [
            t(ze, { "label-width": "80px" }, {
              default: a(() => [
                t(q, {
                  label: "名称",
                  required: ""
                }, {
                  default: a(() => [
                    t(U, {
                      modelValue: u.value.name,
                      "onUpdate:modelValue": e[2] || (e[2] = (l) => u.value.name = l),
                      name: "prompt-name",
                      autocomplete: "off",
                      placeholder: "例如：文章润色"
                    }, null, 8, ["modelValue"])
                  ]),
                  _: 1
                }),
                t(q, { label: "分类" }, {
                  default: a(() => [
                    t($e, {
                      modelValue: u.value.category,
                      "onUpdate:modelValue": e[3] || (e[3] = (l) => u.value.category = l),
                      "allow-create": "",
                      filterable: "",
                      "default-first-option": "",
                      style: { width: "240px" }
                    }, {
                      default: a(() => [
                        (i(!0), f(S, null, B(W.value.filter((l) => l !== "全部"), (l) => (i(), h(we, {
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
                    y("div", Je, [
                      (i(!0), f(S, null, B(z.value, (l, r) => (i(), f("div", {
                        key: r,
                        class: "var-row"
                      }, [
                        t(U, {
                          modelValue: l.name,
                          "onUpdate:modelValue": (O) => l.name = O,
                          size: "small",
                          placeholder: "变量名，如 text",
                          class: "var-name"
                        }, null, 8, ["modelValue", "onUpdate:modelValue"]),
                        t(Ce, {
                          modelValue: l.required,
                          "onUpdate:modelValue": (O) => l.required = O,
                          size: "small"
                        }, {
                          default: a(() => [...e[21] || (e[21] = [
                            o("必填", -1)
                          ])]),
                          _: 1
                        }, 8, ["modelValue", "onUpdate:modelValue"]),
                        t(d, {
                          size: "small",
                          text: "",
                          type: "danger",
                          icon: g(se),
                          "aria-label": "删除该变量行",
                          onClick: (O) => z.value.splice(r, 1)
                        }, null, 8, ["icon", "onClick"])
                      ]))), 128)),
                      t(d, {
                        size: "small",
                        plain: "",
                        icon: g(ie),
                        onClick: e[5] || (e[5] = (l) => z.value.push({ name: "", required: !1 }))
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
        t(G, {
          modelValue: F.value,
          "onUpdate:modelValue": e[11] || (e[11] = (l) => F.value = l),
          title: `渲染测试：${((ae = j.value) == null ? void 0 : ae.name) ?? ""}`,
          width: "600"
        }, {
          footer: a(() => [
            t(d, {
              onClick: e[10] || (e[10] = (l) => F.value = !1)
            }, {
              default: a(() => [...e[26] || (e[26] = [
                o("关闭", -1)
              ])]),
              _: 1
            }),
            t(d, {
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
            y("div", Qe, [
              (i(!0), f(S, null, B(Object.keys(E.value), (l) => (i(), f("div", {
                key: l,
                class: "render-var-row"
              }, [
                y("span", {
                  class: Ne(["render-var-name", { required: Y.value.has(l) }])
                }, [
                  o(c(l), 1),
                  Y.value.has(l) ? (i(), f("span", We, "*")) : N("", !0)
                ], 2),
                t(U, {
                  modelValue: E.value[l],
                  "onUpdate:modelValue": (r) => E.value[l] = r,
                  size: "small",
                  "aria-label": `变量 ${l} 的值`,
                  placeholder: `{{${l}}}`,
                  onKeyup: Te(ee, ["enter"])
                }, null, 8, ["modelValue", "onUpdate:modelValue", "aria-label", "placeholder"])
              ]))), 128))
            ]),
            C.value ? (i(), f("div", Xe, [
              e[25] || (e[25] = y("div", { class: "render-title" }, "结果", -1)),
              y("pre", Ye, c(C.value.content), 1),
              Object.keys(C.value.missingVariables).length ? (i(), f("div", el, " 缺失必填变量：" + c(Object.keys(C.value.missingVariables).join("、")) + "，请填写后重试 ", 1)) : N("", !0)
            ])) : N("", !0)
          ]),
          _: 1
        }, 8, ["modelValue", "title"]),
        t(G, {
          modelValue: A.value,
          "onUpdate:modelValue": e[13] || (e[13] = (l) => A.value = l),
          title: `版本历史：${((ne = D.value) == null ? void 0 : ne.name) ?? ""}`,
          width: "640"
        }, {
          footer: a(() => [
            t(d, {
              type: "primary",
              onClick: e[12] || (e[12] = (l) => A.value = !1)
            }, {
              default: a(() => [...e[29] || (e[29] = [
                o("关闭", -1)
              ])]),
              _: 1
            })
          ]),
          default: a(() => [
            t(te, {
              data: Q.value,
              size: "small",
              "empty-text": "暂无历史版本"
            }, {
              default: a(() => [
                t(b, {
                  label: "版本",
                  width: "90"
                }, {
                  default: a(({ row: l }) => [
                    t(L, {
                      size: "small",
                      type: "warning",
                      effect: "plain"
                    }, {
                      default: a(() => [
                        o("v" + c(l.version), 1)
                      ]),
                      _: 2
                    }, 1024)
                  ]),
                  _: 1
                }),
                t(b, {
                  label: "内容",
                  "min-width": "260",
                  "show-overflow-tooltip": ""
                }, {
                  default: a(({ row: l }) => [
                    y("span", ll, c(l.content), 1)
                  ]),
                  _: 1
                }),
                t(b, {
                  label: "时间",
                  width: "150"
                }, {
                  default: a(({ row: l }) => [
                    o(c(ke(l.createdAt)), 1)
                  ]),
                  _: 1
                }),
                t(b, {
                  label: "操作",
                  width: "100",
                  fixed: "right"
                }, {
                  default: a(({ row: l }) => [
                    t(d, {
                      size: "small",
                      icon: g(Be),
                      onClick: (r) => ge(l)
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
}, al = /* @__PURE__ */ je(tl, [["__scopeId", "data-v-9f045a98"]]), ul = {
  mount(w, T) {
    const _ = Re(al, { appId: T.appId });
    return _.use(Ee), _.mount(w), () => _.unmount();
  }
};
export {
  ul as default
};
