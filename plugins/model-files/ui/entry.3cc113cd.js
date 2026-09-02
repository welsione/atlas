;(()=>{const s=document.createElement('style');s.textContent=".upload-box[data-v-a7c1259e]{margin-bottom:14px;padding:14px;background:var(--atlas-bg);border-radius:var(--atlas-r-s)}.update-banner[data-v-a7c1259e]{display:flex;align-items:center;gap:8px;margin-bottom:10px;font-size:13px}.update-name[data-v-a7c1259e]{flex:1}.dropzone[data-v-a7c1259e] .el-upload-dragger{padding:18px}.picked-list[data-v-a7c1259e]{list-style:none;margin:10px 0 0;padding:0;border:1px solid var(--atlas-stroke);border-radius:var(--atlas-r-s);max-height:220px;overflow:auto}.picked-item[data-v-a7c1259e]{display:flex;align-items:center;gap:8px;padding:6px 10px;font-size:12px}.picked-item+.picked-item[data-v-a7c1259e]{border-top:1px solid var(--atlas-stroke)}.picked-ico[data-v-a7c1259e]{color:var(--atlas-muted);flex-shrink:0}.picked-name[data-v-a7c1259e]{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.picked-size[data-v-a7c1259e]{flex-shrink:0}.upload-row[data-v-a7c1259e]{display:flex;align-items:center;gap:12px;margin-top:10px;flex-wrap:wrap}.filter-bar[data-v-a7c1259e]{display:flex;align-items:center;gap:8px;margin-bottom:12px;flex-wrap:wrap}.spacer[data-v-a7c1259e]{flex:1}.search[data-v-a7c1259e]{width:200px}.name-cell[data-v-a7c1259e]{display:flex;align-items:center;gap:6px;min-width:0;flex-wrap:wrap}.name-cell .main[data-v-a7c1259e]{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dir-icon[data-v-a7c1259e]{color:var(--atlas-warning)}.file-icon[data-v-a7c1259e]{color:var(--atlas-muted)}.desc[data-v-a7c1259e]{font-size:12px;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:420px}.token-cell[data-v-a7c1259e]{display:flex;align-items:center;gap:4px}.file-list[data-v-a7c1259e]{max-height:260px;overflow:auto}.file-item[data-v-a7c1259e]{display:flex;gap:8px;font-size:12px;padding:3px 0;align-items:baseline}.f-name[data-v-a7c1259e]{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}.f-size[data-v-a7c1259e]{width:64px;text-align:right;flex-shrink:0}.f-sha[data-v-a7c1259e]{width:60px;flex-shrink:0}.muted[data-v-a7c1259e]{color:var(--atlas-muted)}@media (max-width: 640px){.search[data-v-a7c1259e]{width:100%;order:-1}.spacer[data-v-a7c1259e]{display:none}.upload-row[data-v-a7c1259e]{gap:8px}.upload-row .el-input[data-v-a7c1259e]{flex:1 1 100%}.upload-row .el-input[style*=\"260\"][data-v-a7c1259e],.upload-row .el-input[style*=\"160\"][data-v-a7c1259e]{width:100%!important}.picked-item .el-button[data-v-a7c1259e]{flex-shrink:0}}\n";document.head.appendChild(s)})();import { ref as f, computed as P, onMounted as me, resolveComponent as r, resolveDirective as fe, openBlock as i, createElementBlock as _, createElementVNode as d, createVNode as a, withCtx as n, createTextVNode as s, toDisplayString as o, createCommentVNode as T, unref as p, Fragment as S, renderList as A, createBlock as h, withDirectives as _e, createApp as ve } from "vue";
import ye, { ElMessage as b, ElMessageBox as ge } from "element-plus";
import { Upload as K, Files as Z, Delete as j, Search as ke, Refresh as he, FolderOpened as be, CopyDocument as Ce, Download as we } from "@element-plus/icons-vue";
import { get as $e, post as G, del as ze } from "@atlas/runtime";
const xe = (C, $) => {
  const v = C.__vccOpts || C;
  for (const [w, z] of $)
    v[w] = z;
  return v;
}, De = { class: "surface" }, Ve = { class: "upload-box" }, Fe = {
  key: 0,
  class: "update-banner"
}, Ie = { class: "update-name" }, Te = {
  key: 1,
  class: "picked-list",
  "aria-label": "已选择的上传文件"
}, Ne = ["title"], Re = { class: "picked-size muted" }, Ee = { class: "upload-row" }, Be = { class: "filter-bar" }, Ue = { class: "name-cell" }, Oe = { class: "main" }, Se = { class: "file-list" }, Ae = ["title"], Le = { class: "f-size muted" }, Ye = ["title"], Me = {
  key: 0,
  class: "desc muted"
}, qe = {
  key: 0,
  class: "token-cell"
}, Pe = { class: "mono" }, Ke = {
  __name: "App",
  props: { appId: { type: Number, required: !0 } },
  setup(C) {
    const $ = C, v = f([]), w = f(!1), z = f(""), x = f("default"), D = f(""), y = f([]), B = f(!1), U = f(""), V = f(""), m = f(null), N = () => `/api/apps/${$.appId}/plugins/model-files/ep`, H = P(() => ["全部", ...[...new Set(v.value.map((e) => e.category))].sort()]), J = P(() => {
      const e = U.value.trim().toLowerCase();
      return v.value.filter((t) => V.value && V.value !== "全部" && t.category !== V.value ? !1 : e ? t.name.toLowerCase().includes(e) || (t.description || "").toLowerCase().includes(e) : !0);
    });
    let R = 0;
    async function F() {
      const e = ++R;
      w.value = !0;
      try {
        const t = await $e(N() + "/list");
        if (e !== R) return;
        t.value = t, z.value = "";
      } catch (t) {
        e === R && (z.value = (t == null ? void 0 : t.message) || "加载失败，请刷新重试");
      } finally {
        e === R && (w.value = !1);
      }
    }
    me(F);
    function Q(e, t) {
      y.value = (t ?? []).filter((u) => u.status === "ready" && u.raw);
    }
    function W(e) {
      y.value = y.value.filter((t, u) => u !== e);
    }
    function X(e) {
      return e == null ? "" : new Intl.NumberFormat("zh-CN", { style: "unit", unit: "byte", notation: "compact", maximumFractionDigits: 1 }).format(e);
    }
    function ee(e) {
      m.value = e, x.value = e.category, D.value = e.description || "", y.value = [];
    }
    function L() {
      m.value = null, x.value = "default", D.value = "", y.value = [];
    }
    async function te() {
      if (!y.value.length) {
        b.warning("请选择文件");
        return;
      }
      B.value = !0;
      try {
        const e = new FormData();
        e.append("category", x.value), e.append("description", D.value), m.value && e.append("updateId", String(m.value.id));
        for (const u of y.value)
          e.append("files", u.raw, u.name);
        const t = await G(N() + "/upload", e);
        b.success(m.value ? `「${m.value.name}」已更新为 v${t.version}` : "上传成功"), L(), await F();
      } finally {
        B.value = !1;
      }
    }
    async function le(e) {
      const t = e.kind === "DIRECTORY" ? `${e.name}（${e.fileCount} 个文件）` : e.name;
      try {
        await ge.confirm(`确认删除「${t}」？删除后公开链接失效，不可恢复。`, "删除模型文件", { type: "error" }), await ze(`${N()}/delete/${e.id}`), await F(), b.success("已删除");
      } catch {
      }
    }
    async function Y(e) {
      if (e.token) return e.token;
      if (e.kind === "DIRECTORY")
        return b.warning("目录（多文件）不支持公开下载链接"), null;
      const t = await G(`${N()}/publish/${e.id}`);
      return b.success("已生成公开链接"), await F(), t.token;
    }
    async function ae(e) {
      const t = await Y(e);
      t && window.open(`/api/files/${t}/download`, "_blank");
    }
    async function ne(e) {
      const t = await Y(e);
      if (t)
        try {
          await navigator.clipboard.writeText(`${location.origin}/api/files/${t}/download`), b.success("下载链接已复制");
        } catch {
          b.warning("复制失败，请手动复制 token");
        }
    }
    const M = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 1 });
    function q(e) {
      return e == null ? "—" : e >= 1048576 ? `${M.format(e / 1048576)} MB` : e >= 1024 ? `${M.format(e / 1024)} KB` : `${e} B`;
    }
    const oe = new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: !1 });
    function ie(e) {
      if (!e) return "—";
      const t = e.includes("T") ? e : `${e.replace(" ", "T")}Z`, u = new Date(t);
      return Number.isNaN(u.getTime()) ? e : oe.format(u);
    }
    return (e, t) => {
      const u = r("el-tag"), g = r("el-button"), E = r("el-icon"), se = r("el-upload"), I = r("el-tooltip"), O = r("el-input"), ue = r("el-radio-button"), de = r("el-radio-group"), ce = r("el-popover"), k = r("el-table-column"), re = r("el-table"), pe = fe("loading");
      return i(), _("div", De, [
        d("div", Ve, [
          m.value ? (i(), _("div", Fe, [
            a(u, {
              type: "warning",
              size: "small",
              effect: "dark"
            }, {
              default: n(() => [...t[4] || (t[4] = [
                s("更新模式", -1)
              ])]),
              _: 1
            }),
            d("span", Ie, "正在更新「" + o(m.value.name) + "」（v" + o(m.value.version) + "），上传文件将替换全部内容", 1),
            a(g, {
              size: "small",
              text: "",
              type: "info",
              onClick: L
            }, {
              default: n(() => [...t[5] || (t[5] = [
                s("取消更新", -1)
              ])]),
              _: 1
            })
          ])) : T("", !0),
          a(se, {
            drag: "",
            multiple: "",
            "auto-upload": !1,
            "show-file-list": !1,
            "on-change": Q,
            class: "dropzone"
          }, {
            default: n(() => [
              a(E, { class: "el-icon--upload" }, {
                default: n(() => [
                  a(p(K))
                ]),
                _: 1
              }),
              t[6] || (t[6] = d("div", { class: "el-upload__text" }, [
                s("拖拽文件到此处，或"),
                d("em", null, "点击选择"),
                s("（多选 = 目录形式）")
              ], -1))
            ]),
            _: 1
          }),
          y.value.length ? (i(), _("ul", Te, [
            (i(!0), _(S, null, A(y.value, (l, c) => (i(), _("li", {
              key: `${l.name}-${c}`,
              class: "picked-item"
            }, [
              a(E, { class: "picked-ico" }, {
                default: n(() => [
                  a(p(Z))
                ]),
                _: 1
              }),
              d("span", {
                class: "picked-name",
                title: l.name
              }, o(l.name || "(未命名文件)"), 9, Ne),
              d("span", Re, o(X(l.size)), 1),
              a(I, {
                content: `移除 ${l.name || "未命名文件"}`,
                placement: "top"
              }, {
                default: n(() => [
                  a(g, {
                    size: "small",
                    text: "",
                    type: "danger",
                    icon: p(j),
                    "aria-label": `移除 ${l.name || "未命名文件"}`,
                    onClick: (je) => W(c)
                  }, null, 8, ["icon", "aria-label", "onClick"])
                ]),
                _: 2
              }, 1032, ["content"])
            ]))), 128))
          ])) : T("", !0),
          d("div", Ee, [
            a(O, {
              modelValue: x.value,
              "onUpdate:modelValue": t[0] || (t[0] = (l) => x.value = l),
              name: "file-category",
              autocomplete: "off",
              placeholder: "分类（default）",
              style: { width: "160px" }
            }, null, 8, ["modelValue"]),
            a(O, {
              modelValue: D.value,
              "onUpdate:modelValue": t[1] || (t[1] = (l) => D.value = l),
              name: "file-desc",
              autocomplete: "off",
              placeholder: "描述（可选）",
              style: { width: "260px" }
            }, null, 8, ["modelValue"]),
            a(g, {
              type: "primary",
              loading: B.value,
              onClick: te
            }, {
              default: n(() => [
                s(o(m.value ? "更新文件" : "上传"), 1)
              ]),
              _: 1
            }, 8, ["loading"])
          ])
        ]),
        d("div", Be, [
          a(de, {
            modelValue: V.value,
            "onUpdate:modelValue": t[2] || (t[2] = (l) => V.value = l),
            size: "small"
          }, {
            default: n(() => [
              (i(!0), _(S, null, A(H.value, (l) => (i(), h(ue, {
                key: l,
                value: l
              }, {
                default: n(() => [
                  s(o(l), 1)
                ]),
                _: 2
              }, 1032, ["value"]))), 128))
            ]),
            _: 1
          }, 8, ["modelValue"]),
          t[7] || (t[7] = d("div", { class: "spacer" }, null, -1)),
          a(O, {
            modelValue: U.value,
            "onUpdate:modelValue": t[3] || (t[3] = (l) => U.value = l),
            class: "search",
            "prefix-icon": p(ke),
            placeholder: "搜索名称 / 描述…",
            clearable: ""
          }, null, 8, ["modelValue", "prefix-icon"]),
          a(g, {
            icon: p(he),
            size: "small",
            circle: "",
            "aria-label": "刷新列表",
            loading: w.value,
            onClick: F
          }, null, 8, ["icon", "loading"])
        ]),
        _e((i(), h(re, {
          data: J.value,
          "empty-text": z.value || "暂无模型文件"
        }, {
          default: n(() => [
            a(k, {
              label: "名称",
              "min-width": "170"
            }, {
              default: n(({ row: l }) => [
                d("div", Ue, [
                  l.kind === "DIRECTORY" ? (i(), h(E, {
                    key: 0,
                    class: "dir-icon",
                    "aria-hidden": "true"
                  }, {
                    default: n(() => [
                      a(p(be))
                    ]),
                    _: 1
                  })) : (i(), h(E, {
                    key: 1,
                    class: "file-icon",
                    "aria-hidden": "true"
                  }, {
                    default: n(() => [
                      a(p(Z))
                    ]),
                    _: 1
                  })),
                  d("span", Oe, o(l.name), 1),
                  l.fileCount > 1 ? (i(), h(u, {
                    key: 2,
                    size: "small",
                    type: "warning",
                    effect: "plain"
                  }, {
                    default: n(() => [
                      s(o(l.fileCount) + " 文件", 1)
                    ]),
                    _: 2
                  }, 1024)) : T("", !0),
                  l.fileCount > 1 ? (i(), h(ce, {
                    key: 3,
                    placement: "right",
                    width: "320",
                    trigger: "hover"
                  }, {
                    reference: n(() => [
                      a(g, {
                        size: "small",
                        text: "",
                        type: "primary"
                      }, {
                        default: n(() => [...t[8] || (t[8] = [
                          s("查看清单", -1)
                        ])]),
                        _: 1
                      })
                    ]),
                    default: n(() => [
                      d("div", Se, [
                        (i(!0), _(S, null, A(l.files, (c) => (i(), _("div", {
                          key: c.path,
                          class: "file-item"
                        }, [
                          d("span", {
                            class: "f-name",
                            title: c.path
                          }, o(c.path), 9, Ae),
                          d("span", Le, o(q(c.sizeBytes)), 1),
                          d("span", {
                            class: "f-sha muted",
                            title: c.checksum
                          }, o(c.checksum.slice(0, 8)), 9, Ye)
                        ]))), 128))
                      ])
                    ]),
                    _: 2
                  }, 1024)) : T("", !0)
                ]),
                l.description ? (i(), _("div", Me, o(l.description), 1)) : T("", !0)
              ]),
              _: 1
            }),
            a(k, {
              label: "分类",
              width: "90"
            }, {
              default: n(({ row: l }) => [
                a(u, {
                  size: "small",
                  effect: "plain"
                }, {
                  default: n(() => [
                    s(o(l.category), 1)
                  ]),
                  _: 2
                }, 1024)
              ]),
              _: 1
            }),
            a(k, {
              label: "大小",
              width: "90",
              align: "right"
            }, {
              default: n(({ row: l }) => [
                s(o(q(l.totalSize)), 1)
              ]),
              _: 1
            }),
            a(k, {
              label: "版本",
              width: "70",
              align: "center"
            }, {
              default: n(({ row: l }) => [
                a(u, {
                  size: "small",
                  type: "warning",
                  effect: "plain"
                }, {
                  default: n(() => [
                    s("v" + o(l.version), 1)
                  ]),
                  _: 2
                }, 1024)
              ]),
              _: 1
            }),
            a(k, {
              label: "下载",
              width: "70",
              align: "center"
            }, {
              default: n(({ row: l }) => [
                s(o(l.downloadCount), 1)
              ]),
              _: 1
            }),
            a(k, {
              label: "公开链接",
              "min-width": "150"
            }, {
              default: n(({ row: l }) => [
                l.token ? (i(), _("div", qe, [
                  d("code", Pe, o(l.token.slice(0, 12)) + "…", 1),
                  a(I, {
                    content: "复制公开下载链接",
                    placement: "top"
                  }, {
                    default: n(() => [
                      a(g, {
                        size: "small",
                        text: "",
                        type: "primary",
                        icon: p(Ce),
                        "aria-label": "复制公开下载链接",
                        onClick: (c) => ne(l)
                      }, null, 8, ["icon", "onClick"])
                    ]),
                    _: 2
                  }, 1024)
                ])) : (i(), h(u, {
                  key: 1,
                  size: "small",
                  type: "info",
                  effect: "plain"
                }, {
                  default: n(() => [...t[9] || (t[9] = [
                    s("未托管", -1)
                  ])]),
                  _: 1
                }))
              ]),
              _: 1
            }),
            a(k, {
              label: "更新时间",
              width: "140"
            }, {
              default: n(({ row: l }) => [
                s(o(ie(l.updatedAt)), 1)
              ]),
              _: 1
            }),
            a(k, {
              label: "操作",
              width: "220",
              fixed: "right"
            }, {
              default: n(({ row: l }) => [
                a(I, {
                  content: "上传新版本替换全部内容",
                  placement: "top"
                }, {
                  default: n(() => [
                    a(g, {
                      size: "small",
                      icon: p(K),
                      "aria-label": "更新文件",
                      onClick: (c) => ee(l)
                    }, {
                      default: n(() => [...t[10] || (t[10] = [
                        s("更新", -1)
                      ])]),
                      _: 1
                    }, 8, ["icon", "onClick"])
                  ]),
                  _: 2
                }, 1024),
                a(I, {
                  content: l.kind === "DIRECTORY" && !l.token ? "目录（多文件）不支持公开下载" : "下载到本地",
                  placement: "top"
                }, {
                  default: n(() => [
                    a(g, {
                      size: "small",
                      type: "primary",
                      plain: "",
                      icon: p(we),
                      "aria-label": "下载文件",
                      disabled: l.kind === "DIRECTORY" && !l.token,
                      onClick: (c) => ae(l)
                    }, {
                      default: n(() => [...t[11] || (t[11] = [
                        s("下载", -1)
                      ])]),
                      _: 1
                    }, 8, ["icon", "disabled", "onClick"])
                  ]),
                  _: 2
                }, 1032, ["content"]),
                a(I, {
                  content: "删除后公开链接失效，不可恢复",
                  placement: "top"
                }, {
                  default: n(() => [
                    a(g, {
                      size: "small",
                      type: "danger",
                      plain: "",
                      icon: p(j),
                      "aria-label": "删除文件",
                      onClick: (c) => le(l)
                    }, {
                      default: n(() => [...t[12] || (t[12] = [
                        s("删除", -1)
                      ])]),
                      _: 1
                    }, 8, ["icon", "onClick"])
                  ]),
                  _: 2
                }, 1024)
              ]),
              _: 1
            })
          ]),
          _: 1
        }, 8, ["data", "empty-text"])), [
          [pe, w.value]
        ])
      ]);
    };
  }
}, Ze = /* @__PURE__ */ xe(Ke, [["__scopeId", "data-v-a7c1259e"]]), We = {
  mount(C, $) {
    const v = ve(Ze, { appId: $.appId });
    return v.use(ye), v.mount(C), () => v.unmount();
  }
};
export {
  We as default
};
