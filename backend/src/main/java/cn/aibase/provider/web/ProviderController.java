package cn.aibase.provider.web;

import cn.aibase.common.ApiResponse;
import cn.aibase.plugin.ProviderAdapter;
import cn.aibase.provider.application.ProviderService;
import cn.aibase.provider.domain.Provider;
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

/**
 * 供应商管理端点。
 */
@RestController
@RequestMapping("/api/providers")
@RequiredArgsConstructor
public class ProviderController {

    private final ProviderService service;

    @GetMapping
    public ApiResponse<List<ProviderResponse>> list() {
        return ApiResponse.ok(service.list().stream().map(ProviderResponse::of).toList());
    }

    @GetMapping("/types")
    public ApiResponse<List<String>> types() {
        return ApiResponse.ok(service.supportedTypes());
    }

    @GetMapping("/{id}")
    public ApiResponse<ProviderResponse> get(@PathVariable Long id) {
        return ApiResponse.ok(ProviderResponse.of(service.get(id)));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<ProviderResponse> create(@Valid @RequestBody ProviderRequest request) {
        return ApiResponse.ok(ProviderResponse.of(service.create(request)));
    }

    @PutMapping("/{id}")
    public ApiResponse<ProviderResponse> update(@PathVariable Long id, @Valid @RequestBody ProviderRequest request) {
        return ApiResponse.ok(ProviderResponse.of(service.update(id, request)));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public ApiResponse<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ApiResponse.ok();
    }

    @PostMapping("/{id}/test")
    public ApiResponse<ProviderAdapter.ConnectionTestResult> test(@PathVariable Long id) {
        return ApiResponse.ok(service.test(id));
    }

    /** 测试未保存的表单配置（新增供应商抽屉内"测试连接"）。 */
    @PostMapping("/test")
    public ApiResponse<ProviderAdapter.ConnectionTestResult> testConfig(@Valid @RequestBody ProviderRequest request) {
        return ApiResponse.ok(service.testConfig(request));
    }

    @PutMapping("/{id}/default")
    public ApiResponse<ProviderResponse> setDefault(@PathVariable Long id) {
        return ApiResponse.ok(ProviderResponse.of(service.setDefault(id)));
    }

    @PutMapping("/{id}/enabled")
    public ApiResponse<ProviderResponse> updateEnabled(@PathVariable Long id, @RequestBody EnabledRequest request) {
        return ApiResponse.ok(ProviderResponse.of(service.updateEnabled(id, request.enabled())));
    }

    public record EnabledRequest(boolean enabled) {
    }
}
