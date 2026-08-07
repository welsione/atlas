package cn.aibase.modelfile.application;

import cn.aibase.common.ValidationException;
import cn.aibase.config.AIBaseProperties;
import cn.aibase.modelfile.infrastructure.ModelFileJdbcRepository;
import com.sun.management.OperatingSystemMXBean;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.File;
import java.lang.management.ManagementFactory;
import java.lang.management.MemoryMXBean;
import java.lang.management.MemoryUsage;
import java.lang.management.ThreadMXBean;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 控制台监控服务：传输流量统计（上传/下载字节、时间序列、Top 排行）与服务器运行数据。
 *
 * <p>流量数据来自 download_logs / upload_logs 审计表；服务器数据来自 JVM MXBean
 * 与文件系统（数据目录所在盘），无需外部监控组件。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MonitorService {

    private static final DateTimeFormatter TS = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final String DOWNLOAD_TABLE = "download_logs";
    private static final String UPLOAD_TABLE = "upload_logs";

    private final ModelFileJdbcRepository repository;
    private final AIBaseProperties properties;

    /**
     * 传输流量统计（时间窗口 + 序列）。
     *
     * @param range 24h（按小时）/ 7d（按天）/ all（按天）
     */
    public TransferStats stats(String range) {
        LocalDateTime now = LocalDateTime.now();
        // 整点/整日对齐，保证 SQL 桶（按记录时间前缀）与 Java 序列桶标签一致；
        // 起点取"窗口-1"再含当前桶，避免边界漏掉最近时刻的数据
        String since;
        int bucketLen;
        int buckets;
        if ("7d".equals(range)) {
            since = now.minusDays(6).toLocalDate().atStartOfDay().format(TS);
            bucketLen = 10;
            buckets = 7;
        } else if ("all".equals(range)) {
            since = now.minusDays(89).toLocalDate().atStartOfDay().format(TS);
            bucketLen = 10;
            buckets = 90;
        } else {
            since = now.minusHours(23).withMinute(0).withSecond(0).withNano(0).format(TS);
            bucketLen = 13;
            buckets = 24;
        }

        Map<String, Object> up = repository.transferSummary(UPLOAD_TABLE, "uploaded_at", since).get(0);
        Map<String, Object> down = repository.transferSummary(DOWNLOAD_TABLE, "downloaded_at", since).get(0);

        List<Map<String, Object>> upSeries = repository.transferSeries(UPLOAD_TABLE, "uploaded_at", since, bucketLen);
        List<Map<String, Object>> downSeries = repository.transferSeries(DOWNLOAD_TABLE, "downloaded_at", since, bucketLen);

        return new TransferStats(
                toLong(up.get("totalBytes")), toLong(up.get("totalCount")),
                toLong(down.get("totalBytes")), toLong(down.get("totalCount")),
                mergeSeries(upSeries, downSeries, since, bucketLen, buckets));
    }

    /** 合并上传/下载序列并补零（保证时间轴连续）。 */
    private List<SeriesPoint> mergeSeries(List<Map<String, Object>> up, List<Map<String, Object>> down,
                                          String since, int bucketLen, int buckets) {
        Map<String, Map<String, Object>> upMap = toMap(up);
        Map<String, Map<String, Object>> downMap = toMap(down);
        List<SeriesPoint> result = new ArrayList<>();
        LocalDateTime cursor = LocalDateTime.parse(since, TS);
        DateTimeFormatter bucketTs = bucketLen == 10
                ? DateTimeFormatter.ofPattern("yyyy-MM-dd")
                : DateTimeFormatter.ofPattern("yyyy-MM-dd HH");
        for (int i = 0; i < buckets; i++) {
            String bucket = cursor.format(bucketTs);
            long upBytes = upMap.containsKey(bucket) ? toLong(upMap.get(bucket).get("totalBytes")) : 0;
            long downBytes = downMap.containsKey(bucket) ? toLong(downMap.get(bucket).get("totalBytes")) : 0;
            result.add(new SeriesPoint(bucket, upBytes, downBytes));
            cursor = bucketLen == 10 ? cursor.plusDays(1) : cursor.plusHours(1);
        }
        return result;
    }

    private Map<String, Map<String, Object>> toMap(List<Map<String, Object>> rows) {
        Map<String, Map<String, Object>> map = new HashMap<>();
        for (Map<String, Object> row : rows) {
            map.put(String.valueOf(row.get("bucket")), row);
        }
        return map;
    }

    /**
     * 服务器运行数据：JVM 内存/线程/运行时长、CPU、系统内存、磁盘、存储统计。
     */
    public ServerOverview overview() {
        Runtime runtime = Runtime.getRuntime();
        MemoryMXBean memoryBean = ManagementFactory.getMemoryMXBean();
        MemoryUsage heap = memoryBean.getHeapMemoryUsage();
        ThreadMXBean threadBean = ManagementFactory.getThreadMXBean();
        OperatingSystemMXBean osBean = ManagementFactory.getPlatformMXBean(OperatingSystemMXBean.class);

        Path dataDir = Path.of(properties.getDataDir()).toAbsolutePath().normalize();
        File dataRoot = dataDir.toFile();
        long dirSize = dataRoot.isDirectory() ? directorySize(dataDir) : 0;
        File dbFile = dataDir.resolve("aibase.db").toFile();
        Map<String, Object> fileSummary = repository.fileSummary();

        return new ServerOverview(
                runtime.availableProcessors(),
                Math.round(osBean.getSystemLoadAverage() * 100.0) / 100.0,
                Math.round(osBean.getProcessCpuLoad() * 10000.0) / 100.0,
                heap.getUsed(), heap.getMax(),
                runtime.totalMemory() - runtime.freeMemory(), runtime.maxMemory(),
                threadBean.getThreadCount(),
                ManagementFactory.getRuntimeMXBean().getUptime() / 1000,
                osBean.getTotalMemorySize(), osBean.getFreeMemorySize(),
                dataRoot.getTotalSpace(), dataRoot.getUsableSpace(),
                toLong(fileSummary.get("entryCount")), toLong(fileSummary.get("totalBytes")),
                dirSize, dbFile.exists() ? dbFile.length() : 0);
    }

    /**
     * Top 排行：文件（按传输次数）+ IP。
     */
    public TopStats top(String range, int limit) {
        String since = switch (range == null ? "24h" : range) {
            case "7d" -> LocalDateTime.now().minusDays(7).format(TS);
            case "all" -> "1970-01-01 00:00:00";
            default -> LocalDateTime.now().minusHours(24).format(TS);
        };
        int capped = Math.min(Math.max(limit, 1), 50);
        return new TopStats(
                repository.transferTopFiles(DOWNLOAD_TABLE, "downloaded_at", since, capped),
                repository.transferTopIps(DOWNLOAD_TABLE, "downloaded_at", since, capped),
                repository.transferTopFiles(UPLOAD_TABLE, "uploaded_at", since, capped));
    }

    /** 数据目录占用（递归）。 */
    private long directorySize(Path dir) {
        try (var walk = Files.walk(dir)) {
            return walk.filter(Files::isRegularFile)
                    .mapToLong(p -> {
                        try {
                            return Files.size(p);
                        } catch (Exception ex) {
                            return 0;
                        }
                    }).sum();
        } catch (Exception ex) {
            return 0;
        }
    }

    private long toLong(Object value) {
        return value instanceof Number n ? n.longValue() : 0;
    }

    public record TransferStats(long uploadBytes, long uploadCount, long downloadBytes, long downloadCount,
                                List<SeriesPoint> series) {
    }

    public record SeriesPoint(String bucket, long uploadBytes, long downloadBytes) {
    }

    public record ServerOverview(
            int cpuCores, double systemLoad, double processCpuPercent,
            long heapUsed, long heapMax, long nonHeapUsed, long nonHeapMax,
            int threadCount, long uptimeSeconds,
            long systemTotalMemory, long systemFreeMemory,
            long diskTotal, long diskFree,
            long entryCount, long storedBytes, long dataDirBytes, long dbFileBytes) {
    }

    public record TopStats(List<Map<String, Object>> topDownloadFiles, List<Map<String, Object>> topIps,
                           List<Map<String, Object>> topUploadFiles) {
    }
}
