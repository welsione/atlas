;(()=>{const s=document.createElement('style');s.textContent=".filter-bar[data-v-fbe096db]{display:flex;align-items:center;gap:8px;margin-bottom:12px;flex-wrap:wrap}.spacer[data-v-fbe096db]{flex:1}.search[data-v-fbe096db]{width:200px}.name-cell[data-v-fbe096db]{display:flex;align-items:center;gap:6px;min-width:0}.name-cell .main[data-v-fbe096db]{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.desc[data-v-fbe096db]{font-size:12px;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:320px}.preview[data-v-fbe096db]{color:var(--atlas-muted);font-size:13px}.var-chips[data-v-fbe096db]{display:flex;flex-wrap:wrap;gap:4px}.switch-cell[data-v-fbe096db]{display:flex;align-items:center;gap:6px}.switch-text[data-v-fbe096db]{font-size:12px}.switch-text.on[data-v-fbe096db]{color:var(--atlas-success)}.switch-text.off[data-v-fbe096db]{color:var(--atlas-muted)}.var-editor[data-v-fbe096db]{width:100%;display:flex;flex-direction:column;gap:6px}.var-row[data-v-fbe096db]{display:flex;align-items:center;gap:8px}.var-name[data-v-fbe096db]{flex:1}.render-vars[data-v-fbe096db]{display:flex;flex-direction:column;gap:8px;margin-bottom:12px}.render-var-row[data-v-fbe096db]{display:flex;align-items:center;gap:10px}.render-var-name[data-v-fbe096db]{width:120px;font-size:13px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.render-var-name.required[data-v-fbe096db]{color:var(--atlas-danger)}.star[data-v-fbe096db]{margin-left:2px}.render-result[data-v-fbe096db]{background:var(--atlas-bg);border:1px solid var(--atlas-stroke);border-radius:var(--atlas-r-s);padding:12px}.render-title[data-v-fbe096db]{font-size:12px;color:var(--atlas-muted);margin-bottom:6px}.render-content[data-v-fbe096db]{margin:0;white-space:pre-wrap;font-size:13px}.missing[data-v-fbe096db]{color:var(--atlas-danger);font-size:12px;margin-top:6px}.muted[data-v-fbe096db]{color:var(--atlas-muted)}@media (max-width: 640px){.search[data-v-fbe096db]{width:100%;order:-1}.spacer[data-v-fbe096db]{display:none}.filter-bar[data-v-fbe096db]{gap:8px}.var-row[data-v-fbe096db]{flex-wrap:wrap}.var-name[data-v-fbe096db]{flex:1 1 100%}.render-var-row[data-v-fbe096db]{flex-wrap:wrap}.render-var-name[data-v-fbe096db]{width:auto;text-align:left;flex-basis:100%}}\n";document.head.appendChild(s)})();import { ref as i, computed as W, onMounted as Re, resolveComponent as d, resolveDirective as Le, openBlock as s, createElementBlock as _, createElementVNode as v, createVNode as t, withCtx as n, Fragment as B, renderList as F, createBlock as k, createTextVNode as o, toDisplayString as m, unref as b, withDirectives as re, createCommentVNode as T, normalizeClass as de, withKeys as Se, createApp as Ae } from "vue";
import De, { ElMessageBox as me, ElMessage as K } from "element-plus";
import { Search as Ie, Plus as ce, Refresh as Be, VideoPlay as Fe, Clock as je, EditPen as Oe, Delete as ve, Back as Pe } from "@element-plus/icons-vue";
import { get as pe, put as fe, del as Me, post as X } from "@atlas/runtime";
const Ke = (w, E) => {
  const g = w.__vccOpts || w;
  for (const [$, R] of E)
    g[$] = R;
  return g;
}, Ze = { class: "surface" }, Ge = { class: "filter-bar" }, He = { class: "name-cell" }, Je = { class: "main" }, Qe = {
  key: 0,
  class: "desc muted"
}, We = { class: "preview" }, Xe = { class: "var-chips" }, Ye = { class: "switch-cell" }, el = { class: "var-editor" }, ll = { class: "render-vars" }, al = {
  key: 0,
  class: "star"
}, tl = {
  key: 0,
  class: "render-result"
}, nl = { class: "render-content" }, ol = {
  key: 0,
  class: "missing"
}, il = { class: "preview" }, sl = {
  __name: "App",
  props: { appId: { type: Number, required: !0 } },
  setup(w) {
    const E = w, g = i([]), $ = i(!1), R = i(""), C = i(!1), z = i(null), Z = i(!1), j = i(!1), O = i(null), L = i({}), x = i(null), G = i(!1), S = i(!1), A = i(null), H = i([]), J = i(!1), Q = i(""), D = i(""), V = () => `/api/apps/${E.appId}/plugins/prompts/ep`, Y = W(() => ["全部", ...[...new Set(g.value.map((a) => a.category))].sort()]), _e = W(() => {
      const a = Q.value.trim().toLowerCase();
      return g.value.filter((e) => D.value && D.value !== "全部" && e.category !== D.value ? !1 : a ? e.name.toLowerCase().includes(a) || e.content.toLowerCase().includes(a) || (e.description || "").toLowerCase().includes(a) : !0);
    }), q = i([]);
    let P = 0;
    async function U() {
      const a = ++P;
      $.value = !0;
      try {
        const e = await pe(V() + "/list");
        if (a !== P) return;
        e.value = e, R.value = "";
      } catch (e) {
        a === P && (R.value = (e == null ? void 0 : e.message) || "加载失败，请刷新重试");
      } finally {
        a === P && ($.value = !1);
      }
    }
    Re(U);
    const ee = () => ({ name: "", category: "default", description: "", content: "", enabled: !0 });
    function ye() {
      z.value = null, u.value = ee(), q.value = [], C.value = !0;
    }
    function be(a) {
      z.value = a, u.value = { name: a.name, category: a.category, description: a.description, content: a.content, enabled: a.enabled }, q.value = (a.variables || []).map((e) => ({ name: e.name, required: !!e.required })), C.value = !0;
    }
    const u = i(ee());
    async function ge() {
      if (!u.value.name.trim() || !u.value.content.trim()) {
        K.warning("请填写名称与内容");
        return;
      }
      const a = q.value.map((e) => ({ name: e.name.trim(), description: "", required: e.required })).filter((e) => e.name);
      Z.value = !0;
      try {
        const e = { ...u.value, variables: a };
        z.value ? await fe(`${V()}/update/${z.value.id}`, e) : await X(V() + "/create", e), C.value = !1, await U(), K.success("已保存");
      } finally {
        Z.value = !1;
      }
    }
    async function Ve(a) {
      try {
        await me.confirm(`确认删除「${a.name}」？`, "删除提示词", { type: "error" }), await Me(`${V()}/delete/${a.id}`), await U(), K.success("已删除");
      } catch {
      }
    }
    async function ke(a) {
      await fe(`${V()}/update/${a.id}`, { enabled: !a.enabled }), await U();
    }
    function we(a, e) {
      const p = /* @__PURE__ */ new Set();
      for (const f of a.matchAll(/\{\{\s*([\w.-]+)\s*\}\}/g)) p.add(f[1]);
      for (const f of e || []) f.name && p.add(f.name);
      return [...p];
    }
    function $e(a) {
      O.value = a;
      const e = we(a.content, a.variables), p = {};
      for (const f of a.variables || []) f.name && (p[f.name] = "");
      for (const f of e) p[f] === void 0 && (p[f] = "");
      L.value = p, x.value = null, j.value = !0;
    }
    const le = W(() => {
      var a;
      return new Set((((a = O.value) == null ? void 0 : a.variables) || []).filter((e) => e.required).map((e) => e.name));
    });
    async function ae() {
      G.value = !0;
      try {
        x.value = await X(`${V()}/render/${O.value.id}`, { variables: L.value });
      } finally {
        G.value = !1;
      }
    }
    async function Ce(a) {
      try {
        await me.confirm(`确认将「${A.value.name}」恢复到 v${a.version}？将生成新版本 ${A.value.version + 1}。`, "恢复版本", { type: "warning" }), await X(`${V()}/restore/${A.value.id}`, { version: a.version }), S.value = !1, await U(), K.success("已恢复");
      } catch {
      }
    }
    async function ze(a) {
      A.value = a, S.value = !0, J.value = !0;
      try {
        H.value = await pe(`${V()}/versions/${a.id}`);
      } catch {
        H.value = [];
      } finally {
        J.value = !1;
      }
    }
    const xe = new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: !1 });
    function qe(a) {
      if (!a) return "";
      const e = a.includes("T") ? a : `${a.replace(" ", "T")}Z`, p = new Date(e);
      return Number.isNaN(p.getTime()) ? a : xe.format(p);
    }
    return (a, e) => {
      var se, ue;
      const p = d("el-radio-button"), f = d("el-radio-group"), h = d("el-input"), c = d("el-button"), I = d("el-tag"), y = d("el-table-column"), te = d("el-switch"), ne = d("el-table"), N = d("el-form-item"), Ue = d("el-option"), he = d("el-select"), Ne = d("el-checkbox"), Te = d("el-form"), Ee = d("el-drawer"), oe = d("el-dialog"), ie = Le("loading");
      return s(), _("div", Ze, [
        v("div", Ge, [
          t(f, {
            modelValue: D.value,
            "onUpdate:modelValue": e[0] || (e[0] = (l) => D.value = l),
            size: "small"
          }, {
            default: n(() => [
              (s(!0), _(B, null, F(Y.value, (l) => (s(), k(p, {
                key: l,
                value: l
              }, {
                default: n(() => [
                  o(m(l), 1)
                ]),
                _: 2
              }, 1032, ["value"]))), 128))
            ]),
            _: 1
          }, 8, ["modelValue"]),
          e[15] || (e[15] = v("div", { class: "spacer" }, null, -1)),
          t(h, {
            modelValue: Q.value,
            "onUpdate:modelValue": e[1] || (e[1] = (l) => Q.value = l),
            class: "search",
            "prefix-icon": b(Ie),
            placeholder: "搜索名称 / 内容…",
            clearable: ""
          }, null, 8, ["modelValue", "prefix-icon"]),
          t(c, {
            type: "primary",
            size: "small",
            icon: b(ce),
            onClick: ye
          }, {
            default: n(() => [...e[14] || (e[14] = [
              o("新增提示词", -1)
            ])]),
            _: 1
          }, 8, ["icon"]),
          t(c, {
            icon: b(Be),
            size: "small",
            circle: "",
            "aria-label": "刷新列表",
            loading: $.value,
            onClick: U
          }, null, 8, ["icon", "loading"])
        ]),
        re((s(), k(ne, {
          data: _e.value,
          "empty-text": R.value || "暂无提示词"
        }, {
          default: n(() => [
            t(y, {
              label: "名称",
              "min-width": "140"
            }, {
              default: n(({ row: l }) => [
                v("div", He, [
                  v("span", Je, m(l.name), 1),
                  l.category !== "default" ? (s(), k(I, {
                    key: 0,
                    size: "small",
                    effect: "plain"
                  }, {
                    default: n(() => [
                      o(m(l.category), 1)
                    ]),
                    _: 2
                  }, 1024)) : T("", !0)
                ]),
                l.description ? (s(), _("div", Qe, m(l.description), 1)) : T("", !0)
              ]),
              _: 1
            }),
            t(y, {
              label: "内容预览",
              "min-width": "220",
              "show-overflow-tooltip": ""
            }, {
              default: n(({ row: l }) => [
                v("span", We, m(l.content), 1)
              ]),
              _: 1
            }),
            t(y, {
              label: "变量",
              "min-width": "150"
            }, {
              default: n(({ row: l }) => [
                v("div", Xe, [
                  l.variables.length ? T("", !0) : (s(), k(I, {
                    key: 0,
                    size: "small",
                    type: "info",
                    effect: "plain"
                  }, {
                    default: n(() => [...e[16] || (e[16] = [
                      o("无", -1)
                    ])]),
                    _: 1
                  })),
                  (s(!0), _(B, null, F(l.variables, (r) => (s(), k(I, {
                    key: r.name,
                    size: "small",
                    type: r.required ? "danger" : "info",
                    effect: "plain"
                  }, {
                    default: n(() => [
                      o(m(r.name) + m(r.required ? " *" : ""), 1)
                    ]),
                    _: 2
                  }, 1032, ["type"]))), 128))
                ])
              ]),
              _: 1
            }),
            t(y, {
              label: "版本",
              width: "80",
              align: "center"
            }, {
              default: n(({ row: l }) => [
                t(I, {
                  size: "small",
                  type: "warning",
                  effect: "plain"
                }, {
                  default: n(() => [
                    o("v" + m(l.version), 1)
                  ]),
                  _: 2
                }, 1024)
              ]),
              _: 1
            }),
            t(y, {
              label: "启用",
              width: "110"
            }, {
              default: n(({ row: l }) => [
                v("div", Ye, [
                  t(te, {
                    "model-value": l.enabled,
                    "active-color": "var(--atlas-accent)",
                    "aria-label": `${l.enabled ? "停用" : "启用"} ${l.name}`,
                    onChange: (r) => ke(l)
                  }, null, 8, ["model-value", "aria-label", "onChange"]),
                  v("span", {
                    class: de(["switch-text", l.enabled ? "on" : "off"])
                  }, m(l.enabled ? "启用" : "停用"), 3)
                ])
              ]),
              _: 1
            }),
            t(y, {
              label: "操作",
              width: "250",
              fixed: "right"
            }, {
              default: n(({ row: l }) => [
                t(c, {
                  size: "small",
                  icon: b(Fe),
                  onClick: (r) => $e(l)
                }, {
                  default: n(() => [...e[17] || (e[17] = [
                    o("渲染", -1)
                  ])]),
                  _: 1
                }, 8, ["icon", "onClick"]),
                t(c, {
                  size: "small",
                  icon: b(je),
                  onClick: (r) => ze(l)
                }, {
                  default: n(() => [...e[18] || (e[18] = [
                    o("历史", -1)
                  ])]),
                  _: 1
                }, 8, ["icon", "onClick"]),
                t(c, {
                  size: "small",
                  icon: b(Oe),
                  onClick: (r) => be(l)
                }, {
                  default: n(() => [...e[19] || (e[19] = [
                    o("编辑", -1)
                  ])]),
                  _: 1
                }, 8, ["icon", "onClick"]),
                t(c, {
                  size: "small",
                  type: "danger",
                  plain: "",
                  icon: b(ve),
                  onClick: (r) => Ve(l)
                }, {
                  default: n(() => [...e[20] || (e[20] = [
                    o("删除", -1)
                  ])]),
                  _: 1
                }, 8, ["icon", "onClick"])
              ]),
              _: 1
            })
          ]),
          _: 1
        }, 8, ["data", "empty-text"])), [
          [ie, $.value]
        ]),
        t(Ee, {
          modelValue: C.value,
          "onUpdate:modelValue": e[9] || (e[9] = (l) => C.value = l),
          title: z.value ? "编辑提示词" : "新增提示词",
          size: "560px",
          role: "dialog",
          "aria-label": z.value ? "编辑提示词" : "新增提示词"
        }, {
          footer: n(() => [
            t(c, {
              onClick: e[8] || (e[8] = (l) => C.value = !1)
            }, {
              default: n(() => [...e[23] || (e[23] = [
                o("取消", -1)
              ])]),
              _: 1
            }),
            t(c, {
              type: "primary",
              loading: Z.value,
              onClick: ge
            }, {
              default: n(() => [...e[24] || (e[24] = [
                o("保存", -1)
              ])]),
              _: 1
            }, 8, ["loading"])
          ]),
          default: n(() => [
            t(Te, { "label-position": "top" }, {
              default: n(() => [
                t(N, {
                  label: "名称",
                  required: ""
                }, {
                  default: n(() => [
                    t(h, {
                      modelValue: u.value.name,
                      "onUpdate:modelValue": e[2] || (e[2] = (l) => u.value.name = l),
                      name: "prompt-name",
                      autocomplete: "off",
                      placeholder: "例如：文章润色"
                    }, null, 8, ["modelValue"])
                  ]),
                  _: 1
                }),
                t(N, { label: "分类" }, {
                  default: n(() => [
                    t(he, {
                      modelValue: u.value.category,
                      "onUpdate:modelValue": e[3] || (e[3] = (l) => u.value.category = l),
                      "allow-create": "",
                      filterable: "",
                      "default-first-option": ""
                    }, {
                      default: n(() => [
                        (s(!0), _(B, null, F(Y.value.filter((l) => l !== "全部"), (l) => (s(), k(Ue, {
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
                t(N, { label: "描述" }, {
                  default: n(() => [
                    t(h, {
                      modelValue: u.value.description,
                      "onUpdate:modelValue": e[4] || (e[4] = (l) => u.value.description = l),
                      placeholder: "一句话说明用途（列表展示）"
                    }, null, 8, ["modelValue"])
                  ]),
                  _: 1
                }),
                t(N, { label: "变量" }, {
                  default: n(() => [
                    v("div", el, [
                      (s(!0), _(B, null, F(q.value, (l, r) => (s(), _("div", {
                        key: r,
                        class: "var-row"
                      }, [
                        t(h, {
                          modelValue: l.name,
                          "onUpdate:modelValue": (M) => l.name = M,
                          size: "small",
                          placeholder: "变量名，如 text",
                          class: "var-name"
                        }, null, 8, ["modelValue", "onUpdate:modelValue"]),
                        t(Ne, {
                          modelValue: l.required,
                          "onUpdate:modelValue": (M) => l.required = M,
                          size: "small"
                        }, {
                          default: n(() => [...e[21] || (e[21] = [
                            o("必填", -1)
                          ])]),
                          _: 1
                        }, 8, ["modelValue", "onUpdate:modelValue"]),
                        t(c, {
                          size: "small",
                          text: "",
                          type: "danger",
                          icon: b(ve),
                          "aria-label": "删除该变量行",
                          onClick: (M) => q.value.splice(r, 1)
                        }, null, 8, ["icon", "onClick"])
                      ]))), 128)),
                      t(c, {
                        size: "small",
                        plain: "",
                        icon: b(ce),
                        onClick: e[5] || (e[5] = (l) => q.value.push({ name: "", required: !1 }))
                      }, {
                        default: n(() => [...e[22] || (e[22] = [
                          o("添加变量", -1)
                        ])]),
                        _: 1
                      }, 8, ["icon"])
                    ])
                  ]),
                  _: 1
                }),
                t(N, {
                  label: "内容",
                  required: ""
                }, {
                  default: n(() => [
                    t(h, {
                      modelValue: u.value.content,
                      "onUpdate:modelValue": e[6] || (e[6] = (l) => u.value.content = l),
                      type: "textarea",
                      rows: 7,
                      placeholder: "支持 {{变量}} 占位"
                    }, null, 8, ["modelValue"])
                  ]),
                  _: 1
                }),
                t(N, { label: "启用" }, {
                  default: n(() => [
                    t(te, {
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
        }, 8, ["modelValue", "title", "aria-label"]),
        t(oe, {
          modelValue: j.value,
          "onUpdate:modelValue": e[11] || (e[11] = (l) => j.value = l),
          title: `渲染测试：${((se = O.value) == null ? void 0 : se.name) ?? ""}`,
          width: "600"
        }, {
          footer: n(() => [
            t(c, {
              onClick: e[10] || (e[10] = (l) => j.value = !1)
            }, {
              default: n(() => [...e[26] || (e[26] = [
                o("关闭", -1)
              ])]),
              _: 1
            }),
            t(c, {
              type: "primary",
              loading: G.value,
              onClick: ae
            }, {
              default: n(() => [...e[27] || (e[27] = [
                o("渲染", -1)
              ])]),
              _: 1
            }, 8, ["loading"])
          ]),
          default: n(() => [
            v("div", ll, [
              (s(!0), _(B, null, F(Object.keys(L.value), (l) => (s(), _("div", {
                key: l,
                class: "render-var-row"
              }, [
                v("span", {
                  class: de(["render-var-name", { required: le.value.has(l) }])
                }, [
                  o(m(l), 1),
                  le.value.has(l) ? (s(), _("span", al, "*")) : T("", !0)
                ], 2),
                t(h, {
                  modelValue: L.value[l],
                  "onUpdate:modelValue": (r) => L.value[l] = r,
                  size: "small",
                  "aria-label": `变量 ${l} 的值`,
                  placeholder: `{{${l}}}`,
                  onKeyup: Se(ae, ["enter"])
                }, null, 8, ["modelValue", "onUpdate:modelValue", "aria-label", "placeholder"])
              ]))), 128))
            ]),
            x.value ? (s(), _("div", tl, [
              e[25] || (e[25] = v("div", { class: "render-title" }, "结果", -1)),
              v("pre", nl, m(x.value.content), 1),
              Object.keys(x.value.missingVariables).length ? (s(), _("div", ol, " 缺失必填变量：" + m(Object.keys(x.value.missingVariables).join("、")) + "，请填写后重试 ", 1)) : T("", !0)
            ])) : T("", !0)
          ]),
          _: 1
        }, 8, ["modelValue", "title"]),
        t(oe, {
          modelValue: S.value,
          "onUpdate:modelValue": e[13] || (e[13] = (l) => S.value = l),
          title: `版本历史：${((ue = A.value) == null ? void 0 : ue.name) ?? ""}`,
          width: "640"
        }, {
          footer: n(() => [
            t(c, {
              type: "primary",
              onClick: e[12] || (e[12] = (l) => S.value = !1)
            }, {
              default: n(() => [...e[29] || (e[29] = [
                o("关闭", -1)
              ])]),
              _: 1
            })
          ]),
          default: n(() => [
            re((s(), k(ne, {
              data: H.value,
              size: "small",
              "empty-text": "暂无历史版本"
            }, {
              default: n(() => [
                t(y, {
                  label: "版本",
                  width: "90"
                }, {
                  default: n(({ row: l }) => [
                    t(I, {
                      size: "small",
                      type: "warning",
                      effect: "plain"
                    }, {
                      default: n(() => [
                        o("v" + m(l.version), 1)
                      ]),
                      _: 2
                    }, 1024)
                  ]),
                  _: 1
                }),
                t(y, {
                  label: "内容",
                  "min-width": "260",
                  "show-overflow-tooltip": ""
                }, {
                  default: n(({ row: l }) => [
                    v("span", il, m(l.content), 1)
                  ]),
                  _: 1
                }),
                t(y, {
                  label: "时间",
                  width: "150"
                }, {
                  default: n(({ row: l }) => [
                    o(m(qe(l.createdAt)), 1)
                  ]),
                  _: 1
                }),
                t(y, {
                  label: "操作",
                  width: "100",
                  fixed: "right"
                }, {
                  default: n(({ row: l }) => [
                    t(c, {
                      size: "small",
                      icon: b(Pe),
                      onClick: (r) => Ce(l)
                    }, {
                      default: n(() => [...e[28] || (e[28] = [
                        o("恢复", -1)
                      ])]),
                      _: 1
                    }, 8, ["icon", "onClick"])
                  ]),
                  _: 1
                })
              ]),
              _: 1
            }, 8, ["data"])), [
              [ie, J.value]
            ])
          ]),
          _: 1
        }, 8, ["modelValue", "title"])
      ]);
    };
  }
}, ul = /* @__PURE__ */ Ke(sl, [["__scopeId", "data-v-fbe096db"]]), vl = {
  mount(w, E) {
    const g = Ae(ul, { appId: E.appId });
    return g.use(De), g.mount(w), () => g.unmount();
  }
};
export {
  vl as default
};
