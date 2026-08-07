package cn.aibase.modelfile.web;

import cn.aibase.modelfile.application.ModelFileService;
import cn.aibase.modelfile.domain.ModelFile;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import java.nio.charset.StandardCharsets;

/**
 * 公开固定下载端点：{@code /api/files/{token}/download}。
 *
 * <p>token 为创建时生成的 32 字节随机凭证（防穷举），链接固定不变，可复制长期使用；
 * 删除条目后链接失效。本控制器无类级路径前缀，保证 URL 与文档一致。</p>
 */
@RestController
@RequiredArgsConstructor
public class FileDownloadController {

    private final ModelFileService service;

    @GetMapping("/api/files/{token}/download")
    public ResponseEntity<StreamingResponseBody> downloadByToken(@PathVariable String token) {
        ModelFile entry = service.getByToken(token);
        String fileName = service.downloadFileName(entry);
        String encoded = new String(fileName.getBytes(StandardCharsets.UTF_8), StandardCharsets.ISO_8859_1);
        String disposition = "attachment; filename*=UTF-8''" + urlEncode(fileName) + "; filename=\"" + encoded + "\"";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition)
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(out -> service.download(entry.getId(), out));
    }

    private String urlEncode(String value) {
        return java.net.URLEncoder.encode(value, StandardCharsets.UTF_8).replace("+", "%20");
    }
}
