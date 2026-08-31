;(()=>{const s=document.createElement('style');s.textContent=".upload-box[data-v-1c099764]{margin-bottom:14px;padding:14px;background:var(--atlas-bg);border-radius:var(--atlas-r-s)}.update-banner[data-v-1c099764]{display:flex;align-items:center;gap:8px;margin-bottom:10px;font-size:13px}.update-name[data-v-1c099764]{flex:1}.dropzone[data-v-1c099764] .el-upload-dragger{padding:18px}.upload-row[data-v-1c099764]{display:flex;align-items:center;gap:12px;margin-top:10px;flex-wrap:wrap}.filter-bar[data-v-1c099764]{display:flex;align-items:center;gap:8px;margin-bottom:12px;flex-wrap:wrap}.spacer[data-v-1c099764]{flex:1}.search[data-v-1c099764]{width:200px}.name-cell[data-v-1c099764]{display:flex;align-items:center;gap:6px;min-width:0;flex-wrap:wrap}.name-cell .main[data-v-1c099764]{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dir-icon[data-v-1c099764]{color:var(--atlas-warning)}.file-icon[data-v-1c099764]{color:var(--atlas-muted)}.desc[data-v-1c099764]{font-size:12px;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:420px}.token-cell[data-v-1c099764]{display:flex;align-items:center;gap:4px}.file-list[data-v-1c099764]{max-height:260px;overflow:auto}.file-item[data-v-1c099764]{display:flex;gap:8px;font-size:12px;padding:3px 0;align-items:baseline}.f-name[data-v-1c099764]{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}.f-size[data-v-1c099764]{width:64px;text-align:right;flex-shrink:0}.f-sha[data-v-1c099764]{width:60px;flex-shrink:0}.muted[data-v-1c099764]{color:var(--atlas-muted)}\n";document.head.appendChild(s)})();import { ref as m, computed as L, onMounted as ie, resolveComponent as f, resolveDirective as se, openBlock as s, createElementBlock as k, createElementVNode as u, createVNode as n, withCtx as a, createTextVNode as o, toDisplayString as i, createCommentVNode as F, unref as v, Fragment as S, renderList as M, createBlock as h, withDirectives as ue, createApp as de } from "vue";
import re, { ElMessage as b, ElMessageBox as ce } from "element-plus";
import { Upload as Y, Search as pe, Refresh as fe, FolderOpened as me, Files as ve, CopyDocument as _e, Download as ye, Delete as ge } from "@element-plus/icons-vue";
import { get as ke, post as q, del as he } from "@atlas/runtime";
const be = (C, x) => {
  const r = C.__vccOpts || C;
  for (const [w, g] of x)
    r[w] = g;
  return r;
}, Ce = { class: "surface" }, we = { class: "upload-box" }, $e = {
  key: 0,
  class: "update-banner"
}, xe = { class: "update-name" }, ze = { class: "upload-row" }, Ve = { class: "filter-bar" }, De = { class: "name-cell" }, Te = { class: "main" }, Fe = { class: "file-list" }, Ie = ["title"], Ne = { class: "f-size muted" }, Re = ["title"], Be = {
  key: 0,
  class: "desc muted"
}, Ee = {
  key: 0,
  class: "token-cell"
}, Ue = { class: "mono" }, Oe = {
  __name: "App",
  props: { appId: { type: Number, required: !0 } },
  setup(C) {
    const x = C, r = m([]), w = m(!1), g = m("default"), z = m(""), $ = m([]), I = m(!1), N = m(""), V = m(""), c = m(null), T = () => `/api/apps/${x.appId}/plugins/model-files/ep`, K = L(() => ["全部", ...[...new Set(r.value.map((e) => e.category))].sort()]), P = L(() => {
      const e = N.value.trim().toLowerCase();
      return r.value.filter((t) => V.value && V.value !== "全部" && t.category !== V.value ? !1 : e ? t.name.toLowerCase().includes(e) || (t.description || "").toLowerCase().includes(e) : !0);
    });
    async function D() {
      w.value = !0;
      try {
        r.value = await ke(T() + "/list");
      } finally {
        w.value = !1;
      }
    }
    ie(D);
    function Z(e) {
      $.value = e;
    }
    function j(e) {
      c.value = e, g.value = e.category, z.value = e.description || "", $.value = [];
    }
    function E() {
      c.value = null, g.value = "default", z.value = "", $.value = [];
    }
    async function G() {
      if (!$.value.length) {
        b.warning("请选择文件");
        return;
      }
      I.value = !0;
      try {
        const e = new FormData();
        e.append("category", g.value), e.append("description", z.value), c.value && e.append("updateId", String(c.value.id));
        for (const d of $.value)
          e.append("files", d.raw, d.name);
        const t = await q(T() + "/upload", e);
        b.success(c.value ? `「${c.value.name}」已更新为 v${t.version}` : "上传成功"), E(), await D();
      } finally {
        I.value = !1;
      }
    }
    async function H(e) {
      const t = e.kind === "DIRECTORY" ? `${e.name}（${e.fileCount} 个文件）` : e.name;
      try {
        await ce.confirm(`确认删除「${t}」？删除后公开链接失效，不可恢复。`, "删除模型文件", { type: "error" }), await he(`${T()}/delete/${e.id}`), await D(), b.success("已删除");
      } catch {
      }
    }
    async function U(e) {
      if (e.token) return e.token;
      if (e.kind === "DIRECTORY")
        return b.warning("目录（多文件）不支持公开下载链接"), null;
      const t = await q(`${T()}/publish/${e.id}`);
      return b.success("已生成公开链接"), await D(), t.token;
    }
    async function J(e) {
      const t = await U(e);
      t && window.open(`/api/files/${t}/download`, "_blank");
    }
    async function Q(e) {
      const t = await U(e);
      if (t)
        try {
          await navigator.clipboard.writeText(`${location.origin}/api/files/${t}/download`), b.success("下载链接已复制");
        } catch {
          b.warning("复制失败，请手动复制 token");
        }
    }
    const O = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 1 });
    function A(e) {
      return e == null ? "—" : e >= 1048576 ? `${O.format(e / 1048576)} MB` : e >= 1024 ? `${O.format(e / 1024)} KB` : `${e} B`;
    }
    const W = new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: !1 });
    function X(e) {
      if (!e) return "—";
      const t = e.includes("T") ? e : `${e.replace(" ", "T")}Z`, d = new Date(t);
      return Number.isNaN(d.getTime()) ? e : W.format(d);
    }
    return (e, t) => {
      const d = f("el-tag"), _ = f("el-button"), R = f("el-icon"), ee = f("el-upload"), B = f("el-input"), te = f("el-radio-button"), le = f("el-radio-group"), ae = f("el-popover"), y = f("el-table-column"), ne = f("el-table"), oe = se("loading");
      return s(), k("div", Ce, [
        u("div", we, [
          c.value ? (s(), k("div", $e, [
            n(d, {
              type: "warning",
              size: "small",
              effect: "dark"
            }, {
              default: a(() => [...t[4] || (t[4] = [
                o("更新模式", -1)
              ])]),
              _: 1
            }),
            u("span", xe, "正在更新「" + i(c.value.name) + "」（v" + i(c.value.version) + "），上传文件将替换全部内容", 1),
            n(_, {
              size: "small",
              text: "",
              type: "info",
              onClick: E
            }, {
              default: a(() => [...t[5] || (t[5] = [
                o("取消更新", -1)
              ])]),
              _: 1
            })
          ])) : F("", !0),
          n(ee, {
            drag: "",
            multiple: "",
            "auto-upload": !1,
            "on-change": Z,
            "file-list": $.value,
            class: "dropzone"
          }, {
            default: a(() => [
              n(R, { class: "el-icon--upload" }, {
                default: a(() => [
                  n(v(Y))
                ]),
                _: 1
              }),
              t[6] || (t[6] = u("div", { class: "el-upload__text" }, [
                o("拖拽文件到此处，或"),
                u("em", null, "点击选择"),
                o("（多选 = 目录形式）")
              ], -1))
            ]),
            _: 1
          }, 8, ["file-list"]),
          u("div", ze, [
            n(B, {
              modelValue: g.value,
              "onUpdate:modelValue": t[0] || (t[0] = (l) => g.value = l),
              name: "file-category",
              autocomplete: "off",
              placeholder: "分类（default）",
              style: { width: "160px" }
            }, null, 8, ["modelValue"]),
            n(B, {
              modelValue: z.value,
              "onUpdate:modelValue": t[1] || (t[1] = (l) => z.value = l),
              name: "file-desc",
              autocomplete: "off",
              placeholder: "描述（可选）",
              style: { width: "260px" }
            }, null, 8, ["modelValue"]),
            n(_, {
              type: "primary",
              loading: I.value,
              onClick: G
            }, {
              default: a(() => [
                o(i(c.value ? "更新文件" : "上传"), 1)
              ]),
              _: 1
            }, 8, ["loading"])
          ])
        ]),
        u("div", Ve, [
          n(le, {
            modelValue: V.value,
            "onUpdate:modelValue": t[2] || (t[2] = (l) => V.value = l),
            size: "small"
          }, {
            default: a(() => [
              (s(!0), k(S, null, M(K.value, (l) => (s(), h(te, {
                key: l,
                value: l
              }, {
                default: a(() => [
                  o(i(l), 1)
                ]),
                _: 2
              }, 1032, ["value"]))), 128))
            ]),
            _: 1
          }, 8, ["modelValue"]),
          t[7] || (t[7] = u("div", { class: "spacer" }, null, -1)),
          n(B, {
            modelValue: N.value,
            "onUpdate:modelValue": t[3] || (t[3] = (l) => N.value = l),
            class: "search",
            "prefix-icon": v(pe),
            placeholder: "搜索名称 / 描述…",
            clearable: ""
          }, null, 8, ["modelValue", "prefix-icon"]),
          n(_, {
            icon: v(fe),
            size: "small",
            circle: "",
            "aria-label": "刷新列表",
            loading: w.value,
            onClick: D
          }, null, 8, ["icon", "loading"])
        ]),
        ue((s(), h(ne, {
          data: P.value,
          "empty-text": "暂无模型文件"
        }, {
          default: a(() => [
            n(y, {
              label: "名称",
              "min-width": "170"
            }, {
              default: a(({ row: l }) => [
                u("div", De, [
                  l.kind === "DIRECTORY" ? (s(), h(R, {
                    key: 0,
                    class: "dir-icon",
                    "aria-hidden": "true"
                  }, {
                    default: a(() => [
                      n(v(me))
                    ]),
                    _: 1
                  })) : (s(), h(R, {
                    key: 1,
                    class: "file-icon",
                    "aria-hidden": "true"
                  }, {
                    default: a(() => [
                      n(v(ve))
                    ]),
                    _: 1
                  })),
                  u("span", Te, i(l.name), 1),
                  l.fileCount > 1 ? (s(), h(d, {
                    key: 2,
                    size: "small",
                    type: "warning",
                    effect: "plain"
                  }, {
                    default: a(() => [
                      o(i(l.fileCount) + " 文件", 1)
                    ]),
                    _: 2
                  }, 1024)) : F("", !0),
                  l.fileCount > 1 ? (s(), h(ae, {
                    key: 3,
                    placement: "right",
                    width: "320",
                    trigger: "hover"
                  }, {
                    reference: a(() => [
                      n(_, {
                        size: "small",
                        text: "",
                        type: "primary"
                      }, {
                        default: a(() => [...t[8] || (t[8] = [
                          o("查看清单", -1)
                        ])]),
                        _: 1
                      })
                    ]),
                    default: a(() => [
                      u("div", Fe, [
                        (s(!0), k(S, null, M(l.files, (p) => (s(), k("div", {
                          key: p.path,
                          class: "file-item"
                        }, [
                          u("span", {
                            class: "f-name",
                            title: p.path
                          }, i(p.path), 9, Ie),
                          u("span", Ne, i(A(p.sizeBytes)), 1),
                          u("span", {
                            class: "f-sha muted",
                            title: p.checksum
                          }, i(p.checksum.slice(0, 8)), 9, Re)
                        ]))), 128))
                      ])
                    ]),
                    _: 2
                  }, 1024)) : F("", !0)
                ]),
                l.description ? (s(), k("div", Be, i(l.description), 1)) : F("", !0)
              ]),
              _: 1
            }),
            n(y, {
              label: "分类",
              width: "90"
            }, {
              default: a(({ row: l }) => [
                n(d, {
                  size: "small",
                  effect: "plain"
                }, {
                  default: a(() => [
                    o(i(l.category), 1)
                  ]),
                  _: 2
                }, 1024)
              ]),
              _: 1
            }),
            n(y, {
              label: "大小",
              width: "90",
              align: "right"
            }, {
              default: a(({ row: l }) => [
                o(i(A(l.totalSize)), 1)
              ]),
              _: 1
            }),
            n(y, {
              label: "版本",
              width: "70",
              align: "center"
            }, {
              default: a(({ row: l }) => [
                n(d, {
                  size: "small",
                  type: "warning",
                  effect: "plain"
                }, {
                  default: a(() => [
                    o("v" + i(l.version), 1)
                  ]),
                  _: 2
                }, 1024)
              ]),
              _: 1
            }),
            n(y, {
              label: "下载",
              width: "70",
              align: "center"
            }, {
              default: a(({ row: l }) => [
                o(i(l.downloadCount), 1)
              ]),
              _: 1
            }),
            n(y, {
              label: "公开链接",
              "min-width": "150"
            }, {
              default: a(({ row: l }) => [
                l.token ? (s(), k("div", Ee, [
                  u("code", Ue, i(l.token.slice(0, 12)) + "…", 1),
                  n(_, {
                    size: "small",
                    text: "",
                    type: "primary",
                    icon: v(_e),
                    onClick: (p) => Q(l)
                  }, {
                    default: a(() => [...t[9] || (t[9] = [
                      o("复制", -1)
                    ])]),
                    _: 1
                  }, 8, ["icon", "onClick"])
                ])) : (s(), h(d, {
                  key: 1,
                  size: "small",
                  type: "info",
                  effect: "plain"
                }, {
                  default: a(() => [...t[10] || (t[10] = [
                    o("未托管", -1)
                  ])]),
                  _: 1
                }))
              ]),
              _: 1
            }),
            n(y, {
              label: "更新时间",
              width: "140"
            }, {
              default: a(({ row: l }) => [
                o(i(X(l.updatedAt)), 1)
              ]),
              _: 1
            }),
            n(y, {
              label: "操作",
              width: "220",
              fixed: "right"
            }, {
              default: a(({ row: l }) => [
                n(_, {
                  size: "small",
                  icon: v(Y),
                  onClick: (p) => j(l)
                }, {
                  default: a(() => [...t[11] || (t[11] = [
                    o("更新", -1)
                  ])]),
                  _: 1
                }, 8, ["icon", "onClick"]),
                n(_, {
                  size: "small",
                  type: "primary",
                  plain: "",
                  icon: v(ye),
                  disabled: l.kind === "DIRECTORY" && !l.token,
                  onClick: (p) => J(l)
                }, {
                  default: a(() => [...t[12] || (t[12] = [
                    o("下载", -1)
                  ])]),
                  _: 1
                }, 8, ["icon", "disabled", "onClick"]),
                n(_, {
                  size: "small",
                  type: "danger",
                  plain: "",
                  icon: v(ge),
                  onClick: (p) => H(l)
                }, {
                  default: a(() => [...t[13] || (t[13] = [
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
          [oe, w.value]
        ])
      ]);
    };
  }
}, Ae = /* @__PURE__ */ be(Oe, [["__scopeId", "data-v-1c099764"]]), qe = {
  mount(C, x) {
    const r = de(Ae, { appId: x.appId });
    return r.use(re), r.mount(C), () => r.unmount();
  }
};
export {
  qe as default
};
