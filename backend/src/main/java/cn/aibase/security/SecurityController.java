package cn.aibase.security;

import cn.aibase.common.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * 安全设置与 IP 黑名单管理端点（管理认证保护）。
 */
@RestController
@RequestMapping("/api/security")
@RequiredArgsConstructor
public class SecurityController {

    private final SecuritySettingsService settingsService;
    private final IpRuleService ipRuleService;

    /** 限流设置项清单（含当前值与说明）。 */
    @GetMapping("/settings")
    public ApiResponse<List<Map<String, String>>> settings() {
        SecuritySettings current = settingsService.get();
        return ApiResponse.ok(settingsService.metas().stream()
                .map(meta -> Map.of(
                        "key", meta.key(),
                        "label", meta.label(),
                        "value", current.getValues().getOrDefault(meta.key(), ""),
                        "hint", meta.hint()))
                .toList());
    }

    /** 更新限流设置（持久化）。 */
    @PostMapping("/settings")
    public ApiResponse<Void> updateSetting(@RequestBody Map<String, String> body) {
        settingsService.update(body.get("key"), body.get("value"));
        return ApiResponse.ok();
    }

    /** 黑名单列表。 */
    @GetMapping("/blocked-ips")
    public ApiResponse<List<Map<String, Object>>> blockedIps() {
        return ApiResponse.ok(ipRuleService.list());
    }

    /** 手动添加黑名单。 */
    @PostMapping("/blocked-ips")
    public ApiResponse<Void> block(@RequestParam String ip, @RequestParam(value = "reason", defaultValue = "") String reason) {
        ipRuleService.block(ip, reason);
        return ApiResponse.ok();
    }

    /** 解封。 */
    @PostMapping("/blocked-ips/delete")
    public ApiResponse<Void> unblock(@RequestParam String ip) {
        ipRuleService.unblock(ip);
        return ApiResponse.ok();
    }
}
