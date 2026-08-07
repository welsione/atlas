package cn.aibase.modelfile.web;

import cn.aibase.common.ApiResponse;
import cn.aibase.modelfile.application.MonitorService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 控制台监控端点：传输流量统计、服务器运行数据、Top 排行。
 */
@RestController
@RequestMapping("/api/monitor")
@RequiredArgsConstructor
public class MonitorController {

    private final MonitorService service;

    /** 传输流量：range=24h（按小时）/7d（按天）/all（按天）。 */
    @GetMapping("/stats")
    public ApiResponse<MonitorService.TransferStats> stats(
            @RequestParam(value = "range", defaultValue = "24h") String range) {
        return ApiResponse.ok(service.stats(range));
    }

    /** 服务器运行数据：JVM 内存/线程/时长、CPU、系统内存、磁盘、存储统计。 */
    @GetMapping("/overview")
    public ApiResponse<MonitorService.ServerOverview> overview() {
        return ApiResponse.ok(service.overview());
    }

    /** Top 排行：文件 + IP。 */
    @GetMapping("/top")
    public ApiResponse<MonitorService.TopStats> top(
            @RequestParam(value = "range", defaultValue = "24h") String range,
            @RequestParam(value = "limit", defaultValue = "10") int limit) {
        return ApiResponse.ok(service.top(range, limit));
    }
}
