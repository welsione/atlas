package cn.aibase.security;

import cn.aibase.common.ApiResponse;
import cn.aibase.common.ValidationException;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 管理认证端点：登录签发 token、认证状态查询。
 */
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final RateLimiter rateLimiter;

    /** 登录：校验管理密码，签发 12 小时有效 token。 */
    @PostMapping("/login")
    public ApiResponse<Map<String, String>> login(@RequestBody Map<String, String> body, HttpServletRequest request) {
        String ip = clientIp(request);
        if (!rateLimiter.allowLoginAttempt(ip)) {
            throw new ValidationException("login", "登录尝试过于频繁，请 1 分钟后再试");
        }
        if (!authService.authEnabled() || authService.verifyPassword(body.get("password"))) {
            return ApiResponse.ok(Map.of("token", authService.issueToken()));
        }
        throw new ValidationException("password", "管理密码错误");
    }

    /** 认证状态：返回鉴权是否启用（前端据此决定是否显示登录）。 */
    @GetMapping("/status")
    public ApiResponse<Map<String, Boolean>> status() {
        return ApiResponse.ok(Map.of("authEnabled", authService.authEnabled()));
    }

    private String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            int comma = forwarded.indexOf(',');
            return (comma > 0 ? forwarded.substring(0, comma) : forwarded).trim();
        }
        return request.getRemoteAddr();
    }
}
