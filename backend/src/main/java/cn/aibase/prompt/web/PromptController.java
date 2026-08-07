package cn.aibase.prompt.web;

import cn.aibase.common.ApiResponse;
import cn.aibase.prompt.application.PromptRequest;
import cn.aibase.prompt.application.PromptService;
import cn.aibase.prompt.domain.Prompt;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * 提示词管理端点。
 */
@RestController
@RequestMapping("/api/prompts")
@RequiredArgsConstructor
public class PromptController {

    private final PromptService service;

    @GetMapping
    public ApiResponse<List<Prompt>> list() {
        return ApiResponse.ok(service.list());
    }

    @GetMapping("/categories")
    public ApiResponse<List<String>> categories() {
        return ApiResponse.ok(service.categories());
    }

    @GetMapping("/{id}")
    public ApiResponse<Prompt> get(@PathVariable Long id) {
        return ApiResponse.ok(service.get(id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<Prompt> create(@Valid @RequestBody PromptRequest request) {
        return ApiResponse.ok(service.create(request));
    }

    @PutMapping("/{id}")
    public ApiResponse<Prompt> update(@PathVariable Long id, @Valid @RequestBody PromptRequest request) {
        return ApiResponse.ok(service.update(id, request));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public ApiResponse<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ApiResponse.ok();
    }

    /** 渲染提示词：{{变量}} 替换 + 插件管道。 */
    @PostMapping("/{id}/render")
    public ApiResponse<PromptService.RenderResult> render(@PathVariable Long id, @RequestBody PromptRequest.RenderRequest request) {
        return ApiResponse.ok(service.render(id, request.getVariables()));
    }

    @GetMapping("/{id}/versions")
    public ApiResponse<List<Map<String, Object>>> versions(@PathVariable Long id) {
        return ApiResponse.ok(service.versionHistory(id));
    }
}
