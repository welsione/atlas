;(()=>{const s=document.createElement('style');s.textContent=".upload-box[data-v-ba325092]{margin-bottom:14px;padding:14px;background:var(--aibase-bg);border-radius:8px}.update-banner[data-v-ba325092]{display:flex;align-items:center;gap:8px;margin-bottom:10px;font-size:13px}.update-name[data-v-ba325092]{flex:1}.dropzone[data-v-ba325092] .el-upload-dragger{padding:18px}.upload-row[data-v-ba325092]{display:flex;align-items:center;gap:12px;margin-top:10px;flex-wrap:wrap}.filter-bar[data-v-ba325092]{display:flex;align-items:center;gap:8px;margin-bottom:12px;flex-wrap:wrap}.spacer[data-v-ba325092]{flex:1}.search[data-v-ba325092]{width:200px}.name-cell[data-v-ba325092]{display:flex;align-items:center;gap:6px;min-width:0;flex-wrap:wrap}.name-cell .main[data-v-ba325092]{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dir-icon[data-v-ba325092]{color:#e6a23c}.file-icon[data-v-ba325092]{color:var(--aibase-muted)}.desc[data-v-ba325092]{font-size:12px;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:420px}.token-cell[data-v-ba325092]{display:flex;align-items:center;gap:4px}.file-list[data-v-ba325092]{max-height:260px;overflow:auto}.file-item[data-v-ba325092]{display:flex;gap:8px;font-size:12px;padding:3px 0;align-items:baseline}.f-name[data-v-ba325092]{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:monospace}.f-size[data-v-ba325092]{width:64px;text-align:right;flex-shrink:0}.f-sha[data-v-ba325092]{width:60px;flex-shrink:0}.muted[data-v-ba325092]{color:var(--aibase-muted)}\n";document.head.appendChild(s)})();import { ref as f, computed as L, onMounted as ne, resolveComponent as p, resolveDirective as oe, openBlock as s, createElementBlock as k, createElementVNode as u, createVNode as n, withCtx as a, createTextVNode as o, toDisplayString as i, createCommentVNode as R, unref as m, Fragment as N, renderList as S, createBlock as b, withDirectives as ie, createApp as se } from "vue";
import ue, { ElMessage as C, ElMessageBox as de } from "element-plus";
import { Upload as M, Search as ce, Refresh as re, FolderOpened as pe, Files as fe, CopyDocument as me, Download as ve, Delete as _e } from "@element-plus/icons-vue";
import { get as ye, post as Y, del as ge } from "@atlas/runtime";
const ke = (h, $) => {
  const d = h.__vccOpts || h;
  for (const [w, g] of $)
    d[w] = g;
  return d;
}, be = { class: "surface" }, Ce = { class: "upload-box" }, he = {
  key: 0,
  class: "update-banner"
}, we = { class: "update-name" }, xe = { class: "upload-row" }, $e = { class: "filter-bar" }, ze = { class: "name-cell" }, Ve = { class: "main" }, De = { class: "file-list" }, Ie = ["title"], Re = { class: "f-size muted" }, Te = ["title"], Be = {
  key: 0,
  class: "desc muted"
}, Ee = {
  key: 0,
  class: "token-cell"
}, Fe = { class: "mono" }, Ue = {
  __name: "App",
  props: { appId: { type: Number, required: !0 } },
  setup(h) {
    const $ = h, d = f([]), w = f(!1), g = f("default"), z = f(""), x = f([]), T = f(!1), B = f(""), V = f(""), c = f(null), I = () => `/api/apps/${$.appId}/plugins/model-files/ep`, q = L(() => ["全部", ...[...new Set(d.value.map((t) => t.category))].sort()]), K = L(() => {
      const t = B.value.trim().toLowerCase();
      return d.value.filter((e) => V.value && V.value !== "全部" && e.category !== V.value ? !1 : t ? e.name.toLowerCase().includes(t) || (e.description || "").toLowerCase().includes(t) : !0);
    });
    async function D() {
      w.value = !0;
      try {
        d.value = await ye(I() + "/list");
      } finally {
        w.value = !1;
      }
    }
    ne(D);
    function P(t) {
      x.value = t;
    }
    function j(t) {
      c.value = t, g.value = t.category, z.value = t.description || "", x.value = [];
    }
    function U() {
      c.value = null, g.value = "default", z.value = "", x.value = [];
    }
    async function G() {
      if (!x.value.length) {
        C.warning("请选择文件");
        return;
      }
      T.value = !0;
      try {
        const t = new FormData();
        t.append("category", g.value), t.append("description", z.value), c.value && t.append("updateId", String(c.value.id));
        for (const v of x.value)
          t.append("files", v.raw, v.name);
        const e = await Y(I() + "/upload", t);
        C.success(c.value ? `「${c.value.name}」已更新为 v${e.version}` : "上传成功"), U(), await D();
      } finally {
        T.value = !1;
      }
    }
    async function H(t) {
      const e = t.kind === "DIRECTORY" ? `${t.name}（${t.fileCount} 个文件）` : t.name;
      try {
        await de.confirm(`确认删除「${e}」？删除后公开链接失效，不可恢复。`, "删除模型文件", { type: "error" }), await ge(`${I()}/delete/${t.id}`), await D(), C.success("已删除");
      } catch {
      }
    }
    async function O(t) {
      if (t.token) return t.token;
      if (t.kind === "DIRECTORY")
        return C.warning("目录（多文件）不支持公开下载链接"), null;
      const e = await Y(`${I()}/publish/${t.id}`);
      return C.success("已生成公开链接"), await D(), e.token;
    }
    async function J(t) {
      const e = await O(t);
      e && window.open(`/api/files/${e}/download`, "_blank");
    }
    async function Q(t) {
      const e = await O(t);
      if (e)
        try {
          await navigator.clipboard.writeText(`${location.origin}/api/files/${e}/download`), C.success("下载链接已复制");
        } catch {
          C.warning("复制失败，请手动复制 token");
        }
    }
    function A(t) {
      return t == null ? "—" : t >= 1048576 ? `${(t / 1048576).toFixed(1)} MB` : t >= 1024 ? `${(t / 1024).toFixed(1)} KB` : `${t} B`;
    }
    function W(t) {
      return t ? t.replace("T", " ").slice(0, 16) : "—";
    }
    return (t, e) => {
      const v = p("el-tag"), _ = p("el-button"), E = p("el-icon"), X = p("el-upload"), F = p("el-input"), Z = p("el-radio-button"), ee = p("el-radio-group"), te = p("el-popover"), y = p("el-table-column"), le = p("el-table"), ae = oe("loading");
      return s(), k("div", be, [
        u("div", Ce, [
          c.value ? (s(), k("div", he, [
            n(v, {
              type: "warning",
              size: "small",
              effect: "dark"
            }, {
              default: a(() => [...e[4] || (e[4] = [
                o("更新模式", -1)
              ])]),
              _: 1
            }),
            u("span", we, "正在更新「" + i(c.value.name) + "」（v" + i(c.value.version) + "），上传文件将替换全部内容", 1),
            n(_, {
              size: "small",
              text: "",
              type: "info",
              onClick: U
            }, {
              default: a(() => [...e[5] || (e[5] = [
                o("取消更新", -1)
              ])]),
              _: 1
            })
          ])) : R("", !0),
          n(X, {
            drag: "",
            multiple: "",
            "auto-upload": !1,
            "on-change": P,
            "file-list": x.value,
            class: "dropzone"
          }, {
            default: a(() => [
              n(E, { class: "el-icon--upload" }, {
                default: a(() => [
                  n(m(M))
                ]),
                _: 1
              }),
              e[6] || (e[6] = u("div", { class: "el-upload__text" }, [
                o("拖拽文件到此处，或"),
                u("em", null, "点击选择"),
                o("（多选 = 目录形式）")
              ], -1))
            ]),
            _: 1
          }, 8, ["file-list"]),
          u("div", xe, [
            n(F, {
              modelValue: g.value,
              "onUpdate:modelValue": e[0] || (e[0] = (l) => g.value = l),
              placeholder: "分类（default）",
              style: { width: "160px" }
            }, null, 8, ["modelValue"]),
            n(F, {
              modelValue: z.value,
              "onUpdate:modelValue": e[1] || (e[1] = (l) => z.value = l),
              placeholder: "描述（可选）",
              style: { width: "260px" }
            }, null, 8, ["modelValue"]),
            n(_, {
              type: "primary",
              loading: T.value,
              onClick: G
            }, {
              default: a(() => [
                o(i(c.value ? "更新文件" : "上传"), 1)
              ]),
              _: 1
            }, 8, ["loading"])
          ])
        ]),
        u("div", $e, [
          n(ee, {
            modelValue: V.value,
            "onUpdate:modelValue": e[2] || (e[2] = (l) => V.value = l),
            size: "small"
          }, {
            default: a(() => [
              (s(!0), k(N, null, S(q.value, (l) => (s(), b(Z, {
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
          e[7] || (e[7] = u("div", { class: "spacer" }, null, -1)),
          n(F, {
            modelValue: B.value,
            "onUpdate:modelValue": e[3] || (e[3] = (l) => B.value = l),
            class: "search",
            "prefix-icon": m(ce),
            placeholder: "搜索名称 / 描述",
            clearable: ""
          }, null, 8, ["modelValue", "prefix-icon"]),
          n(_, {
            icon: m(re),
            size: "small",
            circle: "",
            loading: w.value,
            onClick: D
          }, null, 8, ["icon", "loading"])
        ]),
        ie((s(), b(le, {
          data: K.value,
          "empty-text": "暂无模型文件"
        }, {
          default: a(() => [
            n(y, {
              label: "名称",
              "min-width": "170"
            }, {
              default: a(({ row: l }) => [
                u("div", ze, [
                  l.kind === "DIRECTORY" ? (s(), b(E, {
                    key: 0,
                    class: "dir-icon"
                  }, {
                    default: a(() => [
                      n(m(pe))
                    ]),
                    _: 1
                  })) : (s(), b(E, {
                    key: 1,
                    class: "file-icon"
                  }, {
                    default: a(() => [
                      n(m(fe))
                    ]),
                    _: 1
                  })),
                  u("span", Ve, i(l.name), 1),
                  l.fileCount > 1 ? (s(), b(v, {
                    key: 2,
                    size: "small",
                    type: "warning",
                    effect: "plain"
                  }, {
                    default: a(() => [
                      o(i(l.fileCount) + " 文件", 1)
                    ]),
                    _: 2
                  }, 1024)) : R("", !0),
                  l.fileCount > 1 ? (s(), b(te, {
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
                        default: a(() => [...e[8] || (e[8] = [
                          o("查看清单", -1)
                        ])]),
                        _: 1
                      })
                    ]),
                    default: a(() => [
                      u("div", De, [
                        (s(!0), k(N, null, S(l.files, (r) => (s(), k("div", {
                          key: r.path,
                          class: "file-item"
                        }, [
                          u("span", {
                            class: "f-name",
                            title: r.path
                          }, i(r.path), 9, Ie),
                          u("span", Re, i(A(r.sizeBytes)), 1),
                          u("span", {
                            class: "f-sha muted",
                            title: r.checksum
                          }, i(r.checksum.slice(0, 8)), 9, Te)
                        ]))), 128))
                      ])
                    ]),
                    _: 2
                  }, 1024)) : R("", !0)
                ]),
                l.description ? (s(), k("div", Be, i(l.description), 1)) : R("", !0)
              ]),
              _: 1
            }),
            n(y, {
              label: "分类",
              width: "90"
            }, {
              default: a(({ row: l }) => [
                n(v, {
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
                n(v, {
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
                  u("code", Fe, i(l.token.slice(0, 12)) + "…", 1),
                  n(_, {
                    size: "small",
                    text: "",
                    type: "primary",
                    icon: m(me),
                    onClick: (r) => Q(l)
                  }, {
                    default: a(() => [...e[9] || (e[9] = [
                      o("复制", -1)
                    ])]),
                    _: 1
                  }, 8, ["icon", "onClick"])
                ])) : (s(), b(v, {
                  key: 1,
                  size: "small",
                  type: "info",
                  effect: "plain"
                }, {
                  default: a(() => [...e[10] || (e[10] = [
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
                o(i(W(l.updatedAt)), 1)
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
                  icon: m(M),
                  onClick: (r) => j(l)
                }, {
                  default: a(() => [...e[11] || (e[11] = [
                    o("更新", -1)
                  ])]),
                  _: 1
                }, 8, ["icon", "onClick"]),
                n(_, {
                  size: "small",
                  type: "primary",
                  plain: "",
                  icon: m(ve),
                  disabled: l.kind === "DIRECTORY" && !l.token,
                  onClick: (r) => J(l)
                }, {
                  default: a(() => [...e[12] || (e[12] = [
                    o("下载", -1)
                  ])]),
                  _: 1
                }, 8, ["icon", "disabled", "onClick"]),
                n(_, {
                  size: "small",
                  type: "danger",
                  plain: "",
                  icon: m(_e),
                  onClick: (r) => H(l)
                }, {
                  default: a(() => [...e[13] || (e[13] = [
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
          [ae, w.value]
        ])
      ]);
    };
  }
}, Oe = /* @__PURE__ */ ke(Ue, [["__scopeId", "data-v-ba325092"]]), Me = {
  mount(h, $) {
    const d = se(Oe, { appId: $.appId });
    return d.use(ue), d.mount(h), () => d.unmount();
  }
};
export {
  Me as default
};
