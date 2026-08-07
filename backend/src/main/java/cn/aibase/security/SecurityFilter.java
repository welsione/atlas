package cn.aibase.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

/**
 * 统一安全过滤器：
 * <ul>
 *   <li>IP 黑名单：命中返回 403（覆盖全部 /api/** 请求，含公开下载）</li>
 *   <li>管理认证：非公开端点需 Bearer token 或 X-AIBase-Key（未配置密钥时放行本地开发）</li>
 *   <li>安全响应头：nosniff / X-Frame-Options</li>
 * </ul>
 */
@Slf4j
@Component
@Order(1)
@RequiredArgsConstructor
public class SecurityFilter extends OncePerRequestFilter {

    private static final String PUBLIC_PREFIX = "/api/files/";
    private static final String AUTH_PREFIX = "/api/auth/";

    private final IpRuleService ipRuleService;
    private final AuthService authService;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String path = request.getRequestURI();
        // 静态资源与非 /api 请求放行
        if (!path.startsWith("/api/")) {
            chain.doFilter(request, response);
            return;
        }

        // 安全响应头
        response.setHeader("X-Content-Type-Options", "nosniff");
        response.setHeader("X-Frame-Options", "DENY");

        // 1) IP 黑名单
        String ip = clientIp(request);
        if (ipRuleService.isBlocked(ip)) {
            log.warn("黑名单 IP 访问被拒：{} {}", ip, path);
            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
            writeJson(response, "该 IP 已被禁止访问");
            return;
        }

        // 2) 管理认证（公开端点放行）
        if (!path.startsWith(PUBLIC_PREFIX) && !path.startsWith(AUTH_PREFIX) && authService.authEnabled()) {
            if (!authenticated(request)) {
                response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                writeJson(response, "未认证：请先登录或携带管理 Token");
                return;
            }
        }

        chain.doFilter(request, response);
    }

    /** Bearer token 或 X-AIBase-Key 任一通过即可。 */
    private boolean authenticated(HttpServletRequest request) {
        String authorization = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (authorization != null && authorization.startsWith("Bearer ")) {
            if (authService.verifyToken(authorization.substring(7).trim())) {
                return true;
            }
        }
        return authService.verifyAdminKey(request.getHeader("X-AIBase-Key"));
    }

    /** 真实客户端 IP：优先 X-Forwarded-For（nginx 反代场景）。 */
    private String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            int comma = forwarded.indexOf(',');
            return (comma > 0 ? forwarded.substring(0, comma) : forwarded).trim();
        }
        return request.getRemoteAddr();
    }

    private void writeJson(HttpServletResponse response, String message) throws IOException {
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.getWriter().write("{\"code\":" + response.getStatus() + ",\"message\":\"" + message + "\",\"data\":null}");
    }
}
