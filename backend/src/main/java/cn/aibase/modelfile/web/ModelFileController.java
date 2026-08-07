package cn.aibase.modelfile.web;

import cn.aibase.common.ApiResponse;
import cn.aibase.modelfile.application.ModelFileService;
import cn.aibase.modelfile.domain.ModelFile;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import java.nio.charset.StandardCharsets;
import java.util.List;

/**
 * 模型文件端点：上传（多文件/zip 解压）、列表、下载（目录打包 zip、流式）、删除。
 */
@RestController
@RequestMapping("/api/model-files")
@RequiredArgsConstructor
public class ModelFileController {

    private final ModelFileService service;

    @GetMapping
    public ApiResponse<List<ModelFile>> list() {
        return ApiResponse.ok(service.list());
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<ModelFile> upload(
            @RequestParam(value = "category", defaultValue = "default") String category,
            @RequestParam(value = "description", defaultValue = "") String description,
            @RequestParam(value = "token", required = false) String updateToken,
            @RequestParam("files") List<MultipartFile> files,
            HttpServletRequest request) {
        ModelFile entry = service.upload(category, description, files, updateToken);
        // 上传/更新事件入审计表，供控制台流量统计
        String forwarded = request.getHeader("X-Forwarded-For");
        service.recordUpload(entry, forwarded != null && !forwarded.isBlank() ? forwarded : request.getRemoteAddr(),
                request.getHeader(HttpHeaders.USER_AGENT));
        return ApiResponse.ok(entry);
    }

    /** 条目下载日志（管理端，按 token 鉴权场景由前端列表接口提供 id）。 */
    @GetMapping("/{id}/download-logs")
    public ApiResponse<List<java.util.Map<String, Object>>> downloadLogs(
            @PathVariable Long id,
            @RequestParam(value = "limit", defaultValue = "100") int limit) {
        return ApiResponse.ok(service.downloadLogs(id, Math.min(limit, 500)));
    }

    /** 下载：单文件直接输出；目录实时打包 zip 流式输出（支持 GB 级）。 */
    @GetMapping("/{id}/download")
    public ResponseEntity<StreamingResponseBody> download(@PathVariable Long id) {
        ModelFile entry = service.get(id);
        return streamDownload(entry);
    }

    private ResponseEntity<StreamingResponseBody> streamDownload(ModelFile entry) {
        String fileName = service.downloadFileName(entry);
        String encoded = new String(fileName.getBytes(StandardCharsets.UTF_8), StandardCharsets.ISO_8859_1);
        String disposition = "attachment; filename*=UTF-8''" + urlEncode(fileName) + "; filename=\"" + encoded + "\"";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition)
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(out -> service.download(entry.getId(), out));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ApiResponse.ok();
    }

    private String urlEncode(String value) {
        return java.net.URLEncoder.encode(value, StandardCharsets.UTF_8).replace("+", "%20");
    }
}
