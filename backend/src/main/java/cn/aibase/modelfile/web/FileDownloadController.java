package cn.aibase.modelfile.web;

import cn.aibase.common.ApiResponse;
import cn.aibase.modelfile.application.ModelFileService;
import cn.aibase.modelfile.domain.ModelFile;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import java.nio.charset.StandardCharsets;

/**
 * 公开文件端点：{@code /api/files/{token}/...}
 *
 * <p>token 为创建时生成的 32 字节随机凭证（防穷举），链接固定不变；
 * 下载行为全量审计（IP/UA/时间）并按 IP 限流；meta 接口供业务侧
 * 轻量校验版本/哈希，一致时通过 If-None-Match 返回 304 跳过下载。</p>
 */
@RestController
@RequiredArgsConstructor
public class FileDownloadController {

    private final ModelFileService service;

    /**
     * 下载元数据：version + contentHash + size + downloadCount。
     * 客户端先查此接口判断"是否更新"。
     */
    @GetMapping("/api/files/{token}/meta")
    public ApiResponse<ModelFileService.ModelMeta> meta(@PathVariable String token) {
        return ApiResponse.ok(service.meta(token));
    }

    /**
     * 下载：支持条件请求跳过下载——
     * 客户端携带上次的 contentHash（If-None-Match 头或 ?hash= 参数），
     * 内容未变化返回 304 Not Modified，只有更新才下载文件体。
     */
    @GetMapping("/api/files/{token}/download")
    public ResponseEntity<StreamingResponseBody> downloadByToken(
            @PathVariable String token,
            @org.springframework.web.bind.annotation.RequestParam(value = "hash", required = false) String queryHash,
            HttpServletRequest request) {
        ModelFile entry = service.getByToken(token);
        String etag = "\"" + entry.getContentHash() + "\"";

        String ifNoneMatch = request.getHeader(HttpHeaders.IF_NONE_MATCH);
        boolean unchanged = (ifNoneMatch != null && ifNoneMatch.trim().equals(etag))
                || (queryHash != null && queryHash.trim().equals(entry.getContentHash()));
        if (unchanged) {
            return ResponseEntity.status(HttpStatus.NOT_MODIFIED).build();
        }

        boolean allowed = service.recordDownload(entry, clientIp(request), request.getHeader(HttpHeaders.USER_AGENT));
        if (!allowed) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .header(HttpHeaders.RETRY_AFTER, "60")
                    .build();
        }

        String fileName = service.downloadFileName(entry);
        String encoded = new String(fileName.getBytes(StandardCharsets.UTF_8), StandardCharsets.ISO_8859_1);
        String disposition = "attachment; filename*=UTF-8''" + urlEncode(fileName) + "; filename=\"" + encoded + "\"";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition)
                .header(HttpHeaders.ETAG, etag)
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(out -> service.download(entry.getId(), out));
    }

    /** 真实客户端 IP：优先 X-Forwarded-For（nginx 反代场景）。 */
    private String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded;
        }
        return request.getRemoteAddr();
    }

    private String urlEncode(String value) {
        return java.net.URLEncoder.encode(value, StandardCharsets.UTF_8).replace("+", "%20");
    }
}
